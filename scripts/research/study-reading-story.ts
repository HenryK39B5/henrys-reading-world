import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { deterministicNext, type NextData } from './routeNext.mjs';
import { compareTaggedPassages, lensMembership } from './readingStory.mjs';

const hash = (text: string) => createHash('sha256').update(text).digest('hex');
const dir = '.private/research/map/route-first/reading-story';
const [viewerText, overlayText] = await Promise.all([readFile('.private/research/map/route-first/viewer-data.json', 'utf8'), readFile(`${dir}/tag-overlay.json`, 'utf8')]);
const viewerSha = 'f95cfa8bb830a9e2600fceeb69a7101910c85906f452d207dde04431f99fca6d';
const snapshotSha = 'ccef39e7410ba7dd1618a8038762933464dd35c45a98f5fa48fb5e8c02c53a7c';
if (hash(viewerText) !== viewerSha) throw new Error('frozen viewer changed');
const viewer = JSON.parse(viewerText) as NextData & { seeds: string[]; points: Record<string, { bookId: string }> };
const overlay = JSON.parse(overlayText) as { snapshotSha256: string; viewerSha256: string; tags: Record<string, string>; highlightTags: Record<string, string[]> };
if (overlay.snapshotSha256 !== snapshotSha || overlay.viewerSha256 !== viewerSha || Object.keys(overlay.highlightTags).length !== 3462) throw new Error('overlay drift');
const books = Object.fromEntries(Object.entries(viewer.points).map(([id, point]) => [id, point.bookId]));
const routes = viewer.seeds.map((seed) => {
    const trail = [seed]; const edges = [];
    for (let index = 0; index < 6; index += 1) {
        const chosen = deterministicNext(viewer, trail);
        if (chosen.status !== 'ready') break;
        const from = trail.at(-1)!; const to = chosen.candidate!.id;
        const evidence = compareTaggedPassages(overlay.highlightTags, from, to);
        edges.push({ from, to, modelRank: chosen.candidate!.rank, evidence: evidence.status, sharedReviewedTags: evidence.shared });
        trail.push(to);
    }
    return { seed, trail, edges };
});
const counts = routes.flatMap((route) => route.edges).reduce((acc, edge) => { acc[edge.evidence] += 1; return acc; }, { shared: 0, disjoint: 0, unknown: 0 });
const lens = lensMembership(overlay.highlightTags, books, 'h-2726');
const result = { schemaVersion: 1, viewerSha256: viewerSha, snapshotSha256: snapshotSha, overlaySha256: hash(overlayText),
    ruleSha256: hash(await readFile('scripts/research/routeNext.mjs', 'utf8')),
    implementationSha256: hash(await readFile('scripts/research/readingStory.mjs', 'utf8')),
    parameters: { seeds: viewer.seeds, steps: 6, tagScope: 'reviewed public snapshot only', missing: 'unknown, never a negative' },
    counts: { highlights: 3462, books: 108, tagged: Object.values(overlay.highlightTags).filter((tags) => tags.length).length,
        untagged: Object.values(overlay.highlightTags).filter((tags) => !tags.length).length, edges: routes.reduce((total, route) => total + route.edges.length, 0), ...counts },
    fixedCases: {
        'h-3501': routes.find((route) => route.seed === 'h-3501'),
        'h-2288': routes.find((route) => route.seed === 'h-2288'),
        'h-4504': routes.find((route) => route.seed === 'h-4504'),
        'h-043': routes.find((route) => route.seed === 'h-043'),
    }, lensCase: { id: 'h-2726', highlighted: lens.ids.length, books: lens.books, tagIds: lens.tags },
    caution: 'shared reviewed tag is not viewpoint agreement; disjoint reviewed tags is not unrelatedness; missing tags are unknown. These are descriptive counts from fixed routes, not semantic accuracy or visitor enjoyment.' };
await mkdir(dir, { recursive: true }); await writeFile(`${dir}/metrics.json`, JSON.stringify(result, null, 2) + '\n');
console.log(`R4-M fixed 11 seeds: ${result.counts.edges} true edges; shared=${counts.shared}, disjoint=${counts.disjoint}, unknown=${counts.unknown}; not semantic accuracy`);
