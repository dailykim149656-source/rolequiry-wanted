export class InvalidHttpUrlError extends Error {
  readonly name = "InvalidHttpUrlError";

  constructor(readonly label: string) {
    super(`${label} must be a valid public http(s) URL`);
  }
}

const BLOCKED_HOSTS = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
]);

function isBlockedHostname(hostname: string): boolean {
  const host = hostname.replace(/\.$/, "").toLowerCase();
  if (BLOCKED_HOSTS.has(host)) return true;
  if (host.endsWith(".localhost") || host.endsWith(".internal")) return true;
  if (host === "0.0.0.0") return true;
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!ipv4) return false;
  const a = Number(ipv4[1]);
  const b = Number(ipv4[2]);
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
}

export function normalizeHttpUrl(value: string, label: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    throw new InvalidHttpUrlError(label);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new InvalidHttpUrlError(label);
  }
  if (parsed.username || parsed.password) {
    throw new InvalidHttpUrlError(label);
  }
  if (isBlockedHostname(parsed.hostname)) {
    throw new InvalidHttpUrlError(label);
  }
  parsed.hash = "";
  return parsed.toString();
}

export async function fetchPublicText(url: string, limit = 4000): Promise<string> {
  let normalized: string;
  try {
    normalized = normalizeHttpUrl(url, "source URL");
  } catch {
    return "";
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    const response = await fetch(normalized, {
      headers: { accept: "text/html,text/plain" },
      redirect: "follow",
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!response.ok) return "";
    const type = response.headers.get("content-type") ?? "";
    if (type && !/text\/html|text\/plain|application\/xhtml/i.test(type)) {
      return "";
    }
    return (await response.text())
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, limit);
  } catch {
    return "";
  }
}
