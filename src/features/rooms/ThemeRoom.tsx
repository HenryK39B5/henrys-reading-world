import type { SnapshotIndex } from '../../domain/snapshot.ts';
import { summarizeThemes } from '../../domain/world.ts';
import { StageRoom } from './StageRoom.tsx';
import type { StageSessionController } from '../encounter/useStageSessions.ts';

export type ThemeRoomProps = {
    index: SnapshotIndex;
    themeId: string;
    nowYear: number;
    session: StageSessionController;
    onOpenBook: (bookId: string) => void;
    onShare: (highlightId: string) => void;
};

/**
 * 主题房间: the quiet reading room of one shelf (docs/12 §2.3).
 *
 * `再来一句` stays in the shelf, and every sentence is described as coming from a book filed on this
 * shelf — never as a sentence that is "about" the topic.
 */
export function ThemeRoom({ index, themeId, nowYear, session, onOpenBook, onShare }: ThemeRoomProps) {
    const entry = summarizeThemes(index).find((item) => item.theme.id === themeId);

    if (entry === undefined) {
        return (
            <section className="room" aria-labelledby="theme-heading" data-room="theme">
                <h1 id="theme-heading" className="room-heading" data-testid="room-heading">
                    书架不存在
                </h1>
                <p className="room-note" data-testid="theme-missing">
                    这个主题书架不在收录范围内。
                </p>
                <nav className="room-exits" aria-label="去别的房间">
                    <a className="room-exit" href="/themes" data-testid="exit-themes">
                        回到主题书架
                    </a>
                    <a className="room-exit" href="/">
                        回到随便看看
                    </a>
                </nav>
            </section>
        );
    }

    return (
        <section className="room" aria-labelledby="theme-heading" data-room="theme">
            <h1 id="theme-heading" className="room-heading" data-testid="room-heading">
                正在逛：{entry.theme.title}
            </h1>
            <p className="room-note" data-testid="theme-note">
                {entry.highlightCount} 处划线来自这个书架中的 {entry.bookCount} 本书；句子本身没有被贴过主题标签。
            </p>

            <StageRoom
                index={index}
                nowYear={nowYear}
                session={session}
                emptyNote="这个书架目前没有可展示的划线。"
                onOpenBook={onOpenBook}
                onShare={onShare}
            />

            <nav className="room-exits" aria-label="主题房间的出口">
                <a className="room-exit" href={`/books?theme=${encodeURIComponent(themeId)}`} data-testid="exit-shelf-books">
                    看看书架里的书
                </a>
                <a className="room-exit" href="/themes" data-testid="exit-themes">
                    换个主题
                </a>
                <a className="room-exit" href="/" data-testid="exit-hall">
                    回到随便看看
                </a>
            </nav>
        </section>
    );
}
