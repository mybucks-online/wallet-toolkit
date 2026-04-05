export const PIN_MAX_TRY = 3;

export const NETWORK = Object.freeze({
  EVM: "ethereum",
  TRON: "tron",
});

export const EVM_NETWORKS = [
  {
    chainId: 1,
    name: "ethereum",
    label: "Ethereum",
    provider:
      "https://mainnet.infura.io/v3/" + process.env.INFURA_API_KEY,
    scanner: "https://etherscan.io",
  },
  {
    chainId: 137,
    name: "polygon",
    label: "Polygon",
    provider:
      "https://polygon-mainnet.infura.io/v3/" +
      process.env.INFURA_API_KEY,
    scanner: "https://polygonscan.com",
  },
  {
    chainId: 42161,
    name: "arbitrum",
    label: "Arbitrum",
    provider:
      "https://arbitrum-mainnet.infura.io/v3/" +
      process.env.INFURA_API_KEY,
    scanner: "https://arbiscan.io",
  },
  {
    chainId: 10,
    name: "optimism",
    label: "Optimism",
    provider:
      "https://optimism-mainnet.infura.io/v3/" +
      process.env.INFURA_API_KEY,
    scanner: "https://optimistic.etherscan.io",
  },
  {
    chainId: 56,
    name: "bsc",
    label: "BNB Chain",
    provider: "https://bsc-dataseed.binance.org/",
    scanner: "https://bscscan.com",
  },
  {
    chainId: 43114,
    name: "avalanche",
    label: "Avalanche",
    provider:
      "https://avalanche-mainnet.infura.io/v3/" +
      process.env.INFURA_API_KEY,
    scanner: "https://snowtrace.io",
  },
  {
    chainId: 8453,
    name: "base",
    label: "Base",
    provider:
      "https://base-mainnet.infura.io/v3/" +
      process.env.INFURA_API_KEY,
    scanner: "https://basescan.org",
  },
];

export const findNetworkByName = (networkName) => {
  if (networkName === NETWORK.TRON) {
    return [NETWORK.TRON, 1];
  }

  const { chainId } = EVM_NETWORKS.find((item) => item.name === networkName);
  return [NETWORK.EVM, chainId];
};

export const findNetworkNameByChainId = (network, chainId) => {
  if (network === NETWORK.TRON) {
    return NETWORK.TRON;
  }

  const { name } = EVM_NETWORKS.find((item) => item.chainId === chainId);
  return name;
};

export const GAS_PRICE = Object.freeze({
  HIGH: "high",
  AVERAGE: "average",
  LOW: "low",
});

export const USDT_DECIMALS = 6;

// Do not forget dividing by 100n in gas price calculation
export const gasMultiplier = (option) =>
  option === GAS_PRICE.HIGH ? 175n : option === GAS_PRICE.AVERAGE ? 150n : 100n;
