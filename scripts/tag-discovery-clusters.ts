import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { Snapshot } from '../src/domain/types.ts';
import { validateSnapshot } from '../src/domain/validate.ts';
import type { EmbeddingCache } from './embeddings/core.ts';
import { sphericalKMeans } from './embeddings/clustering.ts';
import { embeddingPrivatePaths, LOCAL_SNAPSHOT_PATH } from './embeddings/privatePaths.ts';

const MODEL = 'BAAI/bge-large-zh-v1.5';
const DIMENSIONS = 1024;
const CLUSTER_COUNT = 36;

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
    const tagsRoot = resolve(process.cwd(), '.private', 'tags');
    const samplePath = resolve(tagsRoot, 'discovery-sample.json');
    const sample = JSON.parse(await readFile(samplePath, 'utf8')) as {
        schemaVersion: number;
        snapshotHash: string;
        entries: Array<{ id: string; bookId: string; themeIds: string[] }>;
    };
    if (sample.schemaVersion !== 1 || !Array.isArray(sample.entries) || sample.entries.length !== 300) {
        throw new Error('tag-discovery sample is missing or invalid; run npm run tags:sample first');
    }
    const paths = embeddingPrivatePaths();
    const cachePath = resolve(paths.cache, `siliconflow--${safeName(MODEL)}--${String(DIMENSIONS)}.json`);
    const cache = JSON.parse(await readFile(cachePath, 'utf8')) as EmbeddingCache;
    if (cache.snapshotHash !== sample.snapshotHash || cache.model !== MODEL || cache.dimensions !== DIMENSIONS) {
        throw new Error('tag-discovery sample and default embedding cache do not match');
    }
    const clusters = sphericalKMeans(
        sample.entries.map((entry) => {
            const values = cache.vectors[entry.id]?.values;
            if (values === undefined) {
                throw new Error(`tag-discovery cluster is missing vector ${entry.id}`);
            }
            return { id: entry.id, values };
        }),
        CLUSTER_COUNT,
    );
    if (clusters.some((cluster) => cluster.members.length === 0)) {
        throw new Error('semantic clustering produced an empty cluster');
    }
    const highlights = new Map(snapshot.highlights.map((highlight) => [highlight.id, highlight]));
    const books = new Map(snapshot.books.map((book) => [book.id, book]));
    const themes = new Map(snapshot.themes.map((theme) => [theme.id, theme]));
    const sampleById = new Map(sample.entries.map((entry) => [entry.id, entry]));
    const generatedAt = new Date().toISOString();
    const output = {
        schemaVersion: 1,
        clusteringVersion: 'spherical-kmeans-farthest-first-v1',
        generatedAt,
        snapshotHash: sample.snapshotHash,
        model: MODEL,
        dimensions: DIMENSIONS,
        sampleHighlights: sample.entries.length,
        clusterCount: clusters.length,
        clusters: clusters.map((cluster) => ({
            index: cluster.index,
            members: cluster.members,
        })),
    };
    const jsonPath = resolve(tagsRoot, 'discovery-clusters.json');
    const markdownPath = resolve(tagsRoot, 'discovery-clusters.md');
    await writeAtomic(jsonPath, `${JSON.stringify(output, null, 2)}\n`);

    const lines: string[] = [
        '# V3 Batch 2 语义簇辅助报告',
        '',
        `- 生成时间：${generatedAt}`,
        `- 输入：300 条标签发现样本`,
        `- 算法：固定 36 簇、farthest-first 初始化、spherical k-means`,
        '',
        '> 语义簇只是开放式归纳的观察切面，不等于 Topic Tag，也不能作为单标签 assignment。',
        '',
    ];
    for (const cluster of clusters) {
        const bookIds = new Set<string>();
        const themeCounts = new Map<string, number>();
        for (const member of cluster.members) {
            const sampleEntry = sampleById.get(member.id);
            if (sampleEntry === undefined) {
                throw new Error(`cluster references unknown sample ${member.id}`);
            }
            bookIds.add(sampleEntry.bookId);
            for (const themeId of sampleEntry.themeIds) {
                themeCounts.set(themeId, (themeCounts.get(themeId) ?? 0) + 1);
            }
        }
        const topThemes = [...themeCounts]
            .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
            .slice(0, 4)
            .map(([id, count]) => `${themes.get(id)?.title ?? id}×${String(count)}`)
            .join(' / ');
        lines.push(
            `## Cluster ${String(cluster.index).padStart(2, '0')} · ${String(cluster.members.length)} 条 / ${String(bookIds.size)} 本`,
            '',
            `- Book Theme 倾向：${topThemes}`,
            `- 全部 ID：${cluster.members.map((member) => member.id).join('、')}`,
            '',
        );
        for (const member of cluster.members.slice(0, 10)) {
            const highlight = highlights.get(member.id);
            const book = highlight === undefined ? undefined : books.get(highlight.bookId);
            if (highlight === undefined || book === undefined) {
                throw new Error(`cluster member ${member.id} cannot be rendered`);
            }
            lines.push(
                `### ${member.id} · ${book.title} · ${member.similarity.toFixed(4)}`,
                '',
                highlight.text,
                '',
            );
        }
    }
    await writeAtomic(markdownPath, `${lines.join('\n')}\n`);
    console.log(`semantic clusters: ${String(clusters.length)} from ${String(sample.entries.length)} private highlights`);
    console.log(`cluster sizes: ${clusters.map((cluster) => cluster.members.length).sort((left, right) => left - right).join(', ')}`);
    console.log(`private cluster report: ${markdownPath}`);
}

await main();
