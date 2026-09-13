import { coverUrl } from '../../app/covers.ts';
import type { SnapshotIndex } from '../../domain/snapshot.ts';
import { summarizeThemes, themeCountText } from '../../domain/world.ts';
import type { Highlight } from '../../domain/types.ts';

export type ThemesRoomProps = {
    index: SnapshotIndex;
};

const COVER_STRIP = 4;

function ShelfCovers({ index, leads }: { index: SnapshotIndex; leads: Highlight[] }) {
    // One cover per book: a shelf that holds two short books must not look like a four-book shelf.
    const books: string[] = [];
    for (const highlight of leads) {
        if (!books.includes(highlight.bookId)) {
            books.push(highlight.bookId);
        }
        if (books.length === COVER_STRIP) {
            break;
        }
    }

    return (
        <span className="shelf-covers" aria-hidden="true">
            {books.map((bookId) => {
                const book = index.booksById.get(bookId);
                const url = coverUrl(book?.coverPath);
                return (
                    <span key={bookId} className="shelf-cover">
                        {url === undefined ? (
                            <span className="shelf-cover-fallback">{book?.title ?? ''}</span>
                        ) : (
                            <img src={url} alt="" loading="lazy" decoding="async" />
                        )}
                    </span>
                );
            })}
        </span>
    );
}

/**
 * 主题书架: the shelves themselves, with real counts and a few real covers each (docs/12 §2.2).
 *
 * Opening a shelf is a room of its own, so no shelf expands a wall of sentences here. A shelf wears the
 * colour of the covers it leads with — never a colour assigned to the topic.
 */
export function ThemesRoom({ index }: ThemesRoomProps) {
    const themes = summarizeThemes(index);

    if (themes.length === 0) {
        return (
            <section className="room" aria-labelledby="themes-heading" data-room="themes">
                <h1 id="themes-heading" className="room-heading" data-testid="room-heading">
                    主题书架
                </h1>
                <p className="room-note" data-testid="room-empty">
                    这里还没有可展示的真实划线，因此还没有书架。
                </p>
            </section>
        );
    }

    return (
        <section className="room" aria-labelledby="themes-heading" data-room="themes">
            <h1 id="themes-heading" className="room-heading" data-testid="room-heading">
                主题书架
            </h1>
            <p className="room-note">
                主题按书籍归档：书架里放的是书，不是给句子贴的标签。颜色来自这些书真实的封面。
            </p>

            <ul className="shelf-list" data-testid="theme-list">
                {themes.map((entry) => (
                    <li key={entry.theme.id} className="shelf-item">
                        <a
                            className="shelf-link"
                            href={`/themes/${entry.theme.id}`}
                            data-testid={`theme-${entry.theme.id}`}
                        >
                            <ShelfCovers index={index} leads={entry.leads} />
                            <span className="shelf-text">
                                <span className="shelf-title">{entry.theme.title}</span>
                                <span className="shelf-count">{themeCountText(entry)}</span>
                            </span>
                        </a>
                        {entry.theme.description === undefined ? null : (
                            <p className="shelf-description">{entry.theme.description}</p>
                        )}
                    </li>
                ))}
            </ul>
        </section>
    );
}
