import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { validateSnapshot } from '../src/domain/validate.ts';
import { validateTopicTagAssignments, validateTopicTagVocabulary } from '../src/domain/topicTags.ts';
import { LOCAL_SNAPSHOT_PATH } from './embeddings/privatePaths.ts';

type RerankerFile = {
    model: string;
    scores: Record<string, Array<{ tagId: string; score: number }>>;
};

type AuditedAssignment = {
    highlightId: string;
    tagIds: string[];
    status: 'reviewed' | 'draft';
    provenance: string;
    confidence: string;
    candidates: Array<{ tagId: string; score: number }>;
    flags: string[];
};

type RiskRow = {
    highlightId: string;
    bookId: string;
    acceptedTagId: string;
    risk: number;
    reasons: string[];
    embeddingMargin: number;
    rerankerRank: number;
    rerankerScore: number;
    rerankerGap: number;
};

async function writeAtomic(path: string, value: unknown): Promise<void> {
    await mkdir(dirname(path), { recursive: true });
    const temporary = `${path}.tmp-${String(process.pid)}`;
    await writeFile(temporary, typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    await rename(temporary, path);
}

function quantile(values: readonly number[], fraction: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((left, right) => left - right);
    return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * fraction))] ?? 0;
}

function evenlySpaced<T>(values: readonly T[], count: number): T[] {
    if (values.length <= count) return [...values];
    return Array.from({ length: count }, (_, index) => values[Math.floor(index * (values.length - 1) / (count - 1))] as T);
}

async function main(): Promise<void> {
    const tagsRoot = resolve(process.cwd(), '.private', 'tags');
    const batchRoot = resolve(tagsRoot, 'batch6');
    const snapshotCheck = validateSnapshot(JSON.parse(await readFile(LOCAL_SNAPSHOT_PATH, 'utf8')) as unknown, {
        expectedVisibility: 'local-only',
    });
    if (!snapshotCheck.ok) throw new Error(snapshotCheck.errors.join('; '));
    const snapshot = snapshotCheck.snapshot;
    const vocabularyCheck = validateTopicTagVocabulary(JSON.parse(await readFile(resolve(tagsRoot, 'vocabulary.json'), 'utf8')) as unknown);
    if (!vocabularyCheck.ok) throw new Error(vocabularyCheck.errors.join('; '));
    const vocabulary = vocabularyCheck.value;
    const assignmentCheck = validateTopicTagAssignments(
        JSON.parse(await readFile(resolve(tagsRoot, 'assignments.json'), 'utf8')) as unknown,
        snapshot,
        vocabulary,
        new Set(snapshot.highlights.map((highlight) => highlight.id)),
    );
    if (!assignmentCheck.ok) throw new Error(assignmentCheck.errors.join('; '));
    const assignments = assignmentCheck.value.assignments as AuditedAssignment[];
    const baselineCheck = validateTopicTagAssignments(
        JSON.parse(await readFile(resolve(batchRoot, 'baseline-assignments.json'), 'utf8')) as unknown,
        snapshot,
        vocabulary,
    );
    if (!baselineCheck.ok) throw new Error(baselineCheck.errors.join('; '));
    const baselineIds = new Set(baselineCheck.value.assignments.map((assignment) => assignment.highlightId));
    const reranker = JSON.parse(await readFile(resolve(batchRoot, 'reranker-scores.json'), 'utf8')) as RerankerFile;
    const highlightById = new Map(snapshot.highlights.map((highlight) => [highlight.id, highlight]));
    const bookById = new Map(snapshot.books.map((book) => [book.id, book]));
    const tagById = new Map(vocabulary.tags.map((tag) => [tag.id, tag]));

    const risks: RiskRow[] = [];
    for (const assignment of assignments) {
        if (assignment.status !== 'reviewed' || baselineIds.has(assignment.highlightId)) continue;
        const acceptedTagId = assignment.tagIds[0];
        const highlight = highlightById.get(assignment.highlightId);
        const scores = [...(reranker.scores[assignment.highlightId] ?? [])]
            .sort((left, right) => right.score - left.score || left.tagId.localeCompare(right.tagId));
        const rerankerRank = scores.findIndex((candidate) => candidate.tagId === acceptedTagId);
        const acceptedScore = scores.find((candidate) => candidate.tagId === acceptedTagId)?.score ?? Number.NEGATIVE_INFINITY;
        const topScore = scores[0]?.score ?? Number.NEGATIVE_INFINITY;
        const nextScore = scores[1]?.score ?? Number.NEGATIVE_INFINITY;
        const embeddingMargin = (assignment.candidates[0]?.score ?? 0) - (assignment.candidates[1]?.score ?? 0);
        const reasons: string[] = [];
        let risk = 0;
        if (rerankerRank === 1) { risk += 3; reasons.push('reranker-second'); }
        if (topScore - nextScore < 0.35) { risk += 2; reasons.push('reranker-near-tie'); }
        if (acceptedScore < -6) { risk += 2; reasons.push('weak-absolute-reranker-score'); }
        if (embeddingMargin < 0.35) { risk += 2; reasons.push('embedding-near-boundary'); }
        if (assignment.flags.includes('near-boundary')) { risk += 1; reasons.push('assignment-near-boundary'); }
        risks.push({
            highlightId: assignment.highlightId,
            bookId: highlight?.bookId ?? 'missing-book',
            acceptedTagId: acceptedTagId ?? 'missing-tag',
            risk,
            reasons,
            embeddingMargin,
            rerankerRank,
            rerankerScore: acceptedScore,
            rerankerGap: topScore - nextScore,
        });
    }
    risks.sort((left, right) => right.risk - left.risk || left.highlightId.localeCompare(right.highlightId));

    const tagAudit = vocabulary.tags.map((tag) => {
        const reviewed = assignments.filter((assignment) => assignment.status === 'reviewed' && assignment.tagIds.includes(tag.id));
        const autoReviewed = reviewed.filter((assignment) => !baselineIds.has(assignment.highlightId));
        const topDrafts = assignments.filter((assignment) => assignment.status === 'draft' && assignment.candidates[0]?.tagId === tag.id);
        const byBook = new Map<string, number>();
        for (const assignment of reviewed) {
            const bookId = highlightById.get(assignment.highlightId)?.bookId ?? 'missing-book';
            byBook.set(bookId, (byBook.get(bookId) ?? 0) + 1);
        }
        const books = [...byBook.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
        const maxBookCount = books[0]?.[1] ?? 0;
        const maxBookShare = reviewed.length === 0 ? 0 : maxBookCount / reviewed.length;
        return {
            tagId: tag.id,
            title: tag.title,
            reviewed: reviewed.length,
            autoReviewed: autoReviewed.length,
            draftTopCandidate: topDrafts.length,
            books: books.length,
            maxBookId: books[0]?.[0] ?? null,
            maxBookTitle: books[0] === undefined ? null : bookById.get(books[0][0])?.title ?? null,
            maxBookCount,
            maxBookShare,
            thin: reviewed.length < 5,
            broad: reviewed.length > Math.max(80, assignments.length * 0.04),
            bookConcentrated: reviewed.length >= 8 && maxBookShare > 0.55,
        };
    });

    const reviewed = assignments.filter((assignment) => assignment.status === 'reviewed');
    const draft = assignments.filter((assignment) => assignment.status === 'draft');
    const report = {
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        rerankerModel: reranker.model,
        assignments: assignments.length,
        reviewed: reviewed.length,
        draft: draft.length,
        preservedBaseline: baselineIds.size,
        autoReviewed: reviewed.length - baselineIds.size + baselineCheck.value.assignments.filter((assignment) => assignment.status === 'draft').length,
        confidence: Object.fromEntries(['high', 'medium', 'low'].map((level) => [level, assignments.filter((assignment) => assignment.confidence === level).length])),
        provenance: Object.fromEntries(['human', 'override', 'lexical', 'ensemble', 'unresolved'].map((kind) => [kind, assignments.filter((assignment) => assignment.provenance === kind).length])),
        risk: {
            count: risks.length,
            highRisk: risks.filter((row) => row.risk >= 5).length,
            median: quantile(risks.map((row) => row.risk), 0.5),
            p90: quantile(risks.map((row) => row.risk), 0.9),
            rows: risks,
        },
        tags: tagAudit,
        thinTags: tagAudit.filter((tag) => tag.thin).map((tag) => tag.tagId),
        broadTags: tagAudit.filter((tag) => tag.broad).map((tag) => tag.tagId),
        bookConcentratedTags: tagAudit.filter((tag) => tag.bookConcentrated).map((tag) => tag.tagId),
    };
    await writeAtomic(resolve(batchRoot, 'full-audit.json'), report);

    const markdown: string[] = [
        '# Batch 6 全量标签复核样本',
        '',
        `- assignments: ${String(assignments.length)}`,
        `- reviewed / draft: ${String(reviewed.length)} / ${String(draft.length)}`,
        `- auto-reviewed risk >= 5: ${String(report.risk.highRisk)}`,
        `- thin / broad / book-concentrated tags: ${String(report.thinTags.length)} / ${String(report.broadTags.length)} / ${String(report.bookConcentratedTags.length)}`,
        '',
        '## 自动 reviewed 高风险队列',
        '',
    ];
    for (const row of risks.slice(0, 220)) {
        const highlight = highlightById.get(row.highlightId);
        const book = highlight === undefined ? undefined : bookById.get(highlight.bookId);
        markdown.push(
            `### ${row.highlightId} · 《${book?.title ?? '未知书籍'}》`,
            '',
            highlight?.text ?? '[missing highlight]',
            '',
            `- accepted: ${tagById.get(row.acceptedTagId)?.title ?? row.acceptedTagId}`,
            `- risk ${String(row.risk)}: ${row.reasons.join(', ') || 'none'}`,
            `- embedding margin ${row.embeddingMargin.toFixed(3)} · reranker rank ${String(row.rerankerRank + 1)} · score ${row.rerankerScore.toFixed(3)} · gap ${row.rerankerGap.toFixed(3)}`,
            '',
        );
    }
    markdown.push('## 各标签代表性 reviewed 与 draft 边界', '');
    for (const tag of vocabulary.tags) {
        const accepted = assignments
            .filter((assignment) => assignment.status === 'reviewed' && !baselineIds.has(assignment.highlightId) && assignment.tagIds.includes(tag.id))
            .sort((left, right) => (right.candidates[0]?.score ?? 0) - (left.candidates[0]?.score ?? 0));
        const boundary = assignments
            .filter((assignment) => assignment.status === 'draft' && assignment.candidates[0]?.tagId === tag.id)
            .sort((left, right) => (right.candidates[0]?.score ?? 0) - (left.candidates[0]?.score ?? 0));
        markdown.push(`### ${tag.title}`, '', `- reviewed ${String(tagAudit.find((row) => row.tagId === tag.id)?.reviewed ?? 0)} · draft-top ${String(boundary.length)}`, '');
        for (const assignment of [...evenlySpaced(accepted, 3), ...boundary.slice(0, 2)]) {
            const highlight = highlightById.get(assignment.highlightId);
            const book = highlight === undefined ? undefined : bookById.get(highlight.bookId);
            markdown.push(
                `- **${assignment.status} · ${assignment.highlightId} · 《${book?.title ?? '未知书籍'}》**`,
                `  ${highlight?.text.replace(/\s+/gu, ' ').trim() ?? '[missing highlight]'}`,
            );
        }
        markdown.push('');
    }
    await writeAtomic(resolve(batchRoot, 'review-sample.md'), `${markdown.join('\n')}\n`);
    console.log(`Batch 6 audit: ${String(reviewed.length)} reviewed / ${String(draft.length)} draft`);
    console.log(`high-risk auto-reviewed: ${String(report.risk.highRisk)}; thin/broad/concentrated: ${String(report.thinTags.length)}/${String(report.broadTags.length)}/${String(report.bookConcentratedTags.length)}`);
}

await main();
