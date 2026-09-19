import { describe, expect, it } from 'vitest';
import { pathCountText, summarizePaths } from './paths.ts';
import { indexSnapshot } from './snapshot.ts';
import { SNAPSHOT_SCHEMA_VERSION, type Snapshot } from './types.ts';

const snapshot: Snapshot = {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    visibility: 'local-only',
    owner: { displayName: 'Henry', siteTitle: 'Reading World' },
    themes: [],
    tags: [
        { id: 'tag-001', title: '希望', description: '未来仍可能打开。' },
        { id: 'tag-002', title: '风险', description: '结果可能产生损失。' },
        { id: 'tag-003', title: '等待' },
    ],
    books: [
        { id: 'b-001', title: 'Book One', author: 'Author', themeIds: [] },
        { id: 'b-002', title: 'Book Two', author: 'Author', themeIds: [] },
    ],
    highlights: [
        { id: 'h-001', bookId: 'b-001', text: 'one', tagIds: ['tag-001', 'tag-002'] },
        { id: 'h-002', bookId: 'b-002', text: 'two', tagIds: ['tag-001'] },
    ],
};

describe('topic path summaries', () => {
    it('keeps snapshot editorial order and omits tags with no reviewed passage', () => {
        const paths = summarizePaths(indexSnapshot(snapshot));
        expect(paths.map((entry) => entry.tag.id)).toEqual(['tag-001', 'tag-002']);
        expect(paths[0]).toMatchObject({ highlightCount: 2, bookCount: 2 });
        expect(paths[1]).toMatchObject({ highlightCount: 1, bookCount: 1 });
        expect(pathCountText(paths[0]!)).toBe('2 本书 · 2 处划线');
    });
});
