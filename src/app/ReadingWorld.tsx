import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { indexSnapshot } from '../domain/snapshot.ts';
import type { Snapshot } from '../domain/types.ts';
import { INITIAL_BOOK_BATCH } from '../domain/reading.ts';
import { ALL_SCOPE, type StageScope } from '../domain/selection.ts';
import { useStageSessions } from '../features/encounter/useStageSessions.ts';
import { AboutRoom } from '../features/rooms/AboutRoom.tsx';
import { BookRoom } from '../features/rooms/BookRoom.tsx';
import { BooksRoom } from '../features/rooms/BooksRoom.tsx';
import { HallRoom } from '../features/rooms/HallRoom.tsx';
import { ThemeRoom } from '../features/rooms/ThemeRoom.tsx';
import { ThemesRoom } from '../features/rooms/ThemesRoom.tsx';
import { UnknownRoom } from '../features/rooms/UnknownRoom.tsx';
import { MapRoom } from '../features/map/MapRoom.tsx';
import { PathRoom } from '../features/paths/PathRoom.tsx';
import { PathsRoom } from '../features/paths/PathsRoom.tsx';
import { useBatches } from '../features/rooms/useBatches.ts';
import { useBookWalks } from '../features/rooms/useBookRoom.ts';
import { usePathWalks } from '../features/rooms/usePathRoom.ts';
import { useRoomMemory } from '../features/rooms/useRoomMemory.ts';
import { ShareDialog } from '../features/share/ShareDialog.tsx';
import { useShare } from '../features/share/useShare.ts';
import { Nav } from './Nav.tsx';
import { coverUrl, useCoverAccent } from './covers.ts';
import { roomPath, routeKey, routePath, type RouterApi } from './router.ts';
import { DATA_MODE } from './snapshotSource.ts';
import './page.css';
import '../features/rooms/rooms.css';
import '../features/paths/paths.css';
import '../features/map/map.css';

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
     * A room's address without content-level query (`/?h=…` is still the hall).
     *
     * Focus, the aura entrance and the scroll memory key off this rather than off `router.path`, because
     * a deep link only points at a different passage *inside* a room — it must not look like arriving.
     */
    const roomLocation = roomPath(route);

    /**
     * The passage the address names, when the address names one.
     *
     * Validity is decided against the real snapshot here, so the session is never seeded with an id the
     * page cannot show (docs/15 §6.1: an unknown id gets the honest unavailable state, not an empty room).
     */
    const linkedHighlightId = route.name === 'hall' ? route.highlightId : null;
    const knownLinkedHighlightId =
        linkedHighlightId !== null && index.highlightsById.has(linkedHighlightId) ? linkedHighlightId : null;
    const [unavailableLink, setUnavailableLink] = useState<string | null>(() =>
        linkedHighlightId !== null && knownLinkedHighlightId === null ? linkedHighlightId : null,
    );

    /**
     * The stage rooms keep one session each. A room with no stage (所有书, 关于, an unknown path) keeps
     * the hall's session untouched, so walking through the library never changes the sentence waiting in
     * the hall.
     */
    const scopeFor = useCallback((key: string): StageScope => {
        const prefix = '/themes/';
        return key.startsWith(prefix) ? { kind: 'theme', themeId: key.slice(prefix.length) } : ALL_SCOPE;
    }, []);
    const hallKey = routeKey({ name: 'hall', highlightId: null });
    const stageKey = route.name === 'theme' ? routeKey(route) : hallKey;

    /**
     * A hall session that is created while a deep link is in the address opens with that very passage, so
     * the first paint is never a random sentence that is replaced a moment later (docs/15 §6.1).
     */
    const seedFor = useCallback(
        (key: string): string | null => (key === hallKey ? knownLinkedHighlightId : null),
        [hallKey, knownLinkedHighlightId],
    );

    const stage = useStageSessions(stageKey, routeKey(route), {
        highlights: index.snapshot.highlights,
        books: index.snapshot.books,
        scopeFor,
        seedFor,
    });
    const { openDeepLink } = stage;

    const activeBookId = route.name === 'book' ? route.bookId : '';
    const bookWalks = useBookWalks(activeBookId, index);
    const activeTagId = route.name === 'path' ? route.tagId : '';
    const pathWalks = usePathWalks(activeTagId, index.snapshot.highlights);
    // A library screen and a book room are different collections; only the library still batches.
    const bookBatches = useBatches(INITIAL_BOOK_BATCH);

    /**
     * Sharing lives beside the rooms, not inside one: it holds a locked passage id and nothing else, so
     * opening a dialog cannot disturb a session, a batch or a return position (docs/15 §7.1).
     */
    const share = useShare();
    const sharedHighlight =
        share.state.highlightId === null ? undefined : index.highlightsById.get(share.state.highlightId);
    /**
     * The card's colour belongs to the passage that is locked, not to the room that happens to be behind it.
     *
     * The room's own `--aura` would be wrong here: the dialog can stay open while the stage moves on, and the
     * card would then be painted in the next book's colour while still holding the previous book's words
     * (docs/16 §5.1). Reading the accent from the locked passage's own book — through the same cover cache the
     * rooms use — keeps the words, the source and the colour describing one thing.
     */
    const sharedBook = sharedHighlight === undefined ? undefined : index.booksById.get(sharedHighlight.bookId);
    const sharedTags =
        sharedHighlight === undefined
            ? []
            : sharedHighlight.tagIds.map((tagId) => index.tagsById.get(tagId)).filter((tag) => tag !== undefined);
    const shareAccent = useCoverAccent(coverUrl(sharedBook?.coverPath));

    /**
     * Book Aura (docs/12 §4): the colour of the room comes from the cover of the book on screen.
     *
     * The hall and a shelf room follow the passage that is showing; a book room is the book itself;
     * a library, a shelf list and About stay on neutral paper and let real covers carry the colour.
     */
    const focusBookId = (() => {
        if (route.name === 'book') {
            return route.bookId;
        }
        if (route.name === 'hall' || route.name === 'theme') {
            return stage.state.currentId === null
                ? null
                : (index.highlightsById.get(stage.state.currentId)?.bookId ?? null);
        }
        if (route.name === 'path') {
            return pathWalks.state.currentId === null
                ? null
                : (index.highlightsById.get(pathWalks.state.currentId)?.bookId ?? null);
        }
        return null;
    })();
    const focusBook = focusBookId === null ? undefined : index.booksById.get(focusBookId);
    const aura = useCoverAccent(coverUrl(focusBook?.coverPath));
    const auraTarget =
        route.name === 'book'
            ? '0.1'
            : route.name === 'hall'
              ? '0.05'
              : route.name === 'theme' || route.name === 'path'
                ? '0.045'
                : '0';

    useRoomMemory(routeKey(route));

    /**
     * A room change moves focus to the new content without touching the scroll position that
     * `useRoomMemory` is restoring. A deep link inside the hall is not a room change, so it stays put.
     */
    useEffect(() => {
        mainRef.current?.focus({ preventScroll: true });
    }, [roomLocation]);

    /**
     * Follows the address when it names a passage.
     *
     * Each linked id is handled once: the seed covers the first paint, and this covers arriving at a link
     * without a full page load. An id the snapshot does not hold becomes a quiet note instead of a
     * pretend-success, while the room still shows a real fair opening (docs/15 §6.1).
     */
    const handledLink = useRef<string | null>(null);
    useEffect(() => {
        if (linkedHighlightId === null) {
            handledLink.current = null;
            setUnavailableLink(null);
            return;
        }
        if (handledLink.current === linkedHighlightId) {
            return;
        }
        handledLink.current = linkedHighlightId;
        if (knownLinkedHighlightId === null) {
            setUnavailableLink(linkedHighlightId);
            return;
        }
        setUnavailableLink(null);
        openDeepLink(knownLinkedHighlightId);
    }, [linkedHighlightId, knownLinkedHighlightId, openDeepLink]);

    /**
     * Once the visitor moves on, the address no longer describes what is on screen, so `?h=` is dropped
     * with a replace. Replacing instead of pushing keeps the back button meaning "leave this room"
     * rather than "show me the sentence from a moment ago" (docs/15 §4.1).
     */
    const previousCommitCount = useRef(stage.state.commitCount);
    useEffect(() => {
        const previous = previousCommitCount.current;
        previousCommitCount.current = stage.state.commitCount;
        if (stage.state.commitCount <= previous) {
            return;
        }
        if (route.name !== 'hall' || route.highlightId === null) {
            return;
        }
        handledLink.current = null;
        setUnavailableLink(null);
        router.navigate('/', { replace: true });
    }, [stage.state.commitCount, route, router]);

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
                return (
                    <HallRoom
                        index={index}
                        nowYear={nowYear}
                        session={stage}
                        onOpenBook={openBook}
                        onShare={share.open}
                        unavailableLink={unavailableLink !== null}
                    />
                );
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
                        onShare={share.open}
                    />
                );
            case 'paths':
                return <PathsRoom index={index} />;
            case 'path':
                return (
                    <PathRoom
                        index={index}
                        tagId={route.tagId}
                        nowYear={nowYear}
                        room={pathWalks}
                        onOpenBook={openBook}
                        onShare={share.open}
                    />
                );
            case 'map':
                return (
                    <MapRoom
                        index={index}
                        tagId={route.tagId}
                        bookId={route.bookId}
                        highlightId={route.highlightId}
                        onNavigate={router.navigate}
                        onShare={share.open}
                    />
                );
            case 'books':
                return <BooksRoom index={index} year={route.year} themeId={route.themeId} batches={bookBatches} />;
            case 'book':
                return (
                    <BookRoom
                        index={index}
                        bookId={route.bookId}
                        nowYear={nowYear}
                        room={bookWalks}
                        onBack={router.previousPath === null ? null : goBack}
                        onShare={share.open}
                    />
                );
            case 'about':
                return <AboutRoom index={index} />;
            case 'unknown':
                return <UnknownRoom path={route.path} />;
        }
    })();

    return (
        <div
            className={route.name === 'map' ? 'shell shell--night shell--dark-map' : 'shell shell--night'}
            style={{ '--aura': aura, '--aura-target': auraTarget } as CSSProperties}
            data-room-aura={route.name}
        >
            {/** Keyed per room so the room's air arrives once, on entry (docs/12 §5.3). */}
            <div className="room-aura" key={roomLocation} aria-hidden="true">
                <div className="room-aura-tint" data-testid="room-aura" />
            </div>

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

            {/** One dialog for the whole document, holding one locked passage (docs/15 §7.2). */}
            {sharedHighlight === undefined ? null : (
                <ShareDialog
                    highlight={sharedHighlight}
                    book={sharedBook}
                    tags={sharedTags}
                    accent={shareAccent}
                    localOnly={DATA_MODE === 'local'}
                    copyStatus={share.state.copyStatus}
                    onCopyResult={share.reportCopy}
                    onRequestClose={share.close}
                />
            )}
        </div>
    );
}
