# Rolequiry Wanted Edition 구현안

원티드 AI Championship 최적화 기준의 제품, AI, 데이터, 비용, 평가 및 개발 로드맵

- 원본: [Google Doc](https://docs.google.com/document/d/1zIRuW7Hogkac7EXs1nK4g2tWLI5MgqFMdBtprQy8s2Y/edit)
- 파일 ID: `1zIRuW7Hogkac7EXs1nK4g2tWLI5MgqFMdBtprQy8s2Y`
- Drive 수정시각: 2026-09-04T16:07:03Z
- revision: 7
- 반영 시각: 2026-09-05

## 문서 목적

WebMCP Challenge 제출본과 분리된 rolequiry-wanted를 원티드 대회용 standalone AI 제품으로 발전시키기 위한 구현 기준을 확정한다. 핵심은 기존 Rolequiry의 deterministic decision core를 보존하면서, 공고 수집과 claim 추출, 웹 리서치, evidence 검증을 제품 내부에 내장하는 것이다.

## 제품 정의

Rolequiry는 회사와 지원자가 입사 전에 서로의 기대를 더 정확하게 맞추도록 돕는 candidate-side Job Fit Intelligence 서비스다. 회사가 지원자의 역량과 조직 적합성을 검토하듯, 지원자도 공고와 공개정보를 바탕으로 실제 역할·업무환경·의사결정 방식이 자신의 우선순위와 맞는지 확인한다. 목적은 회사를 평가하거나 점수화하는 것이 아니라, 입사 후에야 발견되는 expectation mismatch를 채용 전에 더 많이 발견하는 것이다.

핵심 사용자 가치는 세 단계로 압축한다.

- Claims: 회사가 공고에서 실제로 주장하거나 약속한 내용을 원문 근거와 함께 구조화한다.
- Evidence: 공식 자료와 외부 공개정보를 조사해 각 claim을 지지하는지, 반박하는지, 아직 확인할 수 없는지 구분한다.
- Questions: 공개정보만으로 남는 불확실성을 실제 면접에서 확인할 수 있는 질문으로 바꾼다.

제품의 외부 대표 메시지는 '공고만으로 알기 어려운 Job Fit을 입사 전에 더 정확히 확인합니다.'로 통일한다. 내부 기술 철학으로는 '회사가 말하는 것과 실제로 확인할 수 있는 것 사이의 간극을 찾는다'는 기존 관점을 유지한다.

## 원티드용 시장 프레이밍

핵심 개념은 candidate power나 회사 검증이 아니라 mutual fit, expectation alignment, better self-selection이다. 좋은 채용은 한쪽이 상대를 더 강하게 심사해서 완성되는 것이 아니라, 회사와 지원자가 입사 전에 서로의 기대를 더 정확히 맞출 때 완성된다는 관점으로 설명한다.

### 왜 회사에도 이익인가

핏이 맞지 않는 채용은 지원자만의 손실이 아니다. 회사는 채용, 면접, 온보딩, 팀 적응에 이미 비용을 지불한 뒤 다시 채용을 시작해야 할 수 있다.

Rolequiry는 더 많은 지원을 만드는 것이 아니라, 맞지 않는 지원자는 더 일찍 self-selection하고 맞는 지원자는 더 높은 확신을 가지고 합류하도록 돕는다.

따라서 성공은 '지원자가 회사를 거절했다'가 아니라 '서로 맞지 않는 채용을 입사 전에 발견했다'로 정의한다.

### 외부 언어 원칙

- '회사를 검증한다'보다 '역할을 더 정확히 이해한다'를 사용한다.
- '회사의 말이 사실인지 확인한다'보다 '공고와 실제 업무환경의 일치도를 확인한다'를 사용한다.
- '회사를 평가한다'보다 '서로의 기대를 정렬한다'를 사용한다.
- '역면접'보다 '입사 전 확인 질문'을 사용한다.
- 'risk'나 'contradiction'은 사용자 UI에서 'potential mismatch', 'expectation gap', '더 확인할 조건'으로 번역한다.
- Blind, Glassdoor, 리멤버 등의 익명 의견은 회사의 실체를 폭로하는 자료가 아니라 lived-experience signal로 다루고, 한 건을 사실로 단정하지 않는다.

### Fit 표현 원칙

Fit은 절대평가가 아니라 candidate expectation과 observed reality의 alignment다. 따라서 87% 같은 단일 Fit Score는 만들지 않는다.

최종 결과는 Aligned, Potential mismatch, Critical unknown 같은 형태로 보여주고, 사용자가 스스로 최종 판단하게 한다.

회사가 나쁘다는 결론이 아니라 '이 조건이 이 지원자에게 맞는가'를 판단하도록 돕는다. 같은 출장, 자율성, 온콜 조건도 사람마다 다른 fit 결과가 나올 수 있어야 한다.

## 원티드 대회 최적화 원칙

예선에서는 링크를 열자마자 문제와 가치가 이해되는 제품성이 중요하고, 본선에서는 기술적 신뢰성과 검증 가능성을 설명할 수 있어야 한다. 따라서 첫 화면에서는 기술을 숨기고, 내부 구조에서는 evidence provenance, verifier, evaluation을 강화한다.

- 로그인 없이 바로 사용할 수 있는 standalone web product를 기본 제출물로 한다.
- Wanted-first, not Wanted-only: 원티드 공고 URL을 가장 자연스러운 입력으로 지원하되 다른 채용사이트 URL과 직접 텍스트 입력도 허용한다.
- AI가 회사나 지원자를 종합 점수로 평가하지 않는다. fit을 하나의 숫자로 단정하지 않고, 잘 맞는 조건, 기대 차이가 있을 수 있는 조건, 입사 전에 더 확인해야 할 조건을 보여준다.
- 모든 claim을 한 번에 조사하지 않고 사용자의 의사결정을 가장 많이 바꿀 decision blocker부터 조사한다.
- 기능 수보다 실제 작동, 낮은 오류율, 안정적인 샘플 데모, 설명 가능한 구조를 우선한다.

## 최종 사용자 흐름

### 1. 공고 입력

사용자는 원티드 공고 URL, 다른 채용사이트 URL 또는 공고 텍스트를 입력한다. 원티드 URL은 대표 데모 경로로 사용하되 URL fetch 실패 시 즉시 텍스트 붙여넣기로 fallback한다.

### 2. Claim 추출

Luna가 공고에서 5~8개의 atomic claim을 추출한다. employerStatement는 요약문이 아니라 공고 원문의 exact quote를 사용하고, 서버에서 원문 포함 여부를 검증한다. 원문에 없는 statement는 case에 들어가지 않는다.

### 3. 사용자 Priority 설정

사용자는 본인의 의사결정에 중요한 claim만 중요도 Low, Medium, High, Critical로 설정한다. 이 단계가 AI의 일반론을 개인의 실제 의사결정 문제로 바꾸는 지점이다.

### 4. Decision Blocker 선정

기존 Rolequiry deterministic policy가 importance, unresolvedness, tension을 이용해 다음으로 조사할 claim을 선택한다. LLM은 ranking을 직접 결정하지 않는다.

### 5. Web Research

선택된 decision blocker 하나에 대해서만 supporting evidence와 counterevidence를 조사한다. 전체 회사를 무차별적으로 조사하지 않는다.

### 6. Evidence Verification

Researcher와 분리된 fresh context의 Verifier가 claim과 source evidence만 보고 SUPPORTS, CHALLENGES, INSUFFICIENT를 판정한다. 강한 결론을 내리기 전 반대 증거가 있는지 확인하는 절차를 둔다.

### 7. Case 재계산 및 Dossier

검증된 evidence만 deterministic core의 authority math에 반영한다. 결과는 확인된 것, 아직 모르는 것, 면접에서 물어볼 것으로 정리한다.

## 기술 아키텍처

기본 원칙은 'AI interprets and researches. Rolequiry owns the decision policy.'다.

### AI가 담당하는 영역

- 공고 언어 이해 및 structured claim extraction
- 검색 query 생성과 public web research
- source와 claim의 관련성 판단 및 evidence 요약
- SUPPORTS, CHALLENGES, INSUFFICIENT 검증
- 면접 질문의 자연스러운 문장화

### Rolequiry 코드가 담당하는 영역

- candidate priority 저장
- source authority와 provenance 정책
- coverage, unresolvedness, tension 계산
- decision blocker ranking
- dossier 구성과 interview pack 포함 여부

기존 deriveCase, policy, CaseStore, dossier 모듈은 가능한 한 유지하고 AI 기능을 adapter layer로 추가한다.

## 모델 및 비용 전략

Hosted Mode는 Luna-first로 구현한다. Claim extraction, query generation, research, evidence clustering, 기본 verifier를 Luna로 처리하고, evaluation 결과 필요할 때만 Terra escalation을 도입한다.

### 초기 환경 변수 예시

- ROLEQUIRY_EXTRACTOR_MODEL = Luna
- ROLEQUIRY_RESEARCH_MODEL = Luna
- ROLEQUIRY_VERIFIER_MODEL = Luna
- ROLEQUIRY_ESCALATION_MODEL = Terra

가장 중요한 비용 최적화는 모델 교체보다 research volume 제한이다. 공고의 모든 claim을 자동 조사하지 않고 decision blocker 하나만 조사하며, 다음 조사는 사용자가 원할 때 진행한다. 같은 source URL과 동일 query는 세션 단위로 cache한다.

BYOK는 구현하지 않는다. 사용자 API key 보관, provider별 설정, 키 오류와 보안 문제를 대회판에서 제외한다.

Hosted Mode를 심사용 기본 경로로 제공하고, 기존 WebMCP/MCP 방식은 '내 AI로 더 깊게 조사하기' 같은 optional Agent Mode로 남길 수 있다. 단, WebMCP diagnostics나 tool registration 정보는 메인 UX에서 제거한다.

## 데이터 및 Source 전략

원티드는 claim source의 시작점이지 분석의 전체가 아니다. 실제 차별화는 공고의 주장과 외부 evidence를 교차검증하는 데 있다.

### 자동 조사 우선 source

- 회사 공식 홈페이지, 채용 페이지, Engineering Blog
- 공개 GitHub, 컨퍼런스 발표, 임직원 인터뷰
- 신뢰할 수 있는 언론과 조직 변화 관련 공개자료
- 접근 및 이용 조건상 자동 분석이 가능한 공개 웹문서

### 커뮤니티 evidence

- Blind, Glassdoor, 리멤버 등은 중요한 lived-experience signal이지만 대규모 crawler나 무단 scraping을 제품 핵심으로 만들지 않는다.
- 사용자가 직접 읽은 리뷰의 URL 또는 텍스트를 추가하면 현재 claim과의 관련성, stance, 시점, 직무/지역 일치도를 분석하는 경로를 제공할 수 있다.
- 장기적으로 공식 API 또는 제휴가 가능한 source만 자동 adapter로 확장한다.

익명 글 한 건을 사실로 단정하지 않고, 서로 독립적인 출처에서 반복되는 패턴을 evidence cluster로 묶는다.

## Evidence 및 Domain Model 변경

현재 sourceUrl 하나로 job posting 조직과 employer official source를 동시에 판단하는 구조는 원티드, LinkedIn, Greenhouse 같은 ATS 공고에서 문제가 된다. 다음 필드를 분리한다.

- jobPostingUrl: 실제 채용공고 URL
- companyWebsite: 회사 공식 웹사이트
- employerDomain: official source authority 판정 기준

Evidence에는 최소한 다음 metadata를 추가한다.

- sourceUrl, sourceTitle, sourceCategory
- stance: SUPPORTS, CHALLENGES, NEUTRAL
- verificationStatus: VERIFIED, INSUFFICIENT, REJECTED
- roleMatch, locationMatch, recency, specificity 등 relevance metadata
- publishedAt, retrievedAt 등 시점 정보

AI_RESEARCHED evidence는 화면에는 보여도 authority math에는 바로 반영하지 않고, AI_VERIFIED 또는 검증된 상태만 decision state를 변경하도록 한다.

## 제품 UI

### 첫 화면

입사 전에, 이 역할이 나와 맞는지 더 깊이 알아보세요.

원티드 채용공고 URL을 붙여넣으세요. Rolequiry가 공고와 공개정보를 함께 살펴보고 잘 맞는 점, 더 확인할 점, 면접에서 물어볼 점을 정리합니다. 다른 사이트 또는 직접 붙여넣기도 지원합니다.

주요 CTA는 '공고 분석하기', 보조 CTA는 '샘플로 먼저 보기'로 단순화한다.

### Case 화면

- Claims: 공고에서 확인되는 기대사항
- Evidence: 공개정보에서 확인되는 조건과 신호
- Questions: 입사 전에 더 확인할 조건과 질문

현재 ClaimBoard와 Dossier의 조사보고서 스타일은 유지하고, DecisionPanel은 agent instruction 대신 '다음 decision blocker'와 '이 항목 조사하기' CTA를 보여준다.

샘플 데모는 반드시 별도로 제공한다. 외부 fetch나 모델 호출이 느리거나 실패해도 심사자와 온라인 투표자가 제품 가치를 즉시 볼 수 있어야 한다.

## 구현 범위

### P0 - 반드시 구현

- Standalone landing 및 JD intake
- Wanted URL 또는 JD text ingestion
- Luna 기반 atomic claim extraction + exact quote validation
- Candidate priority 설정
- Deterministic decision blocker selection
- Public web research + citation
- Counterevidence search
- Verifier와 INSUFFICIENT 판정
- Claims / Evidence / Questions dossier
- Instant sample demo

### P1 - 본선 경쟁력 강화

- Evaluation harness
- Evidence relevance metadata와 clustering 개선
- 필요 시 Terra escalation
- 실제 사용자 5~10명 테스트 및 feedback 기록
- 간단한 결과 공유 기능

### 이번 대회판에서 제외

- 로그인, 사용자 DB, 결제, 구독 플랜
- BYOK와 API key 입력
- Resume upload와 자기소개서 생성
- 자동 지원, Chrome extension
- 여러 회사 종합 비교 기능
- 회사 100점 만점 fit score
- Blind, Glassdoor, 리멤버 대규모 crawler
- 복잡한 multi-agent UI와 관리자 페이지

## 권장 Repo 구조

- app/: landing, case, API routes
- components/: RoleIntake, CaseApp, CaseWorkspace 및 case-workspace UI
- lib/ai/: client, schemas, extract-role, research-claim, verify-evidence, prompts
- lib/domain/: 기존 derive-case, dossier, policy, types 중심 유지
- lib/sources/: wanted adapter, generic web adapter, source policy
- lib/webmcp/: optional adapter로 유지
- evals/: benchmark data, extractor/verifier runner, metrics

## PR 단위 개발 순서

- PR1. Standalone UI: root redirect 제거, intake 추가, WebMCP 의존 사용자 문구와 diagnostics 제거
- PR2. JD ingestion + Luna Claim Extractor: structured output, exact quote validator, 오류 fallback
- PR3. Domain model 개선: jobPostingUrl/companyWebsite/employerDomain 분리, evidence schema 확장
- PR4. Web Research: decision blocker 한 개에 대한 supporting/counter evidence 검색과 citation
- PR5. Verifier: fresh context verification, INSUFFICIENT 처리, verified evidence만 core 반영
- PR6. Dossier UX 통합: 조사 진행 상태, evidence 표시, 질문 pack 완성
- PR7. Evaluation harness: 5개 JD로 시작해 20개 수준까지 확장
- PR8. Sample demo 및 QA: 모바일, 신규 브라우저, 오류/timeout, 배포 안정성 점검

각 PR은 test, typecheck, build 통과 후 다음 단계로 진행한다.

## Evaluation

본선 대비 evaluation의 목적은 AI가 그럴듯하게 말한다는 것을 보여주는 것이 아니라, 잘못된 확신을 얼마나 통제하는지 증명하는 것이다.

- Claim Precision: 공고에 없는 claim을 만들지 않는가
- Claim Recall: 중요한 claim을 놓치지 않는가
- Citation Support: source가 실제 claim을 뒷받침하는가
- Evidence Relevance: 해당 직무, 지역, 시점에 얼마나 관련 있는가
- Verifier Accuracy: human label과 stance 판정이 얼마나 일치하는가
- False Certainty Rate: 근거가 불충분한데도 확정적으로 판단한 비율
- Probe Usefulness: 사용자가 실제 면접에서 물어볼 만한 질문인가

대표 지표는 False Certainty Rate로 둔다. 핵심 철학은 '모르는 것을 아는 척하지 않는 커리어 AI'다.

## 대회 데모 시나리오

원티드의 실제 공고 URL 또는 준비된 샘플 공고를 입력한다.

Rolequiry가 5~8개의 claim을 추출하고 사용자가 가장 중요한 항목을 선택한다.

deterministic core가 가장 중요한 decision blocker를 제시한다.

'이 항목 조사하기'를 눌러 public web evidence와 counterevidence를 찾는다.

공식 자료에서는 지원되는 부분이 있지만 실제 팀의 경험은 확인할 수 없다는 식으로 tension 또는 insufficient를 보여준다.

마지막으로 Hiring Manager 또는 팀원에게 물어볼 구체적인 질문을 제시한다.

마무리 메시지는 '핏이 맞지 않는 채용은 누구의 승리도 아닙니다. Rolequiry는 회사와 지원자가 입사 전에 더 정확한 기대를 맞추도록 돕습니다.'로 통일한다. 기술 Q&A에서는 'Rolequiry는 이 회사가 좋은 회사인지 묻지 않고, 어떤 fit 조건이 아직 불확실한지 찾아낸다'고 설명한다.

## Definition of Done

- 심사자가 로그인 없이 링크를 열고 처음부터 끝까지 한 번의 role analysis를 완료할 수 있다.
- 원티드 공고 입력이 대표 경로로 동작하고 실패 시 text fallback이 있다.
- 모든 employer claim은 원문 quote 검증을 통과한다.
- 최소 하나의 decision blocker에 대해 실제 web research와 citation이 동작한다.
- Verifier가 SUPPORTS, CHALLENGES, INSUFFICIENT를 구분한다.
- verified evidence가 들어오면 기존 deterministic core가 상태와 dossier를 재계산한다.
- 샘플 데모는 외부 API 상태와 무관하게 항상 확인 가능하다.
- 핵심 테스트, typecheck, production build가 통과한다.

## 대회 제출 이후 확장 로드맵

대회판은 한 개 JD를 깊게 검증하는 경험에 집중한다. 이후 계정, interview answer history, offer due diligence, 여러 role 비교, 장기 career decision history로 확장할 수 있다. 이 확장성은 지금 전부 구현하지 않고 architecture와 roadmap으로 제시한다.

## 최종 구현 판단 기준

새 기능을 제안할 때 아래 세 질문 중 하나라도 '아니오'면 제출 전에는 구현하지 않는다.

- 사용자가 공고의 중요한 불확실성을 더 빨리 찾게 하는가?
- AI의 판단을 더 신뢰 가능하거나 검증 가능하게 만드는가?
- 원티드 심사자가 링크를 열었을 때 제품 가치를 더 빨리 이해하게 하는가?
