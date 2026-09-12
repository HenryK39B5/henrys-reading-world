/**
 * Serendipity Engine v0 (docs/04).
 *
 * A curation mechanism for the first screens, not a CTR optimiser: within a few draws the visitor
 * should see different sides of one reading world, with a mild sense of accident.
 *
 * Everything here is pure and deterministic: the same highlights, history and injected `rng`
 * always produce the same passage. No network, no model, no stored tracking.
 */
import { countNonWhitespace } from './length.ts';
import type { SelectionInput, SelectionResult, Selector } from './selection.ts';
import type { Highlight } from './types.ts';

export const OPENING_MIN_CHARS = 20;
export const OPENING_MAX_CHARS = 120;
export const SURPRISE_MIN_AGE_YEARS = 3;
export const OPENING_SHORTLIST = 5;
export const EXPLORE_SHORTLIST = 8;

/** Zero-padded ids compare correctly as strings, which keeps sampling order stable. */
function byId(left: Highlight, right: Highlight): number {
    return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}

function isWithin(count: number, min: number, max: number): boolean {
    return count >= min && count <= max;
}

function isOldEnough(highlight: Highlight, nowYear: number): boolean {
    return highlight.year !== undefined && nowYear - highlight.year >= SURPRISE_MIN_AGE_YEARS;
}

function topicsDisjoint(left: Highlight, right: Highlight): boolean {
    if (left.topicIds.length === 0 || right.topicIds.length === 0) {
        return false;
    }
    return !left.topicIds.some((topicId) => right.topicIds.includes(topicId));
}

/**
 * Prototype scoring (docs/04 §5). Session-local: it reads the exposure history rather than a
 * stored profile. `pinned` is a gentle preference and never overrides de-duplication.
 */
export function scoreCandidate(highlight: Highlight, current: Highlight | null, input: SelectionInput): number {
    const differentBook = current !== null && highlight.bookId !== current.bookId;
    const disjointTopics = current !== null && topicsDisjoint(highlight, current);
    const yearGap = current?.year !== undefined && highlight.year !== undefined && Math.abs(highlight.year - current.year) >= 3;
    const fresh = highlight.year !== undefined && input.nowYear - highlight.year <= 1;
    const sameBookInRecentHistory =
        current !== null &&
        input.historyIds
            .slice(-3)
            .some((id) => input.highlights.find((item) => item.id === id)?.bookId === highlight.bookId && id !== current.id);
    const priorExposures = input.historyIds.filter((id) => id === highlight.id).length;

    return (
        2 * highlight.qualityScore +
        (highlight.pinned ? 2 : 0) +
        (differentBook ? 3 : 0) +
        (disjointTopics ? 2 : 0) +
        (yearGap ? 1 : 0) +
        (fresh ? 1 : 0) -
        (sameBookInRecentHistory ? 2 : 0) -
        Math.min(priorExposures, 3)
    );
}

/** Roulette selection over `max(1, score)` weights, with the remainder falling to the last entry. */
export function weightedPick(candidates: Highlight[], scores: number[], rng: () => number): Highlight | null {
    if (candidates.length === 0) {
        return null;
    }
    const weights = scores.map((score) => Math.max(1, score));
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    const target = rng() * total;
    let cumulative = 0;
    for (let index = 0; index < candidates.length; index += 1) {
        cumulative += weights[index] ?? 1;
        if (target < cumulative) {
            return candidates[index] ?? null;
        }
    }
    return candidates[candidates.length - 1] ?? null;
}

function shortlist(candidates: Highlight[], current: Highlight | null, input: SelectionInput, size: number): Highlight[] {
    const scored = candidates
        .map((highlight) => ({ highlight, score: scoreCandidate(highlight, current, input) }))
        .sort((left, right) => right.score - left.score || byId(left.highlight, right.highlight));
    return scored.slice(0, size).map((entry) => entry.highlight);
}

function pickFrom(candidates: Highlight[], current: Highlight | null, input: SelectionInput, size: number): SelectionResult {
    const pool = shortlist(candidates, current, input, size);
    const scores = pool.map((highlight) => scoreCandidate(highlight, current, input));
    const picked = weightedPick(pool, scores, input.rng);
    return picked === null ? { kind: 'empty' } : { kind: 'selected', id: picked.id, reason: 'explore' };
}

type CyclePool = {
    candidates: Highlight[];
    cycleReset: boolean;
};

/**
 * De-duplication happens before any phase rule (docs/04 §3): freshness beats a good score.
 * When every passage has been seen, a new cycle starts rather than repeating the current one.
 */
function buildCyclePool(pool: Highlight[], input: SelectionInput): CyclePool {
    const unseen = pool.filter((highlight) => highlight.id !== input.currentId && !input.seenInCycle.includes(highlight.id)).sort(byId);
    if (unseen.length > 0) {
        return { candidates: unseen, cycleReset: false };
    }

    const rest = pool.filter((highlight) => highlight.id !== input.currentId).sort(byId);
    const recent = new Set(input.historyIds.slice(-3).filter((id) => id !== input.currentId));
    const withoutRecent = rest.filter((highlight) => !recent.has(highlight.id));
    // If every remaining passage is recent, the exclusion is relaxed back, earliest first.
    return { candidates: withoutRecent.length > 0 ? withoutRecent : rest, cycleReset: true };
}

type Tiers = { otherBookAndDisjoint: Highlight[]; otherBook: Highlight[]; surprisingOtherBook: Highlight[]; surprising: Highlight[] };

function buildTiers(candidates: Highlight[], current: Highlight | null, nowYear: number): Tiers {
    if (current === null) {
        return { otherBookAndDisjoint: [], otherBook: [], surprisingOtherBook: [], surprising: [] };
    }
    const isSurprising = (highlight: Highlight) => highlight.surpriseCandidate || isOldEnough(highlight, nowYear);
    return {
        otherBookAndDisjoint: candidates.filter((highlight) => highlight.bookId !== current.bookId && topicsDisjoint(highlight, current)),
        otherBook: candidates.filter((highlight) => highlight.bookId !== current.bookId),
        surprisingOtherBook: candidates.filter((highlight) => highlight.bookId !== current.bookId && isSurprising(highlight)),
        surprising: candidates.filter(isSurprising),
    };
}

/** Takes the first tier that still has something to show; the last tier is the whole pool. */
function firstNonEmpty(tiers: Highlight[][], fallback: Highlight[]): Highlight[] {
    for (const tier of tiers) {
        if (tier.length > 0) {
            return tier;
        }
    }
    return fallback;
}

function pickFromTiers(
    tiers: Highlight[][],
    fallback: Highlight[],
    current: Highlight | null,
    input: SelectionInput,
    reason: 'opening' | 'contrast' | 'surprise' | 'explore' | 'book',
): SelectionResult {
    const pool = firstNonEmpty(tiers, fallback);
    const result = pickFrom(pool, current, input, reason === 'explore' ? EXPLORE_SHORTLIST : OPENING_SHORTLIST);
    return result.kind === 'selected' ? { ...result, reason } : result;
}

export function selectNext(input: SelectionInput): SelectionResult {
    const current = input.currentId === null ? null : (input.highlights.find((item) => item.id === input.currentId) ?? null);

    if (input.scope.kind === 'book') {
        const scope = input.scope;
        const inBook = input.highlights.filter((highlight) => highlight.bookId === scope.bookId);
        if (inBook.length === 0) {
            return { kind: 'empty' };
        }
        const unseenInBook = inBook.filter((highlight) => highlight.id !== input.currentId && !input.seenInCycle.includes(highlight.id));
        if (unseenInBook.length === 0) {
            // No implicit cycle reset and no substitute from another book.
            return { kind: 'exhausted-book' };
        }
        return pickFromTiers([unseenInBook], unseenInBook, current, input, 'book');
    }

    // The global stage only samples independent passages; context-dependent lines stay in book and
    // topic lists, where their source is on screen.
    const globalPool = input.highlights.filter((highlight) => highlight.standaloneReadable);
    if (globalPool.length === 0) {
        return { kind: 'empty' };
    }
    if (globalPool.length === 1 && globalPool[0]?.id === input.currentId) {
        return { kind: 'only-current' };
    }

    const { candidates, cycleReset } = buildCyclePool(globalPool, input);
    if (candidates.length === 0) {
        return { kind: 'only-current' };
    }

    const draw = input.globalDrawCount;
    const tiers = buildTiers(candidates, current, input.nowYear);
    const sized = candidates.filter((highlight) =>
        isWithin(countNonWhitespace(highlight.text), OPENING_MIN_CHARS, OPENING_MAX_CHARS),
    );

    const phase: SelectionResult = (() => {
        if (draw === 0) {
            const withFlag = sized.filter((highlight) => highlight.openingCandidate);
            return pickFromTiers([withFlag, sized], candidates, current, input, 'opening');
        }
        if (draw === 1) {
            return pickFromTiers([tiers.otherBookAndDisjoint, tiers.otherBook], candidates, current, input, 'contrast');
        }
        if (draw === 2) {
            // Best effort only: a real surprise depends on the material, so it degrades cleanly.
            return pickFromTiers(
                [tiers.surprisingOtherBook, tiers.surprising, tiers.otherBookAndDisjoint, tiers.otherBook],
                candidates,
                current,
                input,
                'surprise',
            );
        }
        return pickFromTiers([], candidates, current, input, 'explore');
    })();

    return phase.kind === 'selected' ? { ...phase, ...(cycleReset ? { cycleReset: true } : {}) } : phase;
}

export const selectNextQuote: Selector = selectNext;

/** Small helper used by tests and diagnostics: the phase a draw belongs to. */
export function phaseForDraw(globalDrawCount: number): 'opening' | 'contrast' | 'surprise' | 'explore' {
    if (globalDrawCount === 0) {
        return 'opening';
    }
    if (globalDrawCount === 1) {
        return 'contrast';
    }
    if (globalDrawCount === 2) {
        return 'surprise';
    }
    return 'explore';
}
