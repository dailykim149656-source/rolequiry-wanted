import type { EvidenceStance, EvidenceVerificationStatus } from "@/lib/domain/types";
import { chatJson } from "@/lib/ai/client";

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

export async function verifyEvidenceWithEscalation(
  input: VerifyEvidenceInput & {
    readonly escalate?: boolean;
    readonly escalationModel?: string;
  },
) {
  const first = verifyEvidence(input);
  if (first.verificationStatus !== "INSUFFICIENT" || !input.escalate) {
    return { ...first, escalated: false, model: "gpt-5.6-luna" };
  }
  const proposed = await chatJson<{
    stance?: EvidenceStance;
    verificationStatus?: EvidenceVerificationStatus;
  }>({
    model: input.escalationModel ?? "gpt-5.6-terra",
    system:
      "Return JSON {stance, verificationStatus} for one claim and one source. Prefer INSUFFICIENT when the source does not settle the claim.",
    user: JSON.stringify(input),
  });
  const second = proposed?.verificationStatus
    ? {
        stance: proposed.stance ?? "NEUTRAL",
        verificationStatus: proposed.verificationStatus,
      }
    : first;
  return {
    ...second,
    escalated: true,
    model: input.escalationModel ?? "gpt-5.6-terra",
  };
}
