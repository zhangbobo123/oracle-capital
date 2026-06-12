"use client";

import { useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BarChart3,
  Bot,
  Check,
  Heart,
  History,
  Search,
  ShieldCheck,
  Sparkles,
  Upload,
  Users,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const status = {
  live: "已上线",
  local: "本地演示",
  planned: "待接入",
  required: "生产前必需",
};

const features: [string, string, LucideIcon, string][] = [
  ["动态人物星图", "8 位官方人物以圆形球展示，保留头像和姓名。球体直径使用 log10(使用次数 + 1) 归一化到约 152-248px；当前浏览器历史会话也会增加对应人物使用次数。", Users, status.live],
  ["人物搜索", "支持按中文名、英文名、投资流派和角色语录搜索，输入后即时过滤人物球。", Search, status.live],
  ["点赞与评论", "每个人物可独立点赞和评论。操作不会误触人物选择；数据保存在当前浏览器。", Heart, status.local],
  ["AI 投资委员会", "可选择 1 位人物单聊，或选择至少 3 位人物组成委员会；恰好选择 2 位时暂不允许开始。", Bot, status.live],
  ["历史恢复", "自动保存最近 20 个会话，并恢复原人物组合、消息、投票、共识率和最终方案。", History, status.live],
  ["人物社区", "社区顶部按使用次数展示排行榜，支持搜索、上传 JSON 人物包和下载人物包。上传内容当前仅保存在本地。", Upload, status.local],
  ["多链市场", "展示 ETH、BNB、SOL 的公开价格，以及 Ethereum、BSC、Solana 的链 TVL；提供 OpenClue、DefiLlama、Dune、Nansen 研究入口。", BarChart3, status.live],
  ["资产与钱包", "支持 MetaMask/EVM、Phantom/Solana 连接，读取公开原生币余额；WalletConnect 仅保留入口。", Wallet, status.live],
];

const votingRules = [
  ["参与者", "只有用户当前选择的人物参与回答和投票；未选择人物不会临时加入。"],
  ["票型", "approve=赞成、abstain=保留、reject=反对；每票包含 0-100 置信度。"],
  ["共识率", "round((赞成票 + 保留票 × 0.5) ÷ 参与人数 × 100)。反对票计 0。"],
  ["最终方案", "包含标题、核心逻辑、最多 6 项且归一化为 100% 的配置、风险等级、收益判断、压力回撤、主要分歧和执行步骤。"],
  ["降级策略", "DeepSeek 不可用时生成明确标记的本地演示回复，所有成员投保留票，共识率为 50%。"],
  ["彩蛋规则", "彩蛋只替换已选人物的台词，不新增人物、不改变票型、不改变共识率和最终方案。"],
];

const easterEggs = [
  ["巴菲特", "BTC / Bitcoin / 比特币", "先表达不看好，再给出总预算不超过可投资资产 5%、24 份、持续 6 个月的定投框架。"],
  ["牛顿", "英国股市 / 英股 / London stock", "触发南海泡沫式疯狂台词，并强调分批、拒绝借贷和可证伪条件。"],
  ["马克思", "资本 / capital", "从利润创造、风险承担、治理权、现金流和清算机制审视资本结构。"],
  ["芒格", "反过来想 / 避免失败 / invert", "先列出破产路径，再排除高杠杆、陌生协议和流动性风险。"],
  ["林奇", "十倍股 / 产品体验 / 生活中发现", "从日常观察出发，再核查增长、单位经济、资产负债表和估值。"],
  ["哈耶克", "货币竞争 / 央行 / 稳定币 / 通胀", "比较储备质量、赎回通道、司法管辖和治理权。"],
  ["亚当·斯密", "看不见的手 / 分工 / 交换 / 市场机制", "分析价格协调、产权、规则和参与者激励。"],
  ["凯恩斯", "降息 / 衰退 / 流动性陷阱 / 动物精神", "强调期限、现金选择权和市场非理性持续时间。"],
];

const storageKeys = [
  ["oracle-capital-theme", "light / dark 主题偏好"],
  ["oracle-capital-language", "zh / en 语言偏好"],
  ["oracle-capital-selected-masters", "最近选择的人物 ID 数组"],
  ["oracle-capital-wallet", "钱包标签、公开地址和 evm/solana 类型，不含私钥"],
  ["oracle-capital-conversations", "最多 20 个会话：消息、人物 ID、最终方案和更新时间"],
  ["oracle-capital-simulation", "模拟余额与最多 30 条充值/提现流水"],
  ["oracle-capital-master-likes", "当前浏览器点赞的人物 ID"],
  ["oracle-capital-master-comments", "按人物 ID 保存的评论，每人物最多 30 条"],
  ["oracle-capital-community-masters", "当前浏览器上传的社区人物包，最多 30 个"],
];

const apiRows = [
  ["POST /api/chat", "DeepSeek deepseek-chat；45 秒超时；最多 8 位人物；返回角色回复、票型、置信度、综合结论和最终方案。"],
  ["GET /api/market", "DefiLlama Coins 价格约缓存 60 秒，链 TVL 约缓存 300 秒。价格源失败时返回空价格而不伪造。"],
  ["GET /api/portfolio?kind=evm&address=...", "读取 Ethereum 和 BNB Chain 原生币余额。"],
  ["GET /api/portfolio?kind=solana&address=...", "读取 SOL 余额；Solana 官方、PublicNode、Ankr 三节点顺序回退；单节点超时 8 秒。"],
];

const communitySchema = `{
  "id": "unique-id",
  "name": "中文名称",
  "en": "English Name",
  "school": "投资流派",
  "quote": "人物核心语录",
  "risk": "稳健 | 均衡 | 激进",
  "uses": 0,
  "author": "作者名称",
  "description": "人物分析框架说明"
}`;

export default function DocsPage() {
  useEffect(() => {
    const savedTheme = window.localStorage.getItem("oracle-capital-theme");
    document.documentElement.dataset.theme = savedTheme === "dark" ? "dark" : "light";
  }, []);

  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <header className="sticky top-0 z-30 border-b border-[var(--line)] bg-[var(--bg-glass)] backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-[1200px] items-center justify-between px-5 lg:px-10">
          <Link href="/" className="flex items-center gap-2 text-sm"><ArrowLeft size={16} />返回 Oracle Capital</Link>
          <div className="flex items-center gap-4 text-xs"><Link href="/community" className="text-[var(--muted)] hover:text-[var(--ink)]">人物社区</Link><span className="section-label">OFFICIAL DOCUMENTATION</span></div>
        </div>
      </header>

      <section className="hero-glow mx-auto max-w-[1200px] px-5 py-16 lg:px-10 lg:py-24">
        <div className="section-label">追光者 / Oracle Capital · 2026-06-12</div>
        <h1 className="mt-5 max-w-5xl font-serif text-5xl leading-tight md:text-7xl">官方产品与功能文档</h1>
        <p className="mt-7 max-w-3xl text-sm leading-8 text-[var(--muted)]">本文档以当前生产网站实际代码为准，区分已上线、本地演示、待接入和生产前必需能力。人物均为思想框架模拟，不代表或冒充真实人物。</p>
        <div className="mt-8 flex flex-wrap gap-2 text-xs">
          {Object.values(status).map((item) => <span key={item} className="rounded-full border border-[var(--line)] bg-[var(--panel)] px-4 py-2">{item}</span>)}
        </div>
      </section>

      <DocSection eyebrow="01 · 产品范围" title="当前网站能力">
        <div className="grid gap-4 md:grid-cols-2">
          {features.map(([title, description, Icon, featureStatus]) => (
            <article key={String(title)} className="stat-card">
              <div className="flex items-center justify-between"><Icon className="text-[var(--gold)]" size={21} /><span className="rounded-full bg-[var(--wash)] px-3 py-1 text-[9px]">{featureStatus}</span></div>
              <h3 className="mt-5 font-serif text-2xl">{title}</h3>
              <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{description}</p>
            </article>
          ))}
        </div>
      </DocSection>

      <DocSection eyebrow="02 · 人物系统" title="选择、排序与互动" soft>
        <div className="grid gap-4 lg:grid-cols-3">
          <DetailCard title="官方人物">巴菲特、芒格、林奇、牛顿、哈耶克、马克思、亚当·斯密、凯恩斯，共 8 位。</DetailCard>
          <DetailCard title="球体大小算法">基础使用次数加当前浏览器历史会话次数，取 log10(count + 1)，再按全体最小/最大值归一化至约 152-248px。</DetailCard>
          <DetailCard title="选择约束">1 位可单聊，3-8 位可召开委员会；2 位状态下开始按钮禁用。已选择状态会保存在浏览器。</DetailCard>
          <DetailCard title="点赞">点赞与取消点赞独立于人物选择；官方展示数为演示基数加本地点赞状态。</DetailCard>
          <DetailCard title="评论">评论最长 160 字，每人物最多保存最近 30 条，只在当前浏览器可见。</DetailCard>
          <DetailCard title="社区导航">主导航使用“社区”取代旧排行榜；旧 /rankings 地址自动跳转 /community。</DetailCard>
        </div>
      </DocSection>

      <DocSection eyebrow="03 · AI 委员会" title="对话、投票与最终方案">
        <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel)]">
          {votingRules.map(([name, detail]) => <DocRow key={name} name={name} detail={detail} />)}
        </div>
        <div className="mt-8 rounded-2xl border border-[var(--line)] bg-[var(--panel-soft)] p-6">
          <div className="section-label"><Sparkles size={14} /> 角色彩蛋</div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {easterEggs.map(([name, keyword, result]) => <article key={name} className="rounded-xl bg-[var(--panel)] p-4"><div className="flex items-center justify-between gap-3"><strong>{name}</strong><span className="text-[9px] text-[var(--gold)]">{keyword}</span></div><p className="mt-3 text-xs leading-6 text-[var(--muted)]">{result}</p></article>)}
          </div>
        </div>
      </DocSection>

      <DocSection eyebrow="04 · 历史与偏好" title="保存与恢复机制" soft>
        <div className="grid gap-4 md:grid-cols-2">
          <DetailCard title="自动保存时机">发送第一条用户消息后开始保存；后续消息、投票和最终方案变化时更新会话。</DetailCard>
          <DetailCard title="会话标题与数量">标题取第一条用户问题前 22 个字符；按更新时间倒序，最多保留 20 个。</DetailCard>
          <DetailCard title="恢复内容">恢复会话 ID、全部消息、最终方案、方案展开状态，以及当时选中的人物组合。</DetailCard>
          <DetailCard title="账户菜单">头像菜单包含个人中心、历史对话、产品文档、语言和日夜模式；社区只放在主导航，不在下拉菜单重复。</DetailCard>
        </div>
        <div className="mt-6 overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel)]">
          {storageKeys.map(([key, detail]) => <DocRow key={key} name={key} detail={detail} mono />)}
        </div>
      </DocSection>

      <DocSection eyebrow="05 · 人物社区" title="排行榜与人物包">
        <div className="grid gap-4 md:grid-cols-3">
          <DetailCard title="排行榜">位于社区页面最上方，按 uses 从高到低排序；前三名使用大卡片，其余展示列表。</DetailCard>
          <DetailCard title="上传">仅接受 .json / application/json；校验必填字符串字段、uses 数字和三种风险枚举；导入时生成带时间戳的新 ID。</DetailCard>
          <DetailCard title="下载">使用浏览器 Blob 导出 JSON，文件名格式为 id.oracle-master.json，可再次上传。</DetailCard>
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_.8fr]">
          <pre className="overflow-x-auto rounded-2xl border border-[var(--line)] bg-[#101b17] p-5 text-xs leading-6 text-[#d5d8cf]"><code>{communitySchema}</code></pre>
          <div className="stat-card text-sm leading-7 text-[var(--muted)]"><strong className="text-[var(--ink)]">当前限制</strong><p className="mt-3">上传人物只进入社区列表，不会自动加入 AI 委员会首页，也不会上传到公共服务器。最多保存 30 个本地人物包。人物包不得包含 API Key、私钥或个人敏感信息。</p></div>
        </div>
      </DocSection>

      <DocSection eyebrow="06 · 市场与资产" title="真实数据和模拟资金" soft>
        <div className="grid gap-4 md:grid-cols-2">
          <DetailCard title="市场面板">价格来自 DefiLlama Coins；TVL 来自 DefiLlama Chains。当前价格源不提供 24h 涨跌、市值和成交量时，界面显示“—”，不会填充假数据。</DetailCard>
          <DetailCard title="研究入口">OpenClue 用于市场研究参考，DefiLlama 用于 TVL，Dune 用于社区链上看板，Nansen 用于钱包标签和资金流研究。</DetailCard>
          <DetailCard title="模拟盘">初始余额 $10,000；可充值、提现；提现费用为提现金额 × 0.0001，即 0.01%；流水最多 30 条。</DetailCard>
          <DetailCard title="真实钱包资产">EVM 同时读取 ETH 与 BNB；Phantom 读取 SOL。只显示原生币余额，暂不读取 ERC-20、BEP-20、SPL 代币或 NFT。</DetailCard>
          <DetailCard title="真实充值">显示并复制当前连接钱包的公开收款地址，资金直接进入用户钱包，不进入平台托管账户。</DetailCard>
          <DetailCard title="真实提现">非托管资产可由用户通过钱包直接发送。平台收费金库未部署，因此真实提现不收取也不伪造 0.01% 手续费。</DetailCard>
        </div>
      </DocSection>

      <DocSection eyebrow="07 · 钱包与执行" title="连接、签名和限制">
        <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel)]">
          <DocRow name="MetaMask / EVM" detail="使用 window.ethereum 和 eth_requestAccounts 获取公开地址，支持兼容 EVM 浏览器钱包。" />
          <DocRow name="Phantom / Solana" detail="检测 window.solana.isPhantom 并调用 connect() 获取公开地址。" />
          <DocRow name="WalletConnect" detail="界面入口存在，但项目 ID 和正式 SDK 尚未接入。" />
          <DocRow name="交易预览" detail="展示配置、共识率和风险等级；要求勾选风险声明。当前只执行 1.2 秒本地模拟签名，不广播链上交易。" />
          <DocRow name="私钥边界" detail="网站不读取、不保存、不上传私钥或助记词；真实交易未来也必须由钱包单独确认。" />
        </div>
      </DocSection>

      <DocSection eyebrow="08 · API 与数据源" title="当前线上接口" soft>
        <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel)]">
          {apiRows.map(([name, detail]) => <DocRow key={name} name={name} detail={detail} mono />)}
        </div>
        <p className="mt-5 text-xs leading-6 text-[var(--muted)]">DEEPSEEK_API_KEY 只保存在本地环境文件和 Vercel 环境变量，不提交 GitHub。公共 RPC 和数据源可能限流、延迟或暂时不可用，交易前应在区块浏览器和协议官方界面再次核对。</p>
      </DocSection>

      <DocSection eyebrow="09 · 安全与合规" title="明确不做的事情">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[
            ["不承诺收益", "AI 不得承诺收益或声称已替用户执行交易。"],
            ["不托管资金", "当前没有平台资金账户、收费金库或自动提款通道。"],
            ["不直接执行模型参数", "生产交易必须经过确定性 schema、规则引擎、白名单、滑点和限额检查。"],
            ["不冒充人物", "所有人物为教育和产品演示用途的思想框架模拟。"],
          ].map(([title, text]) => <article key={title} className="stat-card"><ShieldCheck className="text-[var(--gold)]" size={18} /><h3 className="mt-4 font-serif text-xl">{title}</h3><p className="mt-3 text-xs leading-6 text-[var(--muted)]">{text}</p></article>)}
        </div>
      </DocSection>

      <DocSection eyebrow="10 · 路线图" title="上线前后续工作" soft>
        <div className="grid gap-4 md:grid-cols-3">
          <DetailCard title="账户与同步">钱包签名登录、服务端账户、跨设备加密历史同步、评论与点赞公共数据库。</DetailCard>
          <DetailCard title="交易基础设施">DEX/借贷真实报价、待签名交易构建、模拟执行、协议白名单和授权管理。</DetailCard>
          <DetailCard title="生产安全">智能合约审计、金库和提现规则、KYT/地区合规、速率限制、审计日志、监控与告警。</DetailCard>
        </div>
        <div className="mt-10 flex flex-wrap justify-center gap-3"><Link href="/" className="primary-btn"><Bot size={15} />进入投资委员会</Link><Link href="/community" className="secondary-btn"><Users size={15} />打开人物社区</Link></div>
      </DocSection>
    </main>
  );
}

function DocSection({ eyebrow, title, soft = false, children }: { eyebrow: string; title: string; soft?: boolean; children: React.ReactNode }) {
  return (
    <section className={`border-t border-[var(--line)] ${soft ? "bg-[var(--panel-soft)]" : ""}`}>
      <div className="mx-auto max-w-[1200px] px-5 py-16 lg:px-10">
        <div className="section-label">{eyebrow}</div>
        <h2 className="mb-8 mt-3 font-serif text-3xl md:text-4xl">{title}</h2>
        {children}
      </div>
    </section>
  );
}

function DetailCard({ title, children }: { title: string; children: React.ReactNode }) {
  return <article className="stat-card"><Check className="text-[var(--positive)]" size={17} /><h3 className="mt-4 font-serif text-xl">{title}</h3><p className="mt-3 text-xs leading-6 text-[var(--muted)]">{children}</p></article>;
}

function DocRow({ name, detail, mono = false }: { name: string; detail: string; mono?: boolean }) {
  return <div className="grid gap-2 border-b border-[var(--line)] p-5 last:border-0 md:grid-cols-[260px_1fr]"><strong className={mono ? "font-mono text-xs" : "font-serif text-lg"}>{name}</strong><p className="text-sm leading-7 text-[var(--muted)]">{detail}</p></div>;
}
