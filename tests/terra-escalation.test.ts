import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ai/client", () => ({
  chatJson: vi.fn(),
}));

import { chatJson } from "@/lib/ai/client";
import {
  verifyEvidenceWithEscalation,
  verifyEvidenceWithLuna,
} from "@/lib/ai/verify-evidence";

const chat = vi.mocked(chatJson);

beforeEach(() => {
  chat.mockReset();
});

describe("Terra escalation", () => {
  it("does not escalate to Terra when Luna already settled the source", async () => {
    chat.mockResolvedValue({
      stance: "SUPPORTS",
      verificationStatus: "VERIFIED",
    });
    const result = await verifyEvidenceWithEscalation({
      employerStatement: "50% travel is expected.",
      evidenceText: "A teammate said 50% travel is expected during launch weeks.",
      sourceUrl: "https://atlas.example.com/talk",
      escalate: true,
      verifierModel: "gpt-5.6-luna",
      escalationModel: "gpt-5.6-terra",
    });
    expect(result.verificationStatus).toBe("VERIFIED");
    expect(result.model).toBe("gpt-5.6-luna");
    expect(result.escalated).toBe(false);
    expect(chat.mock.calls).toHaveLength(1);
  });

  it("escalates to Terra only after Luna stays INSUFFICIENT", async () => {
    chat.mockResolvedValueOnce({
      stance: "NEUTRAL",
      verificationStatus: "INSUFFICIENT",
    });
    chat.mockResolvedValueOnce({
      stance: "CHALLENGES",
      verificationStatus: "VERIFIED",
    });
    const result = await verifyEvidenceWithEscalation({
      employerStatement: "50% travel is expected.",
      evidenceText: "Travel clustered into launch weeks, unlike the posted 50%.",
      sourceUrl: "https://atlas.example.com/talk",
      escalate: true,
      verifierModel: "gpt-5.6-luna",
      escalationModel: "gpt-5.6-terra",
    });
    expect(result.verificationStatus).toBe("VERIFIED");
    expect(result.stance).toBe("CHALLENGES");
    expect(result.model).toBe("gpt-5.6-terra");
    expect(result.escalated).toBe(true);
    expect(chat.mock.calls).toHaveLength(2);
  });
});

describe("verifyEvidenceWithLuna", () => {
  it("returns INSUFFICIENT when Luna is unavailable", async () => {
    chat.mockResolvedValue(null);
    const result = await verifyEvidenceWithLuna({
      employerStatement: "50% travel is expected.",
      evidenceText: "A teammate said 50% travel is expected during launch weeks.",
      sourceUrl: "https://atlas.example.com/talk",
    });
    expect(result.verificationStatus).toBe("INSUFFICIENT");
    expect(result.model).toBe("gpt-5.6-luna");
  });
});
