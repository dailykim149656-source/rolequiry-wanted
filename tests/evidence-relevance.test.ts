import { describe, expect, it } from "vitest";
import { clusterEvidence, scoreEvidenceRelevance } from "@/lib/domain/evidence-relevance";

describe("evidence relevance", () => {
  it("scores role, location, recency, and specificity", () => {
    const score = scoreEvidenceRelevance({
      role: "Forward Deployed Engineer",
      location: "Seoul",
      evidenceText: "Seoul FDE travel clustered in launch weeks in 2026.",
      sourceUrl: "https://atlas.example.com/engineering/2026-travel",
      publishedAt: "2026-04-01",
    });
    expect(score.roleMatch).toBe(true);
    expect(score.locationMatch).toBe(true);
    expect(score.recency).toBeGreaterThan(0);
    expect(score.specificity).toBeGreaterThan(0);
  });

  it("clusters duplicate source URLs", () => {
    const clustered = clusterEvidence([
      { id: "a", sourceUrl: "https://atlas.example.com/a", text: "travel 50%" },
      { id: "b", sourceUrl: "https://atlas.example.com/a", text: "50% travel is expected" },
      { id: "c", sourceUrl: "https://other.example.com/b", text: "unrelated" },
    ]);
    expect(clustered[0]?.clusterId).toBe(clustered[1]?.clusterId);
    expect(clustered[0]?.clusterId).not.toBe(clustered[2]?.clusterId);
  });
});
