"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { CaseWorkspace } from "@/components/CaseWorkspace";
import { chatgptDeepDiveHref, chatgptDeepDivePrompt } from "@/lib/ai/research-claim";
import {
  CASE_STORAGE_KEY,
  createCaseExport,
  loadPersistedCase,
  parseImportedCaseFile,
  savePersistedCase,
} from "@/lib/case-persistence";
import { createCaseStore } from "@/lib/case-store";
import type { FixtureId } from "@/lib/case-store";
import { FIXTURES } from "@/lib/case-store";
import { cannedInterviewAnswer } from "@/lib/demo/canned-answers";
import { MAX_CASE_FILE_BYTES } from "@/lib/domain/limits";
import { CASE_TOOL_CONTRACTS } from "@/lib/webmcp/contracts";
import { webmcpToolDiagnostic } from "@/lib/webmcp/diagnostics";
import { useCaseWebMCPTools } from "@/lib/webmcp/use-case-tools";

const SESSION_PERSISTENCE_WARNING =
  "Case imported, but this browser could not keep it for refresh. Keep the JSON file to restore it.";

export function CaseApp() {
  const store = useMemo(() => createCaseStore(), []);
  const caseImportSequence = useRef(0);
  const [caseFileStatus, setCaseFileStatus] = useState<{
    readonly error: boolean;
    readonly message: string;
  } | null>(null);
  const [investigating, setInvestigating] = useState(false);
  const webmcp = useCaseWebMCPTools(store);
  const snapshot = useSyncExternalStore(
    store.subscribe,
    store.getState,
    store.getState,
  );
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sample = params.get("sample");
    let seeded = false;
    if (sample && sample in FIXTURES) {
      store.loadFixture(sample as FixtureId);
      seeded = true;
    } else if (params.get("imported") === "1") {
      try {
        const raw = window.sessionStorage.getItem("rolequiry.import");
        if (raw) {
          const parsed = JSON.parse(raw) as {
            company: string;
            role: string;
            sourceUrl?: string;
            jobPostingUrl?: string;
            companyWebsite?: string;
            employerDomain?: string;
            claims: Array<{
              dimension: string;
              employerStatement: string;
              unresolvedVariable: string;
              measurableForm: string;
            }>;
          };
          store.importRole(parsed);
          seeded = true;
        }
      } catch {
        // Keep the default fixture if the intake payload is missing.
      }
    }
    const local = loadPersistedCase(window.localStorage);
    const legacyTabSession = local
      ? null
      : loadPersistedCase(window.sessionStorage);
    const saved = local ?? legacyTabSession;
    if (saved && !seeded) store.restore(saved);
    const persist = () => {
      if (savePersistedCase(window.localStorage, store.getState())) {
        return true;
      }
      setCaseFileStatus({
        error: true,
        message: SESSION_PERSISTENCE_WARNING,
      });
      return false;
    };
    if (persist() && legacyTabSession) {
      try {
        window.sessionStorage.removeItem(CASE_STORAGE_KEY);
      } catch {
        // The durable copy already exists; the stale tab copy can remain.
      }
    }
    return store.subscribe(persist);
  }, [store]);
  const selected = snapshot.derived.claims.find(
    (claim) => claim.id === snapshot.activeProbeId,
  );
  const canned = selected ? cannedInterviewAnswer(selected.id) : null;
  const registrations = [
    [CASE_TOOL_CONTRACTS[0].name, webmcp.claims],
    [CASE_TOOL_CONTRACTS[1].name, webmcp.state],
    [CASE_TOOL_CONTRACTS[2].name, webmcp.select],
    [CASE_TOOL_CONTRACTS[3].name, webmcp.record],
    [CASE_TOOL_CONTRACTS[4].name, webmcp.imported],
    [CASE_TOOL_CONTRACTS[5].name, webmcp.research],
    [CASE_TOOL_CONTRACTS[6].name, webmcp.priorities],
    [CASE_TOOL_CONTRACTS[7].name, webmcp.dossier],
  ] as const;
  const webmcpCount = registrations.filter(
    ([, state]) => state.registered,
  ).length;
  const webmcpDiagnostics = registrations.map(([name, state]) =>
    webmcpToolDiagnostic(name, state),
  );
  const exportCase = () => {
    let objectUrl: string | null = null;
    try {
      const exported = createCaseExport(snapshot);
      objectUrl = URL.createObjectURL(
        new Blob([exported.contents], { type: "application/json" }),
      );
      const link = document.createElement("a");
      link.download = exported.filename;
      link.href = objectUrl;
      document.body.append(link);
      link.click();
      link.remove();
      setCaseFileStatus({
        error: false,
        message: "Case JSON exported locally.",
      });
    } catch {
      setCaseFileStatus({
        error: true,
        message: "Could not export this case.",
      });
    } finally {
      if (objectUrl) {
        const urlToRevoke = objectUrl;
        window.setTimeout(() => URL.revokeObjectURL(urlToRevoke), 0);
      }
    }
  };
  const importCase = async (file: File) => {
    const sequence = caseImportSequence.current + 1;
    caseImportSequence.current = sequence;
    if (file.size > MAX_CASE_FILE_BYTES) {
      setCaseFileStatus({
        error: true,
        message: "Could not import this Rolequiry JSON file.",
      });
      return;
    }
    try {
      const saved = parseImportedCaseFile(await file.text());
      if (sequence !== caseImportSequence.current) return;
      if (!saved) throw new Error("Invalid case file");
      store.restore(saved);
      const persisted = savePersistedCase(
        window.localStorage,
        store.getState(),
      );
      setCaseFileStatus({
        error: !persisted,
        message: persisted
          ? "Case imported from local JSON."
          : SESSION_PERSISTENCE_WARNING,
      });
    } catch {
      if (sequence !== caseImportSequence.current) return;
      setCaseFileStatus({
        error: true,
        message: "Could not import this Rolequiry JSON file.",
      });
    }
  };

  const investigate = async () => {
    const current = store.getState();
    if (!current.activeProbeId) {
      store.selectDecisionChanger();
    }
    const next = store.getState();
    const claim = next.derived.claims.find(
      (item) => item.id === next.activeProbeId,
    );
    if (!claim) {
      setCaseFileStatus({
        error: true,
        message: "먼저 중요도를 고르면 다음에 볼 항목이 정해집니다.",
      });
      return;
    }
    setInvestigating(true);
    setCaseFileStatus({ error: false, message: "이 항목을 공개된 정보에서 찾는 중." });
    try {
      const response = await fetch("/api/research", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          claimId: claim.id,
          employerStatement: claim.employerStatement,
          unresolvedVariable: claim.unresolvedVariable,
          company: next.source.company,
          role: next.source.role,
          jobPostingUrl: next.source.jobPostingUrl ?? next.source.sourceUrl,
          companyWebsite: next.source.companyWebsite,
        }),
      });
      const payload = (await response.json()) as {
        error?: string;
        claimId?: string;
        stance?: "SUPPORTS" | "CHALLENGES" | "NEUTRAL";
        text?: string;
        sourceKind?: "EMPLOYER_OFFICIAL" | "FIRST_PERSON_EXPERIENCE";
        sourceLabel?: string;
        sourceUrl?: string;
        verificationStatus?: "VERIFIED" | "INSUFFICIENT" | "REJECTED";
      };
      if (!response.ok || !payload.claimId || !payload.sourceUrl || !payload.text || !payload.sourceKind || !payload.sourceLabel || !payload.stance || !payload.verificationStatus) {
        setCaseFileStatus({
          error: true,
          message: payload.error ?? "이 항목을 찾지 못했습니다. ChatGPT로 더 깊게 보기를 눌러 보세요.",
        });
        return;
      }
      store.recordVerifiedResearch({
        claimId: payload.claimId,
        stance: payload.stance,
        text: payload.text,
        sourceKind: payload.sourceKind,
        sourceLabel: payload.sourceLabel,
        sourceUrl: payload.sourceUrl,
        verificationStatus: payload.verificationStatus,
      });
      setCaseFileStatus({
        error: false,
        message:
          payload.verificationStatus === "INSUFFICIENT"
            ? "공개된 정보만으로는 아직 모릅니다. 근거는 남겨 뒀습니다."
            : "찾은 근거를 이 항목에 붙였습니다.",
      });
    } catch {
      setCaseFileStatus({
        error: true,
        message: "이 항목을 찾지 못했습니다. ChatGPT로 더 깊게 보기를 눌러 보세요.",
      });
    } finally {
      setInvestigating(false);
    }
  };

  const shareCase = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCaseFileStatus({ error: false, message: "결과 링크를 복사했습니다." });
    } catch {
      setCaseFileStatus({ error: true, message: "링크를 복사하지 못했습니다." });
    }
  };

  const openDeepDive = async () => {
    const current = store.getState();
    const claim = current.derived.claims.find((item) => item.id === current.activeProbeId);
    if (!claim) {
      setCaseFileStatus({
        error: true,
        message: "먼저 중요도를 고르면 다음에 볼 항목이 정해집니다.",
      });
      return;
    }
    const prompt = chatgptDeepDivePrompt({
      caseUrl: window.location.href,
      company: current.source.company,
      role: current.source.role,
      employerStatement: claim.employerStatement,
      unresolvedVariable: claim.unresolvedVariable,
      question: claim.measurableForm,
    });
    const href = chatgptDeepDiveHref(prompt);
    try {
      await navigator.clipboard.writeText(prompt);
    } catch {
      // Opening ChatGPT with the prompt in the URL is enough if clipboard is blocked.
    }
    const opened = window.open(href, "_blank", "noopener,noreferrer");
    setCaseFileStatus({
      error: !opened,
      message: opened
        ? "ChatGPT에 이 케이스 안내를 넣어 열었습니다. 붙여넣기는 복사해 뒀습니다."
        : "팝업이 막혔습니다. 복사된 안내를 ChatGPT에 붙여넣으세요.",
    });
  };

  const leaveFeedback = async () => {
    const note = window.prompt("지원할지 판단하는 데 도움이 됐나요? 한 줄만 적어 주세요.");
    if (!note || !note.trim()) return;
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          note: note.trim(),
          role: snapshot.source.role,
          company: snapshot.source.company,
        }),
      });
      setCaseFileStatus({
        error: !response.ok,
        message: response.ok ? "피드백을 기록했습니다." : "피드백을 저장하지 못했습니다.",
      });
    } catch {
      setCaseFileStatus({ error: true, message: "피드백을 저장하지 못했습니다." });
    }
  };

  return (
    <CaseWorkspace
      caseFileError={caseFileStatus?.error ?? false}
      caseFileMessage={caseFileStatus?.message ?? null}
      cannedAnswerLabel={canned?.buttonLabel}
      onExportCase={exportCase}
      onImportanceChange={store.setImportance}
      onImportCase={importCase}
      onLoadFixture={store.loadFixture}
      onRank={investigate}
      onRecordAnswer={canned ? () => store.recordAnswer(canned) : undefined}
      onReset={store.reset}
      onShare={shareCase}
      onFeedback={leaveFeedback}
      onDeepDive={openDeepDive}
      investigating={investigating}
      snapshot={snapshot}
      webmcpCount={webmcpCount}
      webmcpDiagnostics={webmcpDiagnostics}
    />
  );
}
