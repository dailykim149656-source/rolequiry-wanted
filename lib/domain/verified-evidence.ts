import { recordResearchEvidence } from "@/lib/domain/derive-case";
import type {
  EvidenceVerificationStatus,
  ResearchEvidenceInput,
  RoleCase,
} from "@/lib/domain/types";

export type VerifiedResearchEvidenceInput = ResearchEvidenceInput & {
  readonly verificationStatus: EvidenceVerificationStatus;
};

export function recordVerifiedResearchEvidence(
  roleCase: RoleCase,
  input: VerifiedResearchEvidenceInput,
): RoleCase {
  const next = recordResearchEvidence(roleCase, input);
  return {
    ...next,
    claims: next.claims.map((claim) => {
      if (claim.id !== input.claimId) return claim;
      const last = claim.evidence[claim.evidence.length - 1];
      if (!last) return claim;
      return {
        ...claim,
        evidence: [
          ...claim.evidence.slice(0, -1),
          { ...last, verificationStatus: input.verificationStatus },
        ],
      };
    }),
  };
}
