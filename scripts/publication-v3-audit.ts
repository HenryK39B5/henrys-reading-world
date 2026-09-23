/**
 * Audit the V3 public projection without exporting it.
 *
 * This command reads only private local inputs, projects through the same publication policy used by the
 * reviewer, and writes a metadata-only report. It never writes src/data/public-snapshot.json or covers.
 * Passage text is never printed or written to the report.
 *
 * Usage: npm run publication:audit:v3
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
    projectPublicationPreview,
    releaseReadiness,
    validatePublicationPolicy,
    type PublicationPolicy,
} from '../src/domain/publication.ts';
import { validateSnapshot } from '../src/domain/validate.ts';
import { mapLayoutHash, projectFilteredMapLayout } from './embeddings/mapLayout.ts';
import type { Snapshot } from '../src/domain/types.ts';

const ROOT = process.cwd();
const LOCAL_SNAPSHOT_PATH = join(ROOT, '.private/local-snapshot.json');
const POLICY_PATH = join(ROOT, '.private/curation/publication-policy.json');
const ASSIGNMENTS_PATH = join(ROOT, '.private/tags/assignments.json');
const REPORT_PATH = join(ROOT, '.private/publication-v3-projection-audit.json');

async function readJson(path: string): Promise<unknown> {
    return JSON.parse(await readFile(path, 'utf8')) as unknown;
}

function fail(message: string): never {
    throw new Error(message);
}

function assert(condition: boolean, message: string): asserts condition {
    if (!condition) fail(message);
}

function ownKeys(value: object): string[] {
    return Object.keys(value).sort();
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function main(): Promise<void> {
    const localRaw = await readJson(LOCAL_SNAPSHOT_PATH);
    const localResult = validateSnapshot(localRaw, { expectedVisibility: 'local-only' });
    assert(localResult.ok, `local snapshot is invalid: ${localResult.ok ? '' : localResult.errors.join('; ')}`);
    const localSnapshot: Snapshot = localResult.snapshot;

    const policyRaw = await readJson(POLICY_PATH);
    const policyResult = validatePublicationPolicy(policyRaw, localSnapshot);
    assert(policyResult.ok, `publication policy is invalid: ${policyResult.ok ? '' : policyResult.errors.join('; ')}`);
    const policy: PublicationPolicy = policyResult.policy;

    const readiness = releaseReadiness(policy, localSnapshot);
    assert(readiness.ready, `publication policy is not ready: ${readiness.reasons.join('; ')}`);

    const preview = projectPublicationPreview(policy, localSnapshot);
    const projected = preview.snapshot;
    const assignmentsRaw = await readJson(ASSIGNMENTS_PATH);
    assert(isRecord(assignmentsRaw) && Array.isArray(assignmentsRaw.assignments), 'private tag assignments are invalid');
    const assignments = new Map<string, Record<string, unknown>>();
    for (const entry of assignmentsRaw.assignments as unknown[]) {
        assert(isRecord(entry) && typeof entry.highlightId === 'string', 'invalid tag assignment entry');
        assert(!assignments.has(entry.highlightId), `duplicate tag assignment: ${entry.highlightId}`);
        assignments.set(entry.highlightId, entry);
    }
    assert(assignments.size === localSnapshot.highlights.length, 'tag assignments do not cover the local snapshot');
    let reviewed = 0;
    let draft = 0;
    for (const highlight of projected.highlights) {
        const assignment = assignments.get(highlight.id);
        assert(assignment !== undefined, `missing tag assignment: ${highlight.id}`);
        if (assignment.status === 'reviewed') {
            reviewed += 1;
            assert(Array.isArray(assignment.tagIds) && JSON.stringify(highlight.tagIds) === JSON.stringify(assignment.tagIds), `reviewed tag mismatch: ${highlight.id}`);
        } else {
            assert(assignment.status === 'draft', `unknown tag status: ${highlight.id}`);
            draft += 1;
            assert(highlight.tagIds.length === 0, `draft tags leaked: ${highlight.id}`);
        }
        assert(highlight.pathVector === undefined || assignment.status === 'reviewed', `draft path vector leaked: ${highlight.id}`);
    }

    const publishedBookIds = new Set(projected.books.map((book) => book.id));
    const publishedHighlightIds = new Set(projected.highlights.map((highlight) => highlight.id));
    const sourceMap = localSnapshot.map;
    assert(sourceMap !== undefined, 'local snapshot has no fixed map coordinates');
    const publicMap = projectFilteredMapLayout(projected, sourceMap);
    const checkedProjection = validateSnapshot({ ...projected, map: publicMap }, { expectedVisibility: 'local-only' });
    assert(checkedProjection.ok, `filtered map projection is invalid: ${checkedProjection.ok ? '' : checkedProjection.errors.join('; ')}`);
    assert(publicMap.labels.length === projected.tags.length, 'a published tag has no map label');
    assert(publicMap.points.every((point) => publishedHighlightIds.has(point.highlightId)), 'unpublished map point leaked');
    assert(publicMap.labels.every((label) => projected.tags.some((tag) => tag.id === label.tagId)), 'unpublished map label leaked');
    const sourcePointById = new Map(sourceMap.points.map((point) => [point.highlightId, point]));
    assert(publicMap.points.every((point) => {
        const source = sourcePointById.get(point.highlightId);
        return source?.x === point.x && source.y === point.y;
    }), 'public projection moved an existing map point');
    const sourceBooks = new Map(localSnapshot.books.map((book) => [book.id, book]));
    const sourceHighlights = new Map(localSnapshot.highlights.map((highlight) => [highlight.id, highlight]));
    const excludedBookIds = new Set(preview.audit.excludedBooks);
    const excludedHighlightIds = new Set(
        Object.values(policy.books).flatMap((decision) => decision.excludedHighlightIds),
    );

    assert(projected.visibility === 'local-only', 'projection must remain local-only before export');
    assert(projected.schemaVersion === localSnapshot.schemaVersion, 'projection changed schema version');
    assert(preview.audit.unreviewedBooks.length === 0, 'projection contains unreviewed books');
    assert(preview.audit.summary.published === projected.books.length, 'book summary disagrees with projection');
    assert(preview.audit.summary.selectedHighlights === projected.highlights.length, 'highlight summary disagrees with projection');
    assert(projected.books.every((book) => !excludedBookIds.has(book.id)), 'excluded book leaked into projection');
    assert(projected.highlights.every((highlight) => !excludedHighlightIds.has(highlight.id)), 'excluded highlight leaked into projection');
    assert(projected.highlights.every((highlight) => publishedBookIds.has(highlight.bookId)), 'highlight points to an unpublished book');
    assert(projected.books.every((book) => sourceBooks.has(book.id)), 'projection contains an unknown book');
    assert(projected.highlights.every((highlight) => sourceHighlights.has(highlight.id)), 'projection contains an unknown highlight');
    assert(projected.highlights.every((highlight) => {
        const source = sourceHighlights.get(highlight.id);
        return source?.bookId === highlight.bookId && source.text === highlight.text && source.year === highlight.year;
    }), 'projection changed a passage, source book, or year');
    assert(projected.books.every((book) => {
        const source = sourceBooks.get(book.id);
        return source?.title === book.title && source.author === book.author && source.description === book.description;
    }), 'projection changed book metadata');
    assert(projected.tags.every((tag) => ownKeys(tag).every((key) => ['id', 'title', 'description'].includes(key))), 'tag projection contains private fields');
    assert(projected.books.every((book) => ownKeys(book).every((key) => ['id', 'title', 'author', 'description', 'coverPath', 'themeIds'].includes(key))), 'book projection contains private fields');
    assert(projected.highlights.every((highlight) => ownKeys(highlight).every((key) => ['id', 'bookId', 'text', 'year', 'tagIds', 'pathVector'].includes(key))), 'highlight projection contains private fields');
    assert(projected.highlights.every((highlight) => highlight.tagIds.every((tagId) => projected.tags.some((tag) => tag.id === tagId))), 'highlight points to an absent topic tag');
    assert(projected.books.every((book) => book.themeIds.every((themeId) => projected.themes.some((theme) => theme.id === themeId))), 'book points to an absent theme');
    assert(projected.books.every((book) => policy.books[book.id]?.decision === 'publish'), 'projection contains a non-published policy decision');
    assert(projected.books.every((book) => book.coverPath === undefined || policy.books[book.id]?.cover === 'publish'), 'cover leaked from a disabled cover decision');

    const report = {
        generatedAt: new Date().toISOString(),
        status: 'verified-pre-export',
        exportPerformed: false,
        source: {
            snapshot: 'local-only',
            policy: 'private publication policy',
            textWritten: false,
        },
        policy: {
            reviewComplete: policy.reviewComplete,
            booksReviewed: Object.values(policy.books).filter((decision) => decision.decision !== 'unreviewed').length,
            booksPublished: preview.audit.summary.published,
            booksExcluded: preview.audit.summary.excluded,
            highlightsPublished: preview.audit.summary.selectedHighlights,
            highlightsExcluded: preview.audit.summary.excludedHighlights,
            coversPublished: preview.audit.summary.publishedCovers,
            longHighlights: preview.audit.summary.longHighlights,
            reviewedHighlights: reviewed,
            draftHighlights: draft,
        },
        projection: {
            visibility: projected.visibility,
            schemaVersion: projected.schemaVersion,
            books: projected.books.length,
            highlights: projected.highlights.length,
            themes: projected.themes.length,
            tags: projected.tags.length,
            pathVectors: projected.highlights.filter((highlight) => highlight.pathVector !== undefined).length,
            coverPaths: projected.books.filter((book) => book.coverPath !== undefined).length,
            mapPresent: projected.map !== undefined,
            filteredMap: {
                points: publicMap.points.length,
                labels: publicMap.labels.length,
                layoutHash: mapLayoutHash(publicMap),
                unchangedCoordinates: true,
                validated: checkedProjection.ok,
                written: false,
            },
        },
        checks: {
            policyReady: readiness.ready,
            excludedBooksAbsent: projected.books.every((book) => !excludedBookIds.has(book.id)),
            excludedHighlightsAbsent: projected.highlights.every((highlight) => !excludedHighlightIds.has(highlight.id)),
            noPrivateProjectionFields: true,
            onlyReviewedTagsAndVectors: true,
            referencesRemainInternal: true,
            sourceTextAndMetadataUnchanged: true,
            exportBlocked: true,
            mapProjectionReady: true,
        },
        remainingGate: 'filtered map exists only in memory; the future exporter must use this checked filtering and derived layers, then user approval is required before public snapshot and cover export',
    };

    await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log(`OK ${REPORT_PATH.slice(ROOT.length + 1)}`);
    console.log(`   policy: ${String(report.policy.booksPublished)} published books, ${String(report.policy.highlightsPublished)} highlights`);
    console.log(`   projection: ${String(report.projection.tags)} tags, ${String(report.projection.pathVectors)} path vectors`);
    console.log('   export: blocked; public snapshot and covers unchanged');
}

try {
    await main();
} catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
}
