import "dotenv/config";
import { ethers } from "ethers";
import { createRequire } from "module";
import * as readline from "node:readline/promises";
import { generateHash, getEvmPrivateKey } from "@mybucks.online/core";
import { EVM_NETWORKS, USDT_DECIMALS } from "./conf/evm.js";

const require = createRequire(import.meta.url);
const erc20 = require("./conf/erc20.json");

const USDT_CONTRACT_BY_CHAIN_ID = Object.freeze({
  1: "0xdAC17F958D2ee523a2206206994597C13D831ec7", // ethereum
  137: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", // polygon
  42161: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", // arbitrum
  10: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58", // optimism
  56: "0x55d398326f99059fF775485246999027B3197955", // bsc (USDT)
  43114: "0x9702230A8ea53601f5cD2dc00fDBc13d4dF4A8c7", // avalanche
  8453: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2", // base
});

async function promptConfirmKey(expectedKey) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    const answer = await rl.question("Enter confirm key to send ETH and USDT: ");
    if (answer.trim() !== expectedKey) {
      throw new Error("Confirm key mismatch. Aborting.");
    }
  } finally {
    rl.close();
  }
}

function printUsageAndExit() {
  console.error("Usage: node src/distribute.js <recipientEvmAddress> [network]");
  console.error(
    "Example: node src/distribute.js 0x1111111111111111111111111111111111111111 polygon",
  );
  process.exit(1);
}

// main()
// - Receives an EVM recipient address from CLI.
// - Sends native coin for gas (GAS_TOPUP_ETH env, default 0.02).
// - Sends USDT (USDT_AMOUNT env, default 3).
// - Requires typing PAY_CONFIRM_KEY on stdin before any send.
async function main() {
  const recipientArg = process.argv[2];
  const networkName = (process.argv[3] || "polygon").trim();
  const gasTopupEth = process.env.GAS_TOPUP_ETH?.trim() || "0.02";
  const usdtAmount = process.env.USDT_AMOUNT?.trim() || "3";

  if (!recipientArg) {
    printUsageAndExit();
  }

  const recipient = ethers.getAddress(recipientArg.trim());
  const network = EVM_NETWORKS.find((item) => item.name === networkName);

  if (!network) {
    throw new Error(`Unsupported network: ${networkName}`);
  }

  const usdtAddress = USDT_CONTRACT_BY_CHAIN_ID[network.chainId];
  if (!usdtAddress) {
    throw new Error(`USDT contract is not configured for chainId ${network.chainId}`);
  }

  const funderPassphrase = process.env.FUNDER_PASSPHRASE?.trim();
  const funderPin = process.env.FUNDER_PIN?.trim();
  if (!funderPassphrase || !funderPin) {
    throw new Error(
      "Missing FUNDER_PASSPHRASE or FUNDER_PIN environment variable.",
    );
  }
  const hash = await generateHash(funderPassphrase, funderPin);
  const privateKey = getEvmPrivateKey(hash);

  const provider = new ethers.JsonRpcProvider(network.provider);
  const wallet = new ethers.Wallet(privateKey, provider);

  console.log(`network: ${network.name} (${network.chainId})`);
  console.log(`from: ${wallet.address}`);
  console.log(`to: ${recipient}`);
  console.log(`native top-up: ${gasTopupEth} (native)`);
  console.log(`USDT transfer: ${usdtAmount}`);

  const confirmKey = process.env.PAY_CONFIRM_KEY?.trim();
  if (!confirmKey) {
    throw new Error("Missing PAY_CONFIRM_KEY environment variable.");
  }
  await promptConfirmKey(confirmKey);

  const gasTopupWei = ethers.parseEther(gasTopupEth);
  const nativeTx = await wallet.sendTransaction({
    to: recipient,
    value: gasTopupWei,
  });
  await nativeTx.wait();
  console.log(`nativeTopupTx: ${nativeTx.hash}`);
  console.log(`nativeTopupAmount: ${gasTopupEth}`);

  const usdt = new ethers.Contract(usdtAddress, erc20.abi, wallet);
  const usdtAmountUnits = ethers.parseUnits(usdtAmount, USDT_DECIMALS);
  const usdtTx = await usdt.transfer(recipient, usdtAmountUnits);
  await usdtTx.wait();

  console.log(`usdtTx: ${usdtTx.hash}`);
  console.log(`usdtAmount: ${usdtAmount}`);
}

main().catch((err) => {
  console.error("Payment failed:", err.message);
  process.exit(1);
});
