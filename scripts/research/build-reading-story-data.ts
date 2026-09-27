import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { validateSnapshot } from '../../src/domain/validate.ts';

const hash = (text: string) => createHash('sha256').update(text).digest('hex');
const snapshotText = await readFile('src/data/public-snapshot.json', 'utf8');
const viewerText = await readFile('.private/research/map/route-first/viewer-data.json', 'utf8');
const snapshotHash = 'ccef39e7410ba7dd1618a8038762933464dd35c45a98f5fa48fb5e8c02c53a7c';
const viewerHash = 'f95cfa8bb830a9e2600fceeb69a7101910c85906f452d207dde04431f99fca6d';
if (hash(snapshotText) !== snapshotHash || hash(viewerText) !== viewerHash) throw new Error('frozen R4-M input drift');
const validated = validateSnapshot(JSON.parse(snapshotText) as unknown, { expectedVisibility: 'public' });
if (!validated.ok) throw new Error(validated.errors.join('; '));
const snapshot = validated.snapshot;
const viewer = JSON.parse(viewerText) as { inputSha256: string; points: Record<string, { id: string; bookId: string; text: string }> };
if (viewer.inputSha256 !== snapshotHash || snapshot.highlights.length !== 3462 || Object.keys(viewer.points).length !== 3462) throw new Error('viewer/snapshot mismatch');
const tags = Object.fromEntries(snapshot.tags.map((tag) => [tag.id, tag.title]));
const bookIds = new Set(snapshot.books.map((book) => book.id));
const highlightTags: Record<string, string[]> = {};
for (const highlight of snapshot.highlights) {
    const point = viewer.points[highlight.id];
    if (!point || point.bookId !== highlight.bookId || point.text !== highlight.text || !bookIds.has(highlight.bookId)) throw new Error(`stale public highlight ${highlight.id}`);
    const ids = highlight.tagIds ?? [];
    if (ids.some((id) => !tags[id]) || new Set(ids).size !== ids.length || ids.length > 3) throw new Error(`invalid tag projection ${highlight.id}`);
    highlightTags[highlight.id] = [...ids].sort();
}
if (Object.keys(tags).length !== 56 || Object.values(highlightTags).filter((ids) => ids.length).length !== 1432) throw new Error('public reviewed-tag coverage changed');
const output = { schemaVersion: 1, snapshotSha256: snapshotHash, viewerSha256: viewerHash,
    scope: 'local research; absent reviewed tag is unknown, not a negative or a missing passage', tags, highlightTags };
const dir = '.private/research/map/route-first/reading-story';
await mkdir(dir, { recursive: true });
await writeFile(`${dir}/tag-overlay.json`, JSON.stringify(output) + '\n');
console.log(`R4-M: ${Object.keys(highlightTags).length} approved true passages, 1432 annotated, 2030 unknown, 56 tags; no new WeRead/API`);
