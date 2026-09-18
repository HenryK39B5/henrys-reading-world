import { readFile } from 'node:fs/promises';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { Snapshot } from '../src/domain/types.ts';
import { validateSnapshot } from '../src/domain/validate.ts';
import { cosineSimilarity, type EmbeddingCache, type EmbeddingProviderName, type EvaluationCorpus } from './embeddings/core.ts';
import { parseEvaluationLabels } from './embeddings/evaluation.ts';
import { embeddingPrivatePaths, LOCAL_SNAPSHOT_PATH } from './embeddings/privatePaths.ts';
import { providerDefaults } from './embeddings/providers.ts';

type Args = {
    provider: EmbeddingProviderName;
    model: string;
    dimensions: number;
    limit: number;
};

function readArgs(argv: string[]): Args {
    const values = new Map<string, string>();
    for (let index = 0; index < argv.length; index += 1) {
        const key = argv[index];
        const value = argv[index + 1];
        if (!key?.startsWith('--') || value === undefined || value.startsWith('--')) {
            throw new Error(`invalid argument near ${key ?? ''}`);
        }
        values.set(key.slice(2), value);
        index += 1;
    }
    const providerRaw = values.get('provider') ?? 'local';
    if (!['voyage', 'cohere', 'openai', 'siliconflow', 'local'].includes(providerRaw)) {
        throw new Error('--provider must be voyage, cohere, openai, siliconflow, or local');
    }
    const provider = providerRaw as EmbeddingProviderName;
    const defaults = providerDefaults(provider);
    const model = values.get('model') ?? defaults.model;
    const dimensions = Number(values.get('dimensions') ?? defaults.dimensions);
    const limit = Number(values.get('limit') ?? '10');
    if (!Number.isInteger(dimensions) || dimensions <= 0 || !Number.isInteger(limit) || limit <= 0) {
        throw new Error('--dimensions and --limit must be positive integers');
    }
    return { provider, model, dimensions, limit };
}

function safeName(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9._-]+/gu, '-');
}

function markdownText(value: string): string {
    return value.replace(/\r\n?/gu, '\n').replace(/\n/gu, '<br>');
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
    const corpus = JSON.parse(await readFile(paths.corpus, 'utf8')) as EvaluationCorpus;
    const labels = parseEvaluationLabels(JSON.parse(await readFile(paths.labels, 'utf8')) as unknown);
    const cacheName = `${args.provider}--${safeName(args.model)}--${String(args.dimensions)}.json`;
    const cache = JSON.parse(await readFile(resolve(paths.cache, cacheName), 'utf8')) as EmbeddingCache;
    if (cache.model !== args.model || cache.dimensions !== args.dimensions) {
        throw new Error('embedding cache does not match the requested model');
    }
    const highlights = new Map(snapshot.highlights.map((highlight) => [highlight.id, highlight]));
    const books = new Map(snapshot.books.map((book) => [book.id, book]));
    const lines: string[] = [
        `# Neighbour review — ${args.provider} / ${args.model} / ${String(args.dimensions)}`,
        '',
        `Generated: ${new Date().toISOString()}`,
        '',
    ];
    for (const item of labels.cases) {
        const query = cache.vectors[item.queryId]?.values;
        const queryHighlight = highlights.get(item.queryId);
        if (query === undefined || queryHighlight === undefined) {
            throw new Error(`missing query ${item.queryId}`);
        }
        const ranked = corpus.entries
            .filter((entry) => entry.id !== item.queryId)
            .map((entry) => {
                const values = cache.vectors[entry.id]?.values;
                if (values === undefined) {
                    throw new Error(`missing vector ${entry.id}`);
                }
                return { id: entry.id, similarity: cosineSimilarity(query, values) };
            })
            .sort((left, right) => right.similarity - left.similarity || left.id.localeCompare(right.id));
        const rankOf = (id: string): number => ranked.findIndex((entry) => entry.id === id) + 1;
        const queryBook = books.get(queryHighlight.bookId);
        lines.push(`## ${item.id} · ${item.kind}`, '');
        lines.push(`**Query ${item.queryId} · 《${queryBook?.title ?? queryHighlight.bookId}》**`);
        lines.push('', markdownText(queryHighlight.text), '');
        lines.push(`- Expected positive ranks: ${item.positiveIds.map((id) => `${id}=#${String(rankOf(id))}`).join(', ')}`);
        lines.push(`- Hard negative ranks: ${item.negativeIds.length === 0 ? 'none' : item.negativeIds.map((id) => `${id}=#${String(rankOf(id))}`).join(', ')}`);
        lines.push('', `### Top ${String(args.limit)}`, '');
        for (const [index, result] of ranked.slice(0, args.limit).entries()) {
            const highlight = highlights.get(result.id);
            if (highlight === undefined) {
                throw new Error(`missing highlight ${result.id}`);
            }
            const book = books.get(highlight.bookId);
            const marker = item.positiveIds.includes(result.id) ? ' ✅ positive' : item.negativeIds.includes(result.id) ? ' ❌ hard-negative' : '';
            lines.push(
                `${String(index + 1)}. **${result.id} · ${result.similarity.toFixed(4)} · 《${book?.title ?? highlight.bookId}》${marker}**`,
                '',
                markdownText(highlight.text),
                '',
            );
        }
    }
    const output = resolve(paths.evaluation, 'neighbours', `${args.provider}--${safeName(args.model)}--${String(args.dimensions)}.md`);
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, `${lines.join('\n')}\n`, 'utf8');
    console.log(`private neighbour review: ${output}`);
    console.log(`cases: ${String(labels.cases.length)}; top neighbours per case: ${String(args.limit)}`);
}

await main();
