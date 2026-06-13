export type MasterId =
  | "buffett"
  | "munger"
  | "lynch"
  | "graham"
  | "fisher"
  | "damodaran"
  | "taleb"
  | "druckenmiller"
  | "burry"
  | "ackman"
  | "wood"
  | "pabrai"
  | "jhunjhunwala";

export type MasterRiskBias = "conservative" | "balanced" | "aggressive";

export type TranscriptRole = "system" | "user" | "master" | "moderator";

export type TranscriptStage =
  | "setup"
  | "question"
  | "analysis"
  | "challenge"
  | "rebuttal"
  | "vote"
  | "summary"
  | "feedback";

export type VoteChoice = "approve" | "abstain" | "reject";

export type MasterProfile = {
  id: MasterId;
  skillSlug: string;
  name: string;
  en: string;
  school: string;
  quote: string;
  riskBias: MasterRiskBias;
  publicDescription: string;
  sourceUrl: string;
  skillMarkdown?: string;
  skillName?: string;
  skillDescription?: string;
};

export type MasterCard = {
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

export type TranscriptMessage = {
  id: string;
  role: TranscriptRole;
  stage: TranscriptStage;
  content: string;
  masterId?: MasterId;
  masterName?: string;
};

export type MasterOpinion = {
  masterId: MasterId;
  stance: "bullish" | "neutral" | "bearish";
  summary: string;
  thesis: string[];
  risks: string[];
  neededData: string[];
  suggestedActions: string[];
  vote: VoteChoice;
  confidence: number;
};

export type ChallengePoint = {
  targetMasterId: MasterId;
  fromMasterId: MasterId;
  claim: string;
  question: string;
};

export type ProposalAllocation = {
  label: string;
  percentage: number;
  rationale: string;
};

export type CouncilProposal = {
  title: string;
  thesis: string;
  allocations: ProposalAllocation[];
  riskLevel: "稳健" | "均衡" | "进取" | "高风险";
  expectedReturn: string;
  maxDrawdown: string;
  dissent: string;
  userConfirmationsRequired: string[];
  executionSteps: string[];
};

export type DiscussionMode = "single" | "council";

export type DiscussionRequest = {
  mode: DiscussionMode;
  question: string;
  masterId?: MasterId;
  masterIds?: MasterId[];
  feedbackNotes?: string;
  previousTranscript?: TranscriptMessage[];
  previousProposal?: CouncilProposal | null;
};

export type DiscussionResponse = {
  mode: DiscussionMode;
  runId: string;
  masters: MasterProfile[];
  transcript: TranscriptMessage[];
  opinions: MasterOpinion[];
  proposal: CouncilProposal | null;
  satisfiedPrompt: string;
  demo: boolean;
};

export type DiscussionStreamEvent =
  | { event: "meta"; data: { mode: DiscussionMode; runId: string; masters: MasterProfile[] } }
  | { event: "message"; data: TranscriptMessage }
  | { event: "opinion"; data: MasterOpinion }
  | { event: "proposal"; data: CouncilProposal }
  | { event: "done"; data: DiscussionResponse };
