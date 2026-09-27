// Read-only R4-K research rule. The model-neighbor list, not the published map, determines choices.
export const routeBands = [
    { name: 'inner', title: '近端', start: 1, end: 4 },
    { name: 'side', title: '侧边', start: 5, end: 10 },
    { name: 'outer', title: '外缘', start: 11, end: 16 },
];
const rhythm = ['inner', 'side', 'outer', 'side', 'inner', 'outer'];

export function mulberry32(seed) {
    let state = seed >>> 0;
    return () => {
        state += 0x6d2b79f5;
        let value = state;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
    };
}

/** Hash only the frozen sequence of real IDs; unrelated UI/mode/2D coordinates never influence the draw. */
export function historySeed(trail) {
    let hash = 0x811c9dc5;
    for (const char of `route-next-v1|${trail.join('|')}`) {
        hash ^= char.charCodeAt(0);
        hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
}

function eligible(data, trail) {
    if (!Array.isArray(trail) || !trail.length || new Set(trail).size !== trail.length || trail.some((id) => !data.points[id])) throw new Error('invalid reading trail');
    const fromId = trail.at(-1); const nominations = data.neighbors[fromId];
    if (!Array.isArray(nominations) || nominations.length > 16 || new Set(nominations.map((item) => item.id)).size !== nominations.length ||
        nominations.some((item) => !data.points[item.id] || item.id === fromId || !Number.isFinite(item.score))) throw new Error('invalid original-space neighbors');
    const seen = new Set(trail);
    return nominations.map((item, index) => ({ id: item.id, score: item.score, rank: index + 1 })).filter((item) =>
        !seen.has(item.id) && data.points[item.id].bookId !== data.points[fromId].bookId);
}

function freshFirst(data, trail, pool) {
    const books = new Set(trail.map((id) => data.points[id].bookId));
    const fresh = pool.filter((item) => !books.has(data.points[item.id].bookId));
    return fresh.length ? fresh : pool;
}

/** Same rank-band rhythm and cross-book/first-new-book constraints as R4-G, newly seeded per full history. */
export function chooseNext(data, trail, rng) {
    if (trail.length > rhythm.length) return { status: 'limit', candidate: null, expectedBand: null, bandFallback: false, bookFallback: false, available: 0 };
    const options = eligible(data, trail);
    const expectedBand = rhythm[trail.length - 1];
    if (!options.length) return { status: 'dead-end', candidate: null, expectedBand, bandFallback: false, bookFallback: false, available: 0 };
    const band = routeBands.find((entry) => entry.name === expectedBand);
    const inBand = options.filter((item) => item.rank >= band.start && item.rank <= band.end);
    const pool = inBand.length ? inBand : options;
    const usedBooks = new Set(trail.map((id) => data.points[id].bookId));
    const bookFallback = !pool.some((item) => !usedBooks.has(data.points[item.id].bookId));
    const fair = freshFirst(data, trail, pool);
    const draw = rng();
    if (!Number.isFinite(draw) || draw < 0 || draw >= 1) throw new Error('invalid random draw');
    return { status: 'ready', candidate: fair[Math.floor(draw * fair.length)], expectedBand,
        bandFallback: !inBand.length, bookFallback,
        available: options.length };
}

export function deterministicNext(data, trail) { return chooseNext(data, trail, mulberry32(historySeed(trail))); }

/** When expanded, the auto destination is represented in its real rank band rather than silently hidden. */
export function visibleForks(data, trail, automatic = deterministicNext(data, trail)) {
    if (automatic.status === 'limit') return routeBands.map((band) => ({ band: band.name, title: band.title, count: 0, candidate: null, isDefault: false }));
    const options = eligible(data, trail);
    return routeBands.map((band) => {
        const inBand = options.filter((item) => item.rank >= band.start && item.rank <= band.end);
        const fair = freshFirst(data, trail, inBand);
        const automaticInBand = automatic.candidate && inBand.some((item) => item.id === automatic.candidate.id);
        return { band: band.name, title: band.title, count: inBand.length,
            candidate: automaticInBand ? automatic.candidate : fair[0] ?? null,
            isDefault: !!automaticInBand };
    });
}
