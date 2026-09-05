import { NextResponse } from "next/server";
import { hostedAiConfig } from "@/lib/ai/env";
import { researchClaim } from "@/lib/ai/research-claim";

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
  const researched = await researchClaim({
    company: body.company ?? "Unknown company",
    role: body.role ?? "Open role",
    employerStatement: body.employerStatement ?? "",
    unresolvedVariable: body.unresolvedVariable ?? "",
    ...(body.jobPostingUrl ? { jobPostingUrl: body.jobPostingUrl } : {}),
    ...(body.companyWebsite ? { companyWebsite: body.companyWebsite } : {}),
  });
  const chosen =
    researched.candidates.find((item) => item.verificationStatus === "VERIFIED") ??
    researched.candidates[0];
  if (!chosen) {
    return NextResponse.json({ error: "no evidence" }, { status: 422 });
  }
  return NextResponse.json({
    claimId: body.claimId,
    stance: chosen.stance,
    text: chosen.text,
    sourceKind: chosen.sourceKind,
    sourceLabel: chosen.sourceLabel,
    sourceUrl: chosen.sourceUrl,
    verificationStatus: chosen.verificationStatus,
    counterevidenceAttempted: researched.counterevidenceAttempted,
    model: hostedAiConfig().extractorModel,
  });
}
