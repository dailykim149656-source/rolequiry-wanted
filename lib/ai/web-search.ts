export type WebSearchHit = {
  readonly url: string;
  readonly title: string;
};

const BLOCKED_HOSTS = new Set([
  "duckduckgo.com",
  "html.duckduckgo.com",
  "www.wanted.co.kr",
  "wanted.co.kr",
  "recruit.wanted.co.kr",
]);

export function parseDuckDuckGoHits(html: string, limit = 6): WebSearchHit[] {
  const hits: WebSearchHit[] = [];
  const seen = new Set<string>();
  const pattern =
    /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(pattern)) {
    const url = decodeDuckDuckGoUrl(match[1] ?? "");
    if (!url || seen.has(url)) continue;
    seen.add(url);
    hits.push({
      url,
      title: (match[2] ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
    });
    if (hits.length >= limit) break;
  }
  return hits;
}

function decodeDuckDuckGoUrl(raw: string): string {
  try {
    const parsed = new URL(raw, "https://html.duckduckgo.com");
    const uddg = parsed.searchParams.get("uddg");
    const href = uddg ?? parsed.href;
    const url = new URL(href);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    if (BLOCKED_HOSTS.has(url.hostname)) return "";
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

export function publicSearchQuery(input: {
  readonly company: string;
  readonly role: string;
  readonly unresolvedVariable: string;
  readonly counter?: boolean;
}): string {
  const counter = input.counter ? "후기 OR 실제 OR 반박 OR review" : "";
  return [input.company, input.role, input.unresolvedVariable, counter]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function searchPublicWeb(query: string): Promise<WebSearchHit[]> {
  if (!query) return [];
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const response = await fetch("https://html.duckduckgo.com/html/", {
      method: "POST",
      headers: {
        accept: "text/html",
        "content-type": "application/x-www-form-urlencoded",
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      },
      body: new URLSearchParams({ q: query }).toString(),
      redirect: "follow",
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!response.ok) return [];
    return parseDuckDuckGoHits(await response.text());
  } catch {
    return [];
  }
}

const LOW_QUALITY_HOST_PARTS = [
  "simpliaxis",
  "udemy",
  "coursera",
  "skillshare",
  "clickfunnels",
  "hotmart",
];

const LOW_QUALITY_TITLE = /flash sale|limited time|% off|all courses|add to cart|수강|강의 할인/i;

export function isLowQualityHit(hit: WebSearchHit): boolean {
  try {
    const host = new URL(hit.url).hostname.replace(/^www\./, "").toLowerCase();
    if (LOW_QUALITY_HOST_PARTS.some((part) => host.includes(part))) return true;
  } catch {
    return true;
  }
  return LOW_QUALITY_TITLE.test(hit.title);
}

export function isSameSource(left: string, right: string): boolean {
  try {
    const a = new URL(left);
    const b = new URL(right);
    return a.hostname.replace(/^www\./, "") === b.hostname.replace(/^www\./, "") &&
      a.pathname.replace(/\/$/, "") === b.pathname.replace(/\/$/, "");
  } catch {
    return left === right;
  }
}
