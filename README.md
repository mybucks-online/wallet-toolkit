# Generate wallet

Generates disposable crypto wallets for [mybucks.online](https://mybucks.online).

Each wallet is output as a CSV line:

```
passphrase,pin,address,transferLink
```

## Install

```bash
npm install
```

## Usage

### Generate 1 wallet

```bash
node index.js
# or
npm run generate
```

### Generate multiple wallets

```bash
node index.js 10
# or
npm run generate -- 10
```

### Specify network (default: polygon)

Supported networks: `ethereum`, `polygon`, `arbitrum`, `optimism`, `bsc`, `avalanche`, `base`, `tron`

```bash
node index.js 10 ethereum
# or
npm run generate -- 10 ethereum
```
