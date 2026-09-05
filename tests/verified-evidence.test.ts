import { describe, expect, it } from "vitest";
import { deriveCase, importRoleFromClaims } from "@/lib/domain/derive-case";
import { recordVerifiedResearchEvidence } from "@/lib/domain/verified-evidence";

function importedCase() {
  return importRoleFromClaims({
    company: "Atlas",
    role: "Forward Deployed Engineer",
    sourceUrl: "https://www.wanted.co.kr/wd/1",
    companyWebsite: "https://atlas.example.com",
    employerDomain: "atlas.example.com",
    claims: [
      {
        dimension: "Travel",
        employerStatement: "50% travel is expected.",
        unresolvedVariable: "How concentrated is travel?",
        measurableForm: "Median travel days last two quarters",
      },
    ],
  });
}

describe("recordVerifiedResearchEvidence", () => {
  it("does not let INSUFFICIENT research change coverage or tension", () => {
    const before = deriveCase(importedCase()).claims[0];
    expect(before).toBeDefined();
    const next = recordVerifiedResearchEvidence(importedCase(), {
      claimId: "imported-1",
      stance: "CHALLENGES",
      text: "A blog implies heavy travel spikes.",
      sourceKind: "FIRST_PERSON_EXPERIENCE",
      sourceLabel: "Random blog",
      sourceUrl: "https://blog.example.com/travel",
      verificationStatus: "INSUFFICIENT",
    });
    const after = deriveCase(next).claims[0];
    expect(after).toBeDefined();
    expect(after?.unresolvedness).toBe(before?.unresolvedness);
    expect(after?.tension).toBe(before?.tension);
    expect(next.claims[0]?.evidence.some((item) => item.verificationStatus === "INSUFFICIENT")).toBe(
      true,
    );
  });

  it("lets VERIFIED reported experience enter authority math", () => {
    const before = deriveCase(importedCase()).claims[0];
    expect(before).toBeDefined();
    const next = recordVerifiedResearchEvidence(importedCase(), {
      claimId: "imported-1",
      stance: "CHALLENGES",
      text: "A teammate said travel clustered into launch weeks.",
      sourceKind: "FIRST_PERSON_EXPERIENCE",
      sourceLabel: "Conference talk",
      sourceUrl: "https://atlas.example.com/talk",
      verificationStatus: "VERIFIED",
    });
    const after = deriveCase(next).claims[0];
    expect(after).toBeDefined();
    expect(after?.tension ?? 0).toBeGreaterThan(before?.tension ?? 0);
  });

  it("does not let OTHER_PUBLIC research change coverage even when VERIFIED", () => {
    const before = deriveCase(importedCase()).claims[0];
    expect(before).toBeDefined();
    const next = recordVerifiedResearchEvidence(importedCase(), {
      claimId: "imported-1",
      stance: "CHALLENGES",
      text: "A news brief mentions travel.",
      sourceKind: "OTHER_PUBLIC",
      sourceLabel: "News brief",
      sourceUrl: "https://news.example.com/travel",
      verificationStatus: "VERIFIED",
    });
    const after = deriveCase(next).claims[0];
    expect(after?.unresolvedness).toBe(before?.unresolvedness);
    expect(after?.tension).toBe(before?.tension);
  });
});
