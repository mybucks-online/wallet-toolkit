import "dotenv/config";
import { readFile } from "node:fs/promises";
import { ethers } from "ethers";
import { createRequire } from "module";
import { generateHash, getEvmPrivateKey } from "@mybucks.online/core";
import { EVM_NETWORKS, USDT_DECIMALS } from "./conf/evm.js";
import { waitForAnyKey } from "./conf/lib.js";

const require = createRequire(import.meta.url);
const erc20 = require("./conf/erc20.json");

/**
 * Multicall3 — same address on Ethereum, Polygon, Arbitrum, Optimism, Base, BSC, Avalanche, etc.
 * @see https://github.com/mds1/multicall
 */
const MULTICALL3 = "0xcA11bde05977b3631167028862bE2a173976CA11";

const MULTICALL3_ABI = [
  "function aggregate3((address target, bool allowFailure, bytes callData)[] calls) payable returns ((bool success, bytes returnData)[] returnData)",
  "function aggregate3Value((address target, bool allowFailure, uint256 value, bytes callData)[] calls) payable returns ((bool success, bytes returnData)[] returnData)",
];

const USDT_CONTRACT_BY_CHAIN_ID = Object.freeze({
  1: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  137: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
  42161: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
  10: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58",
  56: "0x55d398326f99059fF775485246999027B3197955",
  43114: "0x9702230A8ea53601f5cD2dc00fDBc13d4dF4A8c7",
  8453: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2",
});

const GAS_BUFFER_NUM = 120n;
const GAS_BUFFER_DEN = 100n;

function gasLimitWithBuffer(estimated) {
  return (estimated * GAS_BUFFER_NUM + GAS_BUFFER_DEN - 1n) / GAS_BUFFER_DEN;
}

function printUsageAndExit() {
  console.error("Usage: node src/distribute-batch.js <wallets.csv> [network]");
  console.error(
    "  wallets.csv — CSV from index.js (pin,address,network,walletToken,transferLink); EVM address is column 2.",
  );
  console.error("  Example: node src/index.js 10 polygon > wallets.csv");
  console.error("           node src/distribute-batch.js wallets.csv polygon");
  process.exit(1);
}

/**
 * Parse wallet CSV as produced by src/index.js (comma-separated, no quoted fields).
 * Uses the second column as the EVM recipient address. Skips the header row.
 */
function parseAddressesFromWalletCsv(content) {
  const lines = content.split(/\r?\n/);
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) {
      continue;
    }
    const lower = line.toLowerCase();
    if (lower.startsWith("pin,") || lower.startsWith("pin,address,")) {
      continue;
    }
    const parts = line.split(",");
    if (parts.length < 2) {
      continue;
    }
    const addrRaw = parts[1].trim();
    try {
      out.push(ethers.getAddress(addrRaw));
    } catch {
      console.warn(
        `skip line ${i + 1}: not a valid EVM address — ${addrRaw.slice(0, 24)}…`,
      );
    }
  }
  const seen = new Set();
  const deduped = [];
  for (const a of out) {
    const k = a.toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      deduped.push(a);
    }
  }
  return deduped;
}

async function ensureUsdtAllowanceForMulticall(usdt, ownerAddress, need, spender) {
  const allowance = await usdt.allowance(ownerAddress, spender);
  if (allowance >= need) {
    return;
  }

  // Single approve to the exact total this batch needs. If this reverts on older USDT
  // (non-zero allowance quirks), reset allowance off-chain or use a larger prior approve.
  const approveGas = await usdt.approve.estimateGas(spender, need);
  const approveTx = await usdt.approve(spender, need, {
    gasLimit: gasLimitWithBuffer(approveGas),
  });
  console.log(
    `USDT approve Multicall3 for ${ethers.formatUnits(need, USDT_DECIMALS)} USDT: ${approveTx.hash}`,
  );
  await approveTx.wait();
}

async function main() {
  const csvPath = (process.argv[2] ?? "").trim();
  const networkName = (process.argv[3] ?? "").trim() || "polygon";
  if (!csvPath) {
    printUsageAndExit();
  }

  let fileContent;
  try {
    fileContent = await readFile(csvPath, "utf8");
  } catch (err) {
    throw new Error(`Cannot read CSV file: ${csvPath} (${err.message})`);
  }

  const recipients = parseAddressesFromWalletCsv(fileContent);
  if (recipients.length === 0) {
    throw new Error(
      "No EVM addresses found in CSV (expected index.js format: pin,address,network,walletToken,transferLink).",
    );
  }

  const gasTopupEth = process.env.GAS_TOPUP_ETH?.trim() || "0.03";
  const usdtAmount = process.env.USDT_AMOUNT?.trim() || "3";

  const funderPassphrase = process.env.FUNDER_PASSPHRASE?.trim();
  const funderPin = process.env.FUNDER_PIN?.trim();
  if (!funderPassphrase || !funderPin) {
    throw new Error(
      "Missing FUNDER_PASSPHRASE or FUNDER_PIN environment variable.",
    );
  }

  const network = EVM_NETWORKS.find((item) => item.name === networkName);
  if (!network) {
    const known = EVM_NETWORKS.map((n) => n.name).join(", ");
    throw new Error(`Unsupported network: ${networkName}. Use: ${known}`);
  }

  const usdtAddress = USDT_CONTRACT_BY_CHAIN_ID[network.chainId];
  if (!usdtAddress) {
    throw new Error(`USDT not configured for chainId ${network.chainId}`);
  }

  const hash = await generateHash(funderPassphrase, funderPin);
  const privateKey = getEvmPrivateKey(hash);

  const provider = new ethers.JsonRpcProvider(network.provider, {
    name: network.name,
    chainId: network.chainId,
  });
  const wallet = new ethers.Wallet(privateKey, provider);

  const skipNative = (() => {
    try {
      return ethers.parseEther(String(gasTopupEth).trim()) === 0n;
    } catch {
      return false;
    }
  })();
  const skipUsdt = (() => {
    try {
      return ethers.parseUnits(String(usdtAmount).trim(), USDT_DECIMALS) === 0n;
    } catch {
      return false;
    }
  })();

  const multicall = new ethers.Contract(MULTICALL3, MULTICALL3_ABI, wallet);
  const usdtIface = new ethers.Interface(erc20.abi);

  console.log(`csv: ${csvPath}`);
  console.log(`network: ${network.name} (${network.chainId})`);
  console.log(`from: ${wallet.address}`);
  console.log(`recipients: ${recipients.length}`);
  console.log(`multicall3: ${MULTICALL3}`);
  console.log(`native per wallet: ${gasTopupEth} (skip: ${skipNative})`);
  console.log(`USDT per wallet: ${usdtAmount} (skip: ${skipUsdt})`);

  // --- Tx 1: native to all recipients in one Multicall3.aggregate3Value ---
  if (!skipNative) {
    const perWei = ethers.parseEther(String(gasTopupEth).trim());
    const totalWei = perWei * BigInt(recipients.length);
    await waitForAnyKey(
      `Please confirm native batch: send ${gasTopupEth} (native) to EACH of ${recipients.length} addresses in one Multicall3 transaction (total native value ${ethers.formatEther(totalWei)}).`,
    );
    const valueCalls = recipients.map((addr) => ({
      target: addr,
      allowFailure: false,
      value: perWei,
      callData: "0x",
    }));

    const nativeData = multicall.interface.encodeFunctionData("aggregate3Value", [
      valueCalls,
    ]);
    const nativeGas = await provider.estimateGas({
      from: wallet.address,
      to: MULTICALL3,
      data: nativeData,
      value: totalWei,
    });
    const nativeTx = await wallet.sendTransaction({
      to: MULTICALL3,
      data: nativeData,
      value: totalWei,
      gasLimit: gasLimitWithBuffer(nativeGas),
    });
    console.log(`native batch tx (aggregate3Value): ${nativeTx.hash}`);
    await nativeTx.wait();
    console.log("native batch confirmed.");
  } else {
    console.log("native batch skipped (GAS_TOPUP_ETH is 0).");
  }

  // --- Tx 2: USDT transferFrom funder -> each recipient in one aggregate3 ---
  if (!skipUsdt) {
    const perUsdt = ethers.parseUnits(String(usdtAmount).trim(), USDT_DECIMALS);
    const need = perUsdt * BigInt(recipients.length);
    await waitForAnyKey(
      `Please confirm USDT batch: send ${usdtAmount} USDT to EACH of ${recipients.length} addresses (one Multicall3 tx; an approve tx runs first only if allowance is too low).`,
    );
    const usdt = new ethers.Contract(usdtAddress, erc20.abi, wallet);
    await ensureUsdtAllowanceForMulticall(usdt, wallet.address, need, MULTICALL3);

    const calls = recipients.map((addr) => ({
      target: usdtAddress,
      allowFailure: false,
      callData: usdtIface.encodeFunctionData("transferFrom", [
        wallet.address,
        addr,
        perUsdt,
      ]),
    }));

    const usdtData = multicall.interface.encodeFunctionData("aggregate3", [calls]);
    const usdtGas = await provider.estimateGas({
      from: wallet.address,
      to: MULTICALL3,
      data: usdtData,
    });
    const usdtTx = await wallet.sendTransaction({
      to: MULTICALL3,
      data: usdtData,
      gasLimit: gasLimitWithBuffer(usdtGas),
    });
    console.log(`USDT batch tx (aggregate3): ${usdtTx.hash}`);
    await usdtTx.wait();
    console.log("USDT batch confirmed.");
  } else {
    console.log("USDT batch skipped (USDT_AMOUNT is 0).");
  }
}

main().catch((err) => {
  console.error("distribute-batch failed:", err.message);
  process.exit(1);
});
