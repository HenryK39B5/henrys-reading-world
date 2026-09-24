import { describe, expect, it } from 'vitest';
import { parseRoute, roomPath, routeKey, routePath, bookRoomKey } from './router.ts';

/**
 * Router properties (docs/12 §3).
 *
 * The six rooms, their filters and invalid paths are parsed by a pure function, so what a URL means can
 * be checked without a browser — and the canonical path can always be rebuilt from the parsed route.
 */
describe('routes are parsed from real paths', () => {
    it('maps each room to its own route', () => {
        expect(parseRoute('/')).toEqual({ name: 'hall', highlightId: null });
        expect(parseRoute('/themes')).toEqual({ name: 'themes' });
        expect(parseRoute('/themes/t-001')).toEqual({ name: 'theme', themeId: 't-001' });
        expect(parseRoute('/paths')).toEqual({ name: 'paths' });
        expect(parseRoute('/paths/tag-001')).toEqual({ name: 'path', tagId: 'tag-001' });
        expect(parseRoute('/map')).toEqual({ name: 'map', tagId: null, bookId: null, highlightId: null });
        expect(parseRoute('/map', '?tag=tag-001&book=b-013&h=h-002')).toEqual({
            name: 'map', tagId: 'tag-001', bookId: 'b-013', highlightId: 'h-002',
        });
        expect(parseRoute('/books')).toEqual({ name: 'books', year: null, themeId: null });
        expect(parseRoute('/books/b-013')).toEqual({ name: 'book', bookId: 'b-013' });
        expect(parseRoute('/about')).toEqual({ name: 'about' });
        expect(parseRoute('/design')).toEqual({ name: 'design' });
    });

    it('keeps real filters and drops impossible ones', () => {
        expect(parseRoute('/books', '?year=2025')).toEqual({ name: 'books', year: 2025, themeId: null });
        expect(parseRoute('/books', '?theme=t-002')).toEqual({ name: 'books', year: null, themeId: 't-002' });
        expect(parseRoute('/books', '?year=2025&theme=t-002')).toEqual({ name: 'books', year: 2025, themeId: 't-002' });
        // A book room names a book and nothing else: the library's year filter stays in the library
        // (docs/17 §3.3). The stale parameter is not carried into the room's identity.
        expect(parseRoute('/books/b-001', '?year=2024')).toEqual({ name: 'book', bookId: 'b-001' });
        // A year that is not a year, or is out of any plausible range of digits, is not invented.
        expect(parseRoute('/books', '?year=2025-01')).toEqual({ name: 'books', year: null, themeId: null });
        expect(parseRoute('/books', '?year=abc')).toEqual({ name: 'books', year: null, themeId: null });
    });

    it('reports an unknown path instead of inventing a room', () => {
        expect(parseRoute('/nope')).toEqual({ name: 'unknown', path: '/nope' });
        expect(parseRoute('/themes/t-001/extra')).toEqual({ name: 'unknown', path: '/themes/t-001/extra' });
        expect(parseRoute('/paths/tag-001/extra')).toEqual({ name: 'unknown', path: '/paths/tag-001/extra' });
        expect(parseRoute('/books/b-001/2024')).toEqual({ name: 'unknown', path: '/books/b-001/2024' });
    });

    it('survives malformed encoding without throwing', () => {
        expect(parseRoute('/themes/%E0%A4%A')).toEqual({ name: 'theme', themeId: '%E0%A4%A' });
    });

    it('ignores a trailing slash but keeps the room', () => {
        expect(parseRoute('/themes/')).toEqual({ name: 'themes' });
        expect(parseRoute('/paths/')).toEqual({ name: 'paths' });
        expect(parseRoute('/books/')).toEqual({ name: 'books', year: null, themeId: null });
    });
});

describe('routes are rebuilt as canonical URLs', () => {
    it('round-trips every room', () => {
        for (const path of [
            '/',
            '/?h=h-001',
            '/themes',
            '/themes/t-001',
            '/paths',
            '/paths/tag-001',
            '/map',
            '/map?tag=tag-001&book=b-013&h=h-002',
            '/books',
            '/books/b-013',
            '/about',
            '/design',
        ]) {
            const [pathname = '/', search = ''] = path.split('?');
            expect(routePath(parseRoute(pathname, search))).toBe(path);
        }
    });

    it('normalises a filtered book link left over from the library', () => {
        // The room is the same room, so the canonical address drops the filter instead of keeping it
        // (docs/17 §3.3). The page replaces the address; 返回上一处 still restores the filtered library.
        expect(routePath(parseRoute('/books/b-013', '?year=2025'))).toBe('/books/b-013');
        expect(routeKey(parseRoute('/books/b-013', '?year=2025'))).toBe('/books/b-013');
    });

    it('writes filters in a stable order', () => {
        expect(routePath({ name: 'books', year: 2025, themeId: 't-001' })).toBe('/books?year=2025&theme=t-001');
        expect(routePath({ name: 'books', year: null, themeId: 't-001' })).toBe('/books?theme=t-001');
        expect(routePath({ name: 'books', year: 2025, themeId: null })).toBe('/books?year=2025');
        expect(routePath({ name: 'map', tagId: 'tag-001', bookId: 'b-001', highlightId: 'h-001' }))
            .toBe('/map?tag=tag-001&book=b-001&h=h-001');
    });

    it('encodes ids that need it and keeps them stable as memory keys', () => {
        const route = parseRoute('/themes/%E4%B8%AD%E6%96%87');
        expect(route).toEqual({ name: 'theme', themeId: '中文' });
        expect(routePath(route)).toBe('/themes/%E4%B8%AD%E6%96%87');
        expect(routeKey(route)).toBe('/themes/%E4%B8%AD%E6%96%87');
        expect(bookRoomKey('b-001')).toBe('/books/b-001');
    });

    it('gives the six rooms distinct memory keys', () => {
        const keys = [
            routeKey({ name: 'hall', highlightId: null }),
            routeKey({ name: 'themes' }),
            routeKey({ name: 'theme', themeId: 't-001' }),
            routeKey({ name: 'paths' }),
            routeKey({ name: 'path', tagId: 'tag-001' }),
            routeKey({ name: 'map', tagId: null, bookId: null, highlightId: null }),
            routeKey({ name: 'books', year: null, themeId: null }),
            routeKey({ name: 'books', year: 2025, themeId: null }),
            routeKey({ name: 'book', bookId: 'b-001' }),
            routeKey({ name: 'about' }),
            routeKey({ name: 'design' }),
        ];
        expect(new Set(keys).size).toBe(keys.length);
        expect(roomPath({ name: 'map', tagId: 'tag-001', bookId: null, highlightId: 'h-001' })).toBe('/map');
    });
});

/**
 * Deep links (`/?h=<stable id>`, docs/15 §4.1).
 *
 * The passage belongs to the hall and to nothing else: a shelf or a book room is a place the visitor is
 * browsing, not the identity of a sentence. And because the hall is the same room whether or not it
 * names a passage, the deep link must not leak into the room's memory keys.
 */
describe('a deep link names a passage inside the hall', () => {
    it('parses a real highlight id on the hall and nowhere else', () => {
        expect(parseRoute('/', '?h=h-001')).toEqual({ name: 'hall', highlightId: 'h-001' });
        expect(parseRoute('/', '?h=h-001&year=2025')).toEqual({ name: 'hall', highlightId: 'h-001' });
        // The room keeps its own meaning and simply does not carry the passage.
        expect(parseRoute('/themes/t-001', '?h=h-001')).toEqual({ name: 'theme', themeId: 't-001' });
        expect(parseRoute('/books/b-013', '?h=h-001&year=2025')).toEqual({
            name: 'book',
            bookId: 'b-013',
        });
    });

    it('treats an empty or malformed parameter as no link rather than a broken id', () => {
        expect(parseRoute('/', '?h=')).toEqual({ name: 'hall', highlightId: null });
        expect(parseRoute('/', '?h')).toEqual({ name: 'hall', highlightId: null });
        // A malformed percent-escape must not throw inside a parse function.
        expect(parseRoute('/', '?h=%E0%A4%A').name).toBe('hall');
    });

    it('rebuilds the linked address and encodes ids that need it', () => {
        expect(routePath({ name: 'hall', highlightId: null })).toBe('/');
        expect(routePath({ name: 'hall', highlightId: 'h-001' })).toBe('/?h=h-001');
        const route = { name: 'hall', highlightId: '中文 id' } as const;
        expect(routePath(route)).toBe('/?h=%E4%B8%AD%E6%96%87%20id');
        expect(parseRoute('/', `?h=${encodeURIComponent('中文 id')}`)).toEqual({ name: 'hall', highlightId: '中文 id' });
    });

    it('keeps one hall behind every deep link, for scroll, sessions and the aura', () => {
        const plain = routeKey({ name: 'hall', highlightId: null });
        expect(routeKey({ name: 'hall', highlightId: 'h-001' })).toBe(plain);
        expect(routeKey({ name: 'hall', highlightId: 'h-999' })).toBe(plain);
        expect(roomPath({ name: 'hall', highlightId: 'h-001' })).toBe('/');
        // Other rooms already normalise away everything that is not theirs.
        expect(roomPath(parseRoute('/themes/t-001', '?h=h-001'))).toBe('/themes/t-001');
        expect(roomPath(parseRoute('/books/b-013', '?h=h-001'))).toBe('/books/b-013');
    });
});
