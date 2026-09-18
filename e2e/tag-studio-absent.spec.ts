import { expect, test } from '@playwright/test';

/**
 * The Studio's endpoints must not exist in the reading app (docs/22 §6.2).
 *
 * The normal local mode serves the private snapshot because that *is* the reading experience, but it must
 * not also serve the tag vocabulary or accept trial writes. This runs against `dev:local` on 5173, which is
 * the server the product actually uses.
 *
 * The assertions are about capability, not status codes: a Vite dev server answers an unknown route with
 * the SPA shell, so a 200 alone proves nothing. What matters is that the response is never a readable
 * vocabulary, that no write is ever accepted, and that the Studio document itself cannot load any trial
 * data here. In a production build the document is not even emitted — `npm run isolation:public` checks
 * that separately.
 */
test.describe('the reading app has no tag-studio endpoints', () => {
    test('serves no tag data and accepts no tag write', async ({ page }) => {
        await page.goto('/');
        await expect(page.getByTestId('stage-passage')).toBeVisible();

        const reads = await page.evaluate(async () => {
            const output: { path: string; status: number; type: string; hasTags: boolean }[] = [];
            for (const path of ['/__tag_vocabulary', '/__tag_assignments']) {
                const response = await fetch(path, { cache: 'no-store' });
                const body = await response.text();
                output.push({
                    path,
                    status: response.status,
                    type: response.headers.get('content-type') ?? '',
                    hasTags: body.includes('"tagIds"') || body.includes('"editorialOrder"'),
                });
            }
            return output;
        });
        for (const read of reads) {
            expect(read.type, `${read.path} must not answer with the private vocabulary`).not.toContain('application/json');
            expect(read.hasTags, `${read.path} must not contain a trial payload`).toBe(false);
        }

        const write = await page.evaluate(async () => {
            const response = await fetch('/__tag_assignments', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ schemaVersion: 1, assignments: [] }),
            });
            return response.status;
        });
        expect(write, 'the trial must never be writable from the reading app').not.toBe(200);
    });

    test('the studio document cannot load a trial in this mode', async ({ page }) => {
        // The file exists on disk, so the dev server hands it out; the point is that it is inert here:
        // no vocabulary, no assignments, and therefore no way to write anything.
        await page.goto('/tag-studio.html');
        await expect(page.getByTestId('studio-problem')).toBeVisible();
        await expect(page.getByTestId('tag-studio')).toHaveCount(0);
    });
});
