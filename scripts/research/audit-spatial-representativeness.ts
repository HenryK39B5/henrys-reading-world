import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { sha256 } from '../embeddings/core.ts';
import { validateSnapshot } from '../../src/domain/validate.ts';
import { auditAnchor, memberMedian, memberMedoid, type ResearchPoint } from './spatialRepresentativeness.ts';

const inputPath = join(process.cwd(), 'src/data/public-snapshot.json');
const input = await readFile(inputPath, 'utf8');
const parsed = validateSnapshot(JSON.parse(input) as unknown, { expectedVisibility: 'public' });
if (!parsed.ok) throw new Error(parsed.errors.join('; '));
const snapshot = parsed.snapshot;
if (snapshot.map === undefined) throw new Error('public map required');
const highlights = new Map(snapshot.highlights.map((highlight) => [highlight.id, highlight]));
const points: ResearchPoint[] = snapshot.map.points.map((point) => {
    const highlight = highlights.get(point.highlightId);
    if (highlight === undefined) throw new Error(`missing highlight: ${point.highlightId}`);
    return { id: highlight.id, bookId: highlight.bookId, x: point.x, y: point.y, tagIds: highlight.tagIds };
});
const topics = snapshot.tags.map((tag) => {
    const members = points.filter((point) => point.tagIds.includes(tag.id));
    if (members.length === 0) throw new Error(`topic has no members: ${tag.id}`);
    const median = memberMedian(members);
    const stored = snapshot.map!.labels.find((label) => label.tagId === tag.id);
    if (stored === undefined || stored.x !== median.x || stored.y !== median.y) {
        throw new Error(`baseline median differs from published anchor: ${tag.id}`);
    }
    const medoid = memberMedoid(members);
    return {
        tagId: tag.id,
        title: tag.title,
        memberCount: members.length,
        memberBookCount: new Set(members.map((point) => point.bookId)).size,
        median: auditAnchor(points, tag.id, median),
        medoid: { representativeId: medoid.id, ...auditAnchor(points, tag.id, medoid) },
    };
});
const quantiles = (values: number[]) => {
    const sorted = [...values].sort((left, right) => left - right);
    return { median: sorted[Math.floor(sorted.length / 2)], p90: sorted[Math.floor(sorted.length * 0.9)], max: sorted.at(-1) };
};
const counts30 = (method: 'median' | 'medoid') => topics.map((topic) => topic[method].neighborhoods[1]!.memberCount);
const summary = {
    topics: topics.length,
    points: points.length,
    tagged: points.filter((point) => point.tagIds.length > 0).length,
    medianNearestMember: quantiles(topics.map((topic) => topic.median.nearestMemberDistance)),
    medianMembersIn30: quantiles(counts30('median')),
    medoidMembersIn30: quantiles(counts30('medoid')),
    medoidMoreSupportAt30: topics.filter((topic) => topic.medoid.neighborhoods[1]!.memberCount > topic.median.neighborhoods[1]!.memberCount).length,
    medoidLessSupportAt30: topics.filter((topic) => topic.medoid.neighborhoods[1]!.memberCount < topic.median.neighborhoods[1]!.memberCount).length,
    medoidSameSupportAt30: topics.filter((topic) => topic.medoid.neighborhoods[1]!.memberCount === topic.median.neighborhoods[1]!.memberCount).length,
};
const report = {
    schemaVersion: 1,
    algorithm: 'spatial-anchor-baseline-v1',
    generatedAt: new Date().toISOString(),
    inputSha256: sha256(input),
    mapVersion: snapshot.map.version,
    neighborhoodSizes: [15, 30, 60],
    summary,
    topics,
};
const out = join(process.cwd(), '.private/research/map/spatial-representativeness');
await mkdir(out, { recursive: true });
await writeFile(join(out, 'baseline.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
const rows = topics.map((topic) => {
    const left = topic.median.neighborhoods[1]!;
    const right = topic.medoid.neighborhoods[1]!;
    return `| ${topic.tagId} | ${topic.title} | ${topic.memberCount} | ${Math.round(topic.median.nearestMemberDistance)} | ${left.memberCount}/${left.actual} | ${right.memberCount}/${right.actual} | ${left.supportingBookCount} / ${right.supportingBookCount} |`;
});
const markdown = [
    '# Spatial representativeness: baseline audit',
    '',
    `Input SHA256: ${report.inputSha256}`,
    `Map version: ${report.mapVersion}`,
    '',
    'Read-only audit of approved public points. No embedding inference, UMAP fit, label reassignment, public export or deployment.',
    'Medoid includes its own point in the neighborhood; zero nearest-member distance is tautological, not evidence of better semantics.',
    'Missing tags are unknown, not negative labels. Shares are reviewed support, not semantic purity. Radii vary with density; 15/30/60 are exploratory scales, not validated gates.',
    '',
    '```json', JSON.stringify(summary, null, 2), '```',
    '',
    '| Tag | Title | Members | Median nearest member | Median support k=30 | Medoid support k=30 | Supporting books median / medoid |',
    '| --- | --- | --- | --- | --- | --- | --- |', ...rows,
    '',
    'Inspect the actual texts and book balance before selecting any candidate. JSON contains support at all three scales and neighbor IDs for reproducible evidence review.',
    '',
].join('\n');
await writeFile(join(out, 'baseline.md'), markdown, 'utf8');
console.log(JSON.stringify(summary, null, 2));
console.log('Local-only report: .private/research/map/spatial-representativeness/baseline.{json,md}');
