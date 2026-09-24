import type { Snapshot } from '../src/domain/types.ts';

/** Paths with public static entry documents. Never include ids absent from the approved snapshot. */
export function publicRoomPaths(snapshot: Pick<Snapshot, 'books' | 'themes' | 'tags'>): string[] {
    const paths = [
        '/themes',
        ...snapshot.themes.map((theme) => `/themes/${encodeURIComponent(theme.id)}`),
        '/paths',
        ...snapshot.tags.map((tag) => `/paths/${encodeURIComponent(tag.id)}`),
        '/books',
        ...snapshot.books.map((book) => `/books/${encodeURIComponent(book.id)}`),
        '/map',
        '/about',
        '/design',
    ];
    if (new Set(paths).size !== paths.length) throw new Error('duplicate public room path');
    return paths;
}
