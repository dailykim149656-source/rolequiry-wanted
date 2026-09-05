import type { CaseSnapshot } from "@/lib/case-store";
import { sourceOrganization } from "@/lib/domain/policy";
import {
  CLAIM_KIND,
  type DerivedClaim,
  IMPORTANCE,
  type Importance,
} from "@/lib/domain/types";
import { EvidenceList, EvidenceSignals } from "./Evidence";
import { Icon, type IconName } from "./Icon";
import { useLocale } from "@/lib/i18n";

const IMPORTANCE_OPTIONS = [
  IMPORTANCE.LOW,
  IMPORTANCE.MEDIUM,
  IMPORTANCE.HIGH,
  IMPORTANCE.CRITICAL,
] as const;

export function ClaimBoard({
  snapshot,
  onImportanceChange,
  className = "",
}: {
  readonly snapshot: CaseSnapshot;
  readonly className?: string;
  readonly onImportanceChange: (
    claimId: string,
    importance: Importance,
  ) => void;
}) {
  const { copy } = useLocale();
  return (
    <section
      aria-label="Claim Board"
      className={`${className}`}
      id="claim-board"
    >
      <h2 className="text-lg font-bold" id="claim-board-title">
        {copy.claims}
      </h2>
      <div>
        {snapshot.derived.claims.map((claim) => (
          <ClaimCard
            active={claim.id === snapshot.activeProbeId}
            caseOrganization={sourceOrganization(snapshot.source.sourceUrl)}
            claim={claim}
            key={claim.id}
            onImportanceChange={onImportanceChange}
          />
        ))}
      </div>
    </section>
  );
}

function ClaimCard({
  active,
  caseOrganization,
  claim,
  onImportanceChange,
}: {
  readonly active: boolean;
  readonly caseOrganization: string;
  readonly claim: DerivedClaim;
  readonly onImportanceChange: (
    claimId: string,
    importance: Importance,
  ) => void;
}) {
  const isSet = claim.candidatePrioritySet;
  const { copy, locale } = useLocale();
  const rankingNote = !isSet
    ? copy.notInRanking
    : locale === "en"
      ? claim.kind === CLAIM_KIND.EMPLOYER_POLICY
        ? "Written policy · tracked outside probe ranking"
        : claim.probeEligible
          ? "Included in the next-question ranking"
          : "Evidence currently lowers the need to probe"
      : claim.kind === CLAIM_KIND.EMPLOYER_POLICY
        ? "문서화된 정책 · 조사 순위 밖"
        : claim.probeEligible
          ? "다음 질문 순위에 포함됨"
          : "근거가 있어 지금은 조사가 급하지 않음";

  return (
    <article
      className="border-t border-[#ececec] py-3.5"
      data-active={String(active)}
      data-priority-set={String(isSet)}
      data-testid={`claim-${claim.id}`}
    >
      <div className="flex gap-3 sm:gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-col items-start gap-2 sm:flex-row sm:justify-between sm:gap-3">
            <div className="min-w-0 flex-1">
              {active ? (
                <p className="sr-only">
                  Active probe
                </p>
              ) : null}
              <q className="text-[15px] font-bold">{claim.employerStatement}</q>
              <p className="mt-1.5 text-[13px] text-[#666]">
                {claim.dimension} · {isSet
                  ? claim.importance === "LOW"
                    ? copy.importanceLow
                    : claim.importance === "MEDIUM"
                      ? copy.importanceMedium
                      : claim.importance === "HIGH"
                        ? copy.importanceHigh
                        : copy.importanceCritical
                  : copy.priorityNotSet} · {statusLabel(isSet ? claim.status : "PRIORITY_NOT_SET")}
              </p>
            </div>
            <StatusBadge status={isSet ? claim.status : "PRIORITY_NOT_SET"} />
          </div>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-3 border-t border-line/80 pt-3">
            <PriorityControl
              claim={claim}
              onImportanceChange={onImportanceChange}
            />
            <EvidenceSignals claim={claim} />
          </div>
          <p className="mt-2 text-xs text-muted">{rankingNote}</p>
        </div>
      </div>
      <EvidenceList caseOrganization={caseOrganization} claim={claim} />
    </article>
  );
}

function PriorityControl({
  claim,
  onImportanceChange,
}: {
  readonly claim: DerivedClaim;
  readonly onImportanceChange: (
    claimId: string,
    importance: Importance,
  ) => void;
}) {
  const { copy } = useLocale();
  return (
    <label className="block text-xs font-medium text-muted">
      <span className="mb-1.5 flex items-center gap-1.5">
        <Icon className="size-3.5" name="flag" />
        {copy.priorityLabel}
      </span>
      <select
        aria-label={`${copy.priorityLabel} ${claim.dimension}`}
        className={`min-h-11 rounded-xl border px-3 py-2 text-sm font-semibold outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20 ${
          claim.candidatePrioritySet
            ? "border-brand/30 bg-brand-soft text-brand"
            : "border-strong bg-surface text-secondary"
        }`}
        onChange={(event) =>
          onImportanceChange(claim.id, event.target.value as Importance)
        }
        value={claim.candidatePrioritySet ? claim.importance : ""}
      >
        <option disabled value="">
          {copy.setPriority}
        </option>
        {IMPORTANCE_OPTIONS.map((value) => (
          <option key={value} value={value}>
            {value === "LOW"
              ? copy.importanceLow
              : value === "MEDIUM"
                ? copy.importanceMedium
                : value === "HIGH"
                  ? copy.importanceHigh
                  : copy.importanceCritical}
          </option>
        ))}
      </select>
    </label>
  );
}

type DisplayStatus = DerivedClaim["status"] | "PRIORITY_NOT_SET";

function statusLabel(status: DisplayStatus): string {
  if (status === "SUPPORTED") return "확인됨";
  if (status === "CHALLENGED") return "긴장";
  if (status === "MATERIAL_AMBIGUITY") return "긴장";
  if (status === "PRIORITY_NOT_SET") return "미설정";
  return "미확인";
}

function StatusBadge({ status }: { readonly status: DisplayStatus }) {
  const configs: Record<DisplayStatus, readonly [IconName, string, string]> = {
    SUPPORTED: ["check", "확인됨", "bg-supported-soft text-supported"],
    CHALLENGED: ["tension", "긴장", "bg-challenged-soft text-challenged"],
    MATERIAL_AMBIGUITY: [
      "scales",
      "긴장",
      "bg-brand-soft text-brand",
    ],
    UNVERIFIED: [
      "question",
      "미확인",
      "bg-unverified-soft text-unverified",
    ],
    PRIORITY_NOT_SET: [
      "flag",
      "미설정",
      "bg-unverified-soft text-unverified",
    ],
  };
  const config = configs[status];

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${config[2]}`}
      data-status={status}
    >
      <Icon className="size-3.5" name={config[0]} />
      {config[1]}
    </span>
  );
}
