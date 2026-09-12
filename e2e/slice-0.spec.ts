import { expect, test } from '@playwright/test';

/**
 * Slice 0 browser acceptance: the real-data path renders, and private material stays out of
 * reachable URLs. Slice 1+ adds the encounter stage, source reveal and exploration flows.
 */
test('renders real authorized data in local development mode', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText("Henry's Reading World")).toBeVisible();
    await expect(page.getByText('仅本机 · 未公开审核')).toBeVisible();

    const heading = page.getByRole('heading', { name: '真实划线数据已就绪' });
    await expect(heading).toBeVisible();

    // Coverage line rendered from the real snapshot, not hard-coded copy.
    await expect(page.getByText(/条划线 · \d+ 本书 · \d+ 个主题 · \d+ 个年份/)).toBeVisible();
    await expect(page.locator('.stage-sample')).toBeVisible();
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
    await expect(page.getByRole('heading', { name: '真实划线数据已就绪' })).toBeVisible();
});
