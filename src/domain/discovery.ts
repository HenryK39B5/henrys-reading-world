/**
 * Fair Discovery Engine (docs/10 §6, docs/11 §4).
 *
 * The engine draws in two stages: first a book that belongs to the scope, then a passage inside that
 * book. The v1 selector drew uniformly over passages instead, so a book with 200 passages was offered
 * roughly 100× more often than a book with 2 — the stage would circle the few heaviest books.
 *
 * What the engine is allowed to weigh, and nothing else:
 *
 *   1. the scope (all books, one shelf, or the book already on screen);
 *   2. exposure: a book or passage not yet drawn in this scope's cycle comes before a repeat;
 *   3. mechanical passage length, so a wall of text does not follow another wall of text.
 *
 * It never scores meaning, quality, representativeness or "how much this says about the reader".
 * Every entry point is pure and RNG-injected, so a fixed input always produces a fixed draw.
 */
import { countNonWhitespace, MEDIUM_MAX } from './length.ts';
import {
    ALL_SCOPE,
    EMPTY_CYCLE,
    bookCycleKey,
    bookInScope,
    scopeKeyOf,
    type CycleKey,
    type CycleState,
    type SelectedPassage,
    type SelectionInput,
    type SelectionReason,
    type SelectionResult,
} from './selection.ts';
import type { Book, Highlight, LengthBand } from './types.ts';

/**
 * A passage of this length is preferred on the opening screen and after a long one. This is the only
 * length rule in the product and it inspects nothing but character count (docs/10 §6).
 */
const READABLE_MIN = 20;
const READABLE_MAX = MEDIUM_MAX;

function passageLength(text: string): number {
    return countNonWhitespace(text);
}

function isReadable(text: string): boolean {
    const length = passageLength(text);
    return length >= READABLE_MIN && length <= READABLE_MAX;
}

/** Ids are zero-padded, so a string comparison is also the stable numeric order. */
function byId(left: Highlight, right: Highlight): number {
    return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}

/** Uniform draw over an already-ordered list; the tail is clamped so no candidate is unreachable. */
function pickUniform<T>(items: T[], rng: () => number): T | null {
    if (items.length === 0) {
        return null;
    }
    const raw = Math.floor(rng() * items.length);
    return items[Math.min(Math.max(raw, 0), items.length - 1)] ?? null;
}

/**
 * Mechanical length preference. The length rule only re-orders candidates inside a tier that exposure
 * has already chosen, and it relaxes completely when it would leave nothing to show.
 */
function preferLength(candidates: Highlight[], band: LengthBand | null): Highlight[] {
    if (candidates.length <= 1) {
        return candidates;
    }
    const wanted =
        band === null ? isReadable : band === 'long' ? (text: string) => passageLength(text) <= READABLE_MAX : null;
    if (wanted === null) {
        return candidates;
    }
    const preferred = candidates.filter((highlight) => wanted(highlight.text));
    return preferred.length > 0 ? preferred : candidates;
}

type BookPool = {
    book: Book;
    passages: Highlight[];
};

/** Books of the scope that actually carry passages, in stable id order. */
function drawablePools(input: SelectionInput): BookPool[] {
    const passagesByBook = new Map<string, Highlight[]>();
    for (const highlight of input.highlights) {
        const list = passagesByBook.get(highlight.bookId);
        if (list === undefined) {
            passagesByBook.set(highlight.bookId, [highlight]);
        } else {
            list.push(highlight);
        }
    }

    const pools: BookPool[] = [];
    for (const book of [...input.books].sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0))) {
        if (!bookInScope(book, input.scope)) {
            continue;
        }
        const passages = passagesByBook.get(book.id);
        if (passages === undefined || passages.length === 0) {
            continue;
        }
        pools.push({ book, passages: [...passages].sort(byId) });
    }
    return pools;
}

type BookChoice = { pool: BookPool; bookCycleReset: boolean };

/**
 * Stage one: a book. Inside the chosen tier every book has the same chance, regardless of how many
 * passages it holds — this is the whole point of choosing a book before a passage.
 *
 * Length preference is deliberately absent here. Filtering books by "can it offer a readable line?"
 * before the draw would hand the whole opening to the books whose passages happen to sit inside one
 * length band, and the four books of the real library that hold nothing in that band would never open
 * at all. The fair draw picks the book; only then does length re-order that book's passages.
 */
function chooseBook(pools: BookPool[], input: SelectionInput, cycle: CycleState): BookChoice | null {
    const others = input.currentBookId === null ? pools : pools.filter((pool) => pool.book.id !== input.currentBookId);
    // docs/11 §4.2: while more than one book can serve, stay off the book on screen.
    const candidates = others.length > 0 ? others : pools;

    const hasUnseen = (pool: BookPool): boolean =>
        pool.passages.some((highlight) => highlight.id !== input.currentId && !cycle.highlightIds.includes(highlight.id));
    const fresh = candidates.filter((pool) => !cycle.bookIds.includes(pool.book.id));
    const reused = candidates.filter((pool) => cycle.bookIds.includes(pool.book.id));

    // Tiers, in the order this product needs them (docs/10 §6):
    //   1. a book not drawn yet in this round that still has something unseen — variety and freshness;
    //   2. a book already drawn in this round that still has something unseen — freshness;
    //   3. a book not drawn yet in this round — variety, on a round that has run out of new passages;
    //   4. any other book — an unavoidable repeat, reached only once everything has been shown through.
    const tier =
        [fresh.filter(hasUnseen), reused.filter(hasUnseen), fresh, reused].find((list) => list.length > 0) ?? candidates;
    const picked = pickUniform(tier, input.rng);
    if (picked === null) {
        return null;
    }
    // Reusing a book already drawn in this round restarts the round with it.
    return { pool: picked, bookCycleReset: cycle.bookIds.includes(picked.book.id) };
}

type PassageChoice = { passage: Highlight; cycleReset: boolean };

/**
 * Stage two: a passage of the chosen book. Unseen material always wins; a repeat only happens when the
 * scope has nothing else, and then the passage cycle restarts so the round stays bounded.
 */
function choosePassage(
    pool: BookPool,
    input: SelectionInput,
    cycle: CycleState,
    options: { repeatsAllowed: boolean },
): PassageChoice | null {
    const isCurrent = (highlight: Highlight) => highlight.id === input.currentId;
    const isSeen = (highlight: Highlight) => cycle.highlightIds.includes(highlight.id);
    const notRecent = (highlight: Highlight) => !input.recentIds.includes(highlight.id);

    const unseen = pool.passages.filter((highlight) => !isCurrent(highlight) && !isSeen(highlight));
    const previously = pool.passages.filter((highlight) => !isCurrent(highlight));
    const ladder = options.repeatsAllowed
        ? [unseen.filter(notRecent), unseen, previously.filter(notRecent), previously]
        : [unseen.filter(notRecent), unseen];

    const tier = ladder.find((list) => list.length > 0);
    if (tier === undefined) {
        return null;
    }
    const passage = pickUniform(preferLength(tier, input.currentBand), input.rng);
    if (passage === null) {
        return null;
    }
    return { passage, cycleReset: unseen.length === 0 };
}

function selected(
    id: string,
    bookId: string,
    reason: SelectionReason,
    scopeKey: CycleKey,
    flags: { cycleReset?: boolean; bookCycleReset?: boolean } = {},
): SelectedPassage {
    const result: SelectedPassage = { kind: 'selected', id, bookId, reason, scopeKey };
    if (flags.cycleReset === true) {
        result.cycleReset = true;
    }
    if (flags.bookCycleReset === true) {
        result.bookCycleReset = true;
    }
    return result;
}

/**
 * The stage selector: `scope -> eligible books -> choose book -> eligible passages -> choose passage`.
 *
 * A transient in-book move never crosses into another book and never restarts its own cycle, so the
 * visitor is told the book is exhausted instead of being shown the same passage twice.
 */
export function selectNext(input: SelectionInput): SelectionResult {
    const scopeKey = scopeKeyOf(input.scope);
    const pools = drawablePools(input);
    if (pools.length === 0) {
        return { kind: 'empty' };
    }

    if (input.scope.kind === 'book') {
        const pool = pools[0];
        if (pool === undefined) {
            return { kind: 'empty' };
        }
        const choice = choosePassage(pool, input, input.cycle, { repeatsAllowed: false });
        return choice === null
            ? { kind: 'exhausted-book' }
            : selected(choice.passage.id, pool.book.id, 'book', scopeKey);
    }

    const bookChoice = chooseBook(pools, input, input.cycle);
    if (bookChoice === null) {
        return { kind: 'empty' };
    }
    const passageChoice = choosePassage(bookChoice.pool, input, input.cycle, { repeatsAllowed: true });
    if (passageChoice === null) {
        // The scope's single passage is the one already on screen.
        return { kind: 'only-current' };
    }
    return selected(
        passageChoice.passage.id,
        bookChoice.pool.book.id,
        input.scope.kind === 'theme' ? 'theme' : 'all',
        scopeKey,
        { cycleReset: passageChoice.cycleReset, bookCycleReset: bookChoice.bookCycleReset },
    );
}

/**
 * The first screen.
 *
 * docs/11 replaced the v1 opening flag with a fair draw, so the opening is simply the first draw of
 * `all`: one book drawn fairly from the whole library, then a readable passage of that book when it has
 * one. A book that holds nothing in the readable band still opens — its own passage is shown instead of
 * being filtered out of the draw.
 */
export function selectOpening(books: Book[], highlights: Highlight[], rng: () => number): SelectionResult {
    return selectNext({
        books,
        highlights,
        currentId: null,
        currentBookId: null,
        scope: ALL_SCOPE,
        cycle: EMPTY_CYCLE,
        currentBand: null,
        recentIds: [],
        rng,
    });
}

/**
 * One random passage of one book, for a book room's `随机看一处`.
 *
 * This is deliberately not the stage contract: a visitor who opened a book wants another line *from
 * that book*, so nothing new always beats a dead end, and a book with a single passage reports itself
 * instead of pretending there is more.
 */
export function selectRandomFromBook(input: {
    books: Book[];
    highlights: Highlight[];
    bookId: string;
    currentId: string | null;
    recentIds: string[];
    cycle: CycleState;
    rng: () => number;
}): SelectionResult {
    const passages = input.highlights.filter((highlight) => highlight.bookId === input.bookId).sort(byId);
    if (passages.length === 0) {
        return { kind: 'empty' };
    }
    const pool: BookPool = {
        book: input.books.find((book) => book.id === input.bookId) ?? {
            id: input.bookId,
            title: '',
            author: '',
            themeIds: [],
        },
        passages,
    };
    const choice = choosePassage(
        pool,
        {
            books: input.books,
            highlights: input.highlights,
            currentId: input.currentId,
            currentBookId: input.bookId,
            scope: { kind: 'book', bookId: input.bookId },
            cycle: input.cycle,
            currentBand: null,
            recentIds: input.recentIds,
            rng: input.rng,
        },
        input.cycle,
        { repeatsAllowed: true },
    );
    if (choice === null) {
        return { kind: 'only-current' };
    }
    return selected(choice.passage.id, input.bookId, 'book', bookCycleKey(input.bookId));
}
