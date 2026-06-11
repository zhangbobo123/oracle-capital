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
    const allowedIds = new Set(masters.map((master) => master.id));
    const replies = result.replies
      .filter((reply) => allowedIds.has(reply.masterId) && reply.content?.trim())
      .slice(0, masters.length);
    if (!replies.length || !result.synthesis?.trim()) throw new Error("DeepSeek response is incomplete");
    return NextResponse.json({ replies, synthesis: result.synthesis });
  } catch (error) {
    console.error("Chat route error", error);
    return NextResponse.json({ error: "Unable to generate an AI response" }, { status: 500 });
  }
}
