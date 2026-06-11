import Link from "next/link";
import { ArrowLeft, ArrowRight, Award, BarChart3 } from "lucide-react";

const masters = [
  ["弗里德里希·哈耶克", "货币竞争", "进取", "+27.3%", "76"],
  ["彼得·林奇", "成长价值", "均衡", "+24.1%", "82"],
  ["约翰·凯恩斯", "宏观周期", "均衡", "+22.5%", "79"],
  ["艾萨克·牛顿", "量化周期", "均衡", "+21.8%", "74"],
  ["沃伦·巴菲特", "价值投资", "稳健", "+18.4%", "91"],
  ["亚当·斯密", "市场机制", "稳健", "+17.6%", "87"],
  ["查理·芒格", "多元思维", "稳健", "+15.7%", "93"],
  ["卡尔·马克思", "资本结构", "均衡", "+12.9%", "80"],
];

export default function RankingsPage() {
  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <header className="border-b border-[var(--line)] bg-[var(--bg-glass)] backdrop-blur">
        <div className="mx-auto flex h-20 max-w-[1000px] items-center justify-between px-5 lg:px-10">
          <Link href="/" className="flex items-center gap-3 font-serif text-lg"><ArrowLeft size={17} />追光者</Link>
          <nav className="flex items-center gap-6 text-sm"><Link href="/market" className="text-[var(--muted)] hover:text-[var(--ink)]">市场</Link><span>排行榜</span><Link href="/" className="primary-btn">选择大师</Link></nav>
        </div>
      </header>
      <section className="hero-glow mx-auto max-w-[1000px] px-5 py-14 lg:px-10">
        <div className="section-label"><Award size={14} /> MASTER RANKINGS</div>
        <h1 className="mt-4 font-serif text-4xl md:text-6xl">大师模拟表现榜</h1>
        <p className="mt-4 text-sm text-[var(--muted)]">基于演示策略的 30 日模拟结果。排名不代表真实人物表现，也不构成未来收益承诺。</p>
        <div className="mt-10 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)] shadow-sm">
          <div className="hidden grid-cols-[60px_1.5fr_1fr_1fr_100px_40px] border-b border-[var(--line)] px-5 py-3 text-[10px] uppercase tracking-wider text-[var(--muted)] md:grid"><span>排名</span><span>大师</span><span>风格</span><span>风险</span><span>模拟收益</span><span /></div>
          {masters.map(([name, school, risk, performance, score], index) => (
            <Link href={`/?master=${index}`} key={name} className="grid grid-cols-[44px_1fr_auto] items-center gap-3 border-b border-[var(--line)] p-5 last:border-0 hover:bg-[var(--panel-soft)] md:grid-cols-[60px_1.5fr_1fr_1fr_100px_40px]">
              <span className="font-serif text-xl">{index + 1}</span>
              <div><strong className="text-sm">{name}</strong><div className="mt-1 text-[10px] text-[var(--muted)]">综合评分 {score}</div></div>
              <span className="hidden text-sm md:block">{school}</span>
              <span className="hidden text-sm text-[var(--muted)] md:block">{risk}</span>
              <span className="font-mono text-sm text-[var(--positive)]">{performance}</span>
              <ArrowRight className="hidden md:block" size={15} />
            </Link>
          ))}
        </div>
        <div className="mt-8 flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel-soft)] p-4 text-xs text-[var(--muted)]"><BarChart3 size={16} />收益、评分与排名均为产品演示数据，真实投资决策应结合可验证的市场数据与风险承受能力。</div>
      </section>
    </main>
  );
}
