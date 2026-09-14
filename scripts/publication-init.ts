/**
 * `npm run publication:init` — create or grow the private publication policy (docs/18 §5.2).
 *
 * It never overwrites: an existing file keeps every decision it already has, and a book added to the
 * snapshot later is appended as `unreviewed`. The terminal prints counts and paths only — no book title,
 * no passage text — because this runs against private data.
 */
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { LOCAL_SNAPSHOT_FILE, publicationPaths } from '../src/app/privatePaths.ts';
import {
    initialPublicationPolicy,
    reconcilePublicationPolicy,
    unreviewedBooks,
    validatePublicationPolicy,
    type PublicationPolicy,
} from '../src/domain/publication.ts';
import type { Snapshot } from '../src/domain/types.ts';

async function readSnapshot(): Promise<Snapshot> {
    return JSON.parse(await readFile(LOCAL_SNAPSHOT_FILE, 'utf8')) as Snapshot;
}

async function main(): Promise<void> {
    const { policy: policyFile } = publicationPaths();
    const snapshot = await readSnapshot();
    if (!existsSync(policyFile)) {
        const policy = initialPublicationPolicy(snapshot);
        await mkdir(dirname(policyFile), { recursive: true });
        await writeFile(policyFile, `${JSON.stringify(policy, null, 2)}\n`, 'utf8');
        console.log(`created ${policyFile}`);
        console.log(
            `books ${String(snapshot.books.length)}, all unreviewed; nothing is published until you decide.`,
        );
        return;
    }

    const stored = JSON.parse(await readFile(policyFile, 'utf8')) as unknown;
    const validated = validatePublicationPolicy(stored, snapshot);
    if (!validated.ok) {
        // Do not "repair" a policy that failed validation: report and stop, so a broken file cannot be
        // silently rewritten into a different set of decisions.
        console.error(`refusing to touch ${policyFile}: it does not validate`);
        for (const error of validated.errors) {
            console.error(`  - ${error}`);
        }
        process.exitCode = 1;
        return;
    }

    const reconciled = reconcilePublicationPolicy(validated.policy, snapshot);
    if (reconciled.added.length === 0 && reconciled.missing.length === 0) {
        console.log(`${policyFile} is already in step with the snapshot.`);
    } else {
        const next: PublicationPolicy = reconciled.policy;
        await writeFile(policyFile, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
        console.log(`updated ${policyFile}`);
        console.log(`  added as unreviewed: ${String(reconciled.added.length)}`);
        console.log(`  no longer in the snapshot (kept): ${String(reconciled.missing.length)}`);
    }
    console.log(`  publish/exclude/unreviewed counts: npm run publication:review`);
    console.log(`  still unreviewed: ${String(unreviewedBooks(reconciled.policy, snapshot).length)}`);
}

await main();
