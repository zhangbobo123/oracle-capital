export type AgentMasterCard = {
  id: string;
  name: string;
  en: string;
  school: string;
  quote: string;
  risk: "稳健" | "均衡" | "进取";
  uses: number;
  author: string;
  description: string;
};

export type AgentTranscriptMessage = {
  id: string;
  role: "system" | "user" | "master" | "moderator";
  stage: "setup" | "question" | "analysis" | "challenge" | "rebuttal" | "vote" | "summary" | "feedback";
  content: string;
  masterId?: string;
  masterName?: string;
};

export type AgentOpinion = {
  masterId: string;
  stance: "bullish" | "neutral" | "bearish";
  summary: string;
  thesis: string[];
  risks: string[];
  neededData: string[];
  suggestedActions: string[];
  vote: "approve" | "abstain" | "reject";
  confidence: number;
};

export type AgentProposal = {
  title: string;
  thesis: string;
  allocations: { label: string; percentage: number; rationale: string }[];
  riskLevel: "稳健" | "均衡" | "进取" | "高风险";
  expectedReturn: string;
  maxDrawdown: string;
  dissent: string;
  userConfirmationsRequired: string[];
  executionSteps: string[];
};

export type AgentDiscussionResponse = {
  mode: "single" | "council";
  runId: string;
  transcript: AgentTranscriptMessage[];
  opinions: AgentOpinion[];
  proposal: AgentProposal | null;
  satisfiedPrompt: string;
  demo: boolean;
};

const configuredBaseUrl = process.env.NEXT_PUBLIC_AGENT_API_URL?.replace(/\/+$/, "");

function agentUrl(path: string) {
  if (configuredBaseUrl) return `${configuredBaseUrl}${path}`;
  if (process.env.NODE_ENV === "development") return `http://127.0.0.1:4010${path}`;
  return path;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(agentUrl(path), init);
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(detail || `Agent API returned ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function getAgentMasters() {
  const payload = await requestJson<{ masters: AgentMasterCard[] }>("/masters", { cache: "no-store" });
  return payload.masters;
}

export async function createAgentDiscussion(input: {
  mode: "single" | "council";
  question: string;
  masterId?: string;
  masterIds?: string[];
  feedbackNotes?: string;
}) {
  return requestJson<AgentDiscussionResponse>("/discussions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function streamAgentDiscussion(input: {
  mode: "single" | "council";
  question: string;
  masterId?: string;
  masterIds?: string[];
  feedbackNotes?: string;
}) {
  const response = await fetch(agentUrl("/discussions/stream"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok || !response.body) {
    throw new Error(`Agent stream returned ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let completed: AgentDiscussionResponse | null = null;

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value, { stream: !done }).replace(/\r\n/g, "\n");
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() ?? "";

    for (const block of blocks) {
      const event = block.split("\n").find((line) => line.startsWith("event:"))?.slice(6).trim();
      const data = block.split("\n").find((line) => line.startsWith("data:"))?.slice(5).trim();
      if (!event || !data) continue;
      const payload = JSON.parse(data) as unknown;
      if (event === "error") {
        const detail = payload as { error?: string };
        throw new Error(detail.error || "Agent stream failed");
      }
      if (event === "done") completed = payload as AgentDiscussionResponse;
    }

    if (done) break;
  }

  if (!completed) throw new Error("Agent stream ended without a final result");
  return completed;
}
