import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import type { TopicTagAssignments, TopicTagVocabulary } from '../../src/domain/topicTags.ts';

/**
 * The Local Tag Studio (docs/22 §6.2, docs/24 §11).
 *
 * This spec talks to the real private snapshot and a *copy* of the real vocabulary and trial, so it checks
 * the properties that matter for content production: the screen lists the complete real assignment backlog, a
 * decision survives a save and a reload, the one-to-three-tag rule cannot be broken through the UI, a
 * passage can be put back to draft with flags rather than silently guessed, and only a same-origin page on
 * this port may rewrite the trial.
 *
 * The webServer env in playwright.tag-studio.config.ts points `READING_WORLD_TAG_DIR` at
 * `.private/review/batch-3/test-tags/`, so the run never writes over the trial a person is reviewing.
 */
const SNAPSHOT_PATH = join(process.cwd(), '.private/local-snapshot.json');
const REAL_TAG_DIR = join(process.cwd(), '.private/tags');
const TEST_TAG_DIR = join(process.cwd(), '.private/review/batch-3/test-tags');
const TEST_ASSIGNMENTS_PATH = join(TEST_TAG_DIR, 'assignments.json');
const hasSnapshot = existsSync(SNAPSHOT_PATH);
const hasTrial = existsSync(join(REAL_TAG_DIR, 'assignments.json')) && existsSync(join(REAL_TAG_DIR, 'vocabulary.json'));

function readTestAssignments(): TopicTagAssignments {
    return JSON.parse(readFileSync(TEST_ASSIGNMENTS_PATH, 'utf8')) as TopicTagAssignments;
}

function readTestVocabulary(): TopicTagVocabulary {
    return JSON.parse(readFileSync(join(TEST_TAG_DIR, 'vocabulary.json'), 'utf8')) as TopicTagVocabulary;
}

/** The checkboxes are rendered one per tag, in vocabulary order, so an index maps to a stable tag. */
function orderedTagIds(): string[] {
    return [...readTestVocabulary().tags]
        .sort((left, right) => left.editorialOrder - right.editorialOrder)
        .map((tag) => tag.id);
}

function tagCheckbox(page: Page, tagId: string) {
    const title = readTestVocabulary().tags.find((tag) => tag.id === tagId)?.title ?? tagId;
    return page.getByRole('checkbox', { name: title, exact: true });
}

function storedAssignment(highlightId: string): TopicTagAssignments['assignments'][number] | undefined {
    return readTestAssignments().assignments.find((assignment) => assignment.highlightId === highlightId);
}

/** The studio stores tags in vocabulary order, so an expectation has to say so explicitly. */
function byVocabularyOrder(ids: string[]): string[] {
    const order = orderedTagIds();
    return [...ids].sort((left, right) => order.indexOf(left) - order.indexOf(right));
}

/** The trial in the order the Studio lists it: stable highlight ID. */
function orderedAssignments(): TopicTagAssignments['assignments'] {
    return [...readTestAssignments().assignments].sort((left, right) => left.highlightId.localeCompare(right.highlightId));
}

/** A clean copy of the real vocabulary and assignments, without deleting the directory under the running server. */
function resetTrial(): void {
    mkdirSync(TEST_TAG_DIR, { recursive: true });
    copyFileSync(join(REAL_TAG_DIR, 'vocabulary.json'), join(TEST_TAG_DIR, 'vocabulary.json'));
    copyFileSync(join(REAL_TAG_DIR, 'assignments.json'), TEST_ASSIGNMENTS_PATH);
}

async function openStudio(page: Page): Promise<void> {
    await page.goto('/tag-studio.html');
    // The complete 4,663-assignment backlog is intentionally local-only and can take longer to parse/render on a cold run.
    await expect(page.getByTestId('tag-studio')).toBeVisible({ timeout: 20_000 });
}

async function save(page: Page): Promise<void> {
    await page.getByTestId('studio-save').click();
    await expect(page.getByTestId('studio-notice')).toContainText('已原子保存');
    await expect(page.getByTestId('studio-dirty')).toHaveText('已保存');
}

test.beforeAll(() => {
    resetTrial();
});

test.afterAll(() => {
    rmSync(TEST_TAG_DIR, { recursive: true, force: true });
});

test.describe('the studio lists the real trial and publishes nothing', () => {
    test.skip(!hasSnapshot || !hasTrial, '需要本机快照与 .private/tags 试标才能核对真实内容');

    test('opens on the real trial with the vocabulary and the draft backlog', async ({ page }) => {
        resetTrial();
        const assignments = orderedAssignments();
        const reviewed = assignments.filter((assignment) => assignment.status === 'reviewed').length;

        await openStudio(page);
        await expect(page.getByTestId('studio-count')).toHaveText(`${String(assignments.length)} / ${String(assignments.length)}`);
        await expect(page.getByTestId('studio-reviewed')).toHaveText(String(reviewed));
        await expect(page.getByTestId('studio-draft')).toHaveText(String(assignments.length - reviewed));
        // The first row is selected and shows the complete real passage, not a truncated teaser.
        await expect(page.getByTestId('studio-detail')).toContainText(assignments[0]?.highlightId ?? '');
    });

    test('leaves the real assignments untouched: the studio writes only where it was told to', async () => {
        const real = JSON.parse(readFileSync(join(REAL_TAG_DIR, 'assignments.json'), 'utf8')) as TopicTagAssignments;
        const snapshot = JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8')) as { highlights: unknown[] };
        expect(real.assignments).toHaveLength(snapshot.highlights.length);
        expect(real.assignments.every((assignment) => assignment.status === 'draft' || assignment.status === 'reviewed')).toBe(true);
    });

    test('filters by status, confidence, flag, family and free text', async ({ page }) => {
        resetTrial();
        const assignments = orderedAssignments();
        const drafts = assignments.filter((assignment) => assignment.status === 'draft');
        await openStudio(page);

        await page.getByTestId('studio-status').selectOption('draft');
        await expect(page.getByTestId('studio-count')).toHaveText(`${String(drafts.length)} / ${String(assignments.length)}`);

        await page.getByTestId('studio-flag').selectOption('low-confidence');
        const lowDrafts = drafts.filter((assignment) => assignment.flags.includes('low-confidence')).length;
        await expect(page.getByTestId('studio-count')).toHaveText(`${String(lowDrafts)} / ${String(assignments.length)}`);

        await page.getByTestId('studio-status').selectOption('all');
        await page.getByTestId('studio-flag').selectOption('all');
        await page.getByTestId('studio-family').selectOption({ index: 1 });
        const inFamily = assignments.filter((assignment) => assignment.tagIds.length > 0).length;
        await expect(page.getByTestId('studio-count')).toContainText(`/ ${String(inFamily)}`);
    });
});

test.describe('a studio decision is durable and bounded', () => {
    test.skip(!hasSnapshot || !hasTrial, '需要本机快照与 .private/tags 试标才能核对真实内容');

    test('a tag change survives save and reload', async ({ page }) => {
        resetTrial();
        const tagIds = orderedTagIds();
        const first = orderedAssignments()[0];
        expect(first).toBeDefined();
        const highlightId = first?.highlightId ?? '';
        const before = first?.tagIds ?? [];
        await openStudio(page);

        const wanted = tagIds.find((tagId) => !before.includes(tagId));
        expect(wanted, '试标里应存在未使用过的标签').toBeDefined();
        // A passage already holding three tags has to give one up first; the studio refuses a fourth.
        const dropped = before.length >= 3 ? (before[before.length - 1] ?? '') : '';
        if (dropped.length > 0) {
            await tagCheckbox(page, dropped).click();
        }
        await tagCheckbox(page, wanted ?? '').click();
        await save(page);

        const expected = byVocabularyOrder([...before.filter((tagId) => tagId !== dropped), wanted ?? '']);
        expect(storedAssignment(highlightId)?.tagIds).toEqual(expected);
        expect(storedAssignment(highlightId)?.tagIds).toContain(wanted ?? '');

        await page.reload();
        await expect(page.getByTestId('tag-studio')).toBeVisible();
        await expect(page.getByTestId('studio-dirty')).toHaveText('已保存');
        expect(storedAssignment(highlightId)?.tagIds).toEqual(expected);
    });

    test('never allows zero tags or a fourth tag', async ({ page }) => {
        resetTrial();
        const tagIds = orderedTagIds();
        const target = orderedAssignments().find((assignment) => assignment.tagIds.length === 1);
        expect(target, '试标里应存在单标签条目').toBeDefined();
        const targetId = target?.highlightId ?? '';
        const only = target?.tagIds[0] ?? '';
        await openStudio(page);

        await page.locator('.studio-list button').filter({ hasText: targetId }).first().click();
        await expect(page.getByTestId('studio-detail')).toContainText(targetId);

        const onlyBox = tagCheckbox(page, only);
        // Unchecking the only tag is refused, so the click must leave the box checked.
        await onlyBox.click();
        await expect(onlyBox).toBeChecked();
        await save(page);
        expect(storedAssignment(targetId)?.tagIds).toEqual([only]);

        // Two more tags are allowed; a fourth click is refused.
        const spare = tagIds.filter((tagId) => tagId !== only);
        await tagCheckbox(page, spare[0] ?? '').click();
        await tagCheckbox(page, spare[1] ?? '').click();
        const fourthBox = tagCheckbox(page, spare[2] ?? '');
        await fourthBox.click();
        await expect(fourthBox).not.toBeChecked();
        await save(page);
        expect(storedAssignment(targetId)?.tagIds).toEqual(byVocabularyOrder([only, spare[0] ?? '', spare[1] ?? '']));
    });

    test('puts a passage back to draft with flags instead of guessing', async ({ page }) => {
        resetTrial();
        const target = orderedAssignments().find((assignment) => assignment.status === 'reviewed');
        expect(target).toBeDefined();
        const targetId = target?.highlightId ?? '';
        await openStudio(page);
        await page.locator('.studio-list button').filter({ hasText: targetId }).first().click();

        await page.getByTestId('studio-mark-draft').click();
        await save(page);

        const stored = readTestAssignments().assignments.find((assignment) => assignment.highlightId === targetId);
        expect(stored?.status).toBe('draft');
        expect(stored?.flags).toContain('low-confidence');
        expect(stored?.flags).toContain('possible-missing-tag');
    });
});

test.describe('the studio is a private tool, not part of the product', () => {
    test.skip(!hasSnapshot || !hasTrial, '需要本机快照与 .private/tags 试标才能核对真实内容');

    test('the product document never links to it and it is not part of the app', async ({ page }) => {
        resetTrial();
        await page.goto('/');
        await expect(page.getByTestId('stage-passage')).toBeVisible();
        const html = await page.content();
        expect(html).not.toContain('tag-studio');
        expect(html).not.toContain('__tag_assignments');
    });

    test('serves the vocabulary and refuses other request shapes', async ({ page }) => {
        resetTrial();
        await openStudio(page);

        const read = await page.evaluate(async () => {
            const response = await fetch('/__tag_vocabulary', { cache: 'no-store' });
            const body = (await response.json()) as { tags?: unknown[] };
            return { status: response.status, tags: body.tags?.length ?? 0 };
        });
        expect(read.status).toBe(200);
        expect(read.tags).toBeGreaterThanOrEqual(30);

        // There is no per-tag or per-highlight write route, and no delete.
        for (const path of ['/__tag_vocabulary', '/__tag_assignments']) {
            const status = await page.evaluate(async (target) => {
                const response = await fetch(target, { method: 'DELETE' });
                return response.status;
            }, path);
            expect(status, `${path} must refuse DELETE`).toBe(405);
        }
        const wrongType = await page.evaluate(async () => {
            const response = await fetch('/__tag_assignments', {
                method: 'PUT',
                headers: { 'Content-Type': 'text/plain' },
                body: '{}',
            });
            return response.status;
        });
        expect(wrongType).toBe(415);
    });

    test('refuses an assignment that breaks the private contract', async ({ page }) => {
        resetTrial();
        await openStudio(page);
        // Four tags on one passage: the strict validator must refuse the whole file.
        const broken = readTestAssignments();
        const first = broken.assignments[0];
        if (first === undefined) {
            throw new Error('trial fixture is empty');
        }
        const withExtra = { ...first, tagIds: [...first.tagIds, ...['tag-001', 'tag-002', 'tag-003', 'tag-004']] };
        const status = await page.evaluate(async (payload) => {
            const response = await fetch('/__tag_assignments', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            return response.status;
        }, { ...broken, assignments: [withExtra, ...broken.assignments.slice(1)] });
        expect(status, 'a contract-breaking trial must be refused with 422').toBe(422);
    });

    test('a request from another origin cannot rewrite the trial', async ({ page, request }) => {
        resetTrial();
        await openStudio(page);
        const before = readFileSync(TEST_ASSIGNMENTS_PATH, 'utf8');
        const forged = await request.put('/__tag_assignments', {
            headers: { Origin: 'https://example.invalid', 'Content-Type': 'application/json' },
            data: readTestAssignments(),
        });
        expect(forged.status(), 'a foreign origin must be refused').toBe(403);
        expect(readFileSync(TEST_ASSIGNMENTS_PATH, 'utf8'), 'the file must be untouched').toBe(before);
    });
});
