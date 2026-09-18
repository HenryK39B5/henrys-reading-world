import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { Snapshot } from '../src/domain/types.ts';
import { validateSnapshot } from '../src/domain/validate.ts';
import { LOCAL_SNAPSHOT_PATH } from './embeddings/privatePaths.ts';

type Tag = {
    id: string;
    title: string;
    familyId: string;
    definition: string;
    includes: string[];
    excludes: string[];
    aliases: string[];
};

type Vocabulary = {
    schemaVersion: 1;
    status: 'draft';
    generatedAt: string;
    families: Array<{ id: string; title: string }>;
    tags: Tag[];
    boundaries: Array<{ left: string; right: string; note: string }>;
};

type SeedCandidates = {
    schemaVersion: 1;
    seedsPerTag: number;
    boundaryCasesPerPair: number;
    seeds: Array<{ tagId: string; candidates: Array<{ id: string; bookId: string; similarity: number }> }>;
    boundaries: Array<{ left: string; right: string; note: string; candidates: unknown[] }>;
};

type CuratedSeeds = {
    schemaVersion: 1;
    status: 'editorially-reviewed-draft';
    tags: Array<{ tagId: string; seedIds: string[] }>;
};

async function writeAtomic(path: string, content: string): Promise<void> {
    await mkdir(dirname(path), { recursive: true });
    const temporary = `${path}.tmp-${String(process.pid)}`;
    await writeFile(temporary, content, 'utf8');
    await rename(temporary, path);
}

function mean(values: number[]): number {
    return values.reduce((sum, value) => sum + value, 0) / values.length;
}

async function main(): Promise<void> {
    const tagsRoot = resolve(process.cwd(), '.private', 'tags');
    const vocabulary = JSON.parse(await readFile(resolve(tagsRoot, 'candidate-vocabulary.json'), 'utf8')) as Vocabulary;
    const candidates = JSON.parse(await readFile(resolve(tagsRoot, 'candidate-seeds.json'), 'utf8')) as SeedCandidates;
    const curated = JSON.parse(await readFile(resolve(tagsRoot, 'curated-seeds.json'), 'utf8')) as CuratedSeeds;
    const checked = validateSnapshot(JSON.parse(await readFile(LOCAL_SNAPSHOT_PATH, 'utf8')) as unknown, { expectedVisibility: 'local-only' });
    if (!checked.ok) {
        throw new Error(`local snapshot does not validate: ${checked.errors.join('; ')}`);
    }
    const snapshot: Snapshot = checked.snapshot;
    if (vocabulary.schemaVersion !== 1 || vocabulary.status !== 'draft' || vocabulary.tags.length < 30 || vocabulary.tags.length > 60) {
        throw new Error('candidate vocabulary is invalid');
    }
    const familyById = new Map(vocabulary.families.map((family) => [family.id, family]));
    const tagById = new Map(vocabulary.tags.map((tag) => [tag.id, tag]));
    if (tagById.size !== vocabulary.tags.length || vocabulary.tags.some((tag) => !familyById.has(tag.familyId))) {
        throw new Error('candidate vocabulary contains duplicate tags or unknown families');
    }
    const highlights = new Map(snapshot.highlights.map((highlight) => [highlight.id, highlight]));
    const curatedByTag = new Map(curated.tags.map((entry) => [entry.tagId, entry]));
    if (curated.schemaVersion !== 1 || curated.status !== 'editorially-reviewed-draft' || curatedByTag.size !== vocabulary.tags.length) {
        throw new Error('curated tag seeds do not cover the full vocabulary');
    }
    for (const tag of vocabulary.tags) {
        const entry = curatedByTag.get(tag.id);
        if (entry === undefined || entry.seedIds.length !== 3 || new Set(entry.seedIds).size !== 3) {
            throw new Error(`curated tag ${tag.id} must have exactly three unique seeds`);
        }
        const bookIds = entry.seedIds.map((id) => {
            const highlight = highlights.get(id);
            if (highlight === undefined) {
                throw new Error(`curated tag ${tag.id} references unknown highlight ${id}`);
            }
            return highlight.bookId;
        });
        if (new Set(bookIds).size !== bookIds.length) {
            throw new Error(`curated tag ${tag.id} must use seeds from three different books`);
        }
    }
    if (candidates.schemaVersion !== 1 || candidates.seeds.length !== vocabulary.tags.length || candidates.boundaries.length !== vocabulary.boundaries.length) {
        throw new Error('embedding seed candidates do not match the vocabulary');
    }
    const candidateByTag = new Map(candidates.seeds.map((entry) => [entry.tagId, entry]));
    const weakTags: Array<{ id: string; title: string; meanTop5: number }> = [];
    for (const tag of vocabulary.tags) {
        const entry = candidateByTag.get(tag.id);
        if (entry === undefined || entry.candidates.length !== candidates.seedsPerTag) {
            throw new Error(`embedding seed candidates are incomplete for ${tag.id}`);
        }
        if (new Set(entry.candidates.map((candidate) => candidate.bookId)).size !== entry.candidates.length) {
            throw new Error(`embedding seed candidates are not book-diverse for ${tag.id}`);
        }
        const meanTop5 = mean(entry.candidates.slice(0, 5).map((candidate) => candidate.similarity));
        if (meanTop5 < 0.55) {
            weakTags.push({ id: tag.id, title: tag.title, meanTop5 });
        }
    }
    const overlaps: Array<{ left: string; right: string; shared: number }> = [];
    for (let leftIndex = 0; leftIndex < vocabulary.tags.length; leftIndex += 1) {
        for (let rightIndex = leftIndex + 1; rightIndex < vocabulary.tags.length; rightIndex += 1) {
            const left = vocabulary.tags[leftIndex];
            const right = vocabulary.tags[rightIndex];
            if (left === undefined || right === undefined) {
                continue;
            }
            const leftIds = new Set(candidateByTag.get(left.id)?.candidates.map((candidate) => candidate.id) ?? []);
            const shared = (candidateByTag.get(right.id)?.candidates ?? []).filter((candidate) => leftIds.has(candidate.id)).length;
            if (shared >= 3) {
                overlaps.push({ left: left.title, right: right.title, shared });
            }
        }
    }
    overlaps.sort((left, right) => right.shared - left.shared || left.left.localeCompare(right.left));
    const generatedAt = new Date().toISOString();
    const familySummary = vocabulary.families.map((family) => ({
        id: family.id,
        title: family.title,
        tags: vocabulary.tags.filter((tag) => tag.familyId === family.id).map((tag) => ({ id: tag.id, title: tag.title, definition: tag.definition })),
    }));
    const summary = {
        schemaVersion: 1,
        generatedAt,
        vocabulary: {
            tags: vocabulary.tags.length,
            families: vocabulary.families.length,
            boundaries: vocabulary.boundaries.length,
            curatedSeeds: curated.tags.reduce((sum, entry) => sum + entry.seedIds.length, 0),
            candidateSeeds: candidates.seeds.reduce((sum, entry) => sum + entry.candidates.length, 0),
        },
        families: familySummary,
        lowQuerySimilarityWatchlist: weakTags,
        seedOverlapWatchlist: overlaps,
        boundaries: vocabulary.boundaries,
    };
    await writeAtomic(resolve(tagsRoot, 'candidate-audit.json'), `${JSON.stringify(summary, null, 2)}\n`);

    const lines: string[] = [
        '# V3 Batch 2 词表 Gate',
        '',
        `- 生成时间：${generatedAt}`,
        `- 候选标签：${String(vocabulary.tags.length)}`,
        `- 内部概念家族：${String(vocabulary.families.length)}`,
        `- 人工复核种子：${String(summary.vocabulary.curatedSeeds)} 条（每标签 3 条、三本不同书）`,
        `- embedding 候选种子：${String(summary.vocabulary.candidateSeeds)} 条（每标签 ${String(candidates.seedsPerTag)} 条、按书去重）`,
        `- 相邻边界：${String(vocabulary.boundaries.length)} 组`,
        '',
        '> 建议：先保留完整候选词表进入 250–300 条试标。词表已经控制在 30–60 个目标内；是否合并相邻标签应由真实多标签试标数据决定，而不是仅凭当前 cosine 或命名直觉。',
        '',
        '## 候选词表',
        '',
    ];
    for (const family of familySummary) {
        lines.push(`### ${family.title}（${String(family.tags.length)}）`, '', family.tags.map((tag) => `- **${tag.title}**：${tag.definition}`).join('\n'), '');
    }
    lines.push('## 重点边界', '');
    for (const boundary of vocabulary.boundaries) {
        const left = tagById.get(boundary.left);
        const right = tagById.get(boundary.right);
        lines.push(`- **${left?.title ?? boundary.left} ↔ ${right?.title ?? boundary.right}**：${boundary.note}`);
    }
    lines.push('', '## 需要在试标中重点观察', '');
    if (weakTags.length === 0) {
        lines.push('- 无低相似度观察项。');
    } else {
        lines.push(
            `- query top-5 平均 cosine 低于 0.55：${weakTags.map((tag) => `${tag.title}（${tag.meanTop5.toFixed(4)}）`).join('、')}。这只表示自动召回较弱，不表示语料缺失；其人工种子已改用全文检索复核。`,
        );
    }
    if (overlaps.length > 0) {
        lines.push(`- top-8 种子重叠至少 3 条：${overlaps.map((pair) => `${pair.left} / ${pair.right}（${String(pair.shared)}）`).join('、')}。这些是优先检查合并或多标签共存的边界。`);
    }
    lines.push(
        '- 亲密关系、信任等概念会召回软件“依赖关系”等关键词伪相关；Batch 3 不得自动接受 top neighbours。',
        '- 宣传控制、群体心理、家庭、自我成长等标签的 embedding query 排名偏弱，但全文关键词复核分别覆盖多本真实书；暂不因单一向量指标删除。',
        '',
        '## 用户 Gate',
        '',
        '请审核：名称与定义、相邻边界、缺失主题、过宽或过细标签，以及是否允许整套候选进入 Batch 3 的 250–300 条试标。',
    );
    await writeAtomic(resolve(tagsRoot, 'BATCH-2-GATE.md'), `${lines.join('\n')}\n`);

    console.log(`candidate vocabulary: ${String(vocabulary.tags.length)} tags / ${String(vocabulary.families.length)} private families`);
    console.log(`curated seeds: ${String(summary.vocabulary.curatedSeeds)} from three books per tag`);
    console.log(`boundaries: ${String(vocabulary.boundaries.length)}`);
    console.log(`low-query-similarity watchlist: ${String(weakTags.length)}`);
    console.log(`seed-overlap watchlist: ${String(overlaps.length)}`);
    console.log(`private gate: ${resolve(tagsRoot, 'BATCH-2-GATE.md')}`);
}

await main();
