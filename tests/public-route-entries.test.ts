import { describe, expect, it } from 'vitest';
import { publicRoomPaths } from '../scripts/public-route-entries.ts';
import publicSnapshot from '../src/data/public-snapshot.json';

describe('static entry documents', () => {
    it('uses only published books and reviewed topic routes from the actual public snapshot', () => {
        const paths = publicRoomPaths(publicSnapshot);
        expect(paths.length).toBe(6 + publicSnapshot.books.length + publicSnapshot.themes.length + publicSnapshot.tags.length);
        expect(paths.filter((path) => path.startsWith('/books/')).length).toBe(publicSnapshot.books.length);
        expect(paths.filter((path) => path.startsWith('/paths/')).length).toBe(publicSnapshot.tags.length);
        expect(paths.filter((path) => path.startsWith('/themes/')).length).toBe(publicSnapshot.themes.length);
        expect(paths).toContain('/design');
        expect(paths).toContain('/map');
        expect(paths).not.toContain('/books/b-013'); // reviewed exclusion, not a static public room
    });
});
