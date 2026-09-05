import { describe, expect, it, vi } from "vitest";
import {
  extractClaimsFromJobText,
  extractClaimsWithHostedModel,
} from "@/lib/ai/extract-role";
import { chatJson } from "@/lib/ai/client";

vi.mock("@/lib/ai/client", () => ({
  chatJson: vi.fn(),
}));

vi.mock("@/lib/ai/env", () => ({
  hostedAiConfig: () => ({
    enabled: true,
    extractorModel: "gpt-5.6-luna",
  }),
}));

const SOURCE = `Atlas is hiring a Forward Deployed Engineer in Seoul.
50% travel is expected.
You will own production systems end to end.
Hybrid work with Seoul hub.
Hands-on coding remains a majority of the role.`;

describe("extractClaimsFromJobText", () => {
  it("keeps only employer statements that appear verbatim in the source", () => {
    const result = extractClaimsFromJobText({
      company: "Atlas",
      role: "Forward Deployed Engineer",
      sourceText: SOURCE,
    });
    expect(result.claims.length).toBeGreaterThanOrEqual(3);
    expect(result.claims.length).toBeLessThanOrEqual(8);
    for (const claim of result.claims) {
      expect(SOURCE).toContain(claim.employerStatement);
    }
  });

  it("drops a model quote that is not in the source", () => {
    const result = extractClaimsFromJobText({
      company: "Atlas",
      role: "Forward Deployed Engineer",
      sourceText: SOURCE,
      proposedClaims: [
        {
          dimension: "Travel",
          employerStatement: "50% travel is expected.",
          unresolvedVariable: "How concentrated is the travel?",
          measurableForm: "Median travel days last two quarters",
        },
        {
          dimension: "Unlimited PTO",
          employerStatement: "Unlimited PTO for all employees.",
          unresolvedVariable: "Is PTO actually unlimited?",
          measurableForm: "PTO policy document",
        },
      ],
    });
    expect(
      result.claims.map((claim) => claim.employerStatement),
    ).toEqual(["50% travel is expected."]);
  });

  it("extracts Korean wanted posting sentences as quotes", () => {
    const source = `클레로보틱스는 AI 기반 3차원 머신비전 카메라와 솔루션을 개발하는 테크 스타트업입니다.
• 국내외 출장 및 고객사 현장 업무가 가능하신 분
한달 단위 선택적 시간근로제 (집중시간 C-TIME 13~16시)`;
    const result = extractClaimsFromJobText({
      company: "클레로보틱스",
      role: "시스템엔지니어",
      sourceText: source,
    });
    expect(result.claims.length).toBeGreaterThanOrEqual(2);
    for (const claim of result.claims) {
      expect(source).toContain(claim.employerStatement);
    }
    expect(result.claims.map((claim) => claim.dimension)).toEqual(
      expect.arrayContaining(["출장", "근무 방식", "회사 단계"]),
    );
  });

  it("falls back to deterministic quotes when the hosted model returns none that appear in the source", async () => {
    (chatJson as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue({
      claims: [
        {
          dimension: "Unlimited PTO",
          employerStatement: "Unlimited PTO for all employees.",
          unresolvedVariable: "Is PTO actually unlimited?",
          measurableForm: "PTO policy document",
        },
      ],
    });
    const source = `클레로보틱스는 AI 기반 3차원 머신비전 카메라와 솔루션을 개발하는 테크 스타트업입니다.
• 국내외 출장 및 고객사 현장 업무가 가능하신 분
한달 단위 선택적 시간근로제 (집중시간 C-TIME 13~16시)`;
    const result = await extractClaimsWithHostedModel({
      company: "클레로보틱스",
      role: "시스템엔지니어",
      sourceText: source,
    });
    expect(result.claims.length).toBeGreaterThanOrEqual(2);
    for (const claim of result.claims) {
      expect(source).toContain(claim.employerStatement);
    }
  });
});
