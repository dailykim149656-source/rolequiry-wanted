import { extractClaimsFromJobText } from "@/lib/ai/extract-role";
import { verifyEvidence } from "@/lib/ai/verify-evidence";
import golden from "@/evals/golden.json";

type GoldenCase = {
  readonly id: string;
  readonly sourceText: string;
  readonly goldQuotes: readonly string[];
  readonly hallucinatedQuote: string;
};

export function runWantedEval() {
  const cases = golden as GoldenCase[];
  let truePositives = 0;
  let falsePositives = 0;
  let goldCount = 0;
  let falseCertainty = 0;
  let verifierTrials = 0;
  let citationSupport = 0;
  let citationTrials = 0;
  let verifierAccuracy = 0;
  for (const item of cases) {
    const extracted = extractClaimsFromJobText({
      company: item.id,
      role: "Engineer",
      sourceText: item.sourceText,
    });
    goldCount += item.goldQuotes.length;
    for (const claim of extracted.claims) {
      if (item.goldQuotes.some((quote) => claim.employerStatement.includes(quote) || quote.includes(claim.employerStatement))) {
        truePositives += 1;
      } else if (!item.sourceText.includes(claim.employerStatement)) {
        falsePositives += 1;
      }
    }
    const hallucinated = extractClaimsFromJobText({
      company: item.id,
      role: "Engineer",
      sourceText: item.sourceText,
      proposedClaims: [
        {
          dimension: "Hallucination",
          employerStatement: item.hallucinatedQuote,
          unresolvedVariable: "n/a",
          measurableForm: "n/a",
        },
      ],
    });
    if (hallucinated.claims.length > 0) falsePositives += 1;
    verifierTrials += 1;
    const verdict = verifyEvidence({
      employerStatement: item.goldQuotes[0] ?? "",
      evidenceText: "The cafeteria serves lunch at noon.",
      sourceUrl: "https://example.com/lunch",
    });
    if (verdict.verificationStatus === "VERIFIED") falseCertainty += 1;
    const supported = verifyEvidence({
      employerStatement: item.goldQuotes[0] ?? "",
      evidenceText: item.goldQuotes[0] ?? "",
      sourceUrl: "https://example.com/posting",
    });
    citationTrials += 1;
    if (supported.verificationStatus === "VERIFIED" && supported.stance === "SUPPORTS") {
      citationSupport += 1;
    }
    if (verdict.verificationStatus === "INSUFFICIENT") verifierAccuracy += 1;
  }
  const claimPrecision =
    truePositives + falsePositives === 0
      ? 1
      : truePositives / (truePositives + falsePositives);
  const falseCertaintyRate = verifierTrials === 0 ? 0 : falseCertainty / verifierTrials;
  return {
    cases: cases.length,
    claimPrecision,
    falseCertaintyRate,
    citationSupport: citationTrials === 0 ? 0 : citationSupport / citationTrials,
    verifierAccuracy: verifierTrials === 0 ? 0 : verifierAccuracy / verifierTrials,
    metrics: [
      "claimPrecision",
      "falseCertaintyRate",
      "citationSupport",
      "verifierAccuracy",
    ],
  };
}

