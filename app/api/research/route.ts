import { NextResponse } from "next/server";
import { hostedAiConfig } from "@/lib/ai/env";
import { researchClaim, type ResearchCandidate } from "@/lib/ai/research-claim";
import { verifyEvidenceWithEscalation } from "@/lib/ai/verify-evidence";

function rank(item: ResearchCandidate): number {
  if (item.verificationStatus === "VERIFIED") return 2;
  if (item.verificationStatus === "INSUFFICIENT") return 1;
  return 0;
}

function bestOf(
  items: readonly ResearchCandidate[],
  stance: "SUPPORTS" | "CHALLENGES",
): ResearchCandidate | undefined {
  return items
    .filter((item) => item.stance === stance)
    .slice()
    .sort((left, right) => rank(right) - rank(left))[0];
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    claimId?: string;
    employerStatement?: string;
    company?: string;
    role?: string;
    unresolvedVariable?: string;
    jobPostingUrl?: string;
    companyWebsite?: string;
  };
  if (!body.claimId) {
    return NextResponse.json({ error: "claimId required" }, { status: 400 });
  }
  const config = hostedAiConfig();
  const researched = await researchClaim({
    company: body.company ?? "Unknown company",
    role: body.role ?? "Open role",
    employerStatement: body.employerStatement ?? "",
    unresolvedVariable: body.unresolvedVariable ?? "",
    ...(body.jobPostingUrl ? { jobPostingUrl: body.jobPostingUrl } : {}),
    ...(body.companyWebsite ? { companyWebsite: body.companyWebsite } : {}),
  });
  const chosen = [
    bestOf(researched.candidates, "SUPPORTS"),
    bestOf(researched.candidates, "CHALLENGES"),
  ].filter((item): item is ResearchCandidate => Boolean(item));
  const fallback = chosen.length > 0 ? chosen : researched.candidates.slice(0, 1);
  if (fallback.length === 0) {
    return NextResponse.json({ error: "no evidence" }, { status: 422 });
  }
  const items = [];
  for (const candidate of fallback) {
    const escalated =
      candidate.verificationStatus === "INSUFFICIENT"
        ? await verifyEvidenceWithEscalation({
            employerStatement: body.employerStatement ?? "",
            evidenceText: candidate.text,
            sourceUrl: candidate.sourceUrl,
            escalate: true,
            verifierModel: config.verifierModel,
            escalationModel: config.escalationModel,
          })
        : { ...candidate, escalated: false, model: config.verifierModel };
    items.push({
      stance: escalated.stance,
      text: candidate.text,
      sourceKind: candidate.sourceKind,
      sourceLabel: candidate.sourceLabel,
      sourceUrl: candidate.sourceUrl,
      verificationStatus: escalated.verificationStatus,
      model: escalated.model,
      escalated: escalated.escalated,
    });
  }
  const first = items[0];
  return NextResponse.json({
    claimId: body.claimId,
    stance: first?.stance,
    text: first?.text,
    sourceKind: first?.sourceKind,
    sourceLabel: first?.sourceLabel,
    sourceUrl: first?.sourceUrl,
    verificationStatus: first?.verificationStatus,
    items,
    counterevidenceAttempted: researched.counterevidenceAttempted,
    model: first?.model,
    escalated: first?.escalated,
  });
}
