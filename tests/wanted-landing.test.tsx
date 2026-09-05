// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Home from "@/app/page";
import { CaseWorkspace } from "@/components/CaseWorkspace";
import { createCaseStore } from "@/lib/case-store";
import { cleanup } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import { LocaleProvider } from "@/lib/i18n";

afterEach(() => {
  cleanup();
  window.localStorage.removeItem("rolequiry.locale");
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe("Wanted Edition landing", () => {
  it("shows the Job Fit headline instead of redirecting to /case", () => {
    render(
      <LocaleProvider>
        <Home />
      </LocaleProvider>,
    );
    expect(
      screen.getByRole("heading", {
        name: "입사 전에, 이 역할이 나와 맞는지 더 깊이 알아보세요.",
      }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "공고 분석하기" })).toBeTruthy();
    expect(screen.getByText("샘플로 먼저 보기")).toBeTruthy();
    expect(screen.queryByText(/WebMCP/)).toBeNull();
  });

  it("switches the landing chrome to English", () => {
    render(
      <LocaleProvider>
        <Home />
      </LocaleProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "EN" }));
    expect(
      screen.getByRole("heading", {
        name: "Before you join, see whether this role actually fits.",
      }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Analyze posting" })).toBeTruthy();
  });

  it("opens a text paste field when URL fetch fails", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "URL을 읽지 못했습니다. 공고 텍스트를 붙여넣어 주세요." }),
    });
    vi.stubGlobal("fetch", fetchMock);
    render(
      <LocaleProvider>
        <Home />
      </LocaleProvider>,
    );
    fireEvent.change(screen.getByLabelText("원티드 채용공고 URL"), {
      target: { value: "https://this-host-does-not-exist.invalid/job" },
    });
    fireEvent.click(screen.getByRole("button", { name: "공고 분석하기" }));
    expect(await screen.findByLabelText("공고 원문")).toBeTruthy();
    vi.unstubAllGlobals();
  });
});

describe("Wanted Edition sample case", () => {
  it("uses the posting-detail chrome instead of the original RoleQuiry dossier cards", () => {
    const snapshot = createCaseStore().getState();
    render(
      <LocaleProvider>
        <CaseWorkspace
        caseFileError={false}
        caseFileMessage={null}
        cannedAnswerLabel={undefined}
        onExportCase={() => undefined}
        onImportanceChange={() => undefined}
        onImportCase={() => undefined}
        onLoadFixture={() => undefined}
        onRank={() => undefined}
        onRecordAnswer={undefined}
        onReset={() => undefined}
        snapshot={snapshot}
        webmcpCount={0}
        webmcpDiagnostics={[]}
        />
      </LocaleProvider>,
    );
    expect(screen.getByRole("heading", { name: "Forward Deployed Engineer" })).toBeTruthy();
    expect(screen.getByText("공고에서 확인되는 기대사항")).toBeTruthy();
    expect(screen.getByText("공개정보에서 확인되는 조건과 신호")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "다음으로 확인할 항목" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "이 항목 조사하기" })).toBeTruthy();
    expect(screen.getByText(/잘 맞음/)).toBeTruthy();
    expect(screen.queryByText("Active probe")).toBeNull();
    expect(screen.queryByRole("button", { name: "Export case JSON" })).toBeNull();
    expect(screen.queryByText("WebMCP live")).toBeNull();
    expect(screen.queryByText("Priority not set")).toBeNull();
    expect(screen.queryByText("What is settled, what is still open, and what to ask next.")).toBeNull();
    expect(screen.queryByText("Priorities ready")).toBeNull();
    expect(screen.getByText("이 항목부터 조사하면 됩니다")).toBeTruthy();
  });

  it("switches chrome copy between Korean and English", () => {
    const snapshot = createCaseStore().getState();
    render(
      <LocaleProvider>
        <CaseWorkspace
        caseFileError={false}
        caseFileMessage={null}
        cannedAnswerLabel={undefined}
        onExportCase={() => undefined}
        onImportanceChange={() => undefined}
        onImportCase={() => undefined}
        onLoadFixture={() => undefined}
        onRank={() => undefined}
        onRecordAnswer={undefined}
        onReset={() => undefined}
        snapshot={snapshot}
        webmcpCount={0}
        webmcpDiagnostics={[]}
        />
      </LocaleProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "EN" }));
    expect(screen.getByRole("heading", { name: "What the posting claims" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "What to check next" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Investigate this item" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "KO" }));
    expect(screen.getByText("공고에서 확인되는 기대사항")).toBeTruthy();
    expect(screen.getByRole("button", { name: "이 항목 조사하기" })).toBeTruthy();
  });
});
