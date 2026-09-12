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
import type { SelectionInput, SelectionResult, Selector, SessionTerritory } from './selection.ts';
import type { Highlight } from './types.ts';

export const OPENING_MIN_CHARS = 20;
export const OPENING_MAX_CHARS = 120;
export const OPENING_SHORTLIST = 5;
export const EXPLORE_SHORTLIST = 8;

/** Zero-padded ids compare correctly as strings, which keeps sampling order stable. */
function byId(left: Highlight, right: Highlight): number {
    return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}

function isWithin(count: number, min: number, max: number): boolean {
    return count >= min && count <= max;
}

/** What this session has already shown; derived from the exposure history, never stored. */
export function sessionTerritory(input: SelectionInput): SessionTerritory {
    const territory: SessionTerritory = { topicIds: new Set<string>(), bookIds: new Set<string>() };
    for (const id of input.historyIds) {
        const entry = input.highlights.find((item) => item.id === id);
        if (entry === undefined) {
            continue;
        }
        territory.bookIds.add(entry.bookId);
        for (const topicId of entry.topicIds) {
            territory.topicIds.add(topicId);
        }
    }
    return territory;
}

/** True when the passage opens a topic the visitor has not seen this session. */
function bringsNewTopic(highlight: Highlight, territory: SessionTerritory): boolean {
    return highlight.topicIds.some((topicId) => !territory.topicIds.has(topicId));
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
    const territory = sessionTerritory(input);
    const opensNewTerritory = bringsNewTopic(highlight, territory);
    const freshBook = !territory.bookIds.has(highlight.bookId);
    const sameBookInRecentHistory =
        current !== null &&
        input.historyIds
            .slice(-3)
            .some((id) => input.highlights.find((item) => item.id === id)?.bookId === highlight.bookId && id !== current.id);
    const priorExposures = input.historyIds.filter((id) => id === highlight.id).length;

    return (
        2 * highlight.qualityScore +
        (highlight.pinned ? 2 : 0) +
        (highlight.surpriseCandidate ? 1 : 0) +
        (differentBook ? 3 : 0) +
        (disjointTopics ? 2 : 0) +
        (opensNewTerritory ? 2 : 0) +
        (freshBook ? 1 : 0) -
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

type Tiers = {
    newTerritory: Highlight[];
    otherBookAndDisjoint: Highlight[];
    otherBook: Highlight[];
    surprisingOtherBook: Highlight[];
};

function buildTiers(candidates: Highlight[], current: Highlight | null, input: SelectionInput): Tiers {
    const territory = sessionTerritory(input);
    if (current === null) {
        return { newTerritory: [], otherBookAndDisjoint: [], otherBook: [], surprisingOtherBook: [] };
    }
    const otherBook = candidates.filter((highlight) => highlight.bookId !== current.bookId);
    return {
        newTerritory: otherBook.filter(
            (highlight) => bringsNewTopic(highlight, territory) && topicsDisjoint(highlight, current),
        ),
        otherBookAndDisjoint: candidates.filter(
            (highlight) => highlight.bookId !== current.bookId && topicsDisjoint(highlight, current),
        ),
        otherBook,
        surprisingOtherBook: otherBook.filter((highlight) => bringsNewTopic(highlight, territory)),
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
    const tiers = buildTiers(candidates, current, input);
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
            // The surprise is a change of territory: another book that opens a topic this visit has not
            // met yet. It degrades cleanly when the remaining material holds no new ground.
            return pickFromTiers(
                [tiers.newTerritory, tiers.surprisingOtherBook, tiers.otherBookAndDisjoint, tiers.otherBook],
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
