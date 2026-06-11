"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Bell,
  Check,
  CircleDollarSign,
  Globe2,
  History,
  LoaderCircle,
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

type Message = {
  id: string;
  role: "user" | "master" | "system";
  content: string;
  masterId?: string;
};

type SavedConversation = {
  id: string;
  title: string;
  masterIds: string[];
  messages: Message[];
  updatedAt: number;
};

type ConnectedWallet = {
  label: string;
  address: string;
  kind: "evm" | "solana";
};

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
    };
    solana?: {
      isPhantom?: boolean;
      connect: () => Promise<{ publicKey: { toString: () => string } }>;
    };
  }
}

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
  const [wallet, setWallet] = useState<ConnectedWallet | null>(null);
  const [question, setQuestion] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const saved = window.localStorage.getItem("oracle-capital-wallet");
    const timer = window.setTimeout(() => {
      if (saved) {
        try {
          setWallet(JSON.parse(saved) as ConnectedWallet);
        } catch {
          window.localStorage.removeItem("oracle-capital-wallet");
        }
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

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
            <Link href="/market" className="hover:text-[var(--ink)]">{t.navMarket}</Link>
            <button onClick={() => setView("home")} className="text-[var(--ink)]">{t.navMasters}</button>
            <Link href="/rankings" className="hover:text-[var(--ink)]">{t.navRank}</Link>
          </nav>
          <div className="flex items-center gap-2">
            <button className="icon-btn" onClick={() => setLang(lang === "zh" ? "en" : "zh")} aria-label="Change language">
              <Globe2 size={17} />
            </button>
            <button className="icon-btn" onClick={() => setTheme(theme === "light" ? "dark" : "light")} aria-label="Toggle theme">
              {theme === "light" ? <Moon size={17} /> : <Sun size={17} />}
            </button>
            <button onClick={() => setToast("暂无新通知，AI 方案仍需你确认后执行")} className="icon-btn hidden sm:grid" aria-label="Notifications"><Bell size={17} /></button>
            <button onClick={() => setWalletOpen(true)} className="primary-btn ml-1">
              <Wallet size={16} /> <span className="hidden sm:inline">{wallet ? `${wallet.label} ${shortAddress(wallet.address)}` : t.connect}</span>
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
          onTopic={(topic) => { setQuestion(topic); setView("chat"); }}
        />
      )}
      {view === "chat" && <ChatView selectedMasters={selectedMasters} initialQuestion={question} onBack={() => setView("home")} wallet={wallet} onNeedWallet={() => setWalletOpen(true)} notify={setToast} />}
      {view === "profile" && <ProfileView />}
      {walletOpen && <WalletModal connected={wallet} onClose={() => setWalletOpen(false)} onConnect={(value) => { setWallet(value); window.localStorage.setItem("oracle-capital-wallet", JSON.stringify(value)); setWalletOpen(false); setToast(`${value.label} 已连接`); }} onDisconnect={() => { setWallet(null); window.localStorage.removeItem("oracle-capital-wallet"); setWalletOpen(false); setToast("钱包已断开"); }} notify={setToast} />}
      {toast && <div className="fixed bottom-5 left-1/2 z-[70] -translate-x-1/2 rounded-full bg-[var(--ink)] px-5 py-3 text-xs text-[var(--bg)] shadow-xl">{toast}</div>}
    </main>
  );
}

function HomeView({
  t,
  selected,
  selectedMasters,
  toggleMaster,
  onStart,
  onTopic,
}: {
  t: typeof translations.zh;
  selected: string[];
  selectedMasters: Master[];
  toggleMaster: (id: string) => void;
  onStart: () => void;
  onTopic: (topic: string) => void;
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

      <section id="topics" className="scroll-mt-24 border-t border-[var(--line)] bg-[var(--panel-soft)]">
        <div className="mx-auto grid max-w-[1200px] gap-12 px-5 py-16 lg:grid-cols-2 lg:px-10">
          <div>
            <div className="section-label"><Sparkles size={14} /> {t.topics}</div>
            <div className="mt-5 space-y-3">
              {["ETH 突破关键阻力位，现在适合增加仓位吗？", "稳定币收益率回升，如何配置 Aave 存款？", "宏观流动性变化将如何影响加密市场？"].map((topic, index) => (
                <button key={topic} onClick={() => onTopic(topic)} className="topic-row">
                  <span className="font-serif text-lg text-[var(--muted)]">0{index + 1}</span>
                  <span className="flex-1 text-left text-sm">{topic}</span>
                  <ArrowRight size={15} />
                </button>
              ))}
            </div>
          </div>
          <div id="rankings" className="scroll-mt-24">
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

function shortAddress(address: string) {
  return address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address;
}

function ChatView({
  selectedMasters,
  initialQuestion,
  onBack,
  wallet,
  onNeedWallet,
  notify,
}: {
  selectedMasters: Master[];
  initialQuestion: string;
  onBack: () => void;
  wallet: ConnectedWallet | null;
  onNeedWallet: () => void;
  notify: (message: string) => void;
}) {
  const activeMasters = selectedMasters.length ? selectedMasters : masters.slice(0, 3);
  const [paused, setPaused] = useState(false);
  const [showPlan, setShowPlan] = useState(false);
  const [preview, setPreview] = useState(false);
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState(initialQuestion);
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [allocation, setAllocation] = useState({ spot: 60, defi: 30, reserve: 10 });
  const [messages, setMessages] = useState<Message[]>([
    { id: "welcome", role: "system", content: "投资委员会已就席。发送问题后，所选大师会从不同框架给出意见，再形成综合方案。" },
  ]);
  const [conversationId, setConversationId] = useState("");
  const [savedConversations, setSavedConversations] = useState<SavedConversation[]>([]);
  const [storageReady, setStorageReady] = useState(false);
  const activeMasterIds = activeMasters.map((master) => master.id).join(",");

  useEffect(() => {
    const raw = window.localStorage.getItem("oracle-capital-conversations");
    const timer = window.setTimeout(() => {
      if (raw) {
        try {
          setSavedConversations(JSON.parse(raw) as SavedConversation[]);
        } catch {
          window.localStorage.removeItem("oracle-capital-conversations");
        }
      }
      setConversationId(crypto.randomUUID());
      setStorageReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!storageReady || !conversationId || messages.length <= 1) return;
    const firstQuestion = messages.find((message) => message.role === "user")?.content;
    if (!firstQuestion) return;
    const timer = window.setTimeout(() => {
      setSavedConversations((current) => {
        const nextConversation: SavedConversation = {
          id: conversationId,
          title: firstQuestion.slice(0, 22),
          masterIds: activeMasterIds.split(","),
          messages,
          updatedAt: Date.now(),
        };
        const next = [nextConversation, ...current.filter((item) => item.id !== conversationId)]
          .sort((a, b) => b.updatedAt - a.updatedAt)
          .slice(0, 20);
        window.localStorage.setItem("oracle-capital-conversations", JSON.stringify(next));
        return next;
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [activeMasterIds, conversationId, messages, storageReady]);

  const newConversation = () => {
    setConversationId(crypto.randomUUID());
    setMessages([{ id: crypto.randomUUID(), role: "system", content: "新对话已建立，请输入你的投资问题。" }]);
    setShowPlan(false);
    setPreview(false);
    setInput("");
  };

  const loadConversation = (conversation: SavedConversation) => {
    setConversationId(conversation.id);
    setMessages(conversation.messages);
    setShowPlan(conversation.messages.some((message) => message.role === "master"));
    setPreview(false);
    notify(`已恢复：${conversation.title}`);
  };

  const sendMessage = async (event?: FormEvent) => {
    event?.preventDefault();
    const prompt = input.trim();
    if (!prompt || loading || paused) return;
    const history = messages.filter((message) => message.role !== "system").slice(-8);
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: "user", content: prompt }]);
    setInput("");
    setLoading(true);
    setShowPlan(false);
    setPreview(false);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: prompt,
          masters: activeMasters.map(({ id, name, school, quote, risk }) => ({ id, name, school, quote, risk })),
          history,
        }),
      });
      if (!response.ok) throw new Error("DeepSeek unavailable");
      const data = await response.json() as {
        replies: { masterId: string; content: string }[];
        synthesis: string;
      };
      setMessages((current) => [
        ...current,
        ...data.replies.map((reply) => ({ id: crypto.randomUUID(), role: "master" as const, masterId: reply.masterId, content: reply.content })),
        { id: crypto.randomUUID(), role: "system", content: data.synthesis },
      ]);
      setShowPlan(true);
    } catch {
      const fallback = activeMasters.map((master, index) => ({
        id: crypto.randomUUID(),
        role: "master" as const,
        masterId: master.id,
        content: index === 0
          ? `从${master.school}角度，我会先确认本金安全、协议现金流和最大回撤。对于“${prompt}”，建议先小仓位验证，不追逐未经验证的高收益。`
          : `${master.quote} 我的判断框架与前一位不同：当前信息不足以支持重仓，应先补充持有周期、可承受回撤和链上协议风险。`,
      }));
      setMessages((current) => [
        ...current,
        ...fallback,
        { id: crypto.randomUUID(), role: "system", content: "综合结论：分批建仓、限制单协议敞口、保留机动资金，并在交易前核对链、币种、滑点与授权额度。当前为静态演示回复。" },
      ]);
      setShowPlan(true);
      notify("DeepSeek 暂未响应，已切换演示回复");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[calc(100vh-80px)] max-w-[1200px]">
      <aside className="hidden w-64 border-r border-[var(--line)] p-5 lg:block">
        <button onClick={newConversation} className="secondary-btn w-full"><Plus size={15} /> 新建对话</button>
        <div className="mt-8 text-[10px] font-semibold tracking-[0.18em] text-[var(--muted)]">最近对话</div>
        {savedConversations.length ? savedConversations.slice(0, 8).map((conversation) => (
          <button key={conversation.id} onClick={() => loadConversation(conversation)} className={`mt-2 w-full rounded-lg p-3 text-left text-xs ${conversation.id === conversationId ? "bg-[var(--wash)]" : "text-[var(--muted)] hover:bg-[var(--panel-soft)]"}`}>
            <span className="block truncate">{conversation.title}</span>
            <span className="mt-1 block text-[9px] opacity-60">{new Date(conversation.updatedAt).toLocaleString("zh-CN")}</span>
          </button>
        )) : <p className="mt-3 text-xs leading-5 text-[var(--muted)]">发送第一条消息后，对话会自动保存在此浏览器。</p>}
      </aside>
      <section className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-4 md:px-8">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="icon-btn lg:hidden" aria-label="返回大师选择"><ArrowLeft size={16} /></button>
            <div>
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">{activeMasters.map((m) => <Avatar key={m.id} master={m} size="sm" />)}</div>
              <span className="font-serif text-lg">投资委员会</span>
              <span className="status-dot">{loading ? "思考中" : "DeepSeek 在线"}</span>
            </div>
            <div className="mt-1 text-[10px] text-[var(--muted)]">AI 思想框架模拟 · {activeMasters.length} 位成员 · 用户确认后才可执行</div>
            </div>
          </div>
          <button onClick={() => setPaused(!paused)} className="secondary-btn">
            {paused ? <Play size={15} /> : <Pause size={15} />} {paused ? "继续" : "暂停"}
          </button>
        </div>

        <div className="mx-auto w-full max-w-3xl flex-1 space-y-7 px-4 py-8 md:px-8">
          {messages.map((message) => {
            if (message.role === "user") return <div key={message.id} className="user-message">{message.content}</div>;
            if (message.role === "system") return <div key={message.id} className="rounded-xl border border-[var(--line)] bg-[var(--panel-soft)] p-4 text-sm leading-7"><div className="mb-2 section-label"><Sparkles size={13} /> 委员会综合</div>{message.content}</div>;
            const master = masters.find((item) => item.id === message.masterId) ?? activeMasters[0];
            return (
              <div key={message.id} className="flex gap-3">
                <Avatar master={master} size="md" />
                <div><div className="mb-2 flex items-center gap-2"><span className="text-sm font-semibold">{master.name}</span><span className="text-[10px] text-[var(--muted)]">{master.school}</span></div><p className="whitespace-pre-wrap text-sm leading-7 text-[var(--ink-soft)]">{message.content}</p></div>
              </div>
            );
          })}
          {loading && <div className="flex items-center gap-3 text-sm text-[var(--muted)]"><LoaderCircle className="animate-spin" size={18} />DeepSeek 正在组织不同大师的观点...</div>}

          {showPlan && !preview && (
            <div className="plan-card">
              <div className="flex items-start justify-between">
                <div>
                  <div className="section-label"><Sparkles size={14} /> 委员会综合方案</div>
                  <h3 className="mt-2 font-serif text-2xl">稳健增长组合</h3>
                </div>
                <span className="rounded-full bg-[var(--wash)] px-3 py-1 text-xs text-[var(--green)]">置信度 84%</span>
              </div>
              {editing ? <div className="mt-6 space-y-4">
                {([["spot", "ETH 现货"], ["defi", "Aave 存款"], ["reserve", "机动资金"]] as const).map(([key, label]) => <label key={key} className="block text-xs"><span className="mb-2 flex justify-between"><span>{label}</span><strong>{allocation[key]}%</strong></span><input className="w-full accent-[var(--green)]" type="range" min="0" max="100" value={allocation[key]} onChange={(event) => setAllocation((current) => ({ ...current, [key]: Number(event.target.value) }))} /></label>)}
                <div className={`text-xs ${allocation.spot + allocation.defi + allocation.reserve === 100 ? "text-[var(--positive)]" : "text-red-500"}`}>当前合计 {allocation.spot + allocation.defi + allocation.reserve}%（必须为 100%）</div>
              </div> : <div className="mt-6 grid grid-cols-3 gap-2">
                {[["ETH 现货", `${allocation.spot}%`, `${allocation.spot * 0.05} ETH`], ["Aave 存款", `${allocation.defi}%`, `${allocation.defi * 0.05} ETH`], ["机动资金", `${allocation.reserve}%`, `${allocation.reserve * 0.05} ETH`]].map((item) => (
                  <div key={item[0]} className="rounded-lg bg-[var(--panel-soft)] p-3">
                    <div className="text-[10px] text-[var(--muted)]">{item[0]}</div>
                    <div className="mt-1 font-serif text-xl">{item[1]}</div>
                    <div className="text-[10px] text-[var(--muted)]">{item[2]}</div>
                  </div>
                ))}
              </div>}
              <div className="mt-5 flex items-center gap-2 text-xs text-[var(--muted)]">
                <ShieldCheck size={15} className="text-[var(--positive)]" /> 预计年化 8.2% · 最大模拟回撤 18.6% · 风险等级：均衡
              </div>
              <div className="mt-6 flex flex-col gap-2 sm:flex-row">
                <button disabled={allocation.spot + allocation.defi + allocation.reserve !== 100} className="primary-btn flex-1" onClick={() => editing ? setEditing(false) : setPreview(true)}><CircleDollarSign size={16} /> {editing ? "保存参数" : "预览模拟交易"}</button>
                <button onClick={() => setEditing(!editing)} className="secondary-btn flex-1">{editing ? "取消编辑" : "编辑参数"}</button>
              </div>
            </div>
          )}

          {preview && <TradePreview wallet={wallet} onNeedWallet={onNeedWallet} notify={notify} onBack={() => setPreview(false)} />}
          {paused && <div className="rounded-lg border border-[var(--gold)]/40 bg-[var(--gold)]/5 p-4 text-center text-xs">委员会已暂停。你可以修改议题，或从当前上下文继续。</div>}
        </div>

        <form onSubmit={sendMessage} className="sticky bottom-0 border-t border-[var(--line)] bg-[var(--bg)]/95 p-4 backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-2 shadow-sm">
            <button type="button" onClick={() => { setListening(!listening); if (!listening) setInput("请分析当前 ETH 的现货、DeFi 和合约配置机会"); }} className={`icon-btn ${listening ? "text-[var(--gold)]" : ""}`}><Mic size={18} /></button>
            <textarea disabled={paused} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }} rows={1} placeholder={paused ? "委员会已暂停" : "询问大师，或输入新的讨论方向..."} className="min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none" />
            <button type="submit" disabled={!input.trim() || loading || paused} className="primary-btn h-10 w-10 px-0"><Send size={16} /></button>
          </div>
          <div className="mt-2 text-center text-[9px] text-[var(--muted)]">AI 可能出错。真实交易前请核对所有参数。</div>
        </form>
      </section>
    </div>
  );
}

function TradePreview({ onBack, wallet, onNeedWallet, notify }: { onBack: () => void; wallet: ConnectedWallet | null; onNeedWallet: () => void; notify: (message: string) => void }) {
  const [accepted, setAccepted] = useState(false);
  const [status, setStatus] = useState<"ready" | "signing" | "done">("ready");
  const execute = () => {
    if (!wallet) {
      onNeedWallet();
      return;
    }
    setStatus("signing");
    window.setTimeout(() => {
      setStatus("done");
      notify("模拟交易完成，没有广播到链上");
    }, 1200);
  };
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
        <input checked={accepted} onChange={(event) => setAccepted(event.target.checked)} type="checkbox" className="mt-1 accent-[var(--green)]" /> 我已阅读风险摘要，并理解这是黑客松模拟交易，不会广播到链上。
      </label>
      <button disabled={!accepted || status !== "ready"} onClick={execute} className="primary-btn mt-5 w-full">
        {status === "signing" ? <LoaderCircle className="animate-spin" size={16} /> : <Wallet size={16} />}
        {status === "signing" ? "等待模拟签名..." : status === "done" ? "模拟交易完成" : wallet ? `使用 ${wallet.label} 模拟签名` : "连接钱包后模拟签名"}
      </button>
    </div>
  );
}

function ProfileView() {
  const [hidden, setHidden] = useState(true);
  const [showAll, setShowAll] = useState(false);
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
        <div className="flex items-center justify-between"><h2 className="font-serif text-xl">近期活动</h2><button onClick={() => setShowAll(!showAll)} className="text-xs text-[var(--green)]">{showAll ? "收起" : "查看全部"}</button></div>
        <div className="mt-5 divide-y divide-[var(--line)]">
          {[
            [<History key="h" size={16} />, "稳健增长组合完成再平衡", "2 小时前", "+$248.20"],
            [<ShieldCheck key="s" size={16} />, "Aave 健康因子恢复至 2.41", "昨天", "安全"],
            [<CircleDollarSign key="c" size={16} />, "ETH → USDT 交换成功", "3 天前", "0.05 ETH"],
            ...(showAll ? [[<Sparkles key="x" size={16} />, "保存新的 AI 委员会", "5 天前", "已保存"]] : []),
          ].map((item, i) => <button key={i} className="flex w-full items-center gap-4 py-4 text-left text-sm"><span className="text-[var(--green)]">{item[0]}</span><span className="flex-1">{item[1]}</span><span className="text-xs text-[var(--muted)]">{item[2]}</span><span className="w-20 text-right text-xs">{item[3]}</span></button>)}
        </div>
      </div>
    </div>
  );
}

function WalletModal({
  connected,
  onClose,
  onConnect,
  onDisconnect,
  notify,
}: {
  connected: ConnectedWallet | null;
  onClose: () => void;
  onConnect: (wallet: ConnectedWallet) => void;
  onDisconnect: () => void;
  notify: (message: string) => void;
}) {
  const [connecting, setConnecting] = useState("");
  const connectEvm = async () => {
    if (!window.ethereum) {
      notify("未检测到 EVM 钱包，请安装 MetaMask 或兼容钱包");
      return;
    }
    setConnecting("MetaMask");
    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" }) as string[];
      if (!accounts[0]) throw new Error("No account returned");
      onConnect({ label: "EVM", address: accounts[0], kind: "evm" });
    } catch {
      notify("钱包连接被取消或失败");
      setConnecting("");
    }
  };
  const connectPhantom = async () => {
    if (!window.solana?.isPhantom) {
      notify("未检测到 Phantom 钱包，请先安装浏览器扩展");
      return;
    }
    setConnecting("Phantom");
    try {
      const response = await window.solana.connect();
      onConnect({ label: "Phantom", address: response.publicKey.toString(), kind: "solana" });
    } catch {
      notify("Phantom 连接被取消或失败");
      setConnecting("");
    }
  };
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-[var(--panel)] p-6 shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between"><div><div className="section-label">钱包登录</div><h2 className="mt-2 font-serif text-2xl">{connected ? "钱包已连接" : "连接到追光者"}</h2></div><button onClick={onClose} className="icon-btn"><X size={17} /></button></div>
        <p className="mt-3 text-xs leading-5 text-[var(--muted)]">连接仅用于读取公开地址。本站不会接触私钥，任何真实交易仍需在钱包中单独确认。</p>
        {connected ? (
          <div className="mt-6">
            <div className="rounded-xl bg-[var(--panel-soft)] p-4"><div className="text-xs text-[var(--muted)]">{connected.label}</div><div className="mt-2 font-mono text-sm">{shortAddress(connected.address)}</div></div>
            <button onClick={onDisconnect} className="secondary-btn mt-4 w-full">断开钱包</button>
          </div>
        ) : <div className="mt-6 space-y-2">
          <button disabled={Boolean(connecting)} onClick={connectEvm} className="topic-row"><Wallet size={17} /><span className="flex-1 text-left">MetaMask / EVM 钱包</span>{connecting === "MetaMask" ? <LoaderCircle className="animate-spin" size={15} /> : <ArrowRight size={15} />}</button>
          <button disabled={Boolean(connecting)} onClick={connectPhantom} className="topic-row"><Wallet size={17} /><span className="flex-1 text-left">Phantom / Solana</span>{connecting === "Phantom" ? <LoaderCircle className="animate-spin" size={15} /> : <ArrowRight size={15} />}</button>
          <button onClick={() => notify("WalletConnect 需要项目 ID，下一阶段接入")} className="topic-row"><Wallet size={17} /><span className="flex-1 text-left">WalletConnect</span><ArrowRight size={15} /></button>
        </div>}
        <div className="mt-5 flex items-start gap-2 text-[10px] leading-4 text-[var(--muted)]"><ShieldCheck size={14} className="mt-0.5 shrink-0" />连接请求由钱包扩展处理，追光者只保存公开地址。</div>
      </div>
    </div>
  );
}
