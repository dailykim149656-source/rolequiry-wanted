import { describe, expect, it } from "vitest";
import { verifyEvidenceWithEscalation } from "@/lib/ai/verify-evidence";

describe("Terra escalation", () => {
  it("escalates when the first pass is INSUFFICIENT", async () => {
    const result = await verifyEvidenceWithEscalation({
      employerStatement: "50% travel is expected.",
      evidenceText: "The cafeteria serves lunch at noon.",
      sourceUrl: "https://atlas.example.com/lunch",
      escalate: true,
      escalationModel: "gpt-5.6-terra",
    });
    expect(result.verificationStatus).toBe("INSUFFICIENT");
    expect(result.escalated).toBe(true);
    expect(result.model).toBe("gpt-5.6-terra");
  });
});
