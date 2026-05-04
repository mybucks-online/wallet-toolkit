import "dotenv/config";
import { ethers } from "ethers";
import { createRequire } from "module";
import * as readline from "node:readline/promises";
import { generateHash, getEvmPrivateKey } from "@mybucks.online/core";
import { EVM_NETWORKS, USDT_DECIMALS } from "./conf/evm.js";
import { waitForAnyKey } from "./conf/lib.js";

const require = createRequire(import.meta.url);
const erc20 = require("./conf/erc20.json");

// Ethers registers Polygon (137) with a gas-station plugin; that HTTP call often
// times out. Passing an explicit { name, chainId } builds a Network without it,
// so fees come from the RPC (eth_gasPrice / block baseFee) instead.
const GAS_ESTIMATE_BUFFER_NUM = 120n;
const GAS_ESTIMATE_BUFFER_DEN = 100n;

function gasLimitWithBuffer(estimated) {
  return (estimated * GAS_ESTIMATE_BUFFER_NUM + GAS_ESTIMATE_BUFFER_DEN - 1n) /
    GAS_ESTIMATE_BUFFER_DEN;
}

function isZeroNativeTopup(gasTopupEth) {
  try {
    return ethers.parseEther(String(gasTopupEth).trim()) === 0n;
  } catch {
    return false;
  }
}

function isZeroUsdtAmount(usdtAmount) {
  try {
    return ethers.parseUnits(String(usdtAmount).trim(), USDT_DECIMALS) === 0n;
  } catch {
    return false;
  }
}

const USDT_CONTRACT_BY_CHAIN_ID = Object.freeze({
  1: "0xdAC17F958D2ee523a2206206994597C13D831ec7", // ethereum
  137: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", // polygon
  42161: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", // arbitrum
  10: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58", // optimism
  56: "0x55d398326f99059fF775485246999027B3197955", // bsc (USDT)
  43114: "0x9702230A8ea53601f5cD2dc00fDBc13d4dF4A8c7", // avalanche
  8453: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2", // base
});

async function distributeOnce({
  recipient,
  network,
  usdtAddress,
  wallet,
  provider,
  gasTopupEth,
  usdtAmount,
}) {
  const recipientAddr = ethers.getAddress(recipient.trim());

  console.log(`network: ${network.name} (${network.chainId})`);
  console.log(`from: ${wallet.address}`);
  console.log(`to: ${recipientAddr}`);
  console.log(`native top-up: ${gasTopupEth} (native)`);
  console.log(`USDT transfer: ${usdtAmount}`);

  const skipNative = isZeroNativeTopup(gasTopupEth);
  const skipUsdt = isZeroUsdtAmount(usdtAmount);

  if (skipNative) {
    console.log("native top-up skipped (amount is 0)");
  } else {
    await waitForAnyKey(
      "Please confirm to distribute gas fee (native token) first.",
    );

    const gasTopupWei = ethers.parseEther(String(gasTopupEth).trim());
    const nativeGasEst = await provider.estimateGas({
      from: wallet.address,
      to: recipientAddr,
      value: gasTopupWei,
    });
    const nativeGasLimit = gasLimitWithBuffer(nativeGasEst);
    console.log(`nativeGasEstimate: ${nativeGasEst} (limit ${nativeGasLimit} with buffer)`);

    const nativeTx = await wallet.sendTransaction({
      to: recipientAddr,
      value: gasTopupWei,
      gasLimit: nativeGasLimit,
    });
    await nativeTx.wait();
    console.log(`nativeTopupTx: ${nativeTx.hash}`);
    console.log(`nativeTopupAmount: ${gasTopupEth}`);
  }

  if (skipUsdt) {
    console.log("USDT transfer skipped (amount is 0)");
  } else {
    await waitForAnyKey("Please confirm to distribute USDT next.");

    const usdt = new ethers.Contract(usdtAddress, erc20.abi, wallet);
    const usdtAmountUnits = ethers.parseUnits(
      String(usdtAmount).trim(),
      USDT_DECIMALS,
    );
    const usdtGasEst = await usdt.transfer.estimateGas(recipientAddr, usdtAmountUnits, {
      from: wallet.address,
    });
    const usdtGasLimit = gasLimitWithBuffer(usdtGasEst);
    console.log(`usdtGasEstimate: ${usdtGasEst} (limit ${usdtGasLimit} with buffer)`);

    const usdtTx = await usdt.transfer(recipientAddr, usdtAmountUnits, {
      gasLimit: usdtGasLimit,
    });
    await usdtTx.wait();

    console.log(`usdtTx: ${usdtTx.hash}`);
    console.log(`usdtAmount: ${usdtAmount}`);
  }
}

// main()
// - Network from argv[2] (default polygon), validated once.
// - Reads recipient address from stdin in a loop. Sends native top-up then USDT per round.
// - GAS_TOPUP_ETH / USDT_AMOUNT from env (0 = skip that leg, no prompt/tx). Ctrl+C / EOF to exit.
async function main() {
  const networkName = (process.argv[2] ?? "").trim() || "polygon";

  const gasTopupEth = process.env.GAS_TOPUP_ETH?.trim() || "0.03";
  const usdtAmount = process.env.USDT_AMOUNT?.trim() || "3";

  const funderPassphrase = process.env.FUNDER_PASSPHRASE?.trim();
  const funderPin = process.env.FUNDER_PIN?.trim();
  if (!funderPassphrase || !funderPin) {
    throw new Error(
      "Missing FUNDER_PASSPHRASE or FUNDER_PIN environment variable.",
    );
  }
  const hash = await generateHash(funderPassphrase, funderPin);
  const privateKey = getEvmPrivateKey(hash);

  const network = EVM_NETWORKS.find((item) => item.name === networkName);
  if (!network) {
    const known = EVM_NETWORKS.map((n) => n.name).join(", ");
    throw new Error(`Unsupported network: ${networkName}. Use: ${known}`);
  }

  const usdtAddress = USDT_CONTRACT_BY_CHAIN_ID[network.chainId];
  if (!usdtAddress) {
    throw new Error(`USDT contract is not configured for chainId ${network.chainId}`);
  }

  const provider = new ethers.JsonRpcProvider(network.provider, {
    name: network.name,
    chainId: network.chainId,
  });
  const wallet = new ethers.Wallet(privateKey, provider);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log(
    `Network: ${network.name} (${network.chainId}). Enter recipient addresses. Ctrl+C or Ctrl+D (EOF) to exit.\n`,
  );

  try {
    for (;;) {
      const recipientLine = await rl.question("🟢 recipientAddress: ");
      if (recipientLine == null) {
        break;
      }
      const recipient = recipientLine.trim();
      if (!recipient) {
        console.log("(empty — enter an address or EOF to exit)\n");
        continue;
      }

      try {
        await distributeOnce({
          recipient,
          network,
          usdtAddress,
          wallet,
          provider,
          gasTopupEth,
          usdtAmount,
        });
        console.log("");
      } catch (err) {
        console.error("Distribution failed:", err.message, "\n");
      }
    }
  } finally {
    rl.close();
  }
}

main().catch((err) => {
  console.error("Distribute failed:", err.message);
  process.exit(1);
});
