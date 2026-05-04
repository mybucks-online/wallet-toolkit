# generate-wallet

## Summary

**Scripts:** This repository contains **Node.js** scripts for [mybucks.online](https://mybucks.online) disposable wallets: **generate** CSV wallet rows, **parse** `#wallet=` transfer links into passphrase / PIN / network / address, and **distribute** native coin and **USDT** into those wallets (one recipient at a time, or many in one batch via **Multicall3**). RPC and token settings live under `src/conf/` (`evm.js`, `erc20.json`, …).

| Script | Command | Purpose |
|--------|---------|---------|
| Generate wallets | `node src/index.js` … | CSV rows with pin, address, token, link (no passphrase in CSV). |
| Parse transfer link | `node src/parse.js` | Interactive: paste `#wallet=…` links, print decoded fields + EVM address. |
| Distribute (one at a time) | `node src/distribute.js [network]` | Interactive: native top-up + USDT per recipient address. |
| Distribute (batch) | `node src/distribute-batch.js <wallets.csv> [network]` | Same amounts to many EVM addresses from an `index.js` CSV; Multicall3; keypress confirm before native and before USDT (see below). |

All scripts that touch RPC or `.env` expect you to run them from the **project root** so `dotenv` and paths like `src/conf/…` resolve correctly.

## Install

```bash
npm install
```

## Generate wallets (`src/index.js`)

Each generated wallet is one **CSV** line:

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

## Parse transfer link (`src/parse.js`)

Decodes a **`#wallet=…`** URL from [mybucks.online](https://mybucks.online): reads the token with `parseToken`, recomputes the wallet hash and **EVM address**, and prints passphrase, PIN, network, legacy flag, hash, and address.

### Usage

```bash
node src/parse.js
```

Runs an **infinite loop**: prompt **`🟢 transferLink:`**, paste a full URL, press Enter. Empty lines are ignored; **Ctrl+C** or **Ctrl+D** (EOF) exits. Errors print a message and the loop continues.

No `.env` is required unless you add your own tooling.

## Distribute funds (`src/distribute.js`)

Sends **native token** (for gas) and then **USDT** to a recipient address. The sender (“funder”) is the EVM wallet derived from `FUNDER_PASSPHRASE` and `FUNDER_PIN` via `@mybucks.online/core` (`generateHash`, `getEvmPrivateKey`), same idea as generated disposable wallets.

RPC URLs come from `src/conf/evm.js` and use **`INFURA_API_KEY`** where configured. Load variables from a **`.env`** file in the project root (`dotenv` is applied when the script starts). The USDT contract uses the ABI in **`src/conf/erc20.json`**.

### Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `INFURA_API_KEY` | Yes (for Infura-backed chains) | Used in RPC URLs in `evm.js`. |
| `FUNDER_PASSPHRASE` | Yes | Funder wallet passphrase. |
| `FUNDER_PIN` | Yes | Funder wallet PIN. |
| `GAS_TOPUP_ETH` | No | Native amount per recipient (default `0.03` if unset). Use `0` to skip the native leg each round. |
| `USDT_AMOUNT` | No | USDT amount per recipient (default `3`). Use `0` to skip the USDT leg. |

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

## Batch distribute (`src/distribute-batch.js`)

Sends the **same native top-up** and the **same USDT amount** to **many addresses** in one run, using **[Multicall3](https://github.com/mds1/multicall)** (`0xcA11bde05977b3631167028862bE2a173976CA11` on the chains this repo targets):

1. **One transaction** — `aggregate3Value`: native coin to each recipient (sub-calls with per-address `value`).
2. **One transaction** — `aggregate3`: batched `USDT.transferFrom(funder, recipient, amount)` for each address.

So you normally get **two on-chain transactions** for the transfers themselves. If Multicall3’s USDT allowance is below the batch total, the script sends **one** extra `approve(Multicall3, need)` first (exact `USDT_AMOUNT × N`).

The funder wallet is the same as in `distribute.js` (`FUNDER_PASSPHRASE` / `FUNDER_PIN` → `generateHash` / `getEvmPrivateKey`). RPC and **`INFURA_API_KEY`** come from `src/conf/evm.js`. Load **`.env`** from the project root (`dotenv`).

### Recipients (CSV)

Pass a **CSV file path** as the first argument. The file should match **`src/index.js`** output:

```csv
pin,address,network,walletToken,transferLink
```

The script reads the **second column** (`address`) on each data row, checksums it with `ethers.getAddress`, and **dedupes** while preserving order. Rows that are not valid **EVM** addresses (e.g. Tron `T…` lines) are skipped with a warning. The header row is ignored.

### Environment variables

Same as `distribute.js` for funder / Infura; amounts match the interactive script (defaults **`0.03`** native and **`3`** USDT per recipient if env vars are unset).

| Variable | Required | Description |
|----------|----------|-------------|
| `INFURA_API_KEY` | Yes (Infura-backed chains) | RPC in `evm.js`. |
| `FUNDER_PASSPHRASE` | Yes | Funder passphrase. |
| `FUNDER_PIN` | Yes | Funder PIN. |
| `GAS_TOPUP_ETH` | No | Native **per recipient**. Use `0` to skip the native multicall. |
| `USDT_AMOUNT` | No | USDT **per recipient**. Use `0` to skip the USDT multicall. |

You need enough **native balance** for `GAS_TOPUP_ETH × N` plus gas for all transactions, and enough **USDT** for `USDT_AMOUNT × N`.

### USDT allowance (automatic)

Before the USDT multicall, the script checks **allowance** for Multicall3. If it is below `USDT_AMOUNT × N`, it sends a single **`approve(Multicall3, need)`** with that exact total (one extra transaction when needed). It does **not** send `approve(..., 0)` first; if `approve` reverts on a particular USDT (some older rules around changing allowance), fix allowance in a wallet UI or another tool, then rerun.

> **Security warning:** batch mode uses an ERC20 **approve** transaction before the Multicall3
> **transferFrom** batch. That creates a short window where the approved spender can be abused
> (for example via front-running / ordering games) to pull funds to unintended destinations.
> Use minimum required approvals, trusted infra, and monitor transactions closely.

Token ABI is loaded from **`src/conf/erc20.json`** (`approve`, `allowance`, `transfer`, `transferFrom`).

### Usage

```bash
node src/index.js 10 polygon > wallets.csv
node src/distribute-batch.js wallets.csv polygon
```

First argument is the **CSV path** (required). Second argument is **`network`** for RPC and USDT contract selection (default **`polygon`**). That chain must be an EVM network supported here (same list as `distribute.js`; **not** Tron), and the addresses in the CSV must be **0x** EVM recipients for that batch.

### Behaviour summary

- After printing the batch summary, **`waitForAnyKey`** (same helper as `distribute.js`) runs before the **native** multicall when native is not skipped, and again before the **USDT** path (approve + multicall) when USDT is not skipped: instruction line, then **Press any key to continue…** (TTY: any key; non-TTY: Enter).
- Skips the native multicall if `GAS_TOPUP_ETH` parses to zero; skips the USDT multicall if `USDT_AMOUNT` parses to zero.
- Estimates gas for each multicall and for any `approve` with a ~20% buffer.
- Uses a static `{ name, chainId }` on `JsonRpcProvider` so Polygon does not depend on the public gas-station HTTP endpoint.
