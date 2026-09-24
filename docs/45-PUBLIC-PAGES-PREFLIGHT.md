# Public Pages production preflight (local only)

Date: 2026-09-24
Status: local production-build preflight passed; no repository, workflow, push or deployment actions.

## Scope and changes

- Production Vite base is the previously agreed project-site path `/henrys-reading-world/` (`docs/17`); local dev remains `/`.
- `sitePath()` prefixes rendered internal anchors; the router strips that prefix on load and when intercepting links, while push/replace writes the prefixed URL. Public cover URLs and copied share URLs also use the production base.
- Production build emits `dist/404.html` as a copy of the built entry. GitHub Pages can serve this entry on a direct room URL while preserving the browser's URL; the document response is still **HTTP 404**, not HTTP 200. This is not a claim that live Pages has been tested, nor does it solve crawler/social-card behavior for deep links.
- The approved `public-snapshot.json` now builds as a fingerprinted standalone asset fetched at runtime. Public HTTP failures display an honest error; no placeholder excerpts appear. This change improves code caching, not total first-load data transfer.
- Added local-only `scripts/preview-pages.ts`, which serves only `dist/` under the project prefix and returns `404.html` with status 404 for nonexistent paths. `e2e/pages-preflight.spec.ts` checks build output rather than the Vite dev server.

## Evidence and commands

- `npm run check:local`: 304/304 unit tests, typecheck, lint and local data validation passed.
- `npm run build`: passed; public data validation reported the existing two coverage warnings (2,030 unreviewed tags and no original line breaks).
- `npm run isolation:public`: passed, including the separate JSON asset and 108 public covers.
- `npm run test:public`: 6/6 Chromium public-dev tests passed.
- `npx playwright test --config playwright.pages.config.ts`: 4/4 Chromium built-site tests passed: hall/navigation/cover/share URL, direct book/map/unknown 404 fallback, unavailable JSON asset, and mobile path navigation.
- `npx playwright test --config playwright.config.ts --workers=1`: 128/128 local Chromium E2E tests passed.
- Real Chromium screenshots with reduced-motion capture are ignored local files: `.private/review/public-pages-preflight/hall-desktop.png` and `path-mobile.png`. Both show readable complete passages and routes at desktop/mobile widths.

## Bundle

Before: single application JS ≈ 1,616 kB raw / 583 kB gzip, including public data.
After: JS ≈ 321 kB raw / 98 kB gzip; public JSON ≈ 1,998 kB raw / 518 kB gzip. The JSON is now independently cached, but the total first visit remains substantial. No real-network performance claim was made.

## Remaining release gates

- Actual GitHub Pages delivery, HTTPS/cache headers, 404 handling, and the final live manual content check remain unverified. A deep-link document using `404.html` has HTTP 404 status, which can matter for crawlers and link previews.
- Safari, real-device touch, assistive screen reader, browser-menu 200% zoom, low-brightness reading and outside first-visitor observation remain open.
- Copyright/cover rights are not established by source disclosure or by these technical checks.
- Repo creation, workflow, push and deployment remain subject to separate authorization. No such actions were taken here.
