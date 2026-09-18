import type { EmbeddingBatch, EmbeddingProvider, EmbeddingProviderName } from './core.ts';
import { validateVectors } from './core.ts';

type FetchLike = typeof fetch;
type Sleep = (milliseconds: number) => Promise<void>;

type ProviderOptions = {
    apiKey: string;
    model?: string;
    dimensions?: number;
    fetchImpl?: FetchLike;
    sleep?: Sleep;
    maxAttempts?: number;
};

type JsonRecord = Record<string, unknown>;

const ENDPOINTS: Record<EmbeddingProviderName, string> = {
    voyage: 'https://api.voyageai.com/v1/embeddings',
    cohere: 'https://api.cohere.com/v2/embed',
    openai: 'https://api.openai.com/v1/embeddings',
};

const DEFAULTS: Record<EmbeddingProviderName, { model: string; dimensions: number; batchLimit: number }> = {
    voyage: { model: 'voyage-4-lite', dimensions: 512, batchLimit: 128 },
    cohere: { model: 'embed-v4.0', dimensions: 512, batchLimit: 96 },
    openai: { model: 'text-embedding-3-small', dimensions: 512, batchLimit: 128 },
};

const ENV_KEYS: Record<EmbeddingProviderName, string> = {
    voyage: 'VOYAGE_API_KEY',
    cohere: 'COHERE_API_KEY',
    openai: 'OPENAI_API_KEY',
};

function isRecord(value: unknown): value is JsonRecord {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown): number | undefined {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function positiveInteger(value: unknown): number | undefined {
    return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : undefined;
}

function readVector(value: unknown): number[] | null {
    if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'number' || !Number.isFinite(entry))) {
        return null;
    }
    return value as number[];
}

function parseOpenAiShape(value: unknown): { vectors: number[][]; inputTokens?: number } {
    if (!isRecord(value) || !Array.isArray(value.data)) {
        throw new Error('provider returned an unsupported embedding response shape');
    }
    const indexed = value.data.map((entry) => {
        if (!isRecord(entry)) {
            throw new Error('provider returned an invalid embedding item');
        }
        const vector = readVector(entry.embedding);
        const index = positiveInteger(entry.index) ?? (entry.index === 0 ? 0 : undefined);
        if (vector === null || index === undefined) {
            throw new Error('provider returned an invalid embedding item');
        }
        return { index, vector };
    });
    indexed.sort((left, right) => left.index - right.index);
    const usage = isRecord(value.usage) ? finiteNumber(value.usage.total_tokens) : undefined;
    return { vectors: indexed.map((entry) => entry.vector), ...(usage === undefined ? {} : { inputTokens: usage }) };
}

function parseCohereShape(value: unknown): { vectors: number[][]; inputTokens?: number } {
    if (!isRecord(value) || !isRecord(value.embeddings) || !Array.isArray(value.embeddings.float)) {
        throw new Error('cohere returned an unsupported embedding response shape');
    }
    const vectors = value.embeddings.float.map((entry) => {
        const vector = readVector(entry);
        if (vector === null) {
            throw new Error('cohere returned an invalid embedding item');
        }
        return vector;
    });
    const billedUnits = isRecord(value.meta) && isRecord(value.meta.billed_units) ? value.meta.billed_units : undefined;
    const inputTokens = billedUnits === undefined ? undefined : finiteNumber(billedUnits.input_tokens);
    return { vectors, ...(inputTokens === undefined ? {} : { inputTokens }) };
}

function categoryForStatus(status: number): 'rate-limit' | 'provider' | 'auth' | 'request' {
    if (status === 401 || status === 403) {
        return 'auth';
    }
    if (status === 429) {
        return 'rate-limit';
    }
    if (status >= 500) {
        return 'provider';
    }
    return 'request';
}

function retryableStatus(status: number): boolean {
    return status === 408 || status === 409 || status === 429 || status >= 500;
}

async function requestJson(
    provider: EmbeddingProviderName,
    apiKey: string,
    body: JsonRecord,
    fetchImpl: FetchLike,
    sleep: Sleep,
    maxAttempts: number,
): Promise<unknown> {
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        let response: Response;
        try {
            response = await fetchImpl(ENDPOINTS[provider], {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                    ...(provider === 'cohere' ? { 'X-Client-Name': 'henrys-reading-world-private-studio' } : {}),
                },
                body: JSON.stringify(body),
            });
        } catch {
            if (attempt < maxAttempts) {
                await sleep(250 * 2 ** (attempt - 1));
                continue;
            }
            throw new Error(`${provider} embedding request failed: network`);
        }
        if (response.ok) {
            return response.json() as Promise<unknown>;
        }
        if (retryableStatus(response.status) && attempt < maxAttempts) {
            const retryAfter = Number(response.headers.get('retry-after'));
            const delay = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 250 * 2 ** (attempt - 1);
            await sleep(delay);
            continue;
        }
        throw new Error(`${provider} embedding request failed: ${categoryForStatus(response.status)} (${String(response.status)})`);
    }
    throw new Error(`${provider} embedding request failed: exhausted retries`);
}

function providerBody(name: EmbeddingProviderName, model: string, dimensions: number, texts: string[]): JsonRecord {
    switch (name) {
        case 'voyage':
            return {
                input: texts,
                model,
                output_dimension: dimensions,
                output_dtype: 'float',
            };
        case 'cohere':
            return {
                texts,
                model,
                input_type: 'clustering',
                output_dimension: dimensions,
                embedding_types: ['float'],
            };
        case 'openai':
            return { input: texts, model, dimensions, encoding_format: 'float' };
    }
}

export function createEmbeddingProvider(name: EmbeddingProviderName, options: ProviderOptions): EmbeddingProvider {
    if (options.apiKey.trim().length === 0) {
        throw new Error(`${name}: API key is empty`);
    }
    const defaults = DEFAULTS[name];
    const model = options.model?.trim() || defaults.model;
    const dimensions = options.dimensions ?? defaults.dimensions;
    if (!Number.isInteger(dimensions) || dimensions <= 0) {
        throw new Error(`${name}: dimensions must be a positive integer`);
    }
    const fetchImpl = options.fetchImpl ?? fetch;
    const sleep = options.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
    const maxAttempts = options.maxAttempts ?? 4;

    return {
        name,
        model,
        dimensions,
        batchLimit: defaults.batchLimit,
        async embed(texts): Promise<EmbeddingBatch> {
            if (texts.length === 0 || texts.length > defaults.batchLimit) {
                throw new Error(`${name}: batch size must be between 1 and ${String(defaults.batchLimit)}`);
            }
            const response = await requestJson(name, options.apiKey, providerBody(name, model, dimensions, texts), fetchImpl, sleep, maxAttempts);
            const parsed = name === 'cohere' ? parseCohereShape(response) : parseOpenAiShape(response);
            validateVectors(parsed.vectors, texts.length, dimensions);
            return {
                vectors: parsed.vectors,
                usage: parsed.inputTokens === undefined ? {} : { inputTokens: parsed.inputTokens },
            };
        },
    };
}

export function apiKeyForProvider(name: EmbeddingProviderName, env: NodeJS.ProcessEnv = process.env): string {
    const secureName = ENV_KEYS[name];
    const insecureName = `VITE_${secureName}`;
    if ((env[insecureName] ?? '').trim().length > 0) {
        throw new Error(`${insecureName} is forbidden; embedding credentials must never use a VITE_ prefix`);
    }
    const value = (env[secureName] ?? '').trim();
    if (value.length === 0) {
        throw new Error(`${secureName} is not set`);
    }
    return value;
}

export function providerDefaults(name: EmbeddingProviderName): Readonly<{ model: string; dimensions: number; batchLimit: number }> {
    return DEFAULTS[name];
}
