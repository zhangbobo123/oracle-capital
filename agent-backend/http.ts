import { hydrateMasters } from "./skill-loader";
import { masterRoster } from "./masters";
import { runDiscussion, streamDiscussion } from "./orchestrator";
import type { DiscussionRequest, MasterCard, MasterRiskBias } from "./types";

function pseudoUsage(id: string) {
  let hash = 0;
  for (const char of id) {
    hash = (hash * 31 + char.charCodeAt(0)) % 101;
  }
  return hash;
}

function toRiskLabel(riskBias: MasterRiskBias): MasterCard["risk"] {
  if (riskBias === "conservative") return "稳健";
  if (riskBias === "aggressive") return "进取";
  return "均衡";
}

export async function handleMastersRequest() {
  const masters = await hydrateMasters(masterRoster);
  return {
    masters: masters.map((master): MasterCard => ({
      id: master.id,
      name: master.name,
      en: master.en,
      school: master.school,
      quote: master.quote,
      risk: toRiskLabel(master.riskBias),
      uses: pseudoUsage(master.id),
      author: "monarchjuno / vibe-investing",
      description: master.skillDescription || master.publicDescription,
    })),
  };
}

export async function handleDiscussionRequest(body: Partial<DiscussionRequest>) {
  const request = normalizeDiscussionRequest(body);
  return runDiscussion(request);
}

export function normalizeDiscussionRequest(body: Partial<DiscussionRequest>): DiscussionRequest {
  if (!body.mode || !["single", "council"].includes(body.mode)) {
    throw new Error("Valid discussion mode is required");
  }

  if (!body.question?.trim()) {
    throw new Error("Question is required");
  }

  return {
    mode: body.mode,
    question: body.question,
    masterId: body.masterId,
    masterIds: body.masterIds,
    feedbackNotes: body.feedbackNotes,
    previousTranscript: body.previousTranscript,
    previousProposal: body.previousProposal ?? null,
  };
}

export async function handleDiscussionStream(
  body: Partial<DiscussionRequest>,
  emit: Parameters<typeof streamDiscussion>[1],
) {
  const request = normalizeDiscussionRequest(body);
  return streamDiscussion(request, emit);
}
