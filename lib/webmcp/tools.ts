import type { CaseStore } from "@/lib/case-store";
import { deriveDossier } from "@/lib/domain/dossier";
import {
  authorityEvidence,
  coverageBreakdownFor,
  sourceOrganization,
} from "@/lib/domain/policy";
import { noProbeDetails } from "@/lib/domain/probe-outcome";
import {
  AUTHORITY_SCOPE,
  EVIDENCE_PROVENANCE,
  EVIDENCE_STANCE,
  RESEARCH_SOURCE_KIND,
  type ResearchSourceKind,
  SPEAKER_ROLE,
  type SpeakerRole,
} from "@/lib/domain/types";
import { getCaseState } from "@/lib/webmcp/case-state";
import { normalizeHttpUrl } from "@/lib/webmcp/http-url";
import {
  hasOversizedInput,
  WEBMCP_INPUT_LIMITS,
} from "@/lib/webmcp/input-limits";

export function getRoleClaims(store: CaseStore) {
  const { source } = store.getState();
  return {
    company: source.company,
    role: source.role,
    origin: source.origin,
    sourceUrl: source.sourceUrl ?? null,
    untrustedContentHint: true,
    claims: source.claims.map((claim) => ({
      id: claim.id,
      dimension: claim.dimension,
      employerStatement: claim.employerStatement,
      sourceSnippets: claim.evidence
        .filter(
          (item) =>
            item.scope === AUTHORITY_SCOPE.EMPLOYER_STATED &&
            (item.provenance ?? EVIDENCE_PROVENANCE.CASE_INPUT) ===
              EVIDENCE_PROVENANCE.CASE_INPUT,
        )
        .map((item) => item.text),
    })),
  };
}

export function selectDecisionChanger(store: CaseStore) {
  const snapshot = store.getState();
  if (
    snapshot.source.origin === "AGENT_IMPORTED" &&
    !snapshot.prioritiesTouched
  ) {
    return {
      ok: true as const,
      outcome: "PRIORITIES_REQUIRED" as const,
      claim_id: null,
      claim_kind: null,
      status: null,
      unresolved_variable: null,
      measurable_form: null,
      authorityCoverage: null,
    };
  }
  const derived = store.peekDecision();
  const selected = derived.claims.find(
    (claim) => claim.id === derived.topProbeId,
  );
  if (!selected) {
    const noProbe = noProbeDetails(derived);
    store.clearSelection();
    return {
      ok: true as const,
      outcome: "NO_PROBE_NEEDED" as const,
      reason: noProbe.reason,
      unprioritized_lived_claims: noProbe.unprioritizedLivedClaimCount,
      claim_id: null,
      claim_kind: null,
      status: null,
      unresolved_variable: null,
      measurable_form: null,
      authorityCoverage: null,
    };
  }
  store.selectDecisionChanger();
  return {
    ok: true as const,
    outcome: "PROBE_SELECTED" as const,
    claim_id: selected.id,
    claim_kind: selected.kind,
    status: selected.status,
    unresolved_variable: selected.unresolvedVariable,
    measurable_form: selected.measurableForm,
    authorityCoverage: coverageBreakdownFor(
      selected.kind,
      authorityEvidence(
        selected.evidence,
        sourceOrganization(snapshot.source.sourceUrl),
      ),
    ),
    rationale: {
      importance: selected.importance,
      unresolvedness: Number(selected.unresolvedness.toFixed(3)),
      tension: Number(selected.tension.toFixed(3)),
      probe_priority: Number(selected.probePriority.toFixed(3)),
    },
  };
}

export function getDecisionDossier(store: CaseStore) {
  const snapshot = store.getState();
  if (
    snapshot.source.origin === "AGENT_IMPORTED" &&
    !snapshot.prioritiesTouched
  ) {
    return {
      ok: true as const,
      outcome: "PRIORITIES_REQUIRED" as const,
      remainingDecisionBlockers: null,
      tiers: [],
      interviewPack: [],
    };
  }
  return {
    ok: true as const,
    outcome: "DOSSIER" as const,
    activeProbeId: snapshot.activeProbeId,
    ...deriveDossier(snapshot.derived),
  };
}

export function recordInterviewAnswerTool(
  store: CaseStore,
  input: {
    claimId?: string;
    stance: "SUPPORTS" | "CHALLENGES" | "NEUTRAL";
    text: string;
    speakerRole: SpeakerRole;
  },
) {
  if (!Object.values(EVIDENCE_STANCE).includes(input.stance)) {
    throw new Error("Invalid evidence stance");
  }
  if (!Object.values(SPEAKER_ROLE).includes(input.speakerRole)) {
    throw new Error("Invalid interview speaker role");
  }
  const snapshot = store.getState();
  if (!snapshot.activeProbeId) {
    throw new Error("No active probe");
  }
  const claimId = snapshot.activeProbeId;
  if (input.claimId && input.claimId !== claimId) {
    throw new Error("Answers can only be recorded against the active probe");
  }
  if (!input.text.trim()) {
    throw new Error("Interview answer text is empty");
  }
  if (hasOversizedInput([[input.text, WEBMCP_INPUT_LIMITS.text]] as const)) {
    throw new Error("Interview answer exceeds allowed length");
  }
  store.recordAnswer({
    claimId,
    stance: input.stance,
    text: input.text.trim(),
    speakerRole: input.speakerRole,
  });
  return { ok: true as const, ...getCaseState(store) };
}

export function recordResearchEvidenceTool(
  store: CaseStore,
  input: {
    stance: "SUPPORTS" | "CHALLENGES" | "NEUTRAL";
    summary: string;
    sourceUrl: string;
    sourceLabel: string;
    sourceKind: string;
  },
) {
  if (!Object.values(EVIDENCE_STANCE).includes(input.stance)) {
    throw new Error("Invalid evidence stance");
  }
  const snapshot = store.getState();
  if (!snapshot.activeProbeId) {
    throw new Error("No active probe");
  }
  if (!input.summary.trim() || !input.sourceLabel.trim()) {
    throw new Error(
      "Research evidence requires summary, sourceUrl, and sourceLabel",
    );
  }
  if (
    hasOversizedInput([
      [input.summary, WEBMCP_INPUT_LIMITS.text],
      [input.sourceLabel, WEBMCP_INPUT_LIMITS.label],
      [input.sourceUrl, WEBMCP_INPUT_LIMITS.url],
    ])
  ) {
    throw new Error("Research evidence exceeds allowed length");
  }
  if (
    input.sourceKind !== RESEARCH_SOURCE_KIND.EMPLOYER_OFFICIAL &&
    input.sourceKind !== RESEARCH_SOURCE_KIND.FIRST_PERSON_EXPERIENCE &&
    input.sourceKind !== RESEARCH_SOURCE_KIND.OTHER_PUBLIC
  ) {
    throw new Error("Unsupported research source");
  }
  const sourceUrl = normalizeHttpUrl(input.sourceUrl, "Research source URL");
  const duplicate = snapshot.source.claims
    .find((claim) => claim.id === snapshot.activeProbeId)
    ?.evidence.some((item) => item.sourceUrl === sourceUrl);
  if (duplicate) {
    throw new Error("Duplicate research source URL");
  }
  store.recordResearch({
    claimId: snapshot.activeProbeId,
    stance: input.stance,
    text: input.summary.trim(),
    sourceKind: input.sourceKind as ResearchSourceKind,
    sourceLabel: input.sourceLabel.trim(),
    sourceUrl,
  });
  return { ok: true as const, ...getCaseState(store) };
}

export function importRoleFromClaimsTool(
  store: CaseStore,
  input: {
    company: string;
    role: string;
    sourceUrl?: string;
    claims: Array<{
      dimension: string;
      employerStatement: string;
      unresolvedVariable: string;
      measurableForm: string;
    }>;
  },
) {
  const sourceUrlInput = input.sourceUrl?.trim();
  if (
    hasOversizedInput([
      [input.company, WEBMCP_INPUT_LIMITS.label],
      [input.role, WEBMCP_INPUT_LIMITS.label],
      ...(input.sourceUrl
        ? ([[input.sourceUrl, WEBMCP_INPUT_LIMITS.url]] as const)
        : []),
      ...input.claims.flatMap((claim) => [
        [claim.dimension, WEBMCP_INPUT_LIMITS.label] as const,
        [claim.employerStatement, WEBMCP_INPUT_LIMITS.text] as const,
        [claim.unresolvedVariable, WEBMCP_INPUT_LIMITS.text] as const,
        [claim.measurableForm, WEBMCP_INPUT_LIMITS.text] as const,
      ]),
    ])
  ) {
    throw new Error("Imported role text exceeds allowed length");
  }
  const claims = input.claims.map((claim) => ({
    dimension: claim.dimension.trim(),
    employerStatement: claim.employerStatement.trim(),
    unresolvedVariable: claim.unresolvedVariable.trim(),
    measurableForm: claim.measurableForm.trim(),
  }));
  const sourceUrl = sourceUrlInput
    ? normalizeHttpUrl(sourceUrlInput, "Job posting URL")
    : undefined;
  if (
    !input.company.trim() ||
    !input.role.trim() ||
    claims.length === 0 ||
    claims.length > 8 ||
    claims.some((claim) =>
      Object.values(claim).some((value) => value.length === 0),
    )
  ) {
    throw new Error(
      "Imported role requires company, role, and 1 to 8 non-empty claims",
    );
  }
  store.importRole({
    company: input.company.trim(),
    role: input.role.trim(),
    ...(sourceUrl ? { sourceUrl } : {}),
    claims,
  });
  const snapshot = store.getState();
  return {
    ok: true as const,
    origin: snapshot.source.origin,
    claimCount: snapshot.source.claims.length,
  };
}

export { setCandidatePrioritiesTool } from "@/lib/webmcp/candidate-priorities";
export { getCaseState } from "@/lib/webmcp/case-state";
export { CASE_TOOL_CONTRACTS } from "@/lib/webmcp/contracts";
