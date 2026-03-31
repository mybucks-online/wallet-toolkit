import {
  parseToken,
  generateHash,
  getEvmWalletAddress,
} from "@mybucks.online/core";

function printUsageAndExit() {
  console.error("Usage: node parse.js <transferLink>");
  console.error(
    "Example: node parse.js \"https://app.mybucks.online/#wallet=<token>\"",
  );
  process.exit(1);
}

function getWalletTokenFromTransferLink(transferLink) {
  let url;
  try {
    url = new URL(transferLink);
  } catch {
    throw new Error("Invalid transferLink URL.");
  }

  const hash = url.hash.startsWith("#") ? url.hash.slice(1) : url.hash;
  const hashParams = new URLSearchParams(hash);
  const walletToken = hashParams.get("wallet");

  if (!walletToken) {
    throw new Error("Missing wallet token in URL hash. Expected #wallet=<token>.");
  }

  return walletToken;
}

// main()
// - Accepts a transfer link argument and trims surrounding whitespace.
// - Extracts wallet token from the URL hash (#wallet=...).
// - Decodes token fields (passphrase, pin, network, legacy) via parseToken.
// - Re-generates the wallet hash and derives the EVM wallet address.
// - Prints decoded values and derived outputs for verification/debugging.
async function main() {
  const transferLinkArg = process.argv[2];
  if (!transferLinkArg) {
    printUsageAndExit();
  }
  const transferLink = transferLinkArg.trim();
  if (!transferLink) {
    printUsageAndExit();
  }

  const walletToken = getWalletTokenFromTransferLink(transferLink);
  const [passphrase, pin, network, legacy] = parseToken(walletToken);

  const hash = await generateHash(passphrase, pin, null, legacy);
  const address = getEvmWalletAddress(hash);

  console.log(`passphrase: ${passphrase}`);
  console.log(`pin: ${pin}`);
  console.log(`network: ${network}`);
  console.log(`legacy: ${legacy}`);
  console.log(`hash: ${hash}`);
  console.log(`evmAddress: ${address}`);
}

main().catch((err) => {
  console.error("Failed to parse transfer link:", err.message);
  process.exit(1);
});
