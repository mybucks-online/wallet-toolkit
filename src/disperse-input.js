import { readFile } from "node:fs/promises";
import { ethers } from "ethers";

function printUsageAndExit() {
  console.error("Usage: node src/disperse-input.js <wallets.csv> <amount> [--no-dedupe]");
  console.error(
    "Example: node src/disperse-input.js wallets.csv 0.01 > disperse.txt",
  );
  process.exit(1);
}

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

    const address = parts[1].trim();
    try {
      out.push(ethers.getAddress(address));
    } catch {
      console.warn(`skip line ${i + 1}: invalid EVM address (${address})`);
    }
  }

  return out;
}

async function main() {
  const csvPath = (process.argv[2] ?? "").trim();
  const amount = (process.argv[3] ?? "").trim();
  const noDedupe = process.argv.includes("--no-dedupe");

  if (!csvPath || !amount) {
    printUsageAndExit();
  }

  if (!/^\d+(\.\d+)?$/.test(amount)) {
    throw new Error(
      `Invalid amount: "${amount}". Use decimal number format (e.g. 0.01).`,
    );
  }

  const content = await readFile(csvPath, "utf8");
  let addresses = parseAddressesFromWalletCsv(content);
  if (addresses.length === 0) {
    throw new Error("No valid EVM addresses found in CSV.");
  }

  if (!noDedupe) {
    const seen = new Set();
    addresses = addresses.filter((addr) => {
      const key = addr.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  for (const addr of addresses) {
    console.log(`${addr} ${amount}`);
  }
}

main().catch((err) => {
  console.error("disperse-input failed:", err.message);
  process.exit(1);
});
