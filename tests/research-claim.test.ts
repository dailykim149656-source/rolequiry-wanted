import { describe, expect, it } from "vitest";
import { researchClaim } from "@/lib/ai/research-claim";
import { verifyEvidence } from "@/lib/ai/verify-evidence";

describe("researchClaim", () => {
  it("returns at least one citation URL and a counterevidence attempt", async () => {
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
  });

  it("cites the official posting URL instead of example.com", async () => {
    const result = await researchClaim({
      company: "클레로보틱스",
      role: "시스템엔지니어",
      employerStatement: "국내외 출장 및 고객사 현장 업무가 가능하신 분",
      unresolvedVariable: "출장은 얼마나 잦고 얼마나 몰리나?",
      jobPostingUrl: "https://recruit.wanted.co.kr/wd/382364",
    });
    expect(result.candidates.some((item) => item.sourceUrl.includes("wanted.co.kr"))).toBe(true);
    expect(result.candidates.every((item) => !item.sourceUrl.includes("example.com"))).toBe(true);
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
