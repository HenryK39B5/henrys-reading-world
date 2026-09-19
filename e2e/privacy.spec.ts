import { existsSync, readFileSync } from 'node:fs';
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
const ALLOWED_SNAPSHOT_KEYS = ['schemaVersion', 'visibility', 'owner', 'books', 'themes', 'tags', 'highlights', 'map'];
const ALLOWED_BOOK_KEYS = ['id', 'title', 'author', 'description', 'coverPath', 'themeIds'];
const ALLOWED_THEME_KEYS = ['id', 'title', 'description'];
const ALLOWED_TAG_KEYS = ['id', 'title', 'description'];
const ALLOWED_HIGHLIGHT_KEYS = ['id', 'bookId', 'text', 'year', 'tagIds', 'pathVector'];
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
        const tagId = data.tags[0]?.id ?? '';
        for (const path of [
            '/',
            '/themes',
            `/themes/${encodeURIComponent(themeId)}`,
            '/paths',
            `/paths/${encodeURIComponent(tagId)}`,
            '/map',
            `/map?tag=${encodeURIComponent(tagId)}&book=${encodeURIComponent(bookId)}`,
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
            tags: Record<string, unknown>[];
            highlights: Record<string, unknown>[];
            map?: {
                version: string;
                points: Record<string, unknown>[];
                labels: Record<string, unknown>[];
                density: Record<string, unknown>;
                contours: Record<string, unknown>[];
            };
        };

        expect(Object.keys(snapshot).sort()).toEqual([...ALLOWED_SNAPSHOT_KEYS].sort());
        expect(Object.keys(snapshot.owner).every((key) => ALLOWED_OWNER_KEYS.includes(key))).toBe(true);
        for (const book of snapshot.books) {
            expect(Object.keys(book).filter((key) => !ALLOWED_BOOK_KEYS.includes(key))).toEqual([]);
        }
        for (const theme of snapshot.themes) {
            expect(Object.keys(theme).filter((key) => !ALLOWED_THEME_KEYS.includes(key))).toEqual([]);
        }
        for (const tag of snapshot.tags) {
            expect(Object.keys(tag).filter((key) => !ALLOWED_TAG_KEYS.includes(key))).toEqual([]);
        }
        for (const highlight of snapshot.highlights) {
            expect(Object.keys(highlight).filter((key) => !ALLOWED_HIGHLIGHT_KEYS.includes(key))).toEqual([]);
        }
        expect(snapshot.map).toBeDefined();
        if (snapshot.map !== undefined) {
            expect(Object.keys(snapshot.map).sort()).toEqual(['contours', 'density', 'labels', 'points', 'version']);
            expect(snapshot.map.points).toHaveLength(snapshot.highlights.length);
            expect(snapshot.map.points.every((point) => Object.keys(point).sort().join(',') === 'highlightId,x,y')).toBe(true);
            expect(snapshot.map.labels.every((label) => Object.keys(label).sort().join(',') === 'tagId,x,y')).toBe(true);
            expect(Object.keys(snapshot.map.density).sort()).toEqual(['columns', 'rows', 'values']);
            expect(snapshot.map.contours.every((contour) => Object.keys(contour).sort().join(',') === 'level,segments')).toBe(true);
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
            'confidence',
            'rationale',
            'candidates',
            'familyId',
            'sourceModel',
            'sourceDimensions',
            'projectedDimensions',
            'snapshotHash',
            'tagHash',
            'layoutHash',
            'generatedAt',
            'note',
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
            '/.private/maps/local-layout.json',
            '/.private/curation/development-authorization.json',
            '/../.private/local-snapshot.json',
            '/%2e%2e/.private/local-snapshot.json',
            `/${projectRoot}/.private/local-snapshot.json`,
            `/@fs/${projectRoot}/.private/local-snapshot.json`,
            `/@fs/${projectRoot}/.agents/skills/weread-skills/SKILL.md`,
            '/scripts/weread-request.ps1',
            '/.env',
            // The share card design references the user provided for V2-E4 live under .private too: they are
            // design material, not product assets, and must not be reachable from the app either.
            '/.private/reference/share-cards/README.md',
            `/@fs/${projectRoot}/.private/reference/share-cards/flomo/02-yellow-brand-signature.jpg`,
            '/.private/reference/share-cards/flomo/01-classic-header-date.jpg',
            '/.private/reference/share-cards/weread/01-dark-framed-profile-qr.jpeg',
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

    test('the publication policy cannot be read or written from the ordinary server', async ({ page }) => {
        await page.goto('/');
        await expect(page.getByTestId('stage-passage')).toBeVisible();

        const policyFile = join(process.cwd(), '.private', 'curation', 'publication-policy.json');
        const before = existsSync(policyFile) ? readFileSync(policyFile, 'utf8') : null;

        // Reading it is not a thing this server does at all — and it must not hand out decisions.
        const read = await page.request.get('/__publication_policy');
        const readBody = await read.text();
        expect(readBody.includes('reviewComplete'), 'the policy must not be served here').toBe(false);
        expect(readBody.includes('excludedHighlightIds'), 'the policy must not be served here').toBe(false);

        // Writing is refused, and — the part that matters — the file is untouched either way.
        const write = await page.request.put('/__publication_policy', {
            headers: { Origin: 'http://127.0.0.1:5173', 'Content-Type': 'application/json' },
            data: { schemaVersion: 1, target: { repository: 'x', basePath: '/' }, reviewComplete: true, books: {} },
        });
        expect(write.status(), 'the ordinary server must not accept a policy').not.toBe(200);
        const after = existsSync(policyFile) ? readFileSync(policyFile, 'utf8') : null;
        expect(after, 'the policy file must be exactly as it was').toBe(before);

        // The reviewer document is a project file, so a dev server will serve it — what matters is that the
        // door it needs is not there: opened from the product's own server it must fail honestly instead of
        // showing a working review screen.
        await page.goto('/publication-review.html');
        await expect(page.getByTestId('review-problem')).toBeVisible();
        await expect(page.getByTestId('review')).toHaveCount(0);
        await expect(page.getByTestId('review-problem')).not.toContainText('schemaVersion');

        // And the production bundle has no review entry at all: the A4 isolation gate scans `dist` for it
        // (docs/18 §6.2), because `index.html` is the only build input.
    });

    test('the page says out loud that it is local and not yet public', async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('.local-badge')).toHaveText('仅本机 · 未公开审核');
        // The public mode has no such badge; there the content itself is the reviewed subset (see test:public).
        expect(await page.evaluate(() => document.body.innerText.includes('仅本机'))).toBe(true);
    });

    test('a coloured card asks for nothing but the local cover it samples', async ({ page }) => {
        const requests: string[] = [];
        page.on('request', (request) => {
            requests.push(request.url());
        });
        const data = loadSnapshot();
        const bookId = data.coveredBookId;
        const highlight = bookId === null ? undefined : data.firstOfBook.get(bookId);
        test.skip(highlight === undefined, '需要一本有真实封面的书');
        if (highlight === undefined) {
            return;
        }

        await page.goto(`/?h=${encodeURIComponent(highlight.id)}`);
        await expect(page.getByTestId('stage-passage')).toBeVisible();
        await page.getByTestId('share-open').click();
        await expect(page.getByTestId('share-dialog')).toBeVisible();
        // The surface is derived from the book's own cover, which is the only image involved — and it is
        // served by this machine. A card that needed a remote renderer, a CDN font or an uploader would show
        // up here as a request that leaves the origin.
        await page.getByTestId('share-copy-text').click();
        await expect(page.getByTestId('share-status')).toHaveText(/已复制|自动复制失败，请手动复制/u);

        const origin = new URL(page.url()).origin;
        expect(requests.filter((url) => new URL(url).origin !== origin)).toEqual([]);
        expect(requests.some((url) => url.includes('/__local_cover/'))).toBe(true);
        // Nothing was posted anywhere either: a copy is a local clipboard write, not a card service.
        expect(requests.every((url) => !url.startsWith('data:'))).toBe(true);
    });
});
