import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { validateSnapshot } from '../src/domain/validate.ts';
import {
    validateTopicTagAssignments,
    validateTopicTagVocabulary,
    type AssignmentFlag,
    type AssignmentProvenance,
    type TopicTagAssignments,
    type TopicTagVocabulary,
} from '../src/domain/topicTags.ts';
import { LOCAL_SNAPSHOT_PATH } from './embeddings/privatePaths.ts';

/**
 * The Batch 3 trial audit (docs/22 §6.3).
 *
 * It answers the questions a reviewer would otherwise have to compute by hand: how much of the trial is
 * actually reviewed, how the 1–3 tags distribute, which tags are covered by how many books, which tags are
 * so broad that they stop being a path, which assigned tags the embedding ensemble never proposed, and
 * which passages still need Studio attention.
 *
 * It only writes into `.private/tags/`. It never touches `src/data/public-snapshot.json`.
 */
const ALL_FLAGS: AssignmentFlag[] = ['low-confidence', 'semantic-outlier', 'near-boundary', 'possible-missing-tag'];
const FULL_CORPUS_EVIDENCE: Readonly<Record<string, RegExp>> = {
    'tag-004': /运气|幸运|偶然/u,
    'tag-055': /失败|挫折|成败/u,
};

async function writeAtomic(path: string, value: unknown): Promise<void> {
    await mkdir(dirname(path), { recursive: true });
    const temporary = `${path}.tmp-${String(process.pid)}`;
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    await rename(temporary, path);
}

type TagSummary = {
    tagId: string;
    title: string;
    familyId: string | null;
    status: string;
    highlights: number;
    books: number;
    reviewed: number;
    draft: number;
    /** Assigned by editorial override or by lexical evidence rather than by the embedding top-5. */
    offEnsemble: number;
};

async function main(): Promise<void> {
    const root = resolve(process.cwd(), '.private', 'tags');
    const snapshotCheck = validateSnapshot(JSON.parse(await readFile(LOCAL_SNAPSHOT_PATH, 'utf8')) as unknown, {
        expectedVisibility: 'local-only',
    });
    if (!snapshotCheck.ok) {
        throw new Error(`local snapshot does not validate: ${snapshotCheck.errors.join('; ')}`);
    }
    const snapshot = snapshotCheck.snapshot;
    const vocabularyCheck = validateTopicTagVocabulary(JSON.parse(await readFile(resolve(root, 'vocabulary.json'), 'utf8')) as unknown);
    if (!vocabularyCheck.ok) {
        throw new Error(`vocabulary does not validate: ${vocabularyCheck.errors.join('; ')}`);
    }
    const vocabulary: TopicTagVocabulary = vocabularyCheck.value;
    const sample = JSON.parse(await readFile(resolve(root, 'discovery-sample.json'), 'utf8')) as { entries: Array<{ id: string }> };
    const required = new Set(sample.entries.map((entry) => entry.id));
    const assignmentsCheck = validateTopicTagAssignments(
        JSON.parse(await readFile(resolve(root, 'assignments.json'), 'utf8')) as unknown,
        snapshot,
        vocabulary,
        required,
    );
    if (!assignmentsCheck.ok) {
        throw new Error(`assignments do not validate: ${assignmentsCheck.errors.join('; ')}`);
    }
    const assignments: TopicTagAssignments = assignmentsCheck.value;

    const bookOfHighlight = new Map(snapshot.highlights.map((highlight) => [highlight.id, highlight.bookId]));
    const reviewed = assignments.assignments.filter((assignment) => assignment.status === 'reviewed');
    const draft = assignments.assignments.filter((assignment) => assignment.status === 'draft');
    const tagCounts = [1, 2, 3].map((count) => assignments.assignments.filter((assignment) => assignment.tagIds.length === count).length);

    const tagSummaries: TagSummary[] = vocabulary.tags.map((tag) => {
        const tagged = assignments.assignments.filter((assignment) => assignment.tagIds.includes(tag.id));
        return {
            tagId: tag.id,
            title: tag.title,
            familyId: tag.familyId ?? null,
            status: tag.status,
            highlights: tagged.length,
            books: new Set(tagged.map((assignment) => bookOfHighlight.get(assignment.highlightId) ?? '')).size,
            reviewed: tagged.filter((assignment) => assignment.status === 'reviewed').length,
            draft: tagged.filter((assignment) => assignment.status === 'draft').length,
            offEnsemble: tagged.filter(
                (assignment) => !assignment.candidates.slice(0, 5).some((candidate) => candidate.tagId === tag.id),
            ).length,
        };
    });

    const orphanTags = tagSummaries.filter((tag) => tag.highlights === 0);
    // A tag covering more than a quarter of the trial is a signal to reconsider its abstraction, not an error.
    const broadTags = tagSummaries.filter((tag) => tag.highlights / assignments.assignments.length > 0.25);
    const thinTags = tagSummaries.filter((tag) => tag.highlights > 0 && tag.books < 3);
    const thinTagEvidence = thinTags.map((tag) => {
        const pattern = FULL_CORPUS_EVIDENCE[tag.tagId];
        const matches = pattern === undefined ? [] : snapshot.highlights.filter((highlight) => pattern.test(highlight.text));
        return {
            tagId: tag.tagId,
            title: tag.title,
            highlights: matches.length,
            books: new Set(matches.map((highlight) => highlight.bookId)).size,
            disposition: matches.length > 0 ? 'retain' : 'review',
        };
    });
    const consistency = {
        assignmentsWithAllTagsInTop5: assignments.assignments.filter((assignment) =>
            assignment.tagIds.every((tagId) => assignment.candidates.slice(0, 5).some((candidate) => candidate.tagId === tagId)),
        ).length,
        assignmentsWithNoTagInTop5: assignments.assignments.filter((assignment) =>
            assignment.tagIds.every((tagId) => !assignment.candidates.slice(0, 5).some((candidate) => candidate.tagId === tagId)),
        ).length,
        provenance: Object.fromEntries(
            (['ensemble', 'lexical', 'override', 'unresolved', 'human'] as AssignmentProvenance[]).map((kind) => [
                kind,
                assignments.assignments.filter((assignment) => assignment.provenance === kind).length,
            ]),
        ),
        /** Everything that required editorial inspection: not decided by the model, or still unresolved. */
        needsHumanEyes: assignments.assignments.filter(
            (assignment) => assignment.provenance !== 'ensemble' && assignment.provenance !== 'human',
        ).length,
    };

    const report = {
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        model: assignments.model,
        vocabularyHash: assignments.vocabularyHash,
        snapshotHash: assignments.snapshotHash,
        assignments: assignments.assignments.length,
        reviewed: reviewed.length,
        draft: draft.length,
        reviewedRate: reviewed.length / assignments.assignments.length,
        tagCounts: { one: tagCounts[0] ?? 0, two: tagCounts[1] ?? 0, three: tagCounts[2] ?? 0 },
        multiTagRate: ((tagCounts[1] ?? 0) + (tagCounts[2] ?? 0)) / assignments.assignments.length,
        confidence: {
            high: assignments.assignments.filter((assignment) => assignment.confidence === 'high').length,
            medium: assignments.assignments.filter((assignment) => assignment.confidence === 'medium').length,
            low: assignments.assignments.filter((assignment) => assignment.confidence === 'low').length,
        },
        flags: Object.fromEntries(
            ALL_FLAGS.map((flag) => [flag, assignments.assignments.filter((assignment) => assignment.flags.includes(flag)).length]),
        ),
        consistency,
        orphanTags: orphanTags.map((tag) => `${tag.tagId} ${tag.title}`),
        broadTags: broadTags.map((tag) => `${tag.tagId} ${tag.title} (${String(tag.highlights)})`),
        thinTags: thinTags.map((tag) => `${tag.tagId} ${tag.title} (${String(tag.books)} 本)`),
        thinTagEvidence,
        tags: [...tagSummaries].sort((left, right) => left.tagId.localeCompare(right.tagId)),
        draftHighlightIds: draft.map((assignment) => assignment.highlightId),
    };
    await writeAtomic(resolve(root, 'trial-audit.json'), report);

    const lines: string[] = [
        '# Batch 3 试标审计',
        '',
        `- 生成时间：${report.generatedAt}`,
        `- 试标总数：${String(report.assignments)}`,
        `- reviewed / draft：${String(reviewed.length)} / ${String(draft.length)}`,
        `- 1 / 2 / 3 标签：${tagCounts.join(' / ')}`,
        `- 多标签比例：${(report.multiTagRate * 100).toFixed(1)}%`,
        `- 信心 high / medium / low：${String(report.confidence.high)} / ${String(report.confidence.medium)} / ${String(report.confidence.low)}`,
        `- 全部标签都出现在 embedding top-5：${String(consistency.assignmentsWithAllTagsInTop5)}`,
        `- 没有任何标签出现在 top-5：${String(consistency.assignmentsWithNoTagInTop5)}`,
        `- 来源：${Object.entries(consistency.provenance).map(([kind, count]) => `${kind} ${String(count)}`).join('，')}`,
        `- 已由实现 Agent 重点复核（非 ensemble、非 human）：${String(consistency.needsHumanEyes)}`,
        '',
        '## 已重点复核的子集',
        '',
        `- \`unresolved\`（无法归类）：${String(consistency.provenance.unresolved ?? 0)} 条`,
        `- \`override\`（全文推翻模型提议）：${String(consistency.provenance.override ?? 0)} 条`,
        `- \`lexical\`（低信心改为词面证据）：${String(consistency.provenance.lexical ?? 0)} 条`,
        `- \`human\`（已被人工改过）：${String(consistency.provenance.human ?? 0)} 条`,
        '',
        '## 标签覆盖',
        '',
        ...tagSummaries.map(
            (tag) =>
                `- ${tag.tagId} ${tag.title}：${String(tag.highlights)} 条 / ${String(tag.books)} 本（reviewed ${String(tag.reviewed)} / draft ${String(tag.draft)} / 脱离 top-5 ${String(tag.offEnsemble)}）`,
        ),
        '',
        '## 需要复核的结构问题',
        '',
        `- 零覆盖标签：${orphanTags.length === 0 ? '无' : orphanTags.map((tag) => `${tag.tagId} ${tag.title}`).join('、')}`,
        `- 覆盖超过 25% 的过宽标签：${broadTags.length === 0 ? '无' : broadTags.map((tag) => `${tag.tagId} ${tag.title}（${String(tag.highlights)}）`).join('、')}`,
        `- 不足 3 本的偏薄标签：${thinTags.length === 0 ? '无' : thinTags.map((tag) => `${tag.tagId} ${tag.title}（${String(tag.books)} 本）`).join('、')}`,
        ...thinTagEvidence.map(
            (tag) =>
                `- ${tag.tagId} ${tag.title} 全语料词面证据：${String(tag.highlights)} 条 / ${String(tag.books)} 本；处置：${tag.disposition === 'retain' ? '保留' : '继续复核'}`,
        ),
        '',
        '## 诚实保留为 draft',
        '',
        draft.length === 0 ? '无' : `${draft.map((assignment) => assignment.highlightId).join('、')}；不要求用户逐条处理，也不进入 reviewed 数据。`,
        '',
    ];
    await writeFile(resolve(root, 'trial-audit.md'), `${lines.join('\n')}\n`, 'utf8');

    console.log(`trial audit: ${String(reviewed.length)} reviewed / ${String(draft.length)} draft`);
    console.log(`tag counts 1/2/3: ${tagCounts.join(' / ')}; multi-tag ${(report.multiTagRate * 100).toFixed(1)}%`);
    console.log(`tag coverage: ${String(tagSummaries.filter((tag) => tag.highlights > 0).length)} / ${String(tagSummaries.length)}`);
    console.log(`orphan ${String(orphanTags.length)} / broad ${String(broadTags.length)} / thin ${String(thinTags.length)}`);
}

await main();
