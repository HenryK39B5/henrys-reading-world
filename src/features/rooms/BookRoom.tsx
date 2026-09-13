import { coverUrl } from '../../app/covers.ts';
import type { SnapshotIndex } from '../../domain/snapshot.ts';
import { PASSAGE_BATCH_STEP, batchLabel, hasMore, passagesOfBook } from '../../domain/reading.ts';
import { describeBookCollection, relativeYearLabel } from '../../domain/timeLabel.ts';
import { summarizeThemes, yearOptions } from '../../domain/world.ts';
import type { BatchStore } from './useBatches.ts';
import type { BookRoomController } from './useBookRoom.ts';

export type BookRoomProps = {
    index: SnapshotIndex;
    bookId: string;
    /** The year filter belongs to this book's own list only. */
    year: number | null;
    nowYear: number;
    batches: BatchStore;
    room: BookRoomController;
    /** Present only when the visitor arrived from another room in this session. */
    onBack: (() => void) | null;
};

function listHref(bookId: string, year: number | null): string {
    return year === null ? `/books/${bookId}` : `/books/${bookId}?year=${String(year)}`;
}

/**
 * 书籍房间: one book with its own colour, one random real passage, and its passages in batches
 * (docs/12 §2.5).
 *
 * The random passage and the list are this room's own state. Reading here never consumes the cycle of the
 * hall or a shelf, so returning to those rooms shows the sentence that was there.
 */
export function BookRoom({ index, bookId, year, nowYear, batches, room, onBack }: BookRoomProps) {
    const book = index.booksById.get(bookId);
    const passages = book === undefined ? [] : (index.highlightsByBook.get(bookId) ?? []);

    if (book === undefined || passages.length === 0) {
        return (
            <section className="room" aria-labelledby="book-heading" data-room="book">
                <h1 id="book-heading" className="room-heading" data-testid="room-heading">
                    书不在收录范围
                </h1>
                <p className="room-note" data-testid="book-missing">
                    这本书没有可展示的划线，或不在收录范围内。
                </p>
                <nav className="room-exits" aria-label="去别的房间">
                    <a className="room-exit" href="/books" data-testid="exit-books">
                        回到所有书
                    </a>
                    <a className="room-exit" href="/">
                        回到随便看看
                    </a>
                </nav>
            </section>
        );
    }

    const cover = coverUrl(book.coverPath);
    const current = room.state.currentId === null ? undefined : index.highlightsById.get(room.state.currentId);
    const shelves = summarizeThemes(index).filter((entry) => book.themeIds.includes(entry.theme.id));
    const filtered = passagesOfBook(index, bookId, year);
    const batchKey = `${bookId}|${year === null ? 'all' : String(year)}`;
    const loaded = batches.loadedFor(batchKey, filtered.length);
    const visible = filtered.slice(0, loaded);
    const more = hasMore(loaded, filtered.length);
    const years = yearOptions(index).filter((option) => passages.some((item) => item.year === option));
    const timeLabel = current === undefined ? null : relativeYearLabel(current.year, nowYear);

    return (
        <section className="room room-book" aria-labelledby="book-heading" data-room="book">
            <div className="book-head">
                <span className="book-head-cover" aria-hidden="true">
                    {cover === undefined ? (
                        <span className="book-cover-fallback">{book.title}</span>
                    ) : (
                        <img src={cover} alt="" decoding="async" />
                    )}
                </span>
                <div className="book-head-text">
                    <h1 id="book-heading" className="room-heading" data-testid="room-heading">
                        《{book.title}》
                    </h1>
                    <p className="book-head-meta">
                        <span className="book-author">{book.author}</span>
                        <span className="book-count" data-testid="book-count">
                            {describeBookCollection(passages.length)}
                        </span>
                    </p>
                    <p className="book-head-shelves">
                        {shelves.map((entry) => (
                            <a key={entry.theme.id} className="chip" href={`/themes/${entry.theme.id}`}>
                                {entry.theme.title}
                            </a>
                        ))}
                    </p>
                </div>
            </div>

            <div className="book-random" data-testid="book-random-area">
                {current === undefined ? (
                    <p className="room-note">这本书暂时没有可展示的划线。</p>
                ) : (
                    <blockquote className="book-random-passage">
                        <p className="book-random-text" data-testid="book-random-text">
                            {current.text}
                        </p>
                        {timeLabel === null ? null : <p className="book-random-time">{timeLabel}</p>}
                    </blockquote>
                )}
                <p className="book-random-actions">
                    <button
                        type="button"
                        className="next-button"
                        data-testid="book-random"
                        disabled={passages.length <= 1}
                        onClick={room.random}
                    >
                        随机看一处
                    </button>
                    {passages.length <= 1 ? (
                        <span className="room-note" data-testid="book-random-note">
                            这本书目前只收录了一处划线。
                        </span>
                    ) : null}
                </p>
            </div>

            <section className="book-list-section" aria-labelledby="book-list-heading">
                <h2 id="book-list-heading" className="section-heading">
                    这本书的划线
                </h2>
                <div className="filter-row">
                    <span className="filter-label">年份</span>
                    <a
                        className="chip"
                        href={listHref(bookId, null)}
                        data-testid="book-year-all"
                        aria-current={year === null ? 'true' : undefined}
                    >
                        全部
                    </a>
                    {years.map((option) => (
                        <a
                            key={option}
                            className="chip"
                            href={listHref(bookId, option)}
                            data-testid={`book-year-${String(option)}`}
                            aria-current={year === option ? 'true' : undefined}
                        >
                            {option}
                        </a>
                    ))}
                </div>

                {visible.length === 0 ? (
                    <p className="room-note" data-testid="book-list-empty">
                        这本书在 {String(year)} 年没有收录划线。
                        <a className="link-button" href={listHref(bookId, null)}>
                            显示全部
                        </a>
                    </p>
                ) : (
                    <ul className="passage-list" data-testid="book-passages">
                        {visible.map((item) => (
                            <li key={item.id} className="passage-item" data-testid={`book-passage-${item.id}`}>
                                <p className="passage-text">{item.text}</p>
                            </li>
                        ))}
                    </ul>
                )}

                {more ? (
                    <p className="batch-row">
                        <button
                            type="button"
                            className="link-button"
                            data-testid="book-more"
                            onClick={() => {
                                batches.expand(batchKey, filtered.length, PASSAGE_BATCH_STEP);
                            }}
                        >
                            再看 {String(Math.min(PASSAGE_BATCH_STEP, filtered.length - loaded))} 处
                        </button>
                        <span className="batch-label" data-testid="book-batch-label">
                            {batchLabel(loaded, filtered.length)}
                        </span>
                    </p>
                ) : (
                    <p className="batch-label" data-testid="book-batch-label">
                        {filtered.length === 0 ? '' : `已显示全部 ${String(filtered.length)} 处`}
                    </p>
                )}
            </section>

            <nav className="room-exits" aria-label="去别的房间">
                {onBack === null ? null : (
                    <button type="button" className="room-exit" data-testid="room-back" onClick={onBack}>
                        返回上一处
                    </button>
                )}
                <a className="room-exit" href="/books" data-testid="exit-books">
                    所有书
                </a>
                <a className="room-exit" href="/" data-testid="exit-hall">
                    随便看看
                </a>
            </nav>
        </section>
    );
}
