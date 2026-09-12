import type { SnapshotIndex } from '../../domain/snapshot.ts';
import {
    bookCountText,
    filterBooksByYear,
    highlightsForBook,
    highlightsForTopic,
    orderByRecentHighlight,
    summarizeBooks,
    summarizeTopics,
    topicCountText,
    yearOptions,
} from '../../domain/world.ts';
import { relativeYearLabel } from '../../domain/timeLabel.ts';
import type { Highlight } from '../../domain/types.ts';
import { useEffect, useRef, useState } from 'react';
import './world.css';

const COLLAPSED_BOOK_COUNT = 5;
const TOPIC_PREVIEW_COUNT = 4;
const TOPIC_EXPANDED_COUNT = 12;

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
    const [expandedTopicId, setExpandedTopicId] = useState<string | null>(null);

    const allBooks = orderByRecentHighlight(summarizeBooks(index));
    const books = filterBooksByYear(allBooks, yearFilter);
    const visibleBooks = showAllBooks ? books : books.slice(0, COLLAPSED_BOOK_COUNT);
    const topics = summarizeTopics(index, yearFilter);
    const years = yearOptions(index);

    const openBook = openBookId === null ? null : (books.find((entry) => entry.book.id === openBookId) ?? null);
    const isFilteredEmpty = yearFilter !== null && books.length === 0 && topics.every((entry) => entry.highlightCount === 0);

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
                        <li key={entry.book.id} className="book-item">
                            <button
                                type="button"
                                className="book-button"
                                data-testid={`book-${entry.book.id}`}
                                aria-expanded={openBookId === entry.book.id}
                                onClick={() => {
                                    setExpandedTopicId(null);
                                    onOpenBook(openBookId === entry.book.id ? null : entry.book.id);
                                }}
                            >
                                <span className="book-title">《{entry.book.title}》</span>
                                <span className="book-author">{entry.book.author}</span>
                                <span className="book-count">{bookCountText(entry)}</span>
                            </button>
                        </li>
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
                        nowYear={nowYear}
                        onOpenHighlight={onOpenHighlight}
                    />
                )}
            </section>

            <section id="topics" className="world-section" aria-labelledby="topics-heading">
                <h2 id="topics-heading" className="section-heading">
                    反复出现的问题
                </h2>
                <p className="section-note">这些主题由真实划线整理而成，只呈现材料，不替主人下结论。</p>
                <ul className="topic-list" data-testid="topic-list">
                    {topics.map((entry) => {
                        const expanded = expandedTopicId === entry.topic.id;
                        return (
                            <li key={entry.topic.id} className="topic-item">
                                <button
                                    type="button"
                                    className="topic-button"
                                    data-testid={`topic-${entry.topic.id}`}
                                    aria-expanded={expanded}
                                    onClick={() => {
                                        onOpenBook(null);
                                        setExpandedTopicId(expanded ? null : entry.topic.id);
                                    }}
                                >
                                    <span className="topic-title">{entry.topic.title}</span>
                                    <span className="topic-count">{topicCountText(entry)}</span>
                                </button>
                                {entry.topic.description === undefined ? null : (
                                    <p className="topic-description">{entry.topic.description}</p>
                                )}
                                {expanded ? (
                                    <div className="topic-detail" data-testid={`topic-detail-${entry.topic.id}`}>
                                        {entry.highlightCount === 0 ? (
                                            <p className="world-empty">
                                                这一年里没有与这个主题相关的划线。
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
                                        ) : (
                                            <>
                                                <ul className="topic-highlights">
                                                    {highlightsForTopic(
                                                        entry,
                                                        expanded && entry.highlightCount > TOPIC_PREVIEW_COUNT
                                                            ? TOPIC_EXPANDED_COUNT
                                                            : TOPIC_PREVIEW_COUNT,
                                                    ).map((highlight) => (
                                                        <TopicPassage
                                                            key={highlight.id}
                                                            highlight={highlight}
                                                            index={index}
                                                            nowYear={nowYear}
                                                            onOpenHighlight={onOpenHighlight}
                                                        />
                                                    ))}
                                                </ul>
                                                {entry.highlightCount > TOPIC_EXPANDED_COUNT ? (
                                                    <p className="section-note">
                                                        这里显示前 {TOPIC_EXPANDED_COUNT} 处，共 {entry.highlightCount} 处。
                                                    </p>
                                                ) : null}
                                            </>
                                        )}
                                    </div>
                                ) : null}
                            </li>
                        );
                    })}
                </ul>
            </section>
        </div>
    );
}

function TopicPassage({
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
        <li className="topic-passage">
            <button
                type="button"
                className="passage-button"
                data-testid={`topic-passage-${highlight.id}`}
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
    highlights,
    nowYear,
    onOpenHighlight,
}: {
    bookId: string;
    title: string;
    highlights: Highlight[];
    nowYear: number;
    onOpenHighlight: (id: string) => void;
}) {
    const [showAll, setShowAll] = useState(false);
    const headingRef = useRef<HTMLHeadingElement>(null);
    const visible = showAll ? highlights : highlights.slice(0, 6);

    // Opening a book is a navigation step: put focus on its heading, whether the visitor arrived from
    // the book list or from the source panel next to the passage.
    useEffect(() => {
        headingRef.current?.focus();
    }, [bookId]);

    return (
        <div className="book-detail" data-testid={`book-detail-${bookId}`}>
            <h3 className="book-detail-heading" tabIndex={-1} ref={headingRef} data-testid="book-detail-heading">
                《{title}》里的划线
            </h3>
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
