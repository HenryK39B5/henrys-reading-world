import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    updateHighlightAssignment,
    type AssignmentConfidence,
    type AssignmentFlag,
    type AssignmentProvenance,
    type AssignmentStatus,
    type HighlightTagAssignment,
    type TopicTagAssignments,
    type TopicTagDefinition,
    type TopicTagVocabulary,
} from '../domain/topicTags.ts';
import type { Snapshot } from '../domain/types.ts';
import { loadAssignments, loadStudioSnapshot, loadVocabulary, saveAssignments } from './api.ts';
import './studio.css';

/**
 * The local tag studio (docs/22 §6.2).
 *
 * This is content production, not the reading product: it shows the complete real passage, the tag
 * definitions and their boundaries, what the embedding proposed, and how the current assignment differs
 * from that proposal. It deliberately does not look like a product page, and it never decides for the
 * reviewer — the same way the publication reviewer never excludes anything by itself.
 *
 * What it enforces: one to three equally weighted tags in vocabulary order, a stable tag ID underneath the
 * label, and a strict private contract on save. What stays private: rationale, candidate scores, flags and
 * this whole screen never appear in a public build.
 */
type StatusFilter = 'all' | AssignmentStatus;
type ConfidenceFilter = 'all' | AssignmentConfidence;
type FlagFilter = 'all' | AssignmentFlag;

const FLAGS: AssignmentFlag[] = ['low-confidence', 'semantic-outlier', 'near-boundary', 'possible-missing-tag'];
const FLAG_LABELS: Record<AssignmentFlag, string> = {
    'low-confidence': '低信心',
    'semantic-outlier': '离群',
    'near-boundary': '近义边界',
    'possible-missing-tag': '可能漏标',
};
const PROVENANCES: AssignmentProvenance[] = ['unresolved', 'override', 'lexical', 'ensemble', 'human'];
const PROVENANCE_LABELS: Record<AssignmentProvenance, string> = {
    unresolved: '无法归类',
    override: '全文改写',
    lexical: '词面证据',
    ensemble: '与模型一致',
    human: '人工已改',
};

function sortByEditorialOrder(tagIds: string[], order: Map<string, number>): string[] {
    return [...new Set(tagIds)].sort((left, right) => (order.get(left) ?? 0) - (order.get(right) ?? 0));
}

function contradictsProposal(assignment: HighlightTagAssignment): boolean {
    return assignment.provenance === 'override' || assignment.provenance === 'lexical';
}

export function TagStudioApp() {
    const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
    const [problem, setProblem] = useState<string | null>(null);
    const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
    const [vocabulary, setVocabulary] = useState<TopicTagVocabulary | null>(null);
    const [assignments, setAssignments] = useState<TopicTagAssignments | null>(null);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [query, setQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [confidenceFilter, setConfidenceFilter] = useState<ConfidenceFilter>('all');
    const [flagFilter, setFlagFilter] = useState<FlagFilter>('all');
    const [provenanceFilter, setProvenanceFilter] = useState<'all' | AssignmentProvenance>('all');
    const [familyId, setFamilyId] = useState('all');
    const [dirty, setDirty] = useState(false);
    const [saving, setSaving] = useState(false);
    const [notice, setNotice] = useState<{ kind: 'ok' | 'bad'; text: string } | null>(null);

    useEffect(() => {
        let cancelled = false;
        void (async () => {
            try {
                const [loadedSnapshot, loadedVocabulary, loadedAssignments] = await Promise.all([
                    loadStudioSnapshot(),
                    loadVocabulary(),
                    loadAssignments(),
                ]);
                if (cancelled) {
                    return;
                }
                setSnapshot(loadedSnapshot);
                setVocabulary(loadedVocabulary);
                setAssignments(loadedAssignments);
                setSelectedId(loadedAssignments.assignments[0]?.highlightId ?? null);
                setPhase('ready');
            } catch (error) {
                if (!cancelled) {
                    setProblem(error instanceof Error ? error.message : String(error));
                    setPhase('error');
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const highlightById = useMemo(
        () => new Map((snapshot?.highlights ?? []).map((highlight) => [highlight.id, highlight])),
        [snapshot],
    );
    const bookById = useMemo(() => new Map((snapshot?.books ?? []).map((book) => [book.id, book])), [snapshot]);
    const tagById = useMemo(() => new Map((vocabulary?.tags ?? []).map((tag) => [tag.id, tag])), [vocabulary]);
    const order = useMemo(() => new Map((vocabulary?.tags ?? []).map((tag) => [tag.id, tag.editorialOrder])), [vocabulary]);

    const rows = useMemo(() => {
        if (assignments === null) {
            return [];
        }
        const needle = query.trim().toLowerCase();
        return assignments.assignments.filter((assignment) => {
            if (statusFilter !== 'all' && assignment.status !== statusFilter) {
                return false;
            }
            if (confidenceFilter !== 'all' && assignment.confidence !== confidenceFilter) {
                return false;
            }
            if (flagFilter !== 'all' && !assignment.flags.includes(flagFilter)) {
                return false;
            }
            if (provenanceFilter !== 'all' && assignment.provenance !== provenanceFilter) {
                return false;
            }
            if (familyId !== 'all' && !assignment.tagIds.some((tagId) => tagById.get(tagId)?.familyId === familyId)) {
                return false;
            }
            if (needle.length === 0) {
                return true;
            }
            const highlight = highlightById.get(assignment.highlightId);
            const book = highlight === undefined ? undefined : bookById.get(highlight.bookId);
            const label = assignment.tagIds.map((tagId) => tagById.get(tagId)?.title ?? tagId).join(' ');
            return (
                assignment.highlightId.toLowerCase().includes(needle) ||
                (highlight?.text.toLowerCase().includes(needle) ?? false) ||
                (book?.title.toLowerCase().includes(needle) ?? false) ||
                label.toLowerCase().includes(needle)
            );
        });
    }, [assignments, query, statusFilter, confidenceFilter, flagFilter, provenanceFilter, familyId, highlightById, bookById, tagById]);

    const summary = useMemo(() => {
        if (assignments === null) {
            return null;
        }
        const reviewed = assignments.assignments.filter((assignment) => assignment.status === 'reviewed').length;
        return {
            total: assignments.assignments.length,
            reviewed,
            draft: assignments.assignments.length - reviewed,
            low: assignments.assignments.filter((assignment) => assignment.confidence === 'low').length,
        };
    }, [assignments]);

    const selected = assignments?.assignments.find((assignment) => assignment.highlightId === selectedId) ?? null;
    const selectedHighlight = selected === null ? undefined : highlightById.get(selected.highlightId);
    const selectedBook = selectedHighlight === undefined ? undefined : bookById.get(selectedHighlight.bookId);

    const edit = useCallback(
        (change: Pick<HighlightTagAssignment, 'tagIds' | 'status' | 'confidence' | 'rationale' | 'flags'>) => {
            if (assignments === null || selected === null) {
                return;
            }
            setAssignments(updateHighlightAssignment(assignments, selected.highlightId, change, new Date().toISOString()));
            setDirty(true);
            setNotice(null);
        },
        [assignments, selected],
    );

    const changeTags = useCallback(
        (next: string[]) => {
            if (selected === null || next.length < 1 || next.length > 3) {
                return;
            }
            edit({
                tagIds: sortByEditorialOrder(next, order),
                status: selected.status,
                confidence: selected.confidence,
                rationale: selected.rationale,
                flags: selected.flags,
            });
        },
        [edit, order, selected],
    );

    const save = useCallback(async () => {
        if (assignments === null) {
            return;
        }
        setSaving(true);
        const errors = await saveAssignments(assignments);
        setSaving(false);
        if (errors.length === 0) {
            setDirty(false);
            setNotice({ kind: 'ok', text: '已原子保存到 .private/tags/assignments.json。' });
            return;
        }
        setNotice({ kind: 'bad', text: errors.join('\n') });
    }, [assignments]);

    if (phase === 'loading') {
        return (
            <main className="tag-studio">
                <p data-testid="studio-loading">正在读取本机快照、词表与试标…</p>
            </main>
        );
    }
    if (phase === 'error' || snapshot === null || vocabulary === null || assignments === null || summary === null) {
        return (
            <main className="tag-studio">
                <h1>Local Tag Studio</h1>
                <pre className="studio-problem" data-testid="studio-problem">
                    {problem ?? '无法启动 Studio。'}
                </pre>
                <p>
                    先运行 <code>npm run tags:promote</code>、<code>npm run tags:trial:generate</code>、
                    <code>npm run tags:trial:review</code>，再用 <code>npm run tags:studio</code> 打开本页。
                </p>
            </main>
        );
    }

    return (
        <main className="tag-studio" data-testid="tag-studio">
            <header className="studio-head">
                <h1>
                    Local Tag Studio <span className="studio-muted">Henry&apos;s Reading World</span>
                </h1>
                <p className="studio-muted" data-testid="studio-source">
                    仅本机 · {String(snapshot.highlights.length)} 条真实划线 · {String(vocabulary.tags.length)} 个稳定标签 ·{' '}
                    {String(vocabulary.families.length)} 个内部家族 <br />
                    试标：reviewed <span data-testid="studio-reviewed">{String(summary.reviewed)}</span> / draft{' '}
                    <span data-testid="studio-draft">{String(summary.draft)}</span> · 低信心 {String(summary.low)} ·{' '}
                    词表 {vocabulary.approvedAt}
                </p>
                <div className="studio-save">
                    <button type="button" onClick={() => void save()} disabled={saving} data-testid="studio-save">
                        {saving ? '保存中…' : '保存全部'}
                    </button>
                    <span className="studio-muted" data-testid="studio-dirty">
                        {dirty ? '有未保存的修改' : '已保存'}
                    </span>
                </div>
                {notice === null ? null : (
                    <p className={notice.kind === 'ok' ? 'studio-ok' : 'studio-bad'} data-testid="studio-notice">
                        {notice.text}
                    </p>
                )}
            </header>

            <section className="studio-filters" aria-label="筛选">
                <label>
                    搜索 ID / 原文 / 书名 / 标签
                    <input
                        type="search"
                        value={query}
                        data-testid="studio-search"
                        onChange={(event) => {
                            setQuery(event.target.value);
                        }}
                    />
                </label>
                <label>
                    状态
                    <select
                        value={statusFilter}
                        data-testid="studio-status"
                        onChange={(event) => {
                            setStatusFilter(event.target.value as StatusFilter);
                        }}
                    >
                        <option value="all">全部</option>
                        <option value="draft">draft</option>
                        <option value="reviewed">reviewed</option>
                    </select>
                </label>
                <label>
                    信心
                    <select
                        value={confidenceFilter}
                        data-testid="studio-confidence"
                        onChange={(event) => {
                            setConfidenceFilter(event.target.value as ConfidenceFilter);
                        }}
                    >
                        <option value="all">全部</option>
                        <option value="low">low</option>
                        <option value="medium">medium</option>
                        <option value="high">high</option>
                    </select>
                </label>
                <label>
                    标记
                    <select
                        value={flagFilter}
                        data-testid="studio-flag"
                        onChange={(event) => {
                            setFlagFilter(event.target.value as FlagFilter);
                        }}
                    >
                        <option value="all">全部</option>
                        {FLAGS.map((flag) => (
                            <option key={flag} value={flag}>
                                {FLAG_LABELS[flag]}
                            </option>
                        ))}
                    </select>
                </label>
                <label>
                    家族
                    <select
                        value={familyId}
                        data-testid="studio-family"
                        onChange={(event) => {
                            setFamilyId(event.target.value);
                        }}
                    >
                        <option value="all">全部</option>
                        {vocabulary.families.map((family) => (
                            <option key={family.id} value={family.id}>
                                {family.title}
                            </option>
                        ))}
                    </select>
                </label>
                <label>
                    来源
                    <select
                        value={provenanceFilter}
                        data-testid="studio-provenance"
                        onChange={(event) => {
                            setProvenanceFilter(event.target.value as 'all' | AssignmentProvenance);
                        }}
                    >
                        <option value="all">全部</option>
                        {/* The Gate's review order: not decided by the model first. */}
                        {PROVENANCES.map((kind) => (
                            <option key={kind} value={kind}>
                                {PROVENANCE_LABELS[kind]}
                            </option>
                        ))}
                    </select>
                </label>
                <span className="studio-muted" data-testid="studio-count">
                    {String(rows.length)} / {String(summary.total)}
                </span>
            </section>

            <div className="studio-layout">
                <nav className="studio-list" aria-label="试标列表">
                    {rows.map((row) => {
                        const highlight = highlightById.get(row.highlightId);
                        const book = highlight === undefined ? undefined : bookById.get(highlight.bookId);
                        return (
                            <button
                                type="button"
                                key={row.highlightId}
                                className={row.highlightId === selectedId ? 'active' : ''}
                                onClick={() => {
                                    setSelectedId(row.highlightId);
                                }}
                            >
                                <strong>{row.highlightId}</strong>
                                <span>{row.tagIds.map((tagId) => tagById.get(tagId)?.title ?? tagId).join(' · ')}</span>
                                <small>
                                    {book?.title ?? '未知书'} · {row.status} / {row.confidence}
                                    {row.provenance === 'ensemble' ? '' : ` · ${PROVENANCE_LABELS[row.provenance]}`}
                                    {row.flags.length > 0 ? ` · ${row.flags.map((flag) => FLAG_LABELS[flag]).join('、')}` : ''}
                                </small>
                            </button>
                        );
                    })}
                </nav>

                {selected === null || selectedHighlight === undefined || selectedBook === undefined ? (
                    <article className="studio-detail">
                        <p>没有匹配的试标。</p>
                    </article>
                ) : (
                    <article className="studio-detail" data-testid="studio-detail">
                        <p className="studio-muted">
                            {selected.highlightId} · 《{selectedBook.title}》{selectedBook.author} ·{' '}
                            {selectedBook.themeIds.map((themeId) => snapshot.themes.find((theme) => theme.id === themeId)?.title ?? themeId).join(' / ')}
                            {' · '}{PROVENANCE_LABELS[selected.provenance]}
                            {contradictsProposal(selected) ? '（与 embedding 提议不同）' : ''}
                        </p>
                        <blockquote>{selectedHighlight.text}</blockquote>

                        <section aria-label="embedding 候选">
                            <h2>embedding 候选（top-5）</h2>
                            <div className="studio-candidates">
                                {selected.candidates.map((candidate) => {
                                    const tag = tagById.get(candidate.tagId);
                                    const used = selected.tagIds.includes(candidate.tagId);
                                    return (
                                        <button
                                            type="button"
                                            key={candidate.tagId}
                                            disabled={used || selected.tagIds.length >= 3}
                                            onClick={() => {
                                                changeTags([...selected.tagIds, candidate.tagId]);
                                            }}
                                        >
                                            {tag?.title ?? candidate.tagId} {candidate.score.toFixed(2)}
                                        </button>
                                    );
                                })}
                            </div>
                        </section>

                        <fieldset className="studio-tags">
                            <legend>标签（1–3 个，地位平等，按词表顺序显示）</legend>
                            {vocabulary.families.map((family) => {
                                const familyTags = vocabulary.tags.filter((tag) => tag.familyId === family.id);
                                if (familyTags.length === 0) {
                                    return null;
                                }
                                return (
                                    <section key={family.id}>
                                        <h2>{family.title}</h2>
                                        <div className="studio-tag-row">
                                            {familyTags.map((tag) => (
                                                <label key={tag.id} title={`${tag.definition}\n不包括：${tag.excludes.join('；')}`}>
                                                    <input
                                                        type="checkbox"
                                                        checked={selected.tagIds.includes(tag.id)}
                                                        onChange={(event) => {
                                                            if (event.target.checked) {
                                                                changeTags([...selected.tagIds, tag.id]);
                                                                return;
                                                            }
                                                            changeTags(selected.tagIds.filter((tagId) => tagId !== tag.id));
                                                        }}
                                                    />
                                                    {tag.title}
                                                </label>
                                            ))}
                                        </div>
                                    </section>
                                );
                            })}
                        </fieldset>

                        <section aria-label="当前标签定义">
                            <h2>当前标签的定义与边界</h2>
                            <ul className="studio-definitions">
                                {selected.tagIds.map((tagId) => {
                                    const tag: TopicTagDefinition | undefined = tagById.get(tagId);
                                    return (
                                        <li key={tagId}>
                                            <strong>{tag?.title ?? tagId}</strong>（{tagId}）：{tag?.definition}
                                            <br />
                                            <span className="studio-muted">
                                                包括 {tag?.includes.join('；')} · 不包括 {tag?.excludes.join('；')}
                                            </span>
                                        </li>
                                    );
                                })}
                            </ul>
                        </section>

                        <div className="studio-editor">
                            <label>
                                状态
                                <select
                                    value={selected.status}
                                    data-testid="studio-status-field"
                                    onChange={(event) => {
                                        edit({
                                            tagIds: selected.tagIds,
                                            status: event.target.value as AssignmentStatus,
                                            confidence: selected.confidence,
                                            rationale: selected.rationale,
                                            flags: selected.flags,
                                        });
                                    }}
                                >
                                    <option value="draft">draft</option>
                                    <option value="reviewed">reviewed</option>
                                </select>
                            </label>
                            <label>
                                信心
                                <select
                                    value={selected.confidence}
                                    data-testid="studio-confidence-field"
                                    onChange={(event) => {
                                        edit({
                                            tagIds: selected.tagIds,
                                            status: selected.status,
                                            confidence: event.target.value as AssignmentConfidence,
                                            rationale: selected.rationale,
                                            flags: selected.flags,
                                        });
                                    }}
                                >
                                    <option value="low">low</option>
                                    <option value="medium">medium</option>
                                    <option value="high">high</option>
                                </select>
                            </label>
                            <button
                                type="button"
                                data-testid="studio-mark-draft"
                                onClick={() => {
                                    edit({
                                        tagIds: selected.tagIds,
                                        status: 'draft',
                                        confidence: 'low',
                                        rationale: 'Marked for a second look in the Studio.',
                                        flags: ['low-confidence', 'possible-missing-tag'],
                                    });
                                }}
                            >
                                标记为待定
                            </button>
                        </div>

                        <fieldset className="studio-flags">
                            <legend>标记</legend>
                            {FLAGS.map((flag) => (
                                <label key={flag}>
                                    <input
                                        type="checkbox"
                                        checked={selected.flags.includes(flag)}
                                        onChange={(event) => {
                                            const next = event.target.checked
                                                ? [...selected.flags, flag]
                                                : selected.flags.filter((entry) => entry !== flag);
                                            edit({
                                                tagIds: selected.tagIds,
                                                status: selected.status,
                                                confidence: selected.confidence,
                                                rationale: selected.rationale,
                                                flags: FLAGS.filter((entry) => next.includes(entry)),
                                            });
                                        }}
                                    />
                                    {FLAG_LABELS[flag]}
                                </label>
                            ))}
                        </fieldset>

                        <label className="studio-rationale">
                            私有理由（不进快照）
                            <textarea
                                value={selected.rationale}
                                data-testid="studio-rationale"
                                onChange={(event) => {
                                    edit({
                                        tagIds: selected.tagIds,
                                        status: selected.status,
                                        confidence: selected.confidence,
                                        rationale: event.target.value.length > 0 ? event.target.value : 'Manual Studio edit.',
                                        flags: selected.flags,
                                    });
                                }}
                            />
                        </label>
                    </article>
                )}
            </div>
        </main>
    );
}
