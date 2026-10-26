import { useEffect, useMemo, useRef } from 'react';
import type { EncounterState } from '../../domain/encounter.ts';
import type { Highlight, Snapshot } from '../../domain/types.ts';
import type { SnapshotIndex } from '../../domain/snapshot.ts';
import { selectNext } from '../../domain/discovery.ts';
import { ALL_SCOPE, type Selector } from '../../domain/selection.ts';
import { useStageSessions } from '../encounter/useStageSessions.ts';
import { StageRoom } from '../rooms/StageRoom.tsx';

const memories = new WeakMap<Snapshot, Map<string, EncounterState>>();

/** Reuse the existing fair draw, native original, source, and next-in-book actions. */
export function SinglePassage({ index, pool, scopeKey, selectedId, active, onCurrent, onShare, onOpenBook }: {
    index: SnapshotIndex; pool: Highlight[]; scopeKey: string; selectedId: string | null; active: boolean;
    onCurrent: (id: string) => void; onShare: (id: string) => void; onOpenBook: (id: string) => void;
}) {
    const selector = useMemo<Selector>(() => input => selectNext({
        ...input, highlights: input.scope.kind === 'book' ? index.snapshot.highlights : pool,
    }), [index, pool]);
    const sessionStore = useMemo(() => {
        const saved = memories.get(index.snapshot) ?? new Map<string, EncounterState>();
        memories.set(index.snapshot, saved);
        return saved;
    }, [index]);
    const session = useStageSessions(scopeKey, active ? 'single' : 'water', {
        sessionStore,
        highlights: index.snapshot.highlights, books: index.snapshot.books,
        scopeFor: () => ALL_SCOPE, seedFor: () => selectedId, selector,
    });
    const handled = useRef(selectedId);
    useEffect(() => {
        if (!active) return;
        if (handled.current !== selectedId) {
            handled.current = selectedId;
            if (selectedId !== null && session.state.currentId !== selectedId) {
                session.openDeepLink(selectedId);
                return;
            }
        }
        if (!session.busy && session.state.currentId !== null && session.state.currentId !== selectedId) {
            onCurrent(session.state.currentId);
        }
    }, [active, selectedId, session, onCurrent]);
    return <div className="browse-single" hidden={!active} data-testid="browse-single">
        <StageRoom index={index} nowYear={new Date().getFullYear()} session={session}
            emptyNote="这个范围暂时没有可展示的划线，可以返回全部文字。"
            onOpenBook={onOpenBook} onShare={onShare} />
    </div>;
}
