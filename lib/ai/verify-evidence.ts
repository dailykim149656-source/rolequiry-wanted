import type { EvidenceStance, EvidenceVerificationStatus } from "@/lib/domain/types";
import { chatJson } from "@/lib/ai/client";
import { hostedAiConfig } from "@/lib/ai/env";

export type VerifyEvidenceInput = {
  readonly employerStatement: string;
  readonly evidenceText: string;
  readonly sourceUrl: string;
};

export type VerifyEvidenceResult = {
  readonly stance: EvidenceStance;
  readonly verificationStatus: EvidenceVerificationStatus;
};

function tokens(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9가-힣%]+/g, " ")
    .split(" ")
    .filter((token) => token.length > 2);
}

export function verifyEvidence(input: VerifyEvidenceInput): VerifyEvidenceResult {
  const claim = input.employerStatement.trim();
  const text = input.evidenceText.trim();
  if (!claim || !text) {
    return { stance: "NEUTRAL", verificationStatus: "INSUFFICIENT" };
  }
  const quoteMatch = text.includes(claim) || (claim.length >= 24 && claim.includes(text) && text.length >= 24);
  const claimTokens = tokens(claim);
  const textTokens = new Set(tokens(text));
  const overlap = claimTokens.filter((token) => textTokens.has(token)).length;
  const enoughOverlap = overlap >= Math.max(2, Math.ceil(claimTokens.length * 0.5));
  if (!quoteMatch && !enoughOverlap) {
    return { stance: "NEUTRAL", verificationStatus: "INSUFFICIENT" };
  }
  const challenges =
    /not|no |never|unlike|contrary|반박|아니다|없음/.test(text.toLowerCase());
  return {
    stance: challenges ? "CHALLENGES" : "SUPPORTS",
    verificationStatus: "INSUFFICIENT",
  };
}

async function modelVerdict(
  input: VerifyEvidenceInput,
  model: string,
): Promise<VerifyEvidenceResult | null> {
  const proposed = await chatJson<{
    stance?: EvidenceStance;
    verificationStatus?: EvidenceVerificationStatus;
  }>({
    model,
    system:
      "Return JSON {stance, verificationStatus} for one claim and one source. Prefer INSUFFICIENT when the source does not settle the claim.",
    user: JSON.stringify(input),
  });
  if (!proposed?.verificationStatus) return null;
  return {
    stance: proposed.stance ?? "NEUTRAL",
    verificationStatus: proposed.verificationStatus,
  };
}

export async function verifyEvidenceWithLuna(input: VerifyEvidenceInput) {
  const config = hostedAiConfig();
  const model = config.verifierModel || "gpt-5.6-luna";
  const lexical = verifyEvidence(input);
  if (lexical.verificationStatus === "INSUFFICIENT" && lexical.stance === "NEUTRAL") {
    return { ...lexical, escalated: false, model };
  }
  const luna = await modelVerdict(input, model);
  return {
    ...(luna ?? lexical),
    escalated: false,
    model,
  };
}

export async function verifyEvidenceWithEscalation(
  input: VerifyEvidenceInput & {
    readonly escalate?: boolean;
    readonly verifierModel?: string;
    readonly escalationModel?: string;
  },
) {
  const config = hostedAiConfig();
  const verifierModel = input.verifierModel ?? config.verifierModel ?? "gpt-5.6-luna";
  const escalationModel = input.escalationModel ?? config.escalationModel ?? "gpt-5.6-terra";
  const lexical = verifyEvidence(input);
  if (lexical.verificationStatus === "INSUFFICIENT" && lexical.stance === "NEUTRAL") {
    return { ...lexical, escalated: false, model: verifierModel };
  }
  const luna = (await modelVerdict(input, verifierModel)) ?? lexical;
  if (!input.escalate || luna.verificationStatus !== "INSUFFICIENT") {
    return { ...luna, escalated: false, model: verifierModel };
  }
  const terra = (await modelVerdict(input, escalationModel)) ?? luna;
  return { ...terra, escalated: true, model: escalationModel };
}
