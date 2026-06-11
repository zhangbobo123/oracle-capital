import { NextResponse } from "next/server";

export const revalidate = 60;

const assetConfig = [
  { id: "ethereum", symbol: "ETH", name: "Ethereum", chain: "Ethereum" },
  { id: "binancecoin", symbol: "BNB", name: "BNB", chain: "BSC" },
  { id: "solana", symbol: "SOL", name: "Solana", chain: "Solana" },
] as const;

type PriceResponse = Record<string, {
  usd?: number;
  usd_24h_change?: number;
  usd_market_cap?: number;
  usd_24h_vol?: number;
}>;

type ChainTvl = { name?: string; tvl?: number };

async function loadPrices() {
  try {
    const response = await fetch("https://coins.llama.fi/prices/current/coingecko:ethereum,coingecko:binancecoin,coingecko:solana", { next: { revalidate: 60 } });
    if (!response.ok) throw new Error(`DefiLlama Coins ${response.status}`);
    const data = await response.json() as { coins?: Record<string, { price?: number }> };
    const prices: PriceResponse = {};
    for (const asset of assetConfig) {
      prices[asset.id] = { usd: data.coins?.[`coingecko:${asset.id}`]?.price };
    }
    return { prices, source: { name: "DefiLlama Coins", url: "https://defillama.com/" } };
  } catch {
    return { prices: {} as PriceResponse, source: { name: "价格源暂不可用", url: "https://defillama.com/" } };
  }
}

export async function GET() {
  try {
    const [priceData, tvlResponse] = await Promise.all([
      loadPrices(),
      fetch("https://api.llama.fi/v2/chains", { next: { revalidate: 300 } }),
    ]);
    const chains = tvlResponse.ok ? await tvlResponse.json() as ChainTvl[] : [];
    const tvlMap = new Map(chains.map((chain) => [chain.name?.toLowerCase(), Number(chain.tvl) || 0]));
    const chainAliases: Record<string, string[]> = {
      Ethereum: ["ethereum"],
      BSC: ["bsc", "binance"],
      Solana: ["solana"],
    };
    const assets = assetConfig.map((asset) => {
      const price = priceData.prices[asset.id] ?? {};
      const tvl = chainAliases[asset.chain]
        .reduce((sum, key) => sum + (tvlMap.get(key) ?? 0), 0);
      return {
        ...asset,
        price: price.usd ?? null,
        change24h: price.usd_24h_change ?? null,
        marketCap: price.usd_market_cap ?? null,
        volume24h: price.usd_24h_vol ?? null,
        tvl,
      };
    });
    return NextResponse.json({
      assets,
      updatedAt: new Date().toISOString(),
      sources: [
        priceData.source,
        { name: "DefiLlama", url: "https://defillama.com/" },
      ],
    });
  } catch (error) {
    console.error("Market data error", error);
    return NextResponse.json({ error: "Unable to load live market data" }, { status: 502 });
  }
}
