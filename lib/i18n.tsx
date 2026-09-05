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
    otherPosting: "다른 공고 보기",
    check: "확인",
    landingTitle: "입사하기 전에, 이 일이 나와 맞는지 한번 더 보세요.",
    landingLede:
      "원티드 공고 주소를 붙여넣으세요. Rolequiry가 공고와 공개된 정보를 같이 보고, 맞는 점, 더 볼 점, 면접에서 물을 점을 정리합니다.",
    sourceLabel: "원티드 채용공고 URL",
    samplesNow: "지금 볼 수 있는 샘플",
    claims: "공고가 말하는 기대",
    evidence: "밖에서 보이는 조건",
    nextItem: "다음에 볼 것",
    investigate: "이 항목 찾아보기",
    copyQuestion: "면접 질문 복사",
    aligned: "잘 맞음",
    mismatch: "기대 차이",
    unknown: "더 확인",
    more: "더 보기",
    imported: "불러온 공고",
    demo: "샘플 공고",
    nextHint: "지금 갈리는 질문입니다.",
    priorityLabel: "내 중요도",
    setPriority: "중요도 고르기",
    notInRanking: "아직 순위에 없음",
    viewEvidence: "근거 보기",
    employerSource: "공고",
    publicSource: "공개정보",
    interviewSource: "면접",
    judgmentTitle: "중요도를 고르면 다음이 정해집니다",
    judgmentBody: "고르지 않은 항목은 찾지 않습니다. 이 일을 볼 때 진짜 중요한 것만 고르세요.",
    importJob: "공고 넣기",
    setPriorities: "중요도 고르기",
    chooseNext: "다음 고르기",
    askNext: "질문하기",
    setPrioritiesCta: "중요도 고르기",
    rankingHow: "순위 정하는 방식",
    rankingWeights: "아직 안 본 항목은 내 중요도 {importance}, 미확인 {unresolved}, 긴장 {tension}으로 순서를 정합니다.",
    rankingTies: "같으면 항목 이름, 그다음 항목 ID 순입니다.",
    rankingLived: "실제 경험은 공고 근거 {employer}, 공개 제보 최대 {public}, 면접에서 확인된 답 {interview}로 반영합니다.",
    rankingHeuristic: "점수가 아닙니다. 무엇을 먼저 볼지 공개하는 규칙입니다.",
    priorityNotSet: "미설정",
    dossierSettled: "확인된 것, 아직 모르는 것, 다음에 물어볼 것.",
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
    contradicted: "기대가 다를 수 있음 · 직접 보세요",
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
    prioritiesReady: "이 항목부터 보면 됩니다",
    prioritiesReadyBody: "중요도는 이미 반영됐습니다. 다음 항목만 공개된 정보로 확인하세요.",
    starter1: "다음에 볼 것을 고릅니다.",
    starter2: "공개된 정보에서 근거와 반대 신호를 찾습니다.",
    starter3: "면접에서 물을 질문으로 남깁니다.",
    dossierLabel: "입사 전 확인 메모",
    blockersRemaining: "볼 항목 {n}개 남음",
    blockersRemainingPlural: "볼 항목 {n}개 남음",
    noBlockers: "당장 볼 항목 없음",
    noQuestions: "남은 면접 질문이 없습니다.",
    employerClaims: "회사 공고 원문",
    langKo: "KO",
    langEn: "EN",
    shareResult: "결과 공유",
    leaveFeedback: "피드백 남기기",
    feedbackPrompt: "지원할지 판단하는 데 도움이 됐나요? 한 줄만 적어 주세요.",
    feedbackThanks: "피드백을 기록했습니다.",
    feedbackFailed: "피드백을 저장하지 못했습니다.",
  },
  en: {
    analyze: "Analyze posting",
    analyzing: "Reading posting",
    sample: "Sample",
    sampleFirst: "See a sample first",
    otherPosting: "Analyze another posting",
    check: "Check",
    landingTitle: "Before you join, check whether this job actually fits.",
    landingLede:
      "Paste a Wanted job URL. Rolequiry compares the posting with public information and lists what fits, what to double-check, and what to ask.",
    sourceLabel: "Wanted job posting URL",
    samplesNow: "Samples you can check now",
    claims: "What the posting says",
    evidence: "What is visible outside",
    nextItem: "What to look at next",
    investigate: "Look this up",
    copyQuestion: "Copy interview questions",
    aligned: "Aligned",
    mismatch: "Mismatch",
    unknown: "Unknown",
    more: "More",
    imported: "Imported case",
    demo: "Demo case",
    nextHint: "This is the question that splits the decision now.",
    priorityLabel: "Candidate priority",
    setPriority: "Set priority",
    notInRanking: "Not in ranking yet",
    viewEvidence: "View evidence",
    employerSource: "Employer source",
    publicSource: "Public",
    interviewSource: "Interview",
    judgmentTitle: "Pick what matters, then the next item is set",
    judgmentBody: "Items you skip are not researched. Pick only what would actually change how you see this job.",
    importJob: "Import job",
    setPriorities: "Set priorities",
    chooseNext: "Choose next",
    askNext: "Ask next",
    setPrioritiesCta: "Set your priorities",
    rankingHow: "How ranking works",
    rankingWeights: "Eligible unresolved claims are ranked by {importance} candidate priority, {unresolved} unresolvedness, and {tension} tension.",
    rankingTies: "Ties use stable dimension text, then claim ID.",
    rankingLived: "For lived experience, evidence coverage weights employer claims at {employer}, public reports at up to {public}, and a resolving interview answer at {interview}.",
    rankingHeuristic: "This is a public ranking rule, not a fit score.",
    priorityNotSet: "Priority not set",
    dossierSettled: "What is known, what is still open, and what to ask next.",
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
    prioritiesReady: "Start with this item",
    prioritiesReadyBody: "Priorities are already in. Check the next item in public sources.",
    starter1: "Ask “What should I investigate next?”",
    starter2: "Verify the active claim with public evidence.",
    starter3: "Record the answer, then check again.",
    dossierLabel: "Due diligence dossier",
    blockersRemaining: "{n} decision blocker remaining",
    blockersRemainingPlural: "{n} decision blockers remaining",
    noBlockers: "No decision blockers",
    noQuestions: "No open interview questions. Unresolved claims are either contradicted or awaiting your priority.",
    employerClaims: "Employer claims",
    langKo: "KO",
    langEn: "EN",
    shareResult: "Share result",
    leaveFeedback: "Leave feedback",
    feedbackPrompt: "Did this help you decide whether to apply? One sentence is enough.",
    feedbackThanks: "Feedback saved.",
    feedbackFailed: "Could not save feedback.",
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
