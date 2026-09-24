Date: 2026-09-24
Status: deployed to GitHub Pages and verified from the public URL; repository and workflow are live.

## Completed

- Public room links now target directory URLs with static `index.html` entries. The production build contains 183 approved room entries: 108 books, 56 paths, 13 themes, plus `/paths/`, `/books/`, `/themes/`, `/map/`, `/about/`, and `/design/`.
- The local Pages-like server returns HTTP 200 for known approved rooms and HTTP 404 for excluded books and unknown routes. Older extensionless room URLs redirect to their directory URL.
- The router accepts the directory trailing slash and keeps logical routes and room memory keys canonical.
- `npm run publication:verify` compares the actual exported public snapshot to the current policy projection, verifies fixed map coordinates remain unchanged, verifies every generated public cover byte, checks the hashed production snapshot asset, and checks static route inventory. It passed without printing passage text.

## Live deployment

- Public repository: `https://github.com/HenryK39B5/henrys-reading-world`
- Pages site: `https://henryk39b5.github.io/henrys-reading-world/`
- Repository visibility: public; Pages build type: workflow; HTTPS enforced.
- First deployment run `35957063590` passed: build 35s, deploy 8s.
- After updating the Actions runtime versions, second deployment run `35957434777` passed: build 31s, deploy 9s.
- Public URL Chromium smoke passed after the second deployment: hall, design, book room, topic path, map, stable highlight share and share dialog.
- Known public room URLs returned HTTP 200; excluded and unknown URLs returned HTTP 404 during the live HTTP check.
- GitHub reported a non-blocking Node 20 runtime warning for `actions/configure-pages@v5`; checkout, setup-node and upload-pages-artifact were updated to their Node 24 action versions. The deployment still succeeds.

## Verification

- `npm run check:local`: 305/305 unit tests, typecheck, lint and local validation.
- `npm run test:public`: 7/7 Chromium public tests.
- Pages-like Chromium preflight: 5/5.
- Pages-like WebKit preflight: 5/5.
- Full local Chromium E2E: 129/129.
- `npm run build`: passed.
- `npm run isolation:public`: passed.
- `npm run publication:verify`: passed.
- Public parity: 108 books, 3,462 highlights, 108 cover derivatives, 3,462 fixed map points, 183 static room entries.

## Remaining release gates

The site is deployed, but real Safari/iOS touch, screen reader behavior, browser-menu zoom, low-brightness reading, external first-visitor observation, and rights decisions remain unverified. The technical checks do not infer permission to publish the selected text or cover art. A future content withdrawal or correction requires a new approved export and deployment.
