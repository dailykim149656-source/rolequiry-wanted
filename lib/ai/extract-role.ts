import type { ImportedClaimInput } from "@/lib/domain/types";
import { chatJson } from "@/lib/ai/client";
import { hostedAiConfig } from "@/lib/ai/env";

export type ProposedClaim = ImportedClaimInput;

export type ExtractClaimsInput = {
  readonly company: string;
  readonly role: string;
  readonly sourceText: string;
  readonly proposedClaims?: readonly ProposedClaim[];
};

export type ExtractClaimsResult = {
  readonly company: string;
  readonly role: string;
  readonly claims: readonly ImportedClaimInput[];
};

function quoteInSource(sourceText: string, quote: string): boolean {
  const needle = quote.trim();
  return needle.length > 0 && sourceText.includes(needle);
}

const FALLBACK_DIMENSIONS = [
  {
    match: /travel/i,
    dimension: "Travel",
    unresolvedVariable: "How concentrated is the stated travel?",
    measurableForm: "Median and maximum travel days in the last two quarters",
  },
  {
    match: /own production|end to end/i,
    dimension: "Technical ownership",
    unresolvedVariable: "Who owns production changes after launch?",
    measurableForm: "Named owner of the last customer-site change",
  },
  {
    match: /hybrid work/i,
    dimension: "Location",
    unresolvedVariable: "How many days are actually in the hub?",
    measurableForm: "Required office days last quarter",
  },
  {
    match: /hands-on coding|coding remains/i,
    dimension: "Hands-on coding",
    unresolvedVariable: "What share of the week is production coding?",
    measurableForm: "Coding hours versus coordination hours last month",
  },
  {
    match: /출장/,
    dimension: "출장",
    unresolvedVariable: "출장은 얼마나 잦고 얼마나 몰리나?",
    measurableForm: "최근 분기 출장 일수 중앙값과 최댓값",
  },
  {
    match: /선택적 시간|유연근무|원격|재택|하이브리드/,
    dimension: "근무 방식",
    unresolvedVariable: "실제 근무 시간과 장소는 어떻게 운영되나?",
    measurableForm: "필수 출근일 또는 선택근무 운영 방식",
  },
  {
    match: /스타트업|시리즈|투자/,
    dimension: "회사 단계",
    unresolvedVariable: "이 팀의 성장 단계와 안정성은 공고와 같나?",
    measurableForm: "최근 투자 라운드와 팀 규모",
  },
  {
    match: /현장|고객사|설치/,
    dimension: "현장 업무",
    unresolvedVariable: "현장 업무가 일과의 얼마나를 차지하나?",
    measurableForm: "주간 현장 근무 비중",
  },
] as const;

function genericDimension(text: string): { dimension: string; unresolvedVariable: string; measurableForm: string } {
  if (/경력|년 이상|경험/.test(text)) {
    return {
      dimension: "경력",
      unresolvedVariable: "이 경력 요건은 실제로 얼마나 엄격한가?",
      measurableForm: "필수 연차와 예외 여부",
    };
  }
  if (/영어|글로벌|해외|수출/.test(text)) {
    return {
      dimension: "글로벌 업무",
      unresolvedVariable: "해외 업무가 일과의 얼마나를 차지하나?",
      measurableForm: "영어 사용 빈도와 해외 대응 범위",
    };
  }
  if (/기획|전략|콘셉트|제품/.test(text)) {
    return {
      dimension: "역할 범위",
      unresolvedVariable: "이 역할이 실제로 어디까지 맡나?",
      measurableForm: "최근 분기 담당 업무와 의사결정 범위",
    };
  }
  return {
    dimension: "근무 조건",
    unresolvedVariable: "이 조건은 공고와 실제가 같나?",
    measurableForm: "최근 사례나 내부 기준으로 확인할 점",
  };
}

function isRequirementLine(text: string): boolean {
  return /^(•|-|\*)\s+/.test(text) || /경력|가능하신 분|경험자|보유하신 분|우대/.test(text);
}

function fallbackClaims(sourceText: string): ImportedClaimInput[] {
  const claims: ImportedClaimInput[] = [];
  for (const line of sourceText.split(/\n+/)) {
    const statement = line.trim().replace(/\.$/, ".");
    const cleaned = statement.replace(/^[•\-\s]+/, "");
    if (cleaned.length < 12) continue;
    const known = FALLBACK_DIMENSIONS.find((item) => item.match.test(statement) || item.match.test(cleaned));
    if (!known && !isRequirementLine(statement) && !isRequirementLine(cleaned)) continue;
    const dim = known
      ? {
          dimension: known.dimension,
          unresolvedVariable: known.unresolvedVariable,
          measurableForm: known.measurableForm,
        }
      : genericDimension(cleaned);
    if (!quoteInSource(sourceText, cleaned) && !quoteInSource(sourceText, statement)) continue;
    claims.push({
      dimension: dim.dimension,
      employerStatement: quoteInSource(sourceText, cleaned) ? cleaned : statement,
      unresolvedVariable: dim.unresolvedVariable,
      measurableForm: dim.measurableForm,
    });
  }
  const rank = (dimension: string) => {
    if (dimension === "출장" || dimension === "Travel") return 0;
    if (dimension === "근무 방식" || dimension === "Location") return 1;
    if (dimension === "현장 업무") return 2;
    return 3;
  };
  return [...claims]
    .sort((left, right) => rank(left.dimension) - rank(right.dimension))
    .slice(0, 8);
}

export function extractClaimsFromJobText(
  input: ExtractClaimsInput,
): ExtractClaimsResult {
  const proposed = input.proposedClaims ?? fallbackClaims(input.sourceText);
  const claims = proposed.filter((claim) =>
    quoteInSource(input.sourceText, claim.employerStatement),
  );
  return {
    company: input.company.trim(),
    role: input.role.trim(),
    claims: claims.slice(0, 8),
  };
}

export async function extractClaimsWithHostedModel(
  input: ExtractClaimsInput,
): Promise<ExtractClaimsResult> {
  const config = hostedAiConfig();
  if (!config.enabled) return extractClaimsFromJobText(input);
  const proposed = await chatJson<{ claims?: ProposedClaim[] }>({
    model: config.extractorModel,
    system:
      "Extract 5-8 atomic employer claims as JSON {claims:[{dimension,employerStatement,unresolvedVariable,measurableForm}]}. employerStatement must be an exact quote from the source. No extra keys.",
    user: JSON.stringify({
      company: input.company,
      role: input.role,
      sourceText: input.sourceText.slice(0, 12000),
    }),
  });
  const fromModel = extractClaimsFromJobText({
    ...input,
    ...(proposed?.claims ? { proposedClaims: proposed.claims } : {}),
  });
  if (fromModel.claims.length > 0) return fromModel;
  return extractClaimsFromJobText(input);
}
