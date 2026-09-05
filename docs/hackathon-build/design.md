# Wanted Edition Visual Contract

Locked 2026-09-04. Canonical screens:

- [08-wanted-landing.html](concept-art/08-wanted-landing.html)
- [09-wanted-case.html](concept-art/09-wanted-case.html)

Reference captured from wanted.co.kr home, `/wdlist/518`, and `/wd/378492`. Copy the layout language, not the brand.

## Decision

Wanted Edition looks like a Korean job product a 원티드 user already knows how to use. White canvas, Wanted Sans, 50px nav, pill search, 4-column cards, sticky right rail, blue primary CTA.

Rejected: paper dossier, night casefile, serif editorial, fake browser chrome, WebMCP status pills.

Do not use the Wanted wordmark, bookmark hearts, or 합격보상금.

## Color

- Canvas / surface: `#ffffff`
- Ink: `#171717`
- Secondary: `#333333`
- Muted: `#666666`
- Faint: `#999999`
- Line: `#ececec`
- Control border: `#e1e2e4`
- Chip: `#f2f4f7`
- Brand / primary: `#3366ff`
- Company mark fallback: dark ink blocks, not photos

Status still needs a text label. Blue is for action, not for “AI”.

Keep existing semantic meaning if color is needed later: supported green, tension red, insufficient gray. Do not invent a 100-point meter.

## Type

- UI: `Wanted Sans Variable`, then Pretendard, then system sans.
- Weight: 600–800 for titles and CTAs, 400–600 for body.
- Landing H1: 36px, tight tracking.
- Case title: 22px.
- Section: 18px.
- Meta: 12–13px, `#999`.

No display serif on Wanted Edition screens.

## Layout

- Content width 1060px, centered.
- Nav height 50px, bottom hairline.
- Landing: headline, one-line lede, pill URL field, blue analyze button, text link for sample, then a 4-column sample grid.
- Case: left column is the posting, right column is a sticky 340px action rail.
- Case header: 56px rounded company mark + role title + company + location/career line.
- Claims and evidence are quote rows with a top hairline, not rounded analytics cards.

## Components

- Primary CTA: 44–48px, fully rounded, `#3366ff`, white 700–800 text. Landing: 공고 분석하기. Case: 이 항목 조사하기.
- Secondary: white pill with `#e1e2e4` border. 면접 질문 복사, 다른 공고 분석, 샘플.
- Search field: 32px-radius pill, inner blue button.
- Sample cards: 16px radius, 1px line, color-block monogram thumb, title / company / location.
- Count chips: gray pills, 확인됨 / 긴장 / 아직 모름.
- Count chips: gray pills, 잘 맞음 / 기대 차이 / 더 확인
- Right rail: bordered 16px card, sticky. Title is the next blocker, not “지원하기”.

## Copy on screen

- H1: 입사 전에, 이 역할이 나와 맞는지 더 깊이 알아보세요.
- Lede: 원티드 채용공고 URL을 붙여넣으세요. Rolequiry가 공고와 공개정보를 함께 살펴보고 잘 맞는 점, 더 확인할 점, 면접에서 물어볼 점을 정리합니다.
- Sample link: 샘플로 먼저 보기
- Case sections: 공고에서 확인되는 기대사항 / 공개정보에서 확인되는 조건과 신호
- Rail title: 다음으로 확인할 항목

Korean is the default. Login chrome on the landing is visual only; the product stays usable without an account.

## Do not ship

- WebMCP live/failed badges
- Agent tool names
- Fit scores
- Wanted logo or “공식 원티드” framing
- Bookmark / heart on sample cards
- Decorative mountains, robots, glassmorphism

Existing `DESIGN.md` remains the WebMCP dossier contract. This file wins for Wanted Edition UI.
