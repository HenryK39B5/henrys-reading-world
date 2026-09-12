import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { StatusPanel } from '../src/app/StatusPanel.tsx';
import { loadSnapshot } from '../src/app/snapshotSource.ts';

/**
 * Real-data smoke check for the local development path.
 *
 * Skips when .private/local-snapshot.json is absent (for example in a public-only checkout).
 * Passages are asserted, never printed.
 */
const SNAPSHOT_PATH = join(process.cwd(), '.private/local-snapshot.json');
const hasLocalSnapshot = existsSync(SNAPSHOT_PATH);

function fileFetcher(body: unknown) {
    return () =>
        Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(body),
        });
}

describe.skipIf(!hasLocalSnapshot)('local snapshot smoke', () => {
    it('loads real authorized data and renders the first real passage', async () => {
        const parsed: unknown = JSON.parse(await readFile(SNAPSHOT_PATH, 'utf8'));
        const result = await loadSnapshot('local', fileFetcher(parsed));

        expect(result.status).toBe('ready');
        if (result.status !== 'ready') {
            return;
        }
        expect(result.snapshot.visibility).toBe('local-only');
        expect(result.snapshot.highlights.length).toBeGreaterThanOrEqual(30);

        const html = renderToStaticMarkup(<StatusPanel state={result} />);
        const first = result.snapshot.highlights[0];
        expect(first).toBeDefined();
        if (first === undefined) {
            return;
        }
        expect(html).toContain(first.text.replaceAll('&', '&amp;'));
        expect(html).toContain('真实划线数据已就绪');
    });

    it('keeps source identifiers and raw capture fields out of the payload', async () => {
        const raw = await readFile(SNAPSHOT_PATH, 'utf8');
        for (const forbidden of ['planIndex', 'sourceBookId', 'bookmarkId', 'userVid', 'deepLink', 'secret']) {
            expect(raw).not.toContain(forbidden);
        }
    });
});
