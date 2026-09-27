import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { deterministicNext, type NextData } from '../../scripts/research/routeNext.mjs';
import { compareTaggedPassages, lensMembership } from '../../scripts/research/readingStory.mjs';

const dir = '.private/research/map/route-first/reading-story';
const raw = await readFile('.private/research/map/route-first/viewer-data.json', 'utf8');
if (createHash('sha256').update(raw).digest('hex') !== 'f95cfa8bb830a9e2600fceeb69a7101910c85906f452d207dde04431f99fca6d') throw new Error('R4-M viewer changed');
const data = JSON.parse(raw) as NextData & { seeds: string[]; points: Record<string, { id: string; bookId: string; bookTitle: string; text: string }> };
const tagRaw = await readFile(`${dir}/tag-overlay.json`, 'utf8');
const overlay = JSON.parse(tagRaw) as { snapshotSha256: string; viewerSha256: string; highlightTags: Record<string, string[]>; tags: Record<string, string> };
if (overlay.snapshotSha256 !== 'ccef39e7410ba7dd1618a8038762933464dd35c45a98f5fa48fb5e8c02c53a7c' || overlay.viewerSha256 !== createHash('sha256').update(raw).digest('hex')) throw new Error('R4-M tags drift');
const bookIds = Object.fromEntries(Object.entries(data.points).map(([id, point]) => [id, point.bookId]));
await mkdir(`${dir}/screenshots`, { recursive: true });

test('research entry serves only frozen, allowlisted loopback assets', async ({ request }) => {
    for (const path of ['/reading-story', '/reading-story.css', '/reading-story.mjs', '/reading-story-rule.mjs', '/reading-story-data.json', '/viewer-data.json']) expect((await request.get(path)).status()).toBe(200);
    expect((await request.get('/.private/research/map/route-first/reading-story/tag-overlay.json')).status()).toBe(404);
    expect((await request.get('/reading-story', { headers: { Host: 'remote.invalid' } })).status()).toBe(403);
    expect((await request.get('/reading-story', { headers: { Origin: 'https://remote.invalid' } })).status()).toBe(403);
    expect((await request.post('/reading-story')).status()).toBe(405);
});

for (const width of [1440, 720, 390, 320]) {
    test(`${width}: fixed map, exact tags, one-action route and optional full-text encounter`, async ({ page }) => {
        await page.setViewportSize({ width, height: 850 }); await page.emulateMedia({ reducedMotion: 'reduce' });
        const errors: string[] = [], external: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        page.on('request', (request) => { if (!request.url().startsWith('http://127.0.0.1:5204/')) external.push(request.url()); });
        await page.goto('/reading-story'); await expect(page.locator('#point-id')).toHaveText(data.seeds[0]!);
        const state = () => page.evaluate(() => window.__readingStory.state);
        const start = await state(); expect(start.trail).toEqual([data.seeds[0]]);
        expect(start.next).toEqual(deterministicNext(data, start.trail));
        expect(start.lens).toEqual(lensMembership(overlay.highlightTags, bookIds, start.trail[0]!));
        await expect(page.locator('#text')).toHaveText(data.points[start.trail[0]!]!.text);
        await expect(page.locator('#evidence')).toBeHidden();
        const journey = [data.seeds[0]!];
        await page.screenshot({ path: `${dir}/screenshots/story-${width}-start.png`, fullPage: true });
        for (let index = 0; index < 3; index += 1) {
            const next = deterministicNext(data, journey); expect(next.status).toBe('ready');
            await page.locator('#next').scrollIntoViewIfNeeded(); const before = await page.locator('.map-frame').boundingBox();
            await page.locator('#next').focus(); await page.keyboard.press('Enter'); journey.push(next.candidate!.id);
            const after = await page.locator('.map-frame').boundingBox();
            expect(after!.x).toBeCloseTo(before!.x, 0); expect(after!.y).toBeCloseTo(before!.y, 0);
            await expect(page.locator('#text')).toHaveText(data.points[next.candidate!.id]!.text);
            expect((await state()).trail).toEqual(journey);
            expect((await state()).lens).toEqual(lensMembership(overlay.highlightTags, bookIds, next.candidate!.id));
            expect((await state()).evidence.at(-1)).toMatchObject(compareTaggedPassages(overlay.highlightTags, journey.at(-2)!, journey.at(-1)!));
            await expect(page.locator('#evidence')).toBeVisible();
            if (index === 0 || index === 2) await page.screenshot({ path: `${dir}/screenshots/story-${width}-step${index + 1}-closed.png`, fullPage: true });
            if (width <= 390) {
                expect(after!.y + after!.height).toBeLessThan(250);
                expect((await page.locator('#text').boundingBox())!.y).toBeGreaterThanOrEqual(after!.y + after!.height - 7);
            }
        }
        expect((await state()).evidence.map((edge: { status: string }) => edge.status)).toEqual(['disjoint', 'disjoint', 'shared']);
        await expect(page.locator('#arrival')).toContainText(overlay.tags['tag-040']!);
        await page.locator('#evidence summary').click();
        await expect(page.locator('#from-text')).toHaveText(data.points[journey.at(-2)!]!.text);
        await expect(page.locator('#to-text')).toHaveText(data.points[journey.at(-1)!]!.text);
        await expect(page.locator('#from-tags')).toContainText(overlay.tags['tag-040']!);
        await page.screenshot({ path: `${dir}/screenshots/story-${width}-shared-encounter.png`, fullPage: true });
        expect((await page.evaluate(() => document.documentElement.scrollWidth))).toBeLessThanOrEqual(width);
        const beforeBack = [...journey];
        await page.locator('#back').click(); await expect(page.locator('#text')).toHaveText(data.points[beforeBack.at(-2)!]!.text);
        expect((await state()).trail).toEqual(beforeBack.slice(0, -1));
        await page.locator('#next').click(); expect((await state()).trail).toEqual(beforeBack);
        await page.locator('#seed').selectOption('h-043'); await expect(page.locator('#next')).toBeDisabled();
        await expect(page.locator('#end-status')).toContainText('无合格');
        expect((await state()).trail).toEqual(['h-043']); expect(errors).toEqual([]); expect(external).toEqual([]);
        await writeFile(`${dir}/story-${width}-geometry.json`, JSON.stringify({ width, start: start.trail, matchedAfterThree: beforeBack, final: 'h-043' }, null, 2) + '\n');
    });
}

test('fixed drift and long-jump examples expose unknown rather than negative evidence', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 850 });
    for (const [seed, steps, ending] of [['h-2288', 3, 'h-1108'], ['h-4504', 4, 'h-4034']] as const) {
        await page.goto('/reading-story'); await expect(page.locator('#point-id')).toHaveText(data.seeds[0]!);
        await page.locator('#seed').selectOption(seed); const trail: string[] = [seed];
        for (let index = 0; index < steps; index += 1) {
            const next = deterministicNext(data, trail); expect(next.status).toBe('ready');
            await page.locator('#next').click(); trail.push(next.candidate!.id);
        }
        expect(trail.at(-1)).toBe(ending);
        expect((await page.evaluate(() => window.__readingStory.state.evidence.at(-1))).status).toBe('unknown');
        await expect(page.locator('#arrival')).toContainText('缺少已审核主题标签');
        await expect(page.locator('#text')).toHaveText(data.points[ending]!.text);
        if (ending === 'h-1108') { await expect(page.locator('#tags')).toContainText('信息未知'); await expect(page.locator('#lens-caption')).toContainText('未标注不是'); }
        if (ending === 'h-4034') {
            await page.locator('#evidence summary').click(); await expect(page.locator('#edge-note')).toContainText('49.4%');
        }
        await page.screenshot({ path: `${dir}/screenshots/story-${seed}-390.png`, fullPage: true });
    }
});
