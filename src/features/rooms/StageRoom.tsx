import { describeDeadEnd, unseenInBookCount } from '../../domain/encounter.ts';
import type { SnapshotIndex } from '../../domain/snapshot.ts';
import { EncounterStage } from '../encounter/EncounterStage.tsx';
import type { StageSessionController } from '../encounter/useStageSessions.ts';

export type StageRoomProps = {
    index: SnapshotIndex;
    nowYear: number;
    session: StageSessionController;
    /** Shown instead of the stage when the room has nothing to draw from. */
    emptyNote: string;
    onOpenBook: (bookId: string) => void;
    /** Only the passage on screen can be shared, never a row of a list (docs/15 §4.2). */
    onShare: (highlightId: string) => void;
};

/**
 * One passage room: the hall and every shelf room are the same reading surface, only their range and
 * their label differ. The passage on screen always belongs to a real snapshot record of that room.
 */
export function StageRoom({ index, nowYear, session, emptyNote, onOpenBook, onShare }: StageRoomProps) {
    const current = session.state.currentId === null ? undefined : index.highlightsById.get(session.state.currentId);
    const book = current === undefined ? undefined : index.booksById.get(current.bookId);

    if (current === undefined || book === undefined) {
        return (
            <p className="room-note" data-testid="room-empty">
                {emptyNote}
            </p>
        );
    }

    return (
        <EncounterStage
            highlight={current}
            book={book}
            phase={session.state.phase}
            busy={session.busy}
            nowYear={nowYear}
            commitCount={session.state.commitCount}
            sourceOpen={session.state.sourceOpen}
            bookHighlightCount={index.highlightsByBook.get(book.id)?.length ?? 0}
            bookUnseenCount={unseenInBookCount(session.state, index.snapshot.highlights)}
            deadEnd={describeDeadEnd(session.state)}
            onNext={session.next}
            onNextInBook={session.nextInBook}
            onOpenSource={session.openSource}
            onCloseSource={session.closeSource}
            onOpenBook={onOpenBook}
            onShare={onShare}
        />
    );
}
