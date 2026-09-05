import { ClaimBoard } from "@/components/case-workspace/ClaimBoard";
import { DecisionPanel } from "@/components/case-workspace/DecisionPanel";
import { DossierPanel } from "@/components/case-workspace/DossierPanel";
import {
  CaseFileControls,
  DemoControls,
  DossierHeader,
  ProductBar,
} from "@/components/case-workspace/WorkspaceChrome";
import type { CaseSnapshot, FixtureId } from "@/lib/case-store";
import type { Importance } from "@/lib/domain/types";
import type { WebMCPToolDiagnostic } from "@/lib/webmcp/diagnostics";
import { useLocale } from "@/lib/i18n";

type CaseWorkspaceProps = {
  readonly snapshot: CaseSnapshot;
  readonly webmcpCount: number;
  readonly webmcpDiagnostics: readonly WebMCPToolDiagnostic[];
  readonly caseFileError: boolean;
  readonly caseFileMessage: string | null;
  readonly cannedAnswerLabel: string | undefined;
  readonly onExportCase: () => void;
  readonly onImportanceChange: (
    claimId: string,
    importance: Importance,
  ) => void;
  readonly onImportCase: (file: File) => void;
  readonly onLoadFixture: (id: FixtureId) => void;
  readonly onReset: () => void;
  readonly onRank: () => void;
  readonly onRecordAnswer: (() => void) | undefined;
  readonly onShare?: () => void;
};

export function CaseWorkspace({
  snapshot,
  webmcpCount,
  webmcpDiagnostics,
  caseFileError,
  caseFileMessage,
  cannedAnswerLabel,
  onExportCase,
  onImportanceChange,
  onImportCase,
  onLoadFixture,
  onReset,
  onRank,
  onRecordAnswer,
  onShare,
}: CaseWorkspaceProps) {
  const { copy } = useLocale();
  return (
    <main className="min-h-dvh bg-white text-[#171717]">
      <div className="mx-auto w-full max-w-[1060px] px-5 pb-10">
        <ProductBar diagnostics={webmcpDiagnostics} webmcpCount={webmcpCount} />
        <DossierHeader snapshot={snapshot} />
        <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
          <DecisionPanel
            className="lg:col-start-2 lg:row-start-1"
            onInvestigate={onRank}
            snapshot={snapshot}
          />
          <div className="lg:col-start-1 lg:row-start-1">
            <ClaimBoard
              onImportanceChange={onImportanceChange}
              snapshot={snapshot}
            />
            <DossierPanel snapshot={snapshot} />
          </div>
        </div>
        <details className="mt-8 text-sm text-[#666]">
          <summary className="cursor-pointer font-semibold text-[#171717]">{copy.more}</summary>
          <CaseFileControls
            canExport={snapshot.source.origin === "AGENT_IMPORTED"}
            error={caseFileError}
            message={caseFileMessage}
            onExport={onExportCase}
            onImport={onImportCase}
            {...(onShare ? { onShare } : {})}
          />
          <DemoControls
            activeFixture={snapshot.source.id}
            cannedAnswerLabel={cannedAnswerLabel}
            onLoadFixture={onLoadFixture}
            onRank={onRank}
            onRecordAnswer={onRecordAnswer}
            onReset={onReset}
            webmcpCount={webmcpCount}
            webmcpDiagnostics={webmcpDiagnostics}
          />
        </details>
      </div>
    </main>
  );
}
