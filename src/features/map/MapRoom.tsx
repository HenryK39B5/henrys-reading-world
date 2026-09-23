import { useEffect, useMemo, useRef, useState } from 'react';
import { coverUrl, useCoverAccent } from '../../app/covers.ts';
import { DEFAULT_ACCENT } from '../../domain/accent.ts';
import { fitMapPoints, mapPointsForBook, mapPointsForTag, summarizeMapLabels } from '../../domain/map.ts';
import type { SnapshotIndex } from '../../domain/snapshot.ts';
import type { Book, Highlight } from '../../domain/types.ts';
import { TopicClues } from '../paths/TopicClues.tsx';
import { MapCanvas } from './MapCanvas.tsx';
import { MapBookPicker } from './MapBookPicker.tsx';
import { useMapView } from './useMapView.ts';

const INITIAL_MAP_LIST_ITEMS = 12;

export type MapRoomProps = {
    index: SnapshotIndex;
    tagId: string | null;
    bookId: string | null;
    highlightId: string | null;
    onNavigate: (path: string) => void;
    onShare: (highlightId: string) => void;
};

function mapHref(options: { tagId?: string | null; bookId?: string | null; highlightId?: string | null }): string {
    const params = new URLSearchParams();
    if (options.tagId !== null && options.tagId !== undefined) params.set('tag', options.tagId);
    if (options.bookId !== null && options.bookId !== undefined) params.set('book', options.bookId);
    if (options.highlightId !== null && options.highlightId !== undefined) params.set('h', options.highlightId);
    const query = params.toString();
    return query.length === 0 ? '/map' : `/map?${query}`;
}

function MapDetail({
    index,
    highlight,
    currentTagId,
    bookId,
    onShare,
    accent,
    headingRef,
}: {
    index: SnapshotIndex;
    highlight: Highlight;
    currentTagId: string | null;
    bookId: string | null;
    onShare: (highlightId: string) => void;
    accent: string;
    headingRef: React.Ref<HTMLHeadingElement>;
}) {
    const book = index.booksById.get(highlight.bookId);
    const tags = highlight.tagIds.map((tagId) => index.tagsById.get(tagId)).filter((tag) => tag !== undefined);
    return (
        <article
            className="map-detail"
            aria-labelledby="map-detail-heading"
            data-testid="map-detail"
            style={{ '--map-detail-accent': accent } as React.CSSProperties}
        >
            <div className="map-detail-head">
                <p className="room-kicker">地图上的一处划线</p>
                <a
                    className="map-detail-close"
                    href={mapHref({ tagId: currentTagId, bookId })}
                    aria-label="关闭划线详情"
                    title="关闭"
                >
                    ×
                </a>
            </div>
            <h2 id="map-detail-heading" className="map-detail-title" tabIndex={-1} ref={headingRef}>
                {book === undefined ? '出处暂缺' : `《${book.title}》`}
            </h2>
            <blockquote className="map-detail-passage">
                <p>{highlight.text}</p>
            </blockquote>
            {book === undefined ? null : <p className="map-detail-source">——《{book.title}》{book.author}</p>}
            <TopicClues tags={tags} {...(currentTagId === null ? {} : { currentTagId })} />
            <div className="map-detail-actions">
                {book === undefined ? null : <a className="room-exit" href={`/books/${encodeURIComponent(book.id)}`}>进入这本书</a>}
                {tags[0] === undefined ? null : <a className="room-exit" href={`/paths/${encodeURIComponent(tags[0].id)}`}>沿小径继续</a>}
                <button type="button" className="share-trigger" onClick={() => onShare(highlight.id)}>分享</button>
            </div>
        </article>
    );
}

function bookTagIds(index: SnapshotIndex, book: Book | undefined): string[] {
    if (book === undefined) return [];
    const counts = new Map<string, number>();
    for (const highlight of index.highlightsByBook.get(book.id) ?? []) {
        for (const tagId of highlight.tagIds) counts.set(tagId, (counts.get(tagId) ?? 0) + 1);
    }
    return [...counts.entries()]
        .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
        .map(([tagId]) => tagId);
}

export function MapRoom({ index, tagId, bookId, highlightId, onNavigate, onShare }: MapRoomProps) {
    const layout = index.snapshot.map;
    const tag = tagId === null ? undefined : index.tagsById.get(tagId);
    const book = bookId === null ? undefined : index.booksById.get(bookId);
    const highlight = highlightId === null ? undefined : index.highlightsById.get(highlightId);
    const effectiveTagId = tag?.id ?? null;
    const effectiveBookId = book?.id ?? null;
    const view = useMapView(index, effectiveTagId);
    const bookAccent = useCoverAccent(coverUrl(book?.coverPath));
    // The arrived-at passage has its own source even when the book picker is empty or lights another book.
    const detailBook = highlight === undefined ? undefined : index.booksById.get(highlight.bookId);
    const detailAccent = useCoverAccent(coverUrl(detailBook?.coverPath));
    const labelSummaries = useMemo(() => summarizeMapLabels(index), [index]);
    const regionHighlights = effectiveTagId === null ? [] : (index.highlightsByTag.get(effectiveTagId) ?? []);
    const relatedTagIds = bookTagIds(index, book);
    const primaryRelatedTagIds = relatedTagIds.slice(0, 6);
    const remainingRelatedTagIds = relatedTagIds.slice(6);
    const [expandedLists, setExpandedLists] = useState<Set<string>>(() => new Set());
    const detailHeading = useRef<HTMLHeadingElement>(null);
    const returnTo = useRef<{ element: HTMLElement; scrollY: number } | null>(null);
    const previousDetailId = useRef<string | null>(highlight?.id ?? null);
    const selectedId = highlight?.id ?? null;

    // Content-level URL changes keep the same room key: room focus/scroll memory cannot land on this detail.
    // Defer until after the shell's room-entry focus effect on a direct URL, then restore the actual
    // list/canvas opener on close or browser Back. Never focus a detached anchor from another region.
    useEffect(() => {
        const previous = previousDetailId.current;
        previousDetailId.current = selectedId;
        if (selectedId === null && previous === null) return;
        // The shell's room-memory timeout can otherwise reset a direct link to the top after we scroll.
        const timer = window.setTimeout(() => {
            if (selectedId !== null) {
                const heading = detailHeading.current;
                heading?.focus({ preventScroll: true });
                if (heading !== null) {
                    const bounds = heading.getBoundingClientRect();
                    const compact = window.innerWidth < 1050;
                    const readingTop = compact ? Math.min(168, window.innerHeight * 0.22) : 24;
                    // A title barely peeking above the fold is not an arrival: show the first lines too.
                    if (bounds.top < 24 || bounds.top > (compact ? window.innerHeight * 0.45 : window.innerHeight * 0.62)
                        || bounds.bottom > window.innerHeight - 24) {
                        window.scrollBy({ top: bounds.top - readingTop, behavior: 'instant' });
                    }
                }
            } else {
                const remembered = returnTo.current;
                const fallback = document.querySelector<HTMLElement>('[data-testid="map-canvas"]');
                const target = remembered?.element.isConnected ? remembered.element : fallback;
                if (remembered !== null && target === remembered.element) {
                    window.scrollTo({ top: remembered.scrollY, behavior: 'instant' });
                } else {
                    target?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
                }
                target?.focus({ preventScroll: true });
                returnTo.current = null;
            }
        }, 0);
        return () => window.clearTimeout(timer);
    }, [selectedId]);

    const rememberOpener = (element: HTMLElement): void => {
        returnTo.current = { element, scrollY: window.scrollY };
    };
    const listKey = effectiveTagId === null ? 'regions' : `tag:${effectiveTagId}`;
    const listExpanded = expandedLists.has(listKey);
    const visibleLabelSummaries = listExpanded ? labelSummaries : labelSummaries.slice(0, INITIAL_MAP_LIST_ITEMS);
    const visibleRegionHighlights = listExpanded ? regionHighlights : regionHighlights.slice(0, INITIAL_MAP_LIST_ITEMS);
    const listTotal = effectiveTagId === null ? labelSummaries.length : regionHighlights.length;
    const listShown = effectiveTagId === null ? visibleLabelSummaries.length : visibleRegionHighlights.length;
    const canToggleList = listTotal > INITIAL_MAP_LIST_ITEMS;
    const toggleList = (): void => {
        setExpandedLists((current) => {
            const next = new Set(current);
            if (next.has(listKey)) next.delete(listKey);
            else next.add(listKey);
            return next;
        });
    };
    const unknownSelection =
        (tagId !== null && tag === undefined) ||
        (bookId !== null && book === undefined) ||
        (highlightId !== null && highlight === undefined);

    if (layout === undefined || layout.points.length === 0) {
        return (
            <section className="room" aria-labelledby="map-heading" data-room="map">
                <h1 id="map-heading" className="room-heading" data-testid="room-heading">阅读世界地图</h1>
                <p className="room-note" data-testid="map-empty">当前范围还没有生成可展示的地图。</p>
                <nav className="room-exits" aria-label="地图房间的出口">
                    <a className="room-exit" href="/paths">回到主题小径</a>
                    <a className="room-exit" href="/">随便看看</a>
                </nav>
            </section>
        );
    }

    const pointCount = layout.points.length;
    const namedCount = index.coverage.taggedHighlightCount;
    const level = highlight === undefined ? (tag === undefined ? 'world' : 'region') : 'detail';
    const selectedBookPoints = book === undefined ? [] : mapPointsForBook(index, book.id);

    return (
        <section className="room room-map" aria-labelledby="map-heading" data-room="map" data-map-level={level}>
            <header className="map-head">
                <div>
                    <p className="room-kicker">{tag === undefined ? '全部真实划线形成的地形' : '正在查看主题区域'}</p>
                    <h1 id="map-heading" className="room-heading" data-testid="room-heading">
                        {tag === undefined ? '阅读世界地图' : tag.title}
                    </h1>
                    <p className="map-summary" data-testid="map-summary">
                        {String(pointCount)} 个真实点 · {String(namedCount)} 个已命名点
                    </p>
                    {tag?.description === undefined ? null : <p className="map-region-description">{tag.description}</p>}
                </div>
                <a className="room-exit map-list-return" href="/paths">小径列表</a>
            </header>

            {unknownSelection ? (
                <p className="map-selection-note" role="status">
                    地址中的某个地图选择不在当前收录范围，地图已保持在最近的有效层级。
                </p>
            ) : null}

            <div className="map-toolbar" aria-label="地图控制">
                <div className="map-zoom-controls" role="group" aria-label="缩放与复位">
                    <button type="button" className="map-icon-button" aria-label="放大地图" title="放大" onClick={view.zoomIn}>+</button>
                    <button type="button" className="map-icon-button" aria-label="缩小地图" title="缩小" onClick={view.zoomOut}>−</button>
                    <button type="button" className="map-icon-button" aria-label="复位地图" title="复位" onClick={view.reset}>↺</button>
                    <output className="map-zoom-readout" aria-label="当前地图缩放比例">{String(Math.round(view.view.zoom * 100))}%</output>
                </div>
                <MapBookPicker
                    books={index.booksInUse}
                    selected={book}
                    accent={bookAccent || DEFAULT_ACCENT}
                    onSelect={(id) => onNavigate(mapHref({ tagId: effectiveTagId, bookId: id }))}
                />
            </div>

            {book === undefined ? null : (
                <div className="map-book-light" style={{ '--map-book-aura': bookAccent || DEFAULT_ACCENT } as React.CSSProperties}>
                    <p>
                        <span className="map-book-swatch" aria-hidden="true" />
                        <strong>《{book.title}》</strong>
                        <span>{String(selectedBookPoints.length)} 个点散落在地图中</span>
                    </p>
                    <div className="map-book-paths">
                        {relatedTagIds.length === 0 ? <p>这本书的划线尚无 reviewed 小径。</p> : (
                            <>
                                <p>
                                    {primaryRelatedTagIds.map((relatedTagId) => {
                                        const relatedTag = index.tagsById.get(relatedTagId);
                                        return relatedTag === undefined ? null : (
                                            <a key={relatedTag.id} href={mapHref({ tagId: relatedTag.id, bookId: book.id })}>#{relatedTag.title}</a>
                                        );
                                    })}
                                </p>
                                {remainingRelatedTagIds.length === 0 ? null : (
                                    <details>
                                        <summary>展开全部 {String(relatedTagIds.length)} 条相关小径</summary>
                                        <p>
                                            {remainingRelatedTagIds.map((relatedTagId) => {
                                                const relatedTag = index.tagsById.get(relatedTagId);
                                                return relatedTag === undefined ? null : (
                                                    <a key={relatedTag.id} href={mapHref({ tagId: relatedTag.id, bookId: book.id })}>#{relatedTag.title}</a>
                                                );
                                            })}
                                        </p>
                                    </details>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}

            <div className="map-stage" data-testid="map-stage">
                <div className="map-stage-status" aria-hidden="true">
                    <span>{tag === undefined ? '世界总览' : `主题区域 · ${tag.title}`}</span>
                    <span>拖动 · 滚轮 / 双指缩放</span>
                </div>
                <MapCanvas
                    index={index}
                    view={view.view}
                    onViewChange={view.setView}
                    activeTagId={effectiveTagId}
                    activeBookId={effectiveBookId}
                    activeHighlightId={highlight?.id ?? null}
                    bookAccent={bookAccent || DEFAULT_ACCENT}
                    highlightAccent={detailAccent || DEFAULT_ACCENT}
                    onSelectTag={(nextTagId) => {
                        onNavigate(mapHref({ tagId: nextTagId, bookId: effectiveBookId }));
                    }}
                    onSelectHighlight={(nextHighlightId) => {
                        const opener = document.activeElement;
                        const canvas = document.querySelector<HTMLElement>('[data-testid="map-canvas"]');
                        if (opener instanceof HTMLElement && opener.isConnected && opener !== document.body) rememberOpener(opener);
                        else if (canvas !== null) rememberOpener(canvas);
                        onNavigate(mapHref({ tagId: effectiveTagId, bookId: effectiveBookId, highlightId: nextHighlightId }));
                    }}
                />
                {highlight === undefined ? null : (
                    <MapDetail
                        index={index}
                        highlight={highlight}
                        currentTagId={effectiveTagId}
                        bookId={effectiveBookId}
                        onShare={onShare}
                        accent={detailAccent || DEFAULT_ACCENT}
                        headingRef={detailHeading}
                    />
                )}
            </div>

            {tag === undefined ? (
                <section className="map-alternative" aria-labelledby="map-regions-heading">
                    <h2 id="map-regions-heading">主题区域</h2>
                    <ol id="map-region-list" className="map-region-list">
                        {visibleLabelSummaries.map((summary) => (
                            <li key={summary.tagId}>
                                <a href={mapHref({ tagId: summary.tagId, bookId: effectiveBookId })}>
                                    <strong>{summary.title}</strong>
                                    <span>{String(summary.bookCount)} 本书 · {String(summary.highlightCount)} 处划线</span>
                                </a>
                            </li>
                        ))}
                    </ol>
                    {canToggleList ? (
                        <div className="map-list-disclosure">
                            <button
                                type="button"
                                className="link-button"
                                aria-controls="map-region-list"
                                aria-expanded={listExpanded}
                                data-testid="map-regions-toggle"
                                onClick={toggleList}
                            >
                                {listExpanded ? '收起主题区域' : `展开全部 ${String(listTotal)} 个主题区域`}
                            </button>
                            <span className="batch-label">显示 {String(listShown)} / {String(listTotal)}</span>
                        </div>
                    ) : null}
                </section>
            ) : (
                <section className="map-alternative" aria-labelledby="map-points-heading">
                    <div className="map-alternative-head">
                        <h2 id="map-points-heading">「{tag.title}」区域里的划线</h2>
                        <button
                            type="button"
                            className="room-exit"
                            onClick={() => view.setView(fitMapPoints(mapPointsForTag(index, tag.id)))}
                        >
                            回到这片区域
                        </button>
                    </div>
                    <ol id="map-point-list" className="map-point-list">
                        {visibleRegionHighlights.map((entry) => {
                            const entryBook = index.booksById.get(entry.bookId);
                            return (
                                <li key={entry.id}>
                                    <a href={mapHref({ tagId: tag.id, bookId: effectiveBookId, highlightId: entry.id })}
                                        onClick={(event) => {
                                            if (event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
                                                rememberOpener(event.currentTarget);
                                            }
                                        }}>
                                        <span>{entry.text}</span>
                                        <small>{entryBook === undefined ? '出处暂缺' : `《${entryBook.title}》${entryBook.author}`}</small>
                                    </a>
                                </li>
                            );
                        })}
                    </ol>
                    {canToggleList ? (
                        <div className="map-list-disclosure">
                            <button
                                type="button"
                                className="link-button"
                                aria-controls="map-point-list"
                                aria-expanded={listExpanded}
                                data-testid="map-points-toggle"
                                onClick={toggleList}
                            >
                                {listExpanded ? '收起这片区域' : `展开全部 ${String(listTotal)} 处划线`}
                            </button>
                            <span className="batch-label">显示 {String(listShown)} / {String(listTotal)}</span>
                        </div>
                    ) : null}
                </section>
            )}

            <nav className="room-exits" aria-label="地图房间的出口">
                {tag === undefined ? null : <a className="room-exit" href={mapHref({ bookId: effectiveBookId })}>回到世界总览</a>}
                <a className="room-exit" href="/paths">主题小径</a>
                <a className="room-exit" href="/">随便看看</a>
            </nav>
        </section>
    );
}
