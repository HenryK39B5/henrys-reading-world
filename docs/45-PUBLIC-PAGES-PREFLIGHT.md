# Public Pages production preflight (local only)

Date: 2026-09-24
Status: local production-build preflight and public projection parity passed; no repository, workflow, push or deployment actions.

- Production Vite base is the previously agreed project-site path `/henrys-reading-world/` (`docs/17`); local dev remains `/`.
- Public room links now use directory URLs (`/books/<approved-id>/`, `/paths/<public-tag>/`, `/themes/<public-theme>/`, `/map/`, `/about/`, `/design/`). The build emits matching `index.html` entries for 183 approved room paths, so known public rooms return HTTP 200 in the local Pages-like server. Unknown paths and excluded books continue to return the 404 fallback.
- `sitePath()` prefixes rendered internal anchors; the router strips the project prefix and trailing directory slash on load and when intercepting links, while push/replace writes the prefixed URL. Public cover URLs and copied share URLs also use the production base.
- Production build emits `dist/404.html` as a copy of the built entry. It remains an honest fallback for unknown paths; GitHub Pages can serve it while preserving the browser URL, but its response is HTTP 404. This is not a claim that live Pages has been tested, nor does it solve crawler/social-card behavior for unknown or deep links without a static entry.
- The approved `public-snapshot.json` builds as a fingerprinted standalone asset fetched at runtime. Public HTTP failures display an honest error; no placeholder excerpts appear.
- Added read-only `npm run publication:verify`, which compares the exported public snapshot, policy projection, fixed map coordinates, cover derivatives, production JSON asset and static route inventory without printing passage text.

## Evidence and commands

- `npm run check:local`: 305/305 unit tests, typecheck, lint and local data validation passed.
- `npm run build`: passed; public data validation reported the existing two coverage warnings (2,030 unreviewed tags and no original line breaks).
- `npm run isolation:public`: passed, including the separate JSON asset, 108 covers and 183 static route entries.
- `npm run publication:verify`: passed. The exported snapshot matches the approved projection; fixed map coordinates, resized cover bytes, production JSON asset and static route inventory all match.
- `npm run test:public`: 7/7 Chromium public tests passed.
- `npx playwright test --config playwright.pages.config.ts --project=chromium`: 5/5 built-site tests passed with public room HTTP 200 and unknown/excluded routes HTTP 404.
- `npx playwright test --config playwright.pages.config.ts --project=webkit`: 5/5 WebKit tests passed. This is a Playwright WebKit check, not real Safari or a real iOS device.
- `npx playwright test --config playwright.config.ts --workers=1`: 129/129 local Chromium E2E tests passed.
- Real Chromium screenshots with reduced-motion capture are ignored local files: `.private/review/public-pages-preflight/hall-desktop.png` and `path-mobile.png`; design-page captures are under `.private/review/site-design/`. The inspected desktop/mobile captures show readable complete text and no horizontal overflow.

## Bundle

Before: single application JS ≈ 1,616 kB raw / 583 kB gzip, including public data.
After: JS ≈ 321 kB raw / 98 kB gzip; public JSON ≈ 1,998 kB raw / 518 kB gzip. The JSON is now independently cached, but the total first visit remains substantial. No real-network performance claim was made.

## Remaining release gates

- Actual GitHub Pages delivery, HTTPS/cache headers, live redirect behavior, and the final live manual content check remain unverified. Known public rooms now have static 200 entry documents; unknown paths still use `404.html` with HTTP 404.
- Safari, real-device touch, assistive screen reader, browser-menu 200% zoom, low-brightness reading and outside first-visitor observation remain open.
- Copyright/cover rights are not established by source disclosure or by these technical checks.
- Repo creation, workflow, push and deployment remain subject to separate authorization. No such actions were taken here.
