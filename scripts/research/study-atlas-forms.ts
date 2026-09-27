import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { bookIslandLayout } from './atlasForms.mjs';
import { deterministicNext, type NextData } from './routeNext.mjs';

const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');
const dir = '.private/research/map/route-first/atlas-forms';
const viewer = await readFile('.private/research/map/route-first/viewer-data.json', 'utf8');
if (sha256(viewer) !== 'f95cfa8bb830a9e2600fceeb69a7101910c85906f452d207dde04431f99fca6d') throw new Error('frozen viewer data drift');
const data = JSON.parse(viewer) as NextData & { inputSha256: string; points: Record<string, { id: string; bookId: string }>; seeds: string[]; publishedMap: { points: Array<{ highlightId: string; x: number; y: number }> } };
const island = bookIslandLayout(data.points);
if (Object.keys(island.byPoint).length !== 3462 || island.islands.length !== 108) throw new Error('island identity mismatch');
const published = Object.fromEntries(data.publishedMap.points.map((point) => [point.highlightId, point]));
const distances = { published: [] as number[], islands: [] as number[] };
const walks = [];
for (const seed of data.seeds) {
    const trail = [seed];
    for (let index = 0; index < 6; index += 1) {
        const result = deterministicNext(data, trail);
        if (result.status !== 'ready') break;
        const from = trail.at(-1)!; const to = result.candidate!.id;
        for (const [name, points] of [['published', published], ['islands', island.byPoint]] as const) {
            const left = points[from]!; const right = points[to]!;
            distances[name].push(Math.hypot(left.x - right.x, left.y - right.y) / (10_000 * Math.SQRT2));
        }
        trail.push(to);
    }
    walks.push({ seed, trail });
}
const distribution = (values: number[]) => { const sorted = [...values].sort((left, right) => left - right); return { count: sorted.length, median: sorted[Math.floor((sorted.length - 1) / 2)], p90: sorted[Math.ceil(sorted.length * .9) - 1], max: sorted.at(-1) }; };
const result = {
    schemaVersion: 1, inputSha256: data.inputSha256, viewerSha256: sha256(viewer),
    geometrySha256: sha256(await readFile('scripts/research/atlasForms.mjs', 'utf8')),
    ruleSha256: sha256(await readFile('scripts/research/routeNext.mjs', 'utf8')),
    pageSha256: sha256(await readFile('scripts/research/atlas-forms.mjs', 'utf8')),
    params: { seeds: data.seeds, maxSteps: 6, bookSort: 'public highlight count desc then stable project book ID; fixed 12-by-9 index grid', starEdges: 'up to four eligible directed top16 in model rank order' },
    counts: { books: island.islands.length, uniqueHighlights: Object.keys(island.byPoint).length, radiusWorldMin: Math.min(...island.islands.map((book) => book.radius)), radiusWorldMax: Math.max(...island.islands.map((book) => book.radius)) },
    walks, distances: { published: distribution(distances.published), islands: distribution(distances.islands) },
    caution: 'Islands are an index; between-island distances are deliberately meaningless. Neither map-distance summary nor model rank is semantic accuracy.'
};
await mkdir(dir, { recursive: true });
await writeFile(`${dir}/metrics.json`, JSON.stringify(result, null, 2) + '\n');
console.log(`atlas study: ${walks.length} true seeds, ${distances.published.length} identical route edges, 108 books and 3462 true highlights; geometric distances are not accuracy`);
