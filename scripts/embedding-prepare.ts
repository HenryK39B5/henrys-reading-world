import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import {
    EMBEDDING_EVALUATION_SCHEMA_VERSION,
    EMBEDDING_INPUT_VERSION,
    snapshotEmbeddingHash,
    type EvaluationCorpus,
    type EvaluationLabels,
} from './embeddings/core.ts';
import { corpusCoverage, labelHighlightIds, parseEvaluationLabels, selectEvaluationCorpus } from './embeddings/evaluation.ts';
import { embeddingPrivatePaths, LOCAL_SNAPSHOT_PATH } from './embeddings/privatePaths.ts';
import { validateSnapshot } from '../src/domain/validate.ts';

async function writeJsonAtomic(path: string, value: unknown): Promise<void> {
    await mkdir(dirname(path), { recursive: true });
    const temporary = `${path}.tmp-${String(process.pid)}`;
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    await rename(temporary, path);
}

async function main(): Promise<void> {
    const snapshot = JSON.parse(await readFile(LOCAL_SNAPSHOT_PATH, 'utf8')) as unknown;
    const checked = validateSnapshot(snapshot, { expectedVisibility: 'local-only' });
    if (!checked.ok) {
        throw new Error(`local snapshot does not validate: ${checked.errors.join('; ')}`);
    }
    const paths = embeddingPrivatePaths();
    let labels: EvaluationLabels = { schemaVersion: EMBEDDING_EVALUATION_SCHEMA_VERSION, cases: [] };
    if (existsSync(paths.labels)) {
        labels = parseEvaluationLabels(JSON.parse(await readFile(paths.labels, 'utf8')) as unknown);
    }
    const targetCount = 300;
    const snapshotHash = snapshotEmbeddingHash(checked.snapshot);
    const entries = selectEvaluationCorpus(checked.snapshot, targetCount, labelHighlightIds(labels));
    const corpus: EvaluationCorpus = {
        schemaVersion: EMBEDDING_EVALUATION_SCHEMA_VERSION,
        selectionVersion: 'all-books-theme-length-v1',
        generatedAt: new Date().toISOString(),
        snapshotHash,
        targetCount,
        entries,
    };
    await writeJsonAtomic(paths.corpus, corpus);
    if (!existsSync(paths.labels)) {
        await writeJsonAtomic(paths.labels, labels);
    }
    let runs: Record<string, unknown> = {};
    let baselines: Record<string, unknown> = {};
    if (existsSync(paths.manifest)) {
        const stored = JSON.parse(await readFile(paths.manifest, 'utf8')) as {
            schemaVersion?: number;
            snapshotHash?: string;
            inputVersion?: string;
            runs?: unknown;
            baselines?: unknown;
        };
        if (
            stored.schemaVersion === 1 &&
            stored.snapshotHash === snapshotHash &&
            stored.inputVersion === EMBEDDING_INPUT_VERSION &&
            typeof stored.runs === 'object' &&
            stored.runs !== null &&
            typeof stored.baselines === 'object' &&
            stored.baselines !== null
        ) {
            runs = stored.runs as Record<string, unknown>;
            baselines = stored.baselines as Record<string, unknown>;
        }
    }
    await writeJsonAtomic(paths.manifest, {
        schemaVersion: 1,
        updatedAt: new Date().toISOString(),
        snapshotHash,
        inputVersion: EMBEDDING_INPUT_VERSION,
        evaluation: { corpus: entries.length, cases: labels.cases.length },
        runs,
        baselines,
    });
    const coverage = corpusCoverage(corpus, checked.snapshot.highlights);
    console.log(`embedding evaluation corpus: ${String(entries.length)} highlights`);
    console.log(`coverage: ${String(coverage.books)} books, ${String(coverage.themes)} book themes`);
    console.log(`length bands: ${String(coverage.short)} short, ${String(coverage.medium)} medium, ${String(coverage.long)} long`);
    console.log(`non-whitespace characters: ${String(coverage.characters)}`);
    console.log(`manual evaluation cases: ${String(labels.cases.length)}`);
    console.log(`private output: ${paths.evaluation}`);
}

await main();
