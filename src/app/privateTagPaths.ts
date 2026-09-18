/**
 * Where the private tag vocabulary and trial assignments live (docs/22 §6).
 *
 * One module decides these paths, so the Studio screen, the content-production scripts and the browser
 * acceptance run cannot disagree about which file is being written. The defaults are inside `.private/`,
 * which is untracked and unreachable over HTTP.
 *
 * `READING_WORLD_TAG_DIR` redirects both writable files at once. It exists for the same reason the
 * publication equivalent does: the automated Studio tests must never save over the trial a person is
 * reviewing. It is read from the process that starts the server — never from a request, so no page and no
 * URL can choose which file is written.
 */
import { join } from 'node:path';

export const DEFAULT_TAG_DIR = join('.private', 'tags');

export type TagPaths = {
    dir: string;
    vocabulary: string;
    assignments: string;
    audit: string;
};

export function tagPaths(): TagPaths {
    const override = process.env.READING_WORLD_TAG_DIR;
    const dir = override !== undefined && override.length > 0 ? override : DEFAULT_TAG_DIR;
    return {
        dir,
        vocabulary: join(dir, 'vocabulary.json'),
        assignments: join(dir, 'assignments.json'),
        audit: join(dir, 'trial-audit.json'),
    };
}
