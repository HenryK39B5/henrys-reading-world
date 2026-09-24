# M-04: fixed-point contour comparison

Date: 2026-09-24
Status: candidate captured locally; visual selection pending Henry. No map replacement or deployment.

## Scope

The published public snapshot remains the source for both versions: 3,462 fixed highlight positions, the same 64 x 40 density grid, the same three thresholds (48 / 96 / 160), and the same label placements and Canvas styling. This comparison does not recompute embeddings, run UMAP, rename tags, modify the publication policy, or edit `src/data/public-snapshot.json`.

- Current: `scripts/embeddings/mapLayout.ts` midpoint marching-squares segments; 203 / 194 / 212 segments by level.
- Candidate: offline `d3-contour@4.0.2` marching squares on the existing grid, with linear edge interpolation and polygon-ring topology; 194 / 182 / 202 segments by level. The comparison converts those rings back to the existing Canvas segment format. Artificial segments on the grid's outer border are excluded, because the threshold field reaches the border but the border is not an isoline.
- `@types/d3-contour@3.0.6` supplies TypeScript declarations. Both dependencies are dev-only; the shipped Canvas still uses the current precomputed contour data, and the production JS asset hash stayed unchanged.

## Local comparison

Run `npm run build`, then `npm run map:contours:compare` and `npm run test:contours:compare`. The generator writes only a metadata-and-contours JSON under Git-ignored `.private/review/maintenance/m04/`; the Pages-like Chromium test intercepts the public JSON request in memory for its candidate screenshots. It verifies the source version, point hash and density hash against the actual approved public snapshot before capturing. The eight PNGs in that directory pair `current-` and `interpolated-` for `world` and `region`, each at 1440 and 390 pixels. They contain approved public content but remain local reference material.

Screenshots were inspected. The candidate reduces the grid-like corners and reads as a quieter continuous surface, but still has only three subdued contour levels; it does not reproduce flomo's denser illuminated mountain styling. The 2D flomo interface and 3D screenshot remain in ignored `.private/reference/visual-references/` as visual references, not production assets. The candidate keeps the same density field, so it should not be described as an improved semantic model.

## Checks and decision

- `npm run check:local`: 309/309 unit tests, typecheck, lint and local validation passed.
- `npm run build`, `npm run isolation:public` and `npm run publication:verify`: passed; production asset and fixed point projection unchanged.
- `npm run test:contours:compare`: 1/1 Chromium on the Pages-like built site; geometric unit check uses the real approved density field and confirms bounded segments with no frame-border edges.
- Decision needed: keep the current graphic, select the interpolated candidate for a separately reviewed production change, or request another same-point visual variant. No screenshot or candidate contour JSON was committed or deployed.
