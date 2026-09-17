import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { StatusPanel } from '../src/app/StatusPanel.tsx';
import { loadSnapshot } from '../src/app/snapshotSource.ts';
import { walkRound } from '../src/domain/bookWalk.ts';
import { indexSnapshot } from '../src/domain/snapshot.ts';
import { passagesOfBook, unreachableHighlights } from '../src/domain/reading.ts';

/**
 * Real-data smoke check for the local development path.
 *
 * Skips when .private/local-snapshot.json is absent (for example in a public-only checkout).
 * Passages are asserted, never printed.
 */
const SNAPSHOT_PATH = join(process.cwd(), '.private/local-snapshot.json');
const hasLocalSnapshot = existsSync(SNAPSHOT_PATH);

function fileFetcher(body: unknown) {
    return () =>
        Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(body),
        });
}

describe.skipIf(!hasLocalSnapshot)('local snapshot smoke', () => {
    it('loads real authorized data and renders the first real passage', async () => {
        const parsed: unknown = JSON.parse(await readFile(SNAPSHOT_PATH, 'utf8'));
        const result = await loadSnapshot('local', fileFetcher(parsed));

        expect(result.status).toBe('ready');
        if (result.status !== 'ready') {
            return;
        }
        expect(result.snapshot.visibility).toBe('local-only');
        // The whole real library is on the page now, not a hand-picked sample (docs/10 §7).
        expect(result.snapshot.highlights.length).toBeGreaterThanOrEqual(1000);
        expect(result.snapshot.books.length).toBeGreaterThanOrEqual(100);
        expect(result.snapshot.themes.length).toBeGreaterThanOrEqual(8);

        const html = renderToStaticMarkup(<StatusPanel state={result} />);
        const first = result.snapshot.highlights[0];
        expect(first).toBeDefined();
        if (first === undefined) {
            return;
        }
        expect(html).toContain(first.text.replaceAll('&', '&amp;'));
        expect(html).toContain('真实划线数据已就绪');
    });

    it('applies user-approved metadata cleanup without exposing correction provenance', async () => {
        const snapshot = JSON.parse(await readFile(SNAPSHOT_PATH, 'utf8')) as {
            books: { id: string; title: string; author: string }[];
        };
        const byId = new Map(snapshot.books.map((book) => [book.id, book]));
        expect(byId.get('b-025')).toMatchObject({ title: '软件设计的哲学', author: '约翰·奥斯特豪特' });
        expect(byId.get('b-031')).toMatchObject({ title: '客户的游艇在哪里：华尔街奇谈（典藏版）', author: '小弗雷德·施韦德' });
        expect(byId.get('b-048')).toMatchObject({ title: '人月神话（二十周年纪念版）', author: '弗雷德里克·P.布鲁克斯' });
        expect(byId.get('b-074')).toMatchObject({ title: '个人主义与经济秩序', author: '弗里德里希·冯·哈耶克' });

        const serialized = JSON.stringify(snapshot);
        expect(serialized).not.toContain('Z-Library');
        expect(serialized).not.toContain('.epub');
        expect(serialized).not.toContain('用户 2026-09-17');
    });

    it('keeps source identifiers and raw capture fields out of the payload', async () => {
        const raw = await readFile(SNAPSHOT_PATH, 'utf8');
        for (const forbidden of ['planIndex', 'sourceBookId', 'bookmarkId', 'userVid', 'deepLink', 'secret']) {
            expect(raw).not.toContain(forbidden);
        }
    });

    it('files every book on at least one theme shelf', async () => {
        const parsed: unknown = JSON.parse(await readFile(SNAPSHOT_PATH, 'utf8'));
        const result = await loadSnapshot('local', fileFetcher(parsed));
        expect(result.status).toBe('ready');
        if (result.status !== 'ready') {
            return;
        }
        const untagged = result.snapshot.books.filter((book) => book.themeIds.length === 0);
        expect(untagged.map((book) => book.id)).toEqual([]);
        const themeIds = new Set(result.snapshot.themes.map((theme) => theme.id));
        for (const book of result.snapshot.books) {
            for (const themeId of book.themeIds) {
                expect(themeIds.has(themeId)).toBe(true);
            }
        }
    });

    /**
     * Reachability, proven against the real library (docs/17 §3.4).
     *
     * The book room stopped unfolding a batched list, so "walk the list to its end" is no longer the proof
     * that everything is reachable. The replacement is stronger: one round of one book visits *every* passage
     * of that book exactly once, so the union over the 130 books is the whole library. Drawing 4,663 times
     * here is a deterministic script over real data, not a browser journey, and no passage text is printed.
     */
    it('reaches every real passage through one round per book', async () => {
        const parsed: unknown = JSON.parse(await readFile(SNAPSHOT_PATH, 'utf8'));
        const result = await loadSnapshot('local', fileFetcher(parsed));
        expect(result.status).toBe('ready');
        if (result.status !== 'ready') {
            return;
        }
        const index = indexSnapshot(result.snapshot);
        expect(unreachableHighlights(index)).toEqual([]);

        // A deterministic RNG: the sweep and an always-same draw must both cover the book.
        const covered = new Set<string>();
        for (const book of index.booksInUse) {
            const passages = passagesOfBook(index, book.id);
            const round = walkRound(book.id, passages, sweepish(13));
            expect(round.length, `${book.id} must show every passage once`).toBe(passages.length);
            expect(new Set(round).size, `${book.id} must not repeat inside a round`).toBe(passages.length);
            for (const id of round) {
                covered.add(id);
            }
        }

        // The union is the whole library: every real passage is reachable by walking its own book.
        expect(covered.size).toBe(result.snapshot.highlights.length);
        for (const highlight of result.snapshot.highlights) {
            expect(covered.has(highlight.id)).toBe(true);
        }
    });

    it('walks the largest real book to its last passage inside one round', async () => {
        const parsed: unknown = JSON.parse(await readFile(SNAPSHOT_PATH, 'utf8'));
        const result = await loadSnapshot('local', fileFetcher(parsed));
        expect(result.status).toBe('ready');
        if (result.status !== 'ready') {
            return;
        }
        const index = indexSnapshot(result.snapshot);
        const largest = [...index.highlightsByBook.entries()].sort((left, right) => right[1].length - left[1].length)[0];
        expect(largest).toBeDefined();
        if (largest === undefined) {
            return;
        }
        const [bookId, all] = largest;
        expect(all.length).toBeGreaterThan(200);

        const first = (): number => 0;
        const last = (): number => 0.999_999;
        for (const rng of [first, last, sweepish(97)]) {
            const round = walkRound(bookId, all, rng);
            expect(round).toHaveLength(all.length);
            expect(new Set(round).size).toBe(all.length);
            expect([...round].sort()).toEqual(all.map((item) => item.id).sort());
        }
        console.log(`largest real book: ${String(all.length)} passages, covered in one round with 0 repeats`);
    });
});

/** A fixed sweep over [0, 1): deterministic and evenly spread, so the draw never depends on luck. */
function sweepish(steps: number): () => number {
    let cursor = 0;
    return () => {
        cursor = (cursor + 1) % steps;
        return cursor / steps;
    };
}
