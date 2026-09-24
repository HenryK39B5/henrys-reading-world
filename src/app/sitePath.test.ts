import { describe, expect, it } from 'vitest';
import { roomLocation, sitePath } from './sitePath.ts';

describe('project-site room URLs', () => {
    const base = '/henrys-reading-world/';

    it('prefixes hall, room, and share-query addresses without changing logical routes', () => {
        expect(sitePath('/', base)).toBe('/henrys-reading-world/');
        expect(sitePath('/books/p005', base)).toBe('/henrys-reading-world/books/p005/');
        expect(sitePath('/?h=h-123', base)).toBe('/henrys-reading-world/?h=h-123');
        expect(sitePath('/map?book=p005', base)).toBe('/henrys-reading-world/map/?book=p005');
        expect(sitePath('/design', base)).toBe('/henrys-reading-world/design/');
        expect(sitePath('/design/technical', base)).toBe('/henrys-reading-world/design/technical/');
        expect(sitePath('/not-a-room', base)).toBe('/henrys-reading-world/not-a-room');
        expect(sitePath('/books/p005', '/')).toBe('/books/p005');
    });

    it('only accepts paths inside this project site', () => {
        expect(roomLocation('/henrys-reading-world/', base)).toBe('/');
        expect(roomLocation('/henrys-reading-world/map', base)).toBe('/map');
        expect(roomLocation('/henrys-reading-world/map/', base)).toBe('/map');
        expect(roomLocation('/henrys-reading-world/design/technical/', base)).toBe('/design/technical');
        expect(roomLocation('/henrys-reading-world/books/p005/', base)).toBe('/books/p005');
        expect(roomLocation('/henrys-reading-worldish/books', base)).toBeNull();
        expect(roomLocation('/other-repo/', base)).toBeNull();
    });
});
