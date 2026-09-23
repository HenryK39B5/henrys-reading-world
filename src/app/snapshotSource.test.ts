import { describe, expect, it } from 'vitest';
import { loadSnapshot } from './snapshotSource.ts';
import { EMPTY_SNAPSHOT, SNAPSHOT_SCHEMA_VERSION, type Snapshot } from '../domain/types.ts';

function localSnapshot(): Snapshot {
    return {
        ...EMPTY_SNAPSHOT,
        visibility: 'local-only',
        themes: [{ id: 't-001', title: 'Theme One' }],
        books: [{ id: 'b-001', title: 'Book One', author: 'Author One', themeIds: ['t-001'] }],
        highlights: [{ id: 'h-001', bookId: 'b-001', text: 'passage', year: 2020, tagIds: [] }],
    };
}

function fakeFetch(body: unknown, status = 200) {
    return () =>
        Promise.resolve({
            ok: status >= 200 && status < 300,
            status,
            json: () => Promise.resolve(body),
        });
}

describe('loadSnapshot', () => {
    it('reads the local endpoint only in local mode', async () => {
        const result = await loadSnapshot('local', fakeFetch(localSnapshot()));
        expect(result.status).toBe('ready');
    });

    it('treats a missing local snapshot as an error with guidance, not as empty content', async () => {
        const result = await loadSnapshot('local', fakeFetch({ error: 'nope' }, 404));
        expect(result.status).toBe('error');
        if (result.status === 'error') {
            expect(result.errors.join(' ')).toContain('npm run snapshot:local');
        }
    });

    it('rejects a local snapshot that is not marked local-only', async () => {
        const result = await loadSnapshot('local', fakeFetch({ ...localSnapshot(), visibility: 'public' }));
        expect(result.status).toBe('error');
    });

    it('reports the ready state when the public snapshot carries approved material', async () => {
        const result = await loadSnapshot('public');
        expect(result.status).toBe('ready');
        if (result.status === 'ready') {
            expect(result.snapshot.schemaVersion).toBe(SNAPSHOT_SCHEMA_VERSION);
            expect(result.snapshot.books.length).toBeGreaterThan(0);
            expect(result.snapshot.highlights.length).toBeGreaterThan(0);
        }
    });
});
