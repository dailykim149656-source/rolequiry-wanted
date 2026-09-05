import { verifyEvidence } from "@/lib/ai/verify-evidence";
import { fetchPublicText } from "@/lib/webmcp/http-url";
import { clusterEvidence, scoreEvidenceRelevance } from "@/lib/domain/evidence-relevance";
import { chatJson } from "@/lib/ai/client";
import { hostedAiConfig } from "@/lib/ai/env";
import {
  isLowQualityHit,
  isRestrictedFetchHost,
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
  if (isRestrictedFetchHost(url)) return "";
  return fetchPublicText(url);
}

function sourceKindFor(
  url: string,
  text: string,
  companyWebsite?: string,
): ResearchSourceKind {
  try {
    const hitHost = new URL(url).hostname.replace(/^www\./, "");
    if (companyWebsite) {
      const companyHost = new URL(companyWebsite).hostname.replace(/^www\./, "");
      if (hitHost === companyHost) return "EMPLOYER_OFFICIAL";
    }
  } catch {
    return "OTHER_PUBLIC";
  }
  const body = text.toLowerCase();
  if (/i worked|we shipped|저는 .{0,12}일했|전직|현직|우리 팀/.test(body)) {
    return "FIRST_PERSON_EXPERIENCE";
  }
  return "OTHER_PUBLIC";
}

function usableHits(
  input: ResearchClaimInput,
  hits: readonly WebSearchHit[],
): WebSearchHit[] {
  const posting = input.jobPostingUrl;
  const unique: WebSearchHit[] = [];
  for (const hit of hits) {
    if (isLowQualityHit(hit) || isRestrictedFetchHost(hit.url)) continue;
    if (posting && isSameSource(hit.url, posting)) continue;
    if (unique.some((item) => item.url === hit.url)) continue;
    unique.push(hit);
  }
  return unique;
}

async function candidatesFromHits(
  input: ResearchClaimInput,
  hits: readonly WebSearchHit[],
  idPrefix: string,
): Promise<ResearchCandidate[]> {
  const researched = await Promise.all(
    usableHits(input, hits).slice(0, 2).map(async (hit, index) => {
      const fetched = await fetchSourceText(hit.url);
      const text = fetched || hit.title;
      const verdict = fetched
        ? verifyEvidence({
            employerStatement: input.employerStatement,
            evidenceText: fetched,
            sourceUrl: hit.url,
          })
        : { stance: "NEUTRAL" as const, verificationStatus: "INSUFFICIENT" as const };
      return {
        id: `${idPrefix}-${index}`,
        sourceUrl: hit.url,
        sourceLabel: hit.title || hit.url,
        sourceKind: sourceKindFor(hit.url, text, input.companyWebsite),
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
      'Return JSON {supportQuery, counterQuery}. Short open-web searches for first-hand team experience, not review-site names. Support: worked at / day-to-day / engineering culture. Counter: approval process / micromanagement / limited decision rights. Never name Blind, Glassdoor, or Remember.',
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
  const support = await candidatesFromHits(input, supportHits, "support");
  const counter = await candidatesFromHits(
    input,
    counterHits.filter((hit) => support.every((item) => item.sourceUrl !== hit.url)),
    "counter",
  );
  const candidates = [...support, ...counter];
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
        sourceKind: "OTHER_PUBLIC" as const,
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
