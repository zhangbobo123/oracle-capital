"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BarChart3,
  Bot,
  ChevronRight,
  History,
  Menu,
  Orbit,
  ShieldCheck,
  Upload,
  Users,
  Wallet,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type DocItem = {
  title: string;
  description: string;
  details?: string[];
};

type DocChapter = {
  id: string;
  number: string;
  label: string;
  title: string;
  intro: string;
  icon: LucideIcon;
  items: DocItem[];
};

const chapters: DocChapter[] = [
  {
    id: "overview",
    number: "01",
    label: "产品概览",
    title: "什么是 Oracle Capital",
    intro: "Oracle Capital 是一个面向加密资产用户的 AI 投资研究与模拟决策产品。它把不同投资思想放进同一场对话，让用户从多个角度审视机会、风险和执行条件。",
    icon: Orbit,
    items: [
      { title: "多思想决策", description: "用户可以选择一位人物深入讨论，也可以邀请多位人物组成投资委员会。" },
      { title: "覆盖方向", description: "产品围绕现货、DeFi 和合约研究展开，覆盖 Ethereum、BNB Chain 与 Solana。" },
      { title: "用户掌控", description: "AI 负责提供分析和方案，用户始终保留最终判断、钱包确认和资金控制权。" },
      { title: "人物声明", description: "网站人物是思想框架模拟，与相关人物本人、继承方不存在授权、关联或背书。" },
    ],
  },
  {
    id: "masters",
    number: "02",
    label: "人物星图",
    title: "发现和选择投资人物",
    intro: "首页通过可交互的圆形人物星图展示投资人物。用户可以搜索、拖动和组合人物，再进入对应的投资对话。",
    icon: Users,
    items: [
      { title: "官方人物", description: "首页共 13 位人物，涵盖价值、成长、宏观、趋势、市场机制、东方思想和科学思维；社区另有阿峰、凉兮、霍金 3 位专属人物。" },
      { title: "动态大小", description: "人物球根据使用次数调整大小，常用人物更醒目，同时保留其他人物的可发现性。" },
      { title: "物理互动", description: "人物球支持鼠标和触摸拖动。松手后会按惯性运动，并产生边界反弹和球体碰撞。" },
      { title: "人物搜索", description: "可通过中文名、英文名、投资流派或思想关键词快速筛选人物。" },
      { title: "选择规则", description: "选择一位人物可开始单独对话；选择三位及以上可召开投资委员会。" },
    ],
  },
  {
    id: "council",
    number: "03",
    label: "投资委员会",
    title: "从独立观点到最终方案",
    intro: "委员会中的每位人物按照自己的思想框架独立分析同一个问题，再通过投票和综合形成一份可阅读、可比较的最终方案。",
    icon: Bot,
    items: [
      { title: "独立分析", description: "所选人物分别从价值、成长、宏观、市场机制、资本结构等角度给出意见。" },
      { title: "投票机制", description: "人物可以投赞成、保留或反对票，并显示各自的判断置信度。" },
      { title: "共识结果", description: "页面展示委员会共识率、票数分布和最重要的反对意见。" },
      { title: "最终方案", description: "综合方案包含核心逻辑、配置比例、风险等级、收益判断、压力回撤和执行步骤。" },
      { title: "讨论控制", description: "用户可以暂停或继续讨论，并在形成方案后查看模拟执行预览。" },
    ],
  },
  {
    id: "history",
    number: "04",
    label: "历史对话",
    title: "继续以前的投资讨论",
    intro: "历史会话入口位于首页和聊天侧栏。用户不需要每次重新选择人物，可以直接恢复上一次的讨论状态。",
    icon: History,
    items: [
      { title: "自动保存", description: "发送第一条消息后，对话会自动进入历史记录。" },
      { title: "完整恢复", description: "恢复内容包括人物组合、全部消息、人物投票、共识结果和最终方案。" },
      { title: "首页入口", description: "首页提供“继续最近对话”和历史会话卡片。" },
      { title: "当前范围", description: "历史记录目前保存在当前浏览器，清除浏览器数据或更换设备后不会自动同步。" },
    ],
  },
  {
    id: "community",
    number: "05",
    label: "人物社区",
    title: "发现、评价和分享人物",
    intro: "人物社区集中承载排行榜、搜索、点赞、评论和人物包分享。首页人物球保持简洁，不显示社交互动按钮。",
    icon: Upload,
    items: [
      { title: "人物排行榜", description: "社区顶部按照人物使用次数展示排行榜，帮助用户发现热门人物。" },
      { title: "点赞与评论", description: "每张社区人物卡片都支持点赞和评论，评论可用于交流人物风格和使用感受。" },
      { title: "社区搜索", description: "支持按人物名称、作者、流派和人物介绍搜索。" },
      { title: "上传人物", description: "用户可以上传符合人物包格式的 JSON 文件，在本地社区中预览和管理。" },
      { title: "下载人物", description: "官方人物和已上传人物都可以下载为 JSON 人物包，便于分享和再次导入。" },
    ],
  },
  {
    id: "market",
    number: "06",
    label: "市场中心",
    title: "查看多链市场和研究信息",
    intro: "市场页面聚合核心资产价格和链上 TVL，让用户在进入 AI 分析前先了解基础市场状态。",
    icon: BarChart3,
    items: [
      { title: "核心资产", description: "固定展示 BTC、ETH、SOL、BNB、XRP、DOGE，并提供价格、24h/7d 涨跌、市值、成交量、日内高低、历史高点、7 日走势和独立原创视觉。" },
      { title: "市场总览", description: "汇总核心资产总市值、24h 成交量、三链 TVL、市场温度和相对强势信号。" },
      { title: "多链 TVL", description: "对比 Ethereum、BSC 和 Solana 的 TVL、TVL/市值以及流动性占比。" },
      { title: "交互工具", description: "支持 24h/7d 周期切换、资产收藏、数据刷新和更新时间展示。" },
      { title: "AI 分析入口", description: "每个资产都可以直接交给投资委员会分析现货、DeFi 和合约机会。" },
      { title: "研究工具", description: "页面提供 OpenClue、DefiLlama、Dune 和 Nansen 等研究网站入口。" },
    ],
  },
  {
    id: "portfolio",
    number: "07",
    label: "资产账户",
    title: "模拟盘和真实钱包资产",
    intro: "个人中心同时提供模拟盘和真实钱包两种模式，帮助用户分别体验策略和查看公开链上资产。",
    icon: Wallet,
    items: [
      { title: "默认模拟资产", description: "模拟账户默认持有 Ethereum 网络下的 10,000 USDC，作为充值、提现和策略配置的结算资产。" },
      { title: "AI 方案联动", description: "在对话中确认模拟执行后，方案配置会直接写入个人中心持仓，并同步更新资产占比、链分布和最近共识。" },
      { title: "数据分析面板", description: "展示总资产、可用 USDC、已投入策略、盈亏、资金利用率、稳定币占比、最大仓位和组合风险。" },
      { title: "持仓与轨迹", description: "提供模拟持仓明细、配置逻辑、净值轨迹以及充值、提现和策略执行流水。" },
      { title: "模拟提现费用", description: "模拟提现按照提现金额收取 0.01% 手续费，仅作用于模拟余额。" },
      { title: "钱包连接", description: "支持 MetaMask 及兼容 EVM 钱包，也支持 Phantom Solana 钱包。" },
      { title: "资产显示", description: "可读取并展示钱包中的 ETH、BNB 和 SOL 原生资产余额。" },
      { title: "真实充值", description: "连接钱包后可复制公开收款地址，从其他钱包或交易所转入资产。" },
      { title: "非托管模式", description: "真实资产始终由用户钱包控制，网站不接触私钥或助记词。" },
    ],
  },
  {
    id: "settings",
    number: "08",
    label: "账户与设置",
    title: "个人入口和使用偏好",
    intro: "右上角头像打开账户菜单，将个人功能和显示设置集中在一个入口中。",
    icon: Menu,
    items: [
      { title: "个人中心", description: "进入模拟盘、真实钱包资产和资金流水页面。" },
      { title: "历史对话", description: "快速定位并继续以前保存的会话。" },
      { title: "产品文档", description: "在独立文档页面查看产品功能和使用边界。" },
      { title: "开发者 API", description: "可在当前浏览器中加密保存自己的 AI 接口配置，并随时恢复平台默认服务。" },
      { title: "语言设置", description: "支持中文和英文界面切换，并保存最近选择。" },
      { title: "日夜模式", description: "支持浅色和深色主题，并在再次进入时恢复偏好。" },
    ],
  },
  {
    id: "safety",
    number: "09",
    label: "安全边界",
    title: "产品当前不会做什么",
    intro: "Oracle Capital 当前以投资研究和模拟体验为核心。涉及真实资金的能力必须保持清晰、可验证和由用户确认。",
    icon: ShieldCheck,
    items: [
      { title: "不承诺收益", description: "AI 观点和方案不构成收益保证，也不能替代用户自己的判断。" },
      { title: "不托管私钥", description: "网站不会要求、读取或保存私钥和助记词。" },
      { title: "不伪造真实执行", description: "当前方案执行是模拟流程，不会在用户不知情的情况下广播交易。" },
      { title: "真实提现边界", description: "平台收费金库尚未启用，真实资产由用户直接通过自己的钱包管理。" },
      { title: "交易前核对", description: "链上数据可能存在延迟，真实交易前应再次核对协议、网络、金额、授权和风险。" },
    ],
  },
  {
    id: "roadmap",
    number: "10",
    label: "产品路线",
    title: "下一阶段建设方向",
    intro: "当前版本适合黑客松展示和产品验证。后续将围绕跨设备账户、社区治理和真实交易基础设施继续建设。",
    icon: ChevronRight,
    items: [
      { title: "账户同步", description: "支持钱包签名登录、跨设备历史同步和更完整的个人投资档案。" },
      { title: "公共社区", description: "增加公开人物发布、点赞评论同步、审核、举报和创作者主页。" },
      { title: "真实报价", description: "接入去中心化交易和借贷协议的真实报价、模拟执行与待签名交易。" },
      { title: "风险系统", description: "增加协议白名单、滑点与仓位限制、授权检查、监控和审计记录。" },
      { title: "资金设施", description: "真实资金产品上线前完成智能合约设计、安全审计和合规评估。" },
    ],
  },
];

export default function DocsPage() {
  const [activeId, setActiveId] = useState(chapters[0].id);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const activeChapter = chapters.find((chapter) => chapter.id === activeId) ?? chapters[0];
  const ActiveIcon = activeChapter.icon;

  const selectChapter = (id: string) => {
    setActiveId(id);
    setSidebarOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <main className="min-h-screen bg-white text-black">
      <header className="fixed inset-x-0 top-0 z-40 h-16 border-b border-black/15 bg-white/95 backdrop-blur">
        <div className="flex h-full items-center justify-between px-4 lg:px-7">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="grid h-9 w-9 place-items-center border border-black lg:hidden" aria-label="打开文档目录"><Menu size={17} /></button>
            <Link href="/" className="flex items-center gap-2 text-sm font-medium"><ArrowLeft size={16} />Oracle Capital</Link>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-semibold tracking-[0.24em]">PRODUCT DOCUMENTATION</div>
            <div className="mt-0.5 text-[9px] text-black/45">UPDATED 2026.06.12</div>
          </div>
        </div>
      </header>

      {sidebarOpen && <button onClick={() => setSidebarOpen(false)} className="fixed inset-0 z-40 bg-black/35 lg:hidden" aria-label="关闭文档目录" />}

      <aside className={`fixed bottom-0 left-0 top-16 z-50 w-[300px] border-r border-black/15 bg-[#f4f4f2] transition-transform lg:z-30 lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center justify-between border-b border-black/15 px-5 py-5">
          <div>
            <div className="text-[10px] font-semibold tracking-[0.2em] text-black/45">CONTENTS</div>
            <div className="mt-1 font-serif text-xl">产品文档</div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="grid h-8 w-8 place-items-center border border-black/20 lg:hidden" aria-label="关闭"><X size={15} /></button>
        </div>
        <nav className="h-[calc(100%-81px)] overflow-y-auto px-3 py-4">
          {chapters.map((chapter) => {
            const Icon = chapter.icon;
            const active = chapter.id === activeId;
            return (
              <button key={chapter.id} onClick={() => selectChapter(chapter.id)} className={`mb-1 flex w-full items-center gap-3 px-3 py-3 text-left transition ${active ? "bg-black text-white" : "text-black/65 hover:bg-black/5 hover:text-black"}`}>
                <span className={`text-[10px] font-mono ${active ? "text-white/55" : "text-black/35"}`}>{chapter.number}</span>
                <Icon size={15} />
                <span className="flex-1 text-sm">{chapter.label}</span>
                {active && <ChevronRight size={13} />}
              </button>
            );
          })}
        </nav>
      </aside>

      <section className="min-h-screen pt-16 lg:pl-[300px]">
        <div className="mx-auto max-w-[980px] px-5 py-12 md:px-10 lg:px-14 lg:py-20">
          <div className="flex items-center gap-3 text-[10px] font-semibold tracking-[0.2em] text-black/45">
            <ActiveIcon size={14} />
            SECTION {activeChapter.number}
          </div>
          <h1 className="mt-7 max-w-4xl font-serif text-4xl leading-tight md:text-6xl">{activeChapter.title}</h1>
          <p className="mt-7 max-w-3xl border-l-2 border-black pl-5 text-sm leading-8 text-black/60 md:text-base">{activeChapter.intro}</p>

          <div className="mt-14 border-t border-black">
            {activeChapter.items.map((item, index) => (
              <article key={item.title} className="grid gap-4 border-b border-black/15 py-8 md:grid-cols-[64px_220px_1fr] md:gap-7">
                <span className="font-mono text-xs text-black/35">{String(index + 1).padStart(2, "0")}</span>
                <h2 className="font-serif text-xl">{item.title}</h2>
                <div>
                  <p className="text-sm leading-7 text-black/62">{item.description}</p>
                  {item.details?.length ? <ul className="mt-4 space-y-2">{item.details.map((detail) => <li key={detail} className="flex gap-3 text-xs leading-6 text-black/55"><span className="mt-2 h-1 w-1 shrink-0 bg-black" />{detail}</li>)}</ul> : null}
                </div>
              </article>
            ))}
          </div>

          <div className="mt-12 flex items-center justify-between border-t border-black pt-6 text-xs">
            <span className="text-black/45">{activeChapter.number} / {String(chapters.length).padStart(2, "0")}</span>
            {chapters.findIndex((chapter) => chapter.id === activeId) < chapters.length - 1 ? (
              <button onClick={() => selectChapter(chapters[chapters.findIndex((chapter) => chapter.id === activeId) + 1].id)} className="flex items-center gap-2 border border-black px-5 py-3 font-medium hover:bg-black hover:text-white">下一部分 <ChevronRight size={14} /></button>
            ) : <Link href="/" className="border border-black px-5 py-3 font-medium hover:bg-black hover:text-white">返回产品</Link>}
          </div>
        </div>
      </section>
    </main>
  );
}
