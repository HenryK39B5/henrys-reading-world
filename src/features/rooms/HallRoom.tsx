import type { SnapshotIndex } from '../../domain/snapshot.ts';
import { StageRoom } from './StageRoom.tsx';
import type { StageSessionController } from '../encounter/useStageSessions.ts';

export type HallRoomProps = {
    index: SnapshotIndex;
    nowYear: number;
    session: StageSessionController;
    onOpenBook: (bookId: string) => void;
    onShare: (highlightId: string) => void;
    /** The address named a passage this snapshot does not hold (docs/15 §6.1). */
    unavailableLink: boolean;
};

/**
 * 门厅: one sentence, its source, `再来一句`, and quiet ways out (docs/12 §2.1).
 *
 * The library lives in its own rooms; nothing below the sentence repeats the shelves here.
 */
export function HallRoom({ index, nowYear, session, onOpenBook, onShare, unavailableLink }: HallRoomProps) {
    return (
        <section className="room room-hall" aria-labelledby="hall-heading" data-room="hall">
            <h1 id="hall-heading" className="room-heading" data-testid="room-heading">
                随便看看
            </h1>

            {unavailableLink ? (
                <p className="room-note link-unavailable" data-testid="link-unavailable">
                    这条划线暂不可用
                </p>
            ) : null}

            <StageRoom
                index={index}
                nowYear={nowYear}
                session={session}
                emptyNote="目前没有可展示的划线。"
                onOpenBook={onOpenBook}
                onShare={onShare}
            />

            <nav className="room-exits" aria-label="去别的房间">
                <a className="room-exit" href="/themes" data-testid="exit-themes">
                    逛主题书架
                </a>
                <a className="room-exit" href="/books" data-testid="exit-books">
                    看看所有书
                </a>
                <a className="room-exit" href="/about" data-testid="exit-about">
                    关于
                </a>
            </nav>
        </section>
    );
}
