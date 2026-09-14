import { CoverImage } from '../../app/CoverImage.tsx';
import type { SnapshotIndex } from '../../domain/snapshot.ts';
import { BOOK_BATCH_STEP, batchLabel, hasMore } from '../../domain/reading.ts';
import {
    bookCountText,
    filterBooksByTheme,
    filterBooksByYear,
    orderByRecentHighlight,
    summarizeBooks,
    summarizeThemes,
    yearOptions,
} from '../../domain/world.ts';
import type { BookEntry } from '../../domain/world.ts';
import type { BatchStore } from './useBatches.ts';

export type BooksRoomProps = {
    index: SnapshotIndex;
    year: number | null;
    themeId: string | null;
    batches: BatchStore;
};

function booksHref(year: number | null, themeId: string | null): string {
    const params = new URLSearchParams();
    if (year !== null) {
        params.set('year', String(year));
    }
    if (themeId !== null) {
        params.set('theme', themeId);
    }
    const query = params.toString();
    return query.length === 0 ? '/books' : `/books?${query}`;
}

/**
 * One book's own URL.
 *
 * The library's year filter is where the visitor was, not a property of the book: the room walks the
 * whole book in rounds, so the link no longer carries `?year=` (docs/17 §3.3). 返回上一处 still restores
 * the filtered library it came from, because that address is the library's own.
 */
function bookHref(bookId: string): string {
    return `/books/${bookId}`;
}

/**
 * 所有书: the library with honest filters and batches (docs/12 §2.4).
 *
 * The year filter belongs to this room only — shelves and shelf rooms are never filtered by it. Filters
 * live in the URL, so a refresh or a return from a book room restores exactly this list.
 */
export function BooksRoom({ index, year, themeId, batches }: BooksRoomProps) {
    const all = orderByRecentHighlight(summarizeBooks(index));
    const shelf = themeId === null ? null : (summarizeThemes(index).find((entry) => entry.theme.id === themeId)?.theme ?? null);
    const books = filterBooksByYear(filterBooksByTheme(all, themeId), year);
    const years = yearOptions(index);

    const batchKey = `${year === null ? 'all' : String(year)}|${themeId ?? 'all'}`;
    const loaded = batches.loadedFor(batchKey, books.length);
    const visible = books.slice(0, loaded);
    const more = hasMore(loaded, books.length);

    return (
        <section className="room" aria-labelledby="books-heading" data-room="books">
            <h1 id="books-heading" className="room-heading" data-testid="room-heading">
                所有书
            </h1>
            <p className="room-note">
                按最近留下划线的一年排列，与读完时间无关。这里显示 {books.length} 本。
            </p>

            <div className="filter-row">
                <span className="filter-label">年份</span>
                <a
                    className="chip"
                    href={booksHref(null, themeId)}
                    data-testid="year-all"
                    aria-current={year === null ? 'true' : undefined}
                >
                    全部
                </a>
                {years.map((option) => (
                    <a
                        key={option}
                        className="chip"
                        href={booksHref(option, themeId)}
                        data-testid={`year-${String(option)}`}
                        aria-current={year === option ? 'true' : undefined}
                    >
                        {option}
                    </a>
                ))}
            </div>

            {shelf === null ? null : (
                <p className="room-note shelf-filter" data-testid="shelf-filter">
                    只看《{shelf.title}》书架中的书。
                    <a className="link-button" href={booksHref(year, null)} data-testid="clear-shelf-filter">
                        看全部书
                    </a>
                </p>
            )}

            {visible.length === 0 ? (
                <p className="room-note" data-testid="books-empty">
                    {year === null
                        ? '这里没有可展示的书。'
                        : `${String(year)} 年里没有收录任何划线。`}
                    {year === null ? null : (
                        <a className="link-button" href={booksHref(null, themeId)}>
                            清除筛选
                        </a>
                    )}
                </p>
            ) : (
                <ul className="book-list" data-testid="book-list">
                    {visible.map((entry) => (
                        <BookRow key={entry.book.id} entry={entry} />
                    ))}
                </ul>
            )}

            {more ? (
                <p className="batch-row">
                    <button
                        type="button"
                        className="link-button"
                        data-testid="books-more"
                        onClick={() => {
                            batches.expand(batchKey, books.length, BOOK_BATCH_STEP);
                        }}
                    >
                        再看 {String(Math.min(BOOK_BATCH_STEP, books.length - loaded))} 本
                    </button>
                    <span className="batch-label" data-testid="books-batch-label">
                        {batchLabel(loaded, books.length)}
                    </span>
                </p>
            ) : (
                <p className="batch-label" data-testid="books-batch-label">
                    {books.length === 0 ? '' : `已显示全部 ${String(books.length)} 本`}
                </p>
            )}
        </section>
    );
}

function BookRow({ entry }: { entry: BookEntry }) {
    return (
        <li className="book-item">
            <a className="book-link" href={bookHref(entry.book.id)} data-testid={`book-${entry.book.id}`}>
                <span className="book-cover" aria-hidden="true">
                    <CoverImage
                        title={entry.book.title}
                        coverPath={entry.book.coverPath}
                        className="book-cover-image"
                        alt=""
                        loading="lazy"
                        fallback={<span className="book-cover-fallback">{entry.book.title}</span>}
                    />
                </span>
                <span className="book-text">
                    <span className="book-title">《{entry.book.title}》</span>
                    <span className="book-meta">
                        <span className="book-author">{entry.book.author}</span>
                        <span className="book-count">{bookCountText(entry)}</span>
                    </span>
                </span>
            </a>
        </li>
    );
}
