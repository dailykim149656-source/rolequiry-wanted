"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export const LOCALE = {
  KO: "ko",
  EN: "en",
} as const;
export type Locale = (typeof LOCALE)[keyof typeof LOCALE];

const STORAGE_KEY = "rolequiry.locale";

const COPY = {
  ko: {
    analyze: "공고 분석하기",
    analyzing: "공고 읽는 중",
    sample: "샘플",
    sampleFirst: "샘플로 먼저 보기",
    otherPosting: "다른 공고 분석",
    check: "확인",
    landingTitle: "입사 전에, 이 역할이 나와 맞는지 더 깊이 알아보세요.",
    landingLede:
      "원티드 채용공고 URL을 붙여넣으세요. Rolequiry가 공고와 공개정보를 함께 살펴보고 잘 맞는 점, 더 확인할 점, 면접에서 물어볼 점을 정리합니다.",
    sourceLabel: "원티드 채용공고 URL",
    samplesNow: "지금 확인할 수 있는 샘플",
    claims: "공고에서 확인되는 기대사항",
    evidence: "공개정보에서 확인되는 조건과 신호",
    nextItem: "다음으로 확인할 항목",
    investigate: "이 항목 조사하기",
    copyQuestion: "입사 전 확인 질문 복사",
    aligned: "잘 맞음",
    mismatch: "기대 차이",
    unknown: "더 확인",
    more: "더 보기",
    imported: "가져온 공고",
    demo: "샘플 공고",
    nextHint: "지금 결정을 가르는 질문입니다.",
    priorityLabel: "내 중요도",
    setPriority: "중요도 고르기",
    notInRanking: "아직 순위에 넣지 않음",
    viewEvidence: "근거 보기",
    employerSource: "공고",
    publicSource: "공개정보",
    interviewSource: "면접",
    judgmentTitle: "중요도를 고르면 다음 항목이 정해집니다",
    judgmentBody: "중요도를 고르지 않은 항목은 조사 대상이 아닙니다. 이 역할을 보는 데 실제로 중요한 것만 고르세요.",
    importJob: "공고 넣기",
    setPriorities: "중요도 고르기",
    chooseNext: "다음 항목 고르기",
    askNext: "질문하기",
    setPrioritiesCta: "중요도 고르기",
    rankingHow: "순위가 정해지는 방식",
    rankingWeights: "확인이 안 된 항목은 내 중요도 {importance}, 미확인 정도 {unresolved}, 긴장 {tension}으로 순서를 정합니다.",
    rankingTies: "동점이면 항목 이름, 그다음 항목 ID 순입니다.",
    rankingLived: "실제 경험 항목은 공고 근거 {employer}, 공개 제보 최대 {public}, 면접에서 확인된 답 {interview}로 반영합니다.",
    rankingHeuristic: "이건 예측 점수가 아니라, 순서를 공개하는 규칙입니다.",
    priorityNotSet: "미설정",
    dossierSettled: "확인된 것, 아직 열린 것, 다음에 물어볼 것.",
    confirmPriorities: "먼저 중요도를 고르세요. 고른 항목만 정리합니다.",
    whatToAsk: "다음에 물어볼 것",
    copyQuestions: "질문 복사",
    copied: "복사됨",
    askThe: "물어볼 상대",
    recruiter: "리크루터",
    hiringManager: "채용 담당 매니저",
    teamMember: "팀원",
    interviewer: "면접관",
    resolved: "확인됨",
    contradicted: "기대 차이 · 직접 가늠하세요",
    awaitingPriority: "중요도 대기",
    askInInterview: "면접에서 확인",
    importanceLow: "낮음",
    importanceMedium: "보통",
    importanceHigh: "높음",
    importanceCritical: "매우 중요",
    supported: "확인됨",
    challenged: "긴장",
    ambiguity: "긴장",
    unverified: "미확인",
    langKo: "KO",
    langEn: "EN",
  },
  en: {
    analyze: "Analyze posting",
    analyzing: "Reading posting",
    sample: "Sample",
    sampleFirst: "See a sample first",
    otherPosting: "Analyze another posting",
    check: "Check",
    landingTitle: "Before you join, see whether this role actually fits.",
    landingLede:
      "Paste a Wanted job URL. Rolequiry compares the posting with public information and lists what fits, what to double-check, and what to ask.",
    sourceLabel: "Wanted job posting URL",
    samplesNow: "Samples you can check now",
    claims: "What the posting claims",
    evidence: "What public information shows",
    nextItem: "What to check next",
    investigate: "Investigate this item",
    copyQuestion: "Copy interview questions",
    aligned: "Aligned",
    mismatch: "Mismatch",
    unknown: "Unknown",
    more: "More",
    imported: "Imported case",
    demo: "Demo case",
    nextHint: "Why this is the question that matters next.",
    priorityLabel: "Candidate priority",
    setPriority: "Set priority",
    notInRanking: "Not in ranking yet",
    viewEvidence: "View evidence",
    employerSource: "Employer source",
    publicSource: "Public",
    interviewSource: "Interview",
    judgmentTitle: "Your judgment activates the ranking",
    judgmentBody: "Unprioritized claims stay outside the decision. Choose only what could materially change your view of the role.",
    importJob: "Import job",
    setPriorities: "Set priorities",
    chooseNext: "Choose next",
    askNext: "Ask next",
    setPrioritiesCta: "Set your priorities",
    rankingHow: "How ranking works",
    rankingWeights: "Eligible unresolved claims are ranked by {importance} candidate priority, {unresolved} unresolvedness, and {tension} tension.",
    rankingTies: "Ties use stable dimension text, then claim ID.",
    rankingLived: "For lived experience, evidence coverage weights employer claims at {employer}, public reports at up to {public}, and a resolving interview answer at {interview}.",
    rankingHeuristic: "This is a transparent heuristic, not a predictive fit score or an empirically calibrated outcome model.",
    priorityNotSet: "Priority not set",
    dossierSettled: "What is settled, what is still open, and what to ask next.",
    confirmPriorities: "Confirm your priorities first. The dossier rolls up only claims you have judged.",
    whatToAsk: "What to ask next",
    copyQuestions: "Copy questions",
    copied: "Copied",
    askThe: "Ask the",
    recruiter: "recruiter",
    hiringManager: "hiring manager",
    teamMember: "team member",
    interviewer: "interviewer",
    resolved: "Sufficiently resolved",
    contradicted: "Contradicted — weigh explicitly",
    awaitingPriority: "Awaiting your priority",
    askInInterview: "Ask in interview",
    importanceLow: "Low",
    importanceMedium: "Medium",
    importanceHigh: "High",
    importanceCritical: "Critical",
    supported: "Supported",
    challenged: "Challenged",
    ambiguity: "Material ambiguity",
    unverified: "Unverified",
    langKo: "KO",
    langEn: "EN",
  },
} as const;

type Copy = (typeof COPY)[Locale];

const LocaleContext = createContext<{
  locale: Locale;
  copy: Copy;
  setLocale: (locale: Locale) => void;
}>({
  locale: LOCALE.KO,
  copy: COPY.ko,
  setLocale: () => undefined,
});

export function LocaleProvider({
  children,
  initial = LOCALE.KO,
}: {
  readonly children: ReactNode;
  readonly initial?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(initial);
  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (initial !== LOCALE.KO) return;
    if (saved === LOCALE.EN || saved === LOCALE.KO) setLocaleState(saved);
  }, [initial]);
  const setLocale = (next: Locale) => {
    setLocaleState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  };
  const value = useMemo(
    () => ({ locale, copy: COPY[locale], setLocale }),
    [locale],
  );
  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function useLocale() {
  return useContext(LocaleContext);
}

export function LanguageToggle() {
  const { locale, setLocale, copy } = useLocale();
  return (
    <div
      aria-label="Language"
      className="flex overflow-hidden rounded-full border border-[#e1e2e4] text-xs font-bold"
      role="group"
    >
      <button
        className={`px-2.5 py-1.5 ${locale === LOCALE.KO ? "bg-[#3366ff] text-white" : "bg-white text-[#333]"}`}
        onClick={() => setLocale(LOCALE.KO)}
        type="button"
      >
        {copy.langKo}
      </button>
      <button
        className={`px-2.5 py-1.5 ${locale === LOCALE.EN ? "bg-[#3366ff] text-white" : "bg-white text-[#333]"}`}
        onClick={() => setLocale(LOCALE.EN)}
        type="button"
      >
        {copy.langEn}
      </button>
    </div>
  );
}
