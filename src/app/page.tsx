"use client";

import { FormEvent, PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createAgentDiscussion, getAgentMasters, streamAgentDiscussion } from "@/lib/agent-api";
import { masterAvatarPaths } from "@/lib/master-assets";
import {
  ArrowLeft,
  ArrowRight,
  ArrowDownToLine,
  ArrowUpFromLine,
  BarChart3,
  Bell,
  BookOpen,
  Check,
  ChevronDown,
  CircleDollarSign,
  Code2,
  Eye,
  EyeOff,
  Globe2,
  History,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  Mic,
  Moon,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Sun,
  Trash2,
  UserRound,
  Wallet,
  X,
} from "lucide-react";

type Message = {
  id: string;
  role: "user" | "master" | "system";
  content: string;
  masterId?: string;
  vote?: "approve" | "abstain" | "reject";
  confidence?: number;
};

type CommitteeDecision = {
  title: string;
  thesis: string;
  allocations: { label: string; percentage: number; rationale: string }[];
  riskLevel: "稳健" | "均衡" | "进取" | "高风险";
  expectedReturn: string;
  maxDrawdown: string;
  dissent: string;
  steps: string[];
  consensusRate: number;
  voteCounts: { approve: number; abstain: number; reject: number };
  executedAt?: number;
  executedAmount?: number;
};

type SavedConversation = {
  id: string;
  title: string;
  masterIds: string[];
  messages: Message[];
  decision?: CommitteeDecision;
  updatedAt: number;
};

type ConnectedWallet = {
  label: string;
  address: string;
  kind: "evm" | "solana" | "cobo";
  configPath?: string;
  endpoint?: string;
};

type CoboRuntimeConfig = {
  name?: string;
  baseUrl: string;
  apiKey?: string;
  walletId?: string;
  timeoutMs?: number;
  headers?: Record<string, string>;
  endpoints?: {
    connect?: { path: string; method?: "GET" | "POST" };
    balance?: { path: string; method?: "GET" | "POST" };
    authorize?: { path: string; method?: "GET" | "POST" };
    execute?: { path: string; method?: "GET" | "POST" };
  };
};

type CustomApiConfig = {
  endpoint: string;
  apiKey: string;
  model: string;
};

const apiConfigStorageKey = "oracle-capital-api-config";
const apiKeyDatabase = "oracle-capital-secure";
const apiKeyStore = "keys";
const apiKeyId = "developer-api-aes-key";

const bytesToBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const base64ToBytes = (value: string) => Uint8Array.from(atob(value), (character) => character.charCodeAt(0));

function openApiKeyDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(apiKeyDatabase, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(apiKeyStore);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getApiEncryptionKey() {
  const database = await openApiKeyDatabase();
  const existing = await new Promise<CryptoKey | undefined>((resolve, reject) => {
    const request = database.transaction(apiKeyStore, "readonly").objectStore(apiKeyStore).get(apiKeyId);
    request.onsuccess = () => resolve(request.result as CryptoKey | undefined);
    request.onerror = () => reject(request.error);
  });
  if (existing) {
    database.close();
    return existing;
  }
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(apiKeyStore, "readwrite");
    transaction.objectStore(apiKeyStore).put(key, apiKeyId);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
  return key;
}

async function saveEncryptedApiConfig(config: CustomApiConfig) {
  const key = await getApiEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(JSON.stringify(config)));
  window.localStorage.setItem(apiConfigStorageKey, JSON.stringify({
    version: 1,
    iv: bytesToBase64(iv),
    data: bytesToBase64(new Uint8Array(encrypted)),
  }));
}

async function loadEncryptedApiConfig(): Promise<CustomApiConfig | null> {
  const raw = window.localStorage.getItem(apiConfigStorageKey);
  if (!raw) return null;
  try {
    const record = JSON.parse(raw) as { iv: string; data: string };
    const key = await getApiEncryptionKey();
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64ToBytes(record.iv) },
      key,
      base64ToBytes(record.data),
    );
    return JSON.parse(new TextDecoder().decode(decrypted)) as CustomApiConfig;
  } catch {
    window.localStorage.removeItem(apiConfigStorageKey);
    return null;
  }
}

type SimulationTransaction = {
  id: string;
  type: "deposit" | "withdraw" | "strategy";
  amount: number;
  fee: number;
  label?: string;
  createdAt: number;
};

type SimulationPosition = {
  id: string;
  label: string;
  symbol: string;
  chain: "Ethereum" | "BNB Chain" | "Solana";
  value: number;
  costBasis: number;
  rationale: string;
  sourceStrategy?: string;
  sourceExecutedAt?: number;
};

type SimulationAccount = {
  positions: SimulationPosition[];
  transactions: SimulationTransaction[];
  snapshots: { value: number; createdAt: number }[];
  executedStrategies: {
    id: string;
    title: string;
    amount: number;
    consensusRate: number;
    riskLevel: CommitteeDecision["riskLevel"];
    allocations: { label: string; percentage: number; rationale: string; amount: number }[];
    createdAt: number;
  }[];
  lastStrategy?: {
    title: string;
    amount: number;
    consensusRate: number;
    riskLevel: CommitteeDecision["riskLevel"];
    executedAt: number;
  };
};

const defaultSimulationAccount = (): SimulationAccount => ({
  positions: [{
    id: "ethereum-usdc",
    label: "USD Coin",
    symbol: "USDC",
    chain: "Ethereum",
    value: 10000,
    costBasis: 10000,
    rationale: "默认模拟资产与策略结算资金",
  }],
  transactions: [],
  snapshots: [{ value: 10000, createdAt: Date.now() }],
  executedStrategies: [],
});

const simulationTotal = (account: SimulationAccount) => account.positions.reduce((sum, position) => sum + position.value, 0);

const traditionalAssetSymbols = new Set(["OUSG", "USDY", "PAXG", "XAUT", "SPYON"]);

function inferAllocationSymbol(label: string) {
  const normalized = label.toUpperCase();
  if (/(SPYON|标普500|标普|SP500|S&P500)/.test(normalized)) return "SPYON";
  if (/(PAXG|XAUT|黄金|GOLD)/.test(normalized)) return "PAXG";
  if (/(OUSG|USDY|美债|国债|TREASURY|BOND)/.test(normalized)) return "OUSG";
  return normalized.match(/\b[A-Z]{2,8}\b/)?.[0] ?? label.slice(0, 8).toUpperCase();
}

function traditionalAllocationPercentage(allocations: { label: string; percentage: number }[]) {
  return allocations.reduce((sum, item) => {
    const symbol = inferAllocationSymbol(item.label);
    const isTraditional = traditionalAssetSymbols.has(symbol) || /传统资产|TRADITIONAL/.test(item.label.toUpperCase());
    return sum + (isTraditional ? item.percentage : 0);
  }, 0);
}

function riskLevelByTraditionalAssets(
  allocations: { label: string; percentage: number }[],
): CommitteeDecision["riskLevel"] {
  const percentage = traditionalAllocationPercentage(allocations);
  if (percentage > 50) return "稳健";
  if (percentage >= 20) return "均衡";
  return "进取";
}

function simulationPositionFromAllocation(
  allocation: { label: string; rationale: string; amount: number },
): Omit<SimulationPosition, "id" | "value" | "costBasis"> {
  const normalized = allocation.label.toUpperCase();
  const stable = /USDC|USDT|现金|机动|稳定/.test(normalized);
  const chain: SimulationPosition["chain"] = /SOL|SOLANA/.test(normalized)
    ? "Solana"
    : /BNB|BSC/.test(normalized)
      ? "BNB Chain"
      : "Ethereum";
  const symbol = stable ? "USDC" : inferAllocationSymbol(allocation.label);
  return {
    label: stable ? "USD Coin" : allocation.label,
    symbol,
    chain: stable ? "Ethereum" : chain,
    rationale: allocation.rationale,
  };
}

function loadSimulationAccount(): SimulationAccount {
  const raw = window.localStorage.getItem("oracle-capital-simulation");
  if (!raw) return defaultSimulationAccount();
  try {
    const parsed = JSON.parse(raw) as Partial<SimulationAccount> & { balance?: number };
    if (Array.isArray(parsed.positions)) {
      return {
        positions: parsed.positions,
        transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
        snapshots: Array.isArray(parsed.snapshots) && parsed.snapshots.length ? parsed.snapshots : [{ value: parsed.positions.reduce((sum, item) => sum + item.value, 0), createdAt: Date.now() }],
        executedStrategies: Array.isArray(parsed.executedStrategies) ? parsed.executedStrategies : [],
        lastStrategy: parsed.lastStrategy,
      };
    }
    const migrated = defaultSimulationAccount();
    migrated.positions[0].value = Number(parsed.balance) || 10000;
    migrated.positions[0].costBasis = migrated.positions[0].value;
    migrated.transactions = Array.isArray(parsed.transactions) ? parsed.transactions : [];
    migrated.snapshots = [{ value: migrated.positions[0].value, createdAt: Date.now() }];
    migrated.executedStrategies = Array.isArray(parsed.executedStrategies) ? parsed.executedStrategies : [];
    return migrated;
  } catch {
    window.localStorage.removeItem("oracle-capital-simulation");
    return defaultSimulationAccount();
  }
}

function saveSimulationAccount(account: SimulationAccount) {
  window.localStorage.setItem("oracle-capital-simulation", JSON.stringify(account));
  window.dispatchEvent(new CustomEvent("oracle-capital-simulation-updated"));
}

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
  position?: string;
  avatar?: string;
  uses: number;
};

const fallbackMasters: Master[] = [
  { id: "buffett", name: "沃伦·巴菲特", en: "Warren Buffett", school: "价值投资", quote: "价格是你付出的，价值是你得到的。", return: "+18.4%", risk: "稳健", position: "0% 0%", uses: 18640 },
  { id: "munger", name: "查理·芒格", en: "Charlie Munger", school: "多元思维", quote: "先避开愚蠢，再寻找聪明。", return: "+15.7%", risk: "稳健", position: "33.333% 0%", uses: 12380 },
  { id: "lynch", name: "彼得·林奇", en: "Peter Lynch", school: "成长价值", quote: "投资你真正理解的事物。", return: "+24.1%", risk: "均衡", position: "66.666% 0%", uses: 8940 },
  { id: "newton", name: "艾萨克·牛顿", en: "Isaac Newton", school: "量化周期", quote: "用规律观察市场，也敬畏疯狂。", return: "+21.8%", risk: "均衡", position: "100% 0%", uses: 3760 },
  { id: "hayek", name: "弗里德里希·哈耶克", en: "Friedrich Hayek", school: "货币竞争", quote: "价格是分散知识的信号。", return: "+27.3%", risk: "激进", position: "0% 100%", uses: 5180 },
  { id: "marx", name: "卡尔·马克思", en: "Karl Marx", school: "资本结构", quote: "穿透收益，审视资本关系。", return: "+12.9%", risk: "均衡", position: "33.333% 100%", uses: 7420 },
  { id: "smith", name: "亚当·斯密", en: "Adam Smith", school: "市场机制", quote: "长期价值来自分工与交换。", return: "+17.6%", risk: "稳健", position: "66.666% 100%", uses: 4650 },
  { id: "keynes", name: "约翰·凯恩斯", en: "John Maynard Keynes", school: "宏观周期", quote: "市场保持非理性的时间可能更久。", return: "+22.5%", risk: "均衡", position: "100% 100%", uses: 6910 },
  { id: "soros", name: "乔治·索罗斯", en: "George Soros", school: "反身性", quote: "重要的不是你是否正确，而是正确时赚多少。", return: "+28.1%", risk: "激进", avatar: "/images/masters/soros.webp", uses: 9780 },
  { id: "livermore", name: "杰西·利弗莫尔", en: "Jesse Livermore", school: "趋势交易", quote: "赚大钱靠的从来不是思考，而是等待。", return: "+31.4%", risk: "激进", avatar: "/images/masters/livermore.webp", uses: 7560 },
  { id: "mozi", name: "墨子", en: "Mozi", school: "兼爱与实用", quote: "审利害、尚实用，以可验证的结果判断行动。", return: "+19.3%", risk: "稳健", avatar: "/images/masters/mozi.webp", uses: 4280 },
  { id: "laozi", name: "老子", en: "Laozi", school: "顺势与无为", quote: "知止不殆，少则得，多则惑。", return: "+16.2%", risk: "稳健", avatar: "/images/masters/laozi.webp", uses: 5360 },
  { id: "einstein", name: "阿尔伯特·爱因斯坦", en: "Albert Einstein", school: "复利与相对性", quote: "让模型保持简单，但不要简单过头。", return: "+20.8%", risk: "均衡", avatar: "/images/masters/einstein.webp", uses: 6120 },
];

const translations = {
  zh: {
    navMarket: "市场",
    navMasters: "投资大师",
    navRank: "社区",
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
    navRank: "Community",
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
  const initials = master.en.split(" ").map((part) => part[0]).slice(0, 2).join("");
  const hue = [...master.id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 360;
  if (master.avatar) {
    return (
      <div
        aria-label={master.name}
        className={`${dimensions} shrink-0 rounded-full border border-[var(--line)] bg-cover bg-center shadow-sm`}
        style={{ backgroundImage: `url('${basePath}${master.avatar}')` }}
      />
    );
  }
  if (!master.position) {
    return (
      <div
        aria-label={master.name}
        className={`${dimensions} grid shrink-0 place-items-center rounded-full border border-white/40 font-serif font-semibold text-white shadow-sm`}
        style={{ background: `linear-gradient(145deg, hsl(${hue} 24% 42%), hsl(${(hue + 38) % 360} 22% 20%))` }}
      >
        <span className={size === "lg" ? "text-xl" : "text-[10px]"}>{initials}</span>
      </div>
    );
  }
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
  const [masters, setMasters] = useState<Master[]>(fallbackMasters);
  const [selected, setSelected] = useState<string[]>(["buffett", "munger", "lynch"]);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [lang, setLang] = useState<"zh" | "en">("zh");
  const [view, setView] = useState<"home" | "chat" | "profile">("home");
  const [menuOpen, setMenuOpen] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  const [apiOpen, setApiOpen] = useState(false);
  const [customApi, setCustomApi] = useState<CustomApiConfig | null>(null);
  const [wallet, setWallet] = useState<ConnectedWallet | null>(null);
  const [coboConfig, setCoboConfig] = useState<CoboRuntimeConfig | null>(null);
  const [question, setQuestion] = useState("");
  const [conversationToOpen, setConversationToOpen] = useState("");
  const [savedConversations, setSavedConversations] = useState<SavedConversation[]>([]);
  const [toast, setToast] = useState("");
  const [preferencesReady, setPreferencesReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getAgentMasters()
      .then((items) => {
        if (cancelled || !items.length) return;
        const localDisplay = new Map(fallbackMasters.map((master) => [master.id, master]));
        setMasters(items.map((item) => {
          const display = localDisplay.get(item.id);
          return {
            id: item.id,
            name: item.name,
            en: item.en,
            school: item.school,
            quote: item.quote,
            return: display?.return ?? "--",
            risk: item.risk === "进取" ? "激进" : item.risk,
            uses: item.uses,
            position: display?.position,
            avatar: display?.avatar ?? masterAvatarPaths[item.id],
          };
        }));
      })
      .catch(() => setToast("人物接口暂不可用，已显示本地备用数据"));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    if (preferencesReady) window.localStorage.setItem("oracle-capital-theme", theme);
  }, [preferencesReady, theme]);

  useEffect(() => {
    if (preferencesReady) window.localStorage.setItem("oracle-capital-language", lang);
  }, [lang, preferencesReady]);

  useEffect(() => {
    if (preferencesReady) window.localStorage.setItem("oracle-capital-selected-masters", JSON.stringify(selected));
  }, [preferencesReady, selected]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const saved = window.localStorage.getItem("oracle-capital-wallet");
    const timer = window.setTimeout(() => {
      const savedTheme = window.localStorage.getItem("oracle-capital-theme");
      const savedLanguage = window.localStorage.getItem("oracle-capital-language");
      const savedMasters = window.localStorage.getItem("oracle-capital-selected-masters");
      const conversations = window.localStorage.getItem("oracle-capital-conversations");
      void loadEncryptedApiConfig().then(setCustomApi);
      if (savedTheme === "light" || savedTheme === "dark") setTheme(savedTheme);
      if (savedLanguage === "zh" || savedLanguage === "en") setLang(savedLanguage);
      if (savedMasters) {
        try {
          const ids = JSON.parse(savedMasters) as string[];
          const validIds = ids.filter((id) => fallbackMasters.some((master) => master.id === id));
          if (validIds.length) setSelected(validIds);
        } catch {
          window.localStorage.removeItem("oracle-capital-selected-masters");
        }
      }
      if (conversations) {
        try {
          setSavedConversations(JSON.parse(conversations) as SavedConversation[]);
        } catch {
          window.localStorage.removeItem("oracle-capital-conversations");
        }
      }
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as ConnectedWallet;
          setWallet(parsed);
          if (parsed.kind === "cobo") {
            setToast("为保护密钥，Cobo 连接参数不会持久化。请重新连接一次 Cobo Agent。");
          }
        } catch {
          window.localStorage.removeItem("oracle-capital-wallet");
        }
      }
      setPreferencesReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (view !== "home") return;
    const timer = window.setTimeout(() => {
      const raw = window.localStorage.getItem("oracle-capital-conversations");
      if (!raw) return setSavedConversations([]);
      try {
        setSavedConversations(JSON.parse(raw) as SavedConversation[]);
      } catch {
        window.localStorage.removeItem("oracle-capital-conversations");
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [view]);

  const t = translations[lang];
  const selectedMasters = masters.filter((master) => selected.includes(master.id));

  const toggleMaster = (id: string) => {
    setSelected((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length >= 8) {
        setToast("委员会最多选择 8 位人物");
        return current;
      }
      return [...current, id];
    });
  };

  const openNewConversation = (topic = "") => {
    setConversationToOpen("");
    setQuestion(topic);
    setView("chat");
  };

  const openSavedConversation = (conversation: SavedConversation) => {
    const validIds = conversation.masterIds.filter((id) => masters.some((master) => master.id === id));
    if (validIds.length) setSelected(validIds);
    setConversationToOpen(conversation.id);
    setQuestion("");
    setMenuOpen(false);
    setView("chat");
  };

  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--ink)] transition-colors">
      <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[color:var(--bg)/.94] backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-[1440px] items-center justify-between px-5 lg:px-10">
          <button onClick={() => setView("home")}><BrandMark /></button>
          <nav className="hidden items-center gap-9 text-sm text-[var(--muted)] md:flex">
            <Link href="/market" className="hover:text-[var(--ink)]">{t.navMarket}</Link>
            <button onClick={() => setView("home")} className="text-[var(--ink)]">{t.navMasters}</button>
            <Link href="/community" className="hover:text-[var(--ink)]">{t.navRank}</Link>
          </nav>
          <div className="flex items-center gap-2">
            <button onClick={() => setToast("暂无新通知，AI 方案仍需你确认后执行")} className="icon-btn hidden sm:grid" aria-label="Notifications"><Bell size={17} /></button>
            <button onClick={() => setWalletOpen(true)} className="primary-btn ml-1">
              <Wallet size={16} /> <span className="hidden sm:inline">{wallet ? `${wallet.label} ${shortAddress(wallet.address)}` : t.connect}</span>
            </button>
            <div className="relative">
              <button aria-label="打开账户菜单" aria-expanded={menuOpen} onClick={() => setMenuOpen((current) => !current)} className="flex h-10 items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--panel)] pl-1 pr-2">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-[var(--wash)]"><UserRound size={16} /></span>
                <ChevronDown className={`transition-transform ${menuOpen ? "rotate-180" : ""}`} size={14} />
              </button>
              {menuOpen && (
                <>
                  <button aria-label="关闭账户菜单" onClick={() => setMenuOpen(false)} className="fixed inset-0 z-40 cursor-default" />
                  <div className="absolute right-0 top-12 z-50 w-72 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-3 shadow-[0_22px_60px_rgba(10,30,23,.2)]">
                    <div className="px-2 pb-3 pt-1">
                      <div className="text-xs font-semibold">{wallet ? wallet.label : "Oracle Capital 用户"}</div>
                      <div className="mt-1 truncate text-[10px] text-[var(--muted)]">{wallet ? wallet.address : "本地访客模式"}</div>
                    </div>
                    <button onClick={() => { setMenuOpen(false); setView("profile"); }} className="topic-row border-0 bg-transparent"><UserRound size={16} /><span className="flex-1 text-left">个人中心</span><ArrowRight size={14} /></button>
                    <button onClick={() => { setMenuOpen(false); setView("home"); window.setTimeout(() => document.getElementById("history")?.scrollIntoView(), 0); }} className="topic-row border-0 bg-transparent"><History size={16} /><span className="flex-1 text-left">历史对话</span><span className="text-[10px] text-[var(--muted)]">{savedConversations.length}</span></button>
                    <Link href="/docs" onClick={() => setMenuOpen(false)} className="topic-row border-0 bg-transparent"><BookOpen size={16} /><span className="flex-1 text-left">产品文档</span><ArrowRight size={14} /></Link>
                    <button onClick={() => { setMenuOpen(false); setApiOpen(true); }} className="topic-row border-0 bg-transparent"><Code2 size={16} /><span className="flex-1 text-left">开发者 API</span><span className={`text-[10px] ${customApi ? "text-[var(--positive)]" : "text-[var(--muted)]"}`}>{customApi ? "已启用" : "平台默认"}</span></button>
                    <div className="my-2 border-t border-[var(--line)]" />
                    <div className="px-3 py-2 text-[10px] font-semibold tracking-[0.16em] text-[var(--muted)]">设置</div>
                    <div className="grid grid-cols-2 gap-2 p-2">
                      <button onClick={() => setLang(lang === "zh" ? "en" : "zh")} className="secondary-btn px-3"><Globe2 size={15} />{lang === "zh" ? "中文" : "English"}</button>
                      <button onClick={() => setTheme(theme === "light" ? "dark" : "light")} className="secondary-btn px-3">{theme === "light" ? <Moon size={15} /> : <Sun size={15} />}{theme === "light" ? "夜间" : "日间"}</button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {view === "home" && (
        <HomeView
          masters={masters}
          t={t}
          selected={selected}
          selectedMasters={selectedMasters}
          toggleMaster={toggleMaster}
          conversations={savedConversations}
          onStart={() => selected.length && openNewConversation()}
          onTopic={openNewConversation}
          onOpenConversation={openSavedConversation}
        />
      )}
      {view === "chat" && <ChatView masters={masters} selectedMasters={selectedMasters} initialQuestion={question} initialConversationId={conversationToOpen} onRestoreMasters={setSelected} onBack={() => setView("home")} onOpenSimulation={() => setView("profile")} wallet={wallet} onNeedWallet={() => setWalletOpen(true)} customApi={customApi} notify={setToast} />}
      {view === "profile" && <ProfileView wallet={wallet} coboConfig={coboConfig} onNeedWallet={() => setWalletOpen(true)} notify={setToast} />}
      {walletOpen && <WalletModal connected={wallet} onClose={() => setWalletOpen(false)} onConnect={(value, nextCoboConfig) => { setWallet(value); setCoboConfig(nextCoboConfig ?? null); window.localStorage.setItem("oracle-capital-wallet", JSON.stringify(value)); setWalletOpen(false); setToast(`${value.label} 已连接`); }} onDisconnect={() => { setWallet(null); setCoboConfig(null); window.localStorage.removeItem("oracle-capital-wallet"); setWalletOpen(false); setToast("钱包已断开"); }} notify={setToast} />}
      {apiOpen && <DeveloperApiModal current={customApi} onClose={() => setApiOpen(false)} onSave={(config) => { setCustomApi(config); setApiOpen(false); setToast("开发者 API 已加密保存并启用"); }} onRemove={() => { setCustomApi(null); setApiOpen(false); setToast("已恢复平台默认 API"); }} />}
      {toast && <div className="fixed bottom-5 left-1/2 z-[70] -translate-x-1/2 rounded-full bg-[var(--ink)] px-5 py-3 text-xs text-[var(--bg)] shadow-xl">{toast}</div>}
    </main>
  );
}

function HomeView({
  masters,
  t,
  selected,
  selectedMasters,
  toggleMaster,
  conversations,
  onStart,
  onTopic,
  onOpenConversation,
}: {
  masters: Master[];
  t: typeof translations.zh;
  selected: string[];
  selectedMasters: Master[];
  toggleMaster: (id: string) => void;
  conversations: SavedConversation[];
  onStart: () => void;
  onTopic: (topic: string) => void;
  onOpenConversation: (conversation: SavedConversation) => void;
}) {
  const [search, setSearch] = useState("");

  const usageByMaster = useMemo(() => {
    const counts = Object.fromEntries(masters.map((master) => [master.id, master.uses]));
    conversations.forEach((conversation) => conversation.masterIds.forEach((id) => {
      counts[id] = (counts[id] ?? 0) + 1;
    }));
    return counts;
  }, [conversations, masters]);

  const filteredMasters = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return masters
      .filter((master) => !keyword || [master.name, master.en, master.school, master.quote]
        .some((field) => field.toLowerCase().includes(keyword)))
      .sort((first, second) => (usageByMaster[second.id] ?? 0) - (usageByMaster[first.id] ?? 0));
  }, [masters, search, usageByMaster]);

  const usageValues = masters.map((master) => Math.log10((usageByMaster[master.id] ?? 0) + 1));
  const minUsage = Math.min(...usageValues);
  const maxUsage = Math.max(...usageValues);
  const sizeByMaster = useMemo(() => Object.fromEntries(masters.map((master) => {
    const value = Math.log10((usageByMaster[master.id] ?? 0) + 1);
    const ratio = maxUsage === minUsage ? 0.5 : (value - minUsage) / (maxUsage - minUsage);
    return [master.id, Math.round(152 + ratio * 96)];
  })), [masters, maxUsage, minUsage, usageByMaster]);

  return (
    <>
      <section className="hero-glow mx-auto max-w-[1440px] px-5 pb-16 pt-16 text-center lg:px-10 lg:pt-24">
        <div className="mb-5 text-xs font-semibold tracking-[0.28em] text-[var(--gold)]">{t.eyebrow}</div>
        <h1 className="mx-auto max-w-4xl font-serif text-4xl leading-tight md:text-6xl lg:text-[72px]">{t.title}</h1>
        <p className="mx-auto mt-6 max-w-2xl text-sm leading-7 text-[var(--muted)] md:text-base">{t.sub}</p>

        <div className="relative mx-auto mt-9 max-w-xl">
          <Search className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={17} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索人物、流派或投资思想" className="h-13 w-full rounded-full border border-[var(--line)] bg-[var(--panel)] pl-12 pr-5 text-sm outline-none transition focus:border-[var(--green)]" />
        </div>

        <PhysicsMasterOrbit masters={filteredMasters} selected={selected} usageByMaster={usageByMaster} sizeByMaster={sizeByMaster} toggleMaster={toggleMaster} />
        {!filteredMasters.length && <div className="mx-auto mt-10 max-w-lg rounded-2xl border border-dashed border-[var(--line)] p-8 text-sm text-[var(--muted)]">没有找到匹配人物，试试姓名、英文名或投资流派。</div>}

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

      <section id="history" className="scroll-mt-24 border-t border-[var(--line)]">
        <div className="mx-auto max-w-[1200px] px-5 py-14 lg:px-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="section-label"><History size={14} /> 历史对话</div>
              <h2 className="mt-3 font-serif text-3xl">继续上次的投资讨论</h2>
              <p className="mt-2 text-xs text-[var(--muted)]">消息、委员会成员和最终方案都保存在当前浏览器。</p>
            </div>
            <button disabled={!conversations.length} onClick={() => conversations[0] && onOpenConversation(conversations[0])} className="secondary-btn">继续最近对话 <ArrowRight size={14} /></button>
          </div>
          {conversations.length ? (
            <div className="mt-7 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {conversations.slice(0, 6).map((conversation) => {
                const conversationMasters = conversation.masterIds
                  .map((id) => masters.find((master) => master.id === id))
                  .filter((master): master is Master => Boolean(master));
                return (
                  <button key={conversation.id} onClick={() => onOpenConversation(conversation)} className="stat-card text-left">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex -space-x-2">{conversationMasters.slice(0, 4).map((master) => <Avatar key={master.id} master={master} size="sm" />)}</div>
                      <span className="text-[10px] text-[var(--muted)]">{new Date(conversation.updatedAt).toLocaleDateString("zh-CN")}</span>
                    </div>
                    <h3 className="mt-5 truncate font-serif text-lg">{conversation.title}</h3>
                    <p className="mt-2 text-[10px] text-[var(--muted)]">{conversationMasters.map((master) => master.name).join(" · ") || "投资委员会"}</p>
                    <div className="mt-5 flex items-center justify-between border-t border-[var(--line)] pt-4 text-xs text-[var(--green)]"><span>{conversation.messages.length} 条消息{conversation.decision ? conversation.decision.executedAt ? " · 已执行" : " · 已形成方案" : ""}</span><ArrowRight size={14} /></div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="mt-7 rounded-2xl border border-dashed border-[var(--line)] bg-[var(--panel)] p-8 text-center">
              <History className="mx-auto text-[var(--gold)]" size={22} />
              <p className="mt-3 text-sm">还没有历史对话</p>
              <p className="mt-2 text-xs text-[var(--muted)]">选择大师并发送第一条消息后，会自动出现在这里。</p>
            </div>
          )}
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

type PhysicsBody = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  dragging: boolean;
  pointerId: number | null;
  offsetX: number;
  offsetY: number;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  lastTime: number;
};

function PhysicsMasterOrbit({
  masters: visibleMasters,
  selected,
  usageByMaster,
  sizeByMaster,
  toggleMaster,
}: {
  masters: Master[];
  selected: string[];
  usageByMaster: Record<string, number>;
  sizeByMaster: Record<string, number>;
  toggleMaster: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const elementRefs = useRef(new Map<string, HTMLElement>());
  const bodiesRef = useRef(new Map<string, PhysicsBody>());
  const masterKey = visibleMasters.map((master) => master.id).join(",");

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !visibleMasters.length) return;
    const bounds = container.getBoundingClientRect();
    const columns = Math.max(2, Math.ceil(Math.sqrt(visibleMasters.length * 1.5)));
    const rows = Math.ceil(visibleMasters.length / columns);
    const nextBodies = new Map<string, PhysicsBody>();

    visibleMasters.forEach((master, index) => {
      const size = Math.min(sizeByMaster[master.id] ?? 152, Math.max(118, bounds.width * 0.42));
      const column = index % columns;
      const row = Math.floor(index / columns);
      const cellWidth = bounds.width / columns;
      const cellHeight = bounds.height / Math.max(1, rows);
      const prior = bodiesRef.current.get(master.id);
      nextBodies.set(master.id, {
        x: prior ? Math.min(Math.max(0, prior.x), Math.max(0, bounds.width - size)) : Math.max(0, column * cellWidth + (cellWidth - size) / 2),
        y: prior ? Math.min(Math.max(0, prior.y), Math.max(0, bounds.height - size)) : Math.max(0, row * cellHeight + (cellHeight - size) / 2),
        vx: prior?.vx ?? ((index % 3) - 1) * 0.22,
        vy: prior?.vy ?? ((index % 2) ? 0.18 : -0.18),
        size,
        dragging: false,
        pointerId: null,
        offsetX: 0,
        offsetY: 0,
        startX: 0,
        startY: 0,
        lastX: 0,
        lastY: 0,
        lastTime: 0,
      });
    });
    bodiesRef.current = nextBodies;

    let frame = 0;
    let previousTime = performance.now();
    const animate = (time: number) => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      const delta = Math.min(2, Math.max(0.25, (time - previousTime) / 16.67));
      previousTime = time;
      const bodies = [...bodiesRef.current.entries()];

      for (const [, body] of bodies) {
        if (body.dragging) continue;
        body.x += body.vx * delta;
        body.y += body.vy * delta;
        body.vx *= Math.pow(0.992, delta);
        body.vy *= Math.pow(0.992, delta);
        if (Math.abs(body.vx) < 0.025) body.vx += 0.012 * (Math.random() - 0.5);
        if (Math.abs(body.vy) < 0.025) body.vy += 0.012 * (Math.random() - 0.5);
        if (body.x <= 0 || body.x + body.size >= width) {
          body.x = Math.min(Math.max(0, body.x), Math.max(0, width - body.size));
          body.vx *= -0.82;
        }
        if (body.y <= 0 || body.y + body.size >= height) {
          body.y = Math.min(Math.max(0, body.y), Math.max(0, height - body.size));
          body.vy *= -0.82;
        }
      }

      for (let i = 0; i < bodies.length; i += 1) {
        for (let j = i + 1; j < bodies.length; j += 1) {
          const first = bodies[i][1];
          const second = bodies[j][1];
          const firstRadius = first.size / 2;
          const secondRadius = second.size / 2;
          const dx = second.x + secondRadius - (first.x + firstRadius);
          const dy = second.y + secondRadius - (first.y + firstRadius);
          const distance = Math.hypot(dx, dy) || 0.01;
          const minimum = firstRadius + secondRadius + 5;
          if (distance >= minimum) continue;
          const nx = dx / distance;
          const ny = dy / distance;
          const overlap = minimum - distance;
          if (!first.dragging) {
            first.x -= nx * overlap * 0.5;
            first.y -= ny * overlap * 0.5;
          }
          if (!second.dragging) {
            second.x += nx * overlap * 0.5;
            second.y += ny * overlap * 0.5;
          }
          const relativeVelocity = (second.vx - first.vx) * nx + (second.vy - first.vy) * ny;
          if (relativeVelocity < 0) {
            const impulse = relativeVelocity * 0.88;
            if (!first.dragging) {
              first.vx += impulse * nx;
              first.vy += impulse * ny;
            }
            if (!second.dragging) {
              second.vx -= impulse * nx;
              second.vy -= impulse * ny;
            }
          }
        }
      }

      for (const [id, body] of bodies) {
        const element = elementRefs.current.get(id);
        if (!element) continue;
        element.style.width = `${body.size}px`;
        element.style.height = `${body.size}px`;
        element.style.transform = `translate3d(${body.x}px, ${body.y}px, 0)`;
      }
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [masterKey, sizeByMaster, visibleMasters]);

  const pointerDown = (event: ReactPointerEvent<HTMLElement>, master: Master) => {
    const body = bodiesRef.current.get(master.id);
    const container = containerRef.current;
    if (!body || !container) return;
    const bounds = container.getBoundingClientRect();
    body.dragging = true;
    body.pointerId = event.pointerId;
    body.offsetX = event.clientX - bounds.left - body.x;
    body.offsetY = event.clientY - bounds.top - body.y;
    body.startX = event.clientX;
    body.startY = event.clientY;
    body.lastX = event.clientX;
    body.lastY = event.clientY;
    body.lastTime = event.timeStamp;
    body.vx = 0;
    body.vy = 0;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const pointerMove = (event: ReactPointerEvent<HTMLElement>, master: Master) => {
    const body = bodiesRef.current.get(master.id);
    const container = containerRef.current;
    if (!body?.dragging || body.pointerId !== event.pointerId || !container) return;
    const bounds = container.getBoundingClientRect();
    const now = event.timeStamp;
    const elapsed = Math.max(8, now - body.lastTime);
    body.x = Math.min(Math.max(0, event.clientX - bounds.left - body.offsetX), Math.max(0, bounds.width - body.size));
    body.y = Math.min(Math.max(0, event.clientY - bounds.top - body.offsetY), Math.max(0, bounds.height - body.size));
    body.vx = ((event.clientX - body.lastX) / elapsed) * 16.67;
    body.vy = ((event.clientY - body.lastY) / elapsed) * 16.67;
    body.lastX = event.clientX;
    body.lastY = event.clientY;
    body.lastTime = now;
  };

  const pointerUp = (event: ReactPointerEvent<HTMLElement>, master: Master) => {
    const body = bodiesRef.current.get(master.id);
    if (!body || body.pointerId !== event.pointerId) return;
    const distance = Math.hypot(event.clientX - body.startX, event.clientY - body.startY);
    body.dragging = false;
    body.pointerId = null;
    body.vx = Math.max(-18, Math.min(18, body.vx));
    body.vy = Math.max(-18, Math.min(18, body.vy));
    if (distance < 7) toggleMaster(master.id);
  };

  return (
    <div ref={containerRef} className="master-orbit physics mx-auto mt-10 max-w-6xl" style={{ height: visibleMasters.length > 12 ? 900 : 640 }} aria-label="可拖动人物星图">
      {visibleMasters.map((master) => {
        const active = selected.includes(master.id);
        return (
          <article
            key={master.id}
            ref={(element) => {
              if (element) elementRefs.current.set(master.id, element);
              else elementRefs.current.delete(master.id);
            }}
            onPointerDown={(event) => pointerDown(event, master)}
            onPointerMove={(event) => pointerMove(event, master)}
            onPointerUp={(event) => pointerUp(event, master)}
            onPointerCancel={(event) => pointerUp(event, master)}
            className={`master-ball physics ${active ? "selected" : ""}`}
            aria-label={`${master.name}，拖动移动，单击${active ? "取消选择" : "选择"}`}
          >
            <div className="pointer-events-none relative z-10 flex h-full flex-col items-center justify-center p-5">
              <Avatar master={master} size={(sizeByMaster[master.id] ?? 152) > 210 ? "lg" : "md"} />
              <h3 className="mt-3 font-serif text-lg font-semibold">{master.name}</h3>
              <p className="mt-1 text-[9px] text-[var(--muted)]">{master.school} · {(usageByMaster[master.id] ?? 0).toLocaleString()} 次</p>
              {active && <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-[var(--green)] px-2 py-1 text-[9px] text-[var(--bg)]"><Check size={10} />已选择</span>}
            </div>
          </article>
        );
      })}
      <span className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-[var(--panel-glass)] px-4 py-2 text-[10px] text-[var(--muted)] shadow-sm">拖动人物球并松手，可按惯性运动</span>
    </div>
  );
}

function shortAddress(address: string) {
  return address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address;
}

function ChatView({
  masters,
  selectedMasters,
  initialQuestion,
  initialConversationId,
  onRestoreMasters,
  onBack,
  onOpenSimulation,
  wallet,
  onNeedWallet,
  customApi,
  notify,
}: {
  masters: Master[];
  selectedMasters: Master[];
  initialQuestion: string;
  initialConversationId: string;
  onRestoreMasters: (masterIds: string[]) => void;
  onBack: () => void;
  onOpenSimulation: () => void;
  wallet: ConnectedWallet | null;
  onNeedWallet: () => void;
  customApi: CustomApiConfig | null;
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
  const [decision, setDecision] = useState<CommitteeDecision | null>(null);
  const [executionPromptOpen, setExecutionPromptOpen] = useState(false);
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
      let conversations: SavedConversation[] = [];
      if (raw) {
        try {
          conversations = JSON.parse(raw) as SavedConversation[];
          setSavedConversations(conversations);
        } catch {
          window.localStorage.removeItem("oracle-capital-conversations");
        }
      }
      const requested = conversations.find((conversation) => conversation.id === initialConversationId);
      if (requested) {
        setConversationId(requested.id);
        setMessages(requested.messages);
        setDecision(requested.decision ?? null);
        setShowPlan(Boolean(requested.decision));
        onRestoreMasters(requested.masterIds);
        notify(`已恢复：${requested.title}`);
      } else {
        setConversationId(crypto.randomUUID());
      }
      setStorageReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [initialConversationId, notify, onRestoreMasters]);

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
          decision: decision ?? undefined,
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
  }, [activeMasterIds, conversationId, decision, messages, storageReady]);

  const newConversation = () => {
    setConversationId(crypto.randomUUID());
    setMessages([{ id: crypto.randomUUID(), role: "system", content: "新对话已建立，请输入你的投资问题。" }]);
    setShowPlan(false);
    setPreview(false);
    setDecision(null);
    setExecutionPromptOpen(false);
    setInput("");
  };

  const loadConversation = (conversation: SavedConversation) => {
    onRestoreMasters(conversation.masterIds);
    setConversationId(conversation.id);
    setMessages(conversation.messages);
    setDecision(conversation.decision ?? null);
    setShowPlan(Boolean(conversation.decision));
    setPreview(false);
    setExecutionPromptOpen(false);
    notify(`已恢复：${conversation.title}`);
  };

  const sendMessage = async (event?: FormEvent) => {
    event?.preventDefault();
    const prompt = input.trim();
    if (!prompt || loading || paused) return;
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: "user", content: prompt }]);
    setInput("");
    setLoading(true);
    setShowPlan(false);
    setPreview(false);
    setDecision(null);
    setExecutionPromptOpen(false);

    try {
      const discussionInput = {
        mode: activeMasters.length === 1 ? "single" : "council",
        question: prompt,
        masterId: activeMasters.length === 1 ? activeMasters[0].id : undefined,
        masterIds: activeMasters.length > 1 ? activeMasters.map((master) => master.id) : undefined,
      } as const;
      const data = await streamAgentDiscussion(discussionInput)
        .catch(() => createAgentDiscussion(discussionInput));
      const opinions = new Map(data.opinions.map((opinion) => [opinion.masterId, opinion]));
      const transcript = data.transcript.filter((message) => message.role !== "user" && message.stage !== "setup");
      setMessages((current) => [
        ...current,
        ...transcript.map((message) => {
          const opinion = message.masterId ? opinions.get(message.masterId) : undefined;
          return {
            id: message.id,
            role: message.role === "master" ? "master" as const : "system" as const,
            masterId: message.masterId,
            content: message.content,
            vote: opinion?.vote,
            confidence: opinion?.confidence,
          };
        }),
      ]);
      if (data.proposal) {
        const voteCounts = data.opinions.reduce((counts, opinion) => {
          counts[opinion.vote] += 1;
          return counts;
        }, { approve: 0, abstain: 0, reject: 0 });
        const weightedVotes = voteCounts.approve + voteCounts.abstain * 0.5;
        setDecision({
          title: data.proposal.title,
          thesis: data.proposal.thesis,
          allocations: data.proposal.allocations,
          riskLevel: riskLevelByTraditionalAssets(data.proposal.allocations),
          expectedReturn: data.proposal.expectedReturn,
          maxDrawdown: data.proposal.maxDrawdown,
          dissent: data.proposal.dissent,
          steps: data.proposal.executionSteps,
          consensusRate: data.opinions.length ? Math.round(weightedVotes / data.opinions.length * 100) : 0,
          voteCounts,
        });
        setShowPlan(true);
      }
      if (data.demo) notify("AI 服务已进入后端演示模式");
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
      setDecision({
        title: "防守型观察方案",
        thesis: "当前信息不足以形成高置信度配置，先保留选择权并补齐关键数据。",
        allocations: [
          { label: "机动资金", percentage: 70, rationale: "等待更清晰的价格与风险信号" },
          { label: "小额观察仓", percentage: 30, rationale: "仅用于验证假设，不使用杠杆" },
        ],
        riskLevel: riskLevelByTraditionalAssets([
          { label: "机动资金", percentage: 70 },
          { label: "小额观察仓", percentage: 30 },
        ]),
        expectedReturn: "不适用",
        maxDrawdown: "控制在可承受范围内",
        dissent: "AI 服务降级，委员会未完成正式投票。",
        steps: ["明确投资期限与最大亏损", "补充可验证数据", "小额分批执行"],
        consensusRate: 50,
        voteCounts: { approve: 0, abstain: activeMasters.length, reject: 0 },
      });
      setShowPlan(true);
      notify(`${customApi ? "自定义 API" : "DeepSeek"} 暂未响应，已切换演示回复`);
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
              <span className="status-dot">{loading ? "思考中" : customApi ? `${customApi.model} · 自定义 API` : "DeepSeek 在线"}</span>
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
                <div>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">{master.name}</span>
                    <span className="text-[10px] text-[var(--muted)]">{master.school}</span>
                    {message.vote && <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${message.vote === "approve" ? "bg-emerald-500/10 text-emerald-600" : message.vote === "reject" ? "bg-red-500/10 text-red-500" : "bg-amber-500/10 text-amber-600"}`}>{message.vote === "approve" ? "赞成" : message.vote === "reject" ? "反对" : "保留"} · {message.confidence}%</span>}
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-7 text-[var(--ink-soft)]">{message.content}</p>
                </div>
              </div>
            );
          })}
          {loading && <div className="flex items-center gap-3 text-sm text-[var(--muted)]"><LoaderCircle className="animate-spin" size={18} />{customApi ? customApi.model : "DeepSeek"} 正在组织不同大师的观点...</div>}

          {showPlan && decision && !preview && (
            <div className="plan-card">
              <div className="flex items-start justify-between">
                <div>
                  <div className="section-label"><Sparkles size={14} /> 委员会最终方案</div>
                  <h3 className="mt-2 font-serif text-2xl">{decision.title}</h3>
                </div>
                <span className="rounded-full bg-[var(--wash)] px-3 py-1 text-xs text-[var(--green)]">共识率 {decision.consensusRate}%</span>
              </div>
              <p className="mt-4 text-sm leading-6 text-[var(--ink-soft)]">{decision.thesis}</p>
              <div className="mt-5 grid grid-cols-3 gap-2">
                {[["赞成", decision.voteCounts.approve, "text-emerald-600"], ["保留", decision.voteCounts.abstain, "text-amber-600"], ["反对", decision.voteCounts.reject, "text-red-500"]].map(([label, value, color]) => <div key={String(label)} className="rounded-lg bg-[var(--panel-soft)] p-3 text-center"><div className={`font-serif text-xl ${color}`}>{value}</div><div className="text-[10px] text-[var(--muted)]">{label}票</div></div>)}
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {decision.allocations.map((item) => <div key={item.label} className="rounded-lg border border-[var(--line)] p-3"><div className="flex items-center justify-between"><span className="text-xs font-semibold">{item.label}</span><span className="font-serif text-xl">{item.percentage}%</span></div><p className="mt-2 text-[10px] leading-5 text-[var(--muted)]">{item.rationale}</p></div>)}
              </div>
              <div className="mt-4 rounded-lg bg-[var(--panel-soft)] p-4 text-xs leading-6"><strong>主要分歧：</strong>{decision.dissent}</div>
              <div className="mt-4 grid gap-3 text-xs sm:grid-cols-3"><div><span className="text-[var(--muted)]">风险等级</span><strong className="mt-1 block">{decision.riskLevel}</strong></div><div><span className="text-[var(--muted)]">收益判断</span><strong className="mt-1 block">{decision.expectedReturn}</strong></div><div><span className="text-[var(--muted)]">压力回撤</span><strong className="mt-1 block">{decision.maxDrawdown}</strong></div></div>
              <div className="mt-5"><div className="section-label"><ShieldCheck size={14} /> 执行步骤</div><ol className="mt-3 space-y-2">{decision.steps.map((step, index) => <li key={`${step}-${index}`} className="flex gap-3 text-xs leading-5"><span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--wash)] font-serif">{index + 1}</span><span>{step}</span></li>)}</ol></div>
              <div className="mt-6 flex flex-col gap-2 sm:flex-row">
                <button className="primary-btn flex-1" onClick={() => setPreview(true)} disabled={Boolean(decision.executedAt)}>
                  <CircleDollarSign size={16} /> {decision.executedAt ? "方案已执行" : "预览模拟执行"}
                </button>
                <button onClick={() => setEditing(!editing)} className="secondary-btn flex-1">{editing ? "收起投票说明" : "查看投票机制"}</button>
              </div>
              {decision.executedAt && (
                <p className="mt-3 rounded-lg border border-[var(--line)] p-3 text-[10px] leading-5 text-[var(--muted)]">
                  该方案已在 {new Date(decision.executedAt).toLocaleString("zh-CN")} 执行，
                  执行金额 ${decision.executedAmount?.toLocaleString("en-US", { maximumFractionDigits: 2 }) ?? "—"}，
                  不可重复确认执行。
                </p>
              )}
              {editing && <p className="mt-3 rounded-lg border border-[var(--line)] p-3 text-[10px] leading-5 text-[var(--muted)]">共识率计算：赞成票计 1，保留票计 0.5，反对票计 0，再除以参与投票的大师人数。彩蛋只改变角色台词，不影响投票和最终方案。</p>}
            </div>
          )}

          {preview && decision && <TradePreview decision={decision} wallet={wallet} onNeedWallet={onNeedWallet} notify={notify} onBack={() => setPreview(false)} onExecuted={(executedAt, executedAmount) => { setDecision((current) => current ? { ...current, executedAt, executedAmount } : current); setPreview(false); setExecutionPromptOpen(true); }} />}
          {executionPromptOpen && (
            <div className="fixed inset-0 z-[90] grid place-items-center bg-black/45 p-4 backdrop-blur-sm">
              <button className="absolute inset-0 cursor-default" aria-label="关闭执行提示" onClick={() => setExecutionPromptOpen(false)} />
              <div className="relative z-10 w-full max-w-md rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-6">
                <div className="section-label"><ShieldCheck size={14} /> 执行完成</div>
                <h3 className="mt-3 font-serif text-2xl">方案已执行到模拟盘</h3>
                <p className="mt-3 text-sm text-[var(--muted)]">你可以立即跳转到个人中心的模拟盘查看持仓与流水更新。</p>
                <div className="mt-6 flex gap-2">
                  <button className="secondary-btn flex-1" onClick={() => setExecutionPromptOpen(false)}>稍后查看</button>
                  <button className="primary-btn flex-1" onClick={() => { setExecutionPromptOpen(false); onOpenSimulation(); }}>去模拟盘查看</button>
                </div>
              </div>
            </div>
          )}
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

function TradePreview({
  onBack,
  decision,
  wallet,
  onNeedWallet,
  notify,
  onExecuted,
}: {
  onBack: () => void;
  decision: CommitteeDecision;
  wallet: ConnectedWallet | null;
  onNeedWallet: () => void;
  notify: (message: string) => void;
  onExecuted: (executedAt: number, executedAmount: number) => void;
}) {
  const [accepted, setAccepted] = useState(false);
  const [status, setStatus] = useState<"ready" | "signing" | "done">("ready");
  const [amount, setAmount] = useState("");
  const [available, setAvailable] = useState(0);

  useEffect(() => {
    const refresh = () => {
      const current = loadSimulationAccount();
      const usdc = current.positions.find((position) => position.symbol === "USDC" && position.chain === "Ethereum");
      setAvailable(usdc?.value ?? 0);
    };
    const timer = window.setTimeout(refresh, 0);
    window.addEventListener("oracle-capital-simulation-updated", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("oracle-capital-simulation-updated", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const execute = () => {
    if (decision.executedAt) {
      notify("该方案已执行，不能重复确认");
      return;
    }
    const investAmount = Number(amount);
    if (!Number.isFinite(investAmount) || investAmount <= 0) {
      notify("请输入有效投资金额");
      return;
    }
    setStatus("signing");
    window.setTimeout(() => {
      const current = loadSimulationAccount();
      const positionMap = new Map<string, SimulationPosition>(
        current.positions.map((position) => [`${position.chain}:${position.symbol}`, { ...position }]),
      );
      const usdcKey = "Ethereum:USDC";
      const usdc = positionMap.get(usdcKey);
      if (!usdc || usdc.value < investAmount) {
        setStatus("ready");
        notify("Ethereum USDC 可用余额不足");
        return;
      }
      usdc.value -= investAmount;
      usdc.costBasis = Math.max(0, usdc.costBasis - investAmount);
      const executedAllocations = decision.allocations.map((item) => ({
        ...item,
        amount: investAmount * item.percentage / 100,
      }));
      for (const allocation of executedAllocations) {
        const seed = simulationPositionFromAllocation(allocation);
        const key = `${seed.chain}:${seed.symbol}`;
        const existing = positionMap.get(key);
        if (existing) {
          existing.value += allocation.amount;
          existing.costBasis += allocation.amount;
          existing.sourceStrategy = decision.title;
          existing.sourceExecutedAt = Date.now();
          if (existing.rationale !== allocation.rationale && existing.rationale.length < 180) {
            existing.rationale = `${existing.rationale}；${allocation.rationale}`;
          }
        } else {
          positionMap.set(key, {
            id: `${seed.chain}-${seed.symbol}-${crypto.randomUUID()}`,
            label: seed.label,
            symbol: seed.symbol,
            chain: seed.chain,
            value: allocation.amount,
            costBasis: allocation.amount,
            rationale: allocation.rationale,
            sourceStrategy: decision.title,
            sourceExecutedAt: Date.now(),
          });
        }
      }
      const nextPositions = [...positionMap.values()].filter((position) => position.value > 0.0001);
      const next: SimulationAccount = {
        positions: nextPositions,
        transactions: [{
          id: crypto.randomUUID(),
          type: "strategy" as const,
          amount: investAmount,
          fee: 0,
          label: decision.title,
          createdAt: Date.now(),
        }, ...current.transactions].slice(0, 30),
        snapshots: [...current.snapshots, { value: simulationTotal({ ...current, positions: nextPositions }), createdAt: Date.now() }].slice(-30),
        executedStrategies: [{
          id: crypto.randomUUID(),
          title: decision.title,
          amount: investAmount,
          consensusRate: decision.consensusRate,
          riskLevel: decision.riskLevel,
          allocations: executedAllocations,
          createdAt: Date.now(),
        }, ...current.executedStrategies].slice(0, 20),
        lastStrategy: {
          title: decision.title,
          amount: investAmount,
          consensusRate: decision.consensusRate,
          riskLevel: decision.riskLevel,
          executedAt: Date.now(),
        },
      };
      saveSimulationAccount(next);
      setStatus("done");
      onExecuted(Date.now(), investAmount);
      notify("模拟方案已写入个人中心持仓");
    }, 1200);
  };
  return (
    <div className="plan-card">
      <div className="flex items-center justify-between">
        <div><div className="section-label">方案执行预览</div><h3 className="mt-2 font-serif text-2xl">{decision.title}</h3></div>
        <button onClick={onBack} className="icon-btn"><X size={16} /></button>
      </div>
      <div className="mt-6 space-y-3 text-sm">
        {decision.allocations.map((item) => <div key={item.label} className="flex justify-between gap-4 border-b border-[var(--line)] pb-3"><span className="text-[var(--muted)]">{item.label}</span><span>{item.percentage}%</span></div>)}
        <div className="flex justify-between border-b border-[var(--line)] pb-3"><span className="text-[var(--muted)]">共识率</span><span>{decision.consensusRate}%</span></div>
        <div className="flex justify-between border-b border-[var(--line)] pb-3"><span className="text-[var(--muted)]">风险等级</span><span>{decision.riskLevel}</span></div>
      </div>
      <div className="mt-5 rounded-lg bg-[var(--panel-soft)] p-3">
        <div className="text-[10px] text-[var(--muted)]">本次投资金额（USD）</div>
        <div className="mt-2 flex gap-2">
          <input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder="例如 1500" className="min-w-0 flex-1 rounded-full border border-[var(--line)] bg-transparent px-4 py-2 text-sm outline-none" />
          <button type="button" onClick={() => setAmount(available ? available.toFixed(2) : "")} className="secondary-btn px-4">全部</button>
        </div>
        <p className="mt-2 text-[10px] text-[var(--muted)]">当前可用 Ethereum USDC：${available.toLocaleString("en-US", { maximumFractionDigits: 2 })}</p>
      </div>
      <label className="mt-5 flex items-start gap-3 rounded-lg bg-[var(--panel-soft)] p-3 text-xs leading-5">
        <input checked={accepted} onChange={(event) => setAccepted(event.target.checked)} type="checkbox" className="mt-1 accent-[var(--green)]" /> 我已阅读风险摘要，并理解这是黑客松模拟交易，不会广播到链上。
      </label>
      <button disabled={!accepted || status !== "ready" || Boolean(decision.executedAt)} onClick={execute} className="primary-btn mt-5 w-full">
        {status === "signing" ? <LoaderCircle className="animate-spin" size={16} /> : <CircleDollarSign size={16} />}
        {status === "signing" ? "正在更新模拟持仓..." : status === "done" ? "已同步到个人中心" : decision.executedAt ? "该方案已执行" : "确认模拟执行"}
      </button>
      {!wallet && <button onClick={onNeedWallet} className="mt-3 w-full text-center text-[10px] text-[var(--muted)] hover:text-[var(--ink)]">可选：连接钱包查看真实资产</button>}
    </div>
  );
}

type WalletBalance = {
  chain: string;
  symbol: string;
  balance: number;
};

function ProfileView({
  wallet,
  coboConfig,
  onNeedWallet,
  notify,
}: {
  wallet: ConnectedWallet | null;
  coboConfig: CoboRuntimeConfig | null;
  onNeedWallet: () => void;
  notify: (message: string) => void;
}) {
  const [hidden, setHidden] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [mode, setMode] = useState<"simulation" | "wallet">("simulation");
  const [account, setAccount] = useState<SimulationAccount>({
    positions: [{ id: "ethereum-usdc", label: "USD Coin", symbol: "USDC", chain: "Ethereum", value: 10000, costBasis: 10000, rationale: "默认模拟资产与策略结算资金" }],
    transactions: [],
    snapshots: [],
    executedStrategies: [],
  });
  const [cashAction, setCashAction] = useState<"deposit" | "withdraw" | null>(null);
  const [amount, setAmount] = useState("");
  const [walletBalances, setWalletBalances] = useState<WalletBalance[]>([]);
  const [portfolioLoading, setPortfolioLoading] = useState(false);
  const [coboAction, setCoboAction] = useState("transfer");
  const [coboPayloadText, setCoboPayloadText] = useState("{\n  \"symbol\": \"USDC\",\n  \"amount\": 100,\n  \"to\": \"0x...\"\n}");
  const [coboRequestId, setCoboRequestId] = useState("");
  const [coboAuthReady, setCoboAuthReady] = useState(false);
  const [coboAuthorizing, setCoboAuthorizing] = useState(false);
  const [coboExecuting, setCoboExecuting] = useState(false);

  useEffect(() => {
    const refresh = () => setAccount(loadSimulationAccount());
    const timer = window.setTimeout(refresh, 0);
    window.addEventListener("oracle-capital-simulation-updated", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("oracle-capital-simulation-updated", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const persistAccount = (next: SimulationAccount) => {
    setAccount(next);
    saveSimulationAccount(next);
  };

  const totalValue = simulationTotal(account);
  const totalCost = account.positions.reduce((sum, position) => sum + position.costBasis, 0);
  const unrealizedPnl = totalValue - totalCost;
  const usdcValue = account.positions.filter((position) => position.symbol === "USDC").reduce((sum, position) => sum + position.value, 0);
  const investedValue = Math.max(0, totalValue - usdcValue);
  const stableRatio = totalValue ? usdcValue / totalValue * 100 : 0;
  const concentration = totalValue ? Math.max(...account.positions.map((position) => position.value / totalValue * 100), 0) : 0;
  const chainAllocation = (["Ethereum", "BNB Chain", "Solana"] as const).map((chain) => ({
    chain,
    value: account.positions.filter((position) => position.chain === chain).reduce((sum, position) => sum + position.value, 0),
  })).filter((item) => item.value > 0);
  const riskLabel = concentration > 70 && stableRatio < 40 ? "集中度偏高" : stableRatio >= 60 ? "防守型" : "均衡型";
  const trendValues = account.snapshots.length
    ? account.snapshots.slice(-12).map((snapshot) => snapshot.value)
    : [totalValue];
  const trendMin = Math.min(...trendValues, totalValue) * 0.995;
  const trendMax = Math.max(...trendValues, totalValue) * 1.005;
  const trendRange = Math.max(1, trendMax - trendMin);
  const trendPoints = [...trendValues, totalValue].map((value, index, values) => {
    const x = values.length === 1 ? 50 : index / (values.length - 1) * 100;
    const y = 90 - (value - trendMin) / trendRange * 75;
    return `${x},${y}`;
  }).join(" ");

  const saveCashAction = (next: SimulationAccount) => {
    const total = simulationTotal(next);
    next.snapshots = [...next.snapshots, { value: total, createdAt: Date.now() }].slice(-30);
    persistAccount(next);
  };

  const submitCashAction = () => {
    const value = Number(amount);
    if (!cashAction || !Number.isFinite(value) || value <= 0) {
      notify("请输入有效金额");
      return;
    }
    const fee = cashAction === "withdraw" ? value * 0.0001 : 0;
    const required = value + fee;
    if (cashAction === "withdraw" && required > usdcValue) {
      notify("Ethereum USDC 可用余额不足");
      return;
    }
    const positions = account.positions.map((position) => ({ ...position }));
    let usdc = positions.find((position) => position.symbol === "USDC" && position.chain === "Ethereum");
    if (!usdc) {
      usdc = { id: "ethereum-usdc", label: "USD Coin", symbol: "USDC", chain: "Ethereum", value: 0, costBasis: 0, rationale: "模拟盘结算资金" };
      positions.unshift(usdc);
    }
    if (cashAction === "deposit") {
      usdc.value += value;
      usdc.costBasis += value;
    } else {
      usdc.value -= required;
      usdc.costBasis = Math.max(0, usdc.costBasis - required);
    }
    const next: SimulationAccount = {
      ...account,
      positions: positions.filter((position) => position.value > 0.0001),
      transactions: [{
        id: crypto.randomUUID(),
        type: cashAction,
        amount: value,
        fee,
        label: "Ethereum / USDC",
        createdAt: Date.now(),
      }, ...account.transactions].slice(0, 30),
      snapshots: [...account.snapshots],
    };
    saveCashAction(next);
    notify(cashAction === "deposit" ? "USDC 模拟充值成功" : `USDC 模拟提现成功，手续费 $${fee.toFixed(2)}`);
    setAmount("");
    setCashAction(null);
  };

  const resetSimulation = () => {
    const next = defaultSimulationAccount();
    persistAccount(next);
    setCashAction(null);
    setAmount("");
    setShowAll(false);
    notify("模拟盘已恢复初始状态（USDC $10,000）");
  };

  const loadPortfolio = async () => {
    if (!wallet) {
      onNeedWallet();
      return;
    }
    setPortfolioLoading(true);
    try {
      const response = wallet.kind === "cobo"
        ? await fetch("/api/cobo/balance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(coboConfig ? { config: coboConfig } : { configPath: wallet.configPath }),
          cache: "no-store",
        })
        : await fetch(`/api/portfolio?kind=${wallet.kind}&address=${encodeURIComponent(wallet.address)}`, { cache: "no-store" });
      if (!response.ok) {
        const detail = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(detail?.error || "Portfolio API failed");
      }
      const data = await response.json() as { balances: WalletBalance[] };
      setWalletBalances(data.balances);
    } catch (error) {
      const message = error instanceof Error ? error.message : "链上余额读取失败，请稍后重试";
      notify(message);
    } finally {
      setPortfolioLoading(false);
    }
  };

  useEffect(() => {
    if (mode !== "wallet" || !wallet) return;
    const timer = window.setTimeout(() => void loadPortfolio(), 0);
    return () => window.clearTimeout(timer);
    // Wallet identity is sufficient to trigger a refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, wallet?.address, wallet?.configPath, coboConfig]);

  const authorizeCobo = async () => {
    if (!wallet || wallet.kind !== "cobo" || (!coboConfig && !wallet.configPath)) {
      notify("请先连接 Cobo Agent");
      return;
    }
    setCoboAuthorizing(true);
    try {
      const payload = JSON.parse(coboPayloadText) as Record<string, unknown>;
      const response = await fetch("/api/cobo/authorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(coboConfig ? { config: coboConfig } : { configPath: wallet.configPath }),
          operation: { action: coboAction, ...payload },
        }),
      });
      if (!response.ok) throw new Error("Authorize API failed");
      const data = await response.json() as { authorized: boolean; requestId?: string; message?: string };
      if (!data.authorized) throw new Error(data.message || "Authorization rejected");
      setCoboRequestId(data.requestId ?? "");
      setCoboAuthReady(true);
      notify(data.message || "Cobo 授权已确认，可执行操作");
    } catch {
      setCoboAuthReady(false);
      notify("Cobo 授权失败，请检查配置路径和操作参数");
    } finally {
      setCoboAuthorizing(false);
    }
  };

  const executeCobo = async () => {
    if (!wallet || wallet.kind !== "cobo" || (!coboConfig && !wallet.configPath)) {
      notify("请先连接 Cobo Agent");
      return;
    }
    setCoboExecuting(true);
    try {
      const payload = JSON.parse(coboPayloadText) as Record<string, unknown>;
      const response = await fetch("/api/cobo/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(coboConfig ? { config: coboConfig } : { configPath: wallet.configPath }),
          requestId: coboRequestId || undefined,
          operation: { action: coboAction, ...payload },
        }),
      });
      if (!response.ok) throw new Error("Execute API failed");
      const data = await response.json() as { message?: string; txId?: string };
      notify(data.txId ? `Cobo 操作已执行：${data.txId}` : (data.message || "Cobo 操作执行成功"));
      setCoboAuthReady(false);
      await loadPortfolio();
    } catch {
      notify("Cobo 操作执行失败，请确认授权状态和参数");
    } finally {
      setCoboExecuting(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1100px] px-5 py-12 lg:px-10">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
        <div><div className="section-label">个人中心</div><h1 className="mt-3 font-serif text-4xl">资产分析中心</h1><p className="mt-2 text-xs text-[var(--muted)]">{mode === "simulation" ? "模拟账户默认以 Ethereum USDC 结算，并与 AI 方案模拟执行实时联动。" : "真实资产直接从已连接钱包的公开链上余额读取。"}</p></div>
        <button onClick={() => setHidden(!hidden)} className="secondary-btn">{hidden ? "显示资产" : "隐藏资产"}</button>
      </div>
      <div className="mt-7 inline-flex rounded-full border border-[var(--line)] bg-[var(--panel)] p-1">
        <button onClick={() => setMode("simulation")} className={`rounded-full px-5 py-2 text-xs ${mode === "simulation" ? "bg-[var(--green)] text-[var(--bg)]" : "text-[var(--muted)]"}`}>模拟盘</button>
        <button onClick={() => setMode("wallet")} className={`rounded-full px-5 py-2 text-xs ${mode === "wallet" ? "bg-[var(--green)] text-[var(--bg)]" : "text-[var(--muted)]"}`}>真实钱包</button>
      </div>

      {mode === "simulation" ? <>
      <div className="mt-8 rounded-2xl border border-[var(--line)] bg-[var(--green)] p-6 text-[var(--bg)] shadow-xl">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div><div className="text-[10px] tracking-[0.18em] opacity-70">SIMULATION PORTFOLIO</div><div className={`mt-3 font-serif text-5xl ${hidden ? "blur-md select-none" : ""}`}>${totalValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div><div className="mt-2 text-xs opacity-70">总资产 · 默认结算资产 Ethereum / USDC</div></div>
          <div className="grid grid-cols-2 gap-6 text-xs md:grid-cols-3"><div><span className="opacity-60">可用 USDC</span><strong className="mt-1 block text-base">${usdcValue.toLocaleString("en-US", { maximumFractionDigits: 2 })}</strong></div><div><span className="opacity-60">已投入策略</span><strong className="mt-1 block text-base">${investedValue.toLocaleString("en-US", { maximumFractionDigits: 2 })}</strong></div><div><span className="opacity-60">未实现盈亏</span><strong className="mt-1 block text-base">{unrealizedPnl >= 0 ? "+" : ""}${unrealizedPnl.toFixed(2)}</strong></div></div>
        </div>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[["资金利用率", `${totalValue ? (investedValue / totalValue * 100).toFixed(1) : "0.0"}%`, "非 USDC 策略仓位"], ["稳定币占比", `${stableRatio.toFixed(1)}%`, "Ethereum USDC"], ["最大仓位", `${concentration.toFixed(1)}%`, riskLabel], ["最近共识", account.lastStrategy ? `${account.lastStrategy.consensusRate}%` : "—", account.lastStrategy ? `${account.lastStrategy.title} · $${account.lastStrategy.amount.toLocaleString("en-US", { maximumFractionDigits: 2 })}` : "尚未执行 AI 方案"]].map(([label, value, note]) => <div key={label} className="stat-card"><div className="text-xs text-[var(--muted)]">{label}</div><div className="mt-3 font-serif text-3xl">{value}</div><div className="mt-2 truncate text-[10px] text-[var(--positive)]">{note}</div></div>)}
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <button onClick={() => setCashAction("deposit")} className="stat-card flex items-center gap-4 text-left"><span className="grid h-12 w-12 place-items-center rounded-full bg-[var(--wash)]"><ArrowDownToLine size={20} /></span><span><strong>模拟充值</strong><span className="mt-1 block text-xs text-[var(--muted)]">即时增加模拟盘可用余额</span></span></button>
        <button onClick={() => setCashAction("withdraw")} className="stat-card flex items-center gap-4 text-left"><span className="grid h-12 w-12 place-items-center rounded-full bg-[var(--wash)]"><ArrowUpFromLine size={20} /></span><span><strong>USDC 提现</strong><span className="mt-1 block text-xs text-[var(--muted)]">从 Ethereum USDC 扣款，手续费 0.01%</span></span></button>
        <button onClick={resetSimulation} className="stat-card flex items-center gap-4 text-left"><span className="grid h-12 w-12 place-items-center rounded-full bg-[var(--wash)]"><RefreshCw size={20} /></span><span><strong>一键恢复</strong><span className="mt-1 block text-xs text-[var(--muted)]">恢复初始资产：Ethereum USDC $10,000</span></span></button>
      </div>
      {cashAction && <div className="mt-4 plan-card"><div className="flex items-center justify-between"><div><div className="section-label">{cashAction === "deposit" ? "模拟充值" : "模拟提现"}</div><h2 className="mt-2 font-serif text-2xl">输入金额</h2></div><button onClick={() => setCashAction(null)} className="icon-btn"><X size={16} /></button></div><div className="mt-5 flex gap-2"><input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder="0.00 USD" className="min-w-0 flex-1 rounded-full border border-[var(--line)] bg-transparent px-5 text-sm outline-none" /><button onClick={submitCashAction} className="primary-btn">确认{cashAction === "deposit" ? "充值" : "提现"}</button></div>{cashAction === "withdraw" && <p className="mt-3 text-xs text-[var(--muted)]">预计手续费：${((Number(amount) || 0) * 0.0001).toFixed(4)}，到账金额：${Math.max(0, (Number(amount) || 0)).toFixed(2)}</p>}</div>}
      <div className="mt-4 grid gap-4 lg:grid-cols-[1.25fr_.75fr]">
        <div className="stat-card">
          <div className="flex items-center justify-between"><div><h2 className="font-serif text-xl">组合净值轨迹</h2><p className="mt-1 text-[10px] text-[var(--muted)]">充值、提现和策略执行节点</p></div><span className="text-xs text-[var(--muted)]">{account.snapshots.length} 个数据点</span></div>
          <div className="mt-8 h-56 rounded-xl bg-[var(--panel-soft)] p-4"><svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full overflow-visible"><line x1="0" y1="90" x2="100" y2="90" stroke="var(--line)" strokeWidth="0.5" /><line x1="0" y1="52" x2="100" y2="52" stroke="var(--line)" strokeWidth="0.5" /><polyline points={trendPoints} fill="none" stroke="var(--green)" strokeWidth="2.2" vectorEffect="non-scaling-stroke" /></svg></div>
        </div>
        <div className="stat-card">
          <h2 className="font-serif text-xl">链与风险分析</h2>
          <div className="mt-6 space-y-5">{chainAllocation.map((item) => { const percentage = totalValue ? item.value / totalValue * 100 : 0; return <div key={item.chain}><div className="mb-2 flex justify-between text-xs"><span>{item.chain}</span><span>{percentage.toFixed(1)}%</span></div><div className="h-1.5 overflow-hidden rounded-full bg-[var(--wash)]"><div className="h-full bg-[var(--green)]" style={{ width: `${percentage}%` }} /></div></div>; })}</div>
          <div className="mt-6 border-t border-[var(--line)] pt-5 text-xs leading-6"><div className="flex justify-between"><span className="text-[var(--muted)]">组合类型</span><strong>{riskLabel}</strong></div><div className="flex justify-between"><span className="text-[var(--muted)]">活跃网络</span><strong>{chainAllocation.length}</strong></div><div className="flex justify-between"><span className="text-[var(--muted)]">策略风险</span><strong>{account.lastStrategy?.riskLevel ?? "稳健"}</strong></div></div>
        </div>
      </div>
      <div className="mt-4 stat-card">
        <div className="flex items-center justify-between"><div><h2 className="font-serif text-xl">已执行方案</h2><p className="mt-1 text-[10px] text-[var(--muted)]">与模拟持仓分开展示，便于复盘</p></div><span className="rounded-full bg-[var(--wash)] px-3 py-1 text-[10px]">{account.executedStrategies.length} 次执行</span></div>
        <div className="mt-5 divide-y divide-[var(--line)]">
          {account.executedStrategies.length ? account.executedStrategies.map((strategy) => (
            <div key={strategy.id} className="py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <strong className="text-sm">{strategy.title}</strong>
                <span className="text-[10px] text-[var(--muted)]">{new Date(strategy.createdAt).toLocaleString("zh-CN")}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-[var(--muted)]">
                <span>投入 ${strategy.amount.toLocaleString("en-US", { maximumFractionDigits: 2 })}</span>
                <span>共识率 {strategy.consensusRate}%</span>
                <span>风险 {strategy.riskLevel}</span>
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {strategy.allocations.map((item) => (
                  <div key={`${strategy.id}-${item.label}`} className="rounded-lg bg-[var(--panel-soft)] p-3 text-xs">
                    <div className="flex justify-between">
                      <span>{item.label}</span>
                      <span>{item.percentage}%</span>
                    </div>
                    <div className="mt-1 text-[10px] text-[var(--muted)]">${item.amount.toLocaleString("en-US", { maximumFractionDigits: 2 })}</div>
                  </div>
                ))}
              </div>
            </div>
          )) : <p className="py-5 text-sm text-[var(--muted)]">暂无执行记录。先在对话中确认一次模拟执行。</p>}
        </div>
      </div>
      <div className="mt-4 stat-card">
        <div className="flex items-center justify-between"><div><h2 className="font-serif text-xl">模拟持仓明细</h2><p className="mt-1 text-[10px] text-[var(--muted)]">AI 方案执行后自动更新</p></div><span className="rounded-full bg-[var(--wash)] px-3 py-1 text-[10px]">{account.positions.length} 项资产</span></div>
        <div className="mt-5 overflow-x-auto"><div className="min-w-[760px]"><div className="grid grid-cols-[1.3fr_.8fr_.8fr_.8fr_1.1fr_1.3fr] border-b border-[var(--line)] pb-3 text-[10px] text-[var(--muted)]"><span>资产</span><span>网络</span><span>价值</span><span>占比</span><span>来源策略</span><span>配置逻辑</span></div>{[...account.positions].sort((a, b) => b.value - a.value).map((position) => <div key={position.id} className="grid grid-cols-[1.3fr_.8fr_.8fr_.8fr_1.1fr_1.3fr] items-center border-b border-[var(--line)] py-4 text-xs last:border-0"><div><strong>{position.symbol}</strong><span className="mt-1 block text-[10px] text-[var(--muted)]">{position.label}</span></div><span>{position.chain}</span><span>${position.value.toLocaleString("en-US", { maximumFractionDigits: 2 })}</span><span>{totalValue ? (position.value / totalValue * 100).toFixed(1) : "0.0"}%</span><span className="truncate text-[10px] text-[var(--muted)]">{position.sourceStrategy ? `${position.sourceStrategy}${position.sourceExecutedAt ? ` · ${new Date(position.sourceExecutedAt).toLocaleDateString("zh-CN")}` : ""}` : "初始资金"}</span><span className="truncate text-[10px] text-[var(--muted)]">{position.rationale}</span></div>)}</div></div>
      </div>
      <div className="mt-4 stat-card">
        <div className="flex items-center justify-between"><h2 className="font-serif text-xl">模拟资金流水</h2><button onClick={() => setShowAll(!showAll)} className="text-xs text-[var(--green)]">{showAll ? "收起" : "查看全部"}</button></div>
        <div className="mt-5 divide-y divide-[var(--line)]">
          {account.transactions.length ? account.transactions.slice(0, showAll ? account.transactions.length : 4).map((item) => <div key={item.id} className="flex items-center gap-4 py-4 text-sm"><span className="text-[var(--green)]">{item.type === "deposit" ? <ArrowDownToLine size={16} /> : item.type === "withdraw" ? <ArrowUpFromLine size={16} /> : <Sparkles size={16} />}</span><span className="flex-1">{item.type === "deposit" ? "USDC 模拟充值" : item.type === "withdraw" ? "USDC 模拟提现" : `执行策略：${item.label ?? "AI 方案"}`}</span><span className="text-xs text-[var(--muted)]">{new Date(item.createdAt).toLocaleString("zh-CN")}</span><span className="w-28 text-right text-xs">{item.type === "deposit" ? "+" : item.type === "withdraw" ? "-" : ""}${item.amount.toFixed(2)}{item.fee > 0 ? ` · 费 $${item.fee.toFixed(2)}` : ""}</span></div>) : <p className="py-5 text-sm text-[var(--muted)]">暂无流水。默认资产为 Ethereum USDC $10,000。</p>}
        </div>
      </div>
      </> : <>
        <div className="mt-8 plan-card">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><div className="section-label">真实链上钱包</div><h2 className="mt-2 font-serif text-2xl">{wallet ? `${wallet.label} ${shortAddress(wallet.address)}` : "尚未连接钱包"}</h2><p className="mt-2 text-[10px] text-[var(--muted)]">{wallet?.kind === "cobo" ? `Hermes Agent: ${coboConfig?.baseUrl ?? wallet.endpoint ?? "未记录"}` : "浏览器插件钱包模式"}</p></div>{wallet ? <button onClick={() => void loadPortfolio()} disabled={portfolioLoading} className="secondary-btn"><RefreshCw className={portfolioLoading ? "animate-spin" : ""} size={15} />刷新余额</button> : <button onClick={onNeedWallet} className="primary-btn"><Wallet size={15} />连接钱包</button>}</div>
          {wallet && <div className="mt-6 grid gap-3 md:grid-cols-2">{walletBalances.length ? walletBalances.map((balance) => <div key={`${balance.chain}-${balance.symbol}`} className="rounded-xl bg-[var(--panel-soft)] p-4"><div className="text-xs text-[var(--muted)]">{balance.chain}</div><div className={`mt-2 font-mono text-2xl ${hidden ? "blur-md select-none" : ""}`}>{balance.balance.toLocaleString("en-US", { maximumFractionDigits: 6 })} {balance.symbol}</div></div>) : <div className="text-sm text-[var(--muted)]">{portfolioLoading ? "正在读取链上余额..." : "点击刷新读取余额"}</div>}</div>}
        </div>
        {wallet?.kind === "cobo" && (
          <div className="mt-4 plan-card">
            <div className="section-label">COBO AGENT OPERATION</div>
            <h3 className="mt-2 font-serif text-2xl">授权与执行</h3>
            <p className="mt-2 text-xs text-[var(--muted)]">先请求授权，再确认执行。操作将通过后端代理发送到 Hermes 上的 Cobo Agent。</p>
            <div className="mt-4 grid gap-3 md:grid-cols-[.7fr_1.3fr]">
              <input value={coboAction} onChange={(event) => setCoboAction(event.target.value)} placeholder="operation action，例如 transfer" className="rounded-xl border border-[var(--line)] bg-transparent px-4 py-3 text-sm outline-none focus:border-[var(--green)]" />
              <textarea value={coboPayloadText} onChange={(event) => setCoboPayloadText(event.target.value)} rows={5} className="rounded-xl border border-[var(--line)] bg-transparent px-4 py-3 font-mono text-xs outline-none focus:border-[var(--green)]" />
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button onClick={() => void authorizeCobo()} disabled={coboAuthorizing || coboExecuting} className="secondary-btn flex-1">
                {coboAuthorizing ? <LoaderCircle className="animate-spin" size={15} /> : <ShieldCheck size={15} />}
                {coboAuthorizing ? "授权中..." : "1) 请求授权"}
              </button>
              <button onClick={() => void executeCobo()} disabled={!coboAuthReady || coboExecuting} className="primary-btn flex-1">
                {coboExecuting ? <LoaderCircle className="animate-spin" size={15} /> : <CircleDollarSign size={15} />}
                {coboExecuting ? "执行中..." : "2) 确认授权并执行"}
              </button>
            </div>
            <p className="mt-2 text-[10px] text-[var(--muted)]">{coboAuthReady ? `已完成授权${coboRequestId ? `，请求号：${coboRequestId}` : ""}` : "尚未授权。请先完成第 1 步。"}</p>
          </div>
        )}
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="stat-card"><ArrowDownToLine className="text-[var(--gold)]" /><h3 className="mt-5 font-serif text-xl">真实充值</h3><p className="mt-2 text-xs leading-6 text-[var(--muted)]">{wallet ? `从交易所或其他钱包转账到：${shortAddress(wallet.address)}` : "连接钱包后显示你的链上收款地址。"}</p>{wallet && <button onClick={() => { void navigator.clipboard?.writeText(wallet.address); notify("收款地址已复制"); }} className="secondary-btn mt-5 w-full">复制收款地址</button>}</div>
          <div className="stat-card"><ArrowUpFromLine className="text-[var(--gold)]" /><h3 className="mt-5 font-serif text-xl">真实提现</h3><p className="mt-2 text-xs leading-6 text-[var(--muted)]">非托管模式下，资产始终在你的钱包里，可随时通过钱包发送。平台尚未部署可审计的收费金库，因此不会伪造收取 0.01% 手续费。</p><button onClick={() => notify("真实收费提现需要部署审计金库合约后启用")} className="secondary-btn mt-5 w-full">金库通道待启用</button></div>
        </div>
      </>}
    </div>
  );
}

function DeveloperApiModal({
  current,
  onClose,
  onSave,
  onRemove,
}: {
  current: CustomApiConfig | null;
  onClose: () => void;
  onSave: (config: CustomApiConfig) => void;
  onRemove: () => void;
}) {
  const [endpoint, setEndpoint] = useState(current?.endpoint ?? "https://api.deepseek.com/chat/completions");
  const [model, setModel] = useState(current?.model ?? "deepseek-chat");
  const [apiKey, setApiKey] = useState(current?.apiKey ?? "");
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    try {
      const url = new URL(endpoint.trim());
      if (url.protocol !== "https:") throw new Error("接口必须使用 HTTPS");
      if (!apiKey.trim() || !model.trim()) throw new Error("请填写 API Key 和模型名称");
      const config = { endpoint: url.toString(), apiKey: apiKey.trim(), model: model.trim() };
      setSaving(true);
      await saveEncryptedApiConfig(config);
      onSave(config);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "API 配置保存失败");
    } finally {
      setSaving(false);
    }
  };

  const remove = () => {
    window.localStorage.removeItem(apiConfigStorageKey);
    onRemove();
  };

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/45 p-4 backdrop-blur-sm">
      <button onClick={onClose} aria-label="关闭开发者 API" className="absolute inset-0 cursor-default" />
      <form onSubmit={save} className="relative z-10 w-full max-w-xl rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div><div className="section-label"><Code2 size={14} /> 开发者 API</div><h2 className="mt-3 font-serif text-3xl">使用你自己的 AI 接口</h2><p className="mt-2 text-xs leading-6 text-[var(--muted)]">支持 OpenAI Chat Completions 兼容接口。配置只在当前浏览器保存。</p></div>
          <button type="button" onClick={onClose} className="icon-btn" aria-label="关闭"><X size={16} /></button>
        </div>

        <div className="mt-6 rounded-xl border border-[var(--line)] bg-[var(--panel-soft)] p-4">
          <div className="flex items-center gap-2 text-xs font-semibold"><LockKeyhole size={15} className="text-[var(--gold)]" />AES-GCM 本地加密</div>
          <p className="mt-2 text-[10px] leading-5 text-[var(--muted)]">API Key 不写入源码、URL、GitHub 或服务端数据库。加密密钥不可导出并保存在 IndexedDB；密文保存在本地存储。浏览器被恶意扩展或 XSS 控制时，任何前端方案都无法保证绝对不可提取。</p>
        </div>

        <label className="mt-5 block text-xs font-semibold">API 地址
          <input value={endpoint} onChange={(event) => setEndpoint(event.target.value)} placeholder="https://api.deepseek.com/chat/completions" className="mt-2 h-12 w-full rounded-xl border border-[var(--line)] bg-transparent px-4 font-mono text-xs outline-none focus:border-[var(--green)]" />
        </label>
        <label className="mt-4 block text-xs font-semibold">模型
          <input value={model} onChange={(event) => setModel(event.target.value)} placeholder="deepseek-chat" className="mt-2 h-12 w-full rounded-xl border border-[var(--line)] bg-transparent px-4 font-mono text-xs outline-none focus:border-[var(--green)]" />
        </label>
        <label className="mt-4 block text-xs font-semibold">API Key
          <div className="relative mt-2">
            <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={15} />
            <input value={apiKey} onChange={(event) => setApiKey(event.target.value)} type={showKey ? "text" : "password"} autoComplete="off" placeholder="sk-..." className="h-12 w-full rounded-xl border border-[var(--line)] bg-transparent pl-11 pr-12 font-mono text-xs outline-none focus:border-[var(--green)]" />
            <button type="button" onClick={() => setShowKey((value) => !value)} className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center text-[var(--muted)]" aria-label={showKey ? "隐藏 API Key" : "显示 API Key"}>{showKey ? <EyeOff size={16} /> : <Eye size={16} />}</button>
          </div>
        </label>
        {error && <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-500">{error}</div>}
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <button type="submit" disabled={saving} className="primary-btn flex-1">{saving ? <LoaderCircle className="animate-spin" size={15} /> : <Check size={15} />}{saving ? "正在加密..." : "加密保存并启用"}</button>
          {current && <button type="button" onClick={remove} className="secondary-btn text-red-500"><Trash2 size={15} />移除配置</button>}
        </div>
      </form>
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
  onConnect: (wallet: ConnectedWallet, coboConfig?: CoboRuntimeConfig) => void;
  onDisconnect: () => void;
  notify: (message: string) => void;
}) {
  const [connecting, setConnecting] = useState("");
  const [coboBaseUrl, setCoboBaseUrl] = useState("https://api.agenticwallet.cobo.com");
  const [coboApiKey, setCoboApiKey] = useState("");
  const [coboWalletId, setCoboWalletId] = useState("");
  const [coboPath, setCoboPath] = useState("");
  const [coboError, setCoboError] = useState("");
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
  const connectCobo = async () => {
    if (!coboBaseUrl.trim()) {
      setCoboError("请填写 Hermes/Cobo Agent 地址");
      return;
    }
    setCoboError("");
    setConnecting("Cobo");
    try {
      const config: CoboRuntimeConfig = {
        name: "Cobo Agent",
        baseUrl: coboBaseUrl.trim(),
        apiKey: coboApiKey.trim() || undefined,
        walletId: coboWalletId.trim() || undefined,
      };
      const response = await fetch("/api/cobo/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      });
      const data = await response.json() as {
        error?: string;
        wallet?: { kind: "cobo"; label: string; address: string; endpoint: string };
        message?: string;
      };
      if (!response.ok || !data.wallet) throw new Error(data.error || "Cobo connection failed");
      onConnect(data.wallet, config);
      setConnecting("");
      notify(data.message || "Cobo Agent 已连接");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Cobo 连接失败";
      setCoboError(message);
      notify("Cobo 连接失败，请检查 Hermes 地址和配置参数");
      setConnecting("");
    }
  };

  const connectCoboByPath = async () => {
    if (!coboPath.trim()) {
      setCoboError("请输入 Cobo 配置文件路径");
      return;
    }
    setCoboError("");
    setConnecting("CoboPath");
    try {
      const response = await fetch("/api/cobo/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ configPath: coboPath.trim() }),
      });
      const data = await response.json() as {
        error?: string;
        wallet?: { kind: "cobo"; label: string; address: string; endpoint: string; configPath?: string };
        message?: string;
      };
      if (!response.ok || !data.wallet) throw new Error(data.error || "Cobo connection failed");
      onConnect(data.wallet);
      setConnecting("");
      notify(data.message || "Cobo Agent 已连接");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Cobo 连接失败";
      setCoboError(message);
      notify("Cobo 连接失败，请检查配置路径与 Hermes Agent");
      setConnecting("");
    }
  };
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-[var(--panel)] p-6 shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between"><div><div className="section-label">钱包登录</div><h2 className="mt-2 font-serif text-2xl">{connected ? "钱包已连接" : "连接到追光者"}</h2></div><button onClick={onClose} className="icon-btn"><X size={17} /></button></div>
        <p className="mt-3 text-xs leading-5 text-[var(--muted)]">支持浏览器插件钱包和 Cobo Hermes Agent。真实执行前仍需明确授权确认。</p>
        {connected ? (
          <div className="mt-6">
            <div className="rounded-xl bg-[var(--panel-soft)] p-4"><div className="text-xs text-[var(--muted)]">{connected.label}</div><div className="mt-2 font-mono text-sm">{shortAddress(connected.address)}</div>{connected.kind === "cobo" && connected.endpoint && <div className="mt-1 text-[10px] text-[var(--muted)]">{connected.endpoint}</div>}</div>
            <button onClick={onDisconnect} className="secondary-btn mt-4 w-full">断开钱包</button>
          </div>
        ) : <div className="mt-6 space-y-2">
          <button disabled={Boolean(connecting)} onClick={connectEvm} className="topic-row"><Wallet size={17} /><span className="flex-1 text-left">MetaMask / EVM 钱包</span>{connecting === "MetaMask" ? <LoaderCircle className="animate-spin" size={15} /> : <ArrowRight size={15} />}</button>
          <button disabled={Boolean(connecting)} onClick={connectPhantom} className="topic-row"><Wallet size={17} /><span className="flex-1 text-left">Phantom / Solana</span>{connecting === "Phantom" ? <LoaderCircle className="animate-spin" size={15} /> : <ArrowRight size={15} />}</button>
          <div className="rounded-xl border border-[var(--line)] p-3">
            <div className="text-[10px] font-semibold tracking-[0.15em] text-[var(--muted)]">COBO / HERMES AGENT</div>
            <input value={coboBaseUrl} onChange={(event) => setCoboBaseUrl(event.target.value)} placeholder="Hermes Agent URL，例如 http://127.0.0.1:8787" className="mt-2 h-10 w-full rounded-lg border border-[var(--line)] bg-transparent px-3 text-xs outline-none focus:border-[var(--green)]" />
            <input type="password" value={coboApiKey} onChange={(event) => setCoboApiKey(event.target.value)} placeholder="API Key" className="mt-2 h-10 w-full rounded-lg border border-[var(--line)] bg-transparent px-3 text-xs outline-none focus:border-[var(--green)]" />
            <input value={coboWalletId} onChange={(event) => setCoboWalletId(event.target.value)} placeholder="Wallet ID" className="mt-2 h-10 w-full rounded-lg border border-[var(--line)] bg-transparent px-3 text-xs outline-none focus:border-[var(--green)]" />
            {coboError && <p className="mt-2 text-[10px] text-red-500">{coboError}</p>}
            <button disabled={Boolean(connecting)} onClick={() => void connectCobo()} className="secondary-btn mt-2 w-full">
              {connecting === "Cobo" ? <LoaderCircle className="animate-spin" size={15} /> : <ShieldCheck size={15} />}
              {connecting === "Cobo" ? "连接中..." : "填写信息并自动连接"}
            </button>
            <div className="mt-3 border-t border-[var(--line)] pt-3">
              <div className="text-[10px] text-[var(--muted)]">高级：通过配置路径连接</div>
              <input value={coboPath} onChange={(event) => setCoboPath(event.target.value)} placeholder="例如 D:\\Hermes\\cobo.json" className="mt-2 h-10 w-full rounded-lg border border-[var(--line)] bg-transparent px-3 text-xs outline-none focus:border-[var(--green)]" />
              <button disabled={Boolean(connecting)} onClick={() => void connectCoboByPath()} className="secondary-btn mt-2 w-full">
                {connecting === "CoboPath" ? <LoaderCircle className="animate-spin" size={15} /> : <ArrowRight size={15} />}
                {connecting === "CoboPath" ? "连接中..." : "按路径连接"}
              </button>
            </div>
          </div>
          <button onClick={() => notify("WalletConnect 需要项目 ID，下一阶段接入")} className="topic-row"><Wallet size={17} /><span className="flex-1 text-left">WalletConnect</span><ArrowRight size={15} /></button>
        </div>}
        <div className="mt-5 flex items-start gap-2 text-[10px] leading-4 text-[var(--muted)]"><ShieldCheck size={14} className="mt-0.5 shrink-0" />黑客松演示模式：优先使用网页输入信息自动连接；密钥仅在当前会话内使用，不会写入配置文件。</div>
      </div>
    </div>
  );
}
