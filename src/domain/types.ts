/**
 * Data contract for the reading world (schema v2 — docs/10, docs/11 §1).
 *
 * The snapshot is the only shape the UI understands. Source identifiers, credentials and raw
 * capture envelopes never appear here; see docs/03-DATA-CONTRACT.md.
 *
 * v2 moves themes from passages to books. A shelf label says "this book is filed under …", never
 * "this sentence is about …", so an individual passage carries no editorial scoring at all.
 */

export const SNAPSHOT_SCHEMA_VERSION = 2;

export type Visibility = 'public' | 'local-only';

export type LengthBand = 'short' | 'medium' | 'long';

export type Owner = {
    displayName: string;
    siteTitle: string;
    about?: string;
};

/** One primary shelf plus up to two secondary shelves. */
export const MAX_THEME_IDS_PER_BOOK = 3;

/** A browsing shelf. Belongs to books; it is not an interpretation of a single passage. */
export type Theme = {
    id: string;
    title: string;
    /** Describes what the shelf collects, never what the reader is like. */
    description?: string;
};

export type Book = {
    /** Stable project-local id, never a platform or account identifier. */
    id: string;
    title: string;
    author: string;
    description?: string;
    /** Relative path to a locally held cover asset; served locally until release is decided. */
    coverPath?: string;
    /** Primary shelf first, then secondary shelves. */
    themeIds: string[];
};

export type Highlight = {
    id: string;
    bookId: string;
    /** Original passage. Never rewritten, trimmed or padded for display. */
    text: string;
    /** Only present when the capture carried a usable creation timestamp. */
    year?: number;
};

export type Snapshot = {
    schemaVersion: typeof SNAPSHOT_SCHEMA_VERSION;
    visibility: Visibility;
    owner: Owner;
    themes: Theme[];
    books: Book[];
    highlights: Highlight[];
};

export const EMPTY_SNAPSHOT: Snapshot = {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    visibility: 'public',
    owner: { displayName: 'Henry', siteTitle: "Henry's Reading World" },
    themes: [],
    books: [],
    highlights: [],
};

/** Shown when the source data carries no author, instead of inventing one. */
export const UNKNOWN_AUTHOR_LABEL = '作者信息暂缺';
