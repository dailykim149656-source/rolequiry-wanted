"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { LanguageToggle, useLocale } from "@/lib/i18n";

const SAMPLES = [
  {
    id: "atlas-fde",
    mark: "AT",
    title: "출장 50%, 실제로 몰아서 나가나",
    company: "Atlas",
    loc: "서울 강남구 · Forward Deployed",
    tone: "bg-[#1d2b4a]",
  },
  {
    id: "kestrel-solutions",
    mark: "KS",
    title: "온콜은 공고보다 잦은가",
    company: "Kestrel",
    loc: "서울 성동구 · Backend",
    tone: "bg-[#24352a]",
  },
] as const;

export default function Home() {
  const router = useRouter();
  const [source, setSource] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const { copy } = useLocale();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const urlValue = String(form.get("source") ?? source).trim();
    const textValue = String(form.get("paste") ?? pasteText).trim();
    if (!urlValue && !textValue) {
      setError("원티드 공고 주소나 공고 글을 넣어 주세요.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const body = textValue
        ? { text: textValue, ...(urlValue ? { url: urlValue } : {}) }
        : { url: urlValue };
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as {
        error?: string;
        company?: string;
        role?: string;
        jobPostingUrl?: string | null;
        companyWebsite?: string | null;
        claims?: Array<{
          dimension: string;
          employerStatement: string;
          unresolvedVariable: string;
          measurableForm: string;
        }>;
      };
      if (!response.ok) {
        setError(payload.error ?? "공고를 읽지 못했습니다. 글로 붙여넣어 보세요.");
        setPasteOpen(true);
        return;
      }
      if (!payload.claims?.length) {
        setError("확인할 문장을 찾지 못했습니다. 공고 원문을 글로 붙여넣어 주세요.");
        setPasteOpen(true);
        return;
      }
      window.sessionStorage.setItem(
        "rolequiry.import",
        JSON.stringify({
          company: payload.company,
          role: payload.role,
          sourceUrl: payload.jobPostingUrl,
          jobPostingUrl: payload.jobPostingUrl,
          companyWebsite: payload.companyWebsite,
          claims: payload.claims,
        }),
      );
      router.push("/case?imported=1");
    } catch {
      setError("공고를 읽지 못했습니다. 글로 붙여넣어 보세요.");
      setPasteOpen(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="min-h-dvh bg-white text-[#171717]">
      <header className="flex h-[50px] items-center justify-between border-b border-[#ececec] px-6 xl:px-10">
        <div className="flex items-center gap-5">
          <p className="text-lg font-bold tracking-tight">Rolequiry</p>
          <span className="hidden text-sm font-semibold text-[#333] sm:inline">
            {copy.check}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <LanguageToggle />
          <Link
            className="rounded-full bg-[#3366ff] px-3 py-1.5 text-sm font-bold text-white"
            href="#analyze"
          >
            {copy.analyze}
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1060px] px-5 py-8">
        <h1 className="max-w-[16ch] text-[36px] font-bold leading-tight tracking-tight">
          {copy.landingTitle}
        </h1>
        <p className="mt-3 max-w-[40em] text-base text-[#666]">
          {copy.landingLede}
        </p>
        <form
          action="#"
          className="mt-6"
          id="analyze"
          method="post"
          onSubmit={onSubmit}
        >
          <label className="sr-only" htmlFor="source">
            {copy.sourceLabel}
          </label>
          <div className="flex gap-2 rounded-full border border-[#e1e2e4] bg-white py-1.5 pr-1.5 pl-5 shadow-[0_2px_8px_rgba(0,0,0,.04)]">
            <input
              className="min-w-0 flex-1 bg-transparent text-base outline-none"
              id="source"
              name="source"
              onChange={(event) => setSource(event.target.value)}
              placeholder="https://www.wanted.co.kr/wd/..."
              value={source}
            />
            <button
              className="h-11 shrink-0 rounded-full bg-[#3366ff] px-4 text-sm font-bold text-white disabled:opacity-60"
              disabled={pending}
              type="submit"
            >
              {pending ? copy.analyzing : copy.analyze}
            </button>
          </div>
        </form>
        {error ? <p className="mt-3 text-sm text-[#c23c4c]">{error}</p> : null}
        {pasteOpen ? (
          <label className="mt-3 block text-sm">
            <span className="font-semibold text-[#333]">공고 원문</span>
            <textarea
              className="mt-2 min-h-32 w-full rounded-2xl border border-[#e1e2e4] p-3 text-sm outline-none"
              name="paste"
              onChange={(event) => setPasteText(event.target.value)}
              placeholder="공고 본문을 붙여넣으세요"
              value={pasteText}
            />
          </label>
        ) : null}
        <Link
          className="mt-3 inline-block text-sm font-semibold text-[#3366ff]"
          href="/case?sample=atlas-fde"
        >
          {copy.sampleFirst}
        </Link>
        <div className="mt-8 flex items-baseline justify-between">
          <h2 className="text-lg font-bold">{copy.samplesNow}</h2>
        </div>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SAMPLES.map((sample) => (
            <Link
              className="overflow-hidden rounded-2xl border border-[#ececec]"
              href={`/case?sample=${sample.id}`}
              key={sample.id}
            >
              <div
                className={`grid h-[118px] place-items-center text-[22px] font-extrabold text-white ${sample.tone}`}
              >
                {sample.mark}
              </div>
              <div className="p-3">
                <p className="font-bold tracking-tight">{sample.title}</p>
                <p className="mt-1 text-sm">{sample.company}</p>
                <p className="mt-1 text-xs text-[#999]">{sample.loc}</p>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
