import { z } from "zod";
import type { CaseSnapshot, RestorableCaseState } from "@/lib/case-store";
import { deriveCase, importedRoleCaseId } from "@/lib/domain/derive-case";
import {
  MAX_CASE_FILE_BYTES,
  MAX_EVIDENCE_PER_CLAIM,
  MAX_IDENTIFIER_LENGTH,
} from "@/lib/domain/limits";
import {
  AUTHORITY_SCOPE,
  CASE_ORIGIN,
  CLAIM_KIND,
  EVIDENCE_PROVENANCE,
  EVIDENCE_STANCE,
  IMPORTANCE,
  type RoleCase,
  SOURCE_KIND,
  SPEAKER_ROLE,
} from "@/lib/domain/types";

export const CASE_STORAGE_KEY = "rolequiry.case.v1";

export type CaseExport = {
  readonly filename: string;
  readonly contents: string;
};

const httpUrl = z
  .string()
  .url()
  .refine((value) => {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  });
const text = z.string().max(20_000);
const nonEmptyText = text.trim().min(1);
const identifier = z.string().trim().min(1).max(MAX_IDENTIFIER_LENGTH);

function hasNumberedEvidenceId(
  id: string,
  prefix: string,
  sequence: number,
): boolean {
  return id === `${prefix}${sequence}`;
}

const evidenceSchema = z
  .object({
    id: identifier,
    scope: z.enum(AUTHORITY_SCOPE),
    stance: z.enum(EVIDENCE_STANCE),
    text: nonEmptyText,
    speakerRole: z.enum(SPEAKER_ROLE).optional(),
    sourceKind: z.enum(SOURCE_KIND).optional(),
    sourceLabel: nonEmptyText.optional(),
    synthetic: z.boolean().optional(),
    sourceUrl: httpUrl.optional(),
    provenance: z.enum(EVIDENCE_PROVENANCE).optional(),
    sourceCategory: z.string().optional(),
    verificationStatus: z.enum(["VERIFIED", "INSUFFICIENT", "REJECTED"]).optional(),
  })
  .superRefine((evidence, context) => {
    if (evidence.provenance === EVIDENCE_PROVENANCE.AGENT_REPORTED) {
      const validAuthority =
        (evidence.scope === AUTHORITY_SCOPE.EMPLOYER_STATED &&
          evidence.sourceKind === SOURCE_KIND.EMPLOYER_POSTING) ||
        (evidence.scope === AUTHORITY_SCOPE.REPORTED_EXPERIENCE &&
          evidence.sourceKind === SOURCE_KIND.REPORTED_EXPERIENCE);
      if (
        !validAuthority ||
        !evidence.sourceUrl ||
        !evidence.sourceLabel ||
        evidence.speakerRole ||
        evidence.synthetic !== false
      ) {
        context.addIssue({
          code: "custom",
          message: "Invalid agent-reported evidence provenance",
        });
      }
    }
    if (evidence.provenance === EVIDENCE_PROVENANCE.CANDIDATE_REPORTED) {
      if (
        evidence.scope !== AUTHORITY_SCOPE.CANDIDATE_SPECIFIC_ANSWER ||
        evidence.sourceKind !== SOURCE_KIND.INTERVIEW ||
        !evidence.speakerRole ||
        evidence.sourceLabel !== evidence.speakerRole ||
        evidence.sourceUrl ||
        evidence.synthetic !== false
      ) {
        context.addIssue({
          code: "custom",
          message: "Invalid candidate-reported evidence provenance",
        });
      }
    }
  });
const claimSchema = z
  .object({
    id: identifier,
    dimension: nonEmptyText,
    employerStatement: nonEmptyText,
    importance: z.enum(IMPORTANCE),
    unresolvedVariable: nonEmptyText,
    measurableForm: nonEmptyText,
    evidence: z.array(evidenceSchema).max(MAX_EVIDENCE_PER_CLAIM),
    kind: z.enum(CLAIM_KIND).optional(),
    importanceSetByCandidate: z.boolean().optional(),
  })
  .superRefine((claim, context) => {
    const evidenceIds = claim.evidence.map((evidence) => evidence.id);
    if (new Set(evidenceIds).size !== evidenceIds.length) {
      context.addIssue({
        code: "custom",
        message: "Evidence IDs must be unique within a claim",
        path: ["evidence"],
      });
    }
  });
const persistedSchema = z
  .object({
    version: z.literal(1),
    state: z.object({
      source: z.object({
        id: identifier,
        company: nonEmptyText,
        role: nonEmptyText,
        sourceUrl: httpUrl.optional(),
        origin: z.enum(CASE_ORIGIN),
        claims: z.array(claimSchema).min(1).max(8),
      }),
      activeProbeId: identifier.nullable(),
      rankingVisible: z.boolean(),
      selectionState: z.enum([
        "IDLE",
        "ACTIVE",
        "EVIDENCE_UPDATED",
        "NO_PROBE_NEEDED",
      ]),
      prioritiesTouched: z.boolean(),
    }),
  })
  .superRefine((payload, context) => {
    const { state } = payload;
    const claimIds = state.source.claims.map((claim) => claim.id);
    if (new Set(claimIds).size !== claimIds.length) {
      context.addIssue({
        code: "custom",
        message: "Claim IDs must be unique",
        path: ["state", "source", "claims"],
      });
    }
    const activeProbeExists =
      state.activeProbeId !== null && claimIds.includes(state.activeProbeId);
    if (state.activeProbeId !== null && !activeProbeExists) {
      context.addIssue({
        code: "custom",
        message: "Active probe must reference a claim",
        path: ["state", "activeProbeId"],
      });
    }
    const needsActiveProbe =
      state.selectionState === "ACTIVE" ||
      state.selectionState === "EVIDENCE_UPDATED";
    if (needsActiveProbe && !activeProbeExists) {
      context.addIssue({
        code: "custom",
        message: "Selection state requires an active probe",
        path: ["state", "selectionState"],
      });
    }
    if (
      (state.selectionState === "IDLE" ||
        state.selectionState === "NO_PROBE_NEEDED") &&
      state.activeProbeId !== null
    ) {
      context.addIssue({
        code: "custom",
        message: "Selection state cannot retain an active probe",
        path: ["state", "selectionState"],
      });
    }
    if (
      state.rankingVisible &&
      (!activeProbeExists || state.selectionState !== "ACTIVE")
    ) {
      context.addIssue({
        code: "custom",
        message: "Visible ranking requires an active selection",
        path: ["state", "rankingVisible"],
      });
    }
    if (state.source.origin === CASE_ORIGIN.AGENT_IMPORTED) {
      if (state.source.id !== importedRoleCaseId(state.source.company)) {
        context.addIssue({
          code: "custom",
          message: "Imported case ID is not app-owned",
          path: ["state", "source", "id"],
        });
      }
      const hasConfirmedPriority = state.source.claims.some(
        (claim) => claim.importanceSetByCandidate === true,
      );
      if (hasConfirmedPriority !== state.prioritiesTouched) {
        context.addIssue({
          code: "custom",
          message: "Priority state is inconsistent",
          path: ["state", "prioritiesTouched"],
        });
      }
      state.source.claims.forEach((claim, claimIndex) => {
        const expectedClaimId = `imported-${claimIndex + 1}`;
        if (
          claim.id !== expectedClaimId ||
          claim.kind !== undefined ||
          typeof claim.importanceSetByCandidate !== "boolean"
        ) {
          context.addIssue({
            code: "custom",
            message: "Imported claims must preserve app-derived fields",
            path: ["state", "source", "claims", claimIndex],
          });
        }
        const caseInputs = claim.evidence.filter(
          (evidence) => evidence.provenance === EVIDENCE_PROVENANCE.CASE_INPUT,
        );
        if (caseInputs.length !== 1) {
          context.addIssue({
            code: "custom",
            message: "Imported claims require one original employer statement",
            path: ["state", "source", "claims", claimIndex, "evidence"],
          });
        }
        claim.evidence.forEach((evidence, evidenceIndex) => {
          if (!evidence.provenance) {
            context.addIssue({
              code: "custom",
              message: "Imported evidence requires explicit provenance",
              path: [
                "state",
                "source",
                "claims",
                claimIndex,
                "evidence",
                evidenceIndex,
              ],
            });
            return;
          }
          const hasAppOwnedId =
            evidence.provenance === EVIDENCE_PROVENANCE.CASE_INPUT
              ? evidence.id === `${expectedClaimId}-employer`
              : evidence.provenance === EVIDENCE_PROVENANCE.CANDIDATE_REPORTED
                ? hasNumberedEvidenceId(
                    evidence.id,
                    `${expectedClaimId}-interview-`,
                    evidenceIndex + 1,
                  )
                : hasNumberedEvidenceId(
                    evidence.id,
                    `${expectedClaimId}-research-`,
                    evidenceIndex + 1,
                  );
          if (!hasAppOwnedId) {
            context.addIssue({
              code: "custom",
              message: "Imported evidence ID is not app-owned",
              path: [
                "state",
                "source",
                "claims",
                claimIndex,
                "evidence",
                evidenceIndex,
                "id",
              ],
            });
          }
          if (evidence.provenance !== EVIDENCE_PROVENANCE.CASE_INPUT) return;
          const isOriginalEmployerStatement =
            evidence.scope === AUTHORITY_SCOPE.EMPLOYER_STATED &&
            evidence.stance === EVIDENCE_STANCE.SUPPORTS &&
            evidence.text === claim.employerStatement &&
            evidence.sourceKind === SOURCE_KIND.EMPLOYER_POSTING &&
            evidence.sourceLabel === "Imported employer statement" &&
            evidence.synthetic === false &&
            !evidence.speakerRole &&
            !evidence.sourceUrl;
          if (!isOriginalEmployerStatement) {
            context.addIssue({
              code: "custom",
              message: "Invalid case-input evidence provenance",
              path: [
                "state",
                "source",
                "claims",
                claimIndex,
                "evidence",
                evidenceIndex,
              ],
            });
          }
        });
      });
    }
  });

export function serializePersistedCase(snapshot: CaseSnapshot): string {
  return JSON.stringify({
    version: 1,
    state: {
      source: snapshot.source,
      activeProbeId: snapshot.activeProbeId,
      rankingVisible: snapshot.rankingVisible,
      selectionState: snapshot.selectionState,
      prioritiesTouched: snapshot.prioritiesTouched,
    },
  });
}

export function createCaseExport(snapshot: CaseSnapshot): CaseExport {
  const company = snapshot.source.company.replace(
    /\s*\(synthetic demo\)$/i,
    "",
  );
  const slug =
    `${company}-${snapshot.source.role}`
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[^a-z0-9가-힣]+/g, "-")
      .replace(/^-+|-+$/g, "") || "case";
  const contents = serializePersistedCase(snapshot);
  if (!parsePersistedCase(contents)) {
    throw new Error("Case is not valid for export");
  }
  if (new TextEncoder().encode(contents).byteLength > MAX_CASE_FILE_BYTES) {
    throw new Error("Case exceeds export size limit");
  }
  return {
    filename: `rolequiry-${slug}.json`,
    contents,
  };
}

export function parsePersistedCase(
  value: string | null,
): RestorableCaseState | null {
  if (!value) return null;
  try {
    const result = persistedSchema.safeParse(JSON.parse(value));
    if (!result.success) return null;
    const source = result.data.state.source as RoleCase;
    const derived = deriveCase(source);
    if (
      result.data.state.rankingVisible &&
      derived.topProbeId !== result.data.state.activeProbeId
    ) {
      return null;
    }
    if (result.data.state.selectionState === "ACTIVE") {
      const active = derived.claims.find(
        (claim) => claim.id === result.data.state.activeProbeId,
      );
      if (!active?.probeEligible) return null;
    }
    if (
      result.data.state.selectionState === "NO_PROBE_NEEDED" &&
      derived.topProbeId !== null
    ) {
      return null;
    }
    return {
      ...result.data.state,
      source,
    };
  } catch {
    return null;
  }
}

export function parseImportedCaseFile(
  value: string | null,
): RestorableCaseState | null {
  const saved = parsePersistedCase(value);
  return saved?.source.origin === CASE_ORIGIN.AGENT_IMPORTED ? saved : null;
}

export function loadPersistedCase(storage: Pick<Storage, "getItem">) {
  try {
    const saved = parsePersistedCase(storage.getItem(CASE_STORAGE_KEY));
    return saved?.source.origin === CASE_ORIGIN.AGENT_IMPORTED ? saved : null;
  } catch {
    return null;
  }
}

export function savePersistedCase(
  storage: Pick<Storage, "removeItem" | "setItem">,
  snapshot: CaseSnapshot,
): boolean {
  try {
    if (snapshot.source.origin === CASE_ORIGIN.DEMO_FIXTURE) {
      storage.removeItem(CASE_STORAGE_KEY);
      return true;
    }
    storage.setItem(CASE_STORAGE_KEY, serializePersistedCase(snapshot));
    return true;
  } catch {
    // Storage can be unavailable or full; the live in-memory case still works.
    return false;
  }
}
