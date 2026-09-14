/**
 * Where the private publication files live (docs/17 §4.1, §6).
 *
 * One module decides the paths, so the reviewer UI, the init script, the preview script and the privacy
 * tests cannot disagree about which file is being talked about. Every default path is inside `.private/`,
 * which is untracked and unreachable over HTTP.
 *
 * `READING_WORLD_PUBLICATION_DIR` redirects all three writable files at once. It exists for one reason:
 * the automated reviewer tests must never save over the decisions a person is making. It is an environment
 * variable of the process that starts the server or script — never a request parameter, so no page and no
 * URL can choose which file is written.
 */
import { join } from 'node:path';

export const LOCAL_SNAPSHOT_FILE = join('.private', 'local-snapshot.json');
export const DEFAULT_POLICY_FILE = join('.private', 'curation', 'publication-policy.json');
export const DEFAULT_PREVIEW_FILE = join('.private', 'publication-preview-snapshot.json');
export const DEFAULT_AUDIT_FILE = join('.private', 'publication-audit.json');

export type PublicationPaths = {
    policy: string;
    preview: string;
    audit: string;
};

export function publicationPaths(): PublicationPaths {
    const override = process.env.READING_WORLD_PUBLICATION_DIR;
    if (override !== undefined && override.length > 0) {
        return {
            policy: join(override, 'publication-policy.json'),
            preview: join(override, 'publication-preview-snapshot.json'),
            audit: join(override, 'publication-audit.json'),
        };
    }
    return { policy: DEFAULT_POLICY_FILE, preview: DEFAULT_PREVIEW_FILE, audit: DEFAULT_AUDIT_FILE };
}

/** The routes the local review server exposes. Fixed paths: no request may name a file. */
export const LOCAL_SNAPSHOT_ROUTE = '/__local_snapshot';
export const PUBLICATION_POLICY_ROUTE = '/__publication_policy';
export const LOCAL_COVER_PREFIX = '/__local_cover/';

/** A policy for 130 books is a few tens of kilobytes; eight megabytes is comfortably beyond any real one. */
export const POLICY_BODY_LIMIT = 8 * 1024 * 1024;
