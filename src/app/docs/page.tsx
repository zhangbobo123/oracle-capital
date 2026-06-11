"use client";

import { useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BarChart3,
  Bot,
  Check,
  Database,
  MessageSquare,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const capabilities: [string, string, LucideIcon][] = [
  ["AI 投资委员会", "选择一位大师深入对话，或选择三位以上大师独立分析、投票并生成最终方案。", Bot],
  ["历史对话", "自动保存消息、大师组合、投票结果和最终方案，可从首页继续上次讨论。", MessageSquare],
  ["多链市场", "展示 ETH、BNB、SOL 的公开市场价格和 Ethereum、BSC、Solana 链上 TVL。", BarChart3],
  ["资产账户", "提供本地模拟盘充值提现，并读取已连接钱包的公开链上原生资产余额。", Wallet],
];

const productFlow = [
  "选择一位大师，或选择至少三位大师组成委员会。",
  "输入投资问题，DeepSeek 按不同思想框架生成独立意见。",
  "每位大师给出赞成、保留或反对票及置信度。",
  "系统按投票结果生成共识率、资产配置、风险和执行步骤。",
  "用户预览模拟执行；真实交易仍需钱包确认与确定性风控。",
];

const roadmap = [
  ["已完成", "大师选择、DeepSeek 对话、投票共识、历史保存、模拟盘、实时市场、ETH/BSC/SOL 余额读取。"],
  ["下一阶段", "服务端账户、跨设备历史同步、代币余额与仓位估值、真实 DEX 报价和待签名交易。"],
  ["生产前要求", "智能合约审计、资金金库、地区合规、钱包风险筛查、限额与完整审计日志。"],
];

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
          <span className="section-label">PRODUCT DOCUMENTATION</span>
        </div>
      </header>

      <section className="hero-glow mx-auto max-w-[1200px] px-5 py-16 lg:px-10 lg:py-24">
        <div className="section-label">追光者 / Oracle Capital</div>
        <h1 className="mt-5 max-w-4xl font-serif text-5xl leading-tight md:text-7xl">AI 多链投资委员会<br />产品文档</h1>
        <p className="mt-7 max-w-3xl text-sm leading-8 text-[var(--muted)]">
          面向加密资产用户的 AI 投资研究与模拟执行平台。它让不同投资思想在同一张桌上独立分析、投票和形成方案，同时把最终交易控制权留给用户。
        </p>
        <div className="mt-9 flex flex-wrap gap-2 text-xs">
          {["Ethereum", "BNB Chain", "Solana", "现货", "DeFi", "合约模拟"].map((item) => <span key={item} className="rounded-full border border-[var(--line)] bg-[var(--panel)] px-4 py-2">{item}</span>)}
        </div>
      </section>

      <section className="border-t border-[var(--line)] bg-[var(--panel-soft)]">
        <div className="mx-auto max-w-[1200px] px-5 py-16 lg:px-10">
          <div className="section-label">当前网站功能</div>
          <div className="mt-7 grid gap-4 md:grid-cols-2">
            {capabilities.map(([title, description, Icon]) => (
              <article key={String(title)} className="stat-card">
                <Icon className="text-[var(--gold)]" size={21} />
                <h2 className="mt-5 font-serif text-2xl">{title}</h2>
                <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1200px] gap-12 px-5 py-16 lg:grid-cols-2 lg:px-10">
        <div>
          <div className="section-label"><MessageSquare size={14} /> 核心使用流程</div>
          <ol className="mt-6 space-y-3">
            {productFlow.map((step, index) => <li key={step} className="flex gap-4 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 text-sm leading-6"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--wash)] font-serif">{index + 1}</span><span>{step}</span></li>)}
          </ol>
        </div>
        <div>
          <div className="section-label"><Database size={14} /> 数据与保存</div>
          <div className="mt-6 space-y-4 text-sm leading-7 text-[var(--muted)]">
            <p className="stat-card">市场价格和链 TVL 来自 DefiLlama 公共数据服务；钱包原生资产通过 Ethereum、BNB Chain 和 Solana 公共 RPC 读取。</p>
            <p className="stat-card">当前历史对话、偏好设置和模拟盘流水保存在用户浏览器的 LocalStorage 中。清除浏览器数据或更换设备后不会自动同步。</p>
            <p className="stat-card">AI 回答由 DeepSeek API 生成。人物为思想框架模拟，与相关人物本人、继承方无关联、授权或背书。</p>
          </div>
        </div>
      </section>

      <section className="border-y border-[var(--line)] bg-[var(--panel-soft)]">
        <div className="mx-auto max-w-[1200px] px-5 py-16 lg:px-10">
          <div className="section-label"><ShieldCheck size={14} /> 资金与安全边界</div>
          <div className="mt-7 grid gap-4 md:grid-cols-3">
            {[
              ["模拟盘", "充值、提现和 0.01% 提现手续费仅作用于浏览器内的模拟余额，不涉及真实资金。"],
              ["真实钱包", "网站只读取公开余额，不接触私钥。非托管资产仍由用户钱包直接控制。"],
              ["真实执行", "收费金库和自动投资尚未部署。上线前必须完成合约审计、规则引擎、限额与交易预览。"],
            ].map(([title, text]) => <article key={title} className="stat-card"><Check className="text-[var(--positive)]" size={18} /><h3 className="mt-4 font-serif text-xl">{title}</h3><p className="mt-3 text-xs leading-6 text-[var(--muted)]">{text}</p></article>)}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1200px] px-5 py-16 lg:px-10">
        <div className="section-label">产品路线图</div>
        <div className="mt-7 overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel)]">
          {roadmap.map(([stage, detail]) => <div key={stage} className="grid gap-2 border-b border-[var(--line)] p-5 last:border-0 md:grid-cols-[160px_1fr]"><strong className="font-serif text-lg">{stage}</strong><p className="text-sm leading-7 text-[var(--muted)]">{detail}</p></div>)}
        </div>
        <div className="mt-10 flex justify-center"><Link href="/" className="primary-btn">进入 AI 投资委员会</Link></div>
      </section>
    </main>
  );
}
