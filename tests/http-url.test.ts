import { describe, expect, it } from "vitest";
import { InvalidHttpUrlError, normalizeHttpUrl } from "@/lib/webmcp/http-url";

describe("normalizeHttpUrl", () => {
  it("rejects loopback and private fetch targets", () => {
    expect(() => normalizeHttpUrl("http://127.0.0.1/secret", "job posting URL")).toThrow(InvalidHttpUrlError);
    expect(() => normalizeHttpUrl("http://localhost/admin", "job posting URL")).toThrow(InvalidHttpUrlError);
    expect(() => normalizeHttpUrl("http://10.0.0.5/internal", "job posting URL")).toThrow(InvalidHttpUrlError);
    expect(() => normalizeHttpUrl("http://169.254.169.254/latest/meta-data", "job posting URL")).toThrow(InvalidHttpUrlError);
  });

  it("keeps public https job URLs", () => {
    expect(normalizeHttpUrl("https://www.wanted.co.kr/wd/333563", "job posting URL")).toContain("wanted.co.kr/wd/333563");
  });
});
