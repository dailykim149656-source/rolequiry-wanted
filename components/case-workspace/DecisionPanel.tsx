import type { CaseSnapshot } from "@/lib/case-store";
import {
  decisionPathHint,
  decisionPathNodes,
} from "@/lib/domain/decision-path";
import {
  LIVED_EXPERIENCE_WEIGHT,
  PROBE_PRIORITY_WEIGHT,
  sourceOrganization,
} from "@/lib/domain/policy";
import { noProbeDetails } from "@/lib/domain/probe-outcome";
import type { DerivedClaim } from "@/lib/domain/types";
import { deriveDossier } from "@/lib/domain/dossier";
import { Icon, type IconName } from "./Icon";
import { useLocale } from "@/lib/i18n";

export function DecisionPanel({
  snapshot,
  className = "",
  onInvestigate,
  onShare,
  onFeedback,
}: {
  readonly snapshot: CaseSnapshot;
  readonly className?: string;
  readonly onInvestigate?: () => void;
  readonly onShare?: () => void;
  readonly onFeedback?: () => void;
}) {
  const selected = snapshot.derived.claims.find(
    (claim) => claim.id === snapshot.activeProbeId,
  );
  const noProbe = noProbeDetails(snapshot.derived);
  const question = selected?.measurableForm;
  const { copy } = useLocale();
  return (
    <section
      aria-label="Decision Path"
      className={`rounded-[16px] border border-[#ececec] bg-white p-4 lg:sticky lg:top-6 sm:p-5 ${className}`}
    >
      <div className="flex items-start justify-between gap-3 border-b border-line pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Icon className="size-5" name="path" />
            <h2 className="text-lg font-semibold" id="decision-path-title">
              {copy.nextItem}
            </h2>
          </div>
          <p className="mt-1 text-sm text-muted">
            {decisionPathHint(
              snapshot.selectionState,
              snapshot.rankingVisible,
            ) ?? copy.nextHint}
          </p>
        </div>
      </div>
      {onInvestigate ? (
        <button
          className="mt-4 h-12 w-full rounded-full bg-[#3366ff] text-base font-extrabold text-white"
          onClick={onInvestigate}
          type="button"
        >
          {copy.investigate}
        </button>
      ) : null}
      {question ? (
        <button
          className="mt-2 h-10 w-full rounded-full border border-[#e1e2e4] bg-white text-sm font-bold"
          onClick={() => void navigator.clipboard.writeText(question)}
          type="button"
        >
          {copy.copyQuestion}
        </button>
      ) : null}
      {onShare ? (
        <button
          className="mt-2 h-10 w-full rounded-full border border-[#e1e2e4] bg-white text-sm font-bold"
          onClick={onShare}
          type="button"
        >
          {copy.shareResult}
        </button>
      ) : null}
      {onFeedback ? (
        <button
          className="mt-2 h-10 w-full rounded-full border border-[#e1e2e4] bg-white text-sm font-bold"
          onClick={onFeedback}
          type="button"
        >
          {copy.leaveFeedback}
        </button>
      ) : null}
      {question ? (
        <p className="mt-4 border-t border-[#ececec] pt-3.5 text-[13px] text-[#333]">
          {question}
        </p>
      ) : null}

      {snapshot.source.origin === "AGENT_IMPORTED" &&
      !snapshot.prioritiesTouched ? (
        <PrioritiesRequired />
      ) : snapshot.selectionState === "NO_PROBE_NEEDED" ? (
        <DecisionNotice
          body={
            noProbe.unprioritizedLivedClaimCount > 0
              ? `No prioritized claim needs another probe. ${noProbe.unprioritizedLivedClaimCount} lived-experience ${noProbe.unprioritizedLivedClaimCount === 1 ? "claim remains" : "claims remain"} outside the ranking.`
              : "No unresolved candidate-priority claim currently needs another probe."
          }
          testId="no-probe"
          title={
            noProbe.unprioritizedLivedClaimCount > 0
              ? "Unprioritized claims remain"
              : "No probe needed"
          }
        />
      ) : selected &&
        (snapshot.selectionState === "ACTIVE" ||
          snapshot.selectionState === "EVIDENCE_UPDATED") ? (
        <DecisionPath
          caseOrganization={sourceOrganization(snapshot.source.sourceUrl)}
          claim={selected}
          mode={snapshot.selectionState}
        />
      ) : (
        <AgentStarter />
      )}
      <RankingDisclosure />
    </section>
  );
}

function RankingDisclosure() {
  const { copy } = useLocale();
  const percent = (value: number) => `${Math.round(value * 100)}%`;
  return (
    <details className="mt-5 border-t border-line pt-4 text-sm text-secondary">
      <summary className="min-h-11 cursor-pointer py-2 font-semibold text-ink outline-none focus-visible:ring-2 focus-visible:ring-brand/30">
        {copy.rankingHow}
      </summary>
      <div className="space-y-2 pb-1 leading-6">
        <p>
          {copy.rankingWeights
            .replace("{importance}", percent(PROBE_PRIORITY_WEIGHT.IMPORTANCE))
            .replace("{unresolved}", percent(PROBE_PRIORITY_WEIGHT.UNRESOLVEDNESS))
            .replace("{tension}", percent(PROBE_PRIORITY_WEIGHT.TENSION))}
        </p>
        <p>{copy.rankingTies}</p>
        <p>
          {copy.rankingLived
            .replace("{employer}", percent(LIVED_EXPERIENCE_WEIGHT.EMPLOYER_STATED))
            .replace("{public}", percent(LIVED_EXPERIENCE_WEIGHT.REPORTED_EXPERIENCE))
            .replace("{interview}", percent(LIVED_EXPERIENCE_WEIGHT.CANDIDATE_SPECIFIC_ANSWER))}
        </p>
        <p>
          {copy.rankingHeuristic}
        </p>
      </div>
    </details>
  );
}

function PrioritiesRequired() {
  const { copy } = useLocale();
  const steps = [
    ["briefcase", copy.importJob],
    ["flag", copy.setPriorities],
    ["spark", copy.chooseNext],
    ["message", copy.askNext],
  ] as const satisfies ReadonlyArray<readonly [IconName, string]>;
  return (
    <div className="mt-4" data-testid="priorities-required">
      <div className="rounded-2xl border border-brand/20 bg-brand-soft/60 p-5">
        <div className="flex gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-full bg-surface text-brand shadow-sm">
            <Icon className="size-6" name="scales" />
          </span>
          <div>
            <h3 className="text-lg font-semibold">
              {copy.judgmentTitle}
            </h3>
            <p className="mt-1 text-sm leading-6 text-secondary">
              {copy.judgmentBody}
            </p>
          </div>
        </div>
      </div>
      <ol className="mt-5 grid grid-cols-2 gap-3 text-sm">
        {steps.map(([icon, label], index) => (
          <li
            className="rounded-xl border border-line bg-quiet p-3"
            key={label}
          >
            <span className="grid size-8 place-items-center rounded-full bg-surface text-brand">
              <Icon className="size-4" name={icon} />
            </span>
            <p className="mt-2 font-semibold text-ink">
              <span className="mr-1 text-brand">{index + 1}.</span> {label}
            </p>
          </li>
        ))}
      </ol>
      <a
        className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
        href="#claim-board"
      >
        {copy.setPrioritiesCta}
        <Icon className="size-4" name="arrow" />
      </a>
    </div>
  );
}

function AgentStarter() {
  const { copy } = useLocale();
  const steps = [
    ["1", copy.starter1],
    ["2", copy.starter2],
    ["3", copy.starter3],
  ] as const;

  return (
    <div className="mt-4" data-testid="agent-starter">
      <div className="flex gap-4 rounded-2xl border border-brand/20 bg-brand-soft/50 p-5">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-surface text-brand shadow-sm">
          <Icon className="size-5" name="spark" />
        </span>
        <div>
          <h3 className="text-lg font-semibold">{copy.prioritiesReady}</h3>
          <p className="mt-1 text-sm leading-6 text-secondary">
            {copy.prioritiesReadyBody}
          </p>
        </div>
      </div>
      <ol className="mt-3 grid gap-2">
        {steps.map(([number, text]) => (
          <li
            className="flex items-center gap-3 rounded-xl border border-line bg-quiet px-3 py-2.5 text-sm text-secondary"
            key={number}
          >
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-surface font-semibold text-brand">
              {number}
            </span>
            {text}
          </li>
        ))}
      </ol>
    </div>
  );
}

function DecisionNotice({
  body,
  testId,
  title,
}: {
  readonly body: string;
  readonly testId?: string;
  readonly title: string;
}) {
  return (
    <div
      className="mt-4 flex gap-4 rounded-2xl border border-brand/20 bg-brand-soft/50 p-5"
      data-testid={testId}
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-surface text-brand shadow-sm">
        <Icon className="size-5" name="spark" />
      </span>
      <div>
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-secondary">{body}</p>
      </div>
    </div>
  );
}

function DecisionPath({
  caseOrganization,
  claim,
  mode,
}: {
  readonly caseOrganization: string;
  readonly claim: DerivedClaim;
  readonly mode: "ACTIVE" | "EVIDENCE_UPDATED";
}) {
  const nodes = decisionPathNodes(claim, mode, caseOrganization);
  return (
    <ol
      className="relative mt-4 space-y-3 before:absolute before:bottom-8 before:left-[1.35rem] before:top-8 before:w-0.5 before:bg-brand/30"
      data-testid="decision-path"
    >
      {nodes.map((node, index) => {
        const isFirst = index === 0;
        const isLast = index === nodes.length - 1;
        return (
          <li className="relative flex gap-3" key={`${node.label}-${index}`}>
            <span
              className={`z-10 grid size-11 shrink-0 place-items-center rounded-full border ${
                isFirst || isLast
                  ? "border-brand bg-brand text-white shadow-md shadow-brand/20"
                  : "border-brand/20 bg-brand-soft text-brand"
              }`}
            >
              <Icon className="size-5" name={decisionIcon(node.label, index)} />
            </span>
            <div
              className={`min-w-0 flex-1 rounded-2xl border px-4 py-3 ${
                isFirst
                  ? "border-brand/30 bg-brand-soft/60"
                  : isLast
                    ? "border-brand bg-surface shadow-sm shadow-brand/10"
                    : "border-line bg-quiet"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand">
                  {node.label}
                </p>
              </div>
              <p
                className={`mt-1 leading-6 ${isFirst || isLast ? "font-semibold text-ink" : "text-sm text-secondary"}`}
                data-testid={isFirst ? "active-probe" : undefined}
              >
                {isFirst && node.label === "Active claim"
                  ? `Active probe: ${node.body}`
                  : node.body}
              </p>
              {node.href ? (
                <a
                  className="mt-2 inline-flex min-h-11 items-center gap-1.5 py-2 text-xs font-semibold text-brand underline decoration-brand/30 underline-offset-4 hover:decoration-brand"
                  href={node.href}
                  rel="noreferrer"
                  target="_blank"
                >
                  View source
                  <Icon className="size-3.5" name="arrow" />
                </a>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function decisionIcon(label: string, index: number): IconName {
  if (index === 0) return "code";
  if (/evidence|changed/i.test(label)) return "scales";
  if (/unresolved|state/i.test(label)) return "question";
  if (/know/i.test(label)) return "lightbulb";
  return "message";
}
