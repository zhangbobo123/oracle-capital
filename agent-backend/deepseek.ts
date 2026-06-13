import { extractJson } from "./utils";

type ChatMessage = {
  role: "system" | "user";
  content: string;
};

export async function callDeepSeekJson<T>(messages: ChatMessage[]): Promise<T> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY is not configured");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);

  try {
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        temperature: 0.6,
        max_tokens: 2600,
        response_format: { type: "json_object" },
        messages,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error("DeepSeek request failed", response.status, detail.slice(0, 400));
      throw new Error("DeepSeek request failed");
    }

    const data = await response.json() as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("DeepSeek returned an empty response");
    return extractJson<T>(content);
  } finally {
    clearTimeout(timeout);
  }
}
