export const BOOK_METADATA_OVERRIDES_SCHEMA_VERSION = 1;

export type BookMetadataOverride = {
    title?: string;
    author?: string;
    /** Private provenance for the correction. Never enters a snapshot. */
    note?: string;
};

export type BookMetadataOverrides = Map<string, BookMetadataOverride>;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function optionalText(value: unknown, where: string): string | undefined {
    if (value === undefined) {
        return undefined;
    }
    if (typeof value !== 'string' || value.trim().length === 0) {
        throw new Error(`${where}: expected a non-empty string`);
    }
    return value.trim();
}

/**
 * Parses private, project-ID based corrections without touching the captured source metadata.
 *
 * Only title and author can affect a snapshot. Notes stay in the private override file so every
 * correction remains explainable without leaking its provenance into the visitor payload.
 */
export function parseBookMetadataOverrides(candidate: unknown): BookMetadataOverrides {
    if (!isRecord(candidate)) {
        throw new Error('book metadata overrides: expected an object');
    }
    const topExtra = Object.keys(candidate).filter((key) => !['schemaVersion', 'books'].includes(key));
    if (topExtra.length > 0) {
        throw new Error(`book metadata overrides: unsupported field(s) ${topExtra.join(', ')}`);
    }
    if (candidate.schemaVersion !== BOOK_METADATA_OVERRIDES_SCHEMA_VERSION) {
        throw new Error(`book metadata overrides.schemaVersion: expected ${String(BOOK_METADATA_OVERRIDES_SCHEMA_VERSION)}`);
    }
    if (!isRecord(candidate.books)) {
        throw new Error('book metadata overrides.books: expected an object');
    }

    const result: BookMetadataOverrides = new Map();
    for (const [bookId, raw] of Object.entries(candidate.books)) {
        if (!/^b-\d+$/u.test(bookId)) {
            throw new Error(`book metadata overrides.books: invalid project book id ${bookId}`);
        }
        if (!isRecord(raw)) {
            throw new Error(`book metadata overrides.books.${bookId}: expected an object`);
        }
        const extra = Object.keys(raw).filter((key) => !['title', 'author', 'note'].includes(key));
        if (extra.length > 0) {
            throw new Error(`book metadata overrides.books.${bookId}: unsupported field(s) ${extra.join(', ')}`);
        }
        const title = optionalText(raw.title, `book metadata overrides.books.${bookId}.title`);
        const author = optionalText(raw.author, `book metadata overrides.books.${bookId}.author`);
        const note = optionalText(raw.note, `book metadata overrides.books.${bookId}.note`);
        if (title === undefined && author === undefined) {
            throw new Error(`book metadata overrides.books.${bookId}: expected title or author`);
        }
        result.set(bookId, {
            ...(title === undefined ? {} : { title }),
            ...(author === undefined ? {} : { author }),
            ...(note === undefined ? {} : { note }),
        });
    }
    return result;
}
