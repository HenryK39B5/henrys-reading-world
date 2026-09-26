import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

const directory = '.private/research/map/projection-pipeline-holdout';
const report = JSON.parse(await readFile(`${directory}/study.json`, 'utf8')) as {
    inputSha256: string;
    globalQueries: { id: string; views: { id: string; nearest30: string[] }[] }[];
    folds: { topic: string; bookId: string; queries: { id: string; sources: { id: string; nearest30: string[] }[] }[] }[];
};
const extra = JSON.parse(await readFile(`${directory}/viewer-supplement.json`, 'utf8')) as {
    views: { id: string; caseId?: string; topic: string | null; heldoutBookId?: string }[];
};
const out = `${directory}/screenshots`;
await mkdir(out, { recursive: true });
for (const width of [1440, 390, 320]) {
    test(`${width}: full pipeline and actual held-book cases match offline cross-book pools`, async ({ page, request }) => {
        await page.setViewportSize({ width, height: 900 }); await page.emulateMedia({ reducedMotion: 'reduce' });
        const errors: string[] = []; page.on('pageerror', (e) => errors.push(e.message));
        await page.goto('/'); await expect(page.locator('#selected-id')).toHaveText('h-3501');
        const frames = [];
        for (const view of extra.views) {
            const id = view.caseId ?? 'h-3501';
            await page.locator('#query').selectOption(id);
            await page.locator('#window').selectOption(view.id);
            const actual = await page.evaluate(() => (window as unknown as { __projectionStudy: { neighbors: { low: string[]; high: string[] }; state: { selected: string; viewId: string } } }).__projectionStudy);
            expect(actual.state.selected).toBe(id); expect(actual.state.viewId).toBe(view.id);
            const expected = view.heldoutBookId === undefined ? report.globalQueries.find((q) => q.id === id)!.views.find((v) => v.id === view.id)!.nearest30
                : report.folds.find((f) => f.topic === view.topic && f.bookId === view.heldoutBookId)!.queries.find((q) => q.id === id)!.sources.find((s) => s.id === 'leave-book-cpca64')!.nearest30;
            expect(actual.neighbors.low).toEqual(expected);
            const pixels = await page.locator('#plot').evaluate((element) => {
                const c = element as HTMLCanvasElement; const p = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data; let colored = 0;
                for (let i = 0; i < p.length; i += 4) if (p[i]! > 50 || p[i + 1]! > 60 || p[i + 2]! > 60) colored += 1;
                return colored;
            });
            expect(pixels).toBeGreaterThan(1500);
            expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
            if (view.heldoutBookId !== undefined) { await expect(page.locator('#topic')).toBeDisabled(); await expect(page.locator('#metric')).toContainText('留书跨书'); }
            await page.screenshot({ path: `${out}/${view.id}-${width}.png`, fullPage: true });
            frames.push({ view: view.id, query: id, width, pixels, neighbors: actual.neighbors });
            await page.getByRole('button', { name: '原视角', exact: true }).click();
            await expect(page.locator('#selected-id')).toHaveText(id);
        }
        const payload = await (await request.get('/viewer-data.json')).text();
        expect(payload).not.toMatch(/"(?:values|vectors|textHash|eigenvalues|confidence|sourceBookId)"/u);
        expect((await request.get('/viewer-supplement.json')).status()).toBe(404);
        expect(errors).toEqual([]);
        await writeFile(`${out}/evidence-${width}.json`, JSON.stringify({ inputSha256: report.inputSha256, width, frames, errors }, null, 2) + '\n', 'utf8');
    });
}
