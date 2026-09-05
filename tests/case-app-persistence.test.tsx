// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CaseApp } from "@/components/CaseApp";
import {
  CASE_STORAGE_KEY,
  serializePersistedCase,
} from "@/lib/case-persistence";
import { createCaseStore } from "@/lib/case-store";
import { importRoleFromClaimsTool } from "@/lib/webmcp/tools";

function savedCase(company: string) {
  const store = createCaseStore();
  importRoleFromClaimsTool(store, {
    company,
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
  return serializePersistedCase(store.getState());
}

function largeSavedCase() {
  const payload = JSON.parse(savedCase("Large File Corp"));
  const template = payload.state.source.claims[0];
  payload.state.source.claims = Array.from({ length: 3 }, (_, claimIndex) => {
    const claimId = `imported-${claimIndex + 1}`;
    return {
      ...template,
      id: claimId,
      dimension: `Evidence-heavy claim ${claimIndex + 1}`,
      evidence: [
        {
          ...template.evidence[0],
          id: `${claimId}-employer`,
        },
        ...Array.from({ length: 99 }, (_, evidenceIndex) => ({
          id: `${claimId}-interview-${evidenceIndex + 2}`,
          scope: "CANDIDATE_SPECIFIC_ANSWER",
          stance: "NEUTRAL",
          text: "😀".repeat(5_000),
          speakerRole: "HIRING_MANAGER",
          sourceKind: "INTERVIEW",
          sourceLabel: "HIRING_MANAGER",
          synthetic: false,
          provenance: "CANDIDATE_REPORTED",
        })),
      ],
    };
  });
  return JSON.stringify(payload);
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe("CaseApp persistence", () => {
  it("prefers the durable browser-local case over a legacy tab session", async () => {
    window.sessionStorage.setItem(CASE_STORAGE_KEY, savedCase("Session Corp"));
    window.localStorage.setItem(CASE_STORAGE_KEY, savedCase("Local Corp"));

    render(<CaseApp />);

    expect(await screen.findAllByText("Local Corp")).toBeTruthy();
  });

  it("migrates a legacy tab-session case into durable local storage", async () => {
    window.sessionStorage.setItem(CASE_STORAGE_KEY, savedCase("Session Corp"));

    render(<CaseApp />);

    expect(await screen.findAllByText("Session Corp")).toBeTruthy();
    expect(window.localStorage.getItem(CASE_STORAGE_KEY)).toContain(
      "Session Corp",
    );
    expect(window.sessionStorage.getItem(CASE_STORAGE_KEY)).toBeNull();
  });

  it("starts from the canonical fixture when a modified demo was saved", () => {
    const demo = createCaseStore();
    demo.setImportance("travel", "CRITICAL");
    window.sessionStorage.setItem(
      CASE_STORAGE_KEY,
      serializePersistedCase(demo.getState()),
    );

    render(<CaseApp />);

    expect(
      screen.getByRole<HTMLSelectElement>("combobox", {
        name: "내 중요도 Travel",
      }).value,
    ).toBe("LOW");
  });

  it("does not retain the demo fixture in durable storage", () => {
    render(<CaseApp />);

    expect(window.localStorage.getItem(CASE_STORAGE_KEY)).toBeNull();
  });

  it("restores a validated local JSON file without uploading it", async () => {
    render(<CaseApp />);
    const contents = savedCase("File Corp");
    const file = {
      name: "rolequiry-file-corp.json",
      size: contents.length,
      text: async () => contents,
    } as File;

    fireEvent.change(screen.getByLabelText("Import case JSON"), {
      target: { files: [file] },
    });

    expect(await screen.findAllByText("File Corp")).toBeTruthy();
    expect(
      await screen.findAllByText("Case imported from local JSON."),
    ).toBeTruthy();
  });

  it("warns when an imported case cannot persist across refresh", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    });
    render(<CaseApp />);
    const contents = savedCase("Quota Corp");
    const file = {
      name: "rolequiry-quota-corp.json",
      size: contents.length,
      text: async () => contents,
    } as File;

    fireEvent.change(screen.getByLabelText("Import case JSON"), {
      target: { files: [file] },
    });

    expect(await screen.findAllByText("Quota Corp")).toBeTruthy();
    expect(
      await screen.findAllByText(
        "Case imported, but this browser could not keep it for refresh. Keep the JSON file to restore it.",
      ),
    ).toBeTruthy();
    expect(screen.queryByText("Case imported from local JSON.")).toBeNull();
  });

  it("imports a valid backup the app can produce at evidence limits", async () => {
    render(<CaseApp />);
    const contents = largeSavedCase();
    const size = new TextEncoder().encode(contents).byteLength;
    expect(size).toBeGreaterThan(5 * 1024 * 1024);
    const file = {
      name: "rolequiry-large-file-corp.json",
      size,
      text: async () => contents,
    } as File;

    fireEvent.change(screen.getByLabelText("Import case JSON"), {
      target: { files: [file] },
    });

    expect(
      await screen.findAllByText("Large File Corp", undefined, {
        timeout: 10_000,
      }),
    ).toBeTruthy();
    expect(
      await screen.findAllByText("Case imported from local JSON."),
    ).toBeTruthy();
  }, 15_000);

  it("rejects an invalid local JSON file without changing the case", async () => {
    render(<CaseApp />);
    const file = {
      name: "invalid.json",
      size: 10,
      text: async () => '{"version":2}',
    } as File;

    fireEvent.change(screen.getByLabelText("Import case JSON"), {
      target: { files: [file] },
    });

    expect(
      await screen.findAllByText("Could not import this Rolequiry JSON file."),
    ).toBeTruthy();
    expect(screen.getAllByText("Northwind Automation")).toBeTruthy();
  });

  it("rejects an external file that claims demo-fixture authority", async () => {
    const payload = JSON.parse(
      serializePersistedCase(createCaseStore().getState()),
    );
    payload.state.source.company = "Forged Demo Corp";
    payload.state.source.claims[0].kind = "EMPLOYER_POLICY";
    const contents = JSON.stringify(payload);
    const file = {
      name: "forged-demo.json",
      size: contents.length,
      text: async () => contents,
    } as File;
    render(<CaseApp />);

    fireEvent.change(screen.getByLabelText("Import case JSON"), {
      target: { files: [file] },
    });

    expect(
      await screen.findAllByText("Could not import this Rolequiry JSON file."),
    ).toBeTruthy();
    expect(screen.getAllByText("Northwind Automation")).toBeTruthy();
    expect(screen.queryByText("Forged Demo Corp")).toBeNull();
  });

  it("keeps the newest selection when file reads finish out of order", async () => {
    let finishFirstRead: (contents: string) => void = () => undefined;
    const firstRead = new Promise<string>((resolve) => {
      finishFirstRead = resolve;
    });
    const firstFile = {
      name: "first.json",
      size: 1_000,
      text: () => firstRead,
    } as File;
    const secondContents = savedCase("Second Corp");
    const secondFile = {
      name: "second.json",
      size: secondContents.length,
      text: async () => secondContents,
    } as File;
    render(<CaseApp />);
    const input = screen.getByLabelText("Import case JSON");

    fireEvent.change(input, { target: { files: [firstFile] } });
    fireEvent.change(input, { target: { files: [secondFile] } });

    expect(await screen.findAllByText("Second Corp")).toBeTruthy();
    await act(async () => {
      finishFirstRead(savedCase("First Corp"));
      await firstRead;
    });

    expect(screen.getAllByText("Second Corp")).toBeTruthy();
    expect(screen.queryByText("First Corp")).toBeNull();
  });

  it("downloads the current case as a local JSON file", async () => {
    const createObjectUrl = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:rolequiry-case");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    const downloadedNames: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
      function recordDownload(this: HTMLAnchorElement) {
        downloadedNames.push(this.download);
      },
    );
    window.localStorage.setItem(CASE_STORAGE_KEY, savedCase("Export Corp"));
    render(<CaseApp />);

    fireEvent.click(screen.getByRole("button", { name: "Export case JSON" }));

    expect(createObjectUrl).toHaveBeenCalledWith(expect.any(Blob));
    expect(downloadedNames).toEqual([
      "rolequiry-export-corp-staff-engineer.json",
    ]);
    expect(await screen.findAllByText("Case JSON exported locally.")).toBeTruthy();
  });
  it("records both support and challenge items returned by research", async () => {
    window.history.replaceState({}, "", "/case?imported=1");
    window.localStorage.setItem(CASE_STORAGE_KEY, savedCase("Research Corp"));
    const fetchMock = vi.fn(async (input: RequestInfo) => {
      const url = String(input);
      if (url === "/api/research") {
        return {
          ok: true,
          json: async () => ({
            claimId: "imported-1",
            items: [
              {
                stance: "SUPPORTS",
                text: "A teammate described end-to-end ownership.",
                sourceKind: "FIRST_PERSON_EXPERIENCE",
                sourceLabel: "Talk",
                sourceUrl: "https://atlas.example.com/talk",
                verificationStatus: "VERIFIED",
              },
              {
                stance: "CHALLENGES",
                text: "Approvals still gate production changes.",
                sourceKind: "FIRST_PERSON_EXPERIENCE",
                sourceLabel: "Notes",
                sourceUrl: "https://notes.example.com/approvals",
                verificationStatus: "VERIFIED",
              },
            ],
          }),
        };
      }
      throw new Error("unexpected fetch " + url);
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<CaseApp />);
    const selects = await screen.findAllByRole("combobox");
    const priority = selects[0];
    expect(priority).toBeDefined();
    if (!priority) return;
    await act(async () => {
      fireEvent.change(priority, { target: { value: "CRITICAL" } });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /이 항목 찾아보기|Look this up/ }));
    });
    fireEvent.click(screen.getByText(/근거 보기|View evidence/));
    expect(screen.getByText("Talk")).toBeTruthy();
    expect(screen.getByText("Notes")).toBeTruthy();
    vi.unstubAllGlobals();
  });
});
