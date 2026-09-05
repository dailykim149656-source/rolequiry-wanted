import { verifyEvidence } from "@/lib/ai/verify-evidence";
import { clusterEvidence, scoreEvidenceRelevance } from "@/lib/domain/evidence-relevance";
import {
  isSameSource,
  publicSearchQuery,
  searchPublicWeb,
  type WebSearchHit,
} from "@/lib/ai/web-search";
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

async function fetchSourceText(url: string): Promise<string> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1500);
    const response = await fetch(url, {
      headers: { accept: "text/html,text/plain" },
      redirect: "follow",
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!response.ok) return "";
    return (await response.text())
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 4000);
  } catch {
    return "";
  }
}

function sourceKindFor(url: string, companyWebsite?: string): ResearchSourceKind {
  if (!companyWebsite) return "FIRST_PERSON_EXPERIENCE";
  try {
    const hitHost = new URL(url).hostname.replace(/^www\./, "");
    const companyHost = new URL(companyWebsite).hostname.replace(/^www\./, "");
    return hitHost === companyHost ? "EMPLOYER_OFFICIAL" : "FIRST_PERSON_EXPERIENCE";
  } catch {
    return "FIRST_PERSON_EXPERIENCE";
  }
}

async function candidatesFromHits(
  input: ResearchClaimInput,
  hits: readonly WebSearchHit[],
): Promise<ResearchCandidate[]> {
  const posting = input.jobPostingUrl;
  const unique = hits.filter((hit) => !posting || !isSameSource(hit.url, posting));
  const researched = await Promise.all(
    unique.slice(0, 4).map(async (hit, index) => {
      const text = (await fetchSourceText(hit.url)) || hit.title;
      const verdict = verifyEvidence({
        employerStatement: input.employerStatement,
        evidenceText: text,
        sourceUrl: hit.url,
      });
      return {
        id: `hit-${index}`,
        sourceUrl: hit.url,
        sourceLabel: hit.title || hit.url,
        sourceKind: sourceKindFor(hit.url, input.companyWebsite),
        text,
        stance: verdict.stance,
        verificationStatus: verdict.verificationStatus,
        ...scoreEvidenceRelevance({
          role: input.role,
          location: "Seoul",
          evidenceText: text,
          sourceUrl: hit.url,
        }),
      };
    }),
  );
  return clusterEvidence(researched) as ResearchCandidate[];
}

export async function researchClaim(
  input: ResearchClaimInput,
): Promise<ResearchClaimResult> {
  const supportHits = await searchPublicWeb(
    publicSearchQuery({
      company: input.company,
      role: input.role,
      unresolvedVariable: input.unresolvedVariable,
    }),
  );
  const counterHits = await searchPublicWeb(
    publicSearchQuery({
      company: input.company,
      role: input.role,
      unresolvedVariable: input.unresolvedVariable,
      counter: true,
    }),
  );
  const merged = [...supportHits, ...counterHits].filter(
    (hit, index, all) => all.findIndex((item) => item.url === hit.url) === index,
  );
  let candidates = await candidatesFromHits(input, merged);
  if (candidates.length === 0 && input.jobPostingUrl) {
    const officialText = await fetchSourceText(input.jobPostingUrl);
    if (officialText) {
      const verdict = verifyEvidence({
        employerStatement: input.employerStatement,
        evidenceText: officialText,
        sourceUrl: input.jobPostingUrl,
      });
      candidates = clusterEvidence([
        {
          id: "official",
          sourceUrl: input.jobPostingUrl,
          sourceLabel: "Job posting",
          sourceKind: "EMPLOYER_OFFICIAL" as const,
          text: officialText,
          stance: verdict.stance,
          verificationStatus: verdict.verificationStatus,
          ...scoreEvidenceRelevance({
            role: input.role,
            location: "Seoul",
            evidenceText: officialText,
            sourceUrl: input.jobPostingUrl,
          }),
        },
      ]) as ResearchCandidate[];
    }
  }
  if (candidates.length > 0) {
    return { candidates, counterevidenceAttempted: true };
  }
  return {
    counterevidenceAttempted: true,
    candidates: clusterEvidence([
      {
        id: "insufficient",
        sourceUrl: input.jobPostingUrl || "https://html.duckduckgo.com/html/",
        sourceLabel: "Public web search",
        sourceKind: "FIRST_PERSON_EXPERIENCE" as const,
        text: `No independent public source confirmed ${input.unresolvedVariable}`,
        stance: "NEUTRAL" as const,
        verificationStatus: "INSUFFICIENT" as const,
        ...scoreEvidenceRelevance({
          role: input.role,
          location: "Seoul",
          evidenceText: input.unresolvedVariable,
          sourceUrl: input.jobPostingUrl || "https://html.duckduckgo.com/html/",
        }),
      },
    ]) as ResearchCandidate[],
  };
}
