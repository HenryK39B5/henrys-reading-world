import { expect, test } from '@playwright/test';
import { hasSnapshot, loadSnapshot } from './support/snapshot.ts';

test.describe('V3 topic paths', () => {
    test.skip(!hasSnapshot, '需要 schema 3 local snapshot 才能核对真实主题小径');

    test('lists every reviewed path with real counts and opens a finite round', async ({ page }) => {
        const data = loadSnapshot();
        const tag = data.tags.find((candidate) =>
            data.highlights.some((highlight) => highlight.tagIds.includes(candidate.id)),
        );
        expect(tag).toBeTruthy();
        if (tag === undefined) return;

        const candidates = data.highlights.filter((highlight) => highlight.tagIds.includes(tag.id));
        const books = new Set(candidates.map((highlight) => highlight.bookId));

        await page.goto('/paths');
        await expect(page.getByTestId('room-heading')).toHaveText('主题小径');
        await expect(page.getByTestId('path-list').locator('li')).toHaveCount(56);
        const link = page.locator(`a[href="/paths/${tag.id}"]`).first();
        await expect(link).toContainText(tag.title);
        await expect(link).toContainText(`${String(books.size)} 本书 · ${String(candidates.length)} 处划线`);
        await link.click();

        await expect(page).toHaveURL(new RegExp(`/paths/${tag.id}$`, 'u'));
        await expect(page.getByTestId('room-heading')).toHaveText(tag.title);
        const passage = (await page.getByTestId('path-passage').innerText()).trim();
        expect(candidates.some((highlight) => highlight.text.trim() === passage)).toBe(true);
        await expect(page.getByTestId('path-progress')).toContainText(`/ ${String(candidates.length)} 处`);
    });

    test('keeps the intersection while branching, then Back restores the original path scene', async ({ page }) => {
        test.setTimeout(90_000);
        const data = loadSnapshot();
        const countByTag = new Map(
            data.tags.map((tag) => [
                tag.id,
                data.highlights.filter((highlight) => highlight.tagIds.includes(tag.id)).length,
            ]),
        );
        const intersection = data.highlights.find(
            (highlight) =>
                highlight.tagIds.length >= 2 &&
                highlight.tagIds.every((tagId) => (countByTag.get(tagId) ?? 0) >= 2),
        );
        expect(intersection).toBeTruthy();
        if (intersection === undefined) return;
        const fromTag = intersection.tagIds[0];
        const toTag = intersection.tagIds[1];
        expect(fromTag).toBeTruthy();
        expect(toTag).toBeTruthy();
        if (fromTag === undefined || toTag === undefined) return;

        await page.goto(`/paths/${fromTag}`);
        const total = countByTag.get(fromTag) ?? 0;
        for (let step = 0; step < total; step += 1) {
            const current = (await page.getByTestId('path-passage').innerText()).trim();
            if (current === intersection.text.trim()) break;
            await page.getByTestId('path-next').click();
        }
        await expect(page.getByTestId('path-passage')).toHaveText(intersection.text.trim());

        await page.getByTestId(`topic-clue-${toTag}`).click();
        await expect(page).toHaveURL(new RegExp(`/paths/${toTag}$`, 'u'));
        await expect(page.getByTestId('path-passage')).toHaveText(intersection.text.trim());
        await expect(page.getByTestId(`topic-clue-${toTag}`)).toHaveAttribute('aria-current', 'page');

        await page.getByTestId('path-next').click();
        await expect(page.getByTestId('path-passage')).not.toHaveText(intersection.text.trim());
        await page.goBack();
        await expect(page).toHaveURL(new RegExp(`/paths/${fromTag}$`, 'u'));
        await expect(page.getByTestId('path-passage')).toHaveText(intersection.text.trim());
    });

    test('shows every current clue in the room and share card without +N truncation', async ({ page }) => {
        const data = loadSnapshot();
        const highlight = data.highlights.find((entry) => entry.tagIds.length === 3);
        expect(highlight).toBeTruthy();
        if (highlight === undefined) return;
        const tagId = highlight.tagIds[0];
        expect(tagId).toBeTruthy();
        if (tagId === undefined) return;

        await page.goto(`/paths/${tagId}`);
        const total = data.highlights.filter((entry) => entry.tagIds.includes(tagId)).length;
        for (let step = 0; step < total; step += 1) {
            const current = (await page.getByTestId('path-passage').innerText()).trim();
            if (current === highlight.text.trim()) break;
            await page.getByTestId('path-next').click();
        }
        await expect(page.getByTestId('path-passage')).toHaveText(highlight.text.trim());
        const titles = highlight.tagIds.map((id) => data.tags.find((tag) => tag.id === id)?.title ?? '');
        await expect(page.getByTestId('topic-clues')).toContainText(titles.map((title) => `#${title}`).join(''));

        await page.getByRole('button', { name: '分享' }).click();
        const cardTags = page.getByTestId('share-card-tags');
        for (const title of titles) {
            await expect(cardTags).toContainText(`#${title}`);
        }
        await expect(cardTags).not.toContainText('+');
    });
});
