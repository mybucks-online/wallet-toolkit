# Generate wallet

Generates disposable crypto wallets for [mybucks.online](https://mybucks.online).

Each wallet is output as a CSV line:

```
passphrase,pin,address,transferLink
```

### Example output

```
_kW7PO-=SVxPv-1x2O*8-1s=2xR,
RAaxq6,
0x1Ec17EbD74e80E9afB0b5CB7291d5a9c51b0b1F8,
https://app.mybucks.online/#wallet=ncE9iqX2tXN1BPLT1TVnhQdi0xeDJPKjgtMXM9MnhSAlJBYXhxNgJldGhlcmV1bQ==CpGUYu

L#Qr2x-KsYlqt-sHfbK#-QQtw$B,
kssUmm,
0x263a79FC3EeF9D256a60AAB7f0E5954F6de0916F,
https://app.mybucks.online/#wallet=-e42AYTCNRcjJ4LUtzWWxxdC1zSGZiSyMtUVF0dyRCAmtzc1VtbQJldGhlcmV1bQ==XbzB2U
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
