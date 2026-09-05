import { describe, expect, it } from "vitest";
import { runWantedEval } from "@/evals/run";

describe("wanted eval harness", () => {
  it("scores false certainty on the golden set", () => {
    const report = runWantedEval();
    expect(report.cases).toBeGreaterThanOrEqual(5);
    expect(report.falseCertaintyRate).toBeGreaterThanOrEqual(0);
    expect(report.falseCertaintyRate).toBeLessThanOrEqual(1);
    expect(report.claimPrecision).toBeGreaterThan(0);
    expect(report.metrics).toContain("falseCertaintyRate");
    expect(report.metrics).toContain("citationSupport");
    expect(report.metrics).toContain("verifierAccuracy");
  });
});
