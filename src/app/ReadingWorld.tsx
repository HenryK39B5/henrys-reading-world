import { useCallback, useEffect, useMemo, useRef } from 'react';
import { indexSnapshot } from '../domain/snapshot.ts';
import type { Snapshot } from '../domain/types.ts';
import { INITIAL_BOOK_BATCH, INITIAL_PASSAGE_BATCH } from '../domain/reading.ts';
import { ALL_SCOPE, type StageScope } from '../domain/selection.ts';
import { useStageSessions } from '../features/encounter/useStageSessions.ts';
import { AboutRoom } from '../features/rooms/AboutRoom.tsx';
import { BookRoom } from '../features/rooms/BookRoom.tsx';
import { BooksRoom } from '../features/rooms/BooksRoom.tsx';
import { HallRoom } from '../features/rooms/HallRoom.tsx';
import { ThemeRoom } from '../features/rooms/ThemeRoom.tsx';
import { ThemesRoom } from '../features/rooms/ThemesRoom.tsx';
import { UnknownRoom } from '../features/rooms/UnknownRoom.tsx';
import { useBatches } from '../features/rooms/useBatches.ts';
import { useBookRooms } from '../features/rooms/useBookRoom.ts';
import { useRoomMemory } from '../features/rooms/useRoomMemory.ts';
import { Nav } from './Nav.tsx';
import { routeKey, routePath, type RouterApi } from './router.ts';
import { DATA_MODE } from './snapshotSource.ts';
import './page.css';
import '../features/rooms/rooms.css';

export type ReadingWorldProps = {
    snapshot: Snapshot;
    warnings: string[];
    /** The single router instance of the document; a second one would fight over the same click. */
    router: RouterApi;
};

/**
 * The reading world: six rooms behind real URLs (docs/12 §2–3).
 *
 * The shell owns the things that outlive a room — the loaded snapshot, the per-room passage sessions, the
 * remembered batches and scroll positions — while each room decides only what it shows.
 */
export function ReadingWorld({ snapshot, warnings, router }: ReadingWorldProps) {
    const index = useMemo(() => indexSnapshot(snapshot), [snapshot]);
    const nowYear = useMemo(() => new Date().getFullYear(), []);
    const { route } = router;
    const mainRef = useRef<HTMLElement>(null);

    /**
     * The stage rooms keep one session each. A room with no stage (所有书, 关于, an unknown path) keeps
     * the hall's session untouched, so walking through the library never changes the sentence waiting in
     * the hall.
     */
    const scopeFor = useCallback((key: string): StageScope => {
        const prefix = '/themes/';
        return key.startsWith(prefix) ? { kind: 'theme', themeId: key.slice(prefix.length) } : ALL_SCOPE;
    }, []);
    const stageKey = route.name === 'theme' ? routeKey(route) : routeKey({ name: 'hall' });
    const stage = useStageSessions(stageKey, routeKey(route), {
        highlights: index.snapshot.highlights,
        books: index.snapshot.books,
        scopeFor,
    });

    const activeBookId = route.name === 'book' ? route.bookId : '';
    const bookRooms = useBookRooms(activeBookId, index.snapshot.books, index.snapshot.highlights);
    // Two stores: a library screen and a passage list are different collections with different first
    // batches, and neither should inherit the other's "show more" position.
    const bookBatches = useBatches(INITIAL_BOOK_BATCH);
    const passageBatches = useBatches(INITIAL_PASSAGE_BATCH);

    useRoomMemory(routeKey(route));

    /**
     * A room change moves focus to the new content without touching the scroll position that
     * `useRoomMemory` is restoring.
     */
    useEffect(() => {
        mainRef.current?.focus({ preventScroll: true });
    }, [router.path]);

    /** Unknown-but-parseable URLs are normalised, so the address bar always describes the room. */
    useEffect(() => {
        const canonical = routePath(route);
        if (canonical !== router.path) {
            router.navigate(canonical, { replace: true });
        }
    }, [route, router]);

    const openBook = useCallback(
        (bookId: string) => {
            router.navigate(`/books/${encodeURIComponent(bookId)}`);
        },
        [router],
    );

    const goBack = useCallback(() => {
        router.goBack();
    }, [router]);

    const room = (() => {
        switch (route.name) {
            case 'hall':
                return <HallRoom index={index} nowYear={nowYear} session={stage} onOpenBook={openBook} />;
            case 'themes':
                return <ThemesRoom index={index} />;
            case 'theme':
                return (
                    <ThemeRoom
                        index={index}
                        themeId={route.themeId}
                        nowYear={nowYear}
                        session={stage}
                        onOpenBook={openBook}
                    />
                );
            case 'books':
                return <BooksRoom index={index} year={route.year} themeId={route.themeId} batches={bookBatches} />;
            case 'book':
                return (
                    <BookRoom
                        index={index}
                        bookId={route.bookId}
                        year={route.year}
                        nowYear={nowYear}
                        batches={passageBatches}
                        room={bookRooms}
                        onBack={router.previousPath === null ? null : goBack}
                    />
                );
            case 'about':
                return <AboutRoom index={index} />;
            case 'unknown':
                return <UnknownRoom path={route.path} />;
        }
    })();

    return (
        <div className="shell">
            <header className="site-header">
                <a className="brand" href="/">
                    Henry's Reading World
                </a>
                <Nav route={route} />
            </header>

            {DATA_MODE === 'local' ? <p className="local-badge">仅本机 · 未公开审核</p> : null}

            <main id="room" className="room-region" ref={mainRef} tabIndex={-1}>
                {room}
            </main>

            {DATA_MODE === 'local' && warnings.length > 0 ? (
                <details className="coverage-notes">
                    <summary>数据覆盖提示（{warnings.length}）</summary>
                    <ul className="detail-list">
                        {warnings.map((warning) => (
                            <li key={warning}>{warning}</li>
                        ))}
                    </ul>
                </details>
            ) : null}
        </div>
    );
}
