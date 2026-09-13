import { describe, expect, it } from 'vitest';
import { parseRoute, routeKey, routePath, bookRoomKey } from './router.ts';

/**
 * Router properties (docs/12 §3).
 *
 * The six rooms, their filters and invalid paths are parsed by a pure function, so what a URL means can
 * be checked without a browser — and the canonical path can always be rebuilt from the parsed route.
 */
describe('routes are parsed from real paths', () => {
    it('maps each room to its own route', () => {
        expect(parseRoute('/')).toEqual({ name: 'hall' });
        expect(parseRoute('/themes')).toEqual({ name: 'themes' });
        expect(parseRoute('/themes/t-001')).toEqual({ name: 'theme', themeId: 't-001' });
        expect(parseRoute('/books')).toEqual({ name: 'books', year: null, themeId: null });
        expect(parseRoute('/books/b-013')).toEqual({ name: 'book', bookId: 'b-013', year: null });
        expect(parseRoute('/about')).toEqual({ name: 'about' });
    });

    it('keeps real filters and drops impossible ones', () => {
        expect(parseRoute('/books', '?year=2025')).toEqual({ name: 'books', year: 2025, themeId: null });
        expect(parseRoute('/books', '?theme=t-002')).toEqual({ name: 'books', year: null, themeId: 't-002' });
        expect(parseRoute('/books', '?year=2025&theme=t-002')).toEqual({ name: 'books', year: 2025, themeId: 't-002' });
        expect(parseRoute('/books/b-001', '?year=2024')).toEqual({ name: 'book', bookId: 'b-001', year: 2024 });
        // A year that is not a year, or is out of any plausible range of digits, is not invented.
        expect(parseRoute('/books', '?year=2025-01')).toEqual({ name: 'books', year: null, themeId: null });
        expect(parseRoute('/books', '?year=abc')).toEqual({ name: 'books', year: null, themeId: null });
    });

    it('reports an unknown path instead of inventing a room', () => {
        expect(parseRoute('/nope')).toEqual({ name: 'unknown', path: '/nope' });
        expect(parseRoute('/themes/t-001/extra')).toEqual({ name: 'unknown', path: '/themes/t-001/extra' });
        expect(parseRoute('/books/b-001/2024')).toEqual({ name: 'unknown', path: '/books/b-001/2024' });
    });

    it('survives malformed encoding without throwing', () => {
        expect(parseRoute('/themes/%E0%A4%A')).toEqual({ name: 'theme', themeId: '%E0%A4%A' });
    });

    it('ignores a trailing slash but keeps the room', () => {
        expect(parseRoute('/themes/')).toEqual({ name: 'themes' });
        expect(parseRoute('/books/')).toEqual({ name: 'books', year: null, themeId: null });
    });
});

describe('routes are rebuilt as canonical URLs', () => {
    it('round-trips every room', () => {
        for (const path of ['/', '/themes', '/themes/t-001', '/books', '/books/b-013', '/about', '/books/b-013?year=2025']) {
            const [pathname = '/', search = ''] = path.split('?');
            expect(routePath(parseRoute(pathname, search))).toBe(path);
        }
    });

    it('writes filters in a stable order', () => {
        expect(routePath({ name: 'books', year: 2025, themeId: 't-001' })).toBe('/books?year=2025&theme=t-001');
        expect(routePath({ name: 'books', year: null, themeId: 't-001' })).toBe('/books?theme=t-001');
        expect(routePath({ name: 'books', year: 2025, themeId: null })).toBe('/books?year=2025');
    });

    it('encodes ids that need it and keeps them stable as memory keys', () => {
        const route = parseRoute('/themes/%E4%B8%AD%E6%96%87');
        expect(route).toEqual({ name: 'theme', themeId: '中文' });
        expect(routePath(route)).toBe('/themes/%E4%B8%AD%E6%96%87');
        expect(routeKey(route)).toBe('/themes/%E4%B8%AD%E6%96%87');
        expect(bookRoomKey('b-001', 2025)).toBe('/books/b-001?year=2025');
    });

    it('gives the six rooms distinct memory keys', () => {
        const keys = [
            routeKey({ name: 'hall' }),
            routeKey({ name: 'themes' }),
            routeKey({ name: 'theme', themeId: 't-001' }),
            routeKey({ name: 'books', year: null, themeId: null }),
            routeKey({ name: 'books', year: 2025, themeId: null }),
            routeKey({ name: 'book', bookId: 'b-001', year: null }),
            routeKey({ name: 'about' }),
        ];
        expect(new Set(keys).size).toBe(keys.length);
    });
});
