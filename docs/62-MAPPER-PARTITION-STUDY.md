# R4-C: fixed-count local clustering preregistration

Date: 2026-09-26. Status: R4-C numerical baseline complete; no public map or product integration.

R4-A distance components fragmented into singletons; R4-B mutual-kNN components percolated into giant nodes. Test whether an existing deterministic spherical k-means clusterer produces *reviewable* intermediate nodes inside the same PCA lens cover. This is a forced partition, not evidence that natural clusters exist. No tuning after inspecting outcomes.

Input: the unchanged public 3,462 highlights (108 books) and text-hash-checked local 1,024-dimensional BGE cache. Use PC1/PC2 scores from the R4-A artifact only if its snapshot and embedding hashes match the current files; this avoids recomputing PCA and keeps the lens identical. In each lens use 8 intervals with 50% overlap; cluster original normalized 1,024-dimensional vectors with existing `sphericalKMeans` (6 iterations, deterministic farthest-first initialization). Set cluster count in each interval to `ceil(interval size / targetSize)`; target sizes 32 and 64. Four fixed configurations: PC1/PC2 x 32/64. Discard clusters smaller than 4 and count unique excluded IDs; record oversize (>128) and book concentration. Edges require actual shared highlight IDs, not just tag overlap. Do not use tags or books in fitting.

Metrics: all nodes and edges, size distribution, covered/dropped unique IDs, book count and largest-book share per node; for each fixed R2 case (`h-3501`, `h-898`, `h-2288`, `h-4504`, `h-1754`), record its nodes. Across the two target scales for each lens, compare each smaller-scale node to its best larger-scale counterpart by member Jaccard, including zero matches. This is *descriptive* and not an independent stability test. Review packet will include real passage text for fixed cases, largest node, smallest surviving node, and lowest-mean-similarity node per configuration; preserve counterexamples. Output stays under `.private/research/map/mapper-partition/`. Never infer semantic accuracy from group size, cross-book share or model similarity.

Validation: unit tests for cover boundaries, deterministic membership, discarded members, exact edge intersections, and scale matching; run full tests, typecheck, lint, public build/isolation/parity, numeric reproducibility. Browser screenshots only if original text and size checks justify a local observer. No remote embedding, upload, public export, push or deploy.

## Results and counterexamples

Same snapshot/cache hashes as R4-A; the full R4-A lens artifact was hash-checked (`be90934e8820617c4b63f1ec9a5c4e004b83d83cff1ecbcef4b5050a778dd0b0`). Four fixed runs:

| Lens / target | Nodes | Edges | Unique covered | Median/max size | >128 | Median largest-book share |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| PC1 / 32 | 212 | 1052 | 3460 | 26.5 / 128 | 0 | .295 |
| PC1 / 64 | 109 | 555 | 3462 | 57 / 175 | 7 | .250 |
| PC2 / 32 | 203 | 995 | 3459 | 24 / 147 | 1 | .278 |
| PC2 / 64 | 107 | 554 | 3462 | 55 / 291 | 10 | .247 |

Size is a target, not a cap. All but two PC2/32 nodes span more than one book; that is descriptive, not semantic validation. PC1/32 leaves 2 unique highlights uncovered and PC2/32 leaves 3; the 64-size runs cover all. The median best node-member Jaccard for target 32 against target 64 is only `.233` (PC1, 185/212 below .5) and `.224` (PC2, 184/203 below .5). Different target scales do **not** yet give stable named communities. The 1052/995 edges at target 32 are literal shared highlight IDs produced by overlapping covers, not evidence of 1000 meaningful transitions.

Original-text packet in `.private/research/map/mapper-partition/review.json` includes the five preselected cases, largest/smallest/least-cohesive nodes for each run, with closest and farthest centroid members. `h-3501` (wealth/fear) appears in two PC2/64 groups: one also contains a passage about monetary institutions and another about financial autonomy and paid leave. This is a broad financial neighborhood, not a coherent fear group. For PC2/32 a four-member node pairs a passage about researching investment after dinner with fictional dialogue about preparing for a fire after dinner: shared wording is not shared topic. Least-cohesive PC1/32 pair includes a dreamlike image and a sentence about not winding a clock on Sunday; least-cohesive PC2/64 pair mixes a burning-cigarette metaphor with a baseball/grass metaphor. These are sampled counterexamples, not a blinded independent review. `h-4504` and `h-1754` also land in large, different book mixtures, so no claim of a newly discovered unitary class theme.

R4-C establishes a *size-feasible* middle ground compared with R4-A singletons and R4-B giant connected components, but does not establish semantic coherence or scale stability. Spherical k-means necessarily partitions even weakly related sentences. No product candidate, public topology, new label or algorithm winner is selected. Next step should test local semantic coherence against a fixed book-controlled/random baseline and independently review selected real passages; changing node count alone is no longer the research bottleneck.

## Verification

`node scripts/research/study-mapper-partition.ts` twice (reports byte-equivalent after removing generatedAt/runtime); hash and comparison saved in `.private/research/map/mapper-partition/reproducibility.json`. `npx vitest run tests/mapper-partition.test.ts` 4/4; full `npm run test` 47 files/357 tests; `npm run typecheck`, `npm run lint`, `npm run build`, `npm run isolation:public`, `npm run publication:verify` passed. Run about 86 seconds; maxRSS 1,034,676 KiB. No browser prototype or human semantic review; true device and rights gates untouched. No remote request, export, push or deployment. Production hashed assets remain unchanged.

Method reference: KeplerMapper official API documents clustering the inverse image of lens cover intervals in the original data space, with shared members inducing edges. The selected spherical k-means is a local comparative clusterer, not canonical topology: https://kepler-mapper.scikit-tda.org/en/latest/reference/stubs/kmapper.KeplerMapper.html
