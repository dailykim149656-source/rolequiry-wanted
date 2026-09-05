import { verifyEvidence } from "@/lib/ai/verify-evidence";
import { clusterEvidence, scoreEvidenceRelevance } from "@/lib/domain/evidence-relevance";
import { chatJson } from "@/lib/ai/client";
import { hostedAiConfig } from "@/lib/ai/env";
import {
  isLowQualityHit,
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
  const unique = hits.filter((hit) => {
    if (isLowQualityHit(hit)) return false;
    if (posting && isSameSource(hit.url, posting)) return false;
    return true;
  });
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

export type ResearchQueries = {
  readonly support: string;
  readonly counter: string;
};

export function researchQueriesFromModel(
  input: ResearchClaimInput,
  proposed?: { readonly supportQuery?: string; readonly counterQuery?: string },
): ResearchQueries {
  const fallback = {
    support: publicSearchQuery({
      company: input.company,
      role: input.role,
      unresolvedVariable: input.unresolvedVariable,
    }),
    counter: publicSearchQuery({
      company: input.company,
      role: input.role,
      unresolvedVariable: input.unresolvedVariable,
      counter: true,
    }),
  };
  const support = proposed?.supportQuery?.trim();
  const counter = proposed?.counterQuery?.trim();
  return {
    support: support || fallback.support,
    counter: counter || fallback.counter,
  };
}

export function chatgptDeepDivePrompt(input: {
  readonly caseUrl: string;
  readonly company: string;
  readonly role: string;
  readonly employerStatement: string;
  readonly unresolvedVariable: string;
  readonly question?: string;
}): string {
  const question = input.question?.trim() || input.unresolvedVariable;
  return [
    'This is a Rolequiry job-fit check, not a company score.',
    'Company: ' + input.company + '.',
    'Role: ' + input.role + '.',
    'Employer claim: "' + input.employerStatement + '"',
    'What is still unknown: ' + input.unresolvedVariable + '.',
    'Check this: ' + question + '.',
    'Search the public web for supporting evidence and counterevidence for this one claim only.',
    'Return 1-3 http(s) sources with a short quote and whether each source SUPPORTS, CHALLENGES, or is INSUFFICIENT.',
    'If the sources do not settle it, say INSUFFICIENT. Do not invent a fit score.',
    'Case page, for context only: ' + input.caseUrl,
  ].join(' ');
}

export function chatgptDeepDiveHref(prompt: string): string {
  return "https://chatgpt.com/?q=" + encodeURIComponent(prompt);
}

async function hostedResearchQueries(input: ResearchClaimInput): Promise<ResearchQueries> {
  const config = hostedAiConfig();
  if (!config.enabled) return researchQueriesFromModel(input);
  const proposed = await chatJson<{ supportQuery?: string; counterQuery?: string }>({
    model: config.researchModel,
    system:
      'Return JSON {supportQuery, counterQuery} for one unresolved job-fit question. Queries must be short web searches, not answers. Include a counterevidence query.',
    user: JSON.stringify({
      company: input.company,
      role: input.role,
      employerStatement: input.employerStatement,
      unresolvedVariable: input.unresolvedVariable,
    }),
  });
  return researchQueriesFromModel(input, proposed ?? undefined);
}

export async function researchClaim(
  input: ResearchClaimInput,
): Promise<ResearchClaimResult> {
  const queries = await hostedResearchQueries(input);
  const supportHits = await searchPublicWeb(queries.support);
  const counterHits = await searchPublicWeb(queries.counter);
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
