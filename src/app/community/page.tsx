"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Award,
  Download,
  Heart,
  MessageCircle,
  Search,
  ShieldCheck,
  Upload,
  Users,
  X,
} from "lucide-react";

type CommunityMaster = {
  id: string;
  name: string;
  en: string;
  school: string;
  quote: string;
  risk: "稳健" | "均衡" | "激进";
  uses: number;
  author: string;
  description: string;
};

const officialMasters: CommunityMaster[] = [
  { id: "buffett", name: "沃伦·巴菲特", en: "Warren Buffett", school: "价值投资", quote: "价格是你付出的，价值是你得到的。", risk: "稳健", uses: 18640, author: "Oracle Capital", description: "强调护城河、现金流、估值与长期复利。" },
  { id: "munger", name: "查理·芒格", en: "Charlie Munger", school: "多元思维", quote: "先避开愚蠢，再寻找聪明。", risk: "稳健", uses: 12380, author: "Oracle Capital", description: "使用跨学科心智模型识别激励、偏见与风险。" },
  { id: "lynch", name: "彼得·林奇", en: "Peter Lynch", school: "成长价值", quote: "投资你真正理解的事物。", risk: "均衡", uses: 8940, author: "Oracle Capital", description: "寻找用户能理解、仍处于成长阶段的优质资产。" },
  { id: "marx", name: "卡尔·马克思", en: "Karl Marx", school: "资本结构", quote: "穿透收益，审视资本关系。", risk: "均衡", uses: 7420, author: "Oracle Capital", description: "从资本结构、分配关系和周期矛盾分析市场。" },
  { id: "keynes", name: "约翰·凯恩斯", en: "John Maynard Keynes", school: "宏观周期", quote: "市场保持非理性的时间可能更久。", risk: "均衡", uses: 6910, author: "Oracle Capital", description: "聚焦流动性、政策、预期和宏观周期变化。" },
  { id: "hayek", name: "弗里德里希·哈耶克", en: "Friedrich Hayek", school: "货币竞争", quote: "价格是分散知识的信号。", risk: "激进", uses: 5180, author: "Oracle Capital", description: "从价格发现、去中心化知识和货币竞争观察 Web3。" },
  { id: "smith", name: "亚当·斯密", en: "Adam Smith", school: "市场机制", quote: "长期价值来自分工与交换。", risk: "稳健", uses: 4650, author: "Oracle Capital", description: "研究分工、激励、交换效率和网络价值。" },
  { id: "newton", name: "艾萨克·牛顿", en: "Isaac Newton", school: "量化周期", quote: "用规律观察市场，也敬畏疯狂。", risk: "均衡", uses: 3760, author: "Oracle Capital", description: "用数学规律和周期观察价格，同时警惕非理性泡沫。" },
];

const isCommunityMaster = (value: unknown): value is CommunityMaster => {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<CommunityMaster>;
  return ["id", "name", "en", "school", "quote", "author", "description"].every((key) => typeof item[key as keyof CommunityMaster] === "string")
    && typeof item.uses === "number"
    && ["稳健", "均衡", "激进"].includes(item.risk ?? "");
};

export default function CommunityPage() {
  const [localMasters, setLocalMasters] = useState<CommunityMaster[]>([]);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [likedMasters, setLikedMasters] = useState<string[]>([]);
  const [comments, setComments] = useState<Record<string, string[]>>({});
  const [commentMaster, setCommentMaster] = useState<CommunityMaster | null>(null);
  const [commentDraft, setCommentDraft] = useState("");

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("oracle-capital-theme");
    document.documentElement.dataset.theme = savedTheme === "dark" ? "dark" : "light";
    const timer = window.setTimeout(() => {
      const raw = window.localStorage.getItem("oracle-capital-community-masters");
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as unknown[];
          setLocalMasters(parsed.filter(isCommunityMaster));
        } catch {
          window.localStorage.removeItem("oracle-capital-community-masters");
        }
      }
      try {
        setLikedMasters(JSON.parse(window.localStorage.getItem("oracle-capital-master-likes") ?? "[]") as string[]);
        setComments(JSON.parse(window.localStorage.getItem("oracle-capital-master-comments") ?? "{}") as Record<string, string[]>);
      } catch {
        window.localStorage.removeItem("oracle-capital-master-likes");
        window.localStorage.removeItem("oracle-capital-master-comments");
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const allMasters = useMemo(() => [...officialMasters, ...localMasters], [localMasters]);
  const ranking = useMemo(() => [...allMasters].sort((a, b) => b.uses - a.uses), [allMasters]);
  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return allMasters;
    return allMasters.filter((master) => [master.name, master.en, master.school, master.author, master.description]
      .some((field) => field.toLowerCase().includes(keyword)));
  }, [allMasters, search]);

  const downloadMaster = (master: CommunityMaster) => {
    const blob = new Blob([JSON.stringify(master, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${master.id}.oracle-master.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const uploadMaster = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      if (!isCommunityMaster(parsed)) throw new Error("Invalid master package");
      const imported = { ...parsed, id: `${parsed.id}-${Date.now()}`, uses: Math.max(0, parsed.uses) };
      const next = [imported, ...localMasters].slice(0, 30);
      setLocalMasters(next);
      window.localStorage.setItem("oracle-capital-community-masters", JSON.stringify(next));
      setMessage(`已上传人物：${imported.name}`);
    } catch {
      setMessage("上传失败：请选择有效的 Oracle 人物 JSON 文件");
    }
  };

  const toggleLike = (masterId: string) => {
    setLikedMasters((current) => {
      const next = current.includes(masterId) ? current.filter((id) => id !== masterId) : [...current, masterId];
      window.localStorage.setItem("oracle-capital-master-likes", JSON.stringify(next));
      return next;
    });
  };

  const submitComment = (event: FormEvent) => {
    event.preventDefault();
    const value = commentDraft.trim();
    if (!commentMaster || !value) return;
    setComments((current) => {
      const next = { ...current, [commentMaster.id]: [...(current[commentMaster.id] ?? []), value].slice(-30) };
      window.localStorage.setItem("oracle-capital-master-comments", JSON.stringify(next));
      return next;
    });
    setCommentDraft("");
  };

  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <header className="sticky top-0 z-30 border-b border-[var(--line)] bg-[var(--bg-glass)] backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-[1200px] items-center justify-between px-5 lg:px-10">
          <Link href="/" className="flex items-center gap-2 font-serif text-lg"><ArrowLeft size={17} />追光者</Link>
          <nav className="flex items-center gap-5 text-sm"><Link href="/market" className="text-[var(--muted)]">市场</Link><span>社区</span><Link href="/" className="primary-btn">选择人物</Link></nav>
        </div>
      </header>

      <section className="hero-glow mx-auto max-w-[1200px] px-5 py-14 lg:px-10">
        <div className="section-label"><Award size={14} /> COMMUNITY RANKINGS</div>
        <h1 className="mt-4 font-serif text-4xl md:text-6xl">人物社区</h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--muted)]">发现、分享和下载不同投资思想人物。排行榜按累计使用次数排列。</p>

        <div className="mt-9 grid gap-3 md:grid-cols-3">
          {ranking.slice(0, 3).map((master, index) => (
            <article key={master.id} className="stat-card relative overflow-hidden">
              <span className="absolute right-4 top-3 font-serif text-5xl text-[var(--wash)]">0{index + 1}</span>
              <div className="section-label">TOP {index + 1}</div>
              <h2 className="mt-5 font-serif text-2xl">{master.name}</h2>
              <p className="mt-1 text-xs text-[var(--muted)]">{master.school} · {master.author}</p>
              <div className="mt-6 text-2xl font-semibold">{master.uses.toLocaleString()} <span className="text-xs font-normal text-[var(--muted)]">次使用</span></div>
            </article>
          ))}
        </div>

        <div className="mt-5 overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel)]">
          {ranking.slice(3, 8).map((master, index) => <div key={master.id} className="grid grid-cols-[44px_1fr_auto] items-center gap-3 border-b border-[var(--line)] p-4 last:border-0"><span className="font-serif text-lg">{index + 4}</span><div><strong className="text-sm">{master.name}</strong><p className="mt-1 text-[10px] text-[var(--muted)]">{master.school}</p></div><span className="text-xs text-[var(--muted)]">{master.uses.toLocaleString()} 次</span></div>)}
        </div>
      </section>

      <section className="border-t border-[var(--line)] bg-[var(--panel-soft)]">
        <div className="mx-auto max-w-[1200px] px-5 py-14 lg:px-10">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div><div className="section-label"><Users size={14} /> 人物市场</div><h2 className="mt-3 font-serif text-3xl">浏览与分享人物</h2></div>
            <label className="primary-btn cursor-pointer"><Upload size={15} />上传人物<input onChange={(event) => void uploadMaster(event)} type="file" accept="application/json,.json" className="hidden" /></label>
          </div>
          {message && <div className="mt-5 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3 text-xs">{message}</div>}
          <div className="relative mt-7 max-w-xl">
            <Search className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={16} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索人物、作者或投资流派" className="h-12 w-full rounded-full border border-[var(--line)] bg-[var(--panel)] pl-12 pr-5 text-sm outline-none focus:border-[var(--green)]" />
          </div>
          <div className="mt-7 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((master) => (
              <article key={master.id} className="stat-card">
                <div className="flex items-center justify-between"><span className="rounded-full bg-[var(--wash)] px-3 py-1 text-[10px]">{master.school}</span><span className="text-[10px] text-[var(--muted)]">{master.risk}</span></div>
                <h3 className="mt-5 font-serif text-2xl">{master.name}</h3>
                <p className="mt-1 text-[10px] uppercase tracking-wider text-[var(--muted)]">{master.en}</p>
                <p className="mt-4 min-h-12 text-xs leading-6 text-[var(--muted)]">{master.description}</p>
                <p className="mt-4 border-l-2 border-[var(--gold)] pl-3 text-xs italic leading-5">“{master.quote}”</p>
                <div className="mt-5 flex items-center gap-2">
                  <button onClick={() => toggleLike(master.id)} className={`secondary-btn flex-1 px-3 ${likedMasters.includes(master.id) ? "border-red-500/40 text-red-500" : ""}`}><Heart fill={likedMasters.includes(master.id) ? "currentColor" : "none"} size={14} />{master.uses % 97 + (likedMasters.includes(master.id) ? 1 : 0)}</button>
                  <button onClick={() => setCommentMaster(master)} className="secondary-btn flex-1 px-3"><MessageCircle size={14} />{comments[master.id]?.length ?? 0}</button>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-[var(--line)] pt-4"><div className="text-[10px] text-[var(--muted)]">by {master.author}<br />{master.uses.toLocaleString()} 次使用</div><button onClick={() => downloadMaster(master)} className="secondary-btn px-4"><Download size={14} />下载</button></div>
              </article>
            ))}
          </div>
          <div className="mt-8 flex items-start gap-3 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 text-xs leading-6 text-[var(--muted)]"><ShieldCheck className="mt-1 shrink-0 text-[var(--gold)]" size={16} />社区上传当前保存在本地浏览器，不会自动发布到公共服务器。人物包仅包含角色配置，不应包含 API Key、私钥或个人敏感信息。</div>
        </div>
      </section>

      {commentMaster && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-sm">
          <button onClick={() => setCommentMaster(null)} aria-label="关闭评论" className="absolute inset-0 cursor-default" />
          <div className="relative z-10 w-full max-w-lg rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-6 shadow-2xl">
            <div className="flex items-center justify-between"><div><div className="section-label">社区评论</div><h2 className="mt-2 font-serif text-2xl">{commentMaster.name}</h2></div><button onClick={() => setCommentMaster(null)} aria-label="关闭" className="icon-btn"><X size={16} /></button></div>
            <div className="mt-5 max-h-64 space-y-2 overflow-y-auto">
              {(comments[commentMaster.id] ?? []).length ? (comments[commentMaster.id] ?? []).map((comment, index) => <p key={`${comment}-${index}`} className="rounded-xl bg-[var(--panel-soft)] p-3 text-sm leading-6">{comment}</p>) : <p className="py-8 text-center text-xs text-[var(--muted)]">还没有评论，留下第一个社区观点。</p>}
            </div>
            <form onSubmit={submitComment} className="mt-4 flex gap-2"><input value={commentDraft} onChange={(event) => setCommentDraft(event.target.value)} maxLength={160} placeholder="评价这个人物的投资风格..." className="min-w-0 flex-1 rounded-full border border-[var(--line)] bg-transparent px-5 text-sm outline-none focus:border-[var(--green)]" /><button type="submit" className="primary-btn">发布</button></form>
          </div>
        </div>
      )}
    </main>
  );
}
