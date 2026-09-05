# Product Requirements Document

Rolequiry Wanted Edition. 원티드 AI Championship 2026 예선 제출용.
근거: [구현안](wanted-edition-source.md), [적합성 점검](contest-fit.md), 현재 `rolequiry-wanted` 코드.

## Product Summary

Rolequiry는 입사 전에 이 역할이 나와 맞는지 확인하는 Job Fit Intelligence다. 회사를 평가하거나 점수 매기지 않는다. 공고의 기대와 공개정보에서 보이는 조건을 맞춰 보고, 잘 맞는 점, 기대 차이가 있을 수 있는 점, 입사 전에 더 확인할 점을 보여 준다.

사용자는 원티드 공고 URL이나 공고 텍스트를 넣는다. 제품은 공고 원문에서 5~8개 claim을 뽑고, 사용자가 중요도를 고르면 다음에 확인할 한 가지를 고른다. 그 조건에 대해 공개 웹 evidence와 반대 신호를 찾고, 근거가 부족하면 모른다고 표시한다. 마지막 화면은 Aligned / Potential mismatch / Critical unknown과 입사 전 확인 질문이다.

외부 문장: 공고만으로 알기 어려운 Job Fit을 입사 전에 더 정확히 확인합니다.
내부 기술: 회사가 말하는 것과 확인할 수 있는 것 사이의 간극은 그대로 찾는다. 화면에는 '검증' '역면접' '회사 평가'를 쓰지 않는다.
점수는 내지 않는다. AI가 ranking을 하지 않는다. 심사자가 로그인 없이 링크를 열고 한 번의 분석을 끝낼 수 있어야 한다.

## Target User

1. 원티드에서 공고를 보고 지원 여부를 고민하는 직장인·구직자.
2. 예선 내부 심사자와 09.21–10.05 온라인 투표자. 첫 방문, 모바일, 로그인 없음.
3. 본선 Demo Day 심사위원. 왜 이 AI가 함부로 단정하지 않는지 물을 사람.

사용자가 아닌 사람: 이력서로 자소서를 만들려는 사람, 공고에 자동 지원하려는 사람, 회사 점수를 원하는 사람.

## Core User Journey

1. 배포 링크를 연다. 로그인 없이 랜딩이 보인다. 헤드라인은 "입사 전에, 이 역할이 나와 맞는지 더 깊이 알아보세요." 주 CTA는 "공고 분석하기", 보조 CTA는 "샘플로 먼저 보기".
2. 원티드 URL, 다른 채용사이트 URL, 또는 공고 텍스트를 넣는다. URL fetch가 실패하면 같은 화면에서 텍스트 붙여넣기로 넘어간다.
3. 제품이 공고 원문 quote를 붙인 claim 5~8개를 보여 준다. 원문에 없는 문장은 목록에 없다.
4. 사용자는 본인 결정에 중요한 claim만 Low / Medium / High / Critical로 고른다. 고르지 않은 claim은 ranking에 넣지 않는다.
5. 제품이 다음 decision blocker 하나와 "이 항목 조사하기" 버튼을 보여 준다.
6. 조사 후 Evidence에 출처 URL이 붙는다. 각 항목은 지지 / 반박 / 근거 부족으로 나뉜다. 검증되지 않은 조사 결과는 화면에 있어도 결론을 바꾸지 않는다.
7. Dossier가 잘 맞는 점, 기대 차이가 있을 수 있는 점, 입사 전 확인 질문을 보여 준다. 사용자는 질문을 복사할 수 있다.
8. 샘플 경로는 1–7과 같은 화면을 외부 API 없이 즉시 보여 준다.

화면 톤은 원티드 채용 웹과 같게 간다. 흰 배경, Wanted Sans, 파란 알약 CTA, 공고 카드 그리드, 오른쪽 액션 레일. 확정 화면은 [design.md](design.md)와 concept-art 08/09.

## Epics And User Stories

### Epic 1: 첫 방문에서 문제를 이해한다

- As a 심사자 또는 투표자, I want 링크를 열자마자 이 제품이 무엇을 하는지 보고 싶다 so that WebMCP나 계정 없이 가치를 판단할 수 있다.

Acceptance criteria:

- 루트 URL은 `/case`로 바로 보내지 않는다.
- 랜딩에 문제 문장, 원티드 URL 입력, 공고 분석하기, 샘플로 먼저 보기가 있다.
- 랜딩은 원티드 홈처럼 상단 내비 + 알약 검색 + 샘플 카드 그리드다.
- WebMCP 등록 상태, tool 이름, "Open in a WebMCP browser" 문구가 메인 화면에 없다.
- 한국어가 기본이다.

### Epic 2: 공고를 넣어 case를 만든다

- As a 지원 고민 중인 사용자, I want 원티드 공고 URL이나 공고 텍스트로 분석을 시작하고 싶다 so that 내가 보고 있는 그 공고를 검증할 수 있다.
- As a 지원 고민 중인 사용자, I want 원티드 공고 URL이나 공고 텍스트로 분석을 시작하고 싶다 so that 이 역할이 나와 맞는지 입사 전에 더 정확히 볼 수 있다.

Acceptance criteria:

- 원티드 URL, 다른 http(s) 채용 URL, 공고 텍스트 입력을 받는다.
- 원티드 URL이 대표 경로로 안내된다.
- URL fetch 실패, 타임아웃, 빈 본문은 에러만 내지 않고 텍스트 붙여넣기를 연다.
- 원문에 없는 employerStatement는 case에 들어가지 않는다. 서버가 quote 포함 여부를 검사한다.
- 추출 결과는 5~8개 atomic claim이다.

### Epic 3: 내 기준으로 다음에 볼 항목을 고른다

- As a 후보자, I want 중요한 claim만 고르고 제품이 다음 조사 대상을 정하게 하고 싶다 so that AI 일반론이 아니라 내 결정 문제가 된다.

Acceptance criteria:

- 중요도는 Low, Medium, High, Critical이다.
- 우선순위를 저장하기 전에는 조사가 시작되지 않는다.
- 다음 blocker는 importance, unresolvedness, tension으로 코드가 고른다. 모델이 순위를 쓰지 않는다.
- 화면에 보이는 다음 항목은 그 선택 결과와 같다.

### Epic 4: 한 항목만 공개 웹에서 검증한다

- As a 후보자, I want 지금 막히는 한 가지에 대해 근거와 반대 근거를 보고 싶다 so that 회사 전체를 검색하지 않고도 결정을 밀 수 있다.

Acceptance criteria:

- 한 번의 조사는 선택된 decision blocker 하나에만 동작한다.
- 결과는 출처 URL과 짧은 인용을 포함한다.
- 반대 증거 탐색을 시도한다.
- Researcher와 다른 컨텍스트의 Verifier가 SUPPORTS, CHALLENGES, INSUFFICIENT를 판정한다.
- INSUFFICIENT 또는 미검증 evidence는 coverage/tension을 바꾸지 않는다.
- 같은 URL+query는 세션 안에서 다시 치지 않는다.

### Epic 5: 확인된 것과 물어볼 것을 가져간다

- As a 후보자, I want 확인된 것, 모르는 것, 면접 질문을 한 화면에서 보고 싶다 so that 다음 통화에서 무엇을 물을지 바로 쓸 수 있다.

Acceptance criteria:

- Case 화면은 Claims / Evidence / Questions를 구분해 보여 준다.
- Case 화면은 공고에서 확인되는 기대사항 / 공개정보에서 확인되는 조건과 신호 / 입사 전에 더 확인할 질문을 구분해 보여 준다.
- Case 화면은 원티드 공고 상세처럼 왼쪽 공고/claim, 오른쪽 sticky 레일에 다음 조사 CTA가 있다.
- 검증된 evidence가 들어오면 dossier가 다시 계산된다.
- 질문 목록을 복사할 수 있다.
- 제품은 입사 추천이나 100점 점수를 내지 않는다.
- 결과는 Aligned, Potential mismatch, Critical unknown으로 보여 주고 최종 판단은 사용자에게 맡긴다.

### Epic 6: 샘플이 심사 기간 동안 살아 있다

- As a 투표자, I want API가 죽어도 제품이 무엇을 하는지 보고 싶다 so that 빈 에러 화면에서 이탈하지 않는다.

Acceptance criteria:

- 샘플로 먼저 보기는 외부 fetch와 모델 호출 없이 완성된 case를 보여 준다.
- 실제 분석이 느리면 진행 상태가 보인다. 실패하면 원인과 텍스트 fallback 또는 샘플 유도가 있다.
- 모바일 375px에서 가로 스크롤 없이 핵심 CTA가 보인다.

## Edge Cases

- 원티드 URL은 열리지만 본문이 비거나 로그인 벽이다 → 텍스트 붙여넣기.
- 공고가 혜택만 나열하고 검증 가능한 문장이 거의 없다 → 가능한 claim만 보여주고, 부족하면 사용자에게 원문 추가를 요청한다. 없는 문장을 만들지 않는다.
- 사용자가 모든 claim을 비워 둔다 → 조사 버튼을 막는다. 최소 하나 중요도를 고르라고 한다.
- 공식 블로그는 공고를 지지하는데 팀 경험은 없다 → tension 또는 insufficient. 면접 질문으로 넘긴다.
- 같은 출처 URL을 두 번 넣는다 → 중복 거부.
- wanted.co.kr 공고 URL을 회사 공식 도메인으로 취급하지 않는다. companyWebsite/employerDomain이 있을 때만 employer official authority를 준다.
- 사용자가 커뮤니티 리뷰 텍스트를 붙인다 → 관련성과 stance는 분석할 수 있지만 익명 1건으로 사실을 확정하지 않는다. 자동 크롤링은 없다.
- 모델이 강한 결론을 내려고 한다 → Verifier가 INSUFFICIENT면 화면에 근거 부족으로 남는다.

## What We Are Building

- 한국어 랜딩과 JD intake.
- 원티드 URL / 기타 URL / 텍스트 ingestion과 quote 검증 claim 추출.
- 후보 중요도 설정과 기존 deterministic blocker 선택.
- 한 claim에 대한 공개 웹 조사, citation, counterevidence, verifier.
- Claims / Evidence / Questions dossier.
- API 없는 샘플 데모.
- `jobPostingUrl`, `companyWebsite`, `employerDomain` 분리.
- Hosted Luna-first. BYOK 없음. WebMCP는 메인 UX에서 숨긴 optional 경로.

## What We Would Add With More Time

- Evaluation harness와 False Certainty Rate 측정. 본선 전 P1.
- Terra escalation, evidence clustering, 결과 공유 링크.
- 5~10명 실제 사용 기록.
- 대회 이후: 계정, 면접 답변 이력, offer due diligence, 여러 role 비교.

이번 대회판에서 만들지 않는 것: 로그인/결제, resume 업로드, 자소서 생성, 자동 지원, 확장 프로그램, 회사 fit score, Blind/Glassdoor/리멤버 크롤러, 관리자 페이지.

## Submission Proof Points

심사자가 확인할 수 있어야 하는 것:

1. 로그인 없이 링크를 열고 랜딩을 이해한다.
2. 샘플 데모로 claim → 중요도 → blocker → evidence → 질문까지 본다.
3. 가능하면 실제 원티드 공고 URL로 한 번 추출한다. 실패 시 텍스트 fallback이 보인다.
4. 최소 한 blocker에서 출처가 있는 조사 결과가 나온다.
5. 근거가 부족하면 제품이 단정하지 않는다.
6. 제출 폼에 사용한 AI 툴과 역할이 적혀 있다. 추출·조사·검증은 Luna, ranking은 코드.

예선 한 줄:

- 기획력: 지원 전 공고 검증.
- 기획력: 입사 전 Job Fit, 회사 저격이 아님.
- 실현 가능성: 샘플이 항상 열리고 실제 공고는 fallback이 있다.
- 확장성: 한 JD를 깊게, 이후 비교는 로드맵.
- AI 활용: 모르는 것을 아는 척하지 않는다.

마감: 접수 2026-09-18 23:59:59, 과제 2026-09-20 23:59:59. 배포 링크는 10-05 투표 종료까지 유지한다.
