"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Bell,
  Check,
  CircleDollarSign,
  Globe2,
  History,
  Mic,
  Moon,
  Pause,
  Play,
  Plus,
  Send,
  ShieldCheck,
  Sparkles,
  Sun,
  UserRound,
  Wallet,
  X,
} from "lucide-react";

type Master = {
  id: string;
  name: string;
  en: string;
  school: string;
  quote: string;
  return: string;
  risk: "稳健" | "均衡" | "激进";
  position: string;
};

const masters: Master[] = [
  { id: "buffett", name: "沃伦·巴菲特", en: "Warren Buffett", school: "价值投资", quote: "价格是你付出的，价值是你得到的。", return: "+18.4%", risk: "稳健", position: "0% 0%" },
  { id: "munger", name: "查理·芒格", en: "Charlie Munger", school: "多元思维", quote: "先避开愚蠢，再寻找聪明。", return: "+15.7%", risk: "稳健", position: "33.333% 0%" },
  { id: "lynch", name: "彼得·林奇", en: "Peter Lynch", school: "成长价值", quote: "投资你真正理解的事物。", return: "+24.1%", risk: "均衡", position: "66.666% 0%" },
  { id: "newton", name: "艾萨克·牛顿", en: "Isaac Newton", school: "量化周期", quote: "用规律观察市场，也敬畏疯狂。", return: "+21.8%", risk: "均衡", position: "100% 0%" },
  { id: "hayek", name: "弗里德里希·哈耶克", en: "Friedrich Hayek", school: "货币竞争", quote: "价格是分散知识的信号。", return: "+27.3%", risk: "激进", position: "0% 100%" },
  { id: "marx", name: "卡尔·马克思", en: "Karl Marx", school: "资本结构", quote: "穿透收益，审视资本关系。", return: "+12.9%", risk: "均衡", position: "33.333% 100%" },
  { id: "smith", name: "亚当·斯密", en: "Adam Smith", school: "市场机制", quote: "长期价值来自分工与交换。", return: "+17.6%", risk: "稳健", position: "66.666% 100%" },
  { id: "keynes", name: "约翰·凯恩斯", en: "John Maynard Keynes", school: "宏观周期", quote: "市场保持非理性的时间可能更久。", return: "+22.5%", risk: "均衡", position: "100% 100%" },
];

const translations = {
  zh: {
    navMarket: "市场",
    navMasters: "投资大师",
    navRank: "排行榜",
    connect: "连接钱包",
    eyebrow: "AI 投资委员会",
    title: "选择你的投资智囊团",
    sub: "与伟大的思想同桌。选择一位大师深入对话，或邀请三位以上组成委员会，共同审视每一次投资。",
    selected: "已选择",
    start: "开始对话",
    council: "召开投资委员会",
    need: "至少选择 3 位大师召开委员会",
    topics: "今日热门议题",
    ranking: "大师近期表现",
  },
  en: {
    navMarket: "Markets",
    navMasters: "Masters",
    navRank: "Rankings",
    connect: "Connect Wallet",
    eyebrow: "AI INVESTMENT COUNCIL",
    title: "Choose your circle of conviction",
    sub: "Sit with history's sharpest minds. Speak with one master, or bring three together to challenge every investment decision.",
    selected: "Selected",
    start: "Start conversation",
    council: "Convene the council",
    need: "Select at least 3 masters for a council",
    topics: "Today's questions",
    ranking: "Recent performance",
  },
};

function Avatar({ master, size = "md" }: { master: Master; size?: "sm" | "md" | "lg" }) {
  const dimensions = size === "lg" ? "h-24 w-24" : size === "sm" ? "h-8 w-8" : "h-11 w-11";
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  return (
    <div
      aria-label={master.name}
      className={`${dimensions} shrink-0 rounded-full border border-[var(--line)] shadow-sm`}
      style={{
        backgroundImage: `url('${basePath}/images/masters-grid.png')`,
        backgroundPosition: master.position,
        backgroundSize: "400% 200%",
      }}
    />
  );
}

function BrandMark() {
  return (
    <div className="flex items-center gap-3">
      <div className="relative grid h-10 w-10 place-items-center rounded-full border border-[var(--green)]">
        <div className="h-4 w-2 rounded-t-full bg-[var(--green)]" />
        <span className="absolute -top-1 h-3 w-px bg-[var(--gold)]" />
        <span className="absolute right-1 top-1 h-3 w-px rotate-45 bg-[var(--gold)]" />
        <span className="absolute left-1 top-1 h-3 w-px -rotate-45 bg-[var(--gold)]" />
      </div>
      <div>
        <div className="font-serif text-lg font-semibold leading-none tracking-[0.12em]">追光者</div>
        <div className="mt-1 text-[9px] tracking-[0.28em] text-[var(--muted)]">ORACLE CAPITAL</div>
      </div>
    </div>
  );
}

export default function Home() {
  const [selected, setSelected] = useState<string[]>(["buffett", "munger", "lynch"]);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [lang, setLang] = useState<"zh" | "en">("zh");
  const [view, setView] = useState<"home" | "chat" | "profile">("home");
  const [walletOpen, setWalletOpen] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const t = translations[lang];
  const selectedMasters = masters.filter((master) => selected.includes(master.id));

  const toggleMaster = (id: string) => {
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--ink)] transition-colors">
      <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[color:var(--bg)/.94] backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-[1440px] items-center justify-between px-5 lg:px-10">
          <button onClick={() => setView("home")}><BrandMark /></button>
          <nav className="hidden items-center gap-9 text-sm text-[var(--muted)] md:flex">
            <button className="hover:text-[var(--ink)]">{t.navMarket}</button>
            <button onClick={() => setView("home")} className="text-[var(--ink)]">{t.navMasters}</button>
            <button className="hover:text-[var(--ink)]">{t.navRank}</button>
          </nav>
          <div className="flex items-center gap-2">
            <button className="icon-btn" onClick={() => setLang(lang === "zh" ? "en" : "zh")} aria-label="Change language">
              <Globe2 size={17} />
            </button>
            <button className="icon-btn" onClick={() => setTheme(theme === "light" ? "dark" : "light")} aria-label="Toggle theme">
              {theme === "light" ? <Moon size={17} /> : <Sun size={17} />}
            </button>
            <button className="icon-btn hidden sm:grid" aria-label="Notifications"><Bell size={17} /></button>
            <button onClick={() => setWalletOpen(true)} className="primary-btn ml-1">
              <Wallet size={16} /> <span className="hidden sm:inline">{t.connect}</span>
            </button>
            <button onClick={() => setView("profile")} className="icon-btn"><UserRound size={17} /></button>
          </div>
        </div>
      </header>

      {view === "home" && (
        <HomeView
          t={t}
          selected={selected}
          selectedMasters={selectedMasters}
          toggleMaster={toggleMaster}
          onStart={() => selected.length && setView("chat")}
        />
      )}
      {view === "chat" && <ChatView selectedMasters={selectedMasters} onBack={() => setView("home")} />}
      {view === "profile" && <ProfileView />}
      {walletOpen && <WalletModal onClose={() => setWalletOpen(false)} />}
    </main>
  );
}

function HomeView({
  t,
  selected,
  selectedMasters,
  toggleMaster,
  onStart,
}: {
  t: typeof translations.zh;
  selected: string[];
  selectedMasters: Master[];
  toggleMaster: (id: string) => void;
  onStart: () => void;
}) {
  return (
    <>
      <section className="hero-glow mx-auto max-w-[1440px] px-5 pb-16 pt-16 text-center lg:px-10 lg:pt-24">
        <div className="mb-5 text-xs font-semibold tracking-[0.28em] text-[var(--gold)]">{t.eyebrow}</div>
        <h1 className="mx-auto max-w-4xl font-serif text-4xl leading-tight md:text-6xl lg:text-[72px]">{t.title}</h1>
        <p className="mx-auto mt-6 max-w-2xl text-sm leading-7 text-[var(--muted)] md:text-base">{t.sub}</p>

        <div className="mx-auto mt-14 grid max-w-6xl grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {masters.map((master) => {
            const active = selected.includes(master.id);
            return (
              <button
                key={master.id}
                onClick={() => toggleMaster(master.id)}
                className={`master-card group relative overflow-hidden p-5 text-left ${active ? "selected" : ""}`}
              >
                <div className="absolute right-4 top-4 grid h-6 w-6 place-items-center rounded-full border border-[var(--line)] bg-[var(--panel)]">
                  {active && <Check size={14} />}
                </div>
                <Avatar master={master} size="lg" />
                <div className="mt-5 flex items-center justify-between">
                  <span className="rounded-full bg-[var(--wash)] px-2.5 py-1 text-[10px] font-semibold text-[var(--green)]">{master.school}</span>
                  <span className="text-xs font-semibold text-[var(--positive)]">{master.return}</span>
                </div>
                <h3 className="mt-4 font-serif text-xl">{master.name}</h3>
                <p className="mt-1 text-[10px] tracking-[0.12em] text-[var(--muted)]">{master.en.toUpperCase()}</p>
                <p className="mt-4 border-t border-[var(--line)] pt-4 text-xs leading-5 text-[var(--muted)]">“{master.quote}”</p>
              </button>
            );
          })}
        </div>

        <div className="sticky bottom-5 z-30 mx-auto mt-8 flex max-w-3xl flex-col items-center justify-between gap-4 rounded-2xl border border-[var(--line)] bg-[var(--panel)]/95 p-3 shadow-[0_18px_55px_rgba(20,48,38,.14)] backdrop-blur sm:flex-row">
          <div className="flex min-w-0 items-center gap-3 pl-2">
            <span className="hidden text-xs text-[var(--muted)] sm:inline">{t.selected} {selected.length}</span>
            <div className="flex -space-x-2">
              {selectedMasters.slice(0, 5).map((master) => <Avatar key={master.id} master={master} size="sm" />)}
            </div>
            {selected.length > 5 && <span className="text-xs">+{selected.length - 5}</span>}
          </div>
          <div className="flex w-full items-center gap-3 sm:w-auto">
            {selected.length > 1 && selected.length < 3 && <span className="hidden text-xs text-[var(--gold)] lg:inline">{t.need}</span>}
            <button disabled={!selected.length || selected.length === 2} onClick={onStart} className="primary-btn h-12 flex-1 px-6 sm:flex-none">
              {selected.length >= 3 ? t.council : t.start} <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </section>

      <section className="border-t border-[var(--line)] bg-[var(--panel-soft)]">
        <div className="mx-auto grid max-w-[1200px] gap-12 px-5 py-16 lg:grid-cols-2 lg:px-10">
          <div>
            <div className="section-label"><Sparkles size={14} /> {t.topics}</div>
            <div className="mt-5 space-y-3">
              {["ETH 突破关键阻力位，现在适合增加仓位吗？", "稳定币收益率回升，如何配置 Aave 存款？", "宏观流动性变化将如何影响加密市场？"].map((topic, index) => (
                <button key={topic} className="topic-row">
                  <span className="font-serif text-lg text-[var(--muted)]">0{index + 1}</span>
                  <span className="flex-1 text-left text-sm">{topic}</span>
                  <ArrowRight size={15} />
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="section-label"><BarChart3 size={14} /> {t.ranking}</div>
            <div className="mt-5 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
              {masters.slice(0, 3).map((master, index) => (
                <div key={master.id} className="flex items-center gap-4 border-b border-[var(--line)] p-4 last:border-0">
                  <span className="w-5 font-serif text-lg text-[var(--muted)]">{index + 1}</span>
                  <Avatar master={master} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{master.name}</div>
                    <div className="mt-0.5 text-[10px] text-[var(--muted)]">{master.risk} · 30 日</div>
                  </div>
                  <span className="font-mono text-sm font-semibold text-[var(--positive)]">{master.return}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
      <footer className="border-t border-[var(--line)] px-5 py-8 text-center text-[10px] tracking-wide text-[var(--muted)]">
        AI 模拟角色，与相关人物本人、继承方无关联、授权或背书。投资有风险，决策需谨慎。
      </footer>
    </>
  );
}

function ChatView({ selectedMasters, onBack }: { selectedMasters: Master[]; onBack: () => void }) {
  const activeMasters = selectedMasters.length ? selectedMasters : masters.slice(0, 3);
  const [paused, setPaused] = useState(false);
  const [showPlan, setShowPlan] = useState(true);
  const [input, setInput] = useState("");

  return (
    <div className="mx-auto flex min-h-[calc(100vh-80px)] max-w-[1200px]">
      <aside className="hidden w-64 border-r border-[var(--line)] p-5 lg:block">
        <button onClick={onBack} className="secondary-btn w-full"><Plus size={15} /> 新建对话</button>
        <div className="mt-8 text-[10px] font-semibold tracking-[0.18em] text-[var(--muted)]">最近对话</div>
        <button className="mt-3 w-full rounded-lg bg-[var(--wash)] p-3 text-left text-xs">ETH 长期配置委员会</button>
        <button className="mt-2 w-full p-3 text-left text-xs text-[var(--muted)]">稳定币收益策略</button>
      </aside>
      <section className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-4 md:px-8">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">{activeMasters.map((m) => <Avatar key={m.id} master={m} size="sm" />)}</div>
              <span className="font-serif text-lg">投资委员会</span>
              <span className="status-dot">讨论中</span>
            </div>
            <div className="mt-1 text-[10px] text-[var(--muted)]">第 2 阶段 · 交叉质询 · 3 位成员</div>
          </div>
          <button onClick={() => setPaused(!paused)} className="secondary-btn">
            {paused ? <Play size={15} /> : <Pause size={15} />} {paused ? "继续" : "暂停"}
          </button>
        </div>

        <div className="mx-auto w-full max-w-3xl flex-1 space-y-7 px-4 py-8 md:px-8">
          <div className="user-message">请评估用 5 ETH 构建一个兼顾长期增长和 DeFi 收益的组合。</div>
          {activeMasters.map((master, index) => (
            <div key={master.id} className={`flex gap-3 ${paused && index === activeMasters.length - 1 ? "opacity-50" : ""}`}>
              <Avatar master={master} size="md" />
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-sm font-semibold">{master.name}</span>
                  <span className="text-[10px] text-[var(--muted)]">{master.school}</span>
                </div>
                <p className="text-sm leading-7 text-[var(--ink-soft)]">
                  {index === 0 && "我更关注本金安全与可持续现金流。建议把核心仓位留在 ETH，并将一小部分部署到经过验证的借贷协议，避免追逐短期高 APY。"}
                  {index === 1 && "我赞同核心仓位，但必须反过来问：如果 ETH 下跌 35%，这套组合是否仍能让你安稳持有？任何借贷都应保留足够健康因子。"}
                  {index === 2 && "增长部分可以更主动。链上活跃度正在改善，我会给现货更高权重，同时用少量资金参与稳定币收益，保持随时调整的流动性。"}
                </p>
              </div>
            </div>
          ))}

          {showPlan && (
            <div className="plan-card">
              <div className="flex items-start justify-between">
                <div>
                  <div className="section-label"><Sparkles size={14} /> 委员会综合方案</div>
                  <h3 className="mt-2 font-serif text-2xl">稳健增长组合</h3>
                </div>
                <span className="rounded-full bg-[var(--wash)] px-3 py-1 text-xs text-[var(--green)]">置信度 84%</span>
              </div>
              <div className="mt-6 grid grid-cols-3 gap-2">
                {[["ETH 现货", "60%", "3 ETH"], ["Aave 存款", "30%", "1.5 ETH"], ["机动资金", "10%", "0.5 ETH"]].map((item) => (
                  <div key={item[0]} className="rounded-lg bg-[var(--panel-soft)] p-3">
                    <div className="text-[10px] text-[var(--muted)]">{item[0]}</div>
                    <div className="mt-1 font-serif text-xl">{item[1]}</div>
                    <div className="text-[10px] text-[var(--muted)]">{item[2]}</div>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex items-center gap-2 text-xs text-[var(--muted)]">
                <ShieldCheck size={15} className="text-[var(--positive)]" /> 预计年化 8.2% · 最大模拟回撤 18.6% · 风险等级：均衡
              </div>
              <div className="mt-6 flex flex-col gap-2 sm:flex-row">
                <button className="primary-btn flex-1" onClick={() => setShowPlan(false)}><CircleDollarSign size={16} /> 预览并执行</button>
                <button className="secondary-btn flex-1">编辑参数</button>
              </div>
            </div>
          )}

          {!showPlan && <TradePreview onBack={() => setShowPlan(true)} />}
          {paused && <div className="rounded-lg border border-[var(--gold)]/40 bg-[var(--gold)]/5 p-4 text-center text-xs">委员会已暂停。你可以修改议题，或从当前上下文继续。</div>}
        </div>

        <div className="sticky bottom-0 border-t border-[var(--line)] bg-[var(--bg)]/95 p-4 backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-2 shadow-sm">
            <button className="icon-btn"><Mic size={18} /></button>
            <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={1} placeholder="询问大师，或输入新的讨论方向..." className="min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none" />
            <button className="primary-btn h-10 w-10 px-0"><Send size={16} /></button>
          </div>
          <div className="mt-2 text-center text-[9px] text-[var(--muted)]">AI 可能出错。真实交易前请核对所有参数。</div>
        </div>
      </section>
    </div>
  );
}

function TradePreview({ onBack }: { onBack: () => void }) {
  return (
    <div className="plan-card">
      <div className="flex items-center justify-between">
        <div><div className="section-label">交易预览</div><h3 className="mt-2 font-serif text-2xl">ETH → USDT</h3></div>
        <button onClick={onBack} className="icon-btn"><X size={16} /></button>
      </div>
      <div className="mt-6 space-y-3 text-sm">
        {[["支付", "0.05 ETH"], ["预计收到", "174.82 USDT"], ["协议", "Uniswap V3"], ["网络", "Ethereum Mainnet"], ["预计 Gas", "$3.42"], ["最大滑点", "0.50%"]].map(([label, value]) => (
          <div key={label} className="flex justify-between border-b border-[var(--line)] pb-3"><span className="text-[var(--muted)]">{label}</span><span>{value}</span></div>
        ))}
      </div>
      <label className="mt-5 flex items-start gap-3 rounded-lg bg-[var(--panel-soft)] p-3 text-xs leading-5">
        <input type="checkbox" className="mt-1 accent-[var(--green)]" /> 我已阅读风险摘要，并理解链上交易不可撤销。
      </label>
      <button className="primary-btn mt-5 w-full"><Wallet size={16} /> 确认并唤起钱包签名</button>
    </div>
  );
}

function ProfileView() {
  const [hidden, setHidden] = useState(true);
  const allocation = useMemo(() => [
    ["Ethereum", "62%", "bg-[#265c46]"],
    ["BNB Chain", "21%", "bg-[#b08b45]"],
    ["Solana", "17%", "bg-[#8771a8]"],
  ], []);
  return (
    <div className="mx-auto max-w-[1100px] px-5 py-12 lg:px-10">
      <div className="flex items-end justify-between">
        <div><div className="section-label">个人中心</div><h1 className="mt-3 font-serif text-4xl">资产与策略总览</h1></div>
        <button onClick={() => setHidden(!hidden)} className="secondary-btn">{hidden ? "显示资产" : "隐藏资产"}</button>
      </div>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {[["跨链总资产", "$128,460.82", "+4.8%"], ["累计收益", "$18,204.50", "+16.5%"], ["运行中策略", "3", "1 个自动执行"]].map((item) => (
          <div key={item[0]} className="stat-card">
            <div className="text-xs text-[var(--muted)]">{item[0]}</div>
            <div className={`mt-3 font-serif text-3xl ${hidden ? "blur-md select-none" : ""}`}>{item[1]}</div>
            <div className="mt-2 text-xs text-[var(--positive)]">{item[2]}</div>
          </div>
        ))}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_.6fr]">
        <div className="stat-card">
          <div className="flex items-center justify-between"><h2 className="font-serif text-xl">资产趋势</h2><span className="text-xs text-[var(--muted)]">近 30 日</span></div>
          <div className="chart mt-8 h-56"><div className="chart-line" /></div>
        </div>
        <div className="stat-card">
          <h2 className="font-serif text-xl">链上分布</h2>
          <div className="mt-7 space-y-5">
            {allocation.map(([name, value, color]) => (
              <div key={name}>
                <div className="mb-2 flex justify-between text-xs"><span>{name}</span><span>{value}</span></div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[var(--wash)]"><div className={`h-full ${color}`} style={{ width: value }} /></div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-4 stat-card">
        <div className="flex items-center justify-between"><h2 className="font-serif text-xl">近期活动</h2><button className="text-xs text-[var(--green)]">查看全部</button></div>
        <div className="mt-5 divide-y divide-[var(--line)]">
          {[
            [<History key="h" size={16} />, "稳健增长组合完成再平衡", "2 小时前", "+$248.20"],
            [<ShieldCheck key="s" size={16} />, "Aave 健康因子恢复至 2.41", "昨天", "安全"],
            [<CircleDollarSign key="c" size={16} />, "ETH → USDT 交换成功", "3 天前", "0.05 ETH"],
          ].map((item, i) => <div key={i} className="flex items-center gap-4 py-4 text-sm"><span className="text-[var(--green)]">{item[0]}</span><span className="flex-1">{item[1]}</span><span className="text-xs text-[var(--muted)]">{item[2]}</span><span className="w-20 text-right text-xs">{item[3]}</span></div>)}
        </div>
      </div>
    </div>
  );
}

function WalletModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-[var(--panel)] p-6 shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between"><div><div className="section-label">Privy 登录</div><h2 className="mt-2 font-serif text-2xl">连接到追光者</h2></div><button onClick={onClose} className="icon-btn"><X size={17} /></button></div>
        <p className="mt-3 text-xs leading-5 text-[var(--muted)]">连接钱包后可查看跨链资产、保存加密对话并执行真实交易。</p>
        <div className="mt-6 space-y-2">
          {["MetaMask", "WalletConnect", "Phantom", "使用邮箱或社交账号"].map((wallet) => <button key={wallet} className="topic-row"><Wallet size={17} /><span className="flex-1 text-left">{wallet}</span><ArrowRight size={15} /></button>)}
        </div>
        <div className="mt-5 flex items-start gap-2 text-[10px] leading-4 text-[var(--muted)]"><ShieldCheck size={14} className="mt-0.5 shrink-0" />我们不会托管你的私钥。演示版本使用模拟合规检查结果。</div>
      </div>
    </div>
  );
}
