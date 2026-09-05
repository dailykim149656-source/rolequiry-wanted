import { extractClaimsFromJobText, extractClaimsWithHostedModel } from "@/lib/ai/extract-role";
import { normalizeHttpUrl } from "@/lib/webmcp/http-url";
import { parseWantedJobHtml } from "@/lib/sources/wanted";

const MAX_TEXT = 40_000;

function decodeHtml(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n+/g, "\n")
    .trim();
}

export async function fetchJobSource(url: string) {
  const normalized = normalizeHttpUrl(url, "job posting URL");
  const response = await fetch(normalized, {
    headers: { accept: "text/html,text/plain" },
    redirect: "follow",
  });
  if (!response.ok) {
    throw new Error("JOB_FETCH_FAILED");
  }
  const html = (await response.text()).slice(0, MAX_TEXT * 8);
  if (normalized.includes("wanted.co.kr")) {
    const parsed = parseWantedJobHtml(html, normalized);
    if (parsed.sourceText.length < 40) throw new Error("JOB_FETCH_EMPTY");
    return parsed;
  }
  const text = decodeHtml(html).slice(0, MAX_TEXT);
  if (text.length < 40) throw new Error("JOB_FETCH_EMPTY");
  return { sourceText: text, jobPostingUrl: normalized, company: undefined, role: undefined, companyWebsite: undefined, location: undefined };
}

export async function fetchJobText(url: string): Promise<string> {
  return (await fetchJobSource(url)).sourceText;
}

export function analyzeJobInput(input: {
  readonly url?: string;
  readonly text?: string;
  readonly sourceText: string;
  readonly company?: string;
  readonly role?: string;
  readonly companyWebsite?: string;
}) {
  const sourceText = input.sourceText.trim();
  const company =
    input.company?.trim() ||
    (sourceText.match(/([A-Z][A-Za-z0-9&.\- ]{2,40})\s+is hiring/i)?.[1] ??
      (input.url ? new URL(input.url).hostname.replace(/^www\./, "") : "Unknown company"));
  const role =
    input.role?.trim() ||
    (sourceText.match(/hiring an? ([^.\n]{8,80})/i)?.[1] ??
      sourceText.split("\n").find((line) => line.trim().length > 8)?.trim() ??
      "Open role");
  const extracted = extractClaimsFromJobText({
    company,
    role,
    sourceText,
  });
  return {
    ...extracted,
    jobPostingUrl: input.url,
    companyWebsite: input.companyWebsite,
    sourceText,
  };
}

export async function analyzeJobInputHosted(
  input: Parameters<typeof analyzeJobInput>[0],
) {
  const sourceText = input.sourceText.trim();
  const company =
    input.company?.trim() ||
    (sourceText.match(/([A-Z][A-Za-z0-9&.\- ]{2,40})\s+is hiring/i)?.[1] ??
      (input.url ? new URL(input.url).hostname.replace(/^www\./, "") : "Unknown company"));
  const role =
    input.role?.trim() ||
    (sourceText.match(/hiring an? ([^.\n]{8,80})/i)?.[1] ??
      sourceText.split("\n").find((line) => line.trim().length > 8)?.trim() ??
      "Open role");
  const extracted = await extractClaimsWithHostedModel({
    company,
    role,
    sourceText,
  });
  return {
    ...extracted,
    jobPostingUrl: input.url,
    companyWebsite: input.companyWebsite,
    sourceText,
  };
}
