import { CoverImage } from '../../app/CoverImage.tsx';
import { sitePath } from '../../app/sitePath.ts';
import { walkProgress } from '../../domain/bookWalk.ts';
import { passagesOfBook } from '../../domain/reading.ts';
import type { SnapshotIndex } from '../../domain/snapshot.ts';
import { describeBookCollection, relativeYearLabel } from '../../domain/timeLabel.ts';
import { summarizeThemes } from '../../domain/world.ts';
import { TopicClues } from '../paths/TopicClues.tsx';
import type { BookRoomController } from './useBookRoom.ts';

export type BookRoomProps = {
    index: SnapshotIndex;
    bookId: string;
    nowYear: number;
    room: BookRoomController;
    /** Present only when the visitor arrived from another room in this session. */
    onBack: (() => void) | null;
    /** Shares the passage at the top of the room, which is the room's only visual centre. */
    onShare: (highlightId: string) => void;
};

/**
 * 书籍房间: one book, its own colour, and one real passage at a time (docs/17 §3).
 *
 * The room used to unfold the whole book in batches. It now walks it: every available passage appears
 * once in a round, the round reports how far it has come, and when it is over the room says so and waits
 * for the visitor to start again. The full list only exists in the local publication reviewer, which is
 * a tool rather than a room (docs/17 §5).
 */
export function BookRoom({ index, bookId, nowYear, room, onBack, onShare }: BookRoomProps) {
    const book = index.booksById.get(bookId);
    const passages = book === undefined ? [] : passagesOfBook(index, bookId);

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
                    <a className="room-exit" href={sitePath('/books')} data-testid="exit-books">
                        回到所有书
                    </a>
                    <a className="room-exit" href={sitePath('/')}>
                        回到随便看看
                    </a>
                </nav>
            </section>
        );
    }

    const current = room.state.currentId === null ? undefined : index.highlightsById.get(room.state.currentId);
    const shelves = summarizeThemes(index).filter((entry) => book.themeIds.includes(entry.theme.id));
    const progress = walkProgress(room.state, passages);
    const timeLabel = current === undefined ? null : relativeYearLabel(current.year, nowYear);
    const tags =
        current === undefined
            ? []
            : current.tagIds.map((tagId) => index.tagsById.get(tagId)).filter((tag) => tag !== undefined);
    const single = passages.length <= 1;
    const longTitle = [...book.title].length > 24;

    return (
        <section className="room room-book" aria-labelledby="book-heading" data-room="book">
            <div className={longTitle ? 'book-head book-head--long-title' : 'book-head'}>
                <span className="book-head-cover" aria-hidden="true">
                    <CoverImage
                        title={book.title}
                        coverPath={book.coverPath}
                        className="book-head-cover-image"
                        alt=""
                        fallback={<span className="book-cover-fallback">无封面</span>}
                    />
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
                            <a key={entry.theme.id} className="chip" href={sitePath(`/themes/${entry.theme.id}`)}>
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

                <TopicClues tags={tags} />

                <p className="book-walk-progress" data-testid="book-walk-progress" role="status">
                    本轮已看 {progress.seen} / {progress.total}
                </p>

                <p className="book-random-actions">
                    {single ? null : progress.complete ? (
                        <button type="button" className="next-button" data-testid="book-restart" onClick={room.restart}>
                            重新看一轮
                        </button>
                    ) : (
                        <button type="button" className="next-button" data-testid="book-random" onClick={room.next}>
                            再看一处
                        </button>
                    )}
                    {current === undefined ? null : (
                        <button
                            type="button"
                            className="share-trigger"
                            data-testid="book-share-open"
                            data-share-trigger="book"
                            onClick={() => {
                                onShare(current.id);
                            }}
                        >
                            分享
                        </button>
                    )}
                    {single ? (
                        <span className="room-note" data-testid="book-random-note">
                            这本书目前只收录了一处划线。
                        </span>
                    ) : null}
                </p>

                {single || !progress.complete ? null : (
                    <p className="book-walk-complete room-note" data-testid="book-walk-complete">
                        这本书收录的 {progress.total} 处划线已经看过一遍了
                    </p>
                )}
            </div>

            <nav className="room-exits" aria-label="去别的房间">
                {onBack === null ? null : (
                    <button type="button" className="room-exit" data-testid="room-back" onClick={onBack}>
                        返回上一处
                    </button>
                )}
                <a className="room-exit" href={sitePath(`/map?book=${encodeURIComponent(book.id)}`)} data-testid="book-map-link">
                    在地图中点亮这本书
                </a>
                <a className="room-exit" href={sitePath('/books')} data-testid="exit-books">
                    所有书
                </a>
                <a className="room-exit" href={sitePath('/')} data-testid="exit-hall">
                    随便看看
                </a>
            </nav>
        </section>
    );
}
