import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { validateSnapshot } from '../src/domain/validate.ts';
import {
    validateTopicTagAssignments,
    validateTopicTagVocabulary,
    type AssignmentProvenance,
    type HighlightTagAssignment,
    type TopicTagVocabulary,
} from '../src/domain/topicTags.ts';
import { LOCAL_SNAPSHOT_PATH } from './embeddings/privatePaths.ts';

/**
 * The implementation-agent diagnostic report for the Batch 3 Gate (docs/25 §11).
 *
 * Henry's handwritten review-queue.md is never overwritten. This generated report keeps the high-risk
 * subsets inspectable after closeout, but it is not a user task list: unresolved passages remain honest
 * drafts, while override and lexical passages record the editorial decision already made.
 *
 * Tier E remains a deterministic control sample so that accepting untouched ensemble proposals is tested,
 * not merely assumed.
 */
const PROVENANCE_ORDER: AssignmentProvenance[] = ['unresolved', 'override', 'lexical'];
const SPOT_CHECK_STRIDE = 13;
const THIN_TAG_IDS = ['tag-004'];

async function writeAtomic(path: string, value: string): Promise<void> {
    await mkdir(dirname(path), { recursive: true });
    const temporary = `${path}.tmp-${String(process.pid)}`;
    await writeFile(temporary, value, 'utf8');
    await rename(temporary, path);
}

function oneLine(text: string): string {
    return text.replace(/\s+/gu, ' ').trim();
}

function labelOf(vocabulary: TopicTagVocabulary, tagId: string): string {
    return vocabulary.tags.find((tag) => tag.id === tagId)?.title ?? tagId;
}

function names(vocabulary: TopicTagVocabulary, tagIds: string[]): string {
    return tagIds.map((tagId) => labelOf(vocabulary, tagId)).join(' + ');
}

async function main(): Promise<void> {
    const root = resolve(process.cwd(), '.private', 'tags');
    const snapshotCheck = validateSnapshot(JSON.parse(await readFile(LOCAL_SNAPSHOT_PATH, 'utf8')) as unknown, {
        expectedVisibility: 'local-only',
    });
    if (!snapshotCheck.ok) {
        throw new Error(`local snapshot does not validate: ${snapshotCheck.errors.join('; ')}`);
    }
    const snapshot = snapshotCheck.snapshot;
    const vocabularyCheck = validateTopicTagVocabulary(
        JSON.parse(await readFile(resolve(root, 'vocabulary.json'), 'utf8')) as unknown,
    );
    if (!vocabularyCheck.ok) {
        throw new Error(`vocabulary does not validate: ${vocabularyCheck.errors.join('; ')}`);
    }
    const vocabulary = vocabularyCheck.value;
    const sample = JSON.parse(await readFile(resolve(root, 'discovery-sample.json'), 'utf8')) as {
        entries: Array<{ id: string }>;
    };
    const assignmentsCheck = validateTopicTagAssignments(
        JSON.parse(await readFile(resolve(root, 'assignments.json'), 'utf8')) as unknown,
        snapshot,
        vocabulary,
        new Set(sample.entries.map((entry) => entry.id)),
    );
    if (!assignmentsCheck.ok) {
        throw new Error(`assignments do not validate: ${assignmentsCheck.errors.join('; ')}`);
    }
    const assignments = assignmentsCheck.value.assignments;
    const passageOf = new Map(snapshot.highlights.map((highlight) => [highlight.id, highlight]));
    const bookOf = new Map(snapshot.books.map((book) => [book.id, book]));

    const byProvenance = (kind: AssignmentProvenance): HighlightTagAssignment[] =>
        assignments.filter((assignment) => assignment.provenance === kind).sort((left, right) => left.highlightId.localeCompare(right.highlightId));

    const unresolved = byProvenance('unresolved');
    const override = byProvenance('override');
    const lexical = byProvenance('lexical');
    const ensemble = byProvenance('ensemble');
    const thinTagEntries = assignments
        .filter((assignment) => assignment.tagIds.some((tagId) => THIN_TAG_IDS.includes(tagId)))
        .sort((left, right) => left.highlightId.localeCompare(right.highlightId));
    const spotCheck = ensemble.filter((_, index) => index % SPOT_CHECK_STRIDE === 0);
    const queueTotal = unresolved.length + override.length + lexical.length + thinTagEntries.length + spotCheck.length;

    const lines: string[] = [
        '# Batch 3 Agent 复核报告',
        '',
        `生成时间：${new Date().toISOString()}`,
        `词表哈希：${assignmentsCheck.value.vocabularyHash.slice(0, 16)}…`,
        '',
        `高风险与控制样本共 **${String(queueTotal)} 条**；本报告供实现 Agent 留档，不要求用户逐条处理。`,
        '',
        '## 阅读方式',
        '',
        '1. Tier A 是诚实保留的 draft；Tier B / C 是已完成的编辑判断；Tier D 记录偏薄标签处置；Tier E 是确定性控制样本。',
        '2. 每条保留完整原文、模型原提议、分数与最终理由，便于后续回归。',
        '3. 如产品边界以后改变，可用 `npm run tags:studio` 重新打开；当前 Batch 3 不再等待用户勾选。',
        '',
        '---',
        '',
        `## Tier A — 无法归类（${String(unresolved.length)} 条，保留 draft）`,
        '',
        '这些条目原文单独读不出任何已批准标签的语义。我的处理是**保持原提议、标记 draft，不猜**。',
        '收口结论：原文无法在不猜测的前提下支撑标签，保持 draft，不进入 reviewed 数据。',
        '',
    ];
    for (const [index, assignment] of unresolved.entries()) {
        const highlight = passageOf.get(assignment.highlightId);
        const book = highlight === undefined ? undefined : bookOf.get(highlight.bookId);
        lines.push(
            `### A${String(index + 1)} · ${assignment.highlightId} · 《${book?.title ?? '未知'}》`,
            '',
            `- 当前保留：${names(vocabulary, assignment.tagIds)}（draft）`,
            `- 模型提议：${assignment.candidates.slice(0, 3).map((candidate) => `${labelOf(vocabulary, candidate.tagId)} ${candidate.score.toFixed(2)}`).join(' / ')}`,
            `- 我的理由：${assignment.rationale}`,
            '- 收口状态：保留 draft；未来仅在词表或产品语境变化时重开。',
            '',
            `> ${oneLine(highlight?.text ?? '')}`,
            '',
        );
    }

    lines.push(
        '---',
        '',
        `## Tier B — 全文推翻模型提议（${String(override.length)} 条）`,
        '',
        '模型选的标签在完整原文里站不住，已由实现 Agent 改写；这是后续回归最应优先查看的一批。',
        '',
    );
    for (const [index, assignment] of override.entries()) {
        const highlight = passageOf.get(assignment.highlightId);
        const book = highlight === undefined ? undefined : bookOf.get(highlight.bookId);
        lines.push(
            `### B${String(index + 1)} · ${assignment.highlightId} · 《${book?.title ?? '未知'}》`,
            '',
            `- 我改成：**${names(vocabulary, assignment.tagIds)}**`,
            `- 模型原提议：${assignment.candidates.slice(0, 3).map((candidate) => `${labelOf(vocabulary, candidate.tagId)} ${candidate.score.toFixed(2)}`).join(' / ')}`,
            `- 我的理由：${assignment.rationale}`,
            '- 收口状态：已复核并写入 override。',
            '',
            `> ${oneLine(highlight?.text ?? '')}`,
            '',
        );
    }

    lines.push(
        '---',
        '',
        `## Tier C — 低信心改为词面证据（${String(lexical.length)} 条）`,
        '',
        '模型信心低，但原文里有明确的字面依据，所以按定义给了标签。检查点在「字面命中是否等于语义命中」。',
        '',
    );
    for (const [index, assignment] of lexical.entries()) {
        const highlight = passageOf.get(assignment.highlightId);
        const book = highlight === undefined ? undefined : bookOf.get(highlight.bookId);
        lines.push(
            `### C${String(index + 1)} · ${assignment.highlightId} · 《${book?.title ?? '未知'}》`,
            '',
            `- 我给：**${names(vocabulary, assignment.tagIds)}**`,
            `- 模型原提议：${assignment.candidates.slice(0, 3).map((candidate) => `${labelOf(vocabulary, candidate.tagId)} ${candidate.score.toFixed(2)}`).join(' / ')}`,
            `- 我的理由：${assignment.rationale}`,
            '- 收口状态：已复核词面是否等于语义命中。',
            '',
            `> ${oneLine(highlight?.text ?? '')}`,
            '',
        );
    }

    lines.push(
        '---',
        '',
        `## Tier D — 偏薄标签的全部条目（${String(thinTagEntries.length)} 条）`,
        '',
        '试标偏薄不等于全语料偏薄；收口时结合全语料跨书证据决定保留或合并。',
        '',
        '| 标签 | 划线数 | 书籍数 |',
        '| --- | ---: | ---: |',
    );
    for (const tagId of THIN_TAG_IDS) {
        const tagged = assignments.filter((assignment) => assignment.tagIds.includes(tagId));
        const books = new Set(tagged.map((assignment) => passageOf.get(assignment.highlightId)?.bookId));
        lines.push(`| ${labelOf(vocabulary, tagId)} | ${String(tagged.length)} | ${String(books.size)} |`);
    }
    lines.push('');
    for (const [index, assignment] of thinTagEntries.entries()) {
        const highlight = passageOf.get(assignment.highlightId);
        const book = highlight === undefined ? undefined : bookOf.get(highlight.bookId);
        lines.push(
            `### D${String(index + 1)} · ${assignment.highlightId} · 《${book?.title ?? '未知'}》`,
            '',
            `- 标签：${names(vocabulary, assignment.tagIds)}（${assignment.provenance}）`,
            '- 收口状态：运气以全语料 64 条 / 23 本证据保留。',
            '',
            `> ${oneLine(highlight?.text ?? '')}`,
            '',
        );
    }

    lines.push(
        '---',
        '',
        `## Tier E — 控制组抽查（${String(spotCheck.length)} 条）`,
        '',
        `取自「与模型一致且已完成全文阅读」的 ${String(ensemble.length)} 条，规则是**按 ID 排序后每 ${String(SPOT_CHECK_STRIDE)} 条取一条**，不使用随机数，因此可复现。`,
        '抽查的目的是检验「剩下那些没问题」这个说法本身；若这里出现明显错误，就不能把未抽查的部分当作通过。',
        '',
    );
    for (const [index, assignment] of spotCheck.entries()) {
        const highlight = passageOf.get(assignment.highlightId);
        const book = highlight === undefined ? undefined : bookOf.get(highlight.bookId);
        lines.push(
            `### E${String(index + 1)} · ${assignment.highlightId} · 《${book?.title ?? '未知'}》`,
            '',
            `- 标签：${names(vocabulary, assignment.tagIds)}（confidence ${assignment.confidence}，与模型一致）`,
            '- 控制组状态：供后续回归抽查，不是用户待办。',
            '',
            `> ${oneLine(highlight?.text ?? '')}`,
            '',
        );
    }

    lines.push(
        '---',
        '',
        '## 统计口径提醒',
        '',
        `- 全部试标：${String(assignments.length)}；其中 ${String(assignments.filter((a) => a.status === 'reviewed').length)} reviewed / ${String(assignments.filter((a) => a.status === 'draft').length)} draft。`,
        `- 来源分布：${PROVENANCE_ORDER.map((kind) => `${kind} ${String(assignments.filter((a) => a.provenance === kind).length)}`).join('，')}，ensemble ${String(ensemble.length)}。`,
        '- `reviewed` 表示实现 Agent 已完成全文复核，**不表示 Henry 逐条背书**。',
        '- 每条经 Studio 人工改动的条目，`provenance` 会自动变成 `human`，与模型提议永久区分开。',
        '',
    );

    // Never overwrite review-queue.md: it may contain Henry's handwritten decisions.
    const outputPath = resolve(root, 'review-queue.generated.md');
    await writeAtomic(outputPath, `${lines.join('\n')}\n`);
    console.log(`review queue: ${String(queueTotal)} entries`);
    console.log(
        `A unresolved ${String(unresolved.length)} / B override ${String(override.length)} / C lexical ${String(lexical.length)} / ` +
            `D thin ${String(thinTagEntries.length)} / E spot ${String(spotCheck.length)}`,
    );
    console.log(`private queue: ${outputPath}`);
}

await main();
