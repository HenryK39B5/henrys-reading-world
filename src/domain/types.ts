/**
 * Data contract for the reading world (schema v3 — docs/19–22).
 *
 * The snapshot is the only shape the consumer UI understands. Source identifiers, credentials,
 * embedding vectors, confidence, rationale and raw capture envelopes never appear here.
 *
 * Book Theme and Highlight Topic Tag are deliberately separate: shelves classify books, while
 * 1–3 equal topic tags describe a passage. During the Batch 4 pilot, unreviewed passages carry an
 * honest empty `tagIds` array instead of an invented label.
 */

export const SNAPSHOT_SCHEMA_VERSION = 3;

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

/** A flat, public-safe concept attached to individual highlights. */
export type TopicTag = {
    id: string;
    title: string;
    description?: string;
};

export const MAX_TOPIC_TAGS_PER_HIGHLIGHT = 3;
/** Quantized private-build projection used only to pace a path after a book has been chosen fairly. */
export const PATH_VECTOR_DIMENSIONS = 16;

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
    /** Equal-status topic clues in snapshot editorial order; empty only while the pilot is incomplete. */
    tagIds: string[];
    /** Optional low-dimensional, quantized derivative; never a raw embedding and never a path qualifier. */
    pathVector?: number[];
};

export type Snapshot = {
    schemaVersion: typeof SNAPSHOT_SCHEMA_VERSION;
    visibility: Visibility;
    owner: Owner;
    themes: Theme[];
    tags: TopicTag[];
    books: Book[];
    highlights: Highlight[];
};

export const EMPTY_SNAPSHOT: Snapshot = {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    visibility: 'public',
    owner: { displayName: 'Henry', siteTitle: "Henry's Reading World" },
    themes: [],
    tags: [],
    books: [],
    highlights: [],
};

/** Shown when the source data carries no author, instead of inventing one. */
export const UNKNOWN_AUTHOR_LABEL = '作者信息暂缺';
