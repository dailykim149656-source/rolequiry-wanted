// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CaseWorkspace } from "@/components/CaseWorkspace";
import { createCaseStore } from "@/lib/case-store";
import { SPEAKER_ROLE } from "@/lib/domain/types";
import type { WebMCPToolDiagnostic } from "@/lib/webmcp/diagnostics";
import {
  importRoleFromClaimsTool,
  recordInterviewAnswerTool,
  recordResearchEvidenceTool,
  selectDecisionChanger,
} from "@/lib/webmcp/tools";
import { LocaleProvider } from "@/lib/i18n";

afterEach(cleanup);

function createImportedStore() {
  const store = createCaseStore();
  importRoleFromClaimsTool(store, {
    company: "Example Corp",
    role: "Staff Engineer",
    claims: [
      {
        dimension: "On-call load",
        employerStatement: "On-call is rare",
        unresolvedVariable: "How often does this team get paged?",
        measurableForm: "Pages per engineer last two quarters",
      },
    ],
  });
  return store;
}

function renderWorkspace(
  store = createCaseStore(),
  webmcpCount = 0,
  webmcpDiagnostics: readonly WebMCPToolDiagnostic[] = [
    { name: "get_role_claims", status: "UNAVAILABLE" },
    { name: "get_case_state", status: "UNAVAILABLE" },
  ],
  caseFiles: {
    readonly message?: string | null;
    readonly error?: boolean;
    readonly onExport?: () => void;
    readonly onImport?: (file: File) => void;
  } = {},
) {
  render(
    <LocaleProvider initial="en">
    <CaseWorkspace
      caseFileError={caseFiles.error ?? false}
      caseFileMessage={caseFiles.message ?? null}
      cannedAnswerLabel={undefined}
      onExportCase={caseFiles.onExport ?? (() => undefined)}
      onImportanceChange={() => undefined}
      onImportCase={caseFiles.onImport ?? (() => undefined)}
      onLoadFixture={() => undefined}
      onRank={() => undefined}
      onRecordAnswer={undefined}
      onReset={() => undefined}
      snapshot={store.getState()}
      webmcpCount={webmcpCount}
      webmcpDiagnostics={webmcpDiagnostics}
    />
    </LocaleProvider>,
  );
}

describe("case workspace status", () => {
  it("does not claim WebMCP is live when no tools registered", () => {
    renderWorkspace();

    const summary = screen.getByRole("status");
    expect(summary.getAttribute("aria-live")).toBe("polite");
    expect(summary.getAttribute("aria-atomic")).toBe("true");
    expect(screen.queryByText("WebMCP live")).toBeNull();
  });

  it("reports all eight case tools when they are registered", () => {
    renderWorkspace(createCaseStore(), 8);

    expect(screen.getByText("WebMCP 8/8 live")).toBeTruthy();
    expect(screen.getByTestId("tool-status").textContent).toContain("8/8");
  });

  it("shows the due diligence dossier with an interview pack for the demo case", () => {
    renderWorkspace();

    const dossier = screen.getByTestId("decision-dossier");
    expect(dossier.textContent).toContain("Due diligence dossier");
    expect(screen.getByTestId("dossier-blockers")).toBeTruthy();
    expect(
      within(screen.getByTestId("interview-pack")).getAllByText(/Ask the/i)
        .length,
    ).toBeGreaterThan(0);
  });

  it("locks the dossier for an imported case until priorities are confirmed", () => {
    renderWorkspace(createImportedStore());

    expect(screen.getByTestId("decision-dossier").textContent).toContain(
      "Confirm your priorities first",
    );
    expect(screen.queryByTestId("dossier-blockers")).toBeNull();
  });

  it("distinguishes registration failures from an unsupported browser", () => {
    renderWorkspace(createCaseStore(), 0, [
      { name: "get_role_claims", status: "FAILED" },
      { name: "get_case_state", status: "FAILED" },
    ]);

    expect(screen.getByText("WebMCP registration failed")).toBeTruthy();
    expect(screen.queryByText("Open in a WebMCP browser")).toBeNull();
  });

  it("shows tool-level diagnostics without exposing raw registration errors", () => {
    renderWorkspace(createCaseStore(), 1, [
      { name: "get_role_claims", status: "LIVE" },
      { name: "get_case_state", status: "FAILED" },
      { name: "select_decision_changer", status: "PENDING" },
    ]);

    const diagnostics = screen.getByTestId("webmcp-diagnostics");
    expect(diagnostics.textContent).toContain("get_case_state");
    expect(diagnostics.textContent).toContain("Registration failed");
    expect(diagnostics.textContent).toContain("Registration pending");
    expect(diagnostics.textContent).not.toContain("NotAllowedError");
  });

  it("offers local JSON backup and forwards the selected file", () => {
    const onExport = vi.fn();
    const onImport = vi.fn();
    renderWorkspace(createImportedStore(), 0, undefined, {
      message: "Case imported from local JSON.",
      onExport,
      onImport,
    });

    fireEvent.click(screen.getByRole("button", { name: "Export case JSON" }));
    expect(onExport).toHaveBeenCalledOnce();

    const file = new File(["{}"], "case.json", {
      type: "application/json",
    });
    fireEvent.change(screen.getByLabelText("Import case JSON"), {
      target: { files: [file] },
    });
    expect(onImport).toHaveBeenCalledWith(file);
    expect(screen.getAllByText("Case imported from local JSON.").length).toBeGreaterThan(0);
    expect(screen.getByText(/never uploaded/i)).toBeTruthy();
  });

  it("offers restore but not a meaningless demo export", () => {
    renderWorkspace();

    expect(screen.getByLabelText("Import case JSON")).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Export case JSON" }),
    ).toBeNull();
  });

  it("keeps employer claims as compact text under the location line", () => {
    renderWorkspace();

    const link = screen.getByRole("link", { name: "Employer claims" });
    expect(link.className).not.toContain("min-h-11");
    expect(link.className).toContain("text-[#3366ff]");
    const header = link.closest("section");
    expect(header).toBeTruthy();
    const chipRow = header?.querySelector("div.flex.flex-wrap");
    expect(chipRow?.contains(link)).toBe(false);
    expect(chipRow?.textContent).toContain("Confirmed");
    expect(chipRow?.textContent).toContain("Conflicted");
    expect(chipRow?.textContent).toContain("Unknown");
    expect(chipRow?.textContent).not.toContain("Employer claims");
    expect(chipRow?.parentElement).toBe(header);
  });

  it("puts the Decision Path before the Claim Board for narrow screens", () => {
    renderWorkspace();

    const decision = screen.getByRole("region", { name: "Decision Path" });
    const board = screen.getByRole("region", { name: "Claim Board" });
    expect(
      decision.compareDocumentPosition(board) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("marks the active probe on its matching claim card", () => {
    const store = createCaseStore();
    selectDecisionChanger(store);
    renderWorkspace(store, 6);

    const active = screen.getByTestId("claim-technical-ownership");
    expect(active.getAttribute("data-active")).toBe("true");
    expect(active.textContent).toContain("Active probe");
    expect(screen.getByTestId("claim-travel").getAttribute("data-active")).toBe(
      "false",
    );
  });

  it("does not tell a fully prioritized demo case to set priorities", () => {
    renderWorkspace();

    expect(screen.getByText("Start with this item")).toBeTruthy();
    expect(screen.queryByText(/Set your priorities, then/)).toBeNull();
  });

  it("shows the agent workflow before the first probe is selected", () => {
    renderWorkspace();

    const starter = screen.getByTestId("agent-starter");
    expect(starter.textContent).toContain("What should I investigate next?");
    expect(starter.textContent).toContain("Verify the active claim");
    expect(starter.textContent).toContain("Record the answer");
  });

  it("discloses the ranking formula as an uncalibrated heuristic", () => {
    renderWorkspace();

    const explanation = screen.getByText("How ranking works").parentElement;
    expect(explanation?.textContent).toContain("40% candidate priority");
    expect(explanation?.textContent).toContain("30% unresolvedness");
    expect(explanation?.textContent).toContain("30% tension");
    expect(explanation?.textContent).toContain(
      "Ties use stable dimension text, then claim ID.",
    );
    expect(explanation?.textContent).toContain(
      "public ranking rule, not a fit score",
    );
  });

  it("shows one priority instruction for a fresh imported case", () => {
    const store = createCaseStore();
    importRoleFromClaimsTool(store, {
      company: "Example Corp",
      role: "Staff Engineer",
      claims: [
        {
          dimension: "On-call load",
          employerStatement: "On-call is rare",
          unresolvedVariable: "How often does this team get paged?",
          measurableForm: "Pages per engineer last two quarters",
        },
      ],
    });
    renderWorkspace(store);

    expect(
      screen.getAllByText(/Pick what matters, then the next item is set/),
    ).toHaveLength(1);
  });

  it("defers imported claim status until candidate priority is set", () => {
    const store = createCaseStore();
    importRoleFromClaimsTool(store, {
      company: "Example Corp",
      role: "Staff Engineer",
      claims: [
        {
          dimension: "On-call load",
          employerStatement: "On-call is rare",
          unresolvedVariable: "How often does this team get paged?",
          measurableForm: "Pages per engineer last two quarters",
        },
      ],
    });
    renderWorkspace(store);

    expect(
      screen
        .getByTestId("claim-imported-1")
        .querySelector("[data-status]")
        ?.getAttribute("data-status"),
    ).toBe("PRIORITY_NOT_SET");
  });

  it("maps evidence stance composition to semantic signal tones", () => {
    renderWorkspace();
    const ownership = within(screen.getByTestId("claim-technical-ownership"));
    const customer = within(screen.getByTestId("claim-customer-interaction"));

    expect(
      ownership.getByRole("img", {
        name: "Public: 2 evidence items, mixed",
      }).className,
    ).toContain("bg-amber-soft");
    expect(
      customer.getByRole("img", {
        name: "Public: 2 evidence items, supported",
      }).className,
    ).toContain("bg-supported-soft");
    expect(
      customer.getByRole("img", {
        name: "Interview: 1 evidence item, supported",
      }).className,
    ).toContain("bg-supported-soft");
  });

  it("flags an agent-declared employer source from a different domain", () => {
    const store = createCaseStore();
    importRoleFromClaimsTool(store, {
      company: "OpenAI",
      role: "Forward Deployed Engineer, Seoul",
      sourceUrl: "https://openai.com/careers/fde-seoul/",
      claims: [
        {
          dimension: "Travel concentration",
          employerStatement: "50% travel is expected.",
          unresolvedVariable: "How the stated 50% is distributed",
          measurableForm: "Median travel days per quarter",
        },
      ],
    });
    store.setPriorities([{ claimId: "imported-1", importance: "CRITICAL" }]);
    selectDecisionChanger(store);
    recordResearchEvidenceTool(store, {
      stance: "NEUTRAL",
      summary: "A job board mirrors the posting text.",
      sourceUrl: "https://jobs.example-board.com/openai-fde-seoul",
      sourceLabel: "Job board mirror",
      sourceKind: "EMPLOYER_OFFICIAL",
    });
    renderWorkspace(store);

    expect(
      screen.getByText("Different domain than the job posting"),
    ).toBeTruthy();
  });

  it("labels agent-declared employer sources without implying verification", () => {
    const store = createCaseStore();
    selectDecisionChanger(store);
    recordResearchEvidenceTool(store, {
      stance: "SUPPORTS",
      summary: "The employer page describes end-to-end ownership.",
      sourceUrl: "https://example.com/engineering",
      sourceLabel: "Engineering page",
      sourceKind: "EMPLOYER_OFFICIAL",
    });
    renderWorkspace(store);

    expect(
      screen.getByText("Employer-published · agent-reported"),
    ).toBeTruthy();
    expect(screen.queryByText(/^Verified$/)).toBeNull();
  });

  it("flags an agent-declared employer source when the case has no posting URL to check", () => {
    const store = createCaseStore();
    importRoleFromClaimsTool(store, {
      company: "OpenAI",
      role: "Forward Deployed Engineer, Seoul",
      claims: [
        {
          dimension: "Travel concentration",
          employerStatement: "50% travel is expected.",
          unresolvedVariable: "How the stated 50% is distributed",
          measurableForm: "Median travel days per quarter",
        },
      ],
    });
    store.setPriorities([{ claimId: "imported-1", importance: "CRITICAL" }]);
    selectDecisionChanger(store);
    recordResearchEvidenceTool(store, {
      stance: "CHALLENGES",
      summary: "A page claiming to be official says travel runs far above 50%.",
      sourceUrl: "https://jobs.example-board.com/openai-fde-seoul",
      sourceLabel: "Claimed official posting",
      sourceKind: "EMPLOYER_OFFICIAL",
    });
    renderWorkspace(store);

    expect(
      screen.getByText("No job posting domain to verify against"),
    ).toBeTruthy();
  });

  it("labels neutral-only evidence as neutral instead of empty", () => {
    // Given
    const store = createCaseStore();
    selectDecisionChanger(store);

    // When
    recordInterviewAnswerTool(store, {
      stance: "NEUTRAL",
      text: "The interviewer could not quantify the ownership boundary.",
      speakerRole: SPEAKER_ROLE.HIRING_MANAGER,
    });
    renderWorkspace(store);

    // Then
    const ownership = within(screen.getByTestId("claim-technical-ownership"));
    expect(
      ownership.getByRole("img", {
        name: "Interview: 1 evidence item, neutral",
      }).className,
    ).toContain("bg-unverified-soft");
  });
});
