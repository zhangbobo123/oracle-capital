"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Bot,
  CircleDollarSign,
  Clock3,
  ExternalLink,
  Flame,
  Gauge,
  Layers3,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Star,
  TrendingUp,
  Waves,
} from "lucide-react";

type MarketAsset = {
  id: string;
  symbol: string;
  name: string;
  chain: string;
  color: string;
  price: number | null;
  change24h: number | null;
  change7d: number | null;
  marketCap: number | null;
  marketCapRank: number | null;
  volume24h: number | null;
  high24h: number | null;
  low24h: number | null;
  ath: number | null;
  athChange: number | null;
  circulatingSupply: number | null;
  totalSupply: number | null;
  sparkline7d: number[];
  tvl: number;
};

type MarketData = {
  assets: MarketAsset[];
  updatedAt: string;
  sources: { name: string; url: string }[];
};

const researchSources = [
  ["OpenClue", "市场叙事", "追踪热点、项目动态和研究线索", "https://openclue.net/"],
  ["DeFiLlama", "DeFi 数据", "多链 TVL、收益率、协议与资金流", "https://defillama.com/"],
  ["Dune", "链上看板", "查询和浏览社区构建的链上数据", "https://dune.com/"],
  ["Nansen", "聪明钱", "钱包标签、持仓变化与资金流分析", "https://www.nansen.ai/"],
];

const compactUsd = (value: number | null, digits = 2) => {
  if (value === null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: Math.abs(value) >= 1_000_000 ? "compact" : "standard",
    maximumFractionDigits: digits,
  }).format(value);
};

const percent = (value: number | null) => value === null
  ? "—"
  : `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;

function Sparkline({ values, positive, color }: { values: number[]; positive: boolean; color: string }) {
  if (values.length < 2) return <div className="h-20 rounded-xl bg-[var(--panel-soft)]" />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * 100;
    const y = 46 - ((value - min) / range) * 42;
    return `${x},${y}`;
  }).join(" ");
  const fillPoints = `0,50 ${points} 100,50`;
  const stroke = positive ? color : "#d35f5f";

  return (
    <svg viewBox="0 0 100 50" preserveAspectRatio="none" className="h-20 w-full overflow-visible" aria-label="7日价格走势">
      <defs>
        <linearGradient id={`market-gradient-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity=".28" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={fillPoints} fill={`url(#market-gradient-${color.replace("#", "")})`} />
      <polyline points={points} fill="none" stroke={stroke} strokeWidth="1.8" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function ChangeBadge({ value }: { value: number | null }) {
  const positive = (value ?? 0) >= 0;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${value === null ? "bg-[var(--wash)] text-[var(--muted)]" : positive ? "bg-emerald-500/10 text-[var(--positive)]" : "bg-red-500/10 text-red-500"}`}>
      {value !== null && (positive ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />)}
      {percent(value)}
    </span>
  );
}

export default function MarketPage() {
  const [data, setData] = useState<MarketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState<"24h" | "7d">("24h");
  const [watchlist, setWatchlist] = useState<string[]>([]);

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
    const savedTheme = window.localStorage.getItem("oracle-capital-theme");
    document.documentElement.dataset.theme = savedTheme === "dark" ? "dark" : "light";
    const timer = window.setTimeout(() => {
      try {
        setWatchlist(JSON.parse(window.localStorage.getItem("oracle-capital-market-watchlist") ?? "[]") as string[]);
      } catch {
        window.localStorage.removeItem("oracle-capital-market-watchlist");
      }
      void loadMarket();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadMarket]);

  const toggleWatchlist = (symbol: string) => {
    setWatchlist((current) => {
      const next = current.includes(symbol) ? current.filter((item) => item !== symbol) : [...current, symbol];
      window.localStorage.setItem("oracle-capital-market-watchlist", JSON.stringify(next));
      return next;
    });
  };

  const summary = useMemo(() => {
    const assets = data?.assets ?? [];
    const marketCaps = assets.map((asset) => asset.marketCap).filter((value): value is number => value !== null);
    const volumes = assets.map((asset) => asset.volume24h).filter((value): value is number => value !== null);
    const totalMarketCap = marketCaps.length ? marketCaps.reduce((sum, value) => sum + value, 0) : null;
    const totalVolume = volumes.length ? volumes.reduce((sum, value) => sum + value, 0) : null;
    const totalTvl = assets.reduce((sum, asset) => sum + asset.tvl, 0);
    const changes = assets.map((asset) => period === "24h" ? asset.change24h : asset.change7d).filter((value): value is number => value !== null);
    const averageChange = changes.length ? changes.reduce((sum, value) => sum + value, 0) / changes.length : null;
    const strongest = [...assets].sort((a, b) => ((period === "24h" ? b.change24h : b.change7d) ?? -Infinity) - ((period === "24h" ? a.change24h : a.change7d) ?? -Infinity))[0];
    return { totalMarketCap, totalVolume, totalTvl, averageChange, strongest };
  }, [data, period]);

  const sentiment = summary.averageChange === null
    ? { label: "等待数据", description: "市场方向尚未确认", score: 50 }
    : summary.averageChange > 3
      ? { label: "风险偏好升温", description: "核心资产普遍走强，警惕追高", score: 78 }
      : summary.averageChange > 0
        ? { label: "温和偏多", description: "市场有承接，但分化仍然存在", score: 62 }
        : summary.averageChange > -3
          ? { label: "谨慎震荡", description: "资金偏防守，等待方向选择", score: 42 }
          : { label: "风险规避", description: "波动扩大，优先控制仓位", score: 24 };

  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <header className="sticky top-0 z-30 border-b border-[var(--line)] bg-[var(--bg-glass)] backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-[1280px] items-center justify-between px-5 lg:px-10">
          <Link href="/" className="flex items-center gap-3 font-serif text-lg"><ArrowLeft size={17} />追光者</Link>
          <nav className="flex items-center gap-5 text-sm"><span>市场</span><Link href="/community" className="text-[var(--muted)] hover:text-[var(--ink)]">社区</Link><Link href="/" className="primary-btn"><Bot size={15} />AI 委员会</Link></nav>
        </div>
      </header>

      <section className="market-hero overflow-hidden border-b border-[var(--line)]">
        <div className="mx-auto max-w-[1280px] px-5 py-12 lg:px-10 lg:py-16">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <div className="section-label"><Activity size={14} /> LIVE ONCHAIN TERMINAL</div>
              <h1 className="mt-4 max-w-3xl font-serif text-4xl leading-tight md:text-6xl">市场不缺噪声，<br /><span className="text-[var(--gold)]">缺的是可执行的判断。</span></h1>
              <p className="mt-5 max-w-2xl text-sm leading-7 text-[var(--muted)]">聚合核心资产行情、多链 TVL 与资金效率，为 AI 投资委员会提供实时市场上下文。</p>
            </div>
            <div className="flex items-center gap-3">
              {data && <span className="hidden items-center gap-2 text-xs text-[var(--muted)] sm:flex"><Clock3 size={14} />更新于 {new Date(data.updatedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>}
              <button onClick={() => void loadMarket()} disabled={loading} className="secondary-btn"><RefreshCw className={loading ? "animate-spin" : ""} size={15} />刷新</button>
            </div>
          </div>

          {error && <div className="mt-8 rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-500">{error}</div>}
          {loading && !data ? (
            <div className="mt-12 flex min-h-52 items-center justify-center gap-3 rounded-3xl border border-[var(--line)] bg-[var(--panel-glass)] text-sm text-[var(--muted)]"><LoaderCircle className="animate-spin" />正在聚合实时市场与链上数据...</div>
          ) : (
            <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="market-metric">
                <div className="flex items-center justify-between"><span>{summary.totalMarketCap !== null ? "核心资产总市值" : `核心资产平均涨跌 · ${period}`}</span><CircleDollarSign size={17} /></div>
                <strong>{summary.totalMarketCap !== null ? compactUsd(summary.totalMarketCap) : percent(summary.averageChange)}</strong>
                <p>{summary.totalMarketCap !== null ? "ETH、BNB、SOL 合计" : "ETH、BNB、SOL 等权平均"}</p>
              </div>
              <div className="market-metric">
                <div className="flex items-center justify-between"><span>{summary.totalVolume !== null ? "24h 成交量" : `相对强势 · ${period}`}</span><Waves size={17} /></div>
                <strong>{summary.totalVolume !== null ? compactUsd(summary.totalVolume) : summary.strongest?.symbol ?? "—"}</strong>
                <p>{summary.totalVolume !== null ? `成交量 / 市值 ${summary.totalMarketCap ? `${((summary.totalVolume / summary.totalMarketCap) * 100).toFixed(2)}%` : "—"}` : `${period} 表现领先核心资产`}</p>
              </div>
              <div className="market-metric">
                <div className="flex items-center justify-between"><span>三链 TVL</span><Layers3 size={17} /></div>
                <strong>{compactUsd(summary.totalTvl)}</strong>
                <p>Ethereum、BSC、Solana</p>
              </div>
              <div className="market-metric market-sentiment">
                <div className="flex items-center justify-between"><span>市场温度</span><Gauge size={17} /></div>
                <strong className="text-2xl">{sentiment.label}</strong>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--wash)]"><span className="block h-full rounded-full bg-[var(--gold)] transition-all" style={{ width: `${sentiment.score}%` }} /></div>
                <p>{sentiment.description}</p>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-[1280px] px-5 py-12 lg:px-10">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div><div className="section-label"><TrendingUp size={14} /> MARKET OVERVIEW</div><h2 className="mt-3 font-serif text-3xl md:text-4xl">核心资产行情</h2></div>
          <div className="flex rounded-full border border-[var(--line)] bg-[var(--panel)] p-1">
            {(["24h", "7d"] as const).map((item) => <button key={item} onClick={() => setPeriod(item)} className={`rounded-full px-5 py-2 text-xs font-semibold transition ${period === item ? "bg-[var(--green)] text-[var(--bg)]" : "text-[var(--muted)] hover:text-[var(--ink)]"}`}>{item}</button>)}
          </div>
        </div>

        <div className="mt-7 grid gap-5 lg:grid-cols-3">
          {data?.assets.map((asset) => {
            const change = period === "24h" ? asset.change24h : asset.change7d;
            const positive = (asset.change7d ?? asset.change24h ?? 0) >= 0;
            const rangePosition = asset.high24h && asset.low24h && asset.price
              ? Math.min(100, Math.max(0, ((asset.price - asset.low24h) / (asset.high24h - asset.low24h || 1)) * 100))
              : 50;
            return (
              <article key={asset.symbol} className="market-asset-card" style={{ "--asset-color": asset.color } as React.CSSProperties}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="grid h-11 w-11 place-items-center rounded-full text-sm font-bold text-[#101713]" style={{ background: asset.color }}>{asset.symbol.slice(0, 1)}</span>
                    <div><div className="flex items-center gap-2"><h3 className="font-serif text-2xl">{asset.symbol}</h3>{asset.marketCapRank && <span className="rounded-full bg-[var(--wash)] px-2 py-0.5 text-[9px] text-[var(--muted)]">#{asset.marketCapRank}</span>}</div><p className="text-xs text-[var(--muted)]">{asset.name} · {asset.chain}</p></div>
                  </div>
                  <button onClick={() => toggleWatchlist(asset.symbol)} aria-label={`${watchlist.includes(asset.symbol) ? "取消收藏" : "收藏"} ${asset.symbol}`} className={`icon-btn h-9 w-9 ${watchlist.includes(asset.symbol) ? "border-[var(--gold)] text-[var(--gold)]" : ""}`}><Star size={15} fill={watchlist.includes(asset.symbol) ? "currentColor" : "none"} /></button>
                </div>

                <div className="mt-7 flex items-end justify-between gap-3"><strong className="font-mono text-3xl tracking-tight">{compactUsd(asset.price)}</strong><ChangeBadge value={change} /></div>
                <div className="mt-5"><Sparkline values={asset.sparkline7d} positive={positive} color={asset.color} /></div>

                <div className="mt-4">
                  <div className="flex justify-between text-[10px] text-[var(--muted)]"><span>低 {compactUsd(asset.low24h)}</span><span>24h 区间</span><span>高 {compactUsd(asset.high24h)}</span></div>
                  <div className="mt-2 h-1.5 rounded-full bg-[var(--wash)]"><span className="block h-full rounded-full" style={{ width: `${rangePosition}%`, background: asset.color }} /></div>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-4 border-t border-[var(--line)] pt-5 text-xs">
                  <div><span className="text-[var(--muted)]">市值</span><strong className="mt-1 block">{compactUsd(asset.marketCap)}</strong></div>
                  <div><span className="text-[var(--muted)]">24h 成交量</span><strong className="mt-1 block">{compactUsd(asset.volume24h)}</strong></div>
                  <div><span className="text-[var(--muted)]">链 TVL</span><strong className="mt-1 block">{compactUsd(asset.tvl)}</strong></div>
                  <div><span className="text-[var(--muted)]">距历史高点</span><strong className={`mt-1 block ${(asset.athChange ?? 0) < -50 ? "text-[var(--muted)]" : ""}`}>{percent(asset.athChange)}</strong></div>
                </div>
                <Link href={`/?question=${encodeURIComponent(`结合最新市场数据，分析 ${asset.symbol} 的现货、DeFi 和合约机会，并给出仓位、入场区间、止损与分批计划`)}`} className="mt-6 flex items-center justify-between rounded-xl bg-[var(--panel-soft)] px-4 py-3 text-xs font-semibold text-[var(--green)] transition hover:translate-x-0.5">
                  <span className="flex items-center gap-2"><Sparkles size={14} />交给 AI 委员会分析</span><ArrowRight size={14} />
                </Link>
              </article>
            );
          })}
        </div>
      </section>

      <section className="border-y border-[var(--line)] bg-[var(--panel-soft)]">
        <div className="mx-auto grid max-w-[1280px] gap-8 px-5 py-12 lg:grid-cols-[1.35fr_.65fr] lg:px-10">
          <div>
            <div className="section-label"><Layers3 size={14} /> ONCHAIN LIQUIDITY</div>
            <div className="mt-3 flex items-end justify-between gap-4"><h2 className="font-serif text-3xl">多链流动性对比</h2><span className="text-xs text-[var(--muted)]">TVL 与原生资产市值口径</span></div>
            <div className="mt-6 overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel)]">
              <div className="hidden grid-cols-[1.2fr_1fr_1fr_1fr] border-b border-[var(--line)] px-5 py-3 text-[10px] uppercase tracking-wider text-[var(--muted)] sm:grid"><span>网络</span><span>TVL</span><span>TVL / 市值</span><span>流动性占比</span></div>
              {data?.assets.map((asset) => {
                const tvlShare = summary.totalTvl ? (asset.tvl / summary.totalTvl) * 100 : 0;
                const efficiency = asset.marketCap ? (asset.tvl / asset.marketCap) * 100 : null;
                return (
                  <div key={asset.chain} className="grid gap-4 border-b border-[var(--line)] px-5 py-5 last:border-0 sm:grid-cols-[1.2fr_1fr_1fr_1fr] sm:items-center">
                    <div className="flex items-center gap-3"><span className="h-2.5 w-2.5 rounded-full" style={{ background: asset.color }} /><div><strong className="text-sm">{asset.chain}</strong><p className="mt-1 text-[10px] text-[var(--muted)]">{asset.symbol} 生态</p></div></div>
                    <strong className="text-sm">{compactUsd(asset.tvl)}</strong>
                    <span className="text-sm">{efficiency === null ? "—" : `${efficiency.toFixed(2)}%`}</span>
                    <div><div className="h-2 overflow-hidden rounded-full bg-[var(--wash)]"><span className="block h-full rounded-full" style={{ width: `${tvlShare}%`, background: asset.color }} /></div><span className="mt-1 block text-[10px] text-[var(--muted)]">{tvlShare.toFixed(1)}%</span></div>
                  </div>
                );
              })}
            </div>
          </div>

          <aside className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-6">
            <div className="flex items-center justify-between"><div className="section-label"><Flame size={14} /> MARKET SIGNAL</div><Activity size={18} className="text-[var(--gold)]" /></div>
            <h3 className="mt-5 font-serif text-3xl">{summary.strongest?.symbol ?? "—"} <span className="text-base text-[var(--muted)]">相对强势</span></h3>
            <p className="mt-3 text-sm leading-7 text-[var(--muted)]">按当前 {period} 涨跌排序。相对强势不代表适合追涨，应结合成交量、TVL 和风险承受能力判断。</p>
            <div className="mt-6 space-y-4 border-t border-[var(--line)] pt-5">
              <div className="flex items-center justify-between text-xs"><span className="text-[var(--muted)]">平均涨跌</span><ChangeBadge value={summary.averageChange} /></div>
              <div className="flex items-center justify-between text-xs"><span className="text-[var(--muted)]">自选资产</span><strong>{watchlist.length} / 3</strong></div>
              <div className="flex items-center justify-between text-xs"><span className="text-[var(--muted)]">数据源</span><strong>{data?.sources.map((source) => source.name).join(" + ") ?? "—"}</strong></div>
            </div>
            <Link href={`/?question=${encodeURIComponent(`比较 ETH、BNB、SOL 当前的相对强弱、链上 TVL 和风险收益，投票选出一个最值得关注的方向，并给出最终方案`)}`} className="primary-btn mt-7 w-full"><Bot size={15} />发起三链委员会</Link>
          </aside>
        </div>
      </section>

      <section className="mx-auto max-w-[1280px] px-5 py-12 lg:px-10">
        <div className="section-label"><BarChart3 size={14} /> RESEARCH DESK</div>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4"><div><h2 className="font-serif text-3xl">研究工作台</h2><p className="mt-2 text-sm text-[var(--muted)]">从行情出发，再回到链上证据和协议基本面。</p></div><span className="text-xs text-[var(--muted)]">外部网站将在新标签页打开</span></div>
        <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {researchSources.map(([name, category, description, url], index) => (
            <a key={name} href={url} target="_blank" rel="noreferrer" className="research-card">
              <div className="flex items-center justify-between"><span className="font-serif text-3xl text-[var(--gold)]">0{index + 1}</span><ExternalLink size={15} /></div>
              <span className="mt-6 block text-[10px] uppercase tracking-widest text-[var(--muted)]">{category}</span>
              <strong className="mt-2 block font-serif text-2xl">{name}</strong>
              <p className="mt-3 text-xs leading-6 text-[var(--muted)]">{description}</p>
            </a>
          ))}
        </div>
        <div className="mt-8 flex items-start gap-3 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 text-xs leading-6 text-[var(--muted)]"><ShieldCheck className="mt-1 shrink-0 text-[var(--gold)]" size={16} />行情优先来自 CoinGecko，并由 DefiLlama Coins 提供价格与历史序列回退；链 TVL 来自 DefiLlama。数据可能因索引延迟和第三方口径不同而变化，交易前请再次核对。</div>
      </section>
    </main>
  );
}
