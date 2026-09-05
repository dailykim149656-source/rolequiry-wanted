import {
  deriveCase,
  importRoleFromClaims,
  recordInterviewAnswer,
  recordResearchEvidence,
  setClaimImportance,
} from "@/lib/domain/derive-case";
import { recordVerifiedResearchEvidence } from "@/lib/domain/verified-evidence";
import type { VerifiedResearchEvidenceInput } from "@/lib/domain/verified-evidence";
import { MAX_EVIDENCE_PER_CLAIM } from "@/lib/domain/limits";
import type {
  CandidatePriorityInput,
  DerivedCase,
  Importance,
  ImportedRoleInput,
  InterviewAnswerInput,
  ResearchEvidenceInput,
  RoleCase,
} from "@/lib/domain/types";
import { ATLAS_FDE } from "@/lib/fixtures/atlas-fde";
import { KESTREL_SOLUTIONS } from "@/lib/fixtures/kestrel-solutions";

export const FIXTURES = {
  "atlas-fde": ATLAS_FDE,
  "kestrel-solutions": KESTREL_SOLUTIONS,
} as const;

export type FixtureId = keyof typeof FIXTURES;

export const SELECTION_STATE = {
  IDLE: "IDLE",
  ACTIVE: "ACTIVE",
  EVIDENCE_UPDATED: "EVIDENCE_UPDATED",
  NO_PROBE_NEEDED: "NO_PROBE_NEEDED",
} as const;
export type SelectionState =
  (typeof SELECTION_STATE)[keyof typeof SELECTION_STATE];

export type CaseSnapshot = {
  readonly source: RoleCase;
  readonly derived: DerivedCase;
  readonly activeProbeId: string | null;
  readonly rankingVisible: boolean;
  readonly selectionState: SelectionState;
  readonly prioritiesTouched: boolean;
};

export type RestorableCaseState = Pick<
  CaseSnapshot,
  | "source"
  | "activeProbeId"
  | "rankingVisible"
  | "selectionState"
  | "prioritiesTouched"
>;

type Listener = () => void;

function snapshotFrom(
  source: RoleCase,
  activeProbeId: string | null,
  rankingVisible: boolean,
  selectionState: SelectionState = SELECTION_STATE.IDLE,
  prioritiesTouched = source.origin !== "AGENT_IMPORTED",
): CaseSnapshot {
  return {
    source,
    derived: deriveCase(source),
    activeProbeId,
    rankingVisible,
    selectionState,
    prioritiesTouched,
  };
}

export function createCaseStore(initial: RoleCase = ATLAS_FDE) {
  let state = snapshotFrom(initial, null, false);
  const listeners = new Set<Listener>();

  function emit() {
    for (const listener of listeners) listener();
  }

  function assertEvidenceCapacity(claimId: string) {
    const claim = state.source.claims.find((item) => item.id === claimId);
    if (claim && claim.evidence.length >= MAX_EVIDENCE_PER_CLAIM) {
      throw new Error("Active claim evidence limit reached");
    }
  }

  function setPriorities(priorities: readonly CandidatePriorityInput[]) {
    let source = state.source;
    for (const priority of priorities) {
      source = setClaimImportance(
        source,
        priority.claimId,
        priority.importance,
      );
    }
    const derived = deriveCase(source);
    const selected = derived.claims.find(
      (claim) => claim.id === state.activeProbeId,
    );
    const keepUpdated =
      state.selectionState === SELECTION_STATE.EVIDENCE_UPDATED &&
      Boolean(selected);
    state = {
      source,
      derived,
      activeProbeId: selected ? state.activeProbeId : null,
      rankingVisible: false,
      selectionState: keepUpdated
        ? SELECTION_STATE.EVIDENCE_UPDATED
        : selected?.probeEligible
          ? SELECTION_STATE.ACTIVE
          : SELECTION_STATE.IDLE,
      prioritiesTouched: true,
    };
    emit();
  }

  return {
    getState(): CaseSnapshot {
      return state;
    },
    subscribe(listener: Listener): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    restore(saved: RestorableCaseState) {
      const derived = deriveCase(saved.source);
      const activeProbeId = derived.claims.some(
        (claim) => claim.id === saved.activeProbeId,
      )
        ? saved.activeProbeId
        : null;
      state = {
        source: saved.source,
        derived,
        activeProbeId,
        rankingVisible: Boolean(activeProbeId && saved.rankingVisible),
        selectionState: activeProbeId
          ? saved.selectionState
          : saved.selectionState === SELECTION_STATE.NO_PROBE_NEEDED
            ? saved.selectionState
            : SELECTION_STATE.IDLE,
        prioritiesTouched: saved.prioritiesTouched,
      };
      emit();
    },
    loadFixture(id: FixtureId) {
      state = snapshotFrom(FIXTURES[id], null, false);
      emit();
    },
    reset() {
      const fixture = FIXTURES[state.source.id as FixtureId] ?? ATLAS_FDE;
      state = snapshotFrom(fixture, null, false);
      emit();
    },
    setImportance(claimId: string, importance: Importance) {
      setPriorities([{ claimId, importance }]);
    },
    setPriorities,
    peekDecision() {
      return deriveCase(state.source);
    },
    clearSelection() {
      state = snapshotFrom(
        state.source,
        null,
        false,
        SELECTION_STATE.NO_PROBE_NEEDED,
        state.prioritiesTouched,
      );
      emit();
    },
    selectDecisionChanger() {
      const derived = deriveCase(state.source);
      state = {
        source: state.source,
        derived,
        activeProbeId: derived.topProbeId,
        rankingVisible: Boolean(derived.topProbeId),
        selectionState: derived.topProbeId
          ? SELECTION_STATE.ACTIVE
          : SELECTION_STATE.NO_PROBE_NEEDED,
        prioritiesTouched: state.prioritiesTouched,
      };
      emit();
      return derived;
    },
    recordAnswer(input: InterviewAnswerInput) {
      assertEvidenceCapacity(input.claimId);
      const source = recordInterviewAnswer(state.source, input);
      const derived = deriveCase(source);
      state = {
        source,
        derived,
        activeProbeId: state.activeProbeId,
        rankingVisible: false,
        selectionState: SELECTION_STATE.EVIDENCE_UPDATED,
        prioritiesTouched: state.prioritiesTouched,
      };
      emit();
    },
    recordResearch(input: ResearchEvidenceInput) {
      assertEvidenceCapacity(input.claimId);
      const source = recordResearchEvidence(state.source, input);
      const derived = deriveCase(source);
      state = {
        source,
        derived,
        activeProbeId: state.activeProbeId,
        rankingVisible: false,
        selectionState: SELECTION_STATE.EVIDENCE_UPDATED,
        prioritiesTouched: state.prioritiesTouched,
      };
      emit();
    },
    recordVerifiedResearch(input: VerifiedResearchEvidenceInput) {
      assertEvidenceCapacity(input.claimId);
      const source = recordVerifiedResearchEvidence(state.source, input);
      const derived = deriveCase(source);
      state = {
        source,
        derived,
        activeProbeId: state.activeProbeId,
        rankingVisible: false,
        selectionState: SELECTION_STATE.EVIDENCE_UPDATED,
        prioritiesTouched: state.prioritiesTouched,
      };
      emit();
    },
    importRole(input: ImportedRoleInput) {
      state = snapshotFrom(importRoleFromClaims(input), null, false);
      emit();
    },
  };
}

export type CaseStore = ReturnType<typeof createCaseStore>;
