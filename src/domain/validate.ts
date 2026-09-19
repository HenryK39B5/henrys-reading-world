import { countNonWhitespace, hasOriginalLineBreak, lengthBand } from './length.ts';
import {
    MAP_COORDINATE_MAX,
    MAX_THEME_IDS_PER_BOOK,
    MAX_TOPIC_TAGS_PER_HIGHLIGHT,
    PATH_VECTOR_DIMENSIONS,
    SNAPSHOT_SCHEMA_VERSION,
    type Book,
    type Highlight,
    type MapContour,
    type MapDensity,
    type MapLabel,
    type MapLayout,
    type MapPoint,
    type Owner,
    type Snapshot,
    type Theme,
    type TopicTag,
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
    tag: /^tag-\d{3,}$/u,
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

function validateTopicTag(ctx: Context, index: number, value: unknown): TopicTag | null {
    const where = `tags[${index}]`;
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
    if (id !== null && !ID_PATTERNS.tag.test(id)) {
        ctx.errors.push(`${where}.id: expected an id like tag-001`);
    }
    if (title !== null && ([...title].length < 2 || [...title].length > 4)) {
        ctx.errors.push(`${where}.title: expected 2-4 characters`);
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
    if (!checkKeys(ctx, where, value, ['id', 'bookId', 'text', 'year', 'tagIds', 'pathVector'])) {
        return null;
    }

    const id = readNonEmptyString(ctx, `${where}.id`, value['id']);
    const bookId = readNonEmptyString(ctx, `${where}.bookId`, value['bookId']);
    const text = readNonEmptyString(ctx, `${where}.text`, value['text']);
    const tagIds: string[] = [];
    const tagIdsRaw = readArray(ctx, `${where}.tagIds`, value['tagIds']);
    if (tagIdsRaw !== null) {
        for (const entry of tagIdsRaw) {
            if (typeof entry !== 'string' || entry.length === 0) {
                ctx.errors.push(`${where}.tagIds: expected tag id strings`);
                continue;
            }
            if (tagIds.includes(entry)) {
                ctx.errors.push(`${where}.tagIds: duplicate reference ${entry}`);
                continue;
            }
            tagIds.push(entry);
        }
        if (tagIds.length > MAX_TOPIC_TAGS_PER_HIGHLIGHT) {
            ctx.errors.push(`${where}.tagIds: at most ${String(MAX_TOPIC_TAGS_PER_HIGHLIGHT)} tags`);
        }
    }
    if (id !== null && !ID_PATTERNS.highlight.test(id)) {
        ctx.errors.push(`${where}.id: expected an id like h-001`);
    }

    let pathVector: number[] | undefined;
    if (value['pathVector'] !== undefined) {
        const raw = readArray(ctx, `${where}.pathVector`, value['pathVector']);
        if (
            raw !== null &&
            (raw.length !== PATH_VECTOR_DIMENSIONS ||
                raw.some((entry) => typeof entry !== 'number' || !Number.isInteger(entry) || entry < -127 || entry > 127))
        ) {
            ctx.errors.push(
                `${where}.pathVector: expected ${String(PATH_VECTOR_DIMENSIONS)} integers between -127 and 127`,
            );
        } else if (raw !== null) {
            pathVector = raw as number[];
        }
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
    return {
        id,
        bookId,
        text,
        ...(year === undefined ? {} : { year }),
        tagIds,
        ...(pathVector === undefined ? {} : { pathVector }),
    };
}

function validateMapLayout(ctx: Context, value: unknown): MapLayout | null {
    if (!isRecord(value)) {
        ctx.errors.push('map: expected an object');
        return null;
    }
    if (!checkKeys(ctx, 'map', value, ['version', 'points', 'labels', 'density', 'contours'])) {
        return null;
    }
    const version = readNonEmptyString(ctx, 'map.version', value['version']);
    const coordinate = (where: string, raw: unknown): number | null => {
        if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < 0 || raw > MAP_COORDINATE_MAX) {
            ctx.errors.push(`${where}: expected an integer between 0 and ${String(MAP_COORDINATE_MAX)}`);
            return null;
        }
        return raw;
    };

    const points: MapPoint[] = [];
    const pointsRaw = readArray(ctx, 'map.points', value['points']);
    if (pointsRaw !== null) {
        pointsRaw.forEach((entry, index) => {
            const where = `map.points[${index}]`;
            if (!isRecord(entry) || !checkKeys(ctx, where, entry, ['highlightId', 'x', 'y'])) {
                if (!isRecord(entry)) ctx.errors.push(`${where}: expected an object`);
                return;
            }
            const highlightId = readNonEmptyString(ctx, `${where}.highlightId`, entry['highlightId']);
            const x = coordinate(`${where}.x`, entry['x']);
            const y = coordinate(`${where}.y`, entry['y']);
            if (highlightId !== null && x !== null && y !== null) points.push({ highlightId, x, y });
        });
    }

    const labels: MapLabel[] = [];
    const labelsRaw = readArray(ctx, 'map.labels', value['labels']);
    if (labelsRaw !== null) {
        labelsRaw.forEach((entry, index) => {
            const where = `map.labels[${index}]`;
            if (!isRecord(entry) || !checkKeys(ctx, where, entry, ['tagId', 'x', 'y'])) {
                if (!isRecord(entry)) ctx.errors.push(`${where}: expected an object`);
                return;
            }
            const tagId = readNonEmptyString(ctx, `${where}.tagId`, entry['tagId']);
            const x = coordinate(`${where}.x`, entry['x']);
            const y = coordinate(`${where}.y`, entry['y']);
            if (tagId !== null && x !== null && y !== null) labels.push({ tagId, x, y });
        });
    }

    let density: MapDensity | null = null;
    const densityRaw = value['density'];
    if (!isRecord(densityRaw)) {
        ctx.errors.push('map.density: expected an object');
    } else if (checkKeys(ctx, 'map.density', densityRaw, ['columns', 'rows', 'values'])) {
        const columns = densityRaw['columns'];
        const rows = densityRaw['rows'];
        const values = readArray(ctx, 'map.density.values', densityRaw['values']);
        if (
            typeof columns !== 'number' || !Number.isInteger(columns) || columns < 8 || columns > 256 ||
            typeof rows !== 'number' || !Number.isInteger(rows) || rows < 8 || rows > 256
        ) {
            ctx.errors.push('map.density: columns and rows must be integers between 8 and 256');
        } else if (values !== null) {
            if (values.length !== columns * rows || values.some((entry) => typeof entry !== 'number' || !Number.isInteger(entry) || entry < 0 || entry > 255)) {
                ctx.errors.push('map.density.values: expected one 0..255 integer per grid cell');
            } else {
                density = { columns, rows, values: values as number[] };
            }
        }
    }

    const contours: MapContour[] = [];
    const contoursRaw = readArray(ctx, 'map.contours', value['contours']);
    if (contoursRaw !== null) {
        contoursRaw.forEach((entry, index) => {
            const where = `map.contours[${index}]`;
            if (!isRecord(entry) || !checkKeys(ctx, where, entry, ['level', 'segments'])) {
                if (!isRecord(entry)) ctx.errors.push(`${where}: expected an object`);
                return;
            }
            const level = entry['level'];
            const segmentsRaw = readArray(ctx, `${where}.segments`, entry['segments']);
            const validLevel = typeof level === 'number' && Number.isInteger(level) && level >= 1 && level <= 255;
            if (!validLevel) {
                ctx.errors.push(`${where}.level: expected an integer between 1 and 255`);
            }
            const segments: number[][] = [];
            for (const [segmentIndex, segment] of (segmentsRaw ?? []).entries()) {
                if (!Array.isArray(segment) || segment.length !== 4 || segment.some((part) => typeof part !== 'number' || !Number.isInteger(part) || part < 0 || part > MAP_COORDINATE_MAX)) {
                    ctx.errors.push(`${where}.segments[${segmentIndex}]: expected four map coordinates`);
                    continue;
                }
                segments.push(segment as number[]);
            }
            if (validLevel) contours.push({ level: level as number, segments });
        });
    }

    if (version === null || density === null) return null;
    return { version, points, labels, density, contours };
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
    const { highlights, books, themes, tags } = snapshot;
    if (highlights.length === 0 && books.length === 0) {
        // The public snapshot is intentionally empty until the release decision is made.
        return;
    }

    const highlightsPerBook = new Map<string, number>();
    const booksPerTheme = new Map<string, Set<string>>();
    const highlightsPerTheme = new Map<string, number>();
    const booksById = new Map(books.map((book) => [book.id, book]));
    const taggedHighlights = new Map<string, number>();
    const taggedBooks = new Map<string, Set<string>>();
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
        for (const tagId of highlight.tagIds) {
            taggedHighlights.set(tagId, (taggedHighlights.get(tagId) ?? 0) + 1);
            const booksForTag = taggedBooks.get(tagId) ?? new Set<string>();
            booksForTag.add(highlight.bookId);
            taggedBooks.set(tagId, booksForTag);
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

    const untaggedHighlights = highlights.filter((highlight) => highlight.tagIds.length === 0).length;
    if (untaggedHighlights > 0) {
        ctx.warnings.push(`content: ${String(untaggedHighlights)} highlight(s) have no reviewed topic tag in this pilot`);
    }
    for (const tag of tags) {
        const highlightCount = taggedHighlights.get(tag.id) ?? 0;
        const bookCount = taggedBooks.get(tag.id)?.size ?? 0;
        if (highlightCount === 0) {
            ctx.warnings.push(`content: topic tag ${tag.id} has no reviewed highlight`);
        } else if (bookCount < 3 || highlightCount < 5) {
            ctx.warnings.push(
                `content: topic tag ${tag.id} connects ${String(bookCount)} book(s) and ${String(highlightCount)} highlight(s); public paths should normally reach 3 books and 5 highlights`,
            );
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
    if (!checkKeys(ctx, 'snapshot', input, ['schemaVersion', 'visibility', 'owner', 'themes', 'tags', 'books', 'highlights', 'map'])) {
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

    const tagsRaw = readArray(ctx, 'tags', input['tags']);
    const tags: TopicTag[] = [];
    if (tagsRaw !== null) {
        tagsRaw.forEach((entry, index) => {
            const tag = validateTopicTag(ctx, index, entry);
            if (tag !== null) {
                tags.push(tag);
            }
        });
        pushDuplicateErrors(
            ctx,
            'tags',
            tags.map((tag) => tag.id),
        );
        const duplicateTitles = tags.map((tag) => tag.title).filter((title, index, all) => all.indexOf(title) !== index);
        for (const title of new Set(duplicateTitles)) {
            ctx.errors.push(`tags: duplicate title ${title}`);
        }
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

    const map = input['map'] === undefined ? undefined : validateMapLayout(ctx, input['map']);

    const bookIds = new Set(books.map((book) => book.id));
    const highlightsById = new Map(highlights.map((highlight) => [highlight.id, highlight]));
    const themeIds = new Set(themes.map((theme) => theme.id));
    const tagIds = new Set(tags.map((tag) => tag.id));
    const tagOrder = new Map(tags.map((tag, index) => [tag.id, index]));
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
        for (const tagId of highlight.tagIds) {
            if (!tagIds.has(tagId)) {
                ctx.errors.push(`highlights: ${highlight.id} references unknown topic tag ${tagId}`);
            }
        }
        const sortedTagIds = [...highlight.tagIds].sort(
            (left, right) => (tagOrder.get(left) ?? Number.MAX_SAFE_INTEGER) - (tagOrder.get(right) ?? Number.MAX_SAFE_INTEGER),
        );
        if (sortedTagIds.join('\0') !== highlight.tagIds.join('\0')) {
            ctx.errors.push(`highlights: ${highlight.id} tagIds must follow snapshot tag order`);
        }
    }

    if (map !== undefined && map !== null) {
        pushDuplicateErrors(ctx, 'map.points', map.points.map((point) => point.highlightId));
        pushDuplicateErrors(ctx, 'map.labels', map.labels.map((label) => label.tagId));
        const mappedHighlightIds = new Set(map.points.map((point) => point.highlightId));
        for (const point of map.points) {
            if (!highlightsById.has(point.highlightId)) {
                ctx.errors.push(`map.points: references unknown highlight ${point.highlightId}`);
            }
        }
        for (const highlight of highlights) {
            if (!mappedHighlightIds.has(highlight.id)) {
                ctx.errors.push(`map.points: missing highlight ${highlight.id}`);
            }
        }
        for (const label of map.labels) {
            if (!tagIds.has(label.tagId)) {
                ctx.errors.push(`map.labels: references unknown topic tag ${label.tagId}`);
            }
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
        tags,
        books,
        highlights,
        ...(map === undefined || map === null ? {} : { map }),
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
