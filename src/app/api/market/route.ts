import { NextResponse } from "next/server";

export const revalidate = 60;
export const dynamic = "force-dynamic";

const assetConfig = [
  { id: "ethereum", symbol: "ETH", name: "Ethereum", chain: "Ethereum", color: "#627eea" },
  { id: "binancecoin", symbol: "BNB", name: "BNB", chain: "BSC", color: "#f3ba2f" },
  { id: "solana", symbol: "SOL", name: "Solana", chain: "Solana", color: "#14f195" },
] as const;

type CoinGeckoMarket = {
  id: string;
  current_price?: number;
  market_cap?: number;
  market_cap_rank?: number;
  total_volume?: number;
  high_24h?: number;
  low_24h?: number;
  price_change_percentage_24h?: number;
  price_change_percentage_7d_in_currency?: number;
  ath?: number;
  ath_change_percentage?: number;
  circulating_supply?: number;
  total_supply?: number;
  sparkline_in_7d?: { price?: number[] };
};

type ChainTvl = {
  name?: string;
  tvl?: number;
};

type HistoricalPrice = {
  timestamp: number;
  price: number;
};

async function loadMarkets() {
  const params = new URLSearchParams({
    vs_currency: "usd",
    ids: assetConfig.map((asset) => asset.id).join(","),
    price_change_percentage: "24h,7d",
    sparkline: "true",
  });
  const response = await fetch(`https://api.coingecko.com/api/v3/coins/markets?${params}`, {
    headers: { "User-Agent": "Oracle-Capital/1.0" },
    signal: AbortSignal.timeout(2500),
    next: { revalidate: 60 },
  });
  if (!response.ok) throw new Error(`CoinGecko markets ${response.status}`);
  return await response.json() as CoinGeckoMarket[];
}

async function loadFallbackPrices() {
  const response = await fetch(
    "https://coins.llama.fi/prices/current/coingecko:ethereum,coingecko:binancecoin,coingecko:solana",
    { next: { revalidate: 60 } },
  );
  if (!response.ok) return new Map<string, number>();
  const data = await response.json() as { coins?: Record<string, { price?: number }> };
  return new Map(assetConfig.map((asset) => [
    asset.id,
    Number(data.coins?.[`coingecko:${asset.id}`]?.price) || 0,
  ]));
}

async function loadPriceHistory() {
  const histories = await Promise.all(assetConfig.map(async (asset): Promise<[string, HistoricalPrice[]]> => {
    try {
      const coin = `coingecko:${asset.id}`;
      const response = await fetch(`https://coins.llama.fi/chart/${coin}?span=168&period=1h`, {
        next: { revalidate: 300 },
      });
      if (!response.ok) return [asset.id, []];
      const data = await response.json() as { coins?: Record<string, { prices?: HistoricalPrice[] }> };
      return [asset.id, data.coins?.[coin]?.prices ?? []];
    } catch {
      return [asset.id, []];
    }
  }));
  return new Map<string, HistoricalPrice[]>(histories);
}

export async function GET() {
  try {
    const [marketResult, fallbackPrices, priceHistory, tvlResponse] = await Promise.all([
      loadMarkets().catch(() => [] as CoinGeckoMarket[]),
      loadFallbackPrices(),
      loadPriceHistory(),
      fetch("https://api.llama.fi/v2/chains", { next: { revalidate: 300 } }),
    ]);
    const marketMap = new Map(marketResult.map((market) => [market.id, market]));
    const chains = tvlResponse.ok ? await tvlResponse.json() as ChainTvl[] : [];
    const tvlMap = new Map(chains.map((chain) => [chain.name?.toLowerCase(), Number(chain.tvl) || 0]));
    const chainAliases: Record<string, string[]> = {
      Ethereum: ["ethereum"],
      BSC: ["bsc", "binance"],
      Solana: ["solana"],
    };

    const assets = assetConfig.map((asset) => {
      const market = marketMap.get(asset.id);
      const history = priceHistory.get(asset.id) ?? [];
      const historicalPrices = history.map((point) => point.price).filter(Number.isFinite);
      const currentPrice = market?.current_price ?? fallbackPrices.get(asset.id) ?? historicalPrices.at(-1) ?? null;
      const dayAgoPrice = historicalPrices.at(-25) ?? null;
      const weekAgoPrice = historicalPrices.at(0) ?? null;
      const lastDayPrices = historicalPrices.slice(-25);
      const calculateChange = (previous: number | null) => previous && currentPrice
        ? ((currentPrice - previous) / previous) * 100
        : null;
      const marketSparkline = market?.sparkline_in_7d?.price ?? [];
      const sampledSparkline = (marketSparkline.length ? marketSparkline : historicalPrices)
        .filter((_, index) => index % 4 === 0)
        .slice(-42);
      const tvl = chainAliases[asset.chain].reduce((sum, key) => sum + (tvlMap.get(key) ?? 0), 0);
      return {
        ...asset,
        price: currentPrice,
        change24h: market?.price_change_percentage_24h ?? calculateChange(dayAgoPrice),
        change7d: market?.price_change_percentage_7d_in_currency ?? calculateChange(weekAgoPrice),
        marketCap: market?.market_cap ?? null,
        marketCapRank: market?.market_cap_rank ?? null,
        volume24h: market?.total_volume ?? null,
        high24h: market?.high_24h ?? (lastDayPrices.length ? Math.max(...lastDayPrices) : null),
        low24h: market?.low_24h ?? (lastDayPrices.length ? Math.min(...lastDayPrices) : null),
        ath: market?.ath ?? null,
        athChange: market?.ath_change_percentage ?? null,
        circulatingSupply: market?.circulating_supply ?? null,
        totalSupply: market?.total_supply ?? null,
        sparkline7d: sampledSparkline,
        tvl,
      };
    });

    return NextResponse.json({
      assets,
      updatedAt: new Date().toISOString(),
      sources: [
        { name: marketResult.length ? "CoinGecko + DefiLlama Coins" : "DefiLlama Coins", url: marketResult.length ? "https://www.coingecko.com/" : "https://defillama.com/" },
        { name: "DefiLlama", url: "https://defillama.com/" },
      ],
    });
  } catch (error) {
    console.error("Market data error", error);
    return NextResponse.json({ error: "Unable to load live market data" }, { status: 502 });
  }
}
