# M-04: density resolution and 2D rendering study

Date: 2026-09-25. All output is local-only; no public map or release changed.

## Question

Can we make highlight concentrations easier to read without pretending that a denser grid adds semantic information? Henry allows broad offline experimentation, including new local embeddings and separately evaluated layouts; 3D terrain remains paused. No alternate layout is approved for publication.

## Controlled comparison

`npm run map:terrain:study` uses the **approved public map's 3,462 fixed points**. `densityAtResolution` reproduces the published 64 x 40 Gaussian field exactly, then samples at 128 x 80 and 256 x 160 while keeping the original smoothing width in map coordinates and normalizing all three against the same original peak. Seven interpolated levels (48, 96, 136, 160, 184, 208, 232) have the same density meaning in all three fields. It writes only `.private/review/maintenance/m04/resolution/field-comparison.json`; the public snapshot and product renderer are unchanged. The 128 x 80 field is about 34 KB as JSON, 256 x 160 about 135 KB; contour segments rise from about 1,005 to 1,967 and 3,710 respectively. These are uncompressed study numbers, not a measured production transfer or runtime budget.

`npm run test:terrain:study` intercepts the built public JSON in a local Pages-like Chromium session and renders all three fields at the same world and tag-040 region views at 1440, 390 and 320 pixels. It checks source, points and labels hashes, full baseline field equality, visible map content, and nonblank Canvas pixels. The paired captures are `64x40-`, `128x80-`, `256x160-` world/region screenshots under `.private/review/maintenance/m04/resolution/`.

Visual inspection: 128 x 80 softens visible grid steps without changing the broad map shape; 256 x 160 is smoother still, but the gain over 128 x 80 is small and the very fine grid can read as texture behind points. The map still reflects the original 2D projection and smoothing bandwidth, not higher confidence in semantic neighbours. **128 x 80 is the better next comparison baseline**, not an approved production replacement.

## Rendering probes, not product modes

The same 128 x 80 field was rendered as subtle precomputed filled contour polygons (`bands-world-*`) and as a WebGL2 interpolated field underlay (`webgl-world-*`), each behind the real Canvas points and labels at 1440/390/320px. The first WebGL capture was an overbright compositing error; changing the test-only context to non-premultiplied alpha fixed it and a second capture was inspected. The WebGL test checks nonblank GPU pixels and maximum alpha; both methods change background luminance subtly. On the 390px image, mean RGB-channel difference from the 128 x 80 line-only screenshot was about 2.9 for bands and 4.0 for WebGL. This is not a perceptual quality score. Neither probe yet has region/mobile-device interaction, WebKit, context-loss/fallback, keyboard, 200% zoom or render-time acceptance. WebGL is **not justified for production** solely by these screenshots. No new dependency was installed; `d3-contour` was already dev-only.

OffscreenCanvas/Worker is a performance option, not a visual precision technique. Defer it until repeated pan/zoom measurements on lower-powered devices show main-thread contention. Continue experimenting with static band intensity and legibility before adding a runtime renderer.

## Embedding and layout as a separate experiment

The existing local 1,024-dimensional vector cache is present and the production map is built with a fixed-seed UMAP after a 96-dimensional map-only projection. Simply regenerating the **same model's** cache does not by itself solve a coarse density grid. If future samples show actual neighbour or topology failures, evaluate an isolated local model or UMAP parameter variant in `.private/` with original layout kept as baseline; compare high-dimensional nearest neighbours, book/tag diversity around sample peaks, stability under seed changes, and actual book/highlight navigation before judging appearance. Do not invoke any remote embedding provider without separate explicit permission, and do not overwrite the public snapshot, approved coordinates, or existing local layout in an exploratory run. Publication remains a separate decision.

## Verification and next gate

`npm run check:local` 312/312, `npm run build`, `npm run isolation:public`, `npm run publication:verify`, `npm run map:terrain:study`, and `npm run test:terrain:study` 2/2 Chromium passed. These prove artifact parity and isolated rendering, not visual acceptance on phones. Next: compare 128 x 80 line-only vs gentle bands across representative world/region/long-label views and collect a small real-visitor readout of where they think clusters are. Only then consider a reversible product implementation with unchanged points. 3D stays paused; no push or deployment was performed.
