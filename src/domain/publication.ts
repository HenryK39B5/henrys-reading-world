/**
 * The publication policy (docs/17 §4, docs/18 §5).
 *
 * Publication is decided **per book**, because 130 books is a review a person can finish and 4,663
 * checkboxes is not. A book is screened in or out; individual passages can still be excluded when one of
 * them is too long, too revealing or simply not something the reader wants on a page. The default is
 * `unreviewed`, which means "do not publish": nothing reaches a public snapshot because somebody forgot
 * to look at it.
 *
 * Everything here is pure. The policy is a private file, not part of the front-end snapshot, and no
 * function in this module can write anything: projection produces a *preview* the caller decides what to
 * do with (Release-A writes it under `.private/` only).
 */
import { countNonWhitespace } from './length.ts';
import type { Book, Highlight, Snapshot, Theme } from './types.ts';

export const PUBLICATION_SCHEMA_VERSION = 1;

/** The site this policy is for. Fixed, so a policy cannot silently be applied to another project. */
export const PUBLICATION_TARGET = {
    repository: 'henrys-reading-world',
    basePath: '/henrys-reading-world/',
} as const;

/** A passage this long is worth a second look before it is published. Not a legal threshold. */
export const LONG_PASSAGE = 200;

export type PublicationDecision = 'unreviewed' | 'publish' | 'exclude';
export type CoverDecision = 'publish' | 'exclude';

export type BookPublicationDecision = {
    decision: PublicationDecision;
    /** Independent of `decision`: a book may be published while its cover art is not. */
    cover: CoverDecision;
    /** Passages of this book that stay out even when the book itself is published. */
    excludedHighlightIds: string[];
    /** Private review remark. Stays on this machine; never part of a projected snapshot. */
    note?: string;
};

export type PublicationPolicy = {
    schemaVersion: typeof PUBLICATION_SCHEMA_VERSION;
    target: { repository: string; basePath: string };
    /** Only the reviewer raises this, and only once every book has a decision. */
    reviewComplete: boolean;
    books: Record<string, BookPublicationDecision>;
};

export const EMPTY_DECISION: BookPublicationDecision = {
    decision: 'unreviewed',
    cover: 'publish',
    excludedHighlightIds: [],
};

export type PolicyValidation =
    | { ok: true; policy: PublicationPolicy }
    | { ok: false; errors: string[] };

export type PolicyReconciliation = {
    policy: PublicationPolicy;
    /** Books in the snapshot the policy does not mention yet; added as `unreviewed`. */
    added: string[];
    /** Books the policy mentions that the snapshot no longer holds; kept, but reported. */
    missing: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isDecision(value: unknown): value is PublicationDecision {
    return value === 'unreviewed' || value === 'publish' || value === 'exclude';
}

function isCover(value: unknown): value is CoverDecision {
    return value === 'publish' || value === 'exclude';
}

/** A fresh decision for a book: unreviewed, cover allowed, nothing excluded. */
export function freshDecision(): BookPublicationDecision {
    return { decision: 'unreviewed', cover: 'publish', excludedHighlightIds: [] };
}

/**
 * A policy for a snapshot: every book unreviewed.
 *
 * Starting from `unreviewed` rather than `publish` is the whole safety property of this file — a book
 * added later is invisible until somebody decides about it.
 */
export function initialPublicationPolicy(snapshot: Snapshot): PublicationPolicy {
    const books: Record<string, BookPublicationDecision> = {};
    for (const bookId of [...snapshot.books].sort(byBookId).map((book) => book.id)) {
        books[bookId] = freshDecision();
    }
    return {
        schemaVersion: PUBLICATION_SCHEMA_VERSION,
        target: { ...PUBLICATION_TARGET },
        reviewComplete: false,
        books,
    };
}

function byBookId(left: Book, right: Book): number {
    return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}

/**
 * Brings a stored policy in line with the current snapshot.
 *
 * New books are added as `unreviewed` and existing decisions are left exactly as they are, so re-running
 * the initialiser can never publish something by accident or throw away a decision already made.
 */
export function reconcilePublicationPolicy(policy: PublicationPolicy, snapshot: Snapshot): PolicyReconciliation {
    const known = new Set(snapshot.books.map((book) => book.id));
    const books: Record<string, BookPublicationDecision> = {};
    const added: string[] = [];
    for (const id of [...known].sort()) {
        const existing = policy.books[id];
        books[id] = existing === undefined ? freshDecision() : existing;
        if (existing === undefined) {
            added.push(id);
        }
    }
    const missing = Object.keys(policy.books)
        .filter((id) => !known.has(id))
        .sort();
    // A book the snapshot no longer holds keeps its decision in the file: dropping it would silently
    // forget a review if the book reappears, and the caller is told it is stale.
    for (const id of missing) {
        const existing = policy.books[id];
        if (existing !== undefined) {
            books[id] = existing;
        }
    }
    return { policy: { ...policy, books }, added, missing };
}

/**
 * Strict validation of a stored policy.
 *
 * Errors name ids and fields only: this runs on private data whose text must never reach a log.
 */
export function validatePublicationPolicy(candidate: unknown, snapshot: Snapshot): PolicyValidation {
    const errors: string[] = [];
    if (!isRecord(candidate)) {
        return { ok: false, errors: ['policy: expected an object'] };
    }
    const extra = Object.keys(candidate).filter(
        (key) => !['schemaVersion', 'target', 'reviewComplete', 'books'].includes(key),
    );
    if (extra.length > 0) {
        errors.push(`policy: unsupported field(s) ${extra.join(', ')}`);
    }
    if (candidate.schemaVersion !== PUBLICATION_SCHEMA_VERSION) {
        errors.push(`policy.schemaVersion: expected ${String(PUBLICATION_SCHEMA_VERSION)}`);
    }
    const target = candidate.target;
    if (!isRecord(target) || target.repository !== PUBLICATION_TARGET.repository || target.basePath !== PUBLICATION_TARGET.basePath) {
        errors.push('policy.target: does not match this project');
    }
    if (typeof candidate.reviewComplete !== 'boolean') {
        errors.push('policy.reviewComplete: expected a boolean');
    }
    const rawBooks = candidate.books;
    if (!isRecord(rawBooks)) {
        errors.push('policy.books: expected an object');
        return { ok: false, errors };
    }

    const highlightIdsByBook = new Map<string, Set<string>>();
    for (const highlight of snapshot.highlights) {
        const set = highlightIdsByBook.get(highlight.bookId);
        if (set === undefined) {
            highlightIdsByBook.set(highlight.bookId, new Set([highlight.id]));
        } else {
            set.add(highlight.id);
        }
    }

    const books: Record<string, BookPublicationDecision> = {};
    for (const [bookId, value] of Object.entries(rawBooks)) {
        if (!isRecord(value)) {
            errors.push(`policy.books.${bookId}: expected an object`);
            continue;
        }
        const extraFields = Object.keys(value).filter(
            (key) => !['decision', 'cover', 'excludedHighlightIds', 'note'].includes(key),
        );
        if (extraFields.length > 0) {
            errors.push(`policy.books.${bookId}: unsupported field(s) ${extraFields.join(', ')}`);
        }
        if (!isDecision(value.decision)) {
            errors.push(`policy.books.${bookId}.decision: expected unreviewed, publish or exclude`);
            continue;
        }
        if (!isCover(value.cover)) {
            errors.push(`policy.books.${bookId}.cover: expected publish or exclude`);
            continue;
        }
        const rawExcluded = value.excludedHighlightIds;
        if (!Array.isArray(rawExcluded)) {
            errors.push(`policy.books.${bookId}.excludedHighlightIds: expected an array`);
            continue;
        }
        const owned = highlightIdsByBook.get(bookId);
        const excluded: string[] = [];
        const seen = new Set<string>();
        for (const entry of rawExcluded) {
            if (typeof entry !== 'string') {
                errors.push(`policy.books.${bookId}.excludedHighlightIds: expected string ids`);
                continue;
            }
            if (!owned?.has(entry)) {
                // A stale or foreign id would silently exclude nothing, so it is an error, not a warning.
                errors.push(`policy.books.${bookId}: excluded highlight is not in this book: ${entry}`);
                continue;
            }
            if (seen.has(entry)) {
                errors.push(`policy.books.${bookId}: duplicate excluded highlight ${entry}`);
                continue;
            }
            seen.add(entry);
            excluded.push(entry);
        }
        const note = value.note;
        if (note !== undefined && typeof note !== 'string') {
            errors.push(`policy.books.${bookId}.note: expected a string`);
            continue;
        }
        const decision: BookPublicationDecision = {
            decision: value.decision,
            cover: value.cover,
            excludedHighlightIds: [...excluded].sort(),
        };
        if (note !== undefined && note.length > 0) {
            decision.note = note;
        }
        books[bookId] = decision;
    }

    const policy: PublicationPolicy = {
        schemaVersion: PUBLICATION_SCHEMA_VERSION,
        target: { ...PUBLICATION_TARGET },
        reviewComplete: candidate.reviewComplete === true,
        books,
    };
    if (policy.reviewComplete && unreviewedBooks(policy, snapshot).length > 0) {
        errors.push('policy.reviewComplete: cannot be true while books are still unreviewed');
    }
    return errors.length === 0 ? { ok: true, policy } : { ok: false, errors };
}

/** Books with no decision yet. Never publishable. */
export function unreviewedBooks(policy: PublicationPolicy, snapshot: Snapshot): string[] {
    return snapshot.books
        .filter((book) => (policy.books[book.id]?.decision ?? 'unreviewed') === 'unreviewed')
        .map((book) => book.id)
        .sort();
}

/** Books kept out entirely, with their passages, cover and shelf references. */
export function excludedBooks(policy: PublicationPolicy, snapshot: Snapshot): string[] {
    return snapshot.books
        .filter((book) => policy.books[book.id]?.decision === 'exclude')
        .map((book) => book.id)
        .sort();
}

export function publishedBooks(policy: PublicationPolicy, snapshot: Snapshot): string[] {
    return snapshot.books
        .filter((book) => policy.books[book.id]?.decision === 'publish')
        .map((book) => book.id)
        .sort();
}

export function decisionOf(policy: PublicationPolicy, bookId: string): BookPublicationDecision {
    return policy.books[bookId] ?? freshDecision();
}

/** Passages of one book that the policy would publish, in stable id order. */
export function selectedHighlights(policy: PublicationPolicy, snapshot: Snapshot, bookId: string): Highlight[] {
    const decision = decisionOf(policy, bookId);
    if (decision.decision !== 'publish') {
        return [];
    }
    const excluded = new Set(decision.excludedHighlightIds);
    return snapshot.highlights
        .filter((highlight) => highlight.bookId === bookId && !excluded.has(highlight.id))
        .sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
}

export type BookStats = {
    bookId: string;
    /** Over the whole book, whether or not it will be published. */
    highlightCount: number;
    characters: number;
    longest: number;
    /** Passages at or above `LONG_PASSAGE`, which is a prompt to look, not a verdict. */
    longCount: number;
    /** What the current decision would actually publish. */
    selected: number;
    selectedCharacters: number;
    selectedLongCount: number;
    hasCover: boolean;
};

export function bookStats(policy: PublicationPolicy, snapshot: Snapshot, bookId: string): BookStats {
    const all = snapshot.highlights.filter((highlight) => highlight.bookId === bookId);
    const selected = selectedHighlights(policy, snapshot, bookId);
    const decision = decisionOf(policy, bookId);
    const selectedIds = new Set(selected.map((highlight) => highlight.id));
    const selectedIsReal = decision.decision === 'publish';
    const lengths = selected.map((highlight) => countNonWhitespace(highlight.text));
    return {
        bookId,
        highlightCount: all.length,
        characters: all.reduce((total, highlight) => total + countNonWhitespace(highlight.text), 0),
        longest: all.reduce((longest, highlight) => Math.max(longest, countNonWhitespace(highlight.text)), 0),
        longCount: all.filter((highlight) => countNonWhitespace(highlight.text) >= LONG_PASSAGE).length,
        selected: selectedIds.size,
        selectedCharacters: selectedIsReal ? lengths.reduce((total, length) => total + length, 0) : 0,
        selectedLongCount: selectedIsReal ? lengths.filter((length) => length >= LONG_PASSAGE).length : 0,
        hasCover: snapshot.books.find((book) => book.id === bookId)?.coverPath !== undefined,
    };
}

export type PublicationSummary = {
    totalBooks: number;
    reviewed: number;
    published: number;
    excluded: number;
    unreviewed: number;
    /** Passages that would be published by the current decisions. */
    selectedHighlights: number;
    selectedCharacters: number;
    /** Books published with their cover allowed. */
    publishedCovers: number;
    excludedHighlights: number;
    longHighlights: number;
    /** Shelves that would still exist, because at least one published book is filed on them. */
    themesKept: number;
    themesDropped: number;
    /** Books that would be published with nothing left to show after exclusions. */
    emptyBooks: string[];
};

export function publicationSummary(policy: PublicationPolicy, snapshot: Snapshot): PublicationSummary {
    const published = publishedBooks(policy, snapshot);
    const excluded = excludedBooks(policy, snapshot);
    const unreviewed = unreviewedBooks(policy, snapshot);
    let selectedHighlights = 0;
    let selectedCharacters = 0;
    let excludedHighlights = 0;
    let longHighlights = 0;
    const emptyBooks: string[] = [];
    for (const book of [...snapshot.books].sort(byBookId)) {
        const decision = decisionOf(policy, book.id);
        excludedHighlights += decision.excludedHighlightIds.length;
        const stats = bookStats(policy, snapshot, book.id);
        selectedHighlights += stats.selected;
        selectedCharacters += stats.selectedCharacters;
        longHighlights += stats.selectedLongCount;
        if (decision.decision === 'publish' && stats.selected === 0) {
            emptyBooks.push(book.id);
        }
    }
    const keptThemes = new Set<string>();
    for (const bookId of published) {
        const stats = bookStats(policy, snapshot, bookId);
        if (stats.selected === 0) {
            continue;
        }
        for (const themeId of snapshot.books.find((book) => book.id === bookId)?.themeIds ?? []) {
            keptThemes.add(themeId);
        }
    }
    return {
        totalBooks: snapshot.books.length,
        reviewed: published.length + excluded.length,
        published: published.length,
        excluded: excluded.length,
        unreviewed: unreviewed.length,
        selectedHighlights,
        selectedCharacters,
        publishedCovers: published.filter((bookId) => decisionOf(policy, bookId).cover === 'publish').length,
        excludedHighlights,
        longHighlights,
        themesKept: keptThemes.size,
        themesDropped: snapshot.themes.filter((theme) => !keptThemes.has(theme.id)).length,
        emptyBooks: emptyBooks.sort(),
    };
}

export type ProjectedPreview = {
    snapshot: Snapshot;
    /** Ids, counts and lengths only: an audit of a private decision, never the text itself. */
    audit: {
        generatedFrom: 'local-snapshot';
        books: { id: string; selected: number; excluded: number; cover: 'publish' | 'exclude' }[];
        excludedBooks: string[];
        unreviewedBooks: string[];
        themesKept: string[];
        themesDropped: string[];
        longHighlights: { id: string; bookId: string; length: number }[];
        summary: PublicationSummary;
    };
};

function byHighlightId(left: { id: string }, right: { id: string }): number {
    return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}

/**
 * What the public site *would* contain for a policy.
 *
 * The result is a snapshot in the same shape the front end understands, so a preview can be looked at
 * with the real product. It is deliberately marked `local-only`: a preview is not a publication, and
 * nothing in this module can promote it to `public`.
 */
export function projectPublicationPreview(policy: PublicationPolicy, snapshot: Snapshot): ProjectedPreview {
    const published = publishedBooks(policy, snapshot);
    const publishedSet = new Set(published);
    const books: Book[] = [];
    for (const book of [...snapshot.books].sort(byBookId)) {
        if (!publishedSet.has(book.id)) {
            continue;
        }
        const decision = decisionOf(policy, book.id);
        const keptThemes = snapshot.themes
            .filter((theme) => book.themeIds.includes(theme.id))
            .map((theme) => theme.id);
        const projected: Book = {
            id: book.id,
            title: book.title,
            author: book.author,
            themeIds: keptThemes,
        };
        if (book.description !== undefined) {
            projected.description = book.description;
        }
        // A cover only travels when both the book and its cover are allowed out.
        if (book.coverPath !== undefined && decision.cover === 'publish') {
            projected.coverPath = book.coverPath;
        }
        books.push(projected);
    }

    const highlights: Highlight[] = [];
    for (const bookId of published) {
        highlights.push(...selectedHighlights(policy, snapshot, bookId));
    }
    highlights.sort(byHighlightId);

    // Shelves are recomputed: a shelf with nothing left to show does not exist.
    const themeIdsInUse = new Set<string>();
    for (const book of books) {
        if (highlights.some((highlight) => highlight.bookId === book.id)) {
            for (const themeId of book.themeIds) {
                themeIdsInUse.add(themeId);
            }
        }
    }
    const themes: Theme[] = snapshot.themes
        .filter((theme) => themeIdsInUse.has(theme.id))
        .map((theme) => ({ ...theme }));
    const tagIdsInUse = new Set(highlights.flatMap((highlight) => highlight.tagIds));
    const tags = snapshot.tags
        .filter((tag) => tagIdsInUse.has(tag.id))
        .map((tag) => ({ ...tag }));

    const summary = publicationSummary(policy, snapshot);
    const longHighlights = highlights
        .map((highlight) => ({
            id: highlight.id,
            bookId: highlight.bookId,
            length: countNonWhitespace(highlight.text),
        }))
        .filter((entry) => entry.length >= LONG_PASSAGE);

    return {
        snapshot: {
            schemaVersion: snapshot.schemaVersion,
            // A preview is never a publication: it stays local-only whatever the decisions say.
            visibility: 'local-only',
            owner: { ...snapshot.owner },
            themes,
            tags,
            books,
            highlights,
        },
        audit: {
            generatedFrom: 'local-snapshot',
            books: books.map((book) => {
                const decision = decisionOf(policy, book.id);
                const stats = bookStats(policy, snapshot, book.id);
                return {
                    id: book.id,
                    selected: stats.selected,
                    excluded: decision.excludedHighlightIds.length,
                    cover: decision.cover,
                };
            }),
            excludedBooks: excludedBooks(policy, snapshot),
            unreviewedBooks: unreviewedBooks(policy, snapshot),
            themesKept: themes.map((theme) => theme.id),
            themesDropped: snapshot.themes
                .filter((theme) => !themeIdsInUse.has(theme.id))
                .map((theme) => theme.id),
            longHighlights,
            summary,
        },
    };
}

/**
 * Whether a policy is ready to become a real public snapshot.
 *
 * Four things have to hold together: every book decided, no decision pointing at missing data, at least
 * one passage left to publish, and no published book that would appear empty. The last one matters
 * because an empty book room on a public site is a bug with a policy-shaped cause.
 *
 * The reasons are shown to the reviewer, so they are written for a person rather than for a log.
 */
export function releaseReadiness(
    policy: PublicationPolicy,
    snapshot: Snapshot,
): { ready: boolean; reasons: string[] } {
    const reasons: string[] = [];
    const unreviewed = unreviewedBooks(policy, snapshot);
    if (unreviewed.length > 0) {
        reasons.push(`还有 ${String(unreviewed.length)} 本书未审核`);
    }
    const missing = Object.keys(policy.books)
        .filter((id) => !snapshot.books.some((book) => book.id === id))
        .sort();
    if (missing.length > 0) {
        reasons.push(`清单里有 ${String(missing.length)} 本书已不在快照中：${missing.join(', ')}`);
    }
    const summary = publicationSummary(policy, snapshot);
    if (summary.selectedHighlights === 0) {
        reasons.push('没有任何划线会被公开');
    }
    if (summary.emptyBooks.length > 0) {
        reasons.push(
            `${String(summary.emptyBooks.length)} 本已公开的书会变成空房间：${summary.emptyBooks.join(', ')}`,
        );
    }
    if (!policy.reviewComplete && unreviewed.length === 0) {
        reasons.push('尚未标记“审核完成”');
    }
    return { ready: reasons.length === 0, reasons };
}

// --- editing helpers: pure, so the reviewer UI and its tests share one implementation -------------

export function setBookDecision(
    policy: PublicationPolicy,
    bookId: string,
    decision: PublicationDecision,
): PublicationPolicy {
    const current = decisionOf(policy, bookId);
    // Excluding a book clears nothing in the file: the exclusions belong to the book and come back if it
    // is published again.
    return { ...policy, books: { ...policy.books, [bookId]: { ...current, decision } } };
}

export function toggleCover(policy: PublicationPolicy, bookId: string): PublicationPolicy {
    const current = decisionOf(policy, bookId);
    return {
        ...policy,
        books: { ...policy.books, [bookId]: { ...current, cover: current.cover === 'publish' ? 'exclude' : 'publish' } },
    };
}

export function toggleHighlightExclusion(
    policy: PublicationPolicy,
    bookId: string,
    highlightId: string,
): PublicationPolicy {
    const current = decisionOf(policy, bookId);
    const excluded = current.excludedHighlightIds.includes(highlightId)
        ? current.excludedHighlightIds.filter((id) => id !== highlightId)
        : [...current.excludedHighlightIds, highlightId].sort();
    return { ...policy, books: { ...policy.books, [bookId]: { ...current, excludedHighlightIds: excluded } } };
}

export function setBookNote(policy: PublicationPolicy, bookId: string, note: string): PublicationPolicy {
    const current = decisionOf(policy, bookId);
    const next: BookPublicationDecision = { ...current };
    const trimmed = note.trim();
    if (trimmed.length === 0) {
        delete next.note;
    } else {
        next.note = trimmed;
    }
    return { ...policy, books: { ...policy.books, [bookId]: next } };
}

/** The reviewer's own "I have looked at everything" switch. Refused while anything is undecided. */
export function setReviewComplete(
    policy: PublicationPolicy,
    snapshot: Snapshot,
    complete: boolean,
): { policy: PublicationPolicy; refused: string | null } {
    if (complete) {
        const unreviewed = unreviewedBooks(policy, snapshot);
        if (unreviewed.length > 0) {
            return {
                policy,
                refused: `还有 ${String(unreviewed.length)} 本书未审核，不能标记审核完成。`,
            };
        }
    }
    return { policy: { ...policy, reviewComplete: complete }, refused: null };
}
