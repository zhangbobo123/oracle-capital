import { callDeepSeekJson } from "./deepseek";
import { masterMap, masterRoster } from "./masters";
import {
  buildChallengePrompt,
  buildCouncilAnalysisPrompt,
  buildSingleAgentPrompt,
  buildSynthesisPrompt,
} from "./prompts";
import { hydrateMasterSkill, hydrateMasters } from "./skill-loader";
import type {
  ChallengePoint,
  CouncilProposal,
  DiscussionRequest,
  DiscussionResponse,
  DiscussionStreamEvent,
  MasterId,
  MasterOpinion,
  MasterProfile,
  TranscriptMessage,
} from "./types";
import { clampConfidence, createId, normalizePercentages } from "./utils";

export const runtime = "nodejs";

type StreamEmit = (event: DiscussionStreamEvent) => Promise<void> | void;

function pickMasters(masterIds: MasterId[] | undefined) {
  return [...new Set(masterIds ?? [])]
    .map((id) => masterMap.get(id))
    .filter((master): master is MasterProfile => Boolean(master));
}

function toTranscriptMessage(
  role: TranscriptMessage["role"],
  stage: TranscriptMessage["stage"],
  content: string,
  master?: MasterProfile,
): TranscriptMessage {
  return {
    id: createId(stage),
    role,
    stage,
    content,
    masterId: master?.id,
    masterName: master?.name,
  };
}

function normalizeOpinion(master: MasterProfile, result: Partial<MasterOpinion>): MasterOpinion {
  return {
    masterId: master.id,
    stance: result.stance === "bullish" || result.stance === "bearish" ? result.stance : "neutral",
    summary: result.summary?.trim() || "我暂时保持谨慎，建议你先补充更多可验证的信息。",
    thesis: (result.thesis ?? []).filter(Boolean).slice(0, 3),
    risks: (result.risks ?? []).filter(Boolean).slice(0, 3),
    neededData: (result.neededData ?? []).filter(Boolean).slice(0, 3),
    suggestedActions: (result.suggestedActions ?? []).filter(Boolean).slice(0, 3),
    vote: result.vote === "approve" || result.vote === "reject" ? result.vote : "abstain",
    confidence: clampConfidence(Number(result.confidence)),
  };
}

function buildDemoOpinion(master: MasterProfile, question: string, feedbackNotes?: string): MasterOpinion {
  const feedback = feedbackNotes ? `你补充说这轮要修正：${feedbackNotes}。` : "";
  return {
    masterId: master.id,
    stance: master.riskBias === "aggressive" ? "bullish" : "neutral",
    summary: `我先给结论：面对“${question}”这个问题，我会先确认仓位边界、催化剂和你的风险承受能力。${feedback}在信息不足时，我不建议你一步到位重仓。`,
    thesis: [
      "我会先沿着这套完整 skill 里的核心分析顺序展开判断",
      "我会按这套 skill 的决策规则来决定现在该不该行动",
    ],
    risks: [
      "我会优先排查隐藏风险、错误定价和结构性脆弱点",
      "信息不足导致误判",
    ],
    neededData: [
      "更具体的时间周期与资金规模",
      "用户可承受回撤与目标收益",
    ],
    suggestedActions: [
      "先给出试探性小仓位方案",
      "补充数据后再决定是否升级为正式计划",
    ],
    vote: "abstain",
    confidence: 58,
  };
}

function buildDemoProposal(opinions: MasterOpinion[], feedbackNotes?: string): CouncilProposal {
  return {
    title: feedbackNotes ? "修订版委员会观察方案" : "委员会观察方案",
    thesis: "委员会认为当前问题可以讨论，但信息仍不足以支撑高置信度重仓。更适合先明确仓位边界、补齐关键数据，再决定是否进入正式执行。",
    allocations: normalizePercentages([
      { label: "BTC 核心仓", percentage: 28, rationale: "作为加密市场基准风险资产，承担核心方向仓位" },
      { label: "ETH 核心仓", percentage: 24, rationale: "兼具主流资产与生态现金流属性，提升组合质量" },
      { label: "SOL 卫星仓", percentage: 18, rationale: "补充高 Beta 公链弹性，捕捉阶段性超额收益" },
      { label: "LINK / AAVE 主题仓", percentage: 18, rationale: "配置基础设施与 DeFi 代表资产，分散单一链风险" },
      { label: "短期机会仓（ARB/INJ）", percentage: 12, rationale: "用于 7-30 天机会交易，严格仓位与止损" },
    ]),
    riskLevel: "均衡",
    expectedReturn: "不适用，需补充实时数据后再评估",
    maxDrawdown: "优先控制在用户可承受范围内",
    dissent: opinions.find((item) => item.vote === "reject")?.summary ?? "部分成员认为当前催化剂与风险界限还不够清楚。",
    userConfirmationsRequired: [
      "你的投资期限与最大可承受亏损是多少",
      "是否接受分批执行而不是一次性建仓",
      "是否允许使用高波动或高风险策略",
    ],
    executionSteps: [
      "确认目标收益、周期和风险承受能力",
      "补充实时市场与协议数据",
      "根据修订后的委员会结论决定是否执行",
    ],
  };
}

function extractSymbol(label: string) {
  const normalized = label.toUpperCase();
  if (/(BITCOIN|\bBTC\b)/.test(normalized)) return "BTC";
  if (/(ETHEREUM|\bETH\b)/.test(normalized)) return "ETH";
  if (/\bSOL\b/.test(normalized)) return "SOL";
  if (/\bBNB\b/.test(normalized)) return "BNB";
  if (/\bLINK\b/.test(normalized)) return "LINK";
  if (/\bARB\b/.test(normalized)) return "ARB";
  if (/\bAAVE\b/.test(normalized)) return "AAVE";
  if (/\bINJ\b/.test(normalized)) return "INJ";
  if (/\bRNDR\b/.test(normalized)) return "RNDR";
  return normalized.match(/\b[A-Z]{2,8}\b/)?.[0] ?? "";
}

function diversifiedTemplate(riskLevel: CouncilProposal["riskLevel"]) {
  if (riskLevel === "稳健") {
    return normalizePercentages([
      { label: "BTC 核心仓", percentage: 34, rationale: "核心配置，控制组合波动并保持市场 Beta" },
      { label: "ETH 核心仓", percentage: 26, rationale: "生态龙头，兼顾成长与流动性" },
      { label: "SOL 卫星仓", percentage: 14, rationale: "补充高弹性公链收益机会" },
      { label: "BNB 卫星仓", percentage: 12, rationale: "补充交易与生态场景敞口，降低单链集中度" },
      { label: "LINK / AAVE 主题仓", percentage: 8, rationale: "配置基础设施与 DeFi 赛道，增强风格分散" },
      { label: "短期机会仓（ARB）", percentage: 6, rationale: "用于 7-30 天事件驱动机会，设置严格止损" },
    ]);
  }
  if (riskLevel === "进取" || riskLevel === "高风险") {
    return normalizePercentages([
      { label: "BTC 核心仓", percentage: 18, rationale: "保留市场锚仓，避免纯高 Beta 暴露" },
      { label: "ETH 核心仓", percentage: 17, rationale: "维持主流资产底仓并承接流动性" },
      { label: "SOL 卫星仓", percentage: 20, rationale: "提升高弹性公链权重以争取超额收益" },
      { label: "BNB 卫星仓", percentage: 15, rationale: "增加第二公链权重，分散单一链风险" },
      { label: "AI 主题仓（INJ / RNDR）", percentage: 15, rationale: "捕捉 AI 叙事轮动机会，配合纪律止损" },
      { label: "短期机会仓（ARB / LINK）", percentage: 15, rationale: "用于 7-30 天机会，快进快出并严控仓位" },
    ]);
  }
  return normalizePercentages([
    { label: "BTC 核心仓", percentage: 26, rationale: "作为市场锚，提供组合稳定性与流动性" },
    { label: "ETH 核心仓", percentage: 22, rationale: "主流资产底仓，承接生态成长收益" },
    { label: "SOL 卫星仓", percentage: 18, rationale: "提高组合弹性，参与高活跃公链轮动" },
    { label: "BNB 卫星仓", percentage: 14, rationale: "补充不同链生态和交易场景暴露" },
    { label: "LINK / AAVE 主题仓", percentage: 12, rationale: "配置基础设施与 DeFi，增强风格多样化" },
    { label: "短期机会仓（ARB / INJ）", percentage: 8, rationale: "用于 7-30 天机会配置，附带严格止损" },
  ]);
}

function enforceDiversity(proposal: CouncilProposal) {
  const symbols = proposal.allocations.map((item) => extractSymbol(item.label)).filter(Boolean);
  const unique = new Set(symbols);
  const majorOnly = symbols.length > 0 && symbols.every((symbol) => symbol === "BTC" || symbol === "ETH");
  const lackVariety = unique.size < 4 || majorOnly;
  if (!lackVariety) return proposal;
  const improved = diversifiedTemplate(proposal.riskLevel);
  return {
    ...proposal,
    allocations: improved,
    thesis: `${proposal.thesis} 为提升可执行性与收益来源分散，本轮已按 Core/Satellite/Tactical 结构扩展至多币种方案。`,
    dissent: `${proposal.dissent} 另有成员提醒：多币种分散并不降低整体波动，仍需严格仓位与止损纪律。`,
    executionSteps: [
      ...proposal.executionSteps.slice(0, 2),
      "按 Core/Satellite/Tactical 分三批建仓，优先核心仓，再执行短期机会仓。",
      ...proposal.executionSteps.slice(2, 4),
    ].slice(0, 5),
  };
}

async function runOpinion(master: MasterProfile, prompt: string, question: string, feedbackNotes?: string) {
  try {
    const result = await callDeepSeekJson<Partial<MasterOpinion>>([
      {
        role: "system",
        content: "你擅长严格遵守人物风格边界，并且只输出 JSON。",
      },
      {
        role: "user",
        content: prompt,
      },
    ]);
    return { opinion: normalizeOpinion(master, result), demo: false };
  } catch (error) {
    console.error(`Master opinion fallback for ${master.id}`, error);
    return { opinion: buildDemoOpinion(master, question, feedbackNotes), demo: true };
  }
}

function buildChallenges(opinions: MasterOpinion[]) {
  if (opinions.length <= 1) return [] as ChallengePoint[];
  return opinions.map((opinion, index) => {
    const target = opinions[(index + 1) % opinions.length];
    return {
      targetMasterId: target.masterId,
      fromMasterId: opinion.masterId,
      claim: opinion.summary,
      question: `如果继续采纳你的方案，怎样证明它不会忽略 ${target.summary.slice(0, 28)} 这类风险？`,
    };
  });
}

async function runSingleDiscussion(request: DiscussionRequest): Promise<DiscussionResponse> {
  const master = await hydrateMasterSkill(masterMap.get(request.masterId ?? "buffett") ?? masterRoster[0]);
  const transcript: TranscriptMessage[] = [
    toTranscriptMessage("system", "setup", "单个大师 agent 已就位。"),
    toTranscriptMessage("user", "question", request.question),
  ];

  if (request.feedbackNotes) {
    transcript.push(toTranscriptMessage("system", "feedback", `用户要求重做：${request.feedbackNotes}`));
  }

  const prompt = buildSingleAgentPrompt(master, request.question, request.feedbackNotes, request.previousTranscript);
  const { opinion, demo } = await runOpinion(master, prompt, request.question, request.feedbackNotes);

  transcript.push(
    toTranscriptMessage("master", "analysis", opinion.summary, master),
    toTranscriptMessage(
      "moderator",
      "summary",
      `请确认你是否满意 ${master.name} 的回答。如果不满意，可以带着修改要求重新发起讨论。`,
    ),
  );

  return {
    mode: "single",
    runId: createId("run"),
    masters: [master],
    transcript,
    opinions: [opinion],
    proposal: null,
    satisfiedPrompt: `如果不满意，请告诉系统你希望 ${master.name} 修正哪些地方，然后重新讨论。`,
    demo,
  };
}

async function runCouncilDiscussion(request: DiscussionRequest): Promise<DiscussionResponse> {
  const selectedMasters = pickMasters(request.masterIds);
  if (selectedMasters.length < 2) {
    throw new Error("Council mode requires at least 2 valid selected masters");
  }

  const masters = await hydrateMasters(selectedMasters);
  const transcript: TranscriptMessage[] = [
    toTranscriptMessage("system", "setup", `委员会已成立，共 ${masters.length} 位大师参与。`),
    toTranscriptMessage("user", "question", request.question),
  ];

  if (request.feedbackNotes) {
    transcript.push(toTranscriptMessage("system", "feedback", `用户不满意上一轮结果，希望本轮修正：${request.feedbackNotes}`));
  }

  transcript.push(
    toTranscriptMessage(
      "moderator",
      "setup",
      "主持人：先请各位独立分析，不要互相模仿，再围绕核心分歧进行第二轮讨论。",
    ),
  );

  const firstRound = await Promise.all(
    masters.map((master) =>
      runOpinion(
        master,
        buildCouncilAnalysisPrompt(master, request.question, request.feedbackNotes, request.previousTranscript),
        request.question,
        request.feedbackNotes,
      ),
    ),
  );

  const opinions = firstRound.map((item) => item.opinion);
  let demo = firstRound.some((item) => item.demo);
  for (const opinion of opinions) {
    const master = masterMap.get(opinion.masterId) ?? masters[0];
    transcript.push(toTranscriptMessage("master", "analysis", opinion.summary, master));
  }

  const challenges = buildChallenges(opinions);
  if (challenges.length) {
    transcript.push(
      toTranscriptMessage(
        "moderator",
        "challenge",
        "主持人：下面进入交叉质询。每位成员只回应一个最关键的分歧点。",
      ),
    );
  }

  const rebuttalRound = await Promise.all(
    masters.map(async (master) => {
      const relatedChallenges = challenges.filter((item) => item.targetMasterId === master.id);
      if (!relatedChallenges.length) {
        return {
          opinion: opinions.find((item) => item.masterId === master.id) ?? buildDemoOpinion(master, request.question, request.feedbackNotes),
          demo: false,
        };
      }
      try {
        const result = await callDeepSeekJson<Partial<MasterOpinion>>([
          {
            role: "system",
            content: "你擅长严格遵守人物风格边界，并且只输出 JSON。",
          },
          {
            role: "user",
            content: buildChallengePrompt(master, request.question, relatedChallenges, request.feedbackNotes),
          },
        ]);
        return { opinion: normalizeOpinion(master, result), demo: false };
      } catch (error) {
        console.error(`Master rebuttal fallback for ${master.id}`, error);
        const original = opinions.find((item) => item.masterId === master.id);
        return {
          opinion: {
            ...(original ?? buildDemoOpinion(master, request.question, request.feedbackNotes)),
            summary: "我保留原判断，但会把试探仓位缩小一些，并要求先补充更多可验证的数据再继续推进。",
          },
          demo: true,
        };
      }
    }),
  );

  demo = demo || rebuttalRound.some((item) => item.demo);
  const rebuttalOpinions = rebuttalRound.map((item) => item.opinion);

  for (const opinion of rebuttalOpinions) {
    const master = masterMap.get(opinion.masterId) ?? masters[0];
    transcript.push(toTranscriptMessage("master", "rebuttal", opinion.summary, master));
  }

  let proposal: CouncilProposal;
  try {
    const result = await callDeepSeekJson<CouncilProposal>([
      {
        role: "system",
        content: "你是一个严格的委员会主持人，只输出 JSON，并把分歧、风险和用户确认事项写清楚。",
      },
      {
        role: "user",
        content: buildSynthesisPrompt(
          request.question,
          rebuttalOpinions,
          challenges,
          request.feedbackNotes,
          request.previousProposal ?? null,
        ),
      },
    ]);
    proposal = {
      ...result,
      allocations: normalizePercentages(result.allocations ?? []),
      userConfirmationsRequired: (result.userConfirmationsRequired ?? []).filter(Boolean).slice(0, 5),
      executionSteps: (result.executionSteps ?? []).filter(Boolean).slice(0, 5),
    };
    proposal = enforceDiversity(proposal);
  } catch (error) {
    console.error("Council synthesis fallback", error);
    proposal = buildDemoProposal(rebuttalOpinions, request.feedbackNotes);
    demo = true;
  }

  const voteCounts = rebuttalOpinions.reduce(
    (counts, opinion) => {
      counts[opinion.vote] += 1;
      return counts;
    },
    { approve: 0, abstain: 0, reject: 0 },
  );

  transcript.push(
    toTranscriptMessage(
      "moderator",
      "vote",
      `投票结果：赞成 ${voteCounts.approve}，保留 ${voteCounts.abstain}，反对 ${voteCounts.reject}。`,
    ),
    toTranscriptMessage("moderator", "summary", proposal.thesis),
    toTranscriptMessage(
      "system",
      "summary",
      "请检查委员会对话和最终方案。如果不满意，可以把不满意的原因发回来，系统会基于你的反馈重新开会。",
    ),
  );

  return {
    mode: "council",
    runId: createId("run"),
    masters,
    transcript,
    opinions: rebuttalOpinions,
    proposal,
    satisfiedPrompt: "如果不满意，请带着修改意见重新发起同一议题，委员会会根据你的反馈重开一轮讨论。",
    demo,
  };
}

export async function runDiscussion(request: DiscussionRequest) {
  const question = request.question.trim();
  if (!question) {
    throw new Error("Question is required");
  }
  if (request.mode === "single") {
    return runSingleDiscussion({ ...request, question });
  }
  return runCouncilDiscussion({ ...request, question });
}

export async function streamDiscussion(request: DiscussionRequest, emit: StreamEmit) {
  const question = request.question.trim();
  if (!question) {
    throw new Error("Question is required");
  }

  if (request.mode === "single") {
    return streamSingleDiscussion({ ...request, question }, emit);
  }

  return streamCouncilDiscussion({ ...request, question }, emit);
}

async function streamSingleDiscussion(request: DiscussionRequest, emit: StreamEmit): Promise<DiscussionResponse> {
  const master = await hydrateMasterSkill(masterMap.get(request.masterId ?? "buffett") ?? masterRoster[0]);
  const runId = createId("run");
  const transcript: TranscriptMessage[] = [];
  const push = async (message: TranscriptMessage) => {
    transcript.push(message);
    await emit({ event: "message", data: message });
  };

  await emit({ event: "meta", data: { mode: "single", runId, masters: [master] } });

  await push(toTranscriptMessage("system", "setup", "单个大师 agent 已就位。"));
  await push(toTranscriptMessage("user", "question", request.question));

  if (request.feedbackNotes) {
    await push(toTranscriptMessage("system", "feedback", `用户要求重做：${request.feedbackNotes}`));
  }

  const prompt = buildSingleAgentPrompt(master, request.question, request.feedbackNotes, request.previousTranscript);
  const { opinion, demo } = await runOpinion(master, prompt, request.question, request.feedbackNotes);
  await emit({ event: "opinion", data: opinion });
  await push(toTranscriptMessage("master", "analysis", opinion.summary, master));
  await push(
    toTranscriptMessage(
      "moderator",
      "summary",
      `请确认你是否满意 ${master.name} 的回答。如果不满意，可以带着修改要求重新发起讨论。`,
    ),
  );

  const response: DiscussionResponse = {
    mode: "single",
    runId,
    masters: [master],
    transcript,
    opinions: [opinion],
    proposal: null,
    satisfiedPrompt: `如果不满意，请告诉系统你希望 ${master.name} 修正哪些地方，然后重新讨论。`,
    demo,
  };
  await emit({ event: "done", data: response });
  return response;
}

async function streamCouncilDiscussion(request: DiscussionRequest, emit: StreamEmit): Promise<DiscussionResponse> {
  const selectedMasters = pickMasters(request.masterIds);
  if (selectedMasters.length < 2) {
    throw new Error("Council mode requires at least 2 valid selected masters");
  }

  const masters = await hydrateMasters(selectedMasters);
  const runId = createId("run");
  const transcript: TranscriptMessage[] = [];
  const opinions: MasterOpinion[] = [];
  let demo = false;

  const push = async (message: TranscriptMessage) => {
    transcript.push(message);
    await emit({ event: "message", data: message });
  };

  await emit({ event: "meta", data: { mode: "council", runId, masters } });

  await push(toTranscriptMessage("system", "setup", `委员会已成立，共 ${masters.length} 位大师参与。`));
  await push(toTranscriptMessage("user", "question", request.question));

  if (request.feedbackNotes) {
    await push(toTranscriptMessage("system", "feedback", `用户不满意上一轮结果，希望本轮修正：${request.feedbackNotes}`));
  }

  await push(
    toTranscriptMessage(
      "moderator",
      "setup",
      "主持人：先请各位独立分析，不要互相模仿，再围绕核心分歧进行第二轮讨论。",
    ),
  );

  for (const master of masters) {
    const result = await runOpinion(
      master,
      buildCouncilAnalysisPrompt(master, request.question, request.feedbackNotes, request.previousTranscript),
      request.question,
      request.feedbackNotes,
    );
    demo = demo || result.demo;
    opinions.push(result.opinion);
    await emit({ event: "opinion", data: result.opinion });
    await push(toTranscriptMessage("master", "analysis", result.opinion.summary, master));
  }

  const challenges = buildChallenges(opinions);
  if (challenges.length) {
    await push(
      toTranscriptMessage(
        "moderator",
        "challenge",
        "主持人：下面进入交叉质询。每位成员只回应一个最关键的分歧点。",
      ),
    );
  }

  const rebuttalOpinions: MasterOpinion[] = [];
  for (const master of masters) {
    const relatedChallenges = challenges.filter((item) => item.targetMasterId === master.id);
    if (!relatedChallenges.length) {
      const opinion = opinions.find((item) => item.masterId === master.id) ?? buildDemoOpinion(master, request.question, request.feedbackNotes);
      rebuttalOpinions.push(opinion);
      await emit({ event: "opinion", data: opinion });
      await push(toTranscriptMessage("master", "rebuttal", opinion.summary, master));
      continue;
    }

    try {
      const result = await callDeepSeekJson<Partial<MasterOpinion>>([
        {
          role: "system",
          content: "你擅长严格遵守人物风格边界，并且只输出 JSON。",
        },
        {
          role: "user",
          content: buildChallengePrompt(master, request.question, relatedChallenges, request.feedbackNotes),
        },
      ]);
      const opinion = normalizeOpinion(master, result);
      rebuttalOpinions.push(opinion);
      await emit({ event: "opinion", data: opinion });
      await push(toTranscriptMessage("master", "rebuttal", opinion.summary, master));
    } catch (error) {
      console.error(`Master rebuttal fallback for ${master.id}`, error);
      demo = true;
      const original = opinions.find((item) => item.masterId === master.id);
      const opinion = {
        ...(original ?? buildDemoOpinion(master, request.question, request.feedbackNotes)),
        summary: "我保留原判断，但会把试探仓位缩小一些，并要求先补充更多可验证的数据再继续推进。",
      };
      rebuttalOpinions.push(opinion);
      await emit({ event: "opinion", data: opinion });
      await push(toTranscriptMessage("master", "rebuttal", opinion.summary, master));
    }
  }

  let proposal: CouncilProposal;
  try {
    const result = await callDeepSeekJson<CouncilProposal>([
      {
        role: "system",
        content: "你是一个严格的委员会主持人，只输出 JSON，并把分歧、风险和用户确认事项写清楚。",
      },
      {
        role: "user",
        content: buildSynthesisPrompt(
          request.question,
          rebuttalOpinions,
          challenges,
          request.feedbackNotes,
          request.previousProposal ?? null,
        ),
      },
    ]);
    proposal = {
      ...result,
      allocations: normalizePercentages(result.allocations ?? []),
      userConfirmationsRequired: (result.userConfirmationsRequired ?? []).filter(Boolean).slice(0, 5),
      executionSteps: (result.executionSteps ?? []).filter(Boolean).slice(0, 5),
    };
  } catch (error) {
    console.error("Council synthesis fallback", error);
    proposal = buildDemoProposal(rebuttalOpinions, request.feedbackNotes);
    demo = true;
  }

  const voteCounts = rebuttalOpinions.reduce(
    (counts, opinion) => {
      counts[opinion.vote] += 1;
      return counts;
    },
    { approve: 0, abstain: 0, reject: 0 },
  );

  await push(
    toTranscriptMessage(
      "moderator",
      "vote",
      `投票结果：赞成 ${voteCounts.approve}，保留 ${voteCounts.abstain}，反对 ${voteCounts.reject}。`,
    ),
  );
  await push(toTranscriptMessage("moderator", "summary", proposal.thesis));
  await push(
    toTranscriptMessage(
      "system",
      "summary",
      "请检查委员会对话和最终方案。如果不满意，可以把不满意的原因发回来，系统会基于你的反馈重新开会。",
    ),
  );
  await emit({ event: "proposal", data: proposal });

  const response: DiscussionResponse = {
    mode: "council",
    runId,
    masters,
    transcript,
    opinions: rebuttalOpinions,
    proposal,
    satisfiedPrompt: "如果不满意，请带着修改意见重新发起同一议题，委员会会根据你的反馈重开一轮讨论。",
    demo,
  };
  await emit({ event: "done", data: response });
  return response;
}
