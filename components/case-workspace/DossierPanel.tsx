import { useState } from "react";
import type { CaseSnapshot } from "@/lib/case-store";
import {
  type DecisionDossier,
  type DossierResolution,
  deriveDossier,
} from "@/lib/domain/dossier";
import type { SpeakerRole } from "@/lib/domain/types";
import { Icon } from "./Icon";
import { useLocale } from "@/lib/i18n";
const RESOLUTION_TONE: Record<DossierResolution, string> = {
  SUFFICIENTLY_RESOLVED: "text-supported",
  CONTRADICTED: "text-challenged",
  AWAITING_PRIORITY: "text-muted",
  ASK_IN_INTERVIEW: "text-brand",
};

function interviewPackText(dossier: DecisionDossier): string {
  return dossier.interviewPack
    .map(
      (question, index) =>
        `${index + 1}. ${question.askWho}: ${question.question}`,
    )
    .join("\n");
}

export function DossierPanel({
  snapshot,
  className = "",
}: {
  readonly snapshot: CaseSnapshot;
  readonly className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const { copy } = useLocale();
  const speakerLabel = {
    RECRUITER: copy.recruiter,
    HIRING_MANAGER: copy.hiringManager,
    TEAM_MEMBER: copy.teamMember,
    OTHER: copy.interviewer,
  };
  const resolutionLabel = {
    SUFFICIENTLY_RESOLVED: copy.resolved,
    CONTRADICTED: copy.contradicted,
    AWAITING_PRIORITY: copy.awaitingPriority,
    ASK_IN_INTERVIEW: copy.askInInterview,
  };
  const locked =
    snapshot.source.origin === "AGENT_IMPORTED" && !snapshot.prioritiesTouched;
  const dossier = locked ? null : deriveDossier(snapshot.derived);
  const copyPack = async () => {
    if (!dossier) return;
    try {
      await navigator.clipboard.writeText(interviewPackText(dossier));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be unavailable; the visible list remains the source.
    }
  };

  return (
    <section
      aria-labelledby="dossier-panel-title"
      className={`surface-shadow mt-5 rounded-[1.35rem] border border-line bg-surface p-4 sm:p-5 ${className}`}
      data-testid="decision-dossier"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Icon className="size-5" name="flag" />
            <h2 className="text-lg font-semibold" id="dossier-panel-title">
              {copy.evidence}
            </h2>
            <span className="sr-only">Due diligence dossier</span>
          </div>
          <p className="mt-1 text-sm text-muted">
            {copy.dossierSettled}
          </p>
        </div>
        {dossier ? (
          <span
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${
              dossier.remainingDecisionBlockers > 0
                ? "bg-brand-soft text-brand"
                : "bg-quiet text-supported"
            }`}
            data-testid="dossier-blockers"
          >
            {dossier.remainingDecisionBlockers > 0
              ? `${dossier.remainingDecisionBlockers} decision ${dossier.remainingDecisionBlockers === 1 ? "blocker" : "blockers"} remaining`
              : "No decision blockers"}
          </span>
        ) : null}
      </div>

      {!dossier ? (
        <p className="mt-4 rounded-2xl border border-line bg-quiet px-4 py-3 text-sm leading-6 text-secondary">
          {copy.confirmPriorities}
        </p>
      ) : (
        <div className="mt-4 grid items-start gap-5 lg:grid-cols-2">
          <div>
            {dossier.tiers.map((tier) => (
              <div className="mb-4 last:mb-0" key={tier.importance}>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
                  {tier.importance}
                </p>
                <ul className="mt-1.5 space-y-1.5">
                  {tier.entries.map((entry) => (
                    <li
                      className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 rounded-xl border border-line bg-quiet px-3 py-2.5 text-sm"
                      key={entry.claimId}
                    >
                      <span className="font-semibold text-ink">
                        {entry.dimension}
                      </span>
                      <span
                        className={`text-xs font-semibold ${RESOLUTION_TONE[entry.resolution]}`}
                      >
                        {resolutionLabel[entry.resolution]}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div data-testid="interview-pack">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
                {copy.whatToAsk}
              </p>
              {dossier.interviewPack.length > 0 ? (
                <button
                  className="min-h-11 rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-secondary transition-colors hover:border-strong hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
                  onClick={copyPack}
                  type="button"
                >
                  {copied ? copy.copied : copy.copyQuestions}
                </button>
              ) : null}
            </div>
            {dossier.interviewPack.length === 0 ? (
              <p className="mt-2 rounded-xl border border-line bg-quiet px-3 py-2.5 text-sm leading-6 text-secondary">
                No open interview questions. Unresolved claims are either
                contradicted or awaiting your priority.
              </p>
            ) : (
              <ol className="mt-2 space-y-2">
                {dossier.interviewPack.map((question) => (
                  <li
                    className="rounded-xl border border-line bg-quiet px-3 py-2.5"
                    key={question.claimId}
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.1em] text-brand">
                      {copy.askThe} {speakerLabel[question.askWho]}
                    </p>
                    <p className="mt-1 text-sm font-semibold leading-6 text-ink">
                      {question.question}
                    </p>
                    <p className="mt-0.5 text-xs leading-5 text-muted">
                      {question.context}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
