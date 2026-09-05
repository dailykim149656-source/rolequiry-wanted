# Build notes

2026-09-04

## Source

Google Doc `Rolequiry Wanted Edition 구현안`을 Drive에서 읽어 [wanted-edition-source.md](wanted-edition-source.md)로 저장했다.
원본: https://docs.google.com/document/d/1zIRuW7Hogkac7EXs1nK4g2tWLI5MgqFMdBtprQy8s2Y/edit
Drive 수정: 2026-09-04T06:18:42Z

공식 대회 페이지는 Devpost가 아니라 원티드 이벤트다.
- https://event.wanted.co.kr/ai-championship/2026
- https://static.wanted.co.kr/ai-championship/2026/landing.html
- 약관: https://help.wanted.co.kr/hc/ko/articles/61147702526617

## Decisions

- 구현안을 원티드 예선용 제품 스펙으로 채택한다. WebMCP Challenge 제출본은 코어만 남긴다.
- PRD는 사용자 행동과 합격 조건만 적는다. 모델 이름·PR 단위 구현 순서는 구현안에 두고 spec으로 넘긴다.
- 가이디드 해커톤 인터뷰는 건너뛴다. 구현안이 이미 범위·여정·비목표를 닫아 두었다.
- 현재 레포 코드는 랜딩/intake/hosted research가 없어 예선 제출 불가. P0가 제출 조건이다.

## UX

2026-09-04 사용자가 원티드형 컨셉 08/09를 채택. 페이퍼/다크/세리프 에디토리얼은 폐기.
구현 시 [design.md](design.md)가 Wanted Edition 화면의 기준이다. 루트 `DESIGN.md`는 WebMCP 도씨에 남긴다.

## Doc sync 2026-09-05

Google Doc revision 7 (2026-09-04T16:07:03Z) 반영.
기능 범위·P0/P1·PR 순서는 그대로다. 바뀐 것은 외부 프레이밍이다.

- due diligence / 회사 검증 → Job Fit Intelligence, mutual expectation alignment
- 외부 카피: 입사 전에 이 역할이 나와 맞는지
- 결과 라벨: Aligned / Potential mismatch / Critical unknown. Fit Score 없음
- 화면 08/09 카피도 같이 바꿈. 원티드형 레이아웃은 유지

## Fit

자세한 표는 [contest-fit.md](contest-fit.md). 한 줄: 방향은 맞고, 지금 화면은 원티드용이 아니다.

## Deepening rounds

0. 사용자가 구현안 문서로 범위를 이미 확정했다.
