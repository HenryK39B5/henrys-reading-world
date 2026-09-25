# M-04: map surface, grid and continuous density comparison

Date: 2026-09-25. This is an isolated visual study, not a production map change.

## Reference and question

The local flomo interface image (`.private/reference/visual-references/flomo-map-2d.png`) has widely spaced cross-shaped coordinate marks, rather than a continuous background grid. The local sharing poster (`flomo-starmap.png`) uses a very faint continuous grid in a framed, static composition. These are distinct viewing contexts. We can borrow their visual hierarchy without borrowing the map layout, meaning or assets: real highlights and readable topic names first, equal-density contours second, coordinates last. A cross denotes a fixed map-coordinate intersection, **not** a density sample, highlight, category or interactive target.

The existing map has two independent sources of a grid-like texture: the very faint coordinate lines every 1,000 map units in `MapCanvas`, and individual translucent density cell rectangles. Changing only the coordinate stroke leaves cell seams visible, especially at 128 x 80. This comparison suppresses both in a browser-only hook and adds a continuous underlay behind the unchanged Canvas points, labels and contours.

## Matched captures

`npm run test:map:surface` intercepts the local Pages-style public JSON only in the test browser. All variants share the 3,462 approved public point positions, 56 labels, 128 x 80 density field, seven contour levels, camera and real page chrome. Screenshot matrix: six treatments x world/tag-040 region x 1440/390/320px = 36 PNGs in `.private/review/maintenance/m04/surface/`:

| Prefix | Coordinate layer | Density surface |
| --- | --- | --- |
| `current-` | existing 1,000-unit lines | current per-cell fills (128 x 80 study field) |
| `crosses-bands-` | small crosses at the same 1,000-unit intersections | precomputed, subdued filled isobands |
| `crosses-smooth-` | same crosses | test-only Canvas2D bilinear interpolation |
| `crosses-webgl-` | same crosses | test-only WebGL2 shader, with the existing non-premultiplied-alpha fix |
| `quiet-grid-bands-` | very faint lines at 500-unit intervals | same filled isobands |
| `blank-bands-` | no coordinate marks | same filled isobands (control) |

The first three non-current variants compare surface interpolation without changing the reference field or contours. The `quiet-grid` option represents a *possible* share composition, not a plan to turn the interactive map into a poster. Crosses remain in map space and grow farther apart when zoomed, as coordinate intersections should; they are intentionally faint at 320px. The band opacity was lowered after the first region capture looked too much like a solid territory. No contour is presented as a tag boundary.

## Visual readout and limits

- At world scale, removing cell rectangles clears the fine checker texture. The low-key crosses give the empty surround a little orientation without competing much with labels or contours. With no marks, the map is clean but loses that cartographic cue.
- Subdued isobands make the wider ridges easier to follow; continuous shading stays softer. Both still express **2D local highlight density**, not categories or certainty. At region scale the bands can read as a single island if intensified, so further opacity increases require care.
- The share-like fine grid is noticeable on desktop and barely distinguishable on narrow screenshots. It adds regular lines under real points. A static, carefully framed share export could tolerate this; the live map does not appear to need it.
- The Canvas2D and WebGL2 continuous captures look close at these scales. This is a visual comparison, **not** a GPU performance or production-compatibility result. The isolated WebGL probe does not implement context loss, fallback, resize/repaint across pan or reduced-motion behavior.

The test checks source hashes, map visibility, that both original grid strokes and per-cell fills were actually replaced, nonempty underlay pixels and no page-width overflow. It does not test real touch, WebKit/Safari, 200% zoom, paint timing, keyboard flows, label collisions while dragging or a dedicated share-card export. Screenshot pixels alone cannot show whether a visitor recognizes local density correctly.

## Working choice for the next gate

For the **interactive** map, compare `crosses-bands` and `crosses-webgl` in a reversible product candidate with the existing map retained as the baseline. Keep the 128 x 80 field and fixed positions. It is still premature to choose a GPU renderer: a precomputed isoband path with existing Canvas may give a comparable result without WebGL fallback costs. If building a **share image**, test the faint coordinate grid in that separate fixed canvas, not as an always-on interactive backdrop. No approved product style, public snapshot, deployment or UMAP was changed here.
