import { describe, expect, it } from "vitest";
import {
  parseWantedJobHtml,
  parseWantedJobJson,
  wantedJobApiUrl,
} from "@/lib/sources/wanted";
import { caseOrganizationFor } from "@/lib/domain/policy";

describe("parseWantedJobHtml", () => {
  it("reads company, role, and posting text from a wanted-like page", () => {
    const html = `
      <html><body>
        <h1>Forward Deployed Engineer</h1>
        <h2>Atlas</h2>
        <div>50% travel is expected.</div>
        <a href="https://atlas.example.com">회사 홈페이지</a>
      </body></html>
    `;
    const parsed = parseWantedJobHtml(html, "https://www.wanted.co.kr/wd/123");
    expect(parsed.role).toContain("Forward Deployed Engineer");
    expect(parsed.company).toContain("Atlas");
    expect(parsed.sourceText).toContain("50% travel is expected.");
    expect(parsed.companyWebsite).toBe("https://atlas.example.com/");
    expect(parsed.jobPostingUrl).toBe("https://www.wanted.co.kr/wd/123");
  });

  it("reads company, role, and tasks from recruit.wanted.co.kr NEXT_DATA", () => {
    const html = `<!DOCTYPE html><html><head><title>[클레로보틱스] [SE] 시스템엔지니어 (2 - 5년) 채용 공고 | 원티드</title></head><body><h1>[SE] 시스템엔지니어 (2 - 5년)</h1><h2>포지션 상세</h2><script id="__NEXT_DATA__" type="application/json">{"props":{"pageProps":{"initialData":{"position":"[SE] 시스템엔지니어 (2 - 5년)","company":{"company_name":"클레로보틱스"},"intro":"클레로보틱스는 AI 기반 3차원 머신비전 카메라와 솔루션을 개발하는 테크 스타트업입니다.","main_tasks":"• 고객사 현장의 설치 환경을 검토하고 제품 적용 방안을 제안합니다.\\n• 국내외 출장 및 고객사 현장 업무가 가능하신 분","requirements":"• 국내외 출장 및 고객사 현장 업무가 가능하신 분","preferred_points":"","benefits":"한달 단위 선택적 시간근로제"}}}}</script></body></html>`;
    const parsed = parseWantedJobHtml(
      html,
      "https://recruit.wanted.co.kr/wd/382364",
    );
    expect(parsed.company).toBe("클레로보틱스");
    expect(parsed.role).toContain("시스템엔지니어");
    expect(parsed.sourceText).toContain("국내외 출장");
    expect(parsed.sourceText).not.toBe("포지션 상세");
  });
});

describe("caseOrganizationFor", () => {
  it("does not treat wanted.co.kr as the employer domain", () => {
    expect(
      caseOrganizationFor({
        sourceUrl: "https://www.wanted.co.kr/wd/123",
        jobPostingUrl: "https://www.wanted.co.kr/wd/123",
        companyWebsite: "https://atlas.example.com",
        employerDomain: "atlas.example.com",
      }),
    ).toBe("atlas.example.com");
  });
});

describe("wanted job JSON API", () => {
  it("maps www.wanted.co.kr/wd IDs onto the public jobs API", () => {
    expect(wantedJobApiUrl("https://recruit.wanted.co.kr/wd/382364")).toBe(
      "https://www.wanted.co.kr/api/v4/jobs/382364",
    );
  });

  it("reads company, role, and tasks from the v4 jobs payload", () => {
    const parsed = parseWantedJobJson(
      {
        job: {
          position: "[SE] 시스템엔지니어 (2 - 5년)",
          company: { name: "클레로보틱스" },
          address: { full_location: "경기 군포시 공단로 117, 1층" },
          detail: {
            intro: "클레로보틱스는 AI 기반 3차원 머신비전 카메라와 솔루션을 개발하는 테크 스타트업입니다.",
            main_tasks: "• 고객사 현장의 설치 환경을 검토하고 제품 적용 방안을 제안합니다.",
            requirements: "• 국내외 출장 및 고객사 현장 업무가 가능하신 분",
            preferred_points: "",
            benefits: "한달 단위 선택적 시간근로제",
          },
        },
      },
      "https://recruit.wanted.co.kr/wd/382364",
    );
    expect(parsed?.company).toBe("클레로보틱스");
    expect(parsed?.role).toContain("시스템엔지니어");
    expect(parsed?.sourceText).toContain("국내외 출장");
    expect(parsed?.location).toContain("군포시");
  });
});
