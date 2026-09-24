/**
 * Rooms are real URLs (docs/12 §3).
 *
 * A deliberately small History-API router: canonical paths, query-based filters, popstate handling and
 * link interception. There is no dependency and no route state library — the shape of a room is decided
 * by the path, and everything a room remembers lives in the room reader, not in the URL parser.
 *
 * Parsing and formatting are pure functions so the six rooms, their filters and invalid ids are all
 * testable without a browser.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { roomLocation, sitePath } from './sitePath.ts';

export type BookFilters = {
    /** Only real years reach the UI; anything else is ignored rather than invented. */
    year: number | null;
    /** Books filed on one shelf, used by 主题房间 → 看看书架里的书. */
    themeId: string | null;
};

export type RoomRoute =
    /**
     * 门厅. `highlightId` is a deep link (`/?h=<stable highlight id>`): the URL names one real passage
     * instead of the opening draw. It belongs to the hall only — a shelf or a book room is a browsing
     * context, never the identity of a passage (docs/15 §4.1).
     */
    | { name: 'hall'; highlightId: string | null }
    | { name: 'themes' }
    | { name: 'theme'; themeId: string }
    | { name: 'paths' }
    | { name: 'path'; tagId: string }
    | { name: 'map'; tagId: string | null; bookId: string | null; highlightId: string | null }
    | ({ name: 'books' } & BookFilters)
    /**
     * 书籍房间. It names a book and nothing else: the room walks that book's passages in rounds, so a
     * filter from the library cannot narrow what the room shows (docs/17 §3.3).
     */
    | { name: 'book'; bookId: string }
    | { name: 'about' }
    | { name: 'design' }
    | { name: 'technical' }
    /** A path this build does not know; the page shows a quiet, escapable state. */
    | { name: 'unknown'; path: string };

function decodeSegment(segment: string): string {
    try {
        return decodeURIComponent(segment);
    } catch {
        // Malformed percent-encoding must not throw inside a parse function; treat it as-is.
        return segment;
    }
}

function readYear(params: URLSearchParams): number | null {
    const raw = params.get('year');
    if (raw === null || !/^\d{4}$/u.test(raw)) {
        return null;
    }
    const year = Number(raw);
    return Number.isFinite(year) ? year : null;
}

/**
 * The passage a hall URL points at.
 *
 * Validation happens against the snapshot, not here: this only refuses what cannot be an id at all, so
 * an unknown-but-well-formed id still reaches the page and gets the honest "unavailable" state.
 */
function readHighlightId(params: URLSearchParams): string | null {
    const raw = params.get('h');
    return raw === null || raw.length === 0 ? null : raw;
}

export function parseRoute(pathname: string, search = ''): RoomRoute {
    const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
    const segments = pathname.split('/').filter((part) => part.length > 0).map(decodeSegment);
    const [head, second] = segments;

    if (segments.length === 0) {
        return { name: 'hall', highlightId: readHighlightId(params) };
    }
    if (head === 'themes') {
        if (segments.length === 1) {
            return { name: 'themes' };
        }
        if (segments.length === 2 && second !== undefined) {
            return { name: 'theme', themeId: second };
        }
    }
    if (head === 'paths') {
        if (segments.length === 1) {
            return { name: 'paths' };
        }
        if (segments.length === 2 && second !== undefined) {
            return { name: 'path', tagId: second };
        }
    }
    if (head === 'map' && segments.length === 1) {
        return {
            name: 'map',
            tagId: params.get('tag'),
            bookId: params.get('book'),
            highlightId: readHighlightId(params),
        };
    }
    if (head === 'books') {
        if (segments.length === 1) {
            return { name: 'books', year: readYear(params), themeId: params.get('theme') };
        }
        if (segments.length === 2 && second !== undefined) {
            // A `?year=` left over from the library is not part of the book room: `routePath` drops it and
            // the page replaces the address, so a stale filtered link still lands on the book (docs/17 §3.3).
            return { name: 'book', bookId: second };
        }
    }
    if (head === 'about' && segments.length === 1) {
        return { name: 'about' };
    }
    if (head === 'design' && segments.length === 1) {
        return { name: 'design' };
    }
    if (head === 'design' && segments.length === 2 && second === 'technical') {
        return { name: 'technical' };
    }
    return { name: 'unknown', path: pathname };
}

/** Canonical URL of a room. Filters live in the query so a refresh restores the same room. */
export function routePath(route: RoomRoute): string {
    switch (route.name) {
        case 'hall':
            return route.highlightId === null ? '/' : `/?h=${encodeURIComponent(route.highlightId)}`;
        case 'themes':
            return '/themes';
        case 'theme':
            return `/themes/${encodeURIComponent(route.themeId)}`;
        case 'paths':
            return '/paths';
        case 'path':
            return `/paths/${encodeURIComponent(route.tagId)}`;
        case 'map': {
            const params = new URLSearchParams();
            if (route.tagId !== null) params.set('tag', route.tagId);
            if (route.bookId !== null) params.set('book', route.bookId);
            if (route.highlightId !== null) params.set('h', route.highlightId);
            const query = params.toString();
            return query.length === 0 ? '/map' : `/map?${query}`;
        }
        case 'about':
            return '/about';
        case 'design':
            return '/design';
        case 'technical':
            return '/design/technical';
        case 'books': {
            const params = new URLSearchParams();
            if (route.year !== null) {
                params.set('year', String(route.year));
            }
            if (route.themeId !== null) {
                params.set('theme', route.themeId);
            }
            const query = params.toString();
            return query.length === 0 ? '/books' : `/books?${query}`;
        }
        case 'book': {
            return `/books/${encodeURIComponent(route.bookId)}`;
        }
        case 'unknown':
            return route.path;
    }
}

/**
 * The room's own address, without content-level query.
 *
 * A deep-linked hall and a plain hall are the same room, so `/?h=…` must not become a second hall with
 * its own scroll position, its own stage session or its own aura entrance (docs/15 §6.1).
 */
export function roomPath(route: RoomRoute): string {
    if (route.name === 'hall') return '/';
    if (route.name === 'map') return '/map';
    return routePath(route);
}

/**
 * Stable memory key: two visits to the same filters are the same room.
 *
 * Which passage a deep link names is *not* part of the room, so the key stays `/` for every hall URL.
 */
export function routeKey(route: RoomRoute): string {
    return route.name === 'unknown' ? '/unknown' : roomPath(route);
}

/** The room a book room was opened from, so its return control can exist without inventing a target. */
export function bookRoomKey(bookId: string): string {
    return routeKey({ name: 'book', bookId });
}

type HistoryEntryState = { path?: string; previous?: string | null };

function currentPath(): string {
    if (typeof window === 'undefined') {
        return '/';
    }
    return `${roomLocation(window.location.pathname) ?? window.location.pathname}${window.location.search}`;
}

/** One place that splits a stored path into the pair `parseRoute` expects. */
function splitPath(path: string): RoomRoute {
    const [pathname = '/', search = ''] = path.split('?');
    return parseRoute(pathname, search);
}

export type RouterApi = {
    route: RoomRoute;
    path: string;
    /** `null` when this document was loaded straight into the room, so there is nothing to go back to. */
    previousPath: string | null;
    navigate: (path: string, options?: { replace?: boolean }) => void;
    /** Identical to the browser back button, so a visible return control cannot diverge from it. */
    goBack: () => void;
};

/**
 * Where the visitor was in each path.
 *
 * The router records this *before* it changes the URL, because a pushState navigation resets the scroll
 * position in Chromium: by the time the arriving room renders, the outgoing room's position is gone.
 */
const scrollPositions = new Map<string, number>();

/** Position the visitor left a path at, or undefined when that room has not been visited before. */
export function recalledScroll(path: string): number | undefined {
    return scrollPositions.get(path);
}

function rememberScroll(path: string): void {
    if (typeof window !== 'undefined') {
        scrollPositions.set(path, window.scrollY);
    }
}

export function useRouter(): RouterApi {
    const [state, setState] = useState<{ path: string; previous: string | null }>(() => {
        const entry = (typeof window === 'undefined' ? null : window.history.state) as HistoryEntryState | null;
        return { path: currentPath(), previous: entry?.previous ?? null };
    });
    /** The path of the entry currently on screen, readable from event handlers without re-subscribing. */
    const stateRef = useRef(state.path);

    // Parsed per path, not per render, so every dependent effect and room sees a stable room identity.
    const route = useMemo(() => splitPath(state.path), [state.path]);

    /**
     * One navigation path for links, redirects and explicit controls, so every way of changing the room
     * records the same "where did I come from" and can therefore be undone by the browser itself.
     */
    const go = useCallback((path: string, options: { replace?: boolean } = {}) => {
        if (typeof window === 'undefined') {
            return;
        }
        const from = currentPath();
        if (path === from) {
            return;
        }
        rememberScroll(from);
        const previous =
            options.replace === true
                ? ((window.history.state as HistoryEntryState | null)?.previous ?? null)
                : from;
        const entry: HistoryEntryState = { path, previous };
        if (options.replace === true) {
            window.history.replaceState(entry, '', sitePath(path));
        } else {
            window.history.pushState(entry, '', sitePath(path));
        }
        setState({ path, previous });
        stateRef.current = path;
    }, []);

    useEffect(() => {
        // The rooms keep their own scroll memory, so the browser must not apply its own on top of it.
        if ('scrollRestoration' in window.history) {
            window.history.scrollRestoration = 'manual';
        }
        const onPopState = (event: PopStateEvent) => {
            const entry = event.state as HistoryEntryState | null;
            // Going back leaves the room that is on screen right now.
            rememberScroll(stateRef.current);
            setState({ path: currentPath(), previous: entry?.previous ?? null });
        };
        const onClick = (event: MouseEvent) => {
            if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
                return;
            }
            const target = event.target;
            if (!(target instanceof Element)) {
                return;
            }
            const anchor = target.closest('a[href]');
            if (!(anchor instanceof HTMLAnchorElement) || anchor.target !== '' || anchor.hasAttribute('download')) {
                return;
            }
            const url = new URL(anchor.href, window.location.href);
            if (url.origin !== window.location.origin) {
                return;
            }
            const room = roomLocation(url.pathname);
            if (room === null) return;
            event.preventDefault();
            go(`${room}${url.search}`);
        };

        window.addEventListener('popstate', onPopState);
        document.addEventListener('click', onClick);
        return () => {
            window.removeEventListener('popstate', onPopState);
            document.removeEventListener('click', onClick);
        };
    }, [go]);

    // Keep the readable-but-not-subscribed path in step with what is rendered.
    useEffect(() => {
        stateRef.current = state.path;
    }, [state.path]);

    return {
        route,
        path: state.path,
        previousPath: state.previous,
        navigate: go,
        goBack: () => {
            window.history.back();
        },
    };
}
