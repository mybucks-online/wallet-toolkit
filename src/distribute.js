import "dotenv/config";
import { ethers } from "ethers";
import { createRequire } from "module";
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

const USDT_CONTRACT_BY_CHAIN_ID = Object.freeze({
  1: "0xdAC17F958D2ee523a2206206994597C13D831ec7", // ethereum
  137: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", // polygon
  42161: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", // arbitrum
  10: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58", // optimism
  56: "0x55d398326f99059fF775485246999027B3197955", // bsc (USDT)
  43114: "0x9702230A8ea53601f5cD2dc00fDBc13d4dF4A8c7", // avalanche
  8453: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2", // base
});

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
// - Waits for a keypress (TTY) or Enter (non-TTY) before each send, after a
//   caller-provided instruction line.
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

  // generate funder wallet from passphrase and PIN
  const funderPassphrase = process.env.FUNDER_PASSPHRASE?.trim();
  const funderPin = process.env.FUNDER_PIN?.trim();
  if (!funderPassphrase || !funderPin) {
    throw new Error(
      "Missing FUNDER_PASSPHRASE or FUNDER_PIN environment variable.",
    );
  }
  const hash = await generateHash(funderPassphrase, funderPin);
  const privateKey = getEvmPrivateKey(hash);

  const provider = new ethers.JsonRpcProvider(network.provider, {
    name: network.name,
    chainId: network.chainId,
  });
  const wallet = new ethers.Wallet(privateKey, provider);

  console.log(`network: ${network.name} (${network.chainId})`);
  console.log(`from: ${wallet.address}`);
  console.log(`to: ${recipient}`);
  console.log(`native top-up: ${gasTopupEth} (native)`);
  console.log(`USDT transfer: ${usdtAmount}`);

  await waitForAnyKey(
    "Please confirm to distribute gas fee (native token) first.",
  );

  // distribute gas fee (native token)
  const gasTopupWei = ethers.parseEther(gasTopupEth);
  const nativeGasEst = await provider.estimateGas({
    from: wallet.address,
    to: recipient,
    value: gasTopupWei,
  });
  const nativeGasLimit = gasLimitWithBuffer(nativeGasEst);
  console.log(`nativeGasEstimate: ${nativeGasEst} (limit ${nativeGasLimit} with buffer)`);

  const nativeTx = await wallet.sendTransaction({
    to: recipient,
    value: gasTopupWei,
    gasLimit: nativeGasLimit,
  });
  await nativeTx.wait();
  console.log(`nativeTopupTx: ${nativeTx.hash}`);
  console.log(`nativeTopupAmount: ${gasTopupEth}`);

  await waitForAnyKey("Please confirm to distribute USDT next.");

  // distribute USDT
  const usdt = new ethers.Contract(usdtAddress, erc20.abi, wallet);
  const usdtAmountUnits = ethers.parseUnits(usdtAmount, USDT_DECIMALS);
  const usdtGasEst = await usdt.transfer.estimateGas(recipient, usdtAmountUnits, {
    from: wallet.address,
  });
  const usdtGasLimit = gasLimitWithBuffer(usdtGasEst);
  console.log(`usdtGasEstimate: ${usdtGasEst} (limit ${usdtGasLimit} with buffer)`);

  const usdtTx = await usdt.transfer(recipient, usdtAmountUnits, {
    gasLimit: usdtGasLimit,
  });
  await usdtTx.wait();

  console.log(`usdtTx: ${usdtTx.hash}`);
  console.log(`usdtAmount: ${usdtAmount}`);
}

main().catch((err) => {
  console.error("Payment failed:", err.message);
  process.exit(1);
});
