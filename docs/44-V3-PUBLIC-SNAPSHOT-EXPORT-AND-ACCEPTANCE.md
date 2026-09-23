# V3 Public Snapshot Export and Local Release Acceptance

Date: 2026-09-23
Status: exported locally and verified; repository and deployment actions not performed

## Export

With explicit user authorization, `npm run publication:export` generated the approved public snapshot and public cover derivatives.

- `src/data/public-snapshot.json`: public schema 3 snapshot
- `public/covers/`: 108 resized JPEG derivatives
- Map points were filtered from the existing fixed local coordinates. UMAP was not rerun and no coordinate was moved.
- The export script uses the same publication policy projection as the private reviewer and rejects missing covers, invalid policy state, invalid map references, or invalid public schema before replacing output files.
- A private metadata-only report was written to `.private/publication-export-audit.json`; it is ignored by Git and contains no passage text.

## Exported content

- 108 published books
- 3,462 published highlights
- 13 book themes
- 56 public Topic Tags
- 1,432 reviewed highlights with path vectors
- 2,030 draft highlights with no Topic Tag or path vector
- 3,462 public map points
- 56 public map labels
- 108 public cover derivatives
- 6 individually excluded highlights remain absent
- 22 excluded books remain absent

## Verification

- `npm run validate:data`: passed; public snapshot is valid.
- `npm run build`: passed. Vite emitted a 1.6 MB minified JavaScript bundle because the approved snapshot is embedded in the static public client; this is recorded as a release optimization follow-up, not a content or privacy failure.
- `npm run isolation:public`: passed. Approved public content is allowed; credentials, raw IDs, private tag production fields, review tooling and private paths are absent.
- `npm run test:public`: 6/6 Chromium tests passed for the non-empty public release.
- `npm run check:local`: 301/301 unit tests and local validation passed.
- Full local Chromium E2E: 127/128 on the first run; the only failure was a closed browser session during the responsive matrix. The isolated retry passed, and the public release suite passed 6/6.

## Remaining boundary

The public files now exist in the working tree, but no repository was created, no commit has been pushed, no workflow was added, and no deployment was performed. Safari, real-device touch, screen reader behavior, system-browser 200% zoom, low-brightness long reading, and external first-visitor observation remain unverified.

The next engineering task before any deployment is a production-oriented review of the non-empty public build, including bundle size, static hosting base path, 404 fallback, and final manual content review. Deployment remains a separate explicit authorization.
