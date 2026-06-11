import Link from "next/link";
import { ArrowLeft, ArrowRight, Activity, BarChart3, Layers3, ShieldCheck, TrendingUp } from "lucide-react";

const assets = [
  { symbol: "ETH", name: "Ethereum", price: "$3,496.40", change: "+3.28%", chain: "Ethereum", tvl: "$63.2B", tone: "text-[var(--positive)]" },
  { symbol: "BNB", name: "BNB", price: "$648.12", change: "+1.42%", chain: "BNB Chain", tvl: "$7.1B", tone: "text-[var(--positive)]" },
  { symbol: "SOL", name: "Solana", price: "$162.84", change: "-0.76%", chain: "Solana", tvl: "$9.4B", tone: "text-red-500" },
];

const opportunities = [
  ["ETH 现货", "中等", "长期配置与分批建仓", "避免单次重仓"],
  ["Aave 借贷", "中等", "稳定币与 ETH 收益", "关注健康因子"],
  ["永续合约", "高", "对冲或短周期策略", "限制杠杆与止损"],
];

export default function MarketPage() {
  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <header className="border-b border-[var(--line)] bg-[var(--bg-glass)] backdrop-blur">
        <div className="mx-auto flex h-20 max-w-[1200px] items-center justify-between px-5 lg:px-10">
          <Link href="/" className="flex items-center gap-3 font-serif text-lg"><ArrowLeft size={17} />追光者</Link>
          <nav className="flex items-center gap-6 text-sm"><span className="text-[var(--ink)]">市场</span><Link href="/rankings" className="text-[var(--muted)] hover:text-[var(--ink)]">排行榜</Link><Link href="/" className="primary-btn">AI 委员会</Link></nav>
        </div>
      </header>
      <section className="hero-glow mx-auto max-w-[1200px] px-5 py-14 lg:px-10">
        <div className="section-label"><TrendingUp size={14} /> MARKET INTELLIGENCE</div>
        <h1 className="mt-4 font-serif text-4xl md:text-6xl">多链市场中心</h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--muted)]">聚焦 ETH、BSC 与 Solana 的现货、DeFi 和合约机会。当前数据用于黑客松演示，不代表实时行情。</p>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {assets.map((asset) => (
            <article key={asset.symbol} className="stat-card">
              <div className="flex items-center justify-between"><div><div className="font-serif text-2xl">{asset.symbol}</div><div className="text-xs text-[var(--muted)]">{asset.name}</div></div><span className={`text-sm ${asset.tone}`}>{asset.change}</span></div>
              <div className="mt-7 font-mono text-2xl">{asset.price}</div>
              <div className="mt-6 flex justify-between border-t border-[var(--line)] pt-4 text-xs text-[var(--muted)]"><span>{asset.chain}</span><span>TVL {asset.tvl}</span></div>
              <Link href={`/?question=${encodeURIComponent(`请分析 ${asset.symbol} 的现货、DeFi 和合约机会`)}`} className="mt-5 flex items-center justify-between text-xs text-[var(--green)]">交给 AI 委员会分析<ArrowRight size={14} /></Link>
            </article>
          ))}
        </div>
      </section>
      <section className="border-t border-[var(--line)] bg-[var(--panel-soft)]">
        <div className="mx-auto max-w-[1200px] px-5 py-14 lg:px-10">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="stat-card"><Activity className="text-[var(--gold)]" /><div className="mt-5 text-xs text-[var(--muted)]">市场情绪</div><div className="mt-2 font-serif text-2xl">谨慎乐观</div></div>
            <div className="stat-card"><Layers3 className="text-[var(--gold)]" /><div className="mt-5 text-xs text-[var(--muted)]">覆盖网络</div><div className="mt-2 font-serif text-2xl">ETH · BSC · SOL</div></div>
            <div className="stat-card"><ShieldCheck className="text-[var(--gold)]" /><div className="mt-5 text-xs text-[var(--muted)]">风险状态</div><div className="mt-2 font-serif text-2xl">波动偏高</div></div>
          </div>
          <div className="mt-10 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
            <div className="flex items-center gap-2 border-b border-[var(--line)] p-5 font-serif text-xl"><BarChart3 size={18} />策略机会雷达</div>
            {opportunities.map(([name, risk, use, note]) => <div key={name} className="grid gap-2 border-b border-[var(--line)] p-5 text-sm last:border-0 md:grid-cols-4"><strong>{name}</strong><span>风险：{risk}</span><span className="text-[var(--muted)]">{use}</span><span className="text-[var(--muted)]">{note}</span></div>)}
          </div>
        </div>
      </section>
    </main>
  );
}
