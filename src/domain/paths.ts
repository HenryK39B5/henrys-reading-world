import type { SnapshotIndex } from './snapshot.ts';
import type { TopicTag } from './types.ts';

export type PathSummary = {
    tag: TopicTag;
    highlightCount: number;
    bookCount: number;
};

/** Snapshot tag order is editorial order; counts are derived only from reviewed assignments in it. */
export function summarizePaths(index: SnapshotIndex): PathSummary[] {
    return index.tagsInUse.map((tag) => {
        const highlights = index.highlightsByTag.get(tag.id) ?? [];
        return {
            tag,
            highlightCount: highlights.length,
            bookCount: new Set(highlights.map((highlight) => highlight.bookId)).size,
        };
    });
}

export function pathCountText(summary: Pick<PathSummary, 'bookCount' | 'highlightCount'>): string {
    return `${String(summary.bookCount)} 本书 · ${String(summary.highlightCount)} 处划线`;
}
