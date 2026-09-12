/**
 * Public/private data contract for the prototype.
 *
 * The snapshot is the only shape the UI understands. Source identifiers, credentials and
 * raw capture envelopes never appear here; see docs/03-DATA-CONTRACT.md.
 */

export const SNAPSHOT_SCHEMA_VERSION = 1;

export type Visibility = 'public' | 'local-only';

/** Editorial score, not a claim of fact. */
export type QualityScore = 1 | 2 | 3 | 4 | 5;

export type LengthBand = 'short' | 'medium' | 'long';

export type Owner = {
    displayName: string;
    siteTitle: string;
    about?: string;
};

export type Book = {
    /** Stable project-local id, never a platform or account identifier. */
    id: string;
    title: string;
    author: string;
    description?: string;
    /** Relative path to a locally held, publishable cover asset. */
    coverPath?: string;
};

export type Topic = {
    id: string;
    title: string;
    description?: string;
};

export type Highlight = {
    id: string;
    bookId: string;
    /** Original passage. Never rewritten, trimmed or padded for display. */
    text: string;
    /** Only present when the capture carried a usable creation timestamp. */
    year?: number;
    topicIds: string[];
    qualityScore: QualityScore;
    standaloneReadable: boolean;
    pinned: boolean;
    openingCandidate: boolean;
    surpriseCandidate: boolean;
};

export type Snapshot = {
    schemaVersion: typeof SNAPSHOT_SCHEMA_VERSION;
    visibility: Visibility;
    owner: Owner;
    books: Book[];
    topics: Topic[];
    highlights: Highlight[];
};

export const EMPTY_SNAPSHOT: Snapshot = {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    visibility: 'public',
    owner: { displayName: 'Henry', siteTitle: "Henry's Reading World" },
    books: [],
    topics: [],
    highlights: [],
};

/** Shown when the source data carries no author, instead of inventing one. */
export const UNKNOWN_AUTHOR_LABEL = '作者信息暂缺';
