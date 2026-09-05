import Link from "next/link";
import type { CaseSnapshot, FixtureId } from "@/lib/case-store";
import { CASE_TOOL_CONTRACTS } from "@/lib/webmcp/contracts";
import type { WebMCPToolDiagnostic } from "@/lib/webmcp/diagnostics";
import { Icon } from "./Icon";
import { LanguageToggle, useLocale } from "@/lib/i18n";

const TOTAL_TOOLS = CASE_TOOL_CONTRACTS.length;

export function ProductBar({
  webmcpCount,
  diagnostics = [],
  total = TOTAL_TOOLS,
}: {
  readonly webmcpCount: number;
  readonly diagnostics?: readonly WebMCPToolDiagnostic[];
  readonly total?: number;
}) {
  const hasFailure = diagnostics.some((item) => item.status === "FAILED");
  const isPending = diagnostics.some((item) => item.status === "PENDING");
  const isLive = webmcpCount === total;
  const { copy } = useLocale();
  return (
    <header className="-mx-5 mb-6 flex h-[50px] items-center justify-between border-b border-[#ececec] px-5">
      <div className="flex min-w-0 items-center gap-3">
        <div className="min-w-0 sm:flex sm:items-baseline sm:gap-4">
          <p className="text-lg font-bold tracking-tight">
            Rolequiry
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Link className="rounded-full border border-[#e1e2e4] px-3 py-1.5 text-sm font-semibold" href="/case?sample=atlas-fde">
          {copy.sample}
        </Link>
        <Link className="rounded-full border border-[#e1e2e4] px-3 py-1.5 text-sm font-semibold" href="/">
          {copy.otherPosting}
        </Link>
        <LanguageToggle />
        <output aria-atomic="true" aria-live="polite" className="sr-only">
          {hasFailure
            ? "WebMCP registration failed"
            : isLive
              ? `WebMCP ${total}/${total} live`
              : isPending
                ? "WebMCP registration pending"
                : ""}
        </output>
      </div>
    </header>
  );
}

export function DossierHeader({
  snapshot,
}: {
  readonly snapshot: CaseSnapshot;
}) {
  const claims = snapshot.derived.claims;
  const unresolved = claims.filter(
    (claim) =>
      claim.status === "UNVERIFIED" || claim.status === "MATERIAL_AMBIGUITY",
  ).length;
  const challenged = claims.filter(
    (claim) => claim.status === "CHALLENGED",
  ).length;
  const company = snapshot.source.company.replace(
    /\s*\(synthetic demo\)$/i,
    "",
  );
  const origin =
    snapshot.source.origin === "DEMO_FIXTURE" ? "Demo case" : "Imported case";
  const { copy, locale } = useLocale();
  const originLabel =
    snapshot.source.origin === "DEMO_FIXTURE" ? copy.demo : copy.imported;

  return (
    <section className="mb-5">
      <div className="flex gap-4">
        <CompanyMark company={company} />
        <div className="min-w-0 flex-1">
          <h1 className="text-[22px] font-bold tracking-tight">
            {snapshot.source.role}
          </h1>
          <p className="mt-1 text-sm font-semibold text-[#333]">{company}</p>
          <p className="mt-0.5 text-[13px] text-[#999]">
            {snapshot.source.id === "atlas-fde"
              ? "서울 강남구 · 경력 4년 이상"
              : originLabel}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full bg-[#f2f4f7] px-2.5 py-1 text-xs font-semibold text-[#333]">
              {copy.aligned} {claims.filter((claim) => claim.status === "SUPPORTED").length}
            </span>
            <span className="rounded-full bg-[#f2f4f7] px-2.5 py-1 text-xs font-semibold text-[#333]">
              {copy.mismatch} {challenged}
            </span>
            <span className="rounded-full bg-[#f2f4f7] px-2.5 py-1 text-xs font-semibold text-[#333]">
              {copy.unknown} {unresolved}
            </span>
            <span className="sr-only" data-testid="case-origin">
              {locale === "en" ? origin : originLabel}
            </span>
            {snapshot.source.id === "atlas-fde" ? (
              <Link
                className="inline-flex min-h-11 items-center py-2 text-sm font-medium text-[#3366ff]"
                href="/employer/atlas-fde"
              >
                {copy.employerClaims}
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

export function CaseFileControls({
  canExport,
  error,
  message,
  onExport,
  onImport,
  onShare,
}: {
  readonly canExport: boolean;
  readonly error: boolean;
  readonly message: string | null;
  readonly onExport: () => void;
  readonly onImport: (file: File) => void;
  readonly onShare?: () => void;
}) {
  return (
    <section
      aria-label="Case file"
      className="mt-3 flex flex-col gap-3 rounded-2xl border border-line bg-surface px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="min-w-0">
        <p className="font-semibold text-ink">Local case backup</p>
        <p className="mt-0.5 text-xs leading-5 text-muted">
          The JSON is created and read on this device; it is never uploaded.
        </p>
        {message ? (
          <p
            className={`mt-1 text-xs font-medium ${error ? "text-challenged" : "text-supported"}`}
            role={error ? "alert" : "status"}
          >
            {message}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        {canExport ? (
          <button
            className={controlChip(false)}
            onClick={onExport}
            type="button"
          >
            Export case JSON
          </button>
        ) : null}
        {onShare ? (
          <button className={controlChip(false)} onClick={onShare} type="button">
            결과 공유
          </button>
        ) : null}
        <label
          className={`${controlChip(false)} relative inline-flex cursor-pointer items-center overflow-hidden focus-within:ring-2 focus-within:ring-brand/30`}
        >
          Import case JSON
          <input
            accept=".json,application/json"
            className="absolute inset-0 cursor-pointer opacity-0"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (file) onImport(file);
              event.currentTarget.value = "";
            }}
            type="file"
          />
        </label>
      </div>
    </section>
  );
}

export function CompanyMark({ company }: { readonly company: string }) {
  const words = company
    .split(/\s+/)
    .map((word) => word.replace(/[^a-z0-9]/gi, ""))
    .filter(Boolean);
  const initials =
    words.length > 1
      ? words
          .slice(0, 2)
          .map((word) => word[0])
          .join("")
      : (words[0]?.slice(0, 2) ?? "R");

  return (
    <div
      aria-label={`${company} monogram`}
      className="grid size-14 shrink-0 place-items-center rounded-[12px] bg-[#1d2b4a] text-[22px] font-extrabold uppercase text-white"
      role="img"
    >
      {initials}
    </div>
  );
}

function Metric({
  value,
  label,
}: {
  readonly value: number;
  readonly label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="font-semibold text-ink">{value}</span>
      {label}
    </span>
  );
}

export function DemoControls({
  activeFixture,
  cannedAnswerLabel,
  onLoadFixture,
  onRank,
  onRecordAnswer,
  onReset,
  webmcpCount,
  webmcpDiagnostics,
}: {
  readonly activeFixture: string;
  readonly cannedAnswerLabel: string | undefined;
  readonly onLoadFixture: (id: FixtureId) => void;
  readonly onRank: () => void;
  readonly onRecordAnswer: (() => void) | undefined;
  readonly onReset: () => void;
  readonly webmcpCount: number;
  readonly webmcpDiagnostics: readonly WebMCPToolDiagnostic[];
}) {
  return (
    <details className="mt-5 rounded-2xl border border-dashed border-strong bg-surface/60 p-4 text-sm text-secondary">
      <summary className="min-h-11 cursor-pointer py-2 font-semibold text-ink outline-none focus-visible:ring-2 focus-visible:ring-brand/30">
        Demo controls
      </summary>
      <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-4">
        <button
          className={controlChip(activeFixture === "atlas-fde")}
          onClick={() => onLoadFixture("atlas-fde")}
          type="button"
        >
          Northwind FDE
        </button>
        <button
          className={controlChip(activeFixture === "kestrel-solutions")}
          onClick={() => onLoadFixture("kestrel-solutions")}
          type="button"
        >
          Harborline SE
        </button>
        <button className={controlChip(false)} onClick={onReset} type="button">
          Reset demo
        </button>
        <button className={controlChip(false)} onClick={onRank} type="button">
          Rank next question
        </button>
        {cannedAnswerLabel && onRecordAnswer ? (
          <button
            className={controlChip(false)}
            onClick={onRecordAnswer}
            type="button"
          >
            {cannedAnswerLabel}
          </button>
        ) : null}
      </div>
      <p className="mt-3 text-xs text-muted" data-testid="tool-status">
        WebMCP registered: {webmcpCount}/{TOTAL_TOOLS}
      </p>
      <ToolDiagnostics diagnostics={webmcpDiagnostics} />
    </details>
  );
}

function ToolDiagnostics({
  diagnostics,
}: {
  readonly diagnostics: readonly WebMCPToolDiagnostic[];
}) {
  const allUnavailable = diagnostics.every(
    (item) => item.status === "UNAVAILABLE",
  );
  return (
    <div
      className="mt-3 border-t border-line pt-3"
      data-testid="webmcp-diagnostics"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.1em] text-ink">
        Tool diagnostics
      </p>
      {allUnavailable ? (
        <p className="mt-2 text-xs leading-5 text-muted">
          This browser does not expose document.modelContext. Open the same page
          in ChatGPT&apos;s browser or WebMCP-enabled Chrome.
        </p>
      ) : (
        <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
          {diagnostics.map((item) => (
            <li
              className="flex min-w-0 items-center justify-between gap-2 rounded-lg bg-quiet px-2.5 py-2 text-xs"
              key={item.name}
            >
              <code className="truncate text-ink">{item.name}</code>
              <span
                className={`shrink-0 font-semibold ${diagnosticTone(item.status)}`}
              >
                {diagnosticLabel(item.status)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function diagnosticLabel(status: WebMCPToolDiagnostic["status"]): string {
  if (status === "LIVE") return "Live";
  if (status === "FAILED") return "Registration failed";
  if (status === "PENDING") return "Registration pending";
  return "Browser unavailable";
}

function diagnosticTone(status: WebMCPToolDiagnostic["status"]): string {
  if (status === "LIVE") return "text-supported";
  if (status === "FAILED") return "text-challenged";
  return "text-unverified";
}

function controlChip(active: boolean): string {
  return `min-h-11 rounded-full border px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 ${
    active
      ? "border-ink bg-ink text-white"
      : "border-line bg-surface text-secondary hover:border-strong hover:text-ink"
  }`;
}
