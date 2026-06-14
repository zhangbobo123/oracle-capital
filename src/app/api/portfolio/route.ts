import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type PortfolioChain = "ethereum" | "bsc" | "solana";

type IndexedBalance = {
  chain: string;
  symbol: string;
  name: string;
  balance: number;
  tokenAddress?: string;
  logo?: string;
  usdPrice?: number;
  usdValue?: number;
  native?: boolean;
  priceExcluded?: boolean;
};

const chainConfig: Record<PortfolioChain, {
  label: string;
  network: string;
  nativeSymbol: string;
  rpcUrls: string[];
  blockscout?: string;
}> = {
  ethereum: {
    label: "Ethereum",
    network: "eth-mainnet",
    nativeSymbol: "ETH",
    rpcUrls: ["https://ethereum-rpc.publicnode.com", "https://rpc.ankr.com/eth"],
    blockscout: "https://eth.blockscout.com",
  },
  bsc: {
    label: "BNB Chain",
    network: "bnb-mainnet",
    nativeSymbol: "BNB",
    rpcUrls: ["https://bsc-rpc.publicnode.com", "https://rpc.ankr.com/bsc"],
    blockscout: "https://bsc.blockscout.com",
  },
  solana: {
    label: "Solana",
    network: "solana-mainnet",
    nativeSymbol: "SOL",
    rpcUrls: ["https://solana-rpc.publicnode.com", "https://api.mainnet-beta.solana.com"],
  },
};

async function rpc(url: string, method: string, params: unknown[]) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`RPC ${response.status}`);
  const data = await response.json() as { result?: unknown; error?: unknown };
  if (data.error || data.result === undefined) throw new Error("RPC returned an error");
  return data.result;
}

async function rpcWithFallback(urls: string[], method: string, params: unknown[]) {
  let lastError: unknown;
  for (const url of urls) {
    try {
      return await rpc(url, method, params);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error("No RPC endpoint available");
}

function numeric(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeAlchemyToken(token: Record<string, unknown>, chain: PortfolioChain): IndexedBalance | null {
  const metadata = (token.tokenMetadata ?? token.metadata ?? {}) as Record<string, unknown>;
  const prices = Array.isArray(token.tokenPrices) ? token.tokenPrices as Record<string, unknown>[] : [];
  const usdPrice = numeric(prices.find((price) => price.currency === "usd")?.value);
  const balance = numeric(token.tokenBalance ?? token.balance) ?? 0;
  if (balance <= 0) return null;
  const config = chainConfig[chain];
  const symbol = String(metadata.symbol ?? token.symbol ?? config.nativeSymbol);
  const tokenAddress = String(token.tokenAddress ?? token.address ?? "");
  return {
    chain: config.label,
    symbol,
    name: String(metadata.name ?? token.name ?? symbol),
    balance,
    tokenAddress: tokenAddress || undefined,
    logo: typeof metadata.logo === "string" ? metadata.logo : undefined,
    usdPrice,
    usdValue: usdPrice === undefined ? undefined : balance * usdPrice,
    native: !tokenAddress || tokenAddress === "0x0000000000000000000000000000000000000000",
  };
}

async function getAlchemyBalances(address: string, chain: PortfolioChain) {
  const apiKey = process.env.ALCHEMY_API_KEY?.trim();
  if (!apiKey) return null;
  const response = await fetch(`https://api.g.alchemy.com/data/v1/${apiKey}/assets/tokens/by-address`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      addresses: [{ address, networks: [chainConfig[chain].network] }],
      withMetadata: true,
      withPrices: true,
      includeNativeTokens: true,
      includeErc20Tokens: chain !== "solana",
      includeSolanaTokens: chain === "solana",
    }),
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Alchemy Portfolio API ${response.status}`);
  const payload = await response.json() as {
    data?: { tokens?: Record<string, unknown>[] };
    tokens?: Record<string, unknown>[];
  };
  return (payload.data?.tokens ?? payload.tokens ?? [])
    .map((token) => normalizeAlchemyToken(token, chain))
    .filter((token): token is IndexedBalance => Boolean(token));
}

async function getEvmFallbackBalances(address: string, chain: "ethereum" | "bsc") {
  const config = chainConfig[chain];
  const balances: IndexedBalance[] = [];
  try {
    const nativeHex = await rpcWithFallback(config.rpcUrls, "eth_getBalance", [address, "latest"]) as string;
    const balance = Number(BigInt(nativeHex)) / 1e18;
    if (balance > 0) {
      balances.push({
        chain: config.label,
        symbol: config.nativeSymbol,
        name: config.nativeSymbol,
        balance,
        native: true,
      });
    }
  } catch (error) {
    console.error(`${config.label} native balance fallback`, error);
  }
  if (!config.blockscout) return balances;
  try {
    const response = await fetch(`${config.blockscout}/api/v2/addresses/${address}/token-balances`, {
      signal: AbortSignal.timeout(12_000),
      cache: "no-store",
    });
    if (!response.ok) return balances;
    const items = await response.json() as Array<{
      value?: string;
      token?: {
        address_hash?: string;
        name?: string;
        symbol?: string;
        decimals?: string | number;
        icon_url?: string;
        exchange_rate?: string;
        circulating_market_cap?: string;
        reputation?: string;
      };
    }>;
    for (const item of items) {
      const decimals = numeric(item.token?.decimals) ?? 0;
      const rawValue = numeric(item.value) ?? 0;
      const balance = rawValue / 10 ** decimals;
      if (balance <= 0) continue;
      const candidatePrice = numeric(item.token?.exchange_rate);
      const marketCap = numeric(item.token?.circulating_market_cap);
      const symbol = item.token?.symbol || "TOKEN";
      const candidateValue = candidatePrice === undefined ? undefined : balance * candidatePrice;
      const trustedPrice = item.token?.reputation !== "spam"
        && item.token?.reputation !== "scam"
        && marketCap !== undefined
        && marketCap > 0
        && candidateValue !== undefined
        && candidateValue <= marketCap;
      balances.push({
        chain: config.label,
        symbol,
        name: item.token?.name || symbol,
        balance,
        tokenAddress: item.token?.address_hash,
        logo: item.token?.icon_url,
        usdPrice: trustedPrice ? candidatePrice : undefined,
        usdValue: trustedPrice ? candidateValue : undefined,
        priceExcluded: !trustedPrice,
      });
    }
  } catch (error) {
    console.error(`${config.label} Blockscout fallback`, error);
  }
  return balances;
}

async function getSolanaFallbackBalances(address: string) {
  const config = chainConfig.solana;
  const [nativeSettled, tokenSettled] = await Promise.allSettled([
    rpcWithFallback(config.rpcUrls, "getBalance", [address]),
    rpcWithFallback(config.rpcUrls, "getTokenAccountsByOwner", [
      address,
      { programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
      { encoding: "jsonParsed" },
    ]),
  ]);
  const nativeResult = nativeSettled.status === "fulfilled" ? nativeSettled.value as { value?: number } : {};
  const tokenResult = tokenSettled.status === "fulfilled" ? tokenSettled.value as {
    value?: Array<{
      account?: {
        data?: {
          parsed?: {
            info?: {
              mint?: string;
              tokenAmount?: { uiAmount?: number; uiAmountString?: string };
            };
          };
        };
      };
    }>;
  } : {};
  const balances: IndexedBalance[] = [];
  const nativeBalance = (nativeResult.value ?? 0) / 1e9;
  if (nativeBalance > 0) {
    balances.push({
      chain: config.label,
      symbol: "SOL",
      name: "Solana",
      balance: nativeBalance,
      native: true,
    });
  }
  for (const item of tokenResult.value ?? []) {
    const info = item.account?.data?.parsed?.info;
    const balance = numeric(info?.tokenAmount?.uiAmountString ?? info?.tokenAmount?.uiAmount) ?? 0;
    if (!info?.mint || balance <= 0) continue;
    balances.push({
      chain: config.label,
      symbol: `${info.mint.slice(0, 4)}…${info.mint.slice(-4)}`,
      name: "SPL Token",
      balance,
      tokenAddress: info.mint,
    });
  }
  return balances;
}

async function enrichUsdValues(balances: IndexedBalance[], chain: PortfolioChain) {
  const config = chainConfig[chain];
  const nativePriceIds: Record<PortfolioChain, string> = {
    ethereum: "coingecko:ethereum",
    bsc: "coingecko:binancecoin",
    solana: "coingecko:solana",
  };
  const entries = balances.map((balance) => {
    if (balance.priceExcluded) return null;
    if (balance.usdPrice !== undefined) return null;
    if (balance.native) return { balance, id: nativePriceIds[chain] };
    if (!balance.tokenAddress) return null;
    return { balance, id: `${chain === "bsc" ? "bsc" : config.network.split("-")[0]}:${balance.tokenAddress}` };
  }).filter((entry): entry is { balance: IndexedBalance; id: string } => Boolean(entry));
  if (!entries.length) return balances;
  try {
    const ids = [...new Set(entries.map((entry) => entry.id))];
    const response = await fetch(`https://coins.llama.fi/prices/current/${ids.join(",")}`, {
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    if (!response.ok) return balances;
    const payload = await response.json() as { coins?: Record<string, { price?: number }> };
    for (const entry of entries) {
      const price = numeric(payload.coins?.[entry.id]?.price);
      if (price === undefined) continue;
      entry.balance.usdPrice = price;
      entry.balance.usdValue = entry.balance.balance * price;
    }
  } catch (error) {
    console.error("Portfolio USD price enrichment", error);
  }
  return balances;
}

export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get("address")?.trim() ?? "";
  const chain = request.nextUrl.searchParams.get("chain") as PortfolioChain | null;
  if (!chain || !(chain in chainConfig)) {
    return NextResponse.json({ error: "chain must be ethereum, bsc or solana" }, { status: 400 });
  }
  const evm = chain === "ethereum" || chain === "bsc";
  if (evm && !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json({ error: "当前钱包地址不支持所选 EVM 主链" }, { status: 400 });
  }
  if (!evm && !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
    return NextResponse.json({ error: "当前钱包地址不支持 Solana 主链" }, { status: 400 });
  }

  try {
    let balances: IndexedBalance[] | null = null;
    let source = "Alchemy Portfolio API";
    try {
      balances = await getAlchemyBalances(address, chain);
    } catch (error) {
      console.error("Alchemy portfolio fallback", error);
    }
    if (!balances) {
      source = chain === "solana" ? "Solana RPC Token Accounts" : "Blockscout Indexer + Public RPC";
      balances = chain === "solana"
        ? await getSolanaFallbackBalances(address)
        : await getEvmFallbackBalances(address, chain);
    }
    balances = await enrichUsdValues(balances, chain);
    balances.sort((a, b) => (b.usdValue ?? 0) - (a.usdValue ?? 0) || b.balance - a.balance);
    return NextResponse.json({
      chain,
      chainLabel: chainConfig[chain].label,
      balances,
      source,
      indexed: source === "Alchemy Portfolio API" || source.includes("Blockscout"),
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Portfolio indexer error", error);
    return NextResponse.json({ error: "无法读取所选主链资产" }, { status: 502 });
  }
}
