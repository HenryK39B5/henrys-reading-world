import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import type { Snapshot } from '../src/domain/types.ts';
import { validateSnapshot } from '../src/domain/validate.ts';
import {
    EMBEDDING_CACHE_SCHEMA_VERSION,
    EMBEDDING_INPUT_VERSION,
    highlightTextHash,
    normalizeEmbeddingText,
    snapshotEmbeddingHash,
    type EmbeddingCache,
    type EmbeddingProviderName,
    type EvaluationCorpus,
} from './embeddings/core.ts';
import { evaluateEmbeddings, parseEvaluationLabels } from './embeddings/evaluation.ts';
import { embeddingPrivatePaths, LOCAL_SNAPSHOT_PATH } from './embeddings/privatePaths.ts';
import { apiKeyForProviderOrEnvFile, createEmbeddingProvider, providerDefaults } from './embeddings/providers.ts';

type Args = {
    provider: EmbeddingProviderName;
    model?: string;
    dimensions?: number;
    batchSize?: number;
    delayMs: number;
    pricePerMillionTokens?: number;
    priceCurrency?: 'USD' | 'CNY';
};

function readArgs(argv: string[]): Args {
    const values = new Map<string, string>();
    for (let index = 0; index < argv.length; index += 1) {
        const key = argv[index];
        if (!key?.startsWith('--')) {
            throw new Error(`unexpected argument ${key ?? ''}`);
        }
        const value = argv[index + 1];
        if (value === undefined || value.startsWith('--')) {
            throw new Error(`missing value for ${key}`);
        }
        values.set(key.slice(2), value);
        index += 1;
    }
    const provider = values.get('provider');
    if (provider !== 'voyage' && provider !== 'cohere' && provider !== 'openai' && provider !== 'siliconflow' && provider !== 'local') {
        throw new Error('--provider must be voyage, cohere, openai, siliconflow, or local');
    }
    const numberArg = (name: string): number | undefined => {
        const value = values.get(name);
        if (value === undefined) {
            return undefined;
        }
        const parsed = Number(value);
        if (!Number.isFinite(parsed) || parsed <= 0) {
            throw new Error(`--${name} must be a positive number`);
        }
        return parsed;
    };
    const dimensions = numberArg('dimensions');
    const batchSize = numberArg('batch-size');
    const pricePerMillionTokens = numberArg('price-per-million-tokens');
    if (dimensions !== undefined && !Number.isInteger(dimensions)) {
        throw new Error('--dimensions must be an integer');
    }
    if (batchSize !== undefined && !Number.isInteger(batchSize)) {
        throw new Error('--batch-size must be an integer');
    }
    const model = values.get('model');
    const priceCurrencyRaw = values.get('price-currency');
    if (priceCurrencyRaw !== undefined && priceCurrencyRaw !== 'USD' && priceCurrencyRaw !== 'CNY') {
        throw new Error('--price-currency must be USD or CNY');
    }
    if (priceCurrencyRaw !== undefined && pricePerMillionTokens === undefined) {
        throw new Error('--price-currency requires --price-per-million-tokens');
    }
    return {
        provider,
        ...(model === undefined ? {} : { model }),
        ...(dimensions === undefined ? {} : { dimensions }),
        ...(batchSize === undefined ? {} : { batchSize }),
        delayMs: numberArg('delay-ms') ?? 0,
        ...(pricePerMillionTokens === undefined ? {} : { pricePerMillionTokens }),
        ...(pricePerMillionTokens === undefined ? {} : { priceCurrency: priceCurrencyRaw ?? 'USD' }),
    };
}

async function writeJsonAtomic(path: string, value: unknown): Promise<void> {
    await mkdir(dirname(path), { recursive: true });
    const temporary = `${path}.tmp-${String(process.pid)}`;
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    await rename(temporary, path);
}

function safeName(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9._-]+/gu, '-');
}

async function loadCache(path: string, expected: Omit<EmbeddingCache, 'generatedAt' | 'requests' | 'inputTokens' | 'vectors'>): Promise<EmbeddingCache> {
    if (!existsSync(path)) {
        return { ...expected, generatedAt: new Date(0).toISOString(), requests: 0, vectors: {} };
    }
    const parsed = JSON.parse(await readFile(path, 'utf8')) as Partial<EmbeddingCache>;
    if (
        parsed.schemaVersion !== expected.schemaVersion ||
        parsed.provider !== expected.provider ||
        parsed.model !== expected.model ||
        parsed.dimensions !== expected.dimensions ||
        parsed.inputVersion !== expected.inputVersion ||
        parsed.snapshotHash !== expected.snapshotHash ||
        typeof parsed.vectors !== 'object' ||
        parsed.vectors === null ||
        typeof parsed.generatedAt !== 'string' ||
        typeof parsed.requests !== 'number'
    ) {
        throw new Error(`existing embedding cache does not match this run: ${path}`);
    }
    for (const [highlightId, entry] of Object.entries(parsed.vectors)) {
        if (
            typeof entry !== 'object' ||
            entry === null ||
            typeof entry.textHash !== 'string' ||
            !Array.isArray(entry.values) ||
            entry.values.length !== expected.dimensions ||
            entry.values.some((value) => typeof value !== 'number' || !Number.isFinite(value))
        ) {
            throw new Error(`existing embedding cache contains an invalid vector for ${highlightId}`);
        }
    }
    return parsed as EmbeddingCache;
}

async function main(): Promise<void> {
    const args = readArgs(process.argv.slice(2));
    const paths = embeddingPrivatePaths();
    if (!existsSync(paths.corpus) || !existsSync(paths.labels)) {
        throw new Error('evaluation corpus is missing; run npm run embeddings:prepare first');
    }
    const snapshotRaw = JSON.parse(await readFile(LOCAL_SNAPSHOT_PATH, 'utf8')) as unknown;
    const checked = validateSnapshot(snapshotRaw, { expectedVisibility: 'local-only' });
    if (!checked.ok) {
        throw new Error(`local snapshot does not validate: ${checked.errors.join('; ')}`);
    }
    const snapshot: Snapshot = checked.snapshot;
    const corpus = JSON.parse(await readFile(paths.corpus, 'utf8')) as EvaluationCorpus;
    const labels = parseEvaluationLabels(JSON.parse(await readFile(paths.labels, 'utf8')) as unknown);
    const currentSnapshotHash = snapshotEmbeddingHash(snapshot);
    if (corpus.snapshotHash !== currentSnapshotHash || corpus.entries.length !== corpus.targetCount) {
        throw new Error('evaluation corpus is stale; run npm run embeddings:prepare again');
    }

    const defaults = providerDefaults(args.provider);
    const provider = createEmbeddingProvider(args.provider, {
        ...(args.provider === 'local' ? {} : { apiKey: await apiKeyForProviderOrEnvFile(args.provider) }),
        ...(args.model === undefined ? {} : { model: args.model }),
        ...(args.dimensions === undefined ? {} : { dimensions: args.dimensions }),
    });
    const batchSize = Math.min(args.batchSize ?? provider.batchLimit, provider.batchLimit);
    const expected = {
        schemaVersion: EMBEDDING_CACHE_SCHEMA_VERSION,
        provider: provider.name,
        model: provider.model,
        dimensions: provider.dimensions,
        inputVersion: EMBEDDING_INPUT_VERSION,
        snapshotHash: currentSnapshotHash,
    } as const;
    const cachePath = resolve(paths.cache, `${provider.name}--${safeName(provider.model)}--${String(provider.dimensions)}.json`);
    const cache = await loadCache(cachePath, expected);
    const highlights = new Map(snapshot.highlights.map((highlight) => [highlight.id, highlight]));
    const pending = corpus.entries.filter((entry) => {
        const highlight = highlights.get(entry.id);
        if (highlight === undefined) {
            throw new Error(`evaluation corpus references missing highlight ${entry.id}`);
        }
        return cache.vectors[entry.id]?.textHash !== highlightTextHash(highlight);
    });

    const startedAt = Date.now();
    for (let offset = 0; offset < pending.length; offset += batchSize) {
        const batch = pending.slice(offset, offset + batchSize);
        const texts = batch.map((entry) => normalizeEmbeddingText(highlights.get(entry.id)?.text ?? ''));
        const result = await provider.embed(texts);
        batch.forEach((entry, index) => {
            const vector = result.vectors[index];
            const highlight = highlights.get(entry.id);
            if (vector === undefined || highlight === undefined) {
                throw new Error('embedding provider returned an incomplete batch');
            }
            cache.vectors[entry.id] = { textHash: highlightTextHash(highlight), values: vector };
        });
        cache.requests += 1;
        if (result.usage.inputTokens !== undefined) {
            cache.inputTokens = (cache.inputTokens ?? 0) + result.usage.inputTokens;
        }
        cache.generatedAt = new Date().toISOString();
        await writeJsonAtomic(cachePath, cache);
        const completed = Math.min(offset + batch.length, pending.length);
        console.log(`embedded ${String(completed)} / ${String(pending.length)} pending passages`);
        if (args.delayMs > 0 && completed < pending.length) {
            await new Promise((resolveDelay) => setTimeout(resolveDelay, args.delayMs));
        }
    }

    if (Object.keys(cache.vectors).length < corpus.entries.length) {
        throw new Error('embedding cache is incomplete after the run');
    }
    if (labels.cases.length === 0) {
        throw new Error('evaluation labels are empty; curate private labels before comparing providers');
    }
    const metrics = evaluateEmbeddings(corpus, labels, cache.vectors);
    const elapsedMilliseconds = Date.now() - startedAt;
    const estimatedCost =
        args.pricePerMillionTokens === undefined || cache.inputTokens === undefined || args.priceCurrency === undefined
            ? undefined
            : {
                  currency: args.priceCurrency,
                  amount: (cache.inputTokens / 1_000_000) * args.pricePerMillionTokens,
              };
    const report = {
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        provider: provider.name,
        model: provider.model,
        dimensions: provider.dimensions,
        corpusHighlights: corpus.entries.length,
        evaluationCases: labels.cases.length,
        requests: cache.requests,
        inputTokens: cache.inputTokens ?? null,
        elapsedMilliseconds,
        estimatedCost: estimatedCost ?? null,
        metrics,
    };
    const reportPath = resolve(paths.reports, `${provider.name}--${safeName(provider.model)}--${String(provider.dimensions)}.json`);
    await writeJsonAtomic(reportPath, report);
    const runKey = `${provider.name}:${provider.model}:${String(provider.dimensions)}`;
    let manifest: {
        schemaVersion: 1;
        updatedAt: string;
        snapshotHash: string;
        inputVersion: typeof EMBEDDING_INPUT_VERSION;
        evaluation: { corpus: number; cases: number };
        runs: Record<
            string,
            {
                provider: EmbeddingProviderName;
                model: string;
                dimensions: number;
                cache: string;
                report: string;
                inputTokens: number | null;
                estimatedCost: { currency: 'USD' | 'CNY'; amount: number } | null;
                cachedHighlights: number;
            }
        >;
        baselines: Record<string, unknown>;
    } = {
        schemaVersion: 1,
        updatedAt: new Date().toISOString(),
        snapshotHash: currentSnapshotHash,
        inputVersion: EMBEDDING_INPUT_VERSION,
        evaluation: { corpus: corpus.entries.length, cases: labels.cases.length },
        runs: {},
        baselines: {},
    };
    if (existsSync(paths.manifest)) {
        const stored = JSON.parse(await readFile(paths.manifest, 'utf8')) as typeof manifest;
        if (
            stored.schemaVersion !== 1 ||
            stored.snapshotHash !== currentSnapshotHash ||
            stored.inputVersion !== EMBEDDING_INPUT_VERSION ||
            typeof stored.runs !== 'object' ||
            stored.runs === null ||
            typeof stored.baselines !== 'object' ||
            stored.baselines === null
        ) {
            throw new Error('existing embedding manifest is stale or invalid');
        }
        manifest = stored;
    }
    manifest.updatedAt = new Date().toISOString();
    manifest.evaluation = { corpus: corpus.entries.length, cases: labels.cases.length };
    manifest.runs[runKey] = {
        provider: provider.name,
        model: provider.model,
        dimensions: provider.dimensions,
        cache: relative(paths.root, cachePath).replace(/\\/gu, '/'),
        report: relative(paths.root, reportPath).replace(/\\/gu, '/'),
        inputTokens: cache.inputTokens ?? null,
        estimatedCost: estimatedCost ?? null,
        cachedHighlights: Object.keys(cache.vectors).length,
    };
    await writeJsonAtomic(paths.manifest, manifest);

    console.log(`provider: ${provider.name}`);
    console.log(`model: ${provider.model}`);
    console.log(`dimensions: ${String(provider.dimensions)} (default ${String(defaults.dimensions)})`);
    console.log(`evaluation cases: ${String(metrics.cases)}`);
    console.log(`MRR: ${metrics.meanReciprocalRank.toFixed(4)}; recall@10: ${metrics.recallAt10.toFixed(4)}`);
    console.log(`pair accuracy: ${metrics.pairAccuracy.toFixed(4)}; book diversity@10: ${metrics.neighborhoodBookDiversityAt10.toFixed(4)}`);
    console.log(`private report: ${reportPath}`);
}

await main();
