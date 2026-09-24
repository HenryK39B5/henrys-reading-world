# M-04: what contours mean in the Reading World

Status: discussion draft. No contour or map change has been approved for production.

## Reference: flomo's cognitive map

flomo's own [cognitive-map explanation](https://help.flomoapp.com/advance/cognitive-map.html) describes automatically emerging peaks from the similarity of a person's notes. It says tighter contours indicate more notes around a topic and broad contours indicate relationships across topics; it distinguishes emergent peaks from manually assigned tags. Its examples also use time slices to revisit how a person's notes accumulated. These are flomo's product interpretations, not a published specification for its contour algorithm. The local 2D/3D screenshots in `.private/reference/visual-references/` show multiple nested rings, localized peaks and visible transitions between them; they are design references, not assets to copy.

## What our current field actually measures

- The public map contains 3,462 fixed positions, each representing one approved real highlight. The 2D coordinates come from the existing embedding/UMAP layout and do not change in this comparison.
- `buildDensity` adds a Gaussian contribution from every public point to a 64 x 40 grid, then square-root-normalizes the values against the maximum into 0–255. The current three contour levels are 48, 96 and 160. The candidate only interpolates the crossings and joins paths more smoothly on this **same field**.
- Book count is not normalized: a book with many public highlights can contribute more terrain. The point field is also a lossy 2D projection. Tag labels are computed separately from the medians of reviewed member positions; a ridge is not the outline of one tag, and an unlabeled ridge is still possible.
- The public filter affects which points contribute to the density; it does not move retained points or rerun UMAP. The map is a fixed snapshot rather than a time-lapse of thought.

**Defensible visitor meaning:** a contour is a line of equal *local public-highlight density on this particular 2D projection*. Nested lines reveal concentrations and gaps worth exploring. They do not measure Henry's preference, conviction, quality, breadth of reading, semantic certainty, or the importance of a book. They are soft exploration cues, not borders between concepts. A large hill may be mostly one book; the field alone cannot prove cross-book resonance.

## Product questions before drawing more lines

1. What should a visitor gain: noticing where many highlights sit, finding an unexpected unlabeled cluster, or seeing where *different books* meet? The first is supported by today's field. The last requires a separately defined and audited multi-book measure; it cannot be inferred from prettier isolines.
2. Should a contour do anything when touched? A possible future interaction is to focus that area and expose nearby **real** highlights through the existing map lists, with book diversity checked and the area described as a density cluster, never an invented topic. Do not make a closed line act like a named tag or a hard selection boundary.
3. How much visual emphasis is justified? More rings and local contrast could make the terrain readable, but the surrounding points, selected highlight, labels, touch targets and text must remain primary. Stronger contour geometry cannot repair misleading semantics.

## Same-point comparison sequence

- **A | Current:** three faint, midpoint marching-squares levels. It stays quiet but looks angular and its large merged landform gives little information about individual peaks.
- **B | Smooth only:** offline `d3-contour` interpolation on the identical field and three thresholds, captured in `.private/review/maintenance/m04/`. Curves are less grid-like; the overall shape and usefulness change little. This is a shape candidate, not a completed terrain concept.
- **C | Localized density relief (proposal only):** retain the public points and density field, calibrate a few additional isolines around actual peaks and vary line/fill emphasis gently by level. Compare world and region views on 1440/390/320px, including an unlabeled concentration and a one-book-heavy area. No apparent cliff, coastline or categorical boundary should be implied. Before implementing, choose thresholds from the real field and inspect which book(s) make each emphasized peak.
- **D | Cross-book encounter layer (separate future hypothesis):** if the intended meaning is meeting across books, first define a capped/per-book spatial measure, audit representative regions and decide whether it deserves its own optional view. Do not silently replace the raw-density legend with this different statistic.

Acceptance questions for C: can a visitor locate a concentration that A obscures; can they reach real nearby highlights without guessing what the line means; do the contours stay subordinate to points and labels on mobile; do prominent hills have a truthful explanation when inspected? Keep A or B until such evidence exists. No 3D, new embedding, changed coordinates, extra public data, or deployment is authorized by this study.
