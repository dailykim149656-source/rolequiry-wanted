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
        name: "입사하기 전에, 이 일이 나와 맞는지 한번 더 보세요.",
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
        name: "Before you join, check whether this job actually fits.",
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
        onShare={() => undefined}
        onFeedback={() => undefined}
        onDeepDive={() => undefined}
        snapshot={snapshot}
        webmcpCount={0}
        webmcpDiagnostics={[]}
        />
      </LocaleProvider>,
    );
    expect(screen.getByRole("heading", { name: "Forward Deployed Engineer" })).toBeTruthy();
    expect(screen.getByText("공고가 말하는 기대")).toBeTruthy();
    expect(screen.getByText("밖에서 보이는 조건")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "다음에 볼 것" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "이 항목 찾아보기" })).toBeTruthy();
    expect(screen.getByText(/잘 맞음/)).toBeTruthy();
    expect(screen.queryByText("Active probe")).toBeNull();
    expect(screen.queryByRole("button", { name: "Export case JSON" })).toBeNull();
    expect(screen.queryByText("WebMCP live")).toBeNull();
    expect(screen.queryByText("Priority not set")).toBeNull();
    expect(screen.queryByText("What is settled, what is still open, and what to ask next.")).toBeNull();
    expect(screen.queryByText("Priorities ready")).toBeNull();
    expect(screen.getByText("이 항목부터 보면 됩니다")).toBeTruthy();
    expect(screen.queryByText("Due diligence dossier")).toBeNull();
    expect(screen.queryByText(/decision blocker/)).toBeNull();
    const ownership = screen.getByTestId("claim-technical-ownership");
    expect(ownership.textContent).toContain("Technical ownership · 매우 중요");
    expect(ownership.textContent).not.toContain("Technical ownership · 매우 중요 · 긴장");
    expect(screen.getAllByRole("button", { name: "결과 공유" }).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "피드백 남기기" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "ChatGPT로 더 깊게 보기" })).toBeTruthy();
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
        onShare={() => undefined}
        onFeedback={() => undefined}
        onDeepDive={() => undefined}
        snapshot={snapshot}
        webmcpCount={0}
        webmcpDiagnostics={[]}
        />
      </LocaleProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "EN" }));
    expect(screen.getByRole("heading", { name: "What the posting says" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "What to look at next" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Look this up" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "KO" }));
    expect(screen.getByText("공고가 말하는 기대")).toBeTruthy();
    expect(screen.getByRole("button", { name: "이 항목 찾아보기" })).toBeTruthy();
  });
});
