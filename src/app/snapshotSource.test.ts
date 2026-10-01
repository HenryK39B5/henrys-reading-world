import { describe, expect, it } from 'vitest';
import { loadSnapshot } from './snapshotSource.ts';
import { EMPTY_SNAPSHOT, SNAPSHOT_SCHEMA_VERSION, type Snapshot } from '../domain/types.ts';
import publicSnapshot from '../data/public-snapshot.json';

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

    it('reports an unavailable public asset without pretending the collection is empty', async () => {
        const result = await loadSnapshot('public', fakeFetch({}, 404));
        expect(result.status).toBe('error');
    });

    it('reuses an early public result across consumers but still validates the real approved snapshot', async () => {
        const early = Promise.resolve({ ok: true, status: 200, raw: publicSnapshot });
        const noFetch = () => { throw Error('Early request must not cause another fetch'); };
        for (let consumer = 0; consumer < 2; consumer++) {
            const result = await loadSnapshot('public', noFetch, early);
            expect(result.status).toBe('ready');
            if (result.status === 'ready') expect(result.snapshot.highlights.length).toBe(publicSnapshot.highlights.length);
        }
        expect((await loadSnapshot('public', noFetch, Promise.resolve({ ok: true, status: 200, raw: {} }))).status).toBe('error');
    });

    it('preserves early request failures without a hidden retry or an invented empty scope', async () => {
        const noFetch = () => { throw Error('Do not silently retry'); };
        expect((await loadSnapshot('public', noFetch, Promise.resolve(null))).status).toBe('error');
        const unavailable = await loadSnapshot('public', noFetch, Promise.resolve({ ok: false, status: 503, raw: null }));
        expect(unavailable.status).toBe('error');
        if (unavailable.status === 'error') expect(unavailable.errors.join(' ')).toContain('503');
    });

    it('never consumes a public bootstrap for the local scope', async () => {
        const result = await loadSnapshot('local', fakeFetch(localSnapshot()), Promise.resolve({ ok: true, status: 200, raw: publicSnapshot }));
        expect(result.status).toBe('ready');
        if (result.status === 'ready') expect(result.snapshot.visibility).toBe('local-only');
    });

    it('reports the ready state when the public snapshot carries approved material', async () => {
        const result = await loadSnapshot('public', fakeFetch(publicSnapshot));
        expect(result.status).toBe('ready');
        if (result.status === 'ready') {
            expect(result.snapshot.schemaVersion).toBe(SNAPSHOT_SCHEMA_VERSION);
            expect(result.snapshot.books.length).toBeGreaterThan(0);
            expect(result.snapshot.highlights.length).toBeGreaterThan(0);
        }
    });
});
