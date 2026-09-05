import { employerSourceOrganizationMatch } from "@/lib/domain/policy";
import {
  AUTHORITY_SCOPE,
  type DerivedClaim,
  EVIDENCE_PROVENANCE,
  EVIDENCE_STANCE,
  type Evidence,
} from "@/lib/domain/types";
import { Icon, type IconName } from "./Icon";
import { useLocale } from "@/lib/i18n";

type EvidenceTone = "challenged" | "empty" | "mixed" | "neutral" | "supported";

function countedEvidence(items: readonly Evidence[]): readonly Evidence[] {
  return items.filter(
    (item) =>
      item.verificationStatus !== "INSUFFICIENT" &&
      item.verificationStatus !== "REJECTED",
  );
}

function evidenceTone(items: readonly Evidence[]): EvidenceTone {
  const visible = countedEvidence(items);
  const supports = visible.some(
    (item) => item.stance === EVIDENCE_STANCE.SUPPORTS,
  );
  const challenges = visible.some(
    (item) => item.stance === EVIDENCE_STANCE.CHALLENGES,
  );
  if (supports && challenges) return "mixed";
  if (supports) return "supported";
  if (challenges) return "challenged";
  if (visible.length > 0 || items.length > 0) return "neutral";
  return "empty";
}

export function EvidenceSignals({ claim }: { readonly claim: DerivedClaim }) {
  const { copy } = useLocale();
  const employer = claim.evidence.filter(
    (item) => item.scope === AUTHORITY_SCOPE.EMPLOYER_STATED,
  );
  const reports = claim.evidence.filter(
    (item) => item.scope === AUTHORITY_SCOPE.REPORTED_EXPERIENCE,
  );
  const interview = claim.evidence.filter(
    (item) => item.scope === AUTHORITY_SCOPE.CANDIDATE_SPECIFIC_ANSWER,
  );

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <EvidenceSignal
        count={employer.length}
        icon="building"
        label={copy.employerSource}
        tone={evidenceTone(employer)}
      />
      <EvidenceSignal
        count={reports.length}
        icon="people"
        label={copy.publicSource}
        tone={evidenceTone(reports)}
      />
      <EvidenceSignal
        count={interview.length}
        icon="message"
        label={copy.interviewSource}
        tone={evidenceTone(interview)}
      />
    </div>
  );
}

function EvidenceSignal({
  count,
  icon,
  label,
  tone,
}: {
  readonly count: number;
  readonly icon: IconName;
  readonly label: string;
  readonly tone: EvidenceTone;
}) {
  const toneClass = {
    challenged: "bg-challenged-soft text-challenged",
    empty: "bg-unverified-soft text-unverified",
    mixed: "bg-amber-soft text-amber",
    neutral: "bg-unverified-soft text-unverified",
    supported: "bg-supported-soft text-supported",
  }[tone];
  const summary = `${label}: ${count} evidence ${count === 1 ? "item" : "items"}, ${tone}`;
  return (
    <span
      aria-label={summary}
      className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold ${toneClass}`}
      role="img"
      title={summary}
    >
      <Icon className="size-4" name={icon} />
      <span className="hidden sm:inline">{label}</span>
      <span className="rounded-full bg-surface/70 px-1.5 py-0.5 tabular-nums">
        {count}
      </span>
    </span>
  );
}

export function EvidenceList({
  claim,
  caseOrganization = "",
}: {
  readonly claim: DerivedClaim;
  readonly caseOrganization?: string;
}) {
  const { copy } = useLocale();
  const groups = [
    {
      key: AUTHORITY_SCOPE.EMPLOYER_STATED,
      label: "Employer-source evidence",
      icon: "building" as const,
    },
    {
      key: AUTHORITY_SCOPE.REPORTED_EXPERIENCE,
      label: "Public evidence",
      icon: "people" as const,
    },
    {
      key: AUTHORITY_SCOPE.CANDIDATE_SPECIFIC_ANSWER,
      label: "Interview evidence",
      icon: "message" as const,
    },
  ];

  return (
    <details className="mt-3 border-t border-line pt-3 text-sm">
      <summary className="min-h-11 cursor-pointer rounded-lg px-1 py-2 font-medium text-secondary outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-brand/30">
        {copy.viewEvidence} ({claim.evidence.length})
      </summary>
      <div className="mt-2 grid gap-3">
        {groups.map((group) => {
          const items = claim.evidence.filter(
            (item) => item.scope === group.key,
          );
          if (items.length === 0) return null;
          return (
            <section
              aria-label={group.label}
              className="overflow-hidden rounded-xl border border-line bg-quiet"
              key={group.key}
            >
              <div className="flex items-center gap-2 border-b border-line px-3 py-2 text-xs font-semibold text-secondary">
                <Icon className="size-4" name={group.icon} />
                {group.label}
                <span className="ml-auto tabular-nums text-muted">
                  {items.length}
                </span>
              </div>
              <ul className="divide-y divide-line">
                {items.filter((item) => item.verificationStatus !== "REJECTED").map((item) => (
                  <EvidenceRow
                    caseOrganization={caseOrganization}
                    item={item}
                    key={item.id}
                  />
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </details>
  );
}

function EvidenceRow({
  item,
  caseOrganization,
}: {
  readonly item: Evidence;
  readonly caseOrganization: string;
}) {
  const { copy } = useLocale();
  const sourceUrl = safeHttpUrl(item.sourceUrl);
  const synthetic =
    item.synthetic || item.text.toLowerCase().includes("synthetic");
  const source = item.sourceLabel ?? evidenceSourceLabel(item);
  const provenance = evidenceProvenanceLabel(item);
  const organizationMatch = employerSourceOrganizationMatch(
    item,
    caseOrganization,
  );
  const unverifiableEmployerSource =
    organizationMatch === null &&
    (item.provenance ?? EVIDENCE_PROVENANCE.CASE_INPUT) ===
      EVIDENCE_PROVENANCE.AGENT_REPORTED &&
    item.scope === AUTHORITY_SCOPE.EMPLOYER_STATED;
  return (
    <li className="bg-surface/70 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-semibold text-ink">{source}</p>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${evidenceBadgeClass(item)}`}
        >
          {evidenceBadgeLabel(item, copy)}
        </span>
        {synthetic ? (
          <span className="text-xs font-medium text-muted">Synthetic</span>
        ) : null}
        <span className="text-xs font-medium text-muted">{provenance}</span>
        {organizationMatch === false ? (
          <span className="rounded-full bg-amber-soft px-2 py-0.5 text-xs font-semibold text-amber">
            Different domain than the job posting
          </span>
        ) : organizationMatch === true ? (
          <span className="text-xs font-medium text-supported">
            Domain matches the job posting
          </span>
        ) : unverifiableEmployerSource ? (
          <span className="rounded-full bg-amber-soft px-2 py-0.5 text-xs font-semibold text-amber">
            No job posting domain to verify against
          </span>
        ) : null}
      </div>
      <p className="mt-1.5 leading-6 text-secondary">{item.text}</p>
      {sourceUrl ? (
        <a
          aria-label={`Open ${source} source in a new tab`}
          className="mt-2 inline-flex min-h-11 items-center gap-1.5 py-2 text-xs font-semibold text-brand underline decoration-brand/30 underline-offset-4 hover:decoration-brand"
          href={sourceUrl}
          rel="noreferrer"
          target="_blank"
        >
          View source
          <Icon className="size-3.5" name="arrow" />
        </a>
      ) : null}
    </li>
  );
}

function evidenceSourceLabel(item: Evidence): string {
  if (item.scope === AUTHORITY_SCOPE.EMPLOYER_STATED)
    return "Employer-published claim";
  if (item.scope === AUTHORITY_SCOPE.CANDIDATE_SPECIFIC_ANSWER)
    return item.speakerRole
      ? `Interview · ${titleCase(item.speakerRole)}`
      : "Candidate interview";
  return "Reported experience";
}

function evidenceProvenanceLabel(item: Evidence): string {
  const provenance = item.provenance ?? EVIDENCE_PROVENANCE.CASE_INPUT;
  if (provenance === EVIDENCE_PROVENANCE.AGENT_REPORTED) {
    return item.scope === AUTHORITY_SCOPE.EMPLOYER_STATED
      ? "Employer-published · agent-reported"
      : "Public source · agent-reported";
  }
  if (provenance === EVIDENCE_PROVENANCE.CANDIDATE_REPORTED)
    return "Candidate-reported";
  return "Case input";
}

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");
}

function evidenceBadgeLabel(item: Evidence, copy: { insufficientEvidence: string; rejectedEvidence: string; supportsEvidence: string; challengesEvidence: string; unverified: string }): string {
  if (item.verificationStatus === "INSUFFICIENT") return copy.insufficientEvidence;
  if (item.verificationStatus === "REJECTED") return copy.rejectedEvidence;
  if (item.stance === "SUPPORTS") return copy.supportsEvidence;
  if (item.stance === "CHALLENGES") return copy.challengesEvidence;
  return copy.unverified;
}

function evidenceBadgeClass(item: Evidence): string {
  if (item.verificationStatus === "INSUFFICIENT" || item.verificationStatus === "REJECTED") {
    return "bg-unverified-soft text-unverified";
  }
  if (item.stance === "SUPPORTS") return "bg-supported-soft text-supported";
  if (item.stance === "CHALLENGES") return "bg-challenged-soft text-challenged";
  return "bg-unverified-soft text-unverified";
}

function safeHttpUrl(value?: string): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:"
      ? parsed.toString()
      : null;
  } catch {
    return null;
  }
}
