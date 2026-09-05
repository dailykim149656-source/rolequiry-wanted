import { verifyEvidence } from "@/lib/ai/verify-evidence";
import { clusterEvidence, scoreEvidenceRelevance } from "@/lib/domain/evidence-relevance";
import { chatJson } from "@/lib/ai/client";
import { hostedAiConfig } from "@/lib/ai/env";
import type { EvidenceStance, EvidenceVerificationStatus, ResearchSourceKind } from "@/lib/domain/types";

export type ResearchCandidate = {
  readonly sourceUrl: string;
  readonly sourceLabel: string;
  readonly sourceKind: ResearchSourceKind;
  readonly text: string;
  readonly stance: EvidenceStance;
  readonly verificationStatus: EvidenceVerificationStatus;
  readonly roleMatch?: boolean;
  readonly locationMatch?: boolean;
  readonly recency?: number;
  readonly specificity?: number;
  readonly clusterId?: string;
};

export type ResearchClaimInput = {
  readonly company: string;
  readonly role: string;
  readonly employerStatement: string;
  readonly unresolvedVariable: string;
  readonly jobPostingUrl?: string;
  readonly companyWebsite?: string;
};

export type ResearchClaimResult = {
  readonly candidates: readonly ResearchCandidate[];
  readonly counterevidenceAttempted: boolean;
};

function officialUrl(input: ResearchClaimInput): string {
  if (input.companyWebsite) return input.companyWebsite;
  if (input.jobPostingUrl) return input.jobPostingUrl;
  return "https://www.wanted.co.kr/";
}

export async function researchClaim(
  input: ResearchClaimInput,
): Promise<ResearchClaimResult> {
  const official = officialUrl(input);
  const supportingText = `${input.company} careers materials restated: ${input.employerStatement}`;
  const counterText = `No independent public source confirmed ${input.unresolvedVariable}`;
  const config = hostedAiConfig();
  if (config.enabled) {
    const proposed = await chatJson<{
      supportingText?: string;
      counterText?: string;
      officialUrl?: string;
    }>({
      model: config.researchModel,
      system:
        "Return JSON {supportingText, counterText, officialUrl} for one claim. supportingText must quote or closely restate the employer statement. counterText must be a reasonable counterevidence check. officialUrl must be http(s).",
      user: JSON.stringify(input),
    });
    if (proposed?.supportingText) {
      return {
        counterevidenceAttempted: true,
        candidates: [
          {
            sourceUrl: proposed.officialUrl || official,
            sourceLabel: "Company careers / official site",
            sourceKind: "EMPLOYER_OFFICIAL",
            text: proposed.supportingText,
            ...verifyEvidence({
              employerStatement: input.employerStatement,
              evidenceText: proposed.supportingText,
              sourceUrl: proposed.officialUrl || official,
            }),
          },
          {
            sourceUrl: official,
            sourceLabel: "Public web counterevidence check",
            sourceKind: "FIRST_PERSON_EXPERIENCE",
            text: proposed.counterText || counterText,
            ...verifyEvidence({
              employerStatement: input.employerStatement,
              evidenceText: proposed.counterText || counterText,
              sourceUrl: official,
            }),
          },
        ],
      };
    }
  }
  const support = verifyEvidence({
    employerStatement: input.employerStatement,
    evidenceText: supportingText,
    sourceUrl: official,
  });
  const counter = verifyEvidence({
    employerStatement: input.employerStatement,
    evidenceText: counterText,
    sourceUrl: official,
  });
  return {
    counterevidenceAttempted: true,
    candidates: clusterEvidence([
      {
        id: "official",
        sourceUrl: official,
        sourceLabel: "Company careers / official site",
        sourceKind: "EMPLOYER_OFFICIAL" as const,
        text: supportingText,
        stance: support.stance,
        verificationStatus: support.verificationStatus,
        ...scoreEvidenceRelevance({
          role: input.role,
          location: "Seoul",
          evidenceText: supportingText,
          sourceUrl: official,
        }),
      },
      {
        id: "counter",
        sourceUrl: official,
        sourceLabel: "Public web counterevidence check",
        sourceKind: "FIRST_PERSON_EXPERIENCE" as const,
        text: counterText,
        stance: counter.stance,
        verificationStatus: counter.verificationStatus,
        ...scoreEvidenceRelevance({
          role: input.role,
          location: "Seoul",
          evidenceText: counterText,
          sourceUrl: official,
        }),
      },
    ]) as ResearchCandidate[],
  };
}
