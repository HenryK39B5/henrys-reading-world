import { coverUrl, useCoverAccent } from '../../app/covers.ts';
import type { SnapshotIndex } from '../../domain/snapshot.ts';
import {
    bookCountText,
    filterBooksByYear,
    highlightsForBook,
    highlightsForTheme,
    orderByRecentHighlight,
    summarizeBooks,
    summarizeThemes,
    themeCountText,
    yearOptions,
    type BookEntry,
    type ThemeEntry,
} from '../../domain/world.ts';
import { describeBookCollection, relativeYearLabel } from '../../domain/timeLabel.ts';
import type { Highlight } from '../../domain/types.ts';
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import './world.css';

const COLLAPSED_BOOK_COUNT = 5;
const THEME_PREVIEW_COUNT = 4;
const THEME_EXPANDED_COUNT = 12;

export type WorldProps = {
    index: SnapshotIndex;
    nowYear: number;
    yearFilter: number | null;
    onYearFilterChange: (year: number | null) => void;
    openBookId: string | null;
    onOpenBook: (bookId: string | null) => void;
    onOpenHighlight: (id: string) => void;
};

/**
 * The world beneath the stage: recently highlighted books, curated topics and the quiet about line.
 * Books and topics are read-only views over the same snapshot the stage uses.
 */
export function World({
    index,
    nowYear,
    yearFilter,
    onYearFilterChange,
    openBookId,
    onOpenBook,
    onOpenHighlight,
}: WorldProps) {
    const [showAllBooks, setShowAllBooks] = useState(false);
    const [expandedThemeId, setExpandedThemeId] = useState<string | null>(null);

    const allBooks = orderByRecentHighlight(summarizeBooks(index));
    const books = filterBooksByYear(allBooks, yearFilter);
    const visibleBooks = showAllBooks ? books : books.slice(0, COLLAPSED_BOOK_COUNT);
    const themes = summarizeThemes(index, yearFilter);
    const years = yearOptions(index);

    const openBook = openBookId === null ? null : (books.find((entry) => entry.book.id === openBookId) ?? null);
    const isFilteredEmpty = yearFilter !== null && books.length === 0 && themes.every((entry) => entry.highlightCount === 0);

    return (
        <div className="world">
            <div className="world-filter" role="group" aria-label="按年份筛选">
                <span className="filter-label">年份</span>
                <button
                    type="button"
                    className="chip"
                    aria-pressed={yearFilter === null}
                    data-testid="year-all"
                    onClick={() => {
                        onYearFilterChange(null);
                    }}
                >
                    全部
                </button>
                {years.map((year) => (
                    <button
                        key={year}
                        type="button"
                        className="chip"
                        aria-pressed={yearFilter === year}
                        data-testid={`year-${String(year)}`}
                        onClick={() => {
                            onYearFilterChange(yearFilter === year ? null : year);
                        }}
                    >
                        {year}
                    </button>
                ))}
            </div>

            {isFilteredEmpty ? (
                <p className="world-empty" data-testid="world-empty">
                    {String(yearFilter)} 年里没有收录任何划线。
                    <button
                        type="button"
                        className="link-button"
                        onClick={() => {
                            onYearFilterChange(null);
                        }}
                    >
                        清除筛选
                    </button>
                </p>
            ) : null}

            <section id="books" className="world-section" aria-labelledby="books-heading">
                <h2 id="books-heading" className="section-heading">
                    最近留下的划线
                </h2>
                <p className="section-note">按划线年份排列，与读完时间无关。</p>
                <ul className="book-list" data-testid="book-list">
                    {visibleBooks.map((entry) => (
                        <BookRow
                            key={entry.book.id}
                            entry={entry}
                            open={openBookId === entry.book.id}
                            onToggle={() => {
                                setExpandedThemeId(null);
                                onOpenBook(openBookId === entry.book.id ? null : entry.book.id);
                            }}
                        />
                    ))}
                </ul>
                {books.length > COLLAPSED_BOOK_COUNT ? (
                    <button
                        type="button"
                        className="link-button"
                        data-testid="toggle-all-books"
                        aria-expanded={showAllBooks}
                        onClick={() => {
                            setShowAllBooks(!showAllBooks);
                        }}
                    >
                        {showAllBooks ? '收起书籍列表' : '查看全部收录书籍'}
                    </button>
                ) : null}
                {books.length === 0 && !isFilteredEmpty ? (
                    <p className="world-empty">这一年里没有收录划线。</p>
                ) : null}

                {openBook === null ? null : (
                    <BookDetail
                        highlights={highlightsForBook(index, openBook.book.id, yearFilter)}
                        bookId={openBook.book.id}
                        title={openBook.book.title}
                        author={openBook.book.author}
                        coverPath={openBook.book.coverPath}
                        nowYear={nowYear}
                        onOpenHighlight={onOpenHighlight}
                    />
                )}
            </section>

            {/* id stays `topics` for the existing #topics navigation until the v2 information
                architecture pass (docs/11 V2-C) revisits the anchors. */}
            <section id="topics" className="world-section" aria-labelledby="themes-heading">
                <h2 id="themes-heading" className="section-heading">
                    主题书架
                </h2>
                <p className="section-note">
                    主题按书籍归档：点开看到的是这个书架上收录的书，以及其中若干划线。
                </p>
                <ul className="theme-list" data-testid="theme-list">
                    {themes.map((entry) => (
                        <ThemeRow
                            key={entry.theme.id}
                            entry={entry}
                            open={expandedThemeId === entry.theme.id}
                            index={index}
                            nowYear={nowYear}
                            onToggle={() => {
                                onOpenBook(null);
                                setExpandedThemeId(expandedThemeId === entry.theme.id ? null : entry.theme.id);
                            }}
                            onOpenHighlight={onOpenHighlight}
                            onClearYearFilter={() => {
                                onYearFilterChange(null);
                            }}
                        />
                    ))}
                </ul>
            </section>
        </div>
    );
}

/**
 * One theme shelf. Its dot takes the accent of the book it leads with, so the list has colour tied
 * to a real cover rather than to a palette picked by hand.
 */
function ThemeRow({
    entry,
    open,
    index,
    nowYear,
    onToggle,
    onOpenHighlight,
    onClearYearFilter,
}: {
    entry: ThemeEntry;
    open: boolean;
    index: SnapshotIndex;
    nowYear: number;
    onToggle: () => void;
    onOpenHighlight: (id: string) => void;
    onClearYearFilter: () => void;
}) {
    const lead = entry.leads[0];
    const leadBook = lead === undefined ? undefined : index.booksById.get(lead.bookId);
    const accent = useCoverAccent(coverUrl(leadBook?.coverPath));

    return (
        <li className="theme-item" style={{ '--book-accent': accent } as CSSProperties}>
            <button
                type="button"
                className="theme-button"
                data-testid={`theme-${entry.theme.id}`}
                aria-expanded={open}
                onClick={onToggle}
            >
                <span className="theme-title">{entry.theme.title}</span>
                <span className="theme-count">{themeCountText(entry)}</span>
            </button>
            {entry.theme.description === undefined ? null : <p className="theme-description">{entry.theme.description}</p>}
            {!open ? null : (
                <div className="theme-detail" data-testid={`theme-detail-${entry.theme.id}`}>
                    {entry.highlightCount === 0 ? (
                        <p className="world-empty">
                            这一年里没有这个书架中书籍的划线。
                            <button type="button" className="link-button" onClick={onClearYearFilter}>
                                清除筛选
                            </button>
                        </p>
                    ) : (
                        <>
                            <ul className="theme-highlights">
                                {highlightsForTheme(
                                    entry,
                                    entry.highlightCount > THEME_PREVIEW_COUNT ? THEME_EXPANDED_COUNT : THEME_PREVIEW_COUNT,
                                ).map((highlight) => (
                                    <ThemePassage
                                        key={highlight.id}
                                        highlight={highlight}
                                        index={index}
                                        nowYear={nowYear}
                                        onOpenHighlight={onOpenHighlight}
                                    />
                                ))}
                            </ul>
                            {entry.highlightCount > THEME_EXPANDED_COUNT ? (
                                <p className="section-note">
                                    这里显示前 {THEME_EXPANDED_COUNT} 处，共 {entry.highlightCount} 处。
                                </p>
                            ) : null}
                        </>
                    )}
                </div>
            )}
        </li>
    );
}

function BookRow({ entry, open, onToggle }: { entry: BookEntry; open: boolean; onToggle: () => void }) {
    const url = coverUrl(entry.book.coverPath);
    const accent = useCoverAccent(url);

    return (
        <li className="book-item" style={{ '--book-accent': accent } as CSSProperties}>
            <button type="button" className="book-button" data-testid={`book-${entry.book.id}`} aria-expanded={open} onClick={onToggle}>
                <span className="book-cover" aria-hidden="true">
                    {url === undefined ? (
                        <span className="book-cover-fallback">{entry.book.title}</span>
                    ) : (
                        <img src={url} alt="" loading="lazy" decoding="async" />
                    )}
                </span>
                <span className="book-title">《{entry.book.title}》</span>
                <span className="book-meta">
                    <span className="book-author">{entry.book.author}</span>
                    <span className="book-count">{bookCountText(entry)}</span>
                </span>
            </button>
        </li>
    );
}

function ThemePassage({
    highlight,
    index,
    nowYear,
    onOpenHighlight,
}: {
    highlight: Highlight;
    index: SnapshotIndex;
    nowYear: number;
    onOpenHighlight: (id: string) => void;
}) {
    const book = index.booksById.get(highlight.bookId);
    const timeLabel = relativeYearLabel(highlight.year, nowYear);
    return (
        <li className="theme-passage">
            <button
                type="button"
                className="passage-button"
                data-testid={`theme-passage-${highlight.id}`}
                onClick={() => {
                    onOpenHighlight(highlight.id);
                }}
            >
                <span className="passage-text">{highlight.text}</span>
                <span className="passage-source">
                    ——《{book?.title ?? '出处缺失'}》
                    {book?.author ?? '作者信息暂缺'}
                    {timeLabel === null ? null : ` · ${timeLabel}`}
                </span>
            </button>
        </li>
    );
}

function BookDetail({
    bookId,
    title,
    author,
    coverPath,
    highlights,
    nowYear,
    onOpenHighlight,
}: {
    bookId: string;
    title: string;
    author: string;
    coverPath: string | undefined;
    highlights: Highlight[];
    nowYear: number;
    onOpenHighlight: (id: string) => void;
}) {
    const [showAll, setShowAll] = useState(false);
    const headingRef = useRef<HTMLHeadingElement>(null);
    const visible = showAll ? highlights : highlights.slice(0, 6);
    const url = coverUrl(coverPath);
    const accent = useCoverAccent(url);

    // Opening a book is a navigation step: put focus on its heading, whether the visitor arrived from
    // the book list or from the source panel next to the passage.
    useEffect(() => {
        headingRef.current?.focus();
    }, [bookId]);

    return (
        <div className="book-detail" data-testid={`book-detail-${bookId}`} style={{ '--book-accent': accent } as CSSProperties}>
            <h3 className="book-detail-heading" tabIndex={-1} ref={headingRef} data-testid="book-detail-heading">
                《{title}》里的划线
            </h3>
            <div className="book-detail-head">
                <span className="book-cover book-cover-large" aria-hidden="true">
                    {url === undefined ? (
                        <span className="book-cover-fallback">{title}</span>
                    ) : (
                        <img src={url} alt="" decoding="async" />
                    )}
                </span>
                <p className="book-detail-meta">
                    {author}
                    <span className="book-detail-count">{describeBookCollection(highlights.length)}</span>
                </p>
            </div>
            {highlights.length === 0 ? (
                <p className="world-empty">这一年里没有这本书的划线。</p>
            ) : (
                <ul className="book-highlights">
                    {visible.map((highlight) => (
                        <li key={highlight.id} className="book-passage">
                            <button
                                type="button"
                                className="passage-button"
                                data-testid={`book-passage-${highlight.id}`}
                                onClick={() => {
                                    onOpenHighlight(highlight.id);
                                }}
                            >
                                <span className="passage-text">{highlight.text}</span>
                                <span className="passage-source">
                                    {relativeYearLabel(highlight.year, nowYear) ?? '年份未记录'}
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
            {highlights.length > 6 ? (
                <button
                    type="button"
                    className="link-button"
                    aria-expanded={showAll}
                    onClick={() => {
                        setShowAll(!showAll);
                    }}
                >
                    {showAll ? '收起' : `查看全部 ${String(highlights.length)} 处`}
                </button>
            ) : null}
        </div>
    );
}
