import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ai/research-claim", () => ({
  researchClaim: vi.fn(),
}));
vi.mock("@/lib/ai/verify-evidence", () => ({
  verifyEvidenceWithEscalation: vi.fn(async (input: { stance?: string; verificationStatus?: string }) => ({
    stance: input.stance ?? "NEUTRAL",
    verificationStatus: input.verificationStatus ?? "INSUFFICIENT",
    escalated: false,
    model: "gpt-5.6-luna",
  })),
}));
vi.mock("@/lib/ai/env", () => ({
  hostedAiConfig: () => ({
    verifierModel: "gpt-5.6-luna",
    escalationModel: "gpt-5.6-terra",
    enabled: false,
  }),
}));

import { researchClaim } from "@/lib/ai/research-claim";
import { POST } from "@/app/api/research/route";

const mockedResearch = researchClaim as unknown as ReturnType<typeof vi.fn>;

function candidate(partial: {
  sourceUrl: string;
  stance: "SUPPORTS" | "CHALLENGES" | "NEUTRAL";
  verificationStatus: "VERIFIED" | "INSUFFICIENT";
  sourceKind?: "FIRST_PERSON_EXPERIENCE" | "OTHER_PUBLIC";
}) {
  return {
    sourceLabel: partial.sourceUrl,
    text: partial.sourceUrl,
    sourceKind: partial.sourceKind ?? "FIRST_PERSON_EXPERIENCE",
    ...partial,
  };
}

describe("/api/research", () => {
  it("returns the best support and best challenge instead of a single first hit", async () => {
    mockedResearch.mockResolvedValue({
      counterevidenceAttempted: true,
      candidates: [
        candidate({
          sourceUrl: "https://a.example.com/support",
          stance: "SUPPORTS",
          verificationStatus: "VERIFIED",
        }),
        candidate({
          sourceUrl: "https://b.example.com/also-support",
          stance: "SUPPORTS",
          verificationStatus: "INSUFFICIENT",
        }),
        candidate({
          sourceUrl: "https://c.example.com/challenge",
          stance: "CHALLENGES",
          verificationStatus: "VERIFIED",
        }),
      ],
    });
    const response = await POST(
      new Request("http://127.0.0.1/api/research", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          claimId: "imported-1",
          employerStatement: "Own production systems end to end.",
          company: "Atlas",
          role: "Engineer",
          unresolvedVariable: "Who owns production changes after launch?",
        }),
      }),
    );
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.items.map((item: { sourceUrl: string }) => item.sourceUrl)).toEqual([
      "https://a.example.com/support",
      "https://c.example.com/challenge",
    ]);
  });
});
