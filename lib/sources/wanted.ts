import { normalizeHttpUrl } from "@/lib/webmcp/http-url";

export type ParsedJob = {
  readonly company: string;
  readonly role: string;
  readonly sourceText: string;
  readonly jobPostingUrl: string;
  readonly companyWebsite?: string;
  readonly location?: string;
};

export function wantedJobApiUrl(jobPostingUrl: string): string | null {
  const match = jobPostingUrl.match(/wanted\.co\.kr\/wd\/(\d+)/i);
  return match ? `https://www.wanted.co.kr/api/v4/jobs/${match[1]}` : null;
}

function strip(html: string): string {
  return html
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

function firstMatch(html: string, pattern: RegExp): string | undefined {
  const match = html.match(pattern);
  return match?.[1]?.replace(/<[^>]+>/g, "").trim();
}

function joinJobText(parts: readonly (string | undefined)[]): string {
  return parts
    .filter((part): part is string => Boolean(part && part.trim()))
    .join("\n");
}

export function parseWantedJobJson(
  payload: unknown,
  jobPostingUrl: string,
): ParsedJob | null {
  const root = payload as {
    job?: {
      position?: string;
      company?: { name?: string; company_name?: string };
      address?: { full_location?: string; location?: string; district?: string };
      detail?: {
        intro?: string;
        main_tasks?: string;
        requirements?: string;
        preferred_points?: string;
        benefits?: string;
      };
    };
  };
  const job = root.job;
  const company = job?.company?.name?.trim() || job?.company?.company_name?.trim();
  const role = job?.position?.trim();
  const sourceText = joinJobText([
    job?.detail?.intro,
    job?.detail?.main_tasks,
    job?.detail?.requirements,
    job?.detail?.preferred_points,
    job?.detail?.benefits,
  ]);
  if (!company || !role || sourceText.length < 40) return null;
  const location =
    job?.address?.full_location?.trim() ||
    [job?.address?.location, job?.address?.district].filter(Boolean).join(" ");
  return {
    company,
    role,
    sourceText,
    jobPostingUrl,
    ...(location ? { location } : {}),
  };
}

export function parseWantedJobHtml(html: string, jobPostingUrl: string): ParsedJob {
  const fromJson = parseWantedNextData(html);
  if (fromJson) {
    return { ...fromJson, jobPostingUrl };
  }
  const role =
    firstMatch(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i) ||
    "Open role";
  const company =
    firstMatch(html, /<h2[^>]*>([\s\S]*?)<\/h2>/i) ||
    "Unknown company";
  const homepage = firstMatch(
    html,
    /href="(https?:\/\/[^"]+)"[^>]*>\s*회사 홈페이지/i,
  );
  return {
    company,
    role,
    sourceText: strip(html),
    jobPostingUrl,
    ...(homepage
      ? { companyWebsite: normalizeHttpUrl(homepage, "company website") }
      : {}),
  };
}

function parseWantedNextData(html: string): Omit<ParsedJob, "jobPostingUrl"> | null {
  const raw = firstMatch(
    html,
    /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i,
  );
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as {
      props?: {
        pageProps?: {
          initialData?: {
            position?: string;
            intro?: string;
            main_tasks?: string;
            requirements?: string;
            preferred_points?: string;
            benefits?: string;
            company?: { company_name?: string };
          };
        };
      };
    };
    const job = data.props?.pageProps?.initialData;
    if (!job) return null;
    const company = job.company?.company_name?.trim();
    const role = job.position?.trim();
    const sourceText = [
      job.intro,
      job.main_tasks,
      job.requirements,
      job.preferred_points,
      job.benefits,
    ]
      .filter((part): part is string => Boolean(part && part.trim()))
      .join("\n");
    if (!company || !role || sourceText.length < 40) return null;
    const location =
      (job as { address?: { full_location?: string } }).address?.full_location?.trim();
    return { company, role, sourceText, ...(location ? { location } : {}) };
  } catch {
    return null;
  }
}
