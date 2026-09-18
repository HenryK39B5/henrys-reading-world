import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { apiKeyForProvider, apiKeyForProviderOrEnvFile, createEmbeddingProvider } from '../scripts/embeddings/providers.ts';

describe('embedding providers', () => {
    it('sends Voyage similarity embeddings without exposing configuration to the browser', async () => {
        const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
            new Response(
                JSON.stringify({
                    data: [
                        { index: 1, embedding: [0, 1] },
                        { index: 0, embedding: [1, 0] },
                    ],
                    usage: { total_tokens: 7 },
                }),
                { status: 200, headers: { 'content-type': 'application/json' } },
            ),
        );
        const provider = createEmbeddingProvider('voyage', {
            apiKey: 'private-test-key',
            model: 'voyage-test',
            dimensions: 2,
            fetchImpl,
        });

        const result = await provider.embed(['甲', '乙']);

        expect(result).toEqual({ vectors: [[1, 0], [0, 1]], usage: { inputTokens: 7 } });
        expect(fetchImpl).toHaveBeenCalledOnce();
        const [, request] = fetchImpl.mock.calls[0] ?? [];
        const body = JSON.parse(String(request?.body)) as Record<string, unknown>;
        expect(body).toMatchObject({
            input: ['甲', '乙'],
            model: 'voyage-test',
            output_dimension: 2,
        });
        expect(request?.headers).toMatchObject({ Authorization: 'Bearer private-test-key' });
    });

    it('parses Cohere float embeddings and billed input tokens', async () => {
        const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
            new Response(
                JSON.stringify({
                    embeddings: { float: [[1, 0], [0, 1]] },
                    meta: { billed_units: { input_tokens: 9 } },
                }),
                { status: 200, headers: { 'content-type': 'application/json' } },
            ),
        );
        const provider = createEmbeddingProvider('cohere', {
            apiKey: 'private-test-key',
            model: 'embed-test',
            dimensions: 2,
            fetchImpl,
        });

        await expect(provider.embed(['甲', '乙'])).resolves.toEqual({
            vectors: [[1, 0], [0, 1]],
            usage: { inputTokens: 9 },
        });
        const [, request] = fetchImpl.mock.calls[0] ?? [];
        expect(JSON.parse(String(request?.body))).toMatchObject({
            texts: ['甲', '乙'],
            model: 'embed-test',
            input_type: 'clustering',
            output_dimension: 2,
            embedding_types: ['float'],
        });
    });

    it('sends SiliconFlow requests through its OpenAI-compatible embedding endpoint', async () => {
        const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
            new Response(
                JSON.stringify({
                    data: [
                        { index: 0, embedding: [1, 0] },
                        { index: 1, embedding: [0, 1] },
                    ],
                    usage: { total_tokens: 11 },
                }),
                { status: 200, headers: { 'content-type': 'application/json' } },
            ),
        );
        const provider = createEmbeddingProvider('siliconflow', {
            apiKey: 'private-test-key',
            model: 'Qwen/Qwen3-Embedding-0.6B',
            dimensions: 2,
            fetchImpl,
        });

        await expect(provider.embed(['甲', '乙'])).resolves.toEqual({
            vectors: [[1, 0], [0, 1]],
            usage: { inputTokens: 11 },
        });
        expect(fetchImpl.mock.calls[0]?.[0]).toBe('https://api.siliconflow.cn/v1/embeddings');
        const [, request] = fetchImpl.mock.calls[0] ?? [];
        expect(JSON.parse(String(request?.body))).toEqual({
            input: ['甲', '乙'],
            model: 'Qwen/Qwen3-Embedding-0.6B',
            encoding_format: 'float',
            dimensions: 2,
        });
    });

    it('omits dimensions for fixed-size SiliconFlow BGE models', async () => {
        const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
            new Response(JSON.stringify({ data: [{ index: 0, embedding: [1, 0] }], usage: { total_tokens: 2 } }), {
                status: 200,
                headers: { 'content-type': 'application/json' },
            }),
        );
        const provider = createEmbeddingProvider('siliconflow', {
            apiKey: 'private-test-key',
            model: 'BAAI/bge-m3',
            dimensions: 2,
            fetchImpl,
        });

        await provider.embed(['甲']);
        const [, request] = fetchImpl.mock.calls[0] ?? [];
        expect(JSON.parse(String(request?.body))).toEqual({
            input: ['甲'],
            model: 'BAAI/bge-m3',
            encoding_format: 'float',
        });
    });

    it('retries transient failures without printing a response body', async () => {
        const fetchImpl = vi
            .fn<typeof fetch>()
            .mockResolvedValueOnce(new Response('secret provider detail', { status: 429 }))
            .mockResolvedValueOnce(
                new Response(JSON.stringify({ data: [{ index: 0, embedding: [1, 0] }], usage: { total_tokens: 1 } }), {
                    status: 200,
                    headers: { 'content-type': 'application/json' },
                }),
            );
        const sleep = vi.fn().mockResolvedValue(undefined);
        const provider = createEmbeddingProvider('openai', {
            apiKey: 'private-test-key',
            dimensions: 2,
            fetchImpl,
            sleep,
        });

        await expect(provider.embed(['甲'])).resolves.toMatchObject({ vectors: [[1, 0]] });
        expect(fetchImpl).toHaveBeenCalledTimes(2);
        expect(sleep).toHaveBeenCalledOnce();
    });

    it('rejects VITE-prefixed credentials and absent secure credentials', () => {
        expect(() => apiKeyForProvider('voyage', { VITE_VOYAGE_API_KEY: 'leak' })).toThrow(/forbidden/u);
        expect(() => apiKeyForProvider('cohere', {})).toThrow('COHERE_API_KEY is not set');
        expect(apiKeyForProvider('openai', { OPENAI_API_KEY: 'secure' })).toBe('secure');
        expect(apiKeyForProvider('siliconflow', { SiliconFlow_API_KEY: 'secure-sf' })).toBe('secure-sf');
    });

    it('reads only an accepted SiliconFlow key name from a private env file', async () => {
        const directory = await mkdtemp(join(tmpdir(), 'reading-world-embedding-env-'));
        const envFile = join(directory, '.env');
        try {
            await writeFile(
                envFile,
                ['OTHER_SECRET=ignored', 'SiliconFlow_API_KEY="private-sf-key"', 'ANOTHER_SECRET=ignored'].join('\n'),
                'utf8',
            );
            await expect(apiKeyForProviderOrEnvFile('siliconflow', {}, envFile)).resolves.toBe('private-sf-key');
        } finally {
            await rm(directory, { recursive: true, force: true });
        }
    });

    it('rejects malformed vectors before they can enter the cache', async () => {
        const provider = createEmbeddingProvider('voyage', {
            apiKey: 'private-test-key',
            dimensions: 2,
            fetchImpl: vi.fn<typeof fetch>().mockResolvedValue(
                new Response(JSON.stringify({ data: [{ index: 0, embedding: [1] }] }), {
                    status: 200,
                    headers: { 'content-type': 'application/json' },
                }),
            ),
        });

        await expect(provider.embed(['甲'])).rejects.toThrow(/dimension mismatch/u);
    });
});
