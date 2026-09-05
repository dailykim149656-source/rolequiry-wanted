import { MAX_IDENTIFIER_LENGTH } from "./limits";
import {
  authorityEvidence,
  claimStatus,
  deriveClaimKind,
  probePriority,
  caseOrganizationFor,
  tensionFor,
  unresolvednessFor,
} from "./policy";
import type {
  DerivedCase,
  DerivedClaim,
  Importance,
  ImportedRoleInput,
  InterviewAnswerInput,
  ResearchEvidenceInput,
  RoleCase,
  SourceClaim,
} from "./types";
import {
  AUTHORITY_SCOPE,
  CASE_ORIGIN,
  EVIDENCE_PROVENANCE,
  IMPORTANCE,
  RESEARCH_SOURCE_KIND,
  SOURCE_KIND,
} from "./types";

function nextEvidenceId(
  claim: SourceClaim,
  channel: "interview" | "research",
): string {
  const existingIds = new Set(claim.evidence.map((evidence) => evidence.id));
  let sequence = claim.evidence.length + 1;
  const candidateFor = (value: number) => {
    const suffix = `-${channel}-${value}`;
    const prefix = claim.id.slice(0, MAX_IDENTIFIER_LENGTH - suffix.length);
    return `${prefix}${suffix}`;
  };
  let candidate = candidateFor(sequence);
  while (existingIds.has(candidate)) {
    sequence += 1;
    candidate = candidateFor(sequence);
  }
  return candidate;
}

function stableTextCompare(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

export function importedRoleCaseId(company: string): string {
  const prefix = "imported-";
  const slug = company
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${prefix}${slug.slice(0, MAX_IDENTIFIER_LENGTH - prefix.length)}`;
}

function deriveClaim(
  claim: SourceClaim,
  caseOrganization: string,
): DerivedClaim {
  const kind = deriveClaimKind(claim);
  const trusted = authorityEvidence(claim.evidence, caseOrganization);
  const unresolvedness = unresolvednessFor(kind, trusted);
  const tension = tensionFor(trusted);
  const ranking = probePriority({
    importance: claim.importance,
    unresolvedness,
    tension,
    requireCandidateImportance: claim.importanceSetByCandidate === false,
  });
  return {
    id: claim.id,
    dimension: claim.dimension,
    employerStatement: claim.employerStatement,
    importance: claim.importance,
    candidatePrioritySet: claim.importanceSetByCandidate !== false,
    kind,
    unresolvedVariable: claim.unresolvedVariable,
    measurableForm: claim.measurableForm,
    evidence: claim.evidence,
    unresolvedness,
    tension,
    probeEligible: ranking.probeEligible,
    probePriority: ranking.probePriority,
    status: claimStatus({
      importance: claim.importance,
      unresolvedness,
      tension,
    }),
  };
}

export function deriveCase(roleCase: RoleCase): DerivedCase {
  const caseOrganization = caseOrganizationFor({
    ...(roleCase.sourceUrl ? { sourceUrl: roleCase.sourceUrl } : {}),
    ...(roleCase.jobPostingUrl ? { jobPostingUrl: roleCase.jobPostingUrl } : {}),
    ...(roleCase.companyWebsite ? { companyWebsite: roleCase.companyWebsite } : {}),
    ...(roleCase.employerDomain ? { employerDomain: roleCase.employerDomain } : {}),
  });
  const claims = roleCase.claims.map((claim) =>
    deriveClaim(claim, caseOrganization),
  );
  const eligible = claims.filter((claim) => claim.probeEligible);
  const top = eligible.reduce<DerivedClaim | null>((best, claim) => {
    if (!best) return claim;
    if (claim.probePriority > best.probePriority) return claim;
    if (claim.probePriority < best.probePriority) return best;
    const dimensionOrder = stableTextCompare(claim.dimension, best.dimension);
    if (dimensionOrder < 0) return claim;
    if (dimensionOrder > 0) return best;
    return stableTextCompare(claim.id, best.id) < 0 ? claim : best;
  }, null);
  return {
    id: roleCase.id,
    company: roleCase.company,
    role: roleCase.role,
    origin: roleCase.origin,
    claims,
    topProbeId: top?.id ?? null,
  };
}

export function setClaimImportance(
  roleCase: RoleCase,
  claimId: string,
  importance: Importance,
): RoleCase {
  return {
    ...roleCase,
    claims: roleCase.claims.map((claim) =>
      claim.id === claimId
        ? { ...claim, importance, importanceSetByCandidate: true }
        : claim,
    ),
  };
}

export function recordInterviewAnswer(
  roleCase: RoleCase,
  input: InterviewAnswerInput,
): RoleCase {
  return {
    ...roleCase,
    claims: roleCase.claims.map((claim) => {
      if (claim.id !== input.claimId) return claim;
      const nextEvidence = [
        ...claim.evidence,
        {
          id: nextEvidenceId(claim, "interview"),
          scope: AUTHORITY_SCOPE.CANDIDATE_SPECIFIC_ANSWER,
          stance: input.stance,
          text: input.text,
          speakerRole: input.speakerRole,
          sourceKind: SOURCE_KIND.INTERVIEW,
          sourceLabel: input.speakerRole,
          synthetic: false,
          provenance: EVIDENCE_PROVENANCE.CANDIDATE_REPORTED,
        },
      ];
      return { ...claim, evidence: nextEvidence };
    }),
  };
}

export function recordResearchEvidence(
  roleCase: RoleCase,
  input: ResearchEvidenceInput,
): RoleCase {
  const scope =
    input.sourceKind === RESEARCH_SOURCE_KIND.EMPLOYER_OFFICIAL
      ? AUTHORITY_SCOPE.EMPLOYER_STATED
      : AUTHORITY_SCOPE.REPORTED_EXPERIENCE;
  const sourceKind =
    input.sourceKind === RESEARCH_SOURCE_KIND.EMPLOYER_OFFICIAL
      ? SOURCE_KIND.EMPLOYER_POSTING
      : SOURCE_KIND.REPORTED_EXPERIENCE;
  return {
    ...roleCase,
    claims: roleCase.claims.map((claim) => {
      if (claim.id !== input.claimId) return claim;
      return {
        ...claim,
        evidence: [
          ...claim.evidence,
          {
            id: nextEvidenceId(claim, "research"),
            scope,
            stance: input.stance,
            text: input.text,
            sourceKind,
            sourceLabel: input.sourceLabel,
            sourceUrl: input.sourceUrl,
            synthetic: false,
            provenance: EVIDENCE_PROVENANCE.AGENT_REPORTED,
            sourceCategory: input.sourceKind,
          },
        ],
      };
    }),
  };
}

export function importRoleFromClaims(input: ImportedRoleInput): RoleCase {
  return {
    id: importedRoleCaseId(input.company),
    company: input.company.trim(),
    role: input.role.trim(),
    ...(input.sourceUrl ? { sourceUrl: input.sourceUrl } : {}),
    ...(input.jobPostingUrl ? { jobPostingUrl: input.jobPostingUrl } : {}),
    ...(input.companyWebsite ? { companyWebsite: input.companyWebsite } : {}),
    ...(input.employerDomain ? { employerDomain: input.employerDomain } : {}),
    origin: CASE_ORIGIN.AGENT_IMPORTED,
    claims: input.claims.map((claim, index) => ({
      id: `imported-${index + 1}`,
      dimension: claim.dimension.trim(),
      employerStatement: claim.employerStatement.trim(),
      unresolvedVariable: claim.unresolvedVariable.trim(),
      measurableForm: claim.measurableForm.trim(),
      importance: IMPORTANCE.MEDIUM,
      importanceSetByCandidate: false,
      evidence: [
        {
          id: `imported-${index + 1}-employer`,
          scope: AUTHORITY_SCOPE.EMPLOYER_STATED,
          stance: "SUPPORTS",
          text: claim.employerStatement.trim(),
          sourceKind: SOURCE_KIND.EMPLOYER_POSTING,
          sourceLabel: "Imported employer statement",
          synthetic: false,
          provenance: EVIDENCE_PROVENANCE.CASE_INPUT,
        },
      ],
    })),
  };
}
