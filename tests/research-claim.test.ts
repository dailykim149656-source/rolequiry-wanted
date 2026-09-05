import { describe, expect, it, vi } from "vitest";
import { researchClaim } from "@/lib/ai/research-claim";
import { parseDuckDuckGoHits, isLowQualityHit, isRestrictedFetchHost, searchPublicWeb } from "@/lib/ai/web-search";
import { chatgptDeepDiveHref, chatgptDeepDivePrompt, researchQueriesFromModel } from "@/lib/ai/research-claim";
import { verifyEvidence } from "@/lib/ai/verify-evidence";

describe("researchClaim", () => {
  it("returns at least one citation URL and a counterevidence attempt", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const result = await researchClaim({
      company: "Atlas",
      role: "Forward Deployed Engineer",
      employerStatement: "50% travel is expected.",
      unresolvedVariable: "How concentrated is travel?",
      jobPostingUrl: "https://www.wanted.co.kr/wd/1",
      companyWebsite: "https://atlas.example.com",
    });
    expect(result.candidates.length).toBeGreaterThan(0);
    expect(result.candidates.some((item) => item.sourceUrl.startsWith("http"))).toBe(
      true,
    );
    expect(result.counterevidenceAttempted).toBe(true);
    vi.unstubAllGlobals();
  });

  it("does not cite example.com or fetch the original posting when search is empty", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo) => {
      const url = String(input);
      if (url.includes("html.duckduckgo.com")) {
        return { ok: true, text: async () => "<html></html>" };
      }
      return { ok: false, text: async () => "" };
    });
    vi.stubGlobal("fetch", fetchMock);
    const result = await researchClaim({
      company: "클레로보틱스",
      role: "시스템엔지니어",
      employerStatement: "국내외 출장 및 고객사 현장 업무가 가능하신 분",
      unresolvedVariable: "출장은 얼마나 잦고 얼마나 몰리나?",
      jobPostingUrl: "https://recruit.wanted.co.kr/wd/382364",
    });
    const fetched = fetchMock.mock.calls.map((call) => String(call));
    expect(fetched.some((url) => url.includes("recruit.wanted.co.kr"))).toBe(false);
    expect(result.candidates.every((item) => !item.sourceUrl.includes("example.com"))).toBe(true);
    expect(result.candidates.every((item) => item.verificationStatus === "INSUFFICIENT")).toBe(true);
    vi.unstubAllGlobals();
  });

  it("does not reuse the original job posting as evidence when search is empty", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo) => {
      const url = String(input);
      if (url.includes("html.duckduckgo.com")) {
        return { ok: true, text: async () => "<html></html>" };
      }
      return { ok: true, text: async () => "국내외 출장 및 고객사 현장 업무가 가능하신 분. 출장일비 지원." };
    });
    vi.stubGlobal("fetch", fetchMock);
    const result = await researchClaim({
      company: "클레로보틱스",
      role: "시스템엔지니어",
      employerStatement: "국내외 출장 및 고객사 현장 업무가 가능하신 분",
      unresolvedVariable: "출장은 얼마나 잦고 얼마나 몰리나?",
      jobPostingUrl: "https://recruit.wanted.co.kr/wd/382364",
    });
    const fetched = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(fetched.some((url) => url.includes("recruit.wanted.co.kr"))).toBe(false);
    expect(result.candidates.every((item) => item.verificationStatus === "INSUFFICIENT")).toBe(true);
    expect(result.candidates.every((item) => !item.text.includes("출장일비 지원"))).toBe(true);
    vi.unstubAllGlobals();
  });

  it("searches independent public pages instead of restating the posting", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo) => {
      const url = String(input);
      if (url.includes("html.duckduckgo.com")) {
        return {
          ok: true,
          text: async () =>
            '<a class="result__a" href="https://blog.clerobotics.com/field-work">현장 업무 후기</a><a class="result__a" href="https://news.example.com/clerobotics-travel">출장 빈도 보도</a>',
        };
      }
      if (url.includes("blog.clerobotics.com")) {
        return {
          ok: true,
          text: async () =>
            "국내외 출장 및 고객사 현장 업무가 가능하신 분. 주 단위로 고객사에 나간다.",
        };
      }
      if (url.includes("news.example.com")) {
        return {
          ok: true,
          text: async () => "출장 빈도는 공개되지 않았고, 현장 업무가 항상 있는 것은 아니다.",
        };
      }
      return { ok: false, text: async () => "" };
    });
    vi.stubGlobal("fetch", fetchMock);
    const result = await researchClaim({
      company: "클레로보틱스",
      role: "시스템엔지니어",
      employerStatement: "국내외 출장 및 고객사 현장 업무가 가능하신 분",
      unresolvedVariable: "출장은 얼마나 잦고 얼마나 몰리나?",
      jobPostingUrl: "https://recruit.wanted.co.kr/wd/382364",
    });
    expect(result.candidates.some((item) => item.sourceUrl.includes("blog.clerobotics.com"))).toBe(true);
    expect(result.candidates.some((item) => item.sourceUrl.includes("news.example.com"))).toBe(true);
    expect(result.candidates.every((item) => item.sourceUrl !== "https://recruit.wanted.co.kr/wd/382364")).toBe(true);
    expect(result.candidates.some((item) => item.text.includes("careers materials restated"))).toBe(false);
    expect(new Set(result.candidates.map((item) => item.clusterId)).size).toBeGreaterThan(1);
    vi.unstubAllGlobals();
  });

  it("stays INSUFFICIENT when public search finds nothing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, text: async () => "<html></html>" }),
    );
    const result = await researchClaim({
      company: "클레로보틱스",
      role: "시스템엔지니어",
      employerStatement: "국내외 출장 및 고객사 현장 업무가 가능하신 분",
      unresolvedVariable: "출장은 얼마나 잦고 얼마나 몰리나?",
      jobPostingUrl: "https://recruit.wanted.co.kr/wd/382364",
    });
    expect(result.candidates.length).toBeGreaterThan(0);
    expect(result.candidates.every((item) => item.verificationStatus === "INSUFFICIENT")).toBe(true);
    expect(result.candidates.some((item) => item.stance === "SUPPORTS")).toBe(false);
    expect(result.candidates.every((item) => !item.text.includes("careers materials restated"))).toBe(true);
    vi.unstubAllGlobals();
  });
});

describe("verifyEvidence", () => {
  it("marks unrelated text INSUFFICIENT", () => {
    const verdict = verifyEvidence({
      employerStatement: "50% travel is expected.",
      evidenceText: "The cafeteria serves lunch at noon.",
      sourceUrl: "https://atlas.example.com/lunch",
    });
    expect(verdict.verificationStatus).toBe("INSUFFICIENT");
  });

  it("can SUPPORT a source that restates the claim", () => {
    const verdict = verifyEvidence({
      employerStatement: "50% travel is expected.",
      evidenceText: "The official careers page repeats: 50% travel is expected.",
      sourceUrl: "https://atlas.example.com/careers",
    });
    expect(verdict.verificationStatus).toBe("INSUFFICIENT");
    expect(verdict.stance).toBe("SUPPORTS");
  });

  it("does not verify a long page that merely repeats nouns", () => {
    const verdict = verifyEvidence({
      employerStatement: "50% travel is expected.",
      evidenceText: "travel travel travel expected expected expected cafeteria lunch noon ".repeat(40),
      sourceUrl: "https://news.example.com/story",
    });
    expect(verdict.verificationStatus).toBe("INSUFFICIENT");
  });
});

describe("parseDuckDuckGoHits", () => {
  it("extracts http results from html.duckduckgo.com markup", () => {
    const hits = parseDuckDuckGoHits(
      '<a class="result__a" href="https://blog.clerobotics.com/field-work">현장 업무 후기</a><a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fnews.example.com%2Fclerobotics-travel">출장 빈도 보도</a>',
    );
    expect(hits.map((hit) => hit.url)).toEqual([
      "https://blog.clerobotics.com/field-work",
      "https://news.example.com/clerobotics-travel",
    ]);
  });
});


  it("drops course-ad pages from live search results", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo) => {
      const url = String(input);
      if (url.includes("html.duckduckgo.com")) {
        return {
          ok: true,
          text: async () =>
            '<a class="result__a" href="https://www.simpliaxis.com/resources/forward-deployed-engineer-travel">LIMITED TIME SEP FLASH SALE</a><a class="result__a" href="https://blog.clerobotics.com/field-work">현장 업무 후기</a>',
        };
      }
      if (url.includes("blog.clerobotics.com")) {
        return {
          ok: true,
          text: async () => "국내외 출장 및 고객사 현장 업무가 가능하신 분. 주 단위로 고객사에 나간다.",
        };
      }
      return { ok: false, text: async () => "" };
    });
    vi.stubGlobal("fetch", fetchMock);
    const result = await researchClaim({
      company: "클레로보틱스",
      role: "시스템엔지니어",
      employerStatement: "국내외 출장 및 고객사 현장 업무가 가능하신 분",
      unresolvedVariable: "출장은 얼마나 잦고 얼마나 몰리나?",
      jobPostingUrl: "https://recruit.wanted.co.kr/wd/382364",
    });
    expect(result.candidates.some((item) => item.sourceUrl.includes("simpliaxis.com"))).toBe(false);
    expect(result.candidates.some((item) => item.sourceUrl.includes("blog.clerobotics.com"))).toBe(true);
    vi.unstubAllGlobals();
  });

describe("research query quality", () => {
  it("does not name Blind or Glassdoor in fallback queries", () => {
    const queries = researchQueriesFromModel({
      company: "리에종드로렌",
      role: "화장품 제품 개발 팀장",
      employerStatement: "R&D 및 테스트: 성분, 제형, 패키지 개발 및 테스트 진행",
      unresolvedVariable: "사내에서 직접 테스트를 하나?",
    });
    expect(queries.support.toLowerCase()).not.toContain("blind");
    expect(queries.support.toLowerCase()).not.toContain("glassdoor");
    expect(queries.counter.toLowerCase()).not.toContain("blind");
    expect(queries.support).toContain("리에종드로렌");
    expect(queries.support).toMatch(/경험|culture|worked|day-to-day|team/i);
  });

  it("skips restricted review hosts before fetching their body", () => {
    expect(
      isRestrictedFetchHost("https://www.blind.com/company/liaison"),
    ).toBe(true);
    expect(
      isRestrictedFetchHost("https://www.glassdoor.com/Reviews/foo.htm"),
    ).toBe(true);
    expect(
      isRestrictedFetchHost("https://blog.naver.com/foo/1"),
    ).toBe(false);
  });

  it("drops course-ad hits before citing them", () => {
    expect(
      isLowQualityHit({
        url: "https://www.simpliaxis.com/resources/forward-deployed-engineer-travel",
        title: "LIMITED TIME SEP FLASH SALE",
      }),
    ).toBe(true);
    expect(
      isLowQualityHit({
        url: "https://blog.clerobotics.com/field-work",
        title: "현장 업무 후기",
      }),
    ).toBe(false);
  });

  it("uses hosted support and counter queries when the model returns them", () => {
    const queries = researchQueriesFromModel(
      {
        company: "클레로보틱스",
        role: "시스템엔지니어",
        employerStatement: "국내외 출장 및 고객사 현장 업무가 가능하신 분",
        unresolvedVariable: "출장은 얼마나 잦고 얼마나 몰리나?",
      },
      {
        supportQuery: "클레로보틱스 현장 출장 빈도",
        counterQuery: "클레로보틱스 출장 없다 후기",
      },
    );
    expect(queries.support).toBe("클레로보틱스 현장 출장 빈도");
    expect(queries.counter).toBe("클레로보틱스 출장 없다 후기");
  });
});

describe("chatgptDeepDivePrompt", () => {
  it("asks ChatGPT to research the active item without requiring page tools", () => {
    const prompt = chatgptDeepDivePrompt({
      caseUrl: "http://127.0.0.1:3017/case?sample=atlas-fde",
      company: "Atlas",
      role: "Forward Deployed Engineer",
      employerStatement: "50% travel is expected.",
      unresolvedVariable: "How concentrated is travel?",
      question: "Median and maximum travel days in the last two quarters",
    });
    expect(prompt).toContain("Atlas");
    expect(prompt).toContain("50% travel is expected.");
    expect(prompt).toContain("How concentrated is travel?");
    expect(prompt).not.toContain("select_decision_changer");
    expect(prompt).not.toContain("record_research_evidence");
    expect(chatgptDeepDiveHref(prompt)).toContain("https://chatgpt.com/?q=");
    expect(chatgptDeepDiveHref(prompt)).toContain("50%25%20travel");
  });
});

describe("searchPublicWeb", () => {
  it("posts the DuckDuckGo HTML form instead of a GET that returns no results", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo, init?: RequestInit) => {
      expect(String(input)).toBe("https://html.duckduckgo.com/html/");
      expect(init?.method).toBe("POST");
      expect(String(init?.body)).toContain("q=");
      return {
        ok: true,
        text: async () => '<a class="result__a" href="https://liaisondeloren.co.kr/">Liaison de Loren</a>',
      };
    });
    vi.stubGlobal("fetch", fetchMock);
    const hits = await searchPublicWeb("리에종드로렌 화장품");
    expect(hits.map((hit) => hit.url)).toEqual(["https://liaisondeloren.co.kr/"]);
    vi.unstubAllGlobals();
  });
});

describe("researchClaim channels", () => {
  it("keeps a counter hit even when support already filled the first four", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("html.duckduckgo.com")) {
        const body = String(init?.body ?? "");
        const isCounter = /micromanagement|승인|friction/.test(decodeURIComponent(body.replace(/\+/g, " ")));
        const html = isCounter
          ? '<a class="result__a" href="https://notes.example.com/approvals">승인 절차가 길다</a>'
          : '<a class="result__a" href="https://a.example.com/1">경험1</a><a class="result__a" href="https://b.example.com/2">경험2</a><a class="result__a" href="https://c.example.com/3">경험3</a><a class="result__a" href="https://d.example.com/4">경험4</a>';
        return { ok: true, text: async () => html };
      }
      return {
        ok: true,
        text: async () => url.includes("notes.example.com")
          ? "승인 절차가 길어서  autonom적으로 일하지 못했다."
          : "저는 이 팀에서 일했습니다. 자율성이 높았습니다.",
      };
    });
    vi.stubGlobal("fetch", fetchMock);
    const result = await researchClaim({
      company: "Atlas",
      role: "Engineer",
      employerStatement: "Own production systems end to end.",
      unresolvedVariable: "Who owns production changes after launch?",
    });
    expect(result.candidates.some((item) => item.sourceUrl.includes("notes.example.com"))).toBe(true);
    vi.unstubAllGlobals();
  });

  it("keeps a title-only hit as INSUFFICIENT without treating the title as verified evidence", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo) => {
      const url = String(input);
      if (url.includes("html.duckduckgo.com")) {
        return {
          ok: true,
          text: async () => '<a class="result__a" href="https://notes.example.com/field">현장 후기 제목만</a>',
        };
      }
      return { ok: false, text: async () => "" };
    });
    vi.stubGlobal("fetch", fetchMock);
    const result = await researchClaim({
      company: "클레로보틱스",
      role: "시스템엔지니어",
      employerStatement: "국내외 출장 및 고객사 현장 업무가 가능하신 분",
      unresolvedVariable: "출장은 얼마나 잦고 얼마나 몰리나?",
    });
    const hit = result.candidates.find((item) => item.sourceUrl.includes("notes.example.com"));
    expect(hit).toBeDefined();
    expect(hit?.verificationStatus).toBe("INSUFFICIENT");
    vi.unstubAllGlobals();
  });
});
