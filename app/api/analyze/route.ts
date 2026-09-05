import { NextResponse } from "next/server";
import { analyzeJobInputHosted, fetchJobSource } from "@/lib/sources/fetch-job";
import { hostedAiConfig } from "@/lib/ai/env";

export async function POST(request: Request) {
  const body = (await request.json()) as { url?: string; text?: string };
  const url = body.url?.trim();
  const text = body.text?.trim();
  try {
    let sourceText = text ?? "";
    let company: string | undefined;
    let role: string | undefined;
    let companyWebsite: string | undefined;
    let location: string | undefined;
    if (!sourceText && url) {
      const fetched = await fetchJobSource(url);
      sourceText = fetched.sourceText;
      company = fetched.company;
      role = fetched.role;
      companyWebsite = fetched.companyWebsite;
      location = fetched.location;
    }
    if (!sourceText) {
      return NextResponse.json(
        { error: "원티드 공고 URL 또는 공고 텍스트를 넣어 주세요." },
        { status: 400 },
      );
    }
    const analyzed = await analyzeJobInputHosted({
      ...(url ? { url } : {}),
      ...(text ? { text } : {}),
      ...(company ? { company } : {}),
      ...(role ? { role } : {}),
      ...(companyWebsite ? { companyWebsite } : {}),
      sourceText,
    });
    if (analyzed.claims.length === 0) {
      return NextResponse.json(
        {
          error:
            "검증할 문장을 찾지 못했습니다. 공고 원문을 텍스트로 붙여넣어 주세요.",
        },
        { status: 422 },
      );
    }
    return NextResponse.json({
      company: analyzed.company,
      role: analyzed.role,
      jobPostingUrl: analyzed.jobPostingUrl ?? null,
      companyWebsite: analyzed.companyWebsite ?? null,
      location: location ?? null,
      claims: analyzed.claims,
      model: hostedAiConfig().enabled
        ? hostedAiConfig().extractorModel
        : "deterministic-stub",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (
      message.startsWith("JOB_FETCH") ||
      message.includes("http(s) URL") ||
      /fetch failed|Failed to parse URL|ECONN|ENOTFOUND|ETIMEDOUT|AbortError|timeout/i.test(
        message,
      )
    ) {
      return NextResponse.json(
        { error: "URL을 읽지 못했습니다. 공고 텍스트를 붙여넣어 주세요." },
        { status: 422 },
      );
    }
    return NextResponse.json({ error: "분석에 실패했습니다." }, { status: 500 });
  }
}
