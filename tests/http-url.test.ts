import { describe, expect, it, vi } from "vitest";
import { InvalidHttpUrlError, normalizeHttpUrl } from "@/lib/webmcp/http-url";

describe("normalizeHttpUrl", () => {
  it("rejects loopback and private fetch targets", () => {
    expect(() => normalizeHttpUrl("http://127.0.0.1/secret", "job posting URL")).toThrow(InvalidHttpUrlError);
    expect(() => normalizeHttpUrl("http://localhost/admin", "job posting URL")).toThrow(InvalidHttpUrlError);
    expect(() => normalizeHttpUrl("http://10.0.0.5/internal", "job posting URL")).toThrow(InvalidHttpUrlError);
    expect(() => normalizeHttpUrl("http://169.254.169.254/latest/meta-data", "job posting URL")).toThrow(InvalidHttpUrlError);
  });

  it("keeps public https job URLs", () => {
    expect(normalizeHttpUrl("https://www.wanted.co.kr/wd/333563", "job posting URL")).toContain("wanted.co.kr/wd/333563");
  });
});

import { researchClaim } from "@/lib/ai/research-claim";

describe("research fetch safety", () => {
  it("does not fetch loopback jobPostingUrl when search is empty", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, text: async () => "<html></html>" }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await researchClaim({
      company: "Atlas",
      role: "Engineer",
      employerStatement: "50% travel is expected.",
      unresolvedVariable: "How concentrated is travel?",
      jobPostingUrl: "http://127.0.0.1/secret",
    });
    const fetched: string[] = [];
    for (const call of fetchMock.mock.calls) {
      fetched.push(String(call));
    }
    expect(fetched.some((url) => url.includes("127.0.0.1"))).toBe(false);
    expect(result.candidates.every((item) => item.verificationStatus === "INSUFFICIENT")).toBe(true);
    vi.unstubAllGlobals();
  });
});
