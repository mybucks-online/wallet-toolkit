import {
  generateHash,
  getEvmPrivateKey,
  getEvmWalletAddress,
  getTronWalletAddress,
  generateToken,
  randomPassphrase,
  randomPIN,
} from "@mybucks.online/core";

async function main() {
  const count = parseInt(process.argv[2]) || 1;
  const network = process.argv[3] || "polygon";

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

    console.log(`${passphrase},${pin},${address},${transferLink}`);
  }
}

main().then(() => process.exit(0));
