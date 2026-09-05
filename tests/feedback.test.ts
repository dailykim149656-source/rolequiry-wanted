import { describe, expect, it } from "vitest";
import { formatFeedbackLine } from "@/lib/feedback";

describe("feedback ledger", () => {
  it("writes a markdown table row without inventing named testers", () => {
    const line = formatFeedbackLine(
      {
        note: "출장 항목이 도움이 됐다",
        company: "클레로보틱스",
        role: "시스템엔지니어",
      },
      new Date("2026-09-05T00:00:00.000Z"),
    );
    expect(line).toContain("| 2026-09-05 | anonymous | 클레로보틱스 / 시스템엔지니어 | 출장 항목이 도움이 됐다 | |");
  });
});
