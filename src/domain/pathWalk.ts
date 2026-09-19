import { pickUniform } from './discovery.ts';
import type { Highlight } from './types.ts';

export type PathRhythm = 'uniform' | 'semantic';
export type PathPacing = 'uniform' | 'near' | 'middle' | 'far';

export type PathWalkState = {
    tagId: string;
    currentId: string | null;
    seenIds: string[];
    /** Books already selected in the current fair book cycle. */
    bookCycleIds: string[];
    complete: boolean;
    rounds: number;
    rhythm: PathRhythm;
    lastPacing: PathPacing;
};

export type PathProgress = { seen: number; total: number; complete: boolean };

function byId(left: Highlight, right: Highlight): number {
    return left.id.localeCompare(right.id);
}

export function pathCandidates(highlights: readonly Highlight[], tagId: string): Highlight[] {
    return highlights.filter((highlight) => highlight.tagIds.includes(tagId)).sort(byId);
}

function vectorSimilarity(left: readonly number[], right: readonly number[]): number | null {
    if (left.length === 0 || left.length !== right.length) {
        return null;
    }
    let dot = 0;
    let leftNorm = 0;
    let rightNorm = 0;
    for (let index = 0; index < left.length; index += 1) {
        const a = left[index];
        const b = right[index];
        if (a === undefined || b === undefined) {
            return null;
        }
        dot += a * b;
        leftNorm += a * a;
        rightNorm += b * b;
    }
    return leftNorm === 0 || rightNorm === 0 ? null : dot / Math.sqrt(leftNorm * rightNorm);
}

function semanticPick(
    candidates: Highlight[],
    current: Highlight | undefined,
    rhythm: PathRhythm,
    rng: () => number,
): { highlight: Highlight | null; pacing: PathPacing } {
    if (rhythm !== 'semantic' || current?.pathVector === undefined || candidates.length < 3) {
        return { highlight: pickUniform(candidates, rng), pacing: 'uniform' };
    }
    const ranked = candidates
        .map((highlight) => ({
            highlight,
            similarity:
                highlight.pathVector === undefined
                    ? null
                    : vectorSimilarity(current.pathVector ?? [], highlight.pathVector),
        }));
    if (ranked.some((entry) => entry.similarity === null)) {
        return { highlight: pickUniform(candidates, rng), pacing: 'uniform' };
    }
    ranked.sort((left, right) => {
        const score = (right.similarity ?? 0) - (left.similarity ?? 0);
        return score === 0 ? byId(left.highlight, right.highlight) : score;
    });
    const width = Math.ceil(ranked.length / 3);
    const near = ranked.slice(0, width).map((entry) => entry.highlight);
    const middle = ranked.slice(width, width * 2).map((entry) => entry.highlight);
    const far = ranked.slice(width * 2).map((entry) => entry.highlight);
    // Avoid the single closest near-duplicate and the single furthest outlier when the band has room.
    const softenedNear = near.length > 1 ? near.slice(1) : near;
    const softenedFar = far.length > 1 ? far.slice(0, -1) : far;
    const bands: Array<{ pacing: Exclude<PathPacing, 'uniform'>; items: Highlight[] }> = [
        { pacing: 'near', items: softenedNear },
        { pacing: 'middle', items: middle },
        { pacing: 'far', items: softenedFar },
    ].filter((band) => band.items.length > 0) as Array<{
        pacing: Exclude<PathPacing, 'uniform'>;
        items: Highlight[];
    }>;
    const band = pickUniform(bands, rng);
    if (band === null) {
        return { highlight: pickUniform(candidates, rng), pacing: 'uniform' };
    }
    return { highlight: pickUniform(band.items, rng), pacing: band.pacing };
}

function openRound(
    tagId: string,
    candidates: Highlight[],
    rhythm: PathRhythm,
    rounds: number,
    rng: () => number,
    seedId?: string,
): PathWalkState {
    const seeded = seedId === undefined ? undefined : candidates.find((highlight) => highlight.id === seedId);
    const first = seeded ?? pickUniform(candidates, rng);
    if (first === null || first === undefined) {
        return {
            tagId,
            currentId: null,
            seenIds: [],
            bookCycleIds: [],
            complete: true,
            rounds,
            rhythm,
            lastPacing: 'uniform',
        };
    }
    return {
        tagId,
        currentId: first.id,
        seenIds: [first.id],
        bookCycleIds: [first.bookId],
        complete: candidates.length <= 1,
        rounds,
        rhythm,
        lastPacing: 'uniform',
    };
}

export function startPathWalk(
    tagId: string,
    highlights: readonly Highlight[],
    rhythm: PathRhythm,
    rng: () => number,
    seedId?: string,
): PathWalkState {
    return openRound(tagId, pathCandidates(highlights, tagId), rhythm, 1, rng, seedId);
}

export function nextInPathWalk(
    state: PathWalkState,
    highlights: readonly Highlight[],
    rng: () => number,
): PathWalkState {
    if (state.complete) {
        return state;
    }
    const all = pathCandidates(highlights, state.tagId);
    const unseen = all.filter((highlight) => !state.seenIds.includes(highlight.id));
    if (unseen.length === 0) {
        return { ...state, complete: true };
    }
    const current = all.find((highlight) => highlight.id === state.currentId);
    const books = [...new Set(unseen.map((highlight) => highlight.bookId))].sort();
    let fairBooks = books.filter((bookId) => !state.bookCycleIds.includes(bookId));
    const cycleReset = fairBooks.length === 0;
    if (cycleReset) {
        fairBooks = books;
    }
    if (fairBooks.length > 1 && current !== undefined) {
        const withoutCurrent = fairBooks.filter((bookId) => bookId !== current.bookId);
        if (withoutCurrent.length > 0) {
            fairBooks = withoutCurrent;
        }
    }
    const chosenBook = pickUniform(fairBooks, rng);
    if (chosenBook === null) {
        return { ...state, complete: true };
    }
    const inBook = unseen.filter((highlight) => highlight.bookId === chosenBook);
    const choice = semanticPick(inBook, current, state.rhythm, rng);
    if (choice.highlight === null) {
        return { ...state, complete: true };
    }
    const seenIds = [...state.seenIds, choice.highlight.id];
    const bookCycleIds = cycleReset
        ? [choice.highlight.bookId]
        : state.bookCycleIds.includes(choice.highlight.bookId)
          ? state.bookCycleIds
          : [...state.bookCycleIds, choice.highlight.bookId];
    return {
        ...state,
        currentId: choice.highlight.id,
        seenIds,
        bookCycleIds,
        complete: seenIds.length >= all.length,
        lastPacing: choice.pacing,
    };
}

export function restartPathWalk(
    state: PathWalkState,
    highlights: readonly Highlight[],
    rng: () => number,
): PathWalkState {
    return openRound(state.tagId, pathCandidates(highlights, state.tagId), state.rhythm, state.rounds + 1, rng);
}

/** Switches the hard tag scope while retaining the intersection passage as the first point. */
export function branchPathWalk(
    state: PathWalkState,
    nextTagId: string,
    highlights: readonly Highlight[],
    rhythm: PathRhythm,
    rng: () => number,
): PathWalkState {
    const current = highlights.find((highlight) => highlight.id === state.currentId);
    const seedId = current?.tagIds.includes(nextTagId) === true ? current.id : undefined;
    return startPathWalk(nextTagId, highlights, rhythm, rng, seedId);
}

export function pathProgress(state: PathWalkState, highlights: readonly Highlight[]): PathProgress {
    const total = pathCandidates(highlights, state.tagId).length;
    const seen = Math.min(state.seenIds.length, total);
    return { seen, total, complete: state.complete || seen >= total };
}

export function pathRound(
    tagId: string,
    highlights: readonly Highlight[],
    rhythm: PathRhythm,
    rng: () => number,
): string[] {
    let state = startPathWalk(tagId, highlights, rhythm, rng);
    const ids = state.currentId === null ? [] : [state.currentId];
    const total = pathCandidates(highlights, tagId).length;
    for (let guard = 0; guard <= total + 1 && !state.complete; guard += 1) {
        state = nextInPathWalk(state, highlights, rng);
        if (state.currentId !== null && ids.at(-1) !== state.currentId) {
            ids.push(state.currentId);
        }
    }
    return ids;
}
