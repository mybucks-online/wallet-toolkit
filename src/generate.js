import {
  generateHash,
  getEvmPrivateKey,
  getEvmWalletAddress,
  getTronWalletAddress,
  generateToken,
  randomPassphrase,
  randomPIN,
} from "@mybucks.online/core";

// main()
// - Generates a random passphrase, PIN, and wallet account for each row.
// - Outputs a CSV with columns: pin,address,network,walletToken,transferLink.
// NOTE:
// The passphrase contains completely random characters (including commas and
// single/double quotes). Emitting it directly in CSV would frequently break
// CSV parsing in tools like Google Sheets. To avoid that, the CSV output
// intentionally omits the raw passphrase; it can always be recovered later
// from the wallet token if needed.
// Args:
//   process.argv[2] => count (optional, default 1)
//   process.argv[3] => network (optional, default "polygon")
async function main() {
  const count = parseInt(process.argv[2]) || 1;
  const network = process.argv[3] || "polygon";

  console.log("pin,address,network,walletToken,transferLink");

  for (let i = 0; i < count; i++) {
    const passphrase = randomPassphrase(6);
    const pin = randomPIN(8);
    const hash = await generateHash(passphrase, pin);
    // const privateKey = getEvmPrivateKey(hash);
    const address =
      network === "tron"
        ? getTronWalletAddress(hash)
        : getEvmWalletAddress(hash);
    const walletToken = generateToken(passphrase, pin, network);
    const transferLink = "https://app.mybucks.online/#wallet=" + walletToken;

    console.log(`${pin},${address},${network},${walletToken},${transferLink}`);
  }
}

main().then(() => process.exit(0));
