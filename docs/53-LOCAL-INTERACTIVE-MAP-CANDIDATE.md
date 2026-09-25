# M-04: local interactive map candidate

Date: 2026-09-25. Status: local visual and interaction gate; the published map is unchanged.

## Open the candidate

1. Run `npm run map:terrain:study` to regenerate the ignored fixed-point density artifact from the approved public snapshot.
2. Run `npm run dev:map:study`, then visit `http://127.0.0.1:5176/map` (or the port shown by Vite). This is a loopback-only, public-snapshot study mode. Ordinary `npm run dev`, `npm run dev:local` and public builds retain the existing map. The study endpoint serves only the public-point-derived density, contours and bands; it refuses an artifact whose source version or points hash differs from the approved snapshot.

## Visual composition

The world and tag-region map use the unchanged 3,462 approved point coordinates and 56 topic labels, a precomputed 128 x 80 density grid, seven interpolated equal-density contours, small crosses at 1,000-coordinate intersections, WebGL2 continuous shading and **28% of the subdued isoband treatment** behind the existing Canvas points and labels. The raster density cells and continuous coordinate grid are absent in this mode. Color is a restrained intensity scale, not a tag classification or a statement of semantic certainty. When WebGL2 is absent, shader compilation fails or the context is lost, the local candidate switches to full-strength Canvas2D isobands; the published map does not acquire a WebGL dependency. Bands remain beneath dots and labels. Contour-hover highlighting is deferred until the main terrain and point-selection gate.

## Point interaction

- At world scale with no book or topic selected, tapping near a real point below the selection zoom animates a factor-1.8 zoom around the tap, capped at the existing 8x limit. The start thresholds are 3x for canvases at least 520px wide and 4x below 520px. Programmatic zoom lasts 210ms with ease-out; reduced motion skips the transition. Wheel, drag and pinch retain direct manipulation; a tap does not navigate while zooming. Topic-label clicks still win over points.
- Above the threshold, a point hit within 6 screen pixels opens the existing stable-ID detail immediately only if no other point lies within 8 pixels of it. If the tap is farther out (up to the 13px hit limit) or nearby points overlap, first tap shows a warm outline and a short excerpt in the existing map readout; tapping the same point again opens detail. Empty taps clear the pending selection. Pan/zoom clears it; book- and topic-filtered point selection remains as before. No new modal, DOM-per-point button or fabricated nearest-highlight description was added.
- Exact overlapping coordinates can still be impossible to distinguish by tapping. The existing topic, book and reading-list routes remain the honest alternate path; the study does not claim to make every point separately touchable. The density line is not a tag boundary or a click target.

## Verification and open gate

Evidence: `.private/review/maintenance/m04/interactive/` holds world/region 1440/390/320px screenshots, a 390px overlapping-point preview, a 320px forced-no-WebGL fallback and a 720px context-loss fallback. `npm run check:local` passed 316/316; `npm run build`, `npm run isolation:public` and `npm run publication:verify` passed. `npm run test:map:interactive` passed 7/7 Chromium, covering anchored zoom, isolated arrival and return focus, overlap preview/confirmation, pan/zoom repaint, no-WebGL fallback, context-loss fallback, 200%-equivalent width, emulated touch input, keyboard/list navigation and reduced motion. Existing local map and label-stability Chromium tests passed 15/15 after using a dedicated local-mode port. An initial run had 9/15 failures because the default configuration reused an already running **public-mode** server on 5173, yielding 3,462 instead of the local 4,663 highlights; `RW_E2E_PORT=5188` forced a separate local-mode server for the clean run. Neither failure nor recovery is omitted.

Not yet accepted: Henry's actual visual and tactile evaluation, real iOS/Safari/Android fallback, low-powered pan/zoom frame timing, browser-menu 200% zoom and screen-reader inspection. The build JS/CSS hash changed slightly due to candidate-gated code and CSS, but public map appearance, public snapshot, point coordinates and runtime data source have not changed; there was no push or deployment. A production renderer decision waits on the above gate.
