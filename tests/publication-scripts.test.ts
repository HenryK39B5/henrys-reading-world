import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
    initialPublicationPolicy,
    setBookDecision,
    toggleHighlightExclusion,
    type PublicationPolicy,
} from '../src/domain/publication.ts';
import type { Snapshot } from '../src/domain/types.ts';

/**
 * The publication scripts (docs/18 §5.2, §6.1).
 *
 * These run the real commands against the real private snapshot, with every writable file redirected into a
 * throwaway directory, and check the properties a person's review depends on: the initialiser never
 * overwrites a decision, the preview writes only under the redirected directory, an excluded book is absent
 * from the projection entirely, and the public snapshot is never touched.
 */
const SNAPSHOT_PATH = join(process.cwd(), '.private/local-snapshot.json');
const hasSnapshot = existsSync(SNAPSHOT_PATH);
const PUBLIC_SNAPSHOT_PATH = join(process.cwd(), 'src/data/public-snapshot.json');

const workDir = mkdtempSync(join(tmpdir(), 'reading-world-publication-'));

afterAll(() => {
    rmSync(workDir, { recursive: true, force: true });
});

function run(script: string, dir: string): string {
    return execFileSync(process.execPath, [join('scripts', script)], {
        env: { ...process.env, READING_WORLD_PUBLICATION_DIR: dir },
        encoding: 'utf8',
    });
}

function snapshot(): Snapshot {
    return JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8')) as Snapshot;
}

function policyPath(dir: string): string {
    return join(dir, 'publication-policy.json');
}

function previewPath(dir: string): string {
    return join(dir, 'publication-preview-snapshot.json');
}

function auditPath(dir: string): string {
    return join(dir, 'publication-audit.json');
}

describe.skipIf(!hasSnapshot)('publication:init', () => {
    it('creates a policy where every real book is unreviewed', () => {
        const dir = join(workDir, 'init');
        mkdirSync(dir, { recursive: true });
        const output = run('publication-init.ts', dir);

        const data = snapshot();
        const policy = JSON.parse(readFileSync(policyPath(dir), 'utf8')) as PublicationPolicy;
        expect(Object.keys(policy.books)).toHaveLength(data.books.length);
        expect(Object.values(policy.books).every((entry) => entry.decision === 'unreviewed')).toBe(true);
        expect(Object.values(policy.books).every((entry) => entry.cover === 'publish')).toBe(true);
        expect(policy.reviewComplete).toBe(false);
        // The terminal reports counts, never content.
        expect(output).toContain(String(data.books.length));
        expect(output).not.toContain(data.books[0]?.title ?? 'x');
    });

    it('never overwrites an existing decision', () => {
        const dir = join(workDir, 'keep');
        mkdirSync(dir, { recursive: true });
        run('publication-init.ts', dir);

        const data = snapshot();
        const first = data.books[0];
        const second = data.books[1];
        expect(first).toBeDefined();
        expect(second).toBeDefined();
        if (first === undefined || second === undefined) {
            return;
        }
        const stored = JSON.parse(readFileSync(policyPath(dir), 'utf8')) as PublicationPolicy;
        const edited = setBookDecision(
            toggleHighlightExclusion(
                setBookDecision(stored, first.id, 'publish'),
                first.id,
                data.highlights.find((highlight) => highlight.bookId === first.id)?.id ?? '',
            ),
            second.id,
            'exclude',
        );
        writeFileSync(policyPath(dir), `${JSON.stringify(edited, null, 2)}\n`, 'utf8');

        const output = run('publication-init.ts', dir);
        const after = JSON.parse(readFileSync(policyPath(dir), 'utf8')) as PublicationPolicy;
        expect(after.books[first.id]?.decision).toBe('publish');
        expect(after.books[first.id]?.excludedHighlightIds).toHaveLength(1);
        expect(after.books[second.id]?.decision).toBe('exclude');
        expect(output).toContain('already in step');
    });
});

describe.skipIf(!hasSnapshot)('publication:preview', () => {
    it('writes nothing publishable when nothing has been decided, and leaves the public snapshot alone', () => {
        const dir = join(workDir, 'empty');
        mkdirSync(dir, { recursive: true });
        run('publication-init.ts', dir);
        const publicBefore = readFileSync(PUBLIC_SNAPSHOT_PATH, 'utf8');

        const output = run('publication-preview.ts', dir);
        const preview = JSON.parse(readFileSync(previewPath(dir), 'utf8')) as Snapshot;
        const audit = JSON.parse(readFileSync(auditPath(dir), 'utf8')) as {
            releaseReady: boolean;
            summary: { published: number; selectedHighlights: number; unreviewed: number };
        };

        expect(preview.books).toEqual([]);
        expect(preview.highlights).toEqual([]);
        expect(preview.themes).toEqual([]);
        // A preview is never a publication, whatever the decisions say.
        expect(preview.visibility).toBe('local-only');
        expect(audit.releaseReady).toBe(false);
        expect(audit.summary.published).toBe(0);
        expect(audit.summary.selectedHighlights).toBe(0);
        expect(audit.summary.unreviewed).toBe(snapshot().books.length);
        expect(output).toContain('releaseReady: false');
        // The one file that must never be written by a preview run.
        expect(readFileSync(PUBLIC_SNAPSHOT_PATH, 'utf8')).toBe(publicBefore);
    });

    it('keeps an excluded book out of the projection entirely', () => {
        const dir = join(workDir, 'exclude');
        mkdirSync(dir, { recursive: true });
        run('publication-init.ts', dir);

        const data = snapshot();
        const keep = data.books[2];
        const drop = data.books[3];
        expect(keep).toBeDefined();
        expect(drop).toBeDefined();
        if (keep === undefined || drop === undefined) {
            return;
        }
        const stored = JSON.parse(readFileSync(policyPath(dir), 'utf8')) as PublicationPolicy;
        const edited = setBookDecision(setBookDecision(stored, keep.id, 'publish'), drop.id, 'exclude');
        writeFileSync(policyPath(dir), `${JSON.stringify(edited, null, 2)}\n`, 'utf8');

        run('publication-preview.ts', dir);
        const preview = JSON.parse(readFileSync(previewPath(dir), 'utf8')) as Snapshot;
        const audit = JSON.parse(readFileSync(auditPath(dir), 'utf8')) as {
            excludedBooks: string[];
            longHighlights: { id: string; bookId: string; length: number }[];
            themesKept: string[];
        };

        expect(preview.books.map((book) => book.id)).toEqual([keep.id]);
        expect(preview.highlights.every((highlight) => highlight.bookId === keep.id)).toBe(true);
        expect(preview.highlights).toHaveLength(data.highlights.filter((item) => item.bookId === keep.id).length);
        // Not merely hidden in the UI: the title and the passages are absent from the file.
        expect(JSON.stringify(preview)).not.toContain(drop.title);
        expect(audit.excludedBooks).toContain(drop.id);
        // The audit reports ids, counts and lengths; it never carries the passages themselves.
        expect(audit.longHighlights.every((entry) => typeof entry.length === 'number')).toBe(true);
        const firstText = preview.highlights[0]?.text ?? 'x';
        expect(JSON.stringify(audit)).not.toContain(firstText);
        // A shelf nobody publishes on any more is not carried over.
        expect(audit.themesKept.every((themeId) => typeof themeId === 'string')).toBe(true);
    });

    it('refuses to run without a policy instead of inventing one', () => {
        const dir = join(workDir, 'no-policy');
        mkdirSync(dir, { recursive: true });
        expect(() => run('publication-preview.ts', dir)).toThrow();
        expect(existsSync(previewPath(dir))).toBe(false);
    });

    it('stops rather than repairing a policy that does not validate', () => {
        const dir = join(workDir, 'broken');
        mkdirSync(dir, { recursive: true });
        run('publication-init.ts', dir);
        const broken = { ...initialPublicationPolicy(snapshot()), target: { repository: 'other', basePath: '/' } };
        writeFileSync(policyPath(dir), `${JSON.stringify(broken, null, 2)}\n`, 'utf8');
        const before = readFileSync(policyPath(dir), 'utf8');

        expect(() => run('publication-preview.ts', dir)).toThrow();
        expect(readFileSync(policyPath(dir), 'utf8'), 'a broken policy is reported, not rewritten').toBe(before);
        expect(existsSync(previewPath(dir))).toBe(false);
    });
});
