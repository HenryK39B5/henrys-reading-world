import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { initialPublicationPolicy, setBookDecision } from '../../src/domain/publication.ts';
import type { Snapshot } from '../../src/domain/types.ts';

/**
 * The local publication reviewer (docs/17 §5, docs/18 §5.3).
 *
 * This spec talks to the real private snapshot through the review server, so it checks the properties that
 * matter: every real book is listed, nothing is published until it is decided, a decision survives a save
 * and a reload, a single passage can be excluded from a book that stays published, the review cannot be
 * declared finished while books are undecided, and only a same-origin page on this port may rewrite the
 * policy.
 *
 * Every test writes its own baseline policy, so the file never depends on what a previous test did —
 * and it writes to `.private/review/release-a/test-policy/` (the webServer env in
 * playwright.publication.config.ts), never over the decisions a person is making.
 */
const SNAPSHOT_PATH = join(process.cwd(), '.private/local-snapshot.json');
const hasSnapshot = existsSync(SNAPSHOT_PATH);
const POLICY_DIR = join(process.cwd(), '.private/review/release-a/test-policy');
const POLICY_PATH = join(POLICY_DIR, 'publication-policy.json');

function loadSnapshot(): Snapshot {
    return JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8')) as Snapshot;
}

/** A baseline policy: everything unreviewed, plus the books the caller wants decided. */
function writeBaseline(publishIds: string[] = [], excludeIds: string[] = []): Snapshot {
    const snapshot = loadSnapshot();
    let policy = initialPublicationPolicy(snapshot);
    for (const id of publishIds) {
        policy = setBookDecision(policy, id, 'publish');
    }
    for (const id of excludeIds) {
        policy = setBookDecision(policy, id, 'exclude');
    }
    mkdirSync(POLICY_DIR, { recursive: true });
    writeFileSync(POLICY_PATH, `${JSON.stringify(policy, null, 2)}\n`, 'utf8');
    return snapshot;
}

function readPolicy(): { books: Record<string, { decision: string; cover: string; excludedHighlightIds: string[] }> } {
    return JSON.parse(readFileSync(POLICY_PATH, 'utf8')) as {
        books: Record<string, { decision: string; cover: string; excludedHighlightIds: string[] }>;
    };
}

async function openReview(page: Page): Promise<void> {
    await page.goto('/publication-review.html');
    await expect(page.getByTestId('review')).toBeVisible();
}

/** Saves and waits for the server's answer, so no test depends on a fire-and-forget write. */
async function save(page: Page): Promise<void> {
    await page.getByTestId('save-policy').click();
    await expect(page.getByTestId('review-notice')).toContainText('已保存');
    await expect(page.getByTestId('dirty-state')).toHaveText('已保存');
}

test.beforeAll(() => {
    rmSync(POLICY_DIR, { recursive: true, force: true });
});

test.afterAll(() => {
    rmSync(POLICY_DIR, { recursive: true, force: true });
});

test.describe('the reviewer lists the real library and publishes nothing by default', () => {
    test.skip(!hasSnapshot, '需要 .private/local-snapshot.json 才能核对真实内容');

    test('starts with every real book undecided and nothing publishable', async ({ page }) => {
        rmSync(POLICY_DIR, { recursive: true, force: true });
        const snapshot = loadSnapshot();
        await openReview(page);

        await expect(page.getByTestId('summary-reviewed')).toHaveText(`0 / ${String(snapshot.books.length)}`);
        await expect(page.getByTestId('summary-unreviewed')).toHaveText(String(snapshot.books.length));
        await expect(page.getByTestId('summary-published')).toHaveText('0');
        await expect(page.getByTestId('summary-selected')).toContainText('0 条');
        await expect(page.getByTestId('review-readiness')).toContainText('releaseReady: false');
        await expect(page.getByTestId('review-row-count')).toHaveText(`显示 ${String(snapshot.books.length)} 本`);
        // The screen says out loud that nothing has been written yet.
        await expect(page.getByTestId('review-notice')).toContainText('还没有发布清单');
        await expect(page.getByTestId('dirty-state')).toHaveText('有未保存的修改');
    });

    test('shows one real book with its real counts and its real passages', async ({ page }) => {
        const snapshot = writeBaseline();
        const book = snapshot.books[0];
        expect(book).toBeDefined();
        if (book === undefined) {
            return;
        }
        const count = snapshot.highlights.filter((highlight) => highlight.bookId === book.id).length;

        await openReview(page);
        await page.getByTestId('review-search').fill(book.title);
        await expect(page.getByTestId(`review-book-${book.id}`)).toContainText(`${String(count)} 条`);

        await page.getByTestId(`expand-${book.id}`).click();
        const passages = page.getByTestId(`passages-${book.id}`).locator('li');
        await expect(passages).toHaveCount(count);
        // Stable ids, so an exclusion points at one passage and survives a re-export.
        await expect(passages.first()).toContainText(/h-\d{3,}/u);
    });
});

test.describe('decisions are saved and restored', () => {
    test.skip(!hasSnapshot, '需要 .private/local-snapshot.json 才能核对真实内容');

    test('publishes one book, saves it, and finds it again after a reload', async ({ page }) => {
        const snapshot = writeBaseline();
        const target = snapshot.books[0];
        expect(target).toBeDefined();
        if (target === undefined) {
            return;
        }
        const count = snapshot.highlights.filter((highlight) => highlight.bookId === target.id).length;

        await openReview(page);
        await page.getByTestId('review-search').fill(target.title);
        await page.getByTestId(`decide-publish-${target.id}`).click();
        await expect(page.getByTestId('summary-published')).toHaveText('1');
        await expect(page.getByTestId(`review-book-${target.id}`)).toHaveAttribute('data-decision', 'publish');
        await expect(page.getByTestId('summary-reviewed')).toHaveText(`1 / ${String(snapshot.books.length)}`);
        // The projection counts only the real passages of that book.
        await expect(page.getByTestId('summary-selected')).toContainText(`${String(count)} 条`);

        await save(page);
        expect(existsSync(POLICY_PATH), 'the reviewer wrote the policy file').toBe(true);
        expect(readPolicy().books[target.id]?.decision).toBe('publish');

        await page.reload();
        await expect(page.getByTestId('review')).toBeVisible();
        await page.getByTestId('review-search').fill(target.title);
        await expect(page.getByTestId(`review-book-${target.id}`)).toHaveAttribute('data-decision', 'publish');
        await expect(page.getByTestId('summary-published')).toHaveText('1');
        await expect(page.getByTestId('dirty-state')).toHaveText('已保存');
    });

    test('excludes one passage while the book stays published', async ({ page }) => {
        const snapshot = loadSnapshot();
        const book = snapshot.books[0];
        expect(book).toBeDefined();
        if (book === undefined) {
            return;
        }
        writeBaseline([book.id]);
        const passages = snapshot.highlights.filter((highlight) => highlight.bookId === book.id);
        const target = passages[0];
        expect(target).toBeDefined();
        if (target === undefined) {
            return;
        }

        await openReview(page);
        await page.getByTestId('review-search').fill(book.title);
        await expect(page.getByTestId(`review-book-${book.id}`)).toHaveAttribute('data-decision', 'publish');
        await page.getByTestId(`expand-${book.id}`).click();

        await page.getByTestId(`exclude-${target.id}`).check();
        await expect(page.getByTestId('summary-excluded-highlights')).toHaveText('1');
        await expect(page.getByTestId('summary-selected')).toContainText(`${String(passages.length - 1)} 条`);
        // The book itself is still published: an exclusion is not a rejection of the whole book.
        await expect(page.getByTestId(`review-book-${book.id}`)).toHaveAttribute('data-decision', 'publish');
        // The excluded line stays visible to the reviewer — marked, not hidden.
        const row = page
            .getByTestId(`passages-${book.id}`)
            .locator(`li:has([data-testid="exclude-${target.id}"])`);
        await expect(row).toHaveAttribute('data-excluded', 'true');

        await save(page);
        expect(readPolicy().books[book.id]?.excludedHighlightIds).toEqual([target.id]);

        await page.reload();
        await page.getByTestId('review-search').fill(book.title);
        await expect(page.getByTestId(`review-book-${book.id}`)).toHaveAttribute('data-decision', 'publish');
        await expect(page.getByTestId('summary-excluded-highlights')).toHaveText('1');
    });

    test('turning a cover off keeps the book and drops only its cover', async ({ page }) => {
        writeBaseline([loadSnapshot().books[0]?.id ?? '']);
        await openReview(page);

        // A book that really has a local cover, found through the reviewer's own numbers.
        const covered = await page.evaluate(() => {
            const row = [...document.querySelectorAll('[data-testid^="review-book-"]')].find((element) =>
                (element.textContent ?? '').includes('有封面'),
            );
            return row?.getAttribute('data-testid')?.replace('review-book-', '') ?? null;
        });
        test.skip(covered === null, 'this snapshot has no covered book');
        if (covered === null) {
            return;
        }

        await page.getByTestId(`decide-publish-${covered}`).click();
        const coverBox = page.getByTestId(`cover-${covered}`);
        await expect(coverBox).toBeChecked();
        await coverBox.uncheck();
        await save(page);

        expect(readPolicy().books[covered]?.cover).toBe('exclude');
        // The book's own decision is untouched: a cover is a separate question from the book.
        expect(readPolicy().books[covered]?.decision).toBe('publish');

        await page.reload();
        await expect(page.getByTestId(`cover-${covered}`)).not.toBeChecked();
        await expect(page.getByTestId(`review-book-${covered}`)).toHaveAttribute('data-decision', 'publish');
    });

    test('refuses to declare the review complete while books are undecided', async ({ page }) => {
        writeBaseline([loadSnapshot().books[0]?.id ?? '']);
        await openReview(page);

        await expect(page.getByTestId('review-complete')).not.toBeChecked();
        // `click`, not `check`: the screen is supposed to refuse, so the box must stay as it was.
        await page.getByTestId('review-complete').click();
        await expect(page.getByTestId('review-notice')).toContainText('未审核');
        await expect(page.getByTestId('review-complete')).not.toBeChecked();
        await expect(page.getByTestId('review-readiness')).toContainText('未审核');
        expect(readPolicy().books[loadSnapshot().books[0]?.id ?? '']?.decision).toBe('publish');
    });
});

test.describe('the reviewer is a tool, not a page of the product', () => {
    test.skip(!hasSnapshot, '需要 .private/local-snapshot.json 才能核对真实内容');

    test('the product document never links to it and it is not part of the app', async ({ page }) => {
        writeBaseline();
        await page.goto('/');
        await expect(page.getByTestId('stage-passage')).toBeVisible();
        const html = await page.content();
        expect(html).not.toContain('publication-review');
        expect(html).not.toContain('__publication_policy');
    });

    test('serves the policy to a same-origin reviewer and refuses other shapes of request', async ({ page }) => {
        writeBaseline([loadSnapshot().books[0]?.id ?? '']);
        await openReview(page);

        const read = await page.evaluate(async () => {
            const response = await fetch('/__publication_policy', { cache: 'no-store' });
            return { status: response.status, type: response.headers.get('content-type') ?? '' };
        });
        expect(read.status).toBe(200);
        expect(read.type).toContain('application/json');

        // The route takes a whole policy or nothing: there is no per-book or per-file variant.
        const method = await page.evaluate(async () => {
            const response = await fetch('/__publication_policy', { method: 'DELETE' });
            return response.status;
        });
        expect(method).toBe(405);

        const wrongType = await page.evaluate(async () => {
            const response = await fetch('/__publication_policy', {
                method: 'PUT',
                headers: { 'Content-Type': 'text/plain' },
                body: '{}',
            });
            return response.status;
        });
        expect(wrongType).toBe(415);

        const foreignTarget = await page.evaluate(async () => {
            const response = await fetch('/__publication_policy', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    schemaVersion: 1,
                    target: { repository: 'other', basePath: '/' },
                    reviewComplete: false,
                    books: {},
                }),
            });
            return response.status;
        });
        expect(foreignTarget, 'a policy for another project must be refused').toBe(422);
        // And nothing was written by any of the refused requests.
        expect(readPolicy().books[loadSnapshot().books[0]?.id ?? '']?.decision).toBe('publish');
    });

    test('a request from another origin cannot rewrite the policy', async ({ page, request }) => {
        writeBaseline([loadSnapshot().books[0]?.id ?? '']);
        await openReview(page);
        const before = readFileSync(POLICY_PATH, 'utf8');

        // A forged Origin, as a page on another site would send it: the server must refuse the write.
        const forged = await request.put('/__publication_policy', {
            headers: { Origin: 'https://example.invalid', 'Content-Type': 'application/json' },
            data: {
                schemaVersion: 1,
                target: { repository: 'henrys-reading-world', basePath: '/henrys-reading-world/' },
                reviewComplete: false,
                books: {},
            },
        });
        expect(forged.status(), 'a foreign origin must be refused').toBe(403);
        expect(readFileSync(POLICY_PATH, 'utf8'), 'the file must be untouched').toBe(before);
    });
});
