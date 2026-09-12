import { countNonWhitespace, hasOriginalLineBreak, lengthBand } from './length.ts';
import {
    SNAPSHOT_SCHEMA_VERSION,
    type Book,
    type Highlight,
    type Owner,
    type QualityScore,
    type Snapshot,
    type Topic,
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
    topic: /^t-\d{3,}$/u,
    highlight: /^h-\d{3,}$/u,
};

const COVER_PATTERN = /^covers\/[a-z0-9][a-z0-9._-]*\.(?:jpg|jpeg|png|webp)$/u;

type Context = {
    errors: string[];
    warnings: string[];
    currentYear: number;
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

function readBoolean(ctx: Context, where: string, value: unknown): boolean | null {
    if (typeof value !== 'boolean') {
        ctx.errors.push(`${where}: expected a boolean`);
        return null;
    }
    return value;
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

function validateBook(ctx: Context, index: number, value: unknown): Book | null {
    const where = `books[${index}]`;
    if (!isRecord(value)) {
        ctx.errors.push(`${where}: expected an object`);
        return null;
    }
    if (!checkKeys(ctx, where, value, ['id', 'title', 'author', 'description', 'coverPath'])) {
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
    if (coverPath !== undefined && !COVER_PATTERN.test(coverPath)) {
        ctx.errors.push(`${where}.coverPath: expected a local covers/ asset path without query or traversal`);
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
    };
}

function validateTopic(ctx: Context, index: number, value: unknown): Topic | null {
    const where = `topics[${index}]`;
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
    if (id !== null && !ID_PATTERNS.topic.test(id)) {
        ctx.errors.push(`${where}.id: expected an id like t-001`);
    }
    if (id === null || title === null) {
        return null;
    }
    return description === undefined ? { id, title } : { id, title, description };
}

function validateHighlight(ctx: Context, index: number, value: unknown): Highlight | null {
    const where = `highlights[${index}]`;
    if (!isRecord(value)) {
        ctx.errors.push(`${where}: expected an object`);
        return null;
    }
    if (
        !checkKeys(ctx, where, value, [
            'id',
            'bookId',
            'text',
            'year',
            'topicIds',
            'qualityScore',
            'standaloneReadable',
            'pinned',
            'openingCandidate',
            'surpriseCandidate',
        ])
    ) {
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

    const topicIdsRaw = readArray(ctx, `${where}.topicIds`, value['topicIds']);
    const topicIds: string[] = [];
    if (topicIdsRaw !== null) {
        for (const entry of topicIdsRaw) {
            if (typeof entry !== 'string' || entry.length === 0) {
                ctx.errors.push(`${where}.topicIds: expected topic id strings`);
                continue;
            }
            if (topicIds.includes(entry)) {
                ctx.errors.push(`${where}.topicIds: duplicate reference ${entry}`);
                continue;
            }
            topicIds.push(entry);
        }
    }

    const scoreRaw = value['qualityScore'];
    let qualityScore: QualityScore | null = null;
    if (typeof scoreRaw !== 'number' || !Number.isInteger(scoreRaw) || scoreRaw < 1 || scoreRaw > 5) {
        ctx.errors.push(`${where}.qualityScore: expected an integer from 1 to 5`);
    } else {
        qualityScore = scoreRaw as QualityScore;
    }

    const standaloneReadable = readBoolean(ctx, `${where}.standaloneReadable`, value['standaloneReadable']);
    const pinned = readBoolean(ctx, `${where}.pinned`, value['pinned']);
    const openingCandidate = readBoolean(ctx, `${where}.openingCandidate`, value['openingCandidate']);
    const surpriseCandidate = readBoolean(ctx, `${where}.surpriseCandidate`, value['surpriseCandidate']);

    if (
        id === null ||
        bookId === null ||
        text === null ||
        qualityScore === null ||
        standaloneReadable === null ||
        pinned === null ||
        openingCandidate === null ||
        surpriseCandidate === null
    ) {
        return null;
    }

    return {
        id,
        bookId,
        text,
        ...(year === undefined ? {} : { year }),
        topicIds,
        qualityScore,
        standaloneReadable,
        pinned,
        openingCandidate,
        surpriseCandidate,
    };
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

/** Content coverage checks. These warn; they never relax the contract above. */
function checkContentCoverage(ctx: Context, snapshot: Snapshot): void {
    const { highlights, topics, books } = snapshot;

    if (highlights.length < 30) {
        ctx.warnings.push(`content: only ${highlights.length} highlights; the prototype target is 30-50`);
    }
    if (highlights.length > 50) {
        ctx.warnings.push(`content: ${highlights.length} highlights exceeds the prototype target of 30-50`);
    }
    if (topics.length < 3) {
        ctx.warnings.push(`content: ${topics.length} topics; at least 3 curated topics are expected`);
    }

    const highlightIdsByTopic = new Map<string, number>();
    const highlightsPerBook = new Map<string, number>();
    const bookIdsByTopic = new Map<string, Set<string>>();
    const years = new Set<number>();
    const bands = new Set<string>();
    let lineBreakSample = false;
    let openingCandidates = 0;
    let surpriseCandidates = 0;

    for (const highlight of highlights) {
        highlightsPerBook.set(highlight.bookId, (highlightsPerBook.get(highlight.bookId) ?? 0) + 1);
        if (highlight.year !== undefined) {
            years.add(highlight.year);
        }
        bands.add(lengthBand(highlight.text));
        if (hasOriginalLineBreak(highlight.text)) {
            lineBreakSample = true;
        }
        if (highlight.openingCandidate) {
            openingCandidates += 1;
        }
        if (highlight.surpriseCandidate) {
            surpriseCandidates += 1;
        }
        for (const topicId of highlight.topicIds) {
            highlightIdsByTopic.set(topicId, (highlightIdsByTopic.get(topicId) ?? 0) + 1);
            const set = bookIdsByTopic.get(topicId) ?? new Set<string>();
            set.add(highlight.bookId);
            bookIdsByTopic.set(topicId, set);
        }
    }

    for (const topic of topics) {
        const count = highlightIdsByTopic.get(topic.id) ?? 0;
        const bookCount = bookIdsByTopic.get(topic.id)?.size ?? 0;
        if (count < 2) {
            ctx.warnings.push(`content: topic ${topic.id} connects ${count} highlight(s); 2 or more are expected`);
        }
        if (bookCount < 2) {
            ctx.warnings.push(`content: topic ${topic.id} connects ${bookCount} book(s); 2 or more are expected`);
        }
    }

    if (openingCandidates < 3) {
        ctx.warnings.push(`content: ${openingCandidates} opening candidate(s); 3 or more are expected`);
    }
    if (surpriseCandidates < 1) {
        ctx.warnings.push('content: no surprise candidate is marked');
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
        ctx.warnings.push(`content: ${years.size} distinct year(s); cross-year range is not demonstrated`);
    }

    for (const book of books) {
        if ((highlightsPerBook.get(book.id) ?? 0) === 0) {
            ctx.warnings.push(`content: book ${book.id} has no highlights`);
        }
    }
}

export function validateSnapshot(input: unknown, options: ValidateOptions = {}): ValidationResult {
    const currentYear = options.currentYear ?? new Date().getFullYear();
    const ctx: Context = { errors: [], warnings: [], currentYear };
    if (!Number.isInteger(currentYear)) {
        throw new Error('currentYear must be an integer');
    }

    if (!isRecord(input)) {
        return { ok: false, errors: ['snapshot: expected an object'], warnings: [] };
    }
    if (!checkKeys(ctx, 'snapshot', input, ['schemaVersion', 'visibility', 'owner', 'books', 'topics', 'highlights'])) {
        return { ok: false, errors: ctx.errors, warnings: ctx.warnings };
    }
    if (input['schemaVersion'] !== SNAPSHOT_SCHEMA_VERSION) {
        ctx.errors.push(`snapshot.schemaVersion: expected ${SNAPSHOT_SCHEMA_VERSION}`);
    }

    const visibility = input['visibility'];
    if (visibility !== 'public' && visibility !== 'local-only') {
        ctx.errors.push('snapshot.visibility: expected "public" or "local-only"');
    } else if (options.expectedVisibility !== undefined && visibility !== options.expectedVisibility) {
        ctx.errors.push(`snapshot.visibility: expected "${options.expectedVisibility}"`);
    }

    const owner = validateOwner(ctx, input['owner']);

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

    const topicsRaw = readArray(ctx, 'topics', input['topics']);
    const topics: Topic[] = [];
    if (topicsRaw !== null) {
        topicsRaw.forEach((entry, index) => {
            const topic = validateTopic(ctx, index, entry);
            if (topic !== null) {
                topics.push(topic);
            }
        });
        pushDuplicateErrors(
            ctx,
            'topics',
            topics.map((topic) => topic.id),
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
    const topicIds = new Set(topics.map((topic) => topic.id));
    for (const highlight of highlights) {
        if (!bookIds.has(highlight.bookId)) {
            ctx.errors.push(`highlights: ${highlight.id} references unknown book ${highlight.bookId}`);
        }
        for (const topicId of highlight.topicIds) {
            if (!topicIds.has(topicId)) {
                ctx.errors.push(`highlights: ${highlight.id} references unknown topic ${topicId}`);
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
        books,
        topics,
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
    return `${highlight.id} (${countNonWhitespace(highlight.text)} chars, ${lengthBand(highlight.text)})`;
}
