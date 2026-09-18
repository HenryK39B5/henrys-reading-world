import { readFile } from 'node:fs/promises';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { Snapshot } from '../src/domain/types.ts';
import { validateSnapshot } from '../src/domain/validate.ts';
import {
    EMBEDDING_CACHE_SCHEMA_VERSION,
    EMBEDDING_INPUT_VERSION,
    highlightTextHash,
    lexicalHashEmbedding,
    snapshotEmbeddingHash,
    type EmbeddingCache,
    type EvaluationCorpus,
} from './embeddings/core.ts';
import { evaluateEmbeddings, parseEvaluationLabels } from './embeddings/evaluation.ts';
import { embeddingPrivatePaths, LOCAL_SNAPSHOT_PATH } from './embeddings/privatePaths.ts';

async function writeJsonAtomic(path: string, value: unknown): Promise<void> {
    await mkdir(dirname(path), { recursive: true });
    const temporary = `${path}.tmp-${String(process.pid)}`;
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    await rename(temporary, path);
}

async function main(): Promise<void> {
    const paths = embeddingPrivatePaths();
    const snapshotRaw = JSON.parse(await readFile(LOCAL_SNAPSHOT_PATH, 'utf8')) as unknown;
    const checked = validateSnapshot(snapshotRaw, { expectedVisibility: 'local-only' });
    if (!checked.ok) {
        throw new Error(`local snapshot does not validate: ${checked.errors.join('; ')}`);
    }
    const snapshot: Snapshot = checked.snapshot;
    const corpus = JSON.parse(await readFile(paths.corpus, 'utf8')) as EvaluationCorpus;
    const labels = parseEvaluationLabels(JSON.parse(await readFile(paths.labels, 'utf8')) as unknown);
    const snapshotHash = snapshotEmbeddingHash(snapshot);
    if (corpus.snapshotHash !== snapshotHash || corpus.entries.length !== corpus.targetCount) {
        throw new Error('evaluation corpus is stale; run npm run embeddings:prepare again');
    }
    const dimensions = 512;
    const highlights = new Map(snapshot.highlights.map((highlight) => [highlight.id, highlight]));
    const startedAt = Date.now();
    const cache: EmbeddingCache = {
        schemaVersion: EMBEDDING_CACHE_SCHEMA_VERSION,
        provider: 'baseline',
        model: 'lexical-hash-v1-not-a-provider',
        dimensions,
        inputVersion: EMBEDDING_INPUT_VERSION,
        snapshotHash,
        generatedAt: new Date().toISOString(),
        requests: 0,
        vectors: {},
    };
    for (const entry of corpus.entries) {
        const highlight = highlights.get(entry.id);
        if (highlight === undefined) {
            throw new Error(`evaluation corpus references missing highlight ${entry.id}`);
        }
        cache.vectors[entry.id] = {
            textHash: highlightTextHash(highlight),
            values: lexicalHashEmbedding(highlight.text, dimensions),
        };
    }
    const metrics = evaluateEmbeddings(corpus, labels, cache.vectors);
    const elapsedMilliseconds = Date.now() - startedAt;
    const cachePath = resolve(paths.cache, `baseline--lexical-hash-v1--${String(dimensions)}.json`);
    const reportPath = resolve(paths.reports, `baseline--lexical-hash-v1--${String(dimensions)}.json`);
    await writeJsonAtomic(cachePath, cache);
    await writeJsonAtomic(reportPath, {
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        kind: 'non-semantic-baseline',
        model: 'lexical-hash-v1',
        dimensions,
        corpusHighlights: corpus.entries.length,
        evaluationCases: labels.cases.length,
        elapsedMilliseconds,
        metrics,
    });
    const manifest = JSON.parse(await readFile(paths.manifest, 'utf8')) as {
        schemaVersion: number;
        updatedAt: string;
        snapshotHash: string;
        inputVersion: string;
        evaluation: { corpus: number; cases: number };
        runs: Record<string, unknown>;
        baselines: Record<string, unknown>;
    };
    if (
        manifest.schemaVersion !== 1 ||
        manifest.snapshotHash !== snapshotHash ||
        manifest.inputVersion !== EMBEDDING_INPUT_VERSION ||
        typeof manifest.runs !== 'object' ||
        manifest.runs === null ||
        typeof manifest.baselines !== 'object' ||
        manifest.baselines === null
    ) {
        throw new Error('embedding manifest is stale or invalid; run npm run embeddings:prepare again');
    }
    manifest.updatedAt = new Date().toISOString();
    manifest.evaluation = { corpus: corpus.entries.length, cases: labels.cases.length };
    manifest.baselines['lexical-hash-v1:512'] = {
        model: 'lexical-hash-v1',
        dimensions,
        cache: 'vectors/baseline--lexical-hash-v1--512.json',
        report: 'evaluation/reports/baseline--lexical-hash-v1--512.json',
    };
    await writeJsonAtomic(paths.manifest, manifest);
    console.log(`lexical baseline: ${String(corpus.entries.length)} passages, ${String(labels.cases.length)} cases`);
    console.log(`MRR: ${metrics.meanReciprocalRank.toFixed(4)}; recall@10: ${metrics.recallAt10.toFixed(4)}`);
    console.log(`pair accuracy: ${metrics.pairAccuracy.toFixed(4)}; book diversity@10: ${metrics.neighborhoodBookDiversityAt10.toFixed(4)}`);
    console.log(`private report: ${reportPath}`);
}

await main();
