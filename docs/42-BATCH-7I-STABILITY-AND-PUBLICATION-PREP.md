# V3 7I Stability and Publication Preparation

Date: 2026-09-23
Status: verified for local Chromium and public-empty isolation

## Scope

7I froze the current V3 visual baseline and checked product integrity around loading, empty data, invalid routes, missing selections, stable sharing, navigation recovery, and public isolation. No direction-level visual changes were made, and no real snapshot, map coordinates, tags, covers, or publication scope were changed.

## Added audit coverage

- `e2e/audit-7i.spec.ts`
  - local snapshot HTTP failure renders the honest loading error and keeps navigation usable;
  - unknown routes and unknown map selections remain escapable and do not overflow;
  - query noise is removed from a valid book route;
  - a real highlight share route preserves the full passage, stable highlight ID, copy result, and focus return.
- `playwright.audit-7i.config.ts`
  - dedicated local Chromium configuration for the 7I matrix.
- `playwright.config.ts`
  - includes the 7I audit in the normal test discovery list.

## Actual results

- `npx playwright test --config playwright.audit-7i.config.ts --workers=1`: 3 passed.
- `npm run check:local`: typecheck, lint, 300/300 unit tests, and local snapshot validation passed.
- `npx playwright test --workers=1 --reporter=dot`: 128/128 passed.
- `npm run build`: passed with the empty public snapshot.
- `npm run isolation:public`: clean; no private review, tag, embedding, credential, or real content leakage.
- `npm run test:public`: 1/1 passed; all public routes remain honest empty or unavailable states.

The first full E2E attempt lost the manually running Vite process after 93 tests and produced connection-refused failures. After restarting the local server, the complete 128-test run passed. This was recorded as test-environment instability, not a product failure.

## Release boundary

The public snapshot remains empty. Public export, public covers, repository creation, push, workflow, and deployment remain separately gated. Safari, real-device touch, screen readers, system-browser 200% zoom, low-brightness long reading, and first-visitor observation remain unverified.

## Decision

7I local stability is verified. The next decision is the publication-content and rights Gate, not another visual redesign. Batch 7B/7C remains paused until that Gate or a concrete product blocker changes the priority.
