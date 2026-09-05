import {
  AUTHORITY_SCOPE,
  type AuthorityScope,
  CLAIM_KIND,
  type ClaimKind,
  type ClaimStatus,
  EVIDENCE_PROVENANCE,
  type Evidence,
  IMPORTANCE,
  type Importance,
} from "./types";

export { IMPORTANCE };

export const IMPORTANCE_WEIGHT = {
  LOW: 0.25,
  MEDIUM: 0.5,
  HIGH: 0.75,
  CRITICAL: 1,
} as const satisfies Record<Importance, number>;

export const LIVED_EXPERIENCE_WEIGHT = {
  EMPLOYER_STATED: 0.2,
  REPORTED_EXPERIENCE: 0.3,
  CANDIDATE_SPECIFIC_ANSWER: 0.5,
} as const satisfies Record<AuthorityScope, number>;

export const PROBE_PRIORITY_WEIGHT = {
  IMPORTANCE: 0.4,
  UNRESOLVEDNESS: 0.3,
  TENSION: 0.3,
} as const;

const EXPLICIT_POLICY_STATEMENT =
  /(visa sponsorship|remote-first|on-site required|hybrid work|paid time off|equity granted|relocation assistance)/i;
const COMPENSATION_CONTEXT =
  /\b(base pay|base salary|salary|compensation|pay band|pay range|bonus|equity|commission|hourly rate|ote|rsu)\b/i;
const COMPENSATION_AMOUNT =
  /(\$\s?\d|\b\d{1,3}(,\d{3})+\b|\b\d{2,3}k\b|\b\d+(\.\d+)?\s*%|\b\d[\d,.]*\s*usd\b)/i;

export function deriveClaimKind(input: {
  readonly dimension: string;
  readonly employerStatement: string;
  readonly kind?: ClaimKind;
}): ClaimKind {
  if (input.kind) return input.kind;
  const claimText = `${input.dimension} ${input.employerStatement}`;
  const isPolicy =
    EXPLICIT_POLICY_STATEMENT.test(input.employerStatement) ||
    (COMPENSATION_CONTEXT.test(claimText) &&
      COMPENSATION_AMOUNT.test(input.employerStatement));
  return isPolicy ? CLAIM_KIND.EMPLOYER_POLICY : CLAIM_KIND.LIVED_EXPERIENCE;
}

export function requiredScopes(kind: ClaimKind): readonly AuthorityScope[] {
  if (kind === CLAIM_KIND.EMPLOYER_POLICY)
    return [AUTHORITY_SCOPE.EMPLOYER_STATED];
  return [
    AUTHORITY_SCOPE.EMPLOYER_STATED,
    AUTHORITY_SCOPE.REPORTED_EXPERIENCE,
    AUTHORITY_SCOPE.CANDIDATE_SPECIFIC_ANSWER,
  ];
}

const MULTI_PART_SUFFIXES = [
  "co.kr",
  "or.kr",
  "ac.kr",
  "go.kr",
  "ne.kr",
  "co.uk",
  "org.uk",
  "ac.uk",
  "gov.uk",
  "co.jp",
  "or.jp",
  "ne.jp",
  "ac.jp",
  "go.jp",
  "com.au",
  "net.au",
  "org.au",
  "com.br",
  "co.nz",
  "com.sg",
] as const;

const HOSTED_PLATFORMS = [
  "github.io",
  "substack.com",
  "medium.com",
  "wordpress.com",
  "blogspot.com",
] as const;

export function sourceOrganization(url?: string): string {
  if (!url) return "";
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    const parts = host.split(".").filter(Boolean);
    if (parts.length <= 2) return host;
    for (const platform of HOSTED_PLATFORMS) {
      if (host === platform) return host;
      if (host.endsWith(`.${platform}`)) {
        const extra = platform.split(".").length + 1;
        return parts.slice(-extra).join(".");
      }
    }
    for (const suffix of MULTI_PART_SUFFIXES) {
      if (host === suffix || host.endsWith(`.${suffix}`)) {
        const extra = suffix.split(".").length + 1;
        return parts.slice(-extra).join(".");
      }
    }
    return parts.slice(-2).join(".");
  } catch {
    return url.toLowerCase();
  }
}

const ATS_HOSTS = new Set([
  "wanted.co.kr",
  "www.wanted.co.kr",
  "linkedin.com",
  "www.linkedin.com",
  "greenhouse.io",
  "boards.greenhouse.io",
  "lever.co",
  "jobs.lever.co",
]);

export function caseOrganizationFor(input: {
  readonly sourceUrl?: string;
  readonly jobPostingUrl?: string;
  readonly companyWebsite?: string;
  readonly employerDomain?: string;
}): string {
  if (input.employerDomain?.trim()) {
    return input.employerDomain.trim().toLowerCase().replace(/^www\./, "");
  }
  if (input.companyWebsite) return sourceOrganization(input.companyWebsite);
  const posting = sourceOrganization(input.jobPostingUrl || input.sourceUrl);
  if (ATS_HOSTS.has(posting) || posting.endsWith(".wanted.co.kr")) return "";
  return posting;
}

// App-owned check on an agent-declared employer source: does its organization
// match the job posting's organization? Null when the check does not apply
// (non-employer evidence) or cannot run (missing URLs). This verifies domain
// consistency at record time, not authorship.
export function employerSourceOrganizationMatch(
  evidence: Evidence,
  caseOrganization: string,
): boolean | null {
  const provenance = evidence.provenance ?? EVIDENCE_PROVENANCE.CASE_INPUT;
  if (provenance !== EVIDENCE_PROVENANCE.AGENT_REPORTED) return null;
  if (evidence.scope !== AUTHORITY_SCOPE.EMPLOYER_STATED) return null;
  if (!caseOrganization || !evidence.sourceUrl) return null;
  return sourceOrganization(evidence.sourceUrl) === caseOrganization;
}

// Evidence that may enter authority math. An agent-declared employer-official
// source earns employer authority only when its organization verifiably
// matches the job posting's (match === true). Mismatched and unverifiable
// declarations — including any employer declaration on a case that has no
// posting URL to check against — stay recorded and visible, but they must not
// count as employer authority in coverage or tension, so a wrong, malicious,
// or uncheckable declaration cannot settle or challenge a claim.
export function authorityEvidence(
  evidence: readonly Evidence[],
  caseOrganization: string,
): readonly Evidence[] {
  return evidence.filter((item) => {
    if (
      item.verificationStatus === "INSUFFICIENT" ||
      item.verificationStatus === "REJECTED"
    ) {
      return false;
    }
    const provenance = item.provenance ?? EVIDENCE_PROVENANCE.CASE_INPUT;
    const agentDeclaredEmployer =
      provenance === EVIDENCE_PROVENANCE.AGENT_REPORTED &&
      item.scope === AUTHORITY_SCOPE.EMPLOYER_STATED;
    if (!agentDeclaredEmployer) return true;
    return employerSourceOrganizationMatch(item, caseOrganization) === true;
  });
}

function uniqueReportedCount(
  evidence: readonly Evidence[],
  stance?: "SUPPORTS" | "CHALLENGES",
): number {
  const reports = evidence.filter((item) => {
    if (item.scope !== AUTHORITY_SCOPE.REPORTED_EXPERIENCE) return false;
    if (item.sourceCategory === "OTHER_PUBLIC") return false;
    if (!stance) return item.stance !== "NEUTRAL";
    return item.stance === stance;
  });
  const seen = new Set<string>();
  let unlabeled = 0;
  for (const item of reports) {
    const org = sourceOrganization(item.sourceUrl);
    if (!org) {
      unlabeled += 1;
      continue;
    }
    seen.add(org);
  }
  return seen.size + unlabeled;
}

export function uniqueResolvingReportCount(
  evidence: readonly Evidence[],
): number {
  return uniqueReportedCount(evidence);
}

export function uniqueSupportingReportCount(
  evidence: readonly Evidence[],
): number {
  return uniqueReportedCount(evidence, "SUPPORTS");
}

export function uniqueChallengingReportCount(
  evidence: readonly Evidence[],
): number {
  return uniqueReportedCount(evidence, "CHALLENGES");
}

export function reportedCoverage(reportCount: number): number {
  if (reportCount <= 0) return 0;
  if (reportCount === 1) return 0.3;
  if (reportCount === 2) return 0.55;
  if (reportCount === 3) return 0.7;
  return 1;
}

export function reportedChallengeTension(challengingCount: number): number {
  if (challengingCount <= 0) return 0;
  if (challengingCount === 1) return 0.5;
  if (challengingCount === 2) return 0.7;
  return 0.9;
}

export function coverageBreakdownFor(
  kind: ClaimKind,
  evidence: readonly Evidence[],
) {
  const employerPresent = evidence.some(
    (item) => item.scope === AUTHORITY_SCOPE.EMPLOYER_STATED,
  );
  const answers = evidence.filter(
    (item) => item.scope === AUTHORITY_SCOPE.CANDIDATE_SPECIFIC_ANSWER,
  );
  const resolvingAnswer = answers.some((item) => item.stance !== "NEUTRAL");
  const uniqueReports = uniqueResolvingReportCount(evidence);
  const reportCoverage = reportedCoverage(uniqueReports);
  if (kind === CLAIM_KIND.EMPLOYER_POLICY) {
    return {
      employerStated: {
        present: employerPresent,
        contribution: employerPresent ? 1 : 0,
      },
      reportedExperience: {
        count: uniqueReports,
        coverage: reportCoverage,
        contribution: 0,
      },
      candidateSpecificAnswer: {
        present: answers.length > 0,
        resolving: resolvingAnswer,
        contribution: 0,
      },
      covered: employerPresent ? 1 : 0,
    } as const;
  }
  const employerContribution = employerPresent
    ? LIVED_EXPERIENCE_WEIGHT.EMPLOYER_STATED
    : 0;
  const reportedContribution =
    LIVED_EXPERIENCE_WEIGHT.REPORTED_EXPERIENCE * reportCoverage;
  const answerContribution = resolvingAnswer
    ? LIVED_EXPERIENCE_WEIGHT.CANDIDATE_SPECIFIC_ANSWER
    : 0;
  return {
    employerStated: {
      present: employerPresent,
      contribution: employerContribution,
    },
    reportedExperience: {
      count: uniqueReports,
      coverage: reportCoverage,
      contribution: reportedContribution,
    },
    candidateSpecificAnswer: {
      present: answers.length > 0,
      resolving: resolvingAnswer,
      contribution: answerContribution,
    },
    covered: employerContribution + reportedContribution + answerContribution,
  } as const;
}

export function unresolvednessFor(
  kind: ClaimKind,
  evidence: readonly Evidence[],
): number {
  return 1 - coverageBreakdownFor(kind, evidence).covered;
}

export function tensionFor(evidence: readonly Evidence[]): number {
  const hasChallengingAnswer = evidence.some(
    (item) =>
      item.scope === AUTHORITY_SCOPE.CANDIDATE_SPECIFIC_ANSWER &&
      item.stance === "CHALLENGES",
  );
  if (hasChallengingAnswer) return 1;
  const hasOfficialChallenge = evidence.some(
    (item) =>
      item.scope === AUTHORITY_SCOPE.EMPLOYER_STATED &&
      item.stance === "CHALLENGES",
  );
  if (hasOfficialChallenge) return 1;
  return reportedChallengeTension(uniqueChallengingReportCount(evidence));
}

export function claimStatus(input: {
  readonly importance: Importance;
  readonly unresolvedness: number;
  readonly tension: number;
}): ClaimStatus {
  if (input.unresolvedness <= 0.35 && input.tension < 0.7) return "SUPPORTED";
  if (input.tension >= 0.7) return "CHALLENGED";
  if (
    IMPORTANCE_WEIGHT[input.importance] >= 0.75 &&
    input.unresolvedness >= 0.35
  ) {
    return "MATERIAL_AMBIGUITY";
  }
  return "UNVERIFIED";
}

export function probePriority(input: {
  readonly importance: Importance;
  readonly unresolvedness: number;
  readonly tension: number;
  readonly requireCandidateImportance?: boolean;
}): { readonly probeEligible: boolean; readonly probePriority: number } {
  if (input.requireCandidateImportance) {
    return { probeEligible: false, probePriority: 0 };
  }
  const probeEligible = input.unresolvedness >= 0.35;
  if (!probeEligible) return { probeEligible, probePriority: 0 };
  return {
    probeEligible,
    probePriority:
      PROBE_PRIORITY_WEIGHT.IMPORTANCE * IMPORTANCE_WEIGHT[input.importance] +
      PROBE_PRIORITY_WEIGHT.UNRESOLVEDNESS * input.unresolvedness +
      PROBE_PRIORITY_WEIGHT.TENSION * input.tension,
  };
}
