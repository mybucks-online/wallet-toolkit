import * as readline from "node:readline/promises";
import {
  parseToken,
  generateHash,
  getEvmWalletAddress,
} from "@mybucks.online/core";

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
    throw new Error(
      "Missing wallet token in URL hash. Expected #wallet=<token>.",
    );
  }

  return walletToken;
}

async function parseAndPrintTransferLink(transferLink) {
  const walletToken = getWalletTokenFromTransferLink(transferLink);
  const { passphrase, pin, network, legacy } = parseToken(walletToken);

  const hash = await generateHash(passphrase, pin, null, legacy);
  const address = getEvmWalletAddress(hash);

  console.log(`passphrase: ${passphrase}`);
  console.log(`pin: ${pin}`);
  console.log(`network: ${network}`);
  console.log(`legacy: ${legacy}`);
  console.log(`hash: ${hash}`);
  console.log(`evmAddress: ${address}`);
}

// main()
// - Reads transfer links from stdin in a loop (keyboard).
// - Parses each link and prints passphrase, pin, network, legacy, hash, evmAddress.
// - On error, prints the message and prompts again. Exit with Ctrl+C or Ctrl+D (EOF).
async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log(
    "Paste a transfer link per line. Ctrl+C or Ctrl+D (EOF) to exit.\n",
  );

  try {
    for (;;) {
      const line = await rl.question("🟢 transferLink: ");
      if (line == null) {
        break;
      }
      const transferLink = line.trim();
      if (!transferLink) {
        console.log("(empty line — enter a URL or EOF to exit)\n");
        continue;
      }

      try {
        await parseAndPrintTransferLink(transferLink);
        console.log("");
      } catch (err) {
        console.error("Failed to parse transfer link:", err.message, "\n");
      }
    }
  } finally {
    rl.close();
  }
}

main().catch((err) => {
  console.error("Parse loop failed:", err.message);
  process.exit(1);
});
