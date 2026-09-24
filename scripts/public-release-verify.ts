/** Read-only verification of exported public files against the approved local publication projection. */
import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import sharp from 'sharp';
import { projectPublicationPreview, releaseReadiness, validatePublicationPolicy } from '../src/domain/publication.ts';
import { validateSnapshot } from '../src/domain/validate.ts';
import { mapLayoutHash, projectFilteredMapLayout } from './embeddings/mapLayout.ts';
import { publicRoomPaths } from './public-route-entries.ts';

const root = process.cwd();
const privatePath = (file: string) => join(root, '.private', file);
const publicPath = (file: string) => join(root, file);

async function json(path: string): Promise<unknown> {
    return JSON.parse(await readFile(path, 'utf8')) as unknown;
}

function assert(ok: boolean, detail: string): asserts ok {
    if (!ok) throw new Error(`public release verification failed: ${detail}`);
}

function stable(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(stable);
    if (value !== null && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right))
            .map(([key, item]) => [key, stable(item)]));
    }
    return value;
}

function fingerprint(value: unknown): string {
    return createHash('sha256').update(JSON.stringify(stable(value)) ?? 'undefined').digest('hex');
}

async function main(): Promise<void> {
    const local = validateSnapshot(await json(privatePath('local-snapshot.json')), { expectedVisibility: 'local-only' });
    assert(local.ok, 'local snapshot validation');
    const policy = validatePublicationPolicy(await json(privatePath('curation/publication-policy.json')), local.snapshot);
    assert(policy.ok, 'publication policy validation');
    assert(releaseReadiness(policy.policy, local.snapshot).ready, 'policy readiness');
    const output = validateSnapshot(await json(publicPath('src/data/public-snapshot.json')), { expectedVisibility: 'public' });
    assert(output.ok, 'public snapshot validation');
    const projected = projectPublicationPreview(policy.policy, local.snapshot).snapshot;
    assert(local.snapshot.map !== undefined, 'source map availability');
    const expectedMap = projectFilteredMapLayout(projected, local.snapshot.map);
    const expectedBooks = projected.books.map((book) => book.coverPath === undefined ? book : {
        ...book,
        coverPath: `covers/${basename(book.coverPath).replace(/\.[^.]+$/u, '.jpg')}`,
    });
    const actual = output.snapshot;
    assert(actual.visibility === 'public' && actual.map !== undefined, 'public visibility and map');
    for (const [index, book] of expectedBooks.entries()) {
        const exported = actual.books[index];
        if (fingerprint(book) !== fingerprint(exported)) {
            const fields = Object.keys(book).filter((key) =>
                fingerprint(book[key as keyof typeof book]) !== fingerprint(exported?.[key as keyof typeof book]));
            throw new Error(`public release verification failed: book ${book.id} differs in ${fields.join(', ') || 'field order or identity'}`);
        }
    }
    for (const [name, expected, found] of [
        ['owner', projected.owner, actual.owner],
        ['themes', projected.themes, actual.themes],
        ['tags', projected.tags, actual.tags],
        ['books', expectedBooks, actual.books],
        ['highlights', projected.highlights, actual.highlights],
        ['map', expectedMap, actual.map],
    ] as const) {
        assert(fingerprint(expected) === fingerprint(found), `${name} diverged from approved projection`);
    }
    const expectedCovers = new Set(expectedBooks.flatMap((book) => book.coverPath === undefined ? [] : [basename(book.coverPath)]));
    const actualCovers = await readdir(publicPath('public/covers'));
    assert(actualCovers.length === expectedCovers.size && actualCovers.every((name) => expectedCovers.has(name)), 'public cover inventory');
    for (const book of projected.books) {
        if (book.coverPath === undefined) continue;
        const target = `public/covers/${basename(book.coverPath).replace(/\.[^.]+$/u, '.jpg')}`;
        const original = privatePath(`covers/${basename(book.coverPath)}`);
        const expectedBytes = await sharp(original)
            .resize({ width: 320, height: 480, fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 84, mozjpeg: true })
            .toBuffer();
        const actualBytes = await readFile(publicPath(target));
        assert(expectedBytes.equals(actualBytes), `cover derivative mismatch for ${book.id}`);
    }
    const assets = (await readdir(publicPath('dist/assets'))).filter((name) => /^public-snapshot-[a-zA-Z0-9_-]+\.json$/u.test(name));
    assert(assets.length === 1, 'production snapshot asset inventory');
    assert(fingerprint(await json(publicPath(`dist/assets/${assets[0]}`))) === fingerprint(actual), 'production snapshot asset');
    const staticRooms = publicRoomPaths(actual);
    const entryBytes = await readFile(publicPath('dist/index.html'));
    for (const route of staticRooms) {
        const bytes = await readFile(publicPath(`dist/.${route}/index.html`));
        assert(bytes.equals(entryBytes), 'public static room entry differs from the built entry');
    }
    for (const [directory, ids] of [
        ['books', actual.books.map((book) => book.id)],
        ['paths', actual.tags.map((tag) => tag.id)],
        ['themes', actual.themes.map((theme) => theme.id)],
    ] as const) {
        const names = (await readdir(publicPath(`dist/${directory}`))).filter((name) => name !== 'index.html');
        assert(names.length === ids.length && names.every((name) => ids.includes(name)), `unexpected static ${directory} route`);
    }
    const report = {
        generatedAt: new Date().toISOString(),
        outputReviewed: false,
        checks: {
            approvedMetadataAndPassagesMatch: true,
            tagAndDraftProjectionMatch: true,
            fixedMapLayoutHash: mapLayoutHash(expectedMap),
            fixedMapUnmoved: true,
            publishedCoverDerivativesMatch: true,
            productionAssetMatches: true,
            staticRoomEntriesMatchPublicIds: true,
        },
        counts: {
            books: actual.books.length,
            highlights: actual.highlights.length,
            reviewedPaths: actual.highlights.filter((highlight) => highlight.pathVector !== undefined).length,
            draftWithoutTags: actual.highlights.filter((highlight) => highlight.tagIds.length === 0).length,
            covers: expectedCovers.size,
            mapPoints: actual.map?.points.length ?? 0,
            staticRooms: staticRooms.length,
        },
        remaining: 'A human content/rights decision and live Pages verification are separate gates.',
    };
    await writeFile(privatePath('public-release-verification.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log(`public release parity: ${String(report.counts.books)} books / ${String(report.counts.highlights)} highlights / ${String(report.counts.covers)} cover derivatives`);
    console.log(`static rooms: ${String(report.counts.staticRooms)}; fixed map and production asset: verified`);
    console.log('human content and rights decision: not inferred from this check');
}

try {
    await main();
} catch (error) {
    console.error(error instanceof Error ? error.message : 'public release verification failed');
    process.exitCode = 1;
}
