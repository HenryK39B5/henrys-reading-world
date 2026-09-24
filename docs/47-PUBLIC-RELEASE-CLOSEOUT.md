# Public release closeout: static routes and projection parity

Date: 2026-09-24
Status: local closeout passed; no GitHub or deployment actions.

## Completed

- Public room links now target directory URLs with static `index.html` entries. The production build contains 183 approved room entries: 108 books, 56 paths, 13 themes, plus `/paths/`, `/books/`, `/themes/`, `/map/`, `/about/`, and `/design/`.
- The local Pages-like server returns HTTP 200 for known approved rooms and HTTP 404 for excluded books and unknown routes. Older extensionless room URLs redirect to their directory URL.
- The router accepts the directory trailing slash and keeps logical routes and room memory keys canonical.
- `npm run publication:verify` compares the actual exported public snapshot to the current policy projection, verifies fixed map coordinates remain unchanged, verifies every generated public cover byte, checks the hashed production snapshot asset, and checks static route inventory. It passed without printing passage text.

## Verification

- `npm run check:local`: 305/305 unit tests, typecheck, lint and local validation.
- `npm run test:public`: 7/7 Chromium public tests.
- Pages-like Chromium preflight: 5/5.
- Pages-like WebKit preflight: 5/5.
- Full local Chromium E2E: 129/129.
- `npm run build`: passed.
- `npm run isolation:public`: passed.
- Public parity: 108 books, 3,462 highlights, 108 cover derivatives, 3,462 fixed map points, 183 static room entries.

## Remaining release gates

Actual GitHub Pages delivery, HTTPS and cache behavior, real Safari/iOS touch, screen reader behavior, browser-menu zoom, low-brightness reading, external first-visitor observation, and rights decisions remain unverified. The technical checks do not infer permission to publish the selected text or cover art. Repository creation, workflow, push and deployment remain separate authorization gates.
