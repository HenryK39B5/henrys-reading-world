import { countNonWhitespace, hasOriginalLineBreak, lengthBand } from './length.ts';
import {
    MAX_THEME_IDS_PER_BOOK,
    SNAPSHOT_SCHEMA_VERSION,
    type Book,
    type Highlight,
    type Owner,
    type Snapshot,
    type Theme,
    type Visibility,
} from './types.ts';

export type ValidationResult =
    | { ok: true; snapshot: Snapshot; warnings: string[] }
    | { ok: false; errors: string[]; warnings: string[] };

export type ValidateOptions = {
    /** Injected so validation stays deterministic in tests. */
    currentYear?: number;
    /** Reject a snapshot that does not match the integrity level being validated. */
    expectedVisibility?: Visibility;
};

const ID_PATTERNS = {
    book: /^b-\d{3,}$/u,
    theme: /^t-\d{3,}$/u,
    highlight: /^h-\d{3,}$/u,
};

const COVER_PUBLIC_PATTERN = /^covers\/[a-z0-9][a-z0-9._-]*\.(?:jpg|jpeg|png|webp)$/u;
/** Cover art that only exists locally until the release decision is made (see PUB-06). */
const COVER_LOCAL_PATTERN = /^local-covers\/[a-z0-9][a-z0-9._-]*\.(?:jpg|jpeg|png|webp)$/u;

/** Broad browsing shelves: fewer than this and browsing collapses, more and it becomes taxonomy. */
const THEME_COUNT_RANGE = { min: 8, max: 15 };

type Context = {
    errors: string[];
    warnings: string[];
    currentYear: number;
    /** Integrity level being validated; local-only covers are rejected in a public snapshot. */
    visibility: Visibility | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Structural check only: rejects any key that is not part of the public contract. */
function checkKeys(ctx: Context, where: string, value: Record<string, unknown>, allowed: string[]): boolean {
    const extra = Object.keys(value).filter((key) => !allowed.includes(key));
    if (extra.length > 0) {
        ctx.errors.push(`${where}: unsupported field(s) ${extra.join(', ')}`);
        return false;
    }
    return true;
}

function readNonEmptyString(ctx: Context, where: string, value: unknown): string | null {
    if (typeof value !== 'string' || value.trim().length === 0) {
        ctx.errors.push(`${where}: expected a non-empty string`);
        return null;
    }
    return value;
}

function readOptionalNonEmptyString(ctx: Context, where: string, value: unknown): string | undefined {
    if (value === undefined) {
        return undefined;
    }
    return readNonEmptyString(ctx, where, value) ?? undefined;
}

function readArray(ctx: Context, where: string, value: unknown): unknown[] | null {
    if (!Array.isArray(value)) {
        ctx.errors.push(`${where}: expected an array`);
        return null;
    }
    return value;
}

function validateOwner(ctx: Context, value: unknown): Owner | null {
    if (!isRecord(value)) {
        ctx.errors.push('owner: expected an object');
        return null;
    }
    if (!checkKeys(ctx, 'owner', value, ['displayName', 'siteTitle', 'about'])) {
        return null;
    }
    const displayName = readNonEmptyString(ctx, 'owner.displayName', value['displayName']);
    const siteTitle = readNonEmptyString(ctx, 'owner.siteTitle', value['siteTitle']);
    const about = readOptionalNonEmptyString(ctx, 'owner.about', value['about']);
    if (displayName === null || siteTitle === null) {
        return null;
    }
    return about === undefined ? { displayName, siteTitle } : { displayName, siteTitle, about };
}

function validateTheme(ctx: Context, index: number, value: unknown): Theme | null {
    const where = `themes[${index}]`;
    if (!isRecord(value)) {
        ctx.errors.push(`${where}: expected an object`);
        return null;
    }
    if (!checkKeys(ctx, where, value, ['id', 'title', 'description'])) {
        return null;
    }
    const id = readNonEmptyString(ctx, `${where}.id`, value['id']);
    const title = readNonEmptyString(ctx, `${where}.title`, value['title']);
    const description = readOptionalNonEmptyString(ctx, `${where}.description`, value['description']);
    if (id !== null && !ID_PATTERNS.theme.test(id)) {
        ctx.errors.push(`${where}.id: expected an id like t-001`);
    }
    if (id === null || title === null) {
        return null;
    }
    return description === undefined ? { id, title } : { id, title, description };
}

function validateBook(ctx: Context, index: number, value: unknown): Book | null {
    const where = `books[${index}]`;
    if (!isRecord(value)) {
        ctx.errors.push(`${where}: expected an object`);
        return null;
    }
    if (!checkKeys(ctx, where, value, ['id', 'title', 'author', 'description', 'coverPath', 'themeIds'])) {
        return null;
    }
    const id = readNonEmptyString(ctx, `${where}.id`, value['id']);
    const title = readNonEmptyString(ctx, `${where}.title`, value['title']);
    const author = readNonEmptyString(ctx, `${where}.author`, value['author']);
    const description = readOptionalNonEmptyString(ctx, `${where}.description`, value['description']);
    const coverPath = readOptionalNonEmptyString(ctx, `${where}.coverPath`, value['coverPath']);
    if (id !== null && !ID_PATTERNS.book.test(id)) {
        ctx.errors.push(`${where}.id: expected an id like b-001`);
    }
    if (coverPath !== undefined && !COVER_PUBLIC_PATTERN.test(coverPath) && !COVER_LOCAL_PATTERN.test(coverPath)) {
        ctx.errors.push(`${where}.coverPath: expected a local covers/ or local-covers/ asset path without query or traversal`);
    }
    if (coverPath !== undefined && COVER_LOCAL_PATTERN.test(coverPath) && ctx.visibility !== 'local-only') {
        ctx.errors.push(`${where}.coverPath: local-covers assets are only valid in a local-only snapshot`);
    }

    const themeIds: string[] = [];
    const themeIdsRaw = readArray(ctx, `${where}.themeIds`, value['themeIds']);
    if (themeIdsRaw !== null) {
        for (const entry of themeIdsRaw) {
            if (typeof entry !== 'string' || entry.length === 0) {
                ctx.errors.push(`${where}.themeIds: expected theme id strings`);
                continue;
            }
            if (themeIds.includes(entry)) {
                ctx.errors.push(`${where}.themeIds: duplicate reference ${entry}`);
                continue;
            }
            themeIds.push(entry);
        }
        if (themeIds.length > MAX_THEME_IDS_PER_BOOK) {
            ctx.errors.push(
                `${where}.themeIds: ${String(themeIds.length)} shelves; at most ${String(MAX_THEME_IDS_PER_BOOK)} (one primary plus two secondary)`,
            );
        }
    }

    if (id === null || title === null || author === null) {
        return null;
    }
    return {
        id,
        title,
        author,
        ...(description === undefined ? {} : { description }),
        ...(coverPath === undefined ? {} : { coverPath }),
        themeIds,
    };
}

function validateHighlight(ctx: Context, index: number, value: unknown): Highlight | null {
    const where = `highlights[${index}]`;
    if (!isRecord(value)) {
        ctx.errors.push(`${where}: expected an object`);
        return null;
    }
    if (!checkKeys(ctx, where, value, ['id', 'bookId', 'text', 'year'])) {
        return null;
    }

    const id = readNonEmptyString(ctx, `${where}.id`, value['id']);
    const bookId = readNonEmptyString(ctx, `${where}.bookId`, value['bookId']);
    const text = readNonEmptyString(ctx, `${where}.text`, value['text']);
    if (id !== null && !ID_PATTERNS.highlight.test(id)) {
        ctx.errors.push(`${where}.id: expected an id like h-001`);
    }

    let year: number | undefined;
    if (value['year'] !== undefined) {
        const raw = value['year'];
        if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < 1900 || raw > ctx.currentYear) {
            ctx.errors.push(`${where}.year: expected an integer between 1900 and ${ctx.currentYear}`);
        } else {
            year = raw;
        }
    }

    if (id === null || bookId === null || text === null) {
        return null;
    }
    return { id, bookId, text, ...(year === undefined ? {} : { year }) };
}

function pushDuplicateErrors(ctx: Context, label: string, ids: string[]): void {
    const seen = new Set<string>();
    for (const id of ids) {
        if (seen.has(id)) {
            ctx.errors.push(`${label}: duplicate id ${id}`);
            continue;
        }
        seen.add(id);
    }
}

/**
 * Content coverage checks for the full library (v2 no longer caps the library at 30-50 passages).
 * These warn; they never relax the contract above.
 */
function checkContentCoverage(ctx: Context, snapshot: Snapshot): void {
    const { highlights, books, themes } = snapshot;
    if (highlights.length === 0 && books.length === 0) {
        // The public snapshot is intentionally empty until the release decision is made.
        return;
    }

    const highlightsPerBook = new Map<string, number>();
    const booksPerTheme = new Map<string, Set<string>>();
    const highlightsPerTheme = new Map<string, number>();
    const booksById = new Map(books.map((book) => [book.id, book]));
    const years = new Set<number>();
    const bands = new Set<string>();
    let lineBreakSample = false;

    for (const highlight of highlights) {
        highlightsPerBook.set(highlight.bookId, (highlightsPerBook.get(highlight.bookId) ?? 0) + 1);
        if (highlight.year !== undefined) {
            years.add(highlight.year);
        }
        bands.add(lengthBand(highlight.text));
        if (hasOriginalLineBreak(highlight.text)) {
            lineBreakSample = true;
        }
        const book = booksById.get(highlight.bookId);
        for (const themeId of book?.themeIds ?? []) {
            highlightsPerTheme.set(themeId, (highlightsPerTheme.get(themeId) ?? 0) + 1);
            const set = booksPerTheme.get(themeId) ?? new Set<string>();
            set.add(highlight.bookId);
            booksPerTheme.set(themeId, set);
        }
    }

    if (themes.length < THEME_COUNT_RANGE.min || themes.length > THEME_COUNT_RANGE.max) {
        ctx.warnings.push(
            `content: ${String(themes.length)} theme shelves; ${String(THEME_COUNT_RANGE.min)}-${String(THEME_COUNT_RANGE.max)} are expected`,
        );
    }

    for (const theme of themes) {
        const bookCount = booksPerTheme.get(theme.id)?.size ?? 0;
        if (bookCount === 0) {
            ctx.warnings.push(`content: theme ${theme.id} has no book on its shelf`);
        } else if (bookCount < 2) {
            ctx.warnings.push(`content: theme ${theme.id} connects ${String(bookCount)} book; 2 or more are expected`);
        }
    }

    let untaggedBooks = 0;
    let emptyBooks = 0;
    for (const book of books) {
        if (book.themeIds.length === 0) {
            untaggedBooks += 1;
        }
        if ((highlightsPerBook.get(book.id) ?? 0) === 0) {
            emptyBooks += 1;
            ctx.warnings.push(`content: book ${book.id} has no highlights`);
        }
    }
    if (untaggedBooks > 0) {
        ctx.warnings.push(`content: ${String(untaggedBooks)} book(s) have no theme shelf`);
    }

    for (const band of ['short', 'medium', 'long'] as const) {
        if (!bands.has(band)) {
            ctx.warnings.push(`content: no ${band} passage is present`);
        }
    }
    if (!lineBreakSample) {
        ctx.warnings.push('content: no passage keeps an original line break');
    }
    if (years.size < 2) {
        ctx.warnings.push(`content: ${String(years.size)} distinct year(s); cross-year range is not demonstrated`);
    }
    if (emptyBooks + untaggedBooks === 0 && highlights.length < 30) {
        ctx.warnings.push(`content: only ${String(highlights.length)} highlights; the v1 prototype target was 30-50`);
    }
}

export function validateSnapshot(input: unknown, options: ValidateOptions = {}): ValidationResult {
    const currentYear = options.currentYear ?? new Date().getFullYear();
    const ctx: Context = { errors: [], warnings: [], currentYear, visibility: null };
    if (!Number.isInteger(currentYear)) {
        throw new Error('currentYear must be an integer');
    }

    if (!isRecord(input)) {
        return { ok: false, errors: ['snapshot: expected an object'], warnings: [] };
    }
    if (!checkKeys(ctx, 'snapshot', input, ['schemaVersion', 'visibility', 'owner', 'themes', 'books', 'highlights'])) {
        return { ok: false, errors: ctx.errors, warnings: ctx.warnings };
    }
    if (input['schemaVersion'] !== SNAPSHOT_SCHEMA_VERSION) {
        ctx.errors.push(`snapshot.schemaVersion: expected ${String(SNAPSHOT_SCHEMA_VERSION)}`);
    }

    const visibility = input['visibility'];
    if (visibility !== 'public' && visibility !== 'local-only') {
        ctx.errors.push('snapshot.visibility: expected "public" or "local-only"');
    } else if (options.expectedVisibility !== undefined && visibility !== options.expectedVisibility) {
        ctx.errors.push(`snapshot.visibility: expected "${options.expectedVisibility}"`);
    } else {
        ctx.visibility = visibility;
    }

    const owner = validateOwner(ctx, input['owner']);

    const themesRaw = readArray(ctx, 'themes', input['themes']);
    const themes: Theme[] = [];
    if (themesRaw !== null) {
        themesRaw.forEach((entry, index) => {
            const theme = validateTheme(ctx, index, entry);
            if (theme !== null) {
                themes.push(theme);
            }
        });
        pushDuplicateErrors(
            ctx,
            'themes',
            themes.map((theme) => theme.id),
        );
    }

    const booksRaw = readArray(ctx, 'books', input['books']);
    const books: Book[] = [];
    if (booksRaw !== null) {
        booksRaw.forEach((entry, index) => {
            const book = validateBook(ctx, index, entry);
            if (book !== null) {
                books.push(book);
            }
        });
        pushDuplicateErrors(
            ctx,
            'books',
            books.map((book) => book.id),
        );
    }

    const highlightsRaw = readArray(ctx, 'highlights', input['highlights']);
    const highlights: Highlight[] = [];
    if (highlightsRaw !== null) {
        highlightsRaw.forEach((entry, index) => {
            const highlight = validateHighlight(ctx, index, entry);
            if (highlight !== null) {
                highlights.push(highlight);
            }
        });
        pushDuplicateErrors(
            ctx,
            'highlights',
            highlights.map((highlight) => highlight.id),
        );
    }

    const bookIds = new Set(books.map((book) => book.id));
    const themeIds = new Set(themes.map((theme) => theme.id));
    for (const book of books) {
        for (const themeId of book.themeIds) {
            if (!themeIds.has(themeId)) {
                ctx.errors.push(`books: ${book.id} references unknown theme ${themeId}`);
            }
        }
    }
    for (const highlight of highlights) {
        if (!bookIds.has(highlight.bookId)) {
            ctx.errors.push(`highlights: ${highlight.id} references unknown book ${highlight.bookId}`);
        }
    }

    if (ctx.errors.length > 0 || owner === null) {
        return { ok: false, errors: ctx.errors, warnings: ctx.warnings };
    }

    const snapshot: Snapshot = {
        schemaVersion: SNAPSHOT_SCHEMA_VERSION,
        visibility: visibility as Visibility,
        owner,
        themes,
        books,
        highlights,
    };
    checkContentCoverage(ctx, snapshot);

    if (ctx.errors.length > 0) {
        return { ok: false, errors: ctx.errors, warnings: ctx.warnings };
    }
    return { ok: true, snapshot, warnings: ctx.warnings };
}

/** Guard used by data tooling: never label a passage as publishable without review. */
export function isPublishableVisibility(visibility: Visibility): boolean {
    return visibility === 'public';
}

export function describeHighlightShape(highlight: Highlight): string {
    return `${highlight.id} (${String(countNonWhitespace(highlight.text))} chars, ${lengthBand(highlight.text)})`;
}
