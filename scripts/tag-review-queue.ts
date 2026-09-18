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
 * The reading list for the Batch 3 Gate (docs/25 §11).
 *
 * Reviewing 300 passages is not the job; most of them agree with the embedding proposal and survived a
 * full-text read. This writes the subset that a person actually has to decide, in the order that costs the
 * least attention, with everything needed to judge: the whole passage, what the ensemble proposed and how
 * confident it was, what the full-text pass concluded, and a checkbox line to answer on.
 *
 * Tiers:
 *   A  `unresolved`  32  no approved tag is supported by the passage alone — needs a decision
 *   B  `override`    50  the proposal was replaced — needs a sanity check
 *   C  `lexical`     18  a low-confidence proposal was replaced by explicit wording — needs a check
 *   D  thin tags      5  every passage of the tags that only reach one or two books
 *   E  spot check    15  a fixed every-13th sample of the untouched proposals, as a control group
 *
 * Tier E exists so that "the other 200 are fine" is a claim that was actually tested, not assumed.
 */
const PROVENANCE_ORDER: AssignmentProvenance[] = ['unresolved', 'override', 'lexical'];
const SPOT_CHECK_STRIDE = 13;
const THIN_TAG_IDS = ['tag-004', 'tag-030', 'tag-034'];

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
        '# Batch 3 审核队列',
        '',
        `生成时间：${new Date().toISOString()}`,
        `词表哈希：${assignmentsCheck.value.vocabularyHash.slice(0, 16)}…`,
        '',
        `300 条试标里，真正需要你决定的是 **${String(queueTotal)} 条**。剩下 ${String(assignments.length - queueTotal)} 条要么与模型提议一致、要么已被抽查覆盖，不必逐条看。`,
        '',
        '## 怎么用这份文件',
        '',
        '1. 按 A → E 顺序读，前面的最重要。',
        '2. 每条都给了全部原文、模型原提议和分数、以及当时的判断理由。',
        '3. 直接在这份文件里勾选，或把结论发回对话（例如「h-1350 改成 不确定性」）。',
        '4. 想自己改标签，用 `npm run tags:studio`（`http://127.0.0.1:5175/tag-studio.html`），那里能按「来源」筛选出同一批条目。',
        '',
        '## 什么算审核通过',
        '',
        '- Tier A 每条都有一个明确结论：保留、改写，或确认「无法归类」；',
        '- Tier B / C 你不同意的比例记录下来，若超过约一成，说明这类判断需要重做；',
        '- Tier D 三个偏薄标签各给出一个处理方向；',
        '- Tier E 抽查若发现明显错误，则不应把未抽查的条目当作通过。',
        '',
        '---',
        '',
        `## Tier A — 无法归类（${String(unresolved.length)} 条，必须决定）`,
        '',
        '这些条目原文单独读不出任何已批准标签的语义。我的处理是**保持原提议、标记 draft，不猜**。',
        '你可以：确认无法归类（那就作为真实的低覆盖保留），或指定一个真正合适的标签，或指出这里缺一个新概念。',
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
            '- 你的决定：☐ 确认无法归类　☐ 改成 ____________　☐ 缺少新概念 ____________',
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
        '模型选的标签在完整原文里站不住，我换成了别的。**这是最需要你检查的一批**：如果我的判断有偏差，错在这里最集中。',
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
            '- 你的决定：☐ 同意　☐ 应回到模型提议　☐ 都不对，应为 ____________',
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
            '- 你的决定：☐ 同意　☐ 属于同词不同义，应删除　☐ 应为 ____________',
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
        '这三个标签在 300 条里只覆盖 1–2 本书，走不出一条路。请决定每个标签的方向：补充种子重跑、并入相邻标签、或接受低覆盖。',
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
            '- 你的决定：☐ 合适　☐ 定义太窄，应扩为 ____________　☐ 并入 ____________',
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
            '- 你的决定：☐ 合理　☐ 有问题：____________',
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
        '- `reviewed` 只表示「已过一遍全文」，**不表示 Henry 认可**。',
        '- 每条你改动过的条目，`provenance` 会自动变成 `human`，与模型提议永久区分开。',
        '',
    );

    await writeAtomic(resolve(root, 'review-queue.md'), `${lines.join('\n')}\n`);
    console.log(`review queue: ${String(queueTotal)} entries`);
    console.log(
        `A unresolved ${String(unresolved.length)} / B override ${String(override.length)} / C lexical ${String(lexical.length)} / ` +
            `D thin ${String(thinTagEntries.length)} / E spot ${String(spotCheck.length)}`,
    );
    console.log(`private queue: ${resolve(root, 'review-queue.md')}`);
}

await main();
