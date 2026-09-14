import { useCallback, useEffect, useMemo, useState } from 'react';
import { indexSnapshot } from '../domain/snapshot.ts';
import { countNonWhitespace } from '../domain/length.ts';
import {
    LONG_PASSAGE,
    bookStats,
    decisionOf,
    initialPublicationPolicy,
    publicationSummary,
    reconcilePublicationPolicy,
    releaseReadiness,
    setBookDecision,
    setBookNote,
    setReviewComplete,
    toggleCover,
    toggleHighlightExclusion,
    validatePublicationPolicy,
    type BookPublicationDecision,
    type PublicationDecision,
    type PublicationPolicy,
} from '../domain/publication.ts';
import type { Snapshot } from '../domain/types.ts';
import { loadPolicy, loadSnapshot, savePolicy } from './api.ts';

/**
 * The local publication reviewer (docs/17 §5).
 *
 * This is a publishing tool, not a page of the product: it lists every real passage because a person has
 * to look at them, it can search and sort, and it writes one file on this machine. It is deliberately not
 * pretty in the product's sense — the product's restraint belongs to the reading experience, and a review
 * screen that hides a 531-passage book behind the same minimalism would be worse at its job.
 *
 * What it will not do: decide for the reviewer. Lengths and counts are shown because they are facts; no
 * score, no suggestion and no automatic exclusion is offered (docs/17 §5.3).
 */
type Filter = 'all' | PublicationDecision;
type Sort = 'id' | 'length' | 'year';

const FILTERS: { value: Filter; label: string }[] = [
    { value: 'all', label: '全部' },
    { value: 'unreviewed', label: '未审核' },
    { value: 'publish', label: '公开' },
    { value: 'exclude', label: '排除' },
];

const DECISIONS: { value: PublicationDecision; label: string }[] = [
    { value: 'publish', label: '公开' },
    { value: 'exclude', label: '排除' },
    { value: 'unreviewed', label: '未定' },
];

function length(text: string): number {
    return countNonWhitespace(text);
}

export function ReviewApp() {
    const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
    const [problem, setProblem] = useState<string | null>(null);
    const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
    const [policy, setPolicy] = useState<PublicationPolicy | null>(null);
    const [dirty, setDirty] = useState(false);
    const [saving, setSaving] = useState(false);
    const [notice, setNotice] = useState<{ kind: 'ok' | 'bad'; text: string } | null>(null);
    const [filter, setFilter] = useState<Filter>('all');
    const [query, setQuery] = useState('');
    const [sort, setSort] = useState<Sort>('id');
    const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());

    useEffect(() => {
        let cancelled = false;
        void (async () => {
            try {
                const loaded = await loadSnapshot();
                const stored = await loadPolicy();
                if (cancelled) {
                    return;
                }
                let next: PublicationPolicy;
                if (stored === null) {
                    next = initialPublicationPolicy(loaded);
                    setNotice({
                        kind: 'bad',
                        text: '还没有发布清单：已按“全部未审核”开始，保存后写入 .private/curation/publication-policy.json。',
                    });
                    setDirty(true);
                } else {
                    const checked = validatePublicationPolicy(stored, loaded);
                    if (!checked.ok) {
                        setProblem(`发布清单未通过校验：\n${checked.errors.join('\n')}`);
                        setPhase('error');
                        return;
                    }
                    // New books join as unreviewed; existing decisions stay exactly as they are.
                    next = reconcilePublicationPolicy(checked.policy, loaded).policy;
                }
                setSnapshot(loaded);
                setPolicy(next);
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

    const index = useMemo(() => (snapshot === null ? null : indexSnapshot(snapshot)), [snapshot]);
    const summary = useMemo(
        () => (snapshot === null || policy === null ? null : publicationSummary(policy, snapshot)),
        [snapshot, policy],
    );
    const readiness = useMemo(
        () => (snapshot === null || policy === null ? null : releaseReadiness(policy, snapshot)),
        [snapshot, policy],
    );

    const rows = useMemo(() => {
        if (snapshot === null || policy === null) {
            return [];
        }
        const needle = query.trim().toLowerCase();
        return snapshot.books
            .filter((book) => {
                const decision = decisionOf(policy, book.id).decision;
                if (filter !== 'all' && decision !== filter) {
                    return false;
                }
                if (needle.length === 0) {
                    return true;
                }
                return (
                    book.title.toLowerCase().includes(needle) || book.author.toLowerCase().includes(needle)
                );
            })
            .map((book) => ({ book, stats: bookStats(policy, snapshot, book.id) }));
    }, [snapshot, policy, filter, query]);

    const edit = useCallback((change: (current: PublicationPolicy) => PublicationPolicy) => {
        setPolicy((current) => (current === null ? current : change(current)));
        setDirty(true);
        setNotice(null);
    }, []);

    const save = useCallback(async () => {
        if (policy === null) {
            return;
        }
        setSaving(true);
        const result = await savePolicy(policy);
        setSaving(false);
        if (result.ok) {
            setDirty(false);
            setNotice({ kind: 'ok', text: '已保存到 .private/curation/publication-policy.json。' });
            return;
        }
        setNotice({ kind: 'bad', text: `未保存：\n${result.errors.join('\n')}` });
    }, [policy]);

    if (phase === 'loading') {
        return (
            <main className="review">
                <p data-testid="review-loading">正在读取本机快照与发布清单…</p>
            </main>
        );
    }
    if (phase === 'error' || snapshot === null || policy === null || summary === null || readiness === null) {
        return (
            <main className="review">
                <h1>发布审核</h1>
                <pre className="review-problem" data-testid="review-problem">
                    {problem ?? '无法启动审核器。'}
                </pre>
                <p>
                    启动方式：<code>npm run publication:init</code> 生成清单，
                    <code>npm run publication:review</code> 打开这个页面。
                </p>
            </main>
        );
    }

    const highlightsOf = (bookId: string) => {
        const passages = snapshot.highlights.filter((highlight) => highlight.bookId === bookId);
        if (sort === 'length') {
            return [...passages].sort((left, right) => length(right.text) - length(left.text) || (left.id < right.id ? -1 : 1));
        }
        if (sort === 'year') {
            return [...passages].sort((left, right) => (right.year ?? 0) - (left.year ?? 0) || (left.id < right.id ? -1 : 1));
        }
        return [...passages].sort((left, right) => (left.id < right.id ? -1 : 1));
    };

    return (
        <main className="review" data-testid="review">
            <header className="review-head">
                <h1>
                    发布审核 <span className="review-muted">Henry's Reading World</span>
                </h1>
                <p className="review-muted" data-testid="review-source">
                    本机快照：{String(snapshot.books.length)} 本 / {String(snapshot.highlights.length)} 条划线 ·
                    清单文件：.private/curation/publication-policy.json ·
                    目标：henryk39b5.github.io/henrys-reading-world/（本页不发布任何内容）
                </p>
            </header>

            <section className="review-summary" aria-label="审核进度" data-testid="review-summary">
                <dl>
                    <div>
                        <dt>已审核</dt>
                        <dd data-testid="summary-reviewed">
                            {summary.reviewed} / {summary.totalBooks}
                        </dd>
                    </div>
                    <div>
                        <dt>公开 / 排除 / 未审核</dt>
                        <dd>
                            <span data-testid="summary-published">{summary.published}</span> /{' '}
                            <span data-testid="summary-excluded">{summary.excluded}</span> /{' '}
                            <span data-testid="summary-unreviewed">{summary.unreviewed}</span>
                        </dd>
                    </div>
                    <div>
                        <dt>预计公开划线 / 字符</dt>
                        <dd data-testid="summary-selected">
                            {summary.selectedHighlights} 条 / {summary.selectedCharacters} 字符
                        </dd>
                    </div>
                    <div>
                        <dt>公开封面</dt>
                        <dd data-testid="summary-covers">{summary.publishedCovers}</dd>
                    </div>
                    <div>
                        <dt>单条排除</dt>
                        <dd data-testid="summary-excluded-highlights">{summary.excludedHighlights}</dd>
                    </div>
                    <div>
                        <dt>长引用待复核（≥{LONG_PASSAGE} 字）</dt>
                        <dd data-testid="summary-long">{summary.longHighlights}</dd>
                    </div>
                    <div>
                        <dt>书架（保留 / 移除）</dt>
                        <dd data-testid="summary-themes">
                            {summary.themesKept} / {summary.themesDropped}
                        </dd>
                    </div>
                </dl>

                <div className="review-controls">
                    <label className="review-check">
                        <input
                            type="checkbox"
                            data-testid="review-complete"
                            checked={policy.reviewComplete}
                            onChange={(event) => {
                                const result = setReviewComplete(policy, snapshot, event.target.checked);
                                if (result.refused !== null) {
                                    setNotice({ kind: 'bad', text: result.refused });
                                    return;
                                }
                                edit(() => result.policy);
                            }}
                        />
                        审核完成（export 前提；未审核书不为 0 时会被拒绝）
                    </label>
                    <p className="review-readiness" data-testid="review-readiness">
                        releaseReady: {String(readiness.ready)}
                        {readiness.ready ? '' : ` — ${readiness.reasons.join('；')}`}
                    </p>
                    <div className="review-save">
                        <button type="button" onClick={() => void save()} disabled={saving} data-testid="save-policy">
                            {saving ? '保存中…' : '保存清单'}
                        </button>
                        <span className="review-muted" data-testid="dirty-state">
                            {dirty ? '有未保存的修改' : '已保存'}
                        </span>
                    </div>
                    {notice === null ? null : (
                        <p
                            className={notice.kind === 'ok' ? 'review-notice-ok' : 'review-notice-bad'}
                            data-testid="review-notice"
                        >
                            {notice.text}
                        </p>
                    )}
                </div>
            </section>

            <section className="review-filters" aria-label="筛选">
                <div role="group" aria-label="按状态筛选">
                    {FILTERS.map((entry) => (
                        <button
                            key={entry.value}
                            type="button"
                            aria-pressed={filter === entry.value}
                            data-testid={`filter-${entry.value}`}
                            onClick={() => {
                                setFilter(entry.value);
                            }}
                        >
                            {entry.label}
                        </button>
                    ))}
                </div>
                <label>
                    搜索书名或作者
                    <input
                        type="search"
                        value={query}
                        data-testid="review-search"
                        onChange={(event) => {
                            setQuery(event.target.value);
                        }}
                    />
                </label>
                <label>
                    划线排序
                    <select
                        value={sort}
                        data-testid="review-sort"
                        onChange={(event) => {
                            setSort(event.target.value as Sort);
                        }}
                    >
                        <option value="id">按稳定 ID</option>
                        <option value="length">按长度（长到短）</option>
                        <option value="year">按年份（新到旧）</option>
                    </select>
                </label>
                <span className="review-muted" data-testid="review-row-count">
                    显示 {rows.length} 本
                </span>
            </section>

            <ol className="review-books" data-testid="review-books">
                {rows.map(({ book, stats }) => {
                    const decision: BookPublicationDecision = decisionOf(policy, book.id);
                    const open = expanded.has(book.id);
                    const passages = open ? highlightsOf(book.id) : [];
                    return (
                        <li
                            key={book.id}
                            className="review-book"
                            data-testid={`review-book-${book.id}`}
                            data-decision={decision.decision}
                        >
                            <div className="review-book-head">
                                <div>
                                    <p className="review-book-title">
                                        《{book.title}》 <span className="review-muted">{book.author}</span>
                                    </p>
                                    <p className="review-muted">
                                        {book.id} · {stats.highlightCount} 条 · {stats.characters} 字符 · 最长{' '}
                                        {stats.longest} · ≥{LONG_PASSAGE} 字 {stats.longCount} 条 ·{' '}
                                        {stats.hasCover ? '有封面' : '无封面'} · 预计公开 {stats.selected} 条
                                        {stats.selectedLongCount > 0 ? `（含 ${stats.selectedLongCount} 条长引用）` : ''}
                                    </p>
                                    <p className="review-muted">
                                        书架：
                                        {book.themeIds.length === 0
                                            ? '未归档'
                                            : book.themeIds
                                                  .map(
                                                      (themeId) =>
                                                          index?.themesById.get(themeId)?.title ?? themeId,
                                                  )
                                                  .join('、')}
                                    </p>
                                </div>
                                <div className="review-book-actions">
                                    <div role="group" aria-label={`${book.title} 的公开决定`}>
                                        {DECISIONS.map((entry) => (
                                            <button
                                                key={entry.value}
                                                type="button"
                                                aria-pressed={decision.decision === entry.value}
                                                data-testid={`decide-${entry.value}-${book.id}`}
                                                onClick={() => {
                                                    edit((current) => setBookDecision(current, book.id, entry.value));
                                                }}
                                            >
                                                {entry.label}
                                            </button>
                                        ))}
                                    </div>
                                    <label className="review-check">
                                        <input
                                            type="checkbox"
                                            data-testid={`cover-${book.id}`}
                                            checked={decision.cover === 'publish' && stats.hasCover}
                                            disabled={!stats.hasCover}
                                            onChange={() => {
                                                edit((current) => toggleCover(current, book.id));
                                            }}
                                        />
                                        公开封面{stats.hasCover ? '' : '（无封面）'}
                                    </label>
                                    <input
                                        type="text"
                                        className="review-note"
                                        placeholder="私有备注（不会进入网站）"
                                        data-testid={`note-${book.id}`}
                                        value={decision.note ?? ''}
                                        onChange={(event) => {
                                            const value = event.target.value;
                                            edit((current) => setBookNote(current, book.id, value));
                                        }}
                                    />
                                    <button
                                        type="button"
                                        data-testid={`expand-${book.id}`}
                                        aria-expanded={open}
                                        onClick={() => {
                                            setExpanded((current) => {
                                                const next = new Set(current);
                                                if (next.has(book.id)) {
                                                    next.delete(book.id);
                                                } else {
                                                    next.add(book.id);
                                                }
                                                return next;
                                            });
                                        }}
                                    >
                                        {open ? '收起划线' : `查看并排除个别划线（${String(stats.highlightCount)}）`}
                                    </button>
                                </div>
                            </div>

                            {open ? (
                                <ul className="review-passages" data-testid={`passages-${book.id}`}>
                                    {passages.map((passage) => {
                                        const excluded = decision.excludedHighlightIds.includes(passage.id);
                                        const size = length(passage.text);
                                        return (
                                            <li key={passage.id} data-excluded={excluded ? 'true' : 'false'}>
                                                <div className="review-passage-head">
                                                    <span className="review-muted">
                                                        {passage.id}
                                                        {passage.year === undefined ? '' : ` · ${String(passage.year)}`} ·{' '}
                                                        {size} 字{size >= LONG_PASSAGE ? ' · 长引用' : ''}
                                                    </span>
                                                    <label className="review-check">
                                                        <input
                                                            type="checkbox"
                                                            data-testid={`exclude-${passage.id}`}
                                                            checked={excluded}
                                                            onChange={() => {
                                                                edit((current) =>
                                                                    toggleHighlightExclusion(current, book.id, passage.id),
                                                                );
                                                            }}
                                                        />
                                                        排除这条
                                                    </label>
                                                </div>
                                                <p className="review-passage-text">{passage.text}</p>
                                            </li>
                                        );
                                    })}
                                </ul>
                            ) : null}
                        </li>
                    );
                })}
            </ol>
        </main>
    );
}
