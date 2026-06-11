"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, BarChart3, ExternalLink, LoaderCircle, RefreshCw, ShieldCheck, TrendingUp } from "lucide-react";

type MarketAsset = {
  id: string;
  symbol: string;
  name: string;
  chain: string;
  price: number | null;
  change24h: number | null;
  marketCap: number | null;
  volume24h: number | null;
  tvl: number;
};

type MarketData = {
  assets: MarketAsset[];
  updatedAt: string;
  sources: { name: string; url: string }[];
};

const researchSources = [
  ["OpenClue", "市场研究与链上叙事", "https://openclue.net/"],
  ["DeFiLlama", "多链 TVL、收益与协议数据", "https://defillama.com/"],
  ["Dune", "社区链上数据看板", "https://dune.com/"],
  ["Nansen", "钱包标签与资金流分析", "https://www.nansen.ai/"],
];

const compactUsd = (value: number | null) => {
  if (value === null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 2 }).format(value);
};

export default function MarketPage() {
  const [data, setData] = useState<MarketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadMarket = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/market", { cache: "no-store" });
      if (!response.ok) throw new Error("Market API failed");
      setData(await response.json() as MarketData);
    } catch {
      setError("实时市场数据暂时不可用，请稍后重试。");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadMarket(), 0);
    return () => window.clearTimeout(timer);
  }, [loadMarket]);

  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <header className="border-b border-[var(--line)] bg-[var(--bg-glass)] backdrop-blur">
        <div className="mx-auto flex h-20 max-w-[1200px] items-center justify-between px-5 lg:px-10">
          <Link href="/" className="flex items-center gap-3 font-serif text-lg"><ArrowLeft size={17} />追光者</Link>
          <nav className="flex items-center gap-6 text-sm"><span>市场</span><Link href="/rankings" className="text-[var(--muted)] hover:text-[var(--ink)]">排行榜</Link><Link href="/" className="primary-btn">AI 委员会</Link></nav>
        </div>
      </header>
      <section className="hero-glow mx-auto max-w-[1200px] px-5 py-14 lg:px-10">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div><div className="section-label"><TrendingUp size={14} /> LIVE MARKET INTELLIGENCE</div><h1 className="mt-4 font-serif text-4xl md:text-6xl">多链市场中心</h1><p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--muted)]">聚合公开市场价格与 DefiLlama 链上 TVL。价格约每分钟更新，TVL 约每五分钟更新。</p></div>
          <button onClick={() => void loadMarket()} disabled={loading} className="secondary-btn"><RefreshCw className={loading ? "animate-spin" : ""} size={15} />刷新数据</button>
        </div>
        {error && <div className="mt-8 rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-500">{error}</div>}
        {loading && !data ? <div className="mt-12 flex items-center gap-3 text-sm text-[var(--muted)]"><LoaderCircle className="animate-spin" />正在聚合实时市场与链上数据...</div> : (
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {data?.assets.map((asset) => (
              <article key={asset.symbol} className="stat-card">
                <div className="flex items-center justify-between"><div><div className="font-serif text-2xl">{asset.symbol}</div><div className="text-xs text-[var(--muted)]">{asset.name} · {asset.chain}</div></div><span className={`text-sm ${(asset.change24h ?? 0) >= 0 ? "text-[var(--positive)]" : "text-red-500"}`}>{asset.change24h === null ? "—" : `${asset.change24h >= 0 ? "+" : ""}${asset.change24h.toFixed(2)}%`}</span></div>
                <div className="mt-7 font-mono text-2xl">{compactUsd(asset.price)}</div>
                <div className="mt-6 grid grid-cols-2 gap-3 border-t border-[var(--line)] pt-4 text-xs"><div><span className="text-[var(--muted)]">24h 成交量</span><strong className="mt-1 block">{compactUsd(asset.volume24h)}</strong></div><div><span className="text-[var(--muted)]">市值</span><strong className="mt-1 block">{compactUsd(asset.marketCap)}</strong></div><div><span className="text-[var(--muted)]">链 TVL</span><strong className="mt-1 block">{compactUsd(asset.tvl)}</strong></div><div><span className="text-[var(--muted)]">更新</span><strong className="mt-1 block">{data ? new Date(data.updatedAt).toLocaleTimeString("zh-CN") : "—"}</strong></div></div>
                <Link href={`/?question=${encodeURIComponent(`请基于最新市场数据分析 ${asset.symbol} 的现货、DeFi 和合约机会`)}`} className="mt-5 flex items-center justify-between text-xs text-[var(--green)]">交给 AI 委员会分析<ArrowRight size={14} /></Link>
              </article>
            ))}
          </div>
        )}
      </section>
      <section className="border-t border-[var(--line)] bg-[var(--panel-soft)]">
        <div className="mx-auto max-w-[1200px] px-5 py-14 lg:px-10">
          <div className="section-label"><BarChart3 size={14} /> 研究工具</div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {researchSources.map(([name, description, url]) => <a key={name} href={url} target="_blank" rel="noreferrer" className="topic-row"><div className="flex-1"><strong>{name}</strong><p className="mt-1 text-xs text-[var(--muted)]">{description}</p></div><ExternalLink size={15} /></a>)}
          </div>
          <div className="mt-8 flex items-start gap-3 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 text-xs leading-6 text-[var(--muted)]"><ShieldCheck className="mt-1 shrink-0 text-[var(--gold)]" size={16} />链上数据可能因索引延迟、RPC 状态和第三方口径不同而变化。交易前应在区块浏览器和协议官方界面再次核对。</div>
        </div>
      </section>
    </main>
  );
}
