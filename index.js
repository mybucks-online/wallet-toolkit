import { generateHash, getEvmPrivateKey, getEvmWalletAddress, generateToken } from '@mybucks.online/core';
import { generatePassphrase, generatePIN } from './lib.js';

async function main() {
  const count = parseInt(process.argv[2]) || 1;
  const network = process.argv[3] || "polygon";

  for (let i = 0; i < count; i++) {
    const passphrase = generatePassphrase(6);
    const pin = generatePIN();
    const hash = await generateHash(passphrase, pin);
    const privateKey = getEvmPrivateKey(hash);
    const address = getEvmWalletAddress(hash);
    const walletToken = generateToken(passphrase, pin, network);
    const transferLink = 'https://app.mybucks.online/#wallet=' + walletToken;

    console.log(`${passphrase},${pin},${address},${transferLink}`);
  }
}

main().then(() => process.exit(0));
