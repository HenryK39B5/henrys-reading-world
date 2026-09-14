/**
 * `npm run publication:preview` — a private projection of the current policy (docs/18 §6).
 *
 * Writes two files, both under `.private/`:
 *
 *   publication-preview-snapshot.json  the shape the front end understands, marked local-only
 *   publication-audit.json             ids, counts and lengths only — never the passages themselves
 *
 * It deliberately does **not** write `src/data/public-snapshot.json` and does not copy any cover: turning a
 * preview into a publication is Release-B, with the user's own decision behind it (docs/17 §6).
 */
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { LOCAL_SNAPSHOT_FILE, publicationPaths } from '../src/app/privatePaths.ts';
import { projectPublicationPreview, releaseReadiness, validatePublicationPolicy } from '../src/domain/publication.ts';
import type { Snapshot } from '../src/domain/types.ts';
import { validateSnapshot } from '../src/domain/validate.ts';

async function main(): Promise<void> {
    const paths = publicationPaths();
    if (!existsSync(paths.policy)) {
        console.error(`no policy at ${paths.policy}; run npm run publication:init first`);
        process.exitCode = 1;
        return;
    }
    const snapshot = JSON.parse(await readFile(LOCAL_SNAPSHOT_FILE, 'utf8')) as Snapshot;
    const stored = JSON.parse(await readFile(paths.policy, 'utf8')) as unknown;
    const validated = validatePublicationPolicy(stored, snapshot);
    if (!validated.ok) {
        console.error(`${paths.policy} does not validate; nothing was written`);
        for (const error of validated.errors) {
            console.error(`  - ${error}`);
        }
        process.exitCode = 1;
        return;
    }

    const projection = projectPublicationPreview(validated.policy, snapshot);
    const readiness = releaseReadiness(validated.policy, snapshot);
    const checked = validateSnapshot(projection.snapshot, { expectedVisibility: 'local-only' });

    await mkdir(dirname(paths.preview), { recursive: true });
    await writeFile(paths.preview, `${JSON.stringify(projection.snapshot, null, 2)}\n`, 'utf8');
    await writeFile(
        paths.audit,
        `${JSON.stringify(
            {
                generatedAt: new Date().toISOString(),
                // A working preview is allowed before the review is finished; the flag says which it is.
                releaseReady: readiness.ready,
                reasons: readiness.reasons,
                reviewComplete: validated.policy.reviewComplete,
                summary: projection.audit.summary,
                books: projection.audit.books,
                excludedBooks: projection.audit.excludedBooks,
                unreviewedBooks: projection.audit.unreviewedBooks,
                themesKept: projection.audit.themesKept,
                themesDropped: projection.audit.themesDropped,
                longHighlights: projection.audit.longHighlights,
                snapshotCheck: checked.ok
                    ? { ok: true, warnings: checked.warnings }
                    : { ok: false, errors: checked.errors },
            },
            null,
            2,
        )}\n`,
        'utf8',
    );

    const { summary } = projection.audit;
    console.log(`preview written to ${paths.preview}`);
    console.log(`audit   written to ${paths.audit}`);
    console.log(
        `books: published ${String(summary.published)}, excluded ${String(summary.excluded)}, unreviewed ${String(summary.unreviewed)} of ${String(summary.totalBooks)}`,
    );
    console.log(
        `passages: ${String(summary.selectedHighlights)} selected (${String(summary.selectedCharacters)} characters), ${String(summary.excludedHighlights)} excluded by hand`,
    );
    console.log(
        `covers: ${String(summary.publishedCovers)} allowed; shelves: ${String(summary.themesKept)} kept, ${String(summary.themesDropped)} dropped`,
    );
    console.log(`long passages (>=200 characters) in the projection: ${String(summary.longHighlights)}`);
    console.log(`releaseReady: ${String(readiness.ready)}${readiness.ready ? '' : ` — ${readiness.reasons.join('; ')}`}`);
    if (!checked.ok) {
        console.error('the projection does not validate against the snapshot contract');
        for (const error of checked.errors) {
            console.error(`  - ${error}`);
        }
        process.exitCode = 1;
    }
    console.log(`public snapshot untouched: src/data/public-snapshot.json was not written.`);
}

await main();
