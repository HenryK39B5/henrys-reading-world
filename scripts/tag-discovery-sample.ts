import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { Snapshot } from '../src/domain/types.ts';
import { validateSnapshot } from '../src/domain/validate.ts';
import {
    EMBEDDING_INPUT_VERSION,
    highlightTextHash,
    snapshotEmbeddingHash,
    type EmbeddingCache,
} from './embeddings/core.ts';
import { embeddingPrivatePaths, LOCAL_SNAPSHOT_PATH } from './embeddings/privatePaths.ts';
import { selectTagDiscoverySample } from './embeddings/tagDiscovery.ts';

const PROVIDER = 'siliconflow';
const MODEL = 'BAAI/bge-large-zh-v1.5';
const DIMENSIONS = 1024;
const TARGET_COUNT = 300;

function safeName(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9._-]+/gu, '-');
}

async function writeAtomic(path: string, content: string): Promise<void> {
    await mkdir(dirname(path), { recursive: true });
    const temporary = `${path}.tmp-${String(process.pid)}`;
    await writeFile(temporary, content, 'utf8');
    await rename(temporary, path);
}

async function main(): Promise<void> {
    const snapshotRaw = JSON.parse(await readFile(LOCAL_SNAPSHOT_PATH, 'utf8')) as unknown;
    const checked = validateSnapshot(snapshotRaw, { expectedVisibility: 'local-only' });
    if (!checked.ok) {
        throw new Error(`local snapshot does not validate: ${checked.errors.join('; ')}`);
    }
    const snapshot: Snapshot = checked.snapshot;
    const paths = embeddingPrivatePaths();
    const cachePath = resolve(paths.cache, `${PROVIDER}--${safeName(MODEL)}--${String(DIMENSIONS)}.json`);
    if (!existsSync(cachePath)) {
        throw new Error('default full embedding cache is missing; run npm run embeddings:generate first');
    }
    const cache = JSON.parse(await readFile(cachePath, 'utf8')) as EmbeddingCache;
    const snapshotHash = snapshotEmbeddingHash(snapshot);
    if (
        cache.schemaVersion !== 1 ||
        cache.provider !== PROVIDER ||
        cache.model !== MODEL ||
        cache.dimensions !== DIMENSIONS ||
        cache.inputVersion !== EMBEDDING_INPUT_VERSION ||
        cache.snapshotHash !== snapshotHash
    ) {
        throw new Error('default embedding cache is stale or does not match the selected model');
    }
    for (const highlight of snapshot.highlights) {
        const entry = cache.vectors[highlight.id];
        if (entry?.textHash !== highlightTextHash(highlight) || entry.values.length !== DIMENSIONS) {
            throw new Error(`default embedding cache is incomplete for ${highlight.id}`);
        }
    }

    const entries = selectTagDiscoverySample(snapshot, cache.vectors, TARGET_COUNT);
    const books = new Map(snapshot.books.map((book) => [book.id, book]));
    const themes = new Map(snapshot.themes.map((theme) => [theme.id, theme]));
    const highlights = new Map(snapshot.highlights.map((highlight) => [highlight.id, highlight]));
    const perBook = new Map<string, number>();
    const perTheme = new Map<string, number>();
    const byLength = { short: 0, medium: 0, long: 0 };
    const byReason = { 'book-centroid': 0, 'book-semantic-edge': 0, 'theme-diversity-third': 0 };
    for (const entry of entries) {
        perBook.set(entry.bookId, (perBook.get(entry.bookId) ?? 0) + 1);
        for (const themeId of entry.themeIds) {
            perTheme.set(themeId, (perTheme.get(themeId) ?? 0) + 1);
        }
        byLength[entry.lengthBand] += 1;
        byReason[entry.reason] += 1;
    }
    const bookCounts = [...perBook.values()];
    const output = {
        schemaVersion: 1,
        selectionVersion: 'embedding-book-fair-v1',
        generatedAt: new Date().toISOString(),
        snapshotHash,
        provider: PROVIDER,
        model: MODEL,
        dimensions: DIMENSIONS,
        targetCount: TARGET_COUNT,
        coverage: {
            highlights: entries.length,
            books: perBook.size,
            themes: perTheme.size,
            perBookMinimum: Math.min(...bookCounts),
            perBookMaximum: Math.max(...bookCounts),
            byLength,
            byReason,
            byTheme: [...perTheme]
                .map(([themeId, count]) => ({ themeId, title: themes.get(themeId)?.title ?? themeId, count }))
                .sort((left, right) => left.themeId.localeCompare(right.themeId)),
        },
        entries,
    };
    const tagsRoot = resolve(process.cwd(), '.private', 'tags');
    const jsonPath = resolve(tagsRoot, 'discovery-sample.json');
    const markdownPath = resolve(tagsRoot, 'discovery-sample.md');
    await writeAtomic(jsonPath, `${JSON.stringify(output, null, 2)}\n`);

    const markdown: string[] = [
        '# V3 Batch 2 标签发现样本',
        '',
        `- 生成时间：${output.generatedAt}`,
        `- 模型：${MODEL} / ${String(DIMENSIONS)} 维`,
        `- 选择：每书中心点 + 书内语义边缘；再按 Book Theme 轮转补足第三条`,
        `- 覆盖：${String(entries.length)} 条 / ${String(perBook.size)} 本 / ${String(perTheme.size)} 个 Book Theme`,
        `- 每书：${String(output.coverage.perBookMinimum)}–${String(output.coverage.perBookMaximum)} 条`,
        `- 长度：短 ${String(byLength.short)} / 中 ${String(byLength.medium)} / 长 ${String(byLength.long)}`,
        '',
        '> 仅用于本机开放式归纳。样本不是正式 Topic Tag assignment，embedding 选择理由也不进入公开快照。',
        '',
    ];
    for (const entry of entries) {
        const highlight = highlights.get(entry.id);
        const book = books.get(entry.bookId);
        if (highlight === undefined || book === undefined) {
            throw new Error(`selected entry ${entry.id} cannot be rendered`);
        }
        markdown.push(
            `## ${String(entry.selectionOrder).padStart(3, '0')} · ${entry.id} · ${entry.reason}`,
            '',
            `- 书：${book.title}（${book.id}）`,
            `- 作者：${book.author}`,
            `- Book Theme：${entry.themeIds.map((id) => themes.get(id)?.title ?? id).join(' / ')}`,
            `- 长度：${entry.lengthBand}`,
            `- 语义距离：${entry.semanticDistance.toFixed(6)}`,
            '',
            highlight.text,
            '',
        );
    }
    await writeAtomic(markdownPath, `${markdown.join('\n')}\n`);

    console.log(`tag-discovery sample: ${String(entries.length)} highlights / ${String(perBook.size)} books / ${String(perTheme.size)} themes`);
    console.log(`per book: ${String(output.coverage.perBookMinimum)}-${String(output.coverage.perBookMaximum)}`);
    console.log(`length bands: short ${String(byLength.short)}, medium ${String(byLength.medium)}, long ${String(byLength.long)}`);
    console.log(`private sample: ${jsonPath}`);
    console.log(`private workbook: ${markdownPath}`);
}

await main();
