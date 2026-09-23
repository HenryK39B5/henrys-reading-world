/**
 * Export the approved V3 publication from the private local snapshot.
 *
 * This is the first command allowed to write the public content files. It is intentionally explicit and
 * never creates a repository, pushes, configures CI, or deploys. The public snapshot is projected through
 * the same publication policy as the reviewer; map coordinates are filtered, never moved or re-run through
 * UMAP. Cover files are resized into public/covers and the snapshot references only those derivatives.
 *
 * Usage: npm run publication:export
 */
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import sharp from 'sharp';
import {
    projectPublicationPreview,
    releaseReadiness,
    validatePublicationPolicy,
} from '../src/domain/publication.ts';
import { projectFilteredMapLayout, mapLayoutHash } from './embeddings/mapLayout.ts';
import { validateSnapshot } from '../src/domain/validate.ts';
import type { Book, Snapshot } from '../src/domain/types.ts';

const ROOT = process.cwd();
const LOCAL_SNAPSHOT_PATH = join(ROOT, '.private/local-snapshot.json');
const POLICY_PATH = join(ROOT, '.private/curation/publication-policy.json');
const PUBLIC_SNAPSHOT_PATH = join(ROOT, 'src/data/public-snapshot.json');
const LOCAL_COVERS_DIR = join(ROOT, '.private/covers');
const PUBLIC_DIR = join(ROOT, 'public');
const PUBLIC_COVERS_DIR = join(PUBLIC_DIR, 'covers');
const REPORT_PATH = join(ROOT, '.private/publication-export-audit.json');
const STAGING_DIR = join(ROOT, '.private/publication-export-staging');

async function readJson(path: string): Promise<unknown> {
    return JSON.parse(await readFile(path, 'utf8')) as unknown;
}

function assert(condition: boolean, message: string): asserts condition {
    if (!condition) throw new Error(message);
}

function localCoverName(path: string): string {
    const name = basename(path);
    assert(/^[a-z0-9][a-z0-9._-]*\.(?:jpg|jpeg|png|webp)$/u.test(name), `invalid local cover name: ${name}`);
    return name;
}

async function main(): Promise<void> {
    const localResult = validateSnapshot(await readJson(LOCAL_SNAPSHOT_PATH), { expectedVisibility: 'local-only' });
    assert(localResult.ok, `local snapshot is invalid: ${localResult.ok ? '' : localResult.errors.join('; ')}`);
    const localSnapshot = localResult.snapshot;

    const policyResult = validatePublicationPolicy(await readJson(POLICY_PATH), localSnapshot);
    assert(policyResult.ok, `publication policy is invalid: ${policyResult.ok ? '' : policyResult.errors.join('; ')}`);
    const policy = policyResult.policy;
    const readiness = releaseReadiness(policy, localSnapshot);
    assert(readiness.ready, `publication policy is not ready: ${readiness.reasons.join('; ')}`);
    assert(localSnapshot.map !== undefined, 'local snapshot has no fixed map layout');

    const preview = projectPublicationPreview(policy, localSnapshot);
    const localProjected = preview.snapshot;
    const publicMap = projectFilteredMapLayout(localProjected, localSnapshot.map);
    const publicBooks: Book[] = [];
    const coverJobs: { source: string; target: string }[] = [];
    for (const book of localProjected.books) {
        if (book.coverPath === undefined) {
            publicBooks.push(book);
            continue;
        }
        const sourceName = localCoverName(book.coverPath);
        const source = join(LOCAL_COVERS_DIR, sourceName);
        const targetName = `${sourceName.replace(/\.[^.]+$/u, '')}.jpg`;
        const target = join(PUBLIC_COVERS_DIR, targetName);
        try {
            await readFile(source);
        } catch {
            throw new Error(`approved cover is missing locally: ${book.id} / ${sourceName}`);
        }
        publicBooks.push({ ...book, coverPath: `covers/${targetName}` });
        coverJobs.push({ source, target });
    }

    const publicSnapshot: Snapshot = {
        ...localProjected,
        visibility: 'public',
        books: publicBooks,
        map: publicMap,
    };
    const checked = validateSnapshot(publicSnapshot, { expectedVisibility: 'public' });
    assert(checked.ok, `public snapshot is invalid: ${checked.ok ? '' : checked.errors.join('; ')}`);

    await rm(STAGING_DIR, { recursive: true, force: true });
    await mkdir(join(STAGING_DIR, 'covers'), { recursive: true });
    for (const job of coverJobs) {
        const stagedTarget = join(STAGING_DIR, 'covers', basename(job.target));
        await sharp(job.source)
            .resize({ width: 320, height: 480, fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 84, mozjpeg: true })
            .toFile(stagedTarget);
    }
    const stagedSnapshot = join(STAGING_DIR, 'public-snapshot.json');
    await writeFile(stagedSnapshot, `${JSON.stringify(publicSnapshot, null, 2)}\n`, 'utf8');

    await mkdir(dirname(PUBLIC_SNAPSHOT_PATH), { recursive: true });
    await mkdir(PUBLIC_DIR, { recursive: true });
    await rm(PUBLIC_COVERS_DIR, { recursive: true, force: true });
    await mkdir(PUBLIC_COVERS_DIR, { recursive: true });
    for (const job of coverJobs) {
        await rename(join(STAGING_DIR, 'covers', basename(job.target)), join(PUBLIC_COVERS_DIR, basename(job.target)));
    }
    await rm(PUBLIC_SNAPSHOT_PATH, { force: true });
    await rename(stagedSnapshot, PUBLIC_SNAPSHOT_PATH);
    await rm(STAGING_DIR, { recursive: true, force: true });

    const report = {
        generatedAt: new Date().toISOString(),
        exportPerformed: true,
        snapshot: {
            visibility: publicSnapshot.visibility,
            schemaVersion: publicSnapshot.schemaVersion,
            books: publicSnapshot.books.length,
            highlights: publicSnapshot.highlights.length,
            themes: publicSnapshot.themes.length,
            tags: publicSnapshot.tags.length,
            pathVectors: publicSnapshot.highlights.filter((highlight) => highlight.pathVector !== undefined).length,
            mapPoints: publicSnapshot.map?.points.length ?? 0,
            mapLabels: publicSnapshot.map?.labels.length ?? 0,
            mapHash: publicSnapshot.map === undefined ? null : mapLayoutHash(publicSnapshot.map),
            covers: coverJobs.length,
        },
        source: {
            policyReviewed: policy.reviewComplete,
            localSnapshot: 'private local snapshot',
            sourceTextCopiedUnchanged: true,
            coordinatesMoved: false,
            umapRerun: false,
        },
        output: {
            snapshot: 'src/data/public-snapshot.json',
            covers: 'public/covers',
            repositoryActions: false,
            deployment: false,
        },
        next: 'run build, public isolation, non-empty public E2E, and publication review before any repository or deployment action',
    };
    await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log(`public snapshot exported: ${report.snapshot.books} books, ${report.snapshot.highlights} highlights`);
    console.log(`public covers exported: ${report.snapshot.covers}`);
    console.log(`public map: ${report.snapshot.mapPoints} points, ${report.snapshot.mapLabels} labels`);
    console.log('repository, push, workflow, and deployment: not performed');
}

try {
    await main();
} catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
}
