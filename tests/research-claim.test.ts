import { describe, expect, it, vi } from "vitest";
import { researchClaim } from "@/lib/ai/research-claim";
import { parseDuckDuckGoHits, isLowQualityHit, searchPublicWeb } from "@/lib/ai/web-search";
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

  it("cites the official posting URL instead of example.com", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo) => {
      const url = String(input);
      if (url.includes("html.duckduckgo.com")) {
        return { ok: true, text: async () => "<html></html>" };
      }
      if (url.includes("recruit.wanted.co.kr")) {
        return {
          ok: true,
          text: async () => "국내외 출장 및 고객사 현장 업무가 가능하신 분",
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
    expect(result.candidates.some((item) => item.sourceUrl.includes("wanted.co.kr"))).toBe(true);
    expect(result.candidates.every((item) => !item.sourceUrl.includes("example.com"))).toBe(true);
    vi.unstubAllGlobals();
  });

  it("quotes fetched official page text instead of restating the posting", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => "국내외 출장 및 고객사 현장 업무가 가능하신 분. 출장일비 지원.",
    });
    vi.stubGlobal("fetch", fetchMock);
    const result = await researchClaim({
      company: "클레로보틱스",
      role: "시스템엔지니어",
      employerStatement: "국내외 출장 및 고객사 현장 업무가 가능하신 분",
      unresolvedVariable: "출장은 얼마나 잦고 얼마나 몰리나?",
      jobPostingUrl: "https://recruit.wanted.co.kr/wd/382364",
    });
    expect(result.candidates[0]?.text).toContain("출장일비 지원");
    expect(result.candidates[0]?.text).not.toContain("careers materials restated");
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
    expect(verdict.verificationStatus).toBe("VERIFIED");
    expect(verdict.stance).toBe("SUPPORTS");
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
