import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { hasSnapshot, loadSnapshot } from './support/snapshot.ts';

/**
 * Network and privacy acceptance (docs/02 §4, §7, docs/15 §8.2).
 *
 * The reading world is a static client: it must not reach out to 微信读书, a font CDN, an analytics
 * endpoint or anywhere else, and the private development files must not be readable over HTTP. The
 * snapshot the local mode serves is checked against the published field contract rather than trusted.
 */

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

/** Keys the data contract allows on the wire (docs/03 §2). Anything else is a leak or a mistake. */
const ALLOWED_SNAPSHOT_KEYS = ['schemaVersion', 'visibility', 'owner', 'books', 'themes', 'highlights'];
const ALLOWED_BOOK_KEYS = ['id', 'title', 'author', 'description', 'coverPath', 'themeIds'];
const ALLOWED_THEME_KEYS = ['id', 'title', 'description'];
const ALLOWED_HIGHLIGHT_KEYS = ['id', 'bookId', 'text', 'year'];
const ALLOWED_OWNER_KEYS = ['displayName', 'siteTitle', 'about'];

test.describe('the client talks to nothing but itself', () => {
    test.skip(!hasSnapshot, '需要 .private/local-snapshot.json 才能核对真实内容');

    test('a full walk of every room and the dialog makes no external request', async ({ page }) => {
        const data = loadSnapshot();
        const requests: string[] = [];
        page.on('request', (request) => {
            requests.push(request.url());
        });

        const bookId = data.biggestBookId ?? data.books[0]?.id ?? '';
        const themeId = data.themes[0]?.id ?? '';
        for (const path of [
            '/',
            '/themes',
            `/themes/${encodeURIComponent(themeId)}`,
            '/books',
            `/books/${encodeURIComponent(bookId)}`,
            '/about',
            `/?h=${encodeURIComponent(data.longest.id)}`,
        ]) {
            await page.goto(path);
            await expect(page.locator('[data-room]')).toBeVisible();
        }

        // The dialog too, since it is where a link leaves the page.
        await page.getByTestId('share-open').click();
        await expect(page.getByTestId('share-dialog')).toBeVisible();
        await page.getByTestId('share-copy-text').click();
        await expect(page.getByTestId('share-status')).toHaveText(/已复制|自动复制失败，请手动复制/u);

        const origin = new URL(page.url()).origin;
        const external = requests.filter((url) => new URL(url).origin !== origin);
        expect(external, 'no request may leave the local origin').toEqual([]);

        // And nothing that looks like a third-party service was even attempted.
        const suspicious = requests.filter((url) =>
            /weread|weixin|qq\.com|googleapis|gstatic|fonts\.|analytics|sentry|segment|hotjar|doubleclick/iu.test(
                url,
            ),
        );
        expect(suspicious).toEqual([]);
        expect(requests.length).toBeGreaterThan(5);
    });

    test('the served snapshot carries only the published fields', async ({ page }) => {
        await page.goto('/');
        await expect(page.getByTestId('stage-passage')).toBeVisible();

        const payload = await page.evaluate(async () => (await fetch('/__local_snapshot')).text());
        const snapshot = JSON.parse(payload) as {
            owner: Record<string, unknown>;
            books: Record<string, unknown>[];
            themes: Record<string, unknown>[];
            highlights: Record<string, unknown>[];
        };

        expect(Object.keys(snapshot).sort()).toEqual([...ALLOWED_SNAPSHOT_KEYS].sort());
        expect(Object.keys(snapshot.owner).every((key) => ALLOWED_OWNER_KEYS.includes(key))).toBe(true);
        for (const book of snapshot.books) {
            expect(Object.keys(book).filter((key) => !ALLOWED_BOOK_KEYS.includes(key))).toEqual([]);
        }
        for (const theme of snapshot.themes) {
            expect(Object.keys(theme).filter((key) => !ALLOWED_THEME_KEYS.includes(key))).toEqual([]);
        }
        for (const highlight of snapshot.highlights) {
            expect(Object.keys(highlight).filter((key) => !ALLOWED_HIGHLIGHT_KEYS.includes(key))).toEqual([]);
        }

        // Nothing that only exists in the private review ledger, and no credential name, on the wire.
        for (const forbidden of [
            'WEREAD_API_KEY',
            'bookmarkId',
            'userVid',
            'rawResponse',
            'privacyRisk',
            'reviewState',
            'noteCount',
            'reviewCount',
            'apiKey',
        ]) {
            expect(payload.includes(forbidden), `${forbidden} must never be served`).toBe(false);
        }
    });
});

test.describe('private files stay private', () => {
    test.skip(!hasSnapshot, '需要 .private/local-snapshot.json 才能核对真实内容');

    test('no HTTP path hands out the raw data, the skill, the scripts or a credential file', async ({ page }) => {
        const data = loadSnapshot();
        await page.goto('/');
        await expect(page.getByTestId('stage-passage')).toBeVisible();

        const projectRoot = process.cwd().replace(/\\/gu, '/');
        const attempts = [
            '/.private/local-snapshot.json',
            '/.private/curation/development-authorization.json',
            '/../.private/local-snapshot.json',
            '/%2e%2e/.private/local-snapshot.json',
            `/${projectRoot}/.private/local-snapshot.json`,
            `/@fs/${projectRoot}/.private/local-snapshot.json`,
            `/@fs/${projectRoot}/.agents/skills/weread-skills/SKILL.md`,
            '/scripts/weread-request.ps1',
            '/.env',
        ];

        // A real fragment of a real passage: it must not be obtainable from any of these paths.
        const fragment = data.longest.text.trim().slice(0, 16);

        for (const path of attempts) {
            const response = await page.request.get(path);
            const body = await response.text();
            const relative = path.replace(/^\/+|\/\.\.\//gu, '').replace(/^@fs\/[A-Za-z]:\//u, '');
            const exists = existsSync(join(process.cwd(), relative));

            // A file that exists must not be handed over as itself. A path that does not exist may still
            // get the SPA shell, which is the app and not the file.
            if (exists) {
                expect(response.status(), `${path} must not be served`).not.toBe(200);
            }
            expect(body.includes('"schemaVersion"'), `${path} must not serve the snapshot`).toBe(false);
            expect(body.includes(fragment), `${path} must not leak a real passage`).toBe(false);
            expect(body.includes('WEREAD_API_KEY'), `${path} must not leak credentials`).toBe(false);
        }

        // The one sanctioned door is the minimal snapshot, and it is the validator's job to keep it minimal.
        const sanctioned = await page.request.get('/__local_snapshot');
        expect(sanctioned.status()).toBe(200);
        expect(sanctioned.headers()['cache-control']).toContain('no-store');
    });

    test('the page says out loud that it is local and not yet public', async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('.local-badge')).toHaveText('仅本机 · 未公开审核');
        // The public mode has no such badge; there the content itself is the reviewed subset (see test:public).
        expect(await page.evaluate(() => document.body.innerText.includes('仅本机'))).toBe(true);
    });
});
