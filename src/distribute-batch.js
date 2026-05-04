import "dotenv/config";
import { ethers } from "ethers";
import { createRequire } from "module";
import { generateHash, getEvmPrivateKey } from "@mybucks.online/core";
import { EVM_NETWORKS, USDT_DECIMALS } from "./conf/evm.js";

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

// ---------------------------------------------------------------------------
// Edit this list — EVM addresses (same native + USDT amount per address).
// ---------------------------------------------------------------------------
const RECIPIENTS = [
  // "0x1111111111111111111111111111111111111111",
  // "0x2222222222222222222222222222222222222222",
];

const GAS_BUFFER_NUM = 120n;
const GAS_BUFFER_DEN = 100n;

function gasLimitWithBuffer(estimated) {
  return (estimated * GAS_BUFFER_NUM + GAS_BUFFER_DEN - 1n) / GAS_BUFFER_DEN;
}

async function ensureUsdtAllowanceForMulticall(usdt, ownerAddress, need, spender) {
  let allowance = await usdt.allowance(ownerAddress, spender);
  if (allowance >= need) {
    return;
  }

  // USDT (Ethereum-style): cannot change allowance from non-zero to another non-zero without reset.
  if (allowance > 0n) {
    const resetGas = await usdt.approve.estimateGas(spender, 0);
    const resetTx = await usdt.approve(spender, 0, {
      gasLimit: gasLimitWithBuffer(resetGas),
    });
    console.log(`USDT approve(0) reset tx: ${resetTx.hash}`);
    await resetTx.wait();
    allowance = await usdt.allowance(ownerAddress, spender);
  }

  const approveGas = await usdt.approve.estimateGas(spender, need);
  const approveTx = await usdt.approve(spender, need, {
    gasLimit: gasLimitWithBuffer(approveGas),
  });
  console.log(
    `USDT approve Multicall3 for ${ethers.formatUnits(need, USDT_DECIMALS)} USDT: ${approveTx.hash}`,
  );
  await approveTx.wait();
}

function normalizeRecipients(raw) {
  const out = [];
  for (const line of raw) {
    const t = String(line).trim();
    if (!t || t.startsWith("//")) {
      continue;
    }
    out.push(ethers.getAddress(t));
  }
  return out;
}

async function main() {
  const networkName = (process.argv[2] ?? "").trim() || "polygon";
  const gasTopupEth = process.env.GAS_TOPUP_ETH?.trim() || "0.03";
  const usdtAmount = process.env.USDT_AMOUNT?.trim() || "3";

  const recipients = normalizeRecipients(RECIPIENTS);
  if (recipients.length === 0) {
    throw new Error(
      "No recipients: add addresses to the RECIPIENTS array in distribute-batch.js",
    );
  }

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
    const usdt = new ethers.Contract(usdtAddress, erc20.abi, wallet);
    const need = perUsdt * BigInt(recipients.length);
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
