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
} from './embeddings/core.ts';
import { embeddingPrivatePaths, LOCAL_SNAPSHOT_PATH } from './embeddings/privatePaths.ts';
import { apiKeyForProviderOrEnvFile, createEmbeddingProvider } from './embeddings/providers.ts';

type Args = {
    provider: EmbeddingProviderName;
    model?: string;
    dimensions?: number;
    batchSize?: number;
    delayMs: number;
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
    if (provider !== 'voyage' && provider !== 'cohere' && provider !== 'openai' && provider !== 'siliconflow') {
        throw new Error('--provider must be voyage, cohere, openai, or siliconflow');
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
    if (dimensions !== undefined && !Number.isInteger(dimensions)) {
        throw new Error('--dimensions must be an integer');
    }
    if (batchSize !== undefined && !Number.isInteger(batchSize)) {
        throw new Error('--batch-size must be an integer');
    }
    const model = values.get('model');
    return {
        provider,
        ...(model === undefined ? {} : { model }),
        ...(dimensions === undefined ? {} : { dimensions }),
        ...(batchSize === undefined ? {} : { batchSize }),
        delayMs: numberArg('delay-ms') ?? 0,
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
    const snapshotRaw = JSON.parse(await readFile(LOCAL_SNAPSHOT_PATH, 'utf8')) as unknown;
    const checked = validateSnapshot(snapshotRaw, { expectedVisibility: 'local-only' });
    if (!checked.ok) {
        throw new Error(`local snapshot does not validate: ${checked.errors.join('; ')}`);
    }
    const snapshot: Snapshot = checked.snapshot;
    const snapshotHash = snapshotEmbeddingHash(snapshot);
    const provider = createEmbeddingProvider(args.provider, {
        apiKey: await apiKeyForProviderOrEnvFile(args.provider),
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
        snapshotHash,
    } as const;
    const cachePath = resolve(paths.cache, `${provider.name}--${safeName(provider.model)}--${String(provider.dimensions)}.json`);
    const cache = await loadCache(cachePath, expected);
    const highlights = [...snapshot.highlights].sort((left, right) => left.id.localeCompare(right.id));
    const pending = highlights.filter((highlight) => cache.vectors[highlight.id]?.textHash !== highlightTextHash(highlight));
    const previousCachedHighlights = Object.keys(cache.vectors).length;
    const startedAt = Date.now();

    for (let offset = 0; offset < pending.length; offset += batchSize) {
        const batch = pending.slice(offset, offset + batchSize);
        const result = await provider.embed(batch.map((highlight) => normalizeEmbeddingText(highlight.text)));
        batch.forEach((highlight, index) => {
            const vector = result.vectors[index];
            if (vector === undefined) {
                throw new Error('embedding provider returned an incomplete batch');
            }
            cache.vectors[highlight.id] = { textHash: highlightTextHash(highlight), values: vector };
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

    for (const highlight of highlights) {
        if (cache.vectors[highlight.id]?.textHash !== highlightTextHash(highlight)) {
            throw new Error(`full embedding cache is incomplete for ${highlight.id}`);
        }
    }
    const generatedAt = new Date().toISOString();
    const summaryPath = resolve(paths.root, `full-generation--${provider.name}--${safeName(provider.model)}--${String(provider.dimensions)}.json`);
    await writeJsonAtomic(summaryPath, {
        schemaVersion: 1,
        generatedAt,
        provider: provider.name,
        model: provider.model,
        dimensions: provider.dimensions,
        snapshotHash,
        totalHighlights: highlights.length,
        previousCachedHighlights,
        requestedHighlights: pending.length,
        cachedHighlights: Object.keys(cache.vectors).length,
        requests: cache.requests,
        inputTokens: cache.inputTokens ?? null,
        elapsedMilliseconds: Date.now() - startedAt,
    });

    if (!existsSync(paths.manifest)) {
        throw new Error('embedding manifest is missing; run npm run embeddings:prepare first');
    }
    const manifest = JSON.parse(await readFile(paths.manifest, 'utf8')) as {
        schemaVersion: number;
        updatedAt: string;
        snapshotHash: string;
        inputVersion: string;
        evaluation: { corpus: number; cases: number };
        runs: Record<string, Record<string, unknown>>;
        baselines: Record<string, unknown>;
    };
    if (
        manifest.schemaVersion !== 1 ||
        manifest.snapshotHash !== snapshotHash ||
        manifest.inputVersion !== EMBEDDING_INPUT_VERSION ||
        typeof manifest.runs !== 'object' ||
        manifest.runs === null
    ) {
        throw new Error('existing embedding manifest is stale or invalid');
    }
    const runKey = `${provider.name}:${provider.model}:${String(provider.dimensions)}`;
    const existingRun = manifest.runs[runKey] ?? {};
    manifest.updatedAt = generatedAt;
    manifest.runs[runKey] = {
        ...existingRun,
        provider: provider.name,
        model: provider.model,
        dimensions: provider.dimensions,
        cache: relative(paths.root, cachePath).replace(/\\/gu, '/'),
        inputTokens: cache.inputTokens ?? null,
        cachedHighlights: Object.keys(cache.vectors).length,
        fullGeneration: relative(paths.root, summaryPath).replace(/\\/gu, '/'),
    };
    await writeJsonAtomic(paths.manifest, manifest);

    console.log(`provider: ${provider.name}`);
    console.log(`model: ${provider.model}`);
    console.log(`dimensions: ${String(provider.dimensions)}`);
    console.log(`snapshot highlights: ${String(highlights.length)}`);
    console.log(`newly requested: ${String(pending.length)}`);
    console.log(`cached highlights: ${String(Object.keys(cache.vectors).length)}`);
    console.log(`private summary: ${summaryPath}`);
}

await main();
