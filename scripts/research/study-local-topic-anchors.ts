import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { sha256 } from '../embeddings/core.ts';
import { validateSnapshot } from '../../src/domain/validate.ts';
import { memberMedian, type ResearchPoint } from './spatialRepresentativeness.ts';
import { anchorCandidates, auditLocalAnchor, DEVELOPMENT_TOPICS, HOLDOUT_TOPICS, localMemberAnchor, STUDY_RADII } from './localTopicAnchors.ts';

const input = await readFile('src/data/public-snapshot.json', 'utf8');
const parsed = validateSnapshot(JSON.parse(input) as unknown, { expectedVisibility: 'public' });
if (!parsed.ok) throw new Error(parsed.errors.join('; '));
const snapshot = parsed.snapshot;
if (snapshot.map === undefined) throw new Error('public map required');
const highlights = new Map(snapshot.highlights.map((highlight) => [highlight.id, highlight]));
const books = new Map(snapshot.books.map((book) => [book.id, book]));
const points: ResearchPoint[] = snapshot.map.points.map((point) => {
    const highlight = highlights.get(point.highlightId);
    if (highlight === undefined) throw new Error(`missing highlight ${point.highlightId}`);
    return { id: highlight.id, bookId: highlight.bookId, x: point.x, y: point.y, tagIds: highlight.tagIds };
});
const development = new Set<string>(DEVELOPMENT_TOPICS);
const holdout = new Set<string>(HOLDOUT_TOPICS);
const derivedHoldout = snapshot.tags.filter((tag) => !development.has(tag.id))
    .map((tag) => ({ id: tag.id, hash: sha256(`r1-holdout-v1:${tag.id}`) }))
    .sort((left, right) => left.hash.localeCompare(right.hash)).slice(0, 8).map((entry) => entry.id);
if (JSON.stringify(derivedHoldout) !== JSON.stringify(HOLDOUT_TOPICS)) throw new Error('frozen holdout changed');
const methods = ['median', 'medoid', 'localDensity', 'localBookCapped'] as const;
const topics = snapshot.tags.map((tag) => {
    const members = points.filter((point) => point.tagIds.includes(tag.id));
    const median = memberMedian(members);
    const baseline = snapshot.map!.labels.find((label) => label.tagId === tag.id);
    if (baseline === undefined || baseline.x !== median.x || baseline.y !== median.y) throw new Error(`baseline anchor changed ${tag.id}`);
    const candidates = { median, ...anchorCandidates(members) };
    const evidence = Object.fromEntries(methods.map((method) => [method, auditLocalAnchor(points, tag.id, candidates[method])])) as Record<typeof methods[number], ReturnType<typeof auditLocalAnchor>>;
    const stability = [false, true].map((bookCapped) => {
        const anchors = STUDY_RADII.map((radius) => ({ radius, ...localMemberAnchor(members, radius, bookCapped) }));
        return {
            method: bookCapped ? 'localBookCapped' : 'localDensity',
            anchors: anchors.map(({ radius, id, x, y }) => ({ radius, representativeId: id, x, y })),
            maximumShift: Math.max(...anchors.flatMap((left) => anchors.map((right) => Math.hypot(left.x - right.x, left.y - right.y)))),
        };
    });
    return {
        tagId: tag.id, title: tag.title, description: tag.description ?? null,
        split: development.has(tag.id) ? 'development' : holdout.has(tag.id) ? 'holdout' : 'other',
        memberCount: members.length,
        methods: evidence,
        stability,
    };
});
const medianValue = (values: number[]) => {
    const sorted = [...values].sort((left, right) => left - right);
    if (sorted.length === 0) return null;
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 1 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
};
const summary = ['development', 'holdout', 'all'].map((split) => {
    const group = split === 'all' ? topics : topics.filter((topic) => topic.split === split);
    return {
        split, topics: group.length,
        methods: methods.map((method) => {
            const comparisons = group.map((topic) => ({
                baseline: topic.methods.median.kNeighborhoods[1]!.memberCount,
                candidate: topic.methods[method].kNeighborhoods[1]!.memberCount,
            }));
            return {
                method,
                medianSupportK30: medianValue(comparisons.map((entry) => entry.candidate)),
                moreK30: comparisons.filter((entry) => entry.candidate > entry.baseline).length,
                lessK30: comparisons.filter((entry) => entry.candidate < entry.baseline).length,
                sameK30: comparisons.filter((entry) => entry.candidate === entry.baseline).length,
                medianSupportRadius500: medianValue(group.map((topic) => topic.methods[method].radiusNeighborhoods[1]!.memberCount)),
                medianSupportingBooksRadius500: medianValue(group.map((topic) => topic.methods[method].radiusNeighborhoods[1]!.supportingBookCount)),
            };
        }),
    };
});
const report = {
    schemaVersion: 1, algorithm: 'local-topic-anchor-study-v1', generatedAt: new Date().toISOString(),
    inputSha256: sha256(input), pointsHash: sha256(JSON.stringify(snapshot.map.points)), mapVersion: snapshot.map.version,
    parameters: { radii: STUDY_RADII, defaultRadius: 500, sigmaFraction: 0.5, bookContributionCap: 1, excludeCoincident: true, includeKBoundaryTies: true },
    development: DEVELOPMENT_TOPICS, holdout: HOLDOUT_TOPICS, summary, topics,
};
const out = join(process.cwd(), '.private/research/map/local-anchors');
await mkdir(out, { recursive: true });
await writeFile(join(out, 'study.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
const review: string[] = [
    '# R1: frozen development-topic nearest-text packet', '',
    `Input SHA256: ${report.inputSha256}`, '',
    'Six nearest actual neighbors per method, excluding coincident points; not a member-only sample.',
    'Support means a reviewed tag is present. Unknown means no reviewed tags. Other tags do not prove a negative.',
    'Read the original text with its source; no automatic re-tagging or claim that the excerpt is complete context.', '',
];
for (const topic of topics.filter((entry) => entry.split === 'development')) {
    review.push(`## ${topic.tagId} ${topic.title}`, '', topic.description ?? '', '');
    for (const method of methods) {
        const audit = topic.methods[method];
        const neighborhood = audit.kNeighborhoods[0]!;
        review.push(`### ${method}`, '', `Anchor (${audit.anchor.x}, ${audit.anchor.y}); nearest-15 reviewed support ${neighborhood.memberCount}/${neighborhood.actual}; excluded coincident ${audit.excludedCoincidentCount}.`, '');
        for (const id of neighborhood.neighborIds.slice(0, 6)) {
            const highlight = highlights.get(id)!;
            const book = books.get(highlight.bookId)!;
            const status = highlight.tagIds.includes(topic.tagId) ? 'reviewed support' : highlight.tagIds.length === 0 ? 'unknown / untagged' : 'other reviewed tags / not a confirmed negative';
            review.push(`- ${id} | ${book.title} | ${book.author} | ${status} | ${highlight.tagIds.join(', ')}`, '', highlight.text, '');
        }
    }
}
await writeFile(join(out, 'nearest-text-review.md'), review.join('\n'), 'utf8');
console.log(JSON.stringify(summary, null, 2));
console.log('Local-only: .private/research/map/local-anchors/{study.json,nearest-text-review.md}');
