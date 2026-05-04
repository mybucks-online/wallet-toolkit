# Generate wallet

Generates disposable crypto wallets for [mybucks.online](https://mybucks.online).

Each wallet is output as a CSV line:

```
pin,address,network,walletToken,transferLink
```

The **passphrase is not included in the CSV** because it contains fully random
characters (including commas and quotes) that frequently break CSV parsing in
tools like Google Sheets. The passphrase can always be recovered later from
the `walletToken`.

### Example output

```csv
pin,address,network,walletToken,transferLink
RAaxq6,0x1Ec17EbD74e80E9afB0b5CB7291d5a9c51b0b1F8,polygon,ncE9iqX2tXN1BPLT1TVnhQdi0xeDJPKjgtMXM9MnhSAlJBYXhxNgJldGhlcmV1bQ==CpGUYu,https://app.mybucks.online/#wallet=ncE9iqX2tXN1BPLT1TVnhQdi0xeDJPKjgtMXM9MnhSAlJBYXhxNgJldGhlcmV1bQ==CpGUYu
kssUmm,0x263a79FC3EeF9D256a60AAB7f0E5954F6de0916F,polygon,-e42AYTCNRcjJ4LUtzWWxxdC1zSGZiSyMtUVF0dyRCAmtzc1VtbQJldGhlcmV1bQ==XbzB2U,https://app.mybucks.online/#wallet=-e42AYTCNRcjJ4LUtzWWxxdC1zSGZiSyMtUVF0dyRCAmtzc1VtbQJldGhlcmV1bQ==XbzB2U
```

## Install

```bash
npm install
```

## Usage

### Generate 1 wallet

```bash
node src/index.js
# or
npm run generate
```

### Generate multiple wallets

```bash
node src/index.js 10
# or
npm run generate -- 10
```

### Specify network (default: polygon)

Supported networks: `ethereum`, `polygon`, `arbitrum`, `optimism`, `bsc`, `avalanche`, `base`, `tron`

```bash
node src/index.js 10 ethereum
# or
npm run generate -- 10 ethereum
```

## Distribute funds (`src/distribute.js`)

Sends **native token** (for gas) and then **USDT** to a recipient address. The sender (“funder”) is the EVM wallet derived from `FUNDER_PASSPHRASE` and `FUNDER_PIN` via `@mybucks.online/core` (`generateHash`, `getEvmPrivateKey`), same idea as generated disposable wallets.

RPC URLs come from `src/conf/evm.js` and use **`INFURA_API_KEY`** where configured. Load variables from a **`.env`** file in the project root (`dotenv` is applied when the script starts).

### Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `INFURA_API_KEY` | Yes (for Infura-backed chains) | Used in RPC URLs in `evm.js`. |
| `FUNDER_PASSPHRASE` | Yes | Funder wallet passphrase. |
| `FUNDER_PIN` | Yes | Funder wallet PIN. |
| `GAS_TOPUP_ETH` | No | Native amount to send first (default `0.02`). Use `0` to skip native top-up for each round. |
| `USDT_AMOUNT` | No | USDT amount to send (default `3`). Use `0` to skip the USDT transfer. |

### Usage

```bash
node src/distribute.js [network]
```

`network` defaults to **`polygon`** if omitted (e.g. `node src/distribute.js` or `node src/distribute.js polygon`). Then an interactive loop prompts only for **`🟢 recipientAddress:`** each round. **Ctrl+C** or **Ctrl+D** (EOF) on that prompt exits.

Supported network names match `src/conf/evm.js` (e.g. `ethereum`, `polygon`, `arbitrum`, `optimism`, `bsc`, `avalanche`, `base`).

### Behaviour

1. Resolves the chain from the `[network]` argument once (RPC + funder wallet reused for every recipient).
2. For each round, reads one recipient address from stdin.
3. Prints network, funder `from`, recipient `to`, and planned native / USDT amounts.
4. Shows **Please confirm to distribute gas fee (native token) first.** then **Press any key to continue...** (TTY: any key; non-TTY: press Enter).
5. Estimates gas for the native transfer (with a buffer), broadcasts it, waits for confirmation.
6. Shows **Please confirm to distribute USDT next.** and waits again.
7. Estimates gas for the USDT `transfer`, broadcasts it, waits for confirmation.

If a round fails (bad address, RPC error, etc.), the error is printed and the loop continues.

Gas fees are taken from the RPC (Polygon does not use the public gas station URL that ethers would otherwise call for chain `137`).

### Example output

```text
network: polygon (137)
from: 0x19Ed87E3a5dD45525cd7bDd3b3ADBA501BDe4A2b
to: 0x762F330Af76553Db690CE7D54926bA6be173E8e6
native top-up: 0.03 (native)
USDT transfer: 3
Please confirm to distribute gas fee (native token) first.
Press any key to continue...
nativeGasEstimate: 21000 (limit 25200 with buffer)
nativeTopupTx: 0x66297df2183576053f2e4f6a78ee24c6fcdea3832d79bb3b2c631b2d336b0705
nativeTopupAmount: 0.03
Please confirm to distribute USDT next.
Press any key to continue...
usdtGasEstimate: 67571 (limit 81086 with buffer)
usdtTx: 0x66e75d5a8c4c51922e9919e88e6252ef4f7e918455a80633020b070bc03e2489
usdtAmount: 3
```
