import { NextResponse } from "next/server";

type MasterInput = {
  id: string;
  name: string;
  school: string;
  quote: string;
  risk: string;
};

type DeepSeekReply = {
  replies: { masterId: string; content: string }[];
  synthesis: string;
};

const easterEggs = [
  {
    test: (question: string) => /\b(btc|bitcoin)\b|比特币/i.test(question),
    masterId: "buffett",
    content: "我还是不看好 BTC：它不产生现金流，也很难用传统方法估值。好吧，如果你坚持参与，就把它当作高波动的长期实验：先设定不超过可投资资产 5% 的总预算，分成 24 份，每周定投一份，持续 6 个月；不加杠杆，不借钱买，价格翻倍后把本金逐步撤回。任何时候都要先保留 6 个月应急金。",
  },
  {
    test: (question: string) => /英国股市|英国股票|英股|伦敦股市|london stock|uk stock|british stock/i.test(question),
    masterId: "newton",
    content: "英国股市？停下，那片南海又在我眼前涨潮了！苹果会落地，行星会沿轨道运行，可伦敦交易所里的人群偏要挣脱万有引力。我能计算天体的运动，却算不出人们的疯狂。若你一定入场，把仓位拴在地面：分批买入、拒绝借贷，并为每个判断写下能被证伪的条件。",
  },
  {
    test: (question: string) => /资本|capital/i.test(question),
    masterId: "marx",
    content: "资本来到世间，每个毛孔都留着肮脏的血。先别急着看收益率：要看利润由谁创造、风险由谁承担、协议治理权属于谁，以及所谓“无风险收益”是否只是把损失转移给更弱的一方。穿透代币价格，检查真实现金流、所有权结构与清算机制。",
  },
  {
    test: (question: string) => /反过来想|倒过来想|如何失败|避免失败|逆向思考|invert/i.test(question),
    masterId: "munger",
    content: "反过来想，总是反过来想。别先问怎样赚最多，先列出怎样一定会破产：高杠杆、看不懂的协议、把相关性当分散、在流动性枯竭时被迫卖出。把这些路堵死以后，剩下那个也许不耀眼、却能让你活得足够久的方案，才值得认真考虑。",
  },
  {
    test: (question: string) => /十倍股|身边的公司|生活中发现|便利店|商场|产品体验|tenbagger/i.test(question),
    masterId: "lynch",
    content: "十倍股不一定藏在华尔街终端里，它可能就在你排队买单的地方。不过“我喜欢这个产品”只是调查的起点，不是买入理由。去看用户增长、单位经济、资产负债表和估值，然后问自己：这家公司还能把好故事变成多少年的真实利润？",
  },
  {
    test: (question: string) => /货币竞争|私人货币|央行|中央银行|通胀|通货膨胀|法币|stablecoin|稳定币/i.test(question),
    masterId: "hayek",
    content: "让货币彼此竞争吧。稳定币真正有意思的地方，不只是收益率，而是发行人能否用透明储备、自由赎回和可靠规则赢得信任。别把印在链上的承诺当作天然可信：比较储备质量、司法管辖、赎回通道与治理权，坏货币仍会用各种方式驱逐谨慎。",
  },
  {
    test: (question: string) => /看不见的手|分工|自由市场|市场机制|交易所|交换|invisible hand/i.test(question),
    masterId: "smith",
    content: "看不见的手并不等于闭着眼睛的手。市场通过价格协调分散选择，但交易要长期繁荣，仍依赖清晰规则、可信产权和对欺诈的约束。分析一个协议时，看看参与者在追求自身利益时，究竟创造了公共流动性，还是只把风险推给最后接盘的人。",
  },
  {
    test: (question: string) => /长期我们都死了|流动性陷阱|经济衰退|财政刺激|降息|利率周期|宏观周期|animal spirits|动物精神/i.test(question),
    masterId: "keynes",
    content: "长期来看，我们都死了，但这不代表今天可以不管理风险。市场会被动物精神推动，流动性也会突然消失。面对降息或刺激预期，不要只押方向：给判断设定期限，保留现金选择权，并准备好市场比你更早上涨、也比你更晚恢复理性的两种剧本。",
  },
] as const;

export const runtime = "nodejs";

function extractJson(content: string): DeepSeekReply {
  const cleaned = content.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("Model did not return JSON");
  return JSON.parse(cleaned.slice(start, end + 1)) as DeepSeekReply;
}

export async function POST(request: Request) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "DEEPSEEK_API_KEY is not configured" }, { status: 503 });
  }

  try {
    const body = await request.json() as {
      question?: string;
      masters?: MasterInput[];
      history?: { role: string; content: string }[];
    };
    const question = body.question?.trim();
    const masters = body.masters?.slice(0, 8) ?? [];
    if (!question || !masters.length) {
      return NextResponse.json({ error: "Question and masters are required" }, { status: 400 });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);
    const prompt = [
      "你是 Oracle Capital 的 AI 投资委员会编排器。",
      "角色是教育与产品演示用途的思想框架模拟，不声称代表真实人物。",
      "每位成员必须基于自己的投资流派独立回答，观点应明显不同，不得编造实时行情。",
      "涉及现货、DeFi 或合约时，必须说明主要风险、仓位约束和需要用户确认的信息。",
      "禁止承诺收益，禁止声称已替用户执行交易。",
      `成员：${JSON.stringify(masters)}`,
      `用户问题：${question}`,
      `最近对话：${JSON.stringify(body.history ?? [])}`,
      "只返回严格 JSON，不要 Markdown。",
      '{"replies":[{"masterId":"成员id","content":"该成员的中文观点，100-180字"}],"synthesis":"中文综合结论，120-220字，含风险提醒和下一步"}',
    ].join("\n");

    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        temperature: 0.75,
        max_tokens: 1800,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "你擅长用多种投资哲学分析数字资产，并严格输出 JSON。" },
          { role: "user", content: prompt },
        ],
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      const detail = await response.text();
      console.error("DeepSeek request failed", response.status, detail.slice(0, 300));
      return NextResponse.json({ error: "DeepSeek request failed" }, { status: 502 });
    }

    const data = await response.json() as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("DeepSeek returned an empty response");
    const result = extractJson(content);
    const selectedIds = new Set(masters.map((master) => master.id));
    const triggeredEggs = easterEggs.filter((egg) => selectedIds.has(egg.masterId) && egg.test(question));
    const allowedIds = selectedIds;
    const replies = result.replies
      .filter((reply) => allowedIds.has(reply.masterId) && reply.content?.trim())
      .slice(0, masters.length);
    for (const egg of triggeredEggs) {
      const existing = replies.findIndex((reply) => reply.masterId === egg.masterId);
      if (existing >= 0) {
        replies[existing] = { masterId: egg.masterId, content: egg.content };
      } else {
        replies.push({ masterId: egg.masterId, content: egg.content });
      }
    }
    if (!replies.length || !result.synthesis?.trim()) throw new Error("DeepSeek response is incomplete");
    const synthesis = triggeredEggs.length
      ? `${result.synthesis}\n\n彩蛋已触发：${triggeredEggs.map((egg) => egg.masterId).join("、")} 给出了隐藏观点。`
      : result.synthesis;
    return NextResponse.json({ replies, synthesis });
  } catch (error) {
    console.error("Chat route error", error);
    return NextResponse.json({ error: "Unable to generate an AI response" }, { status: 500 });
  }
}
