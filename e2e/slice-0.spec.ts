import { expect, test } from '@playwright/test';

/**
 * Slice 0 browser acceptance: the real-data path renders, and private material stays out of
 * reachable URLs. Slice 1 replaces the status panel with the passage stage, so the assertions here
 * cover the shell plus the isolation guarantees that must never regress.
 */
test('renders real authorized data in local development mode', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: "Henry's Reading World", level: 1 })).toBeVisible();
    await expect(page.getByText('仅本机 · 未公开审核')).toBeVisible();

    // A real passage from the local snapshot reaches the stage; nothing is hard-coded copy.
    const passage = page.getByTestId('stage-passage');
    await expect(passage).toBeVisible();
    expect((await passage.innerText()).trim().length).toBeGreaterThan(0);
    await expect(page.locator('.stage-book')).toContainText('《');
});

test('keeps private files and credentials unreachable over HTTP', async ({ page, request }) => {
    const forbidden = [
        '/.private/local-snapshot.json',
        '/.private/curation/selection.json',
        '/@fs/' + process.cwd().replace(/\\/g, '/') + '/.private/local-snapshot.json',
        '/.agents/skills/weread-skills/SKILL.md',
        '/scripts/weread-request.ps1',
    ];

    for (const path of forbidden) {
        const response = await request.get(path);
        expect(response.status(), `${path} must be denied`).toBe(403);
        const body = await response.text();
        expect(body).not.toContain('WEREAD_API_KEY');
        expect(body).not.toContain('schemaVersion');
    }

    // Names that fall through to the SPA shell must not leak file contents either.
    for (const path of ['/.env', '/@fs/' + process.cwd().replace(/\\/g, '/') + '/.env']) {
        const response = await request.get(path);
        const body = await response.text();
        expect(body, `${path} must not expose file contents`).not.toMatch(/WEREAD_API_KEY|wrk-[A-Za-z0-9]/);
    }

    // The only sanctioned private endpoint is the validated snapshot route.
    const snapshot = await request.get('/__local_snapshot');
    expect(snapshot.status()).toBe(200);
    const payload = (await snapshot.json()) as { visibility: string; highlights: unknown[] };
    expect(payload.visibility).toBe('local-only');
    expect(payload.highlights.length).toBeGreaterThanOrEqual(30);

    const post = await request.post('/__local_snapshot');
    expect(post.status()).toBe(405);

    await page.goto('/');
    await expect(page.getByTestId('stage-passage')).toBeVisible();
});
