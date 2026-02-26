const { randomInt } = require('crypto');

const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const DIGITS = '0123456789';
const SYMBOLS = '!@#$%^&*_+=?';
const ALPHANUM = UPPER + LOWER + DIGITS;
const ALL = ALPHANUM + SYMBOLS;

function randomChar(charset) {
  return charset[randomInt(charset.length)];
}

function generateSegment(length, charset) {
  return Array.from({ length }, () => randomChar(charset)).join('');
}

// Format: xxxx-xxxx-xxxx-xxxx (19 chars total, UUID-inspired)
// Guarantees: uppercase, lowercase, digit, and symbol present
function generatePassphrase() {
  const segments = Array.from({ length: 4 }, () => generateSegment(4, ALL));
  const passphrase = segments.join('-');

  const hasUpper = /[A-Z]/.test(passphrase);
  const hasLower = /[a-z]/.test(passphrase);
  const hasDigit = /[0-9]/.test(passphrase);
  const hasSymbol = /[!@#$%^&*_+=?]/.test(passphrase);

  if (!hasUpper || !hasLower || !hasDigit || !hasSymbol) {
    return generatePassphrase();
  }

  return passphrase;
}

// 6-character alphanumeric PIN
function generatePIN(length = 6) {
  return generateSegment(length, ALPHANUM);
}

async function main() {
  const passphrase = generatePassphrase();
  const pin = generatePIN();

  console.log(`Passphrase: ${passphrase}`);
  console.log(`PIN:        ${pin}`);
}

main().then(() => process.exit(0));
