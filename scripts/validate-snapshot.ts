/**
 * Validate a snapshot file against the data contract.
 *
 * Usage:
 *   npm run validate:data:local   -> .private/local-snapshot.json (local-only)
 *   npm run validate:data          -> src/data/public-snapshot.json (public)
 *   node scripts/validate-snapshot.ts <path> [--visibility public|local-only]
 *
 * Exit code 1 on structural errors. Coverage gaps are warnings and do not fail the run.
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Visibility } from '../src/domain/types.ts';
import { validateSnapshot } from '../src/domain/validate.ts';

function parseArgs(argv: string[]): { target: string; visibility: Visibility | undefined } {
    let target = 'src/data/public-snapshot.json';
    let visibility: Visibility | undefined;
    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        if (arg === '--visibility') {
            const value = argv[index + 1];
            if (value !== 'public' && value !== 'local-only') {
                throw new Error('--visibility expects public or local-only');
            }
            visibility = value;
            index += 1;
            continue;
        }
        if (arg !== undefined && !arg.startsWith('--')) {
            target = arg;
        }
    }
    return { target, visibility };
}

async function main(): Promise<void> {
    const { target, visibility: visibilityArg } = parseArgs(process.argv.slice(2));
    const path = resolve(process.cwd(), target);
    const expectedVisibility = visibilityArg ?? (target.includes('.private') ? 'local-only' : 'public');

    let raw: string;
    try {
        raw = await readFile(path, 'utf8');
    } catch {
        console.error(`snapshot not readable: ${target}`);
        process.exitCode = 1;
        return;
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        console.error(`snapshot is not valid JSON: ${target}`);
        process.exitCode = 1;
        return;
    }

    const result = validateSnapshot(parsed, { expectedVisibility });
    if (!result.ok) {
        console.error(`FAIL ${target} (expected visibility: ${expectedVisibility})`);
        for (const error of result.errors) {
            console.error(`  - ${error}`);
        }
        process.exitCode = 1;
        return;
    }

    const warnings = result.warnings;
    console.log(`OK ${target} (visibility: ${expectedVisibility})`);
    console.log(
        `   highlights: ${String(result.snapshot.highlights.length)}, books: ${String(result.snapshot.books.length)}, themes: ${String(result.snapshot.themes.length)}`,
    );
    if (warnings.length > 0) {
        console.log(`   coverage warnings (${String(warnings.length)}):`);
        for (const warning of warnings) {
            console.log(`     - ${warning}`);
        }
    }
}

try {
    await main();
} catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
}
