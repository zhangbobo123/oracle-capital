import { hydrateMasters } from "./skill-loader";
import { masterRoster } from "./masters";
import { runDiscussion } from "./orchestrator";
import type { DiscussionRequest } from "./types";

export async function handleMastersRequest() {
  const masters = await hydrateMasters(masterRoster);
  return {
    masters: masters.map((master) => ({
      id: master.id,
      skillSlug: master.skillSlug,
      name: master.name,
      en: master.en,
      school: master.school,
      quote: master.quote,
      riskBias: master.riskBias,
      publicDescription: master.publicDescription,
      sourceUrl: master.sourceUrl,
      skillName: master.skillName,
      skillDescription: master.skillDescription,
      skillMarkdown: master.skillMarkdown,
    })),
  };
}

export async function handleDiscussionRequest(body: Partial<DiscussionRequest>) {
  if (!body.mode || !["single", "council"].includes(body.mode)) {
    throw new Error("Valid discussion mode is required");
  }

  if (!body.question?.trim()) {
    throw new Error("Question is required");
  }

  return runDiscussion({
    mode: body.mode,
    question: body.question,
    masterId: body.masterId,
    masterIds: body.masterIds,
    feedbackNotes: body.feedbackNotes,
    previousTranscript: body.previousTranscript,
    previousProposal: body.previousProposal ?? null,
  });
}
