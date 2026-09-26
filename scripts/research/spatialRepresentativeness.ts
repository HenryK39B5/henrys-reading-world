export type ResearchPoint = {
    id: string;
    bookId: string;
    x: number;
    y: number;
    tagIds: readonly string[];
};

export type Anchor = { x: number; y: number };

function distanceSquared(left: Anchor, right: Anchor): number {
    return (left.x - right.x) ** 2 + (left.y - right.y) ** 2;
}

function median(values: number[]): number {
    values.sort((left, right) => left - right);
    const middle = Math.floor(values.length / 2);
    return values.length % 2 === 1
        ? values[middle]!
        : Math.round((values[middle - 1]! + values[middle]!) / 2);
}

export function memberMedian(members: readonly ResearchPoint[]): Anchor {
    if (members.length === 0) throw new Error('anchor requires members');
    return { x: median(members.map((point) => point.x)), y: median(members.map((point) => point.y)) };
}

/** Exact Euclidean medoid; squared distance would select a different representative. */
export function memberMedoid(members: readonly ResearchPoint[]): ResearchPoint {
    if (members.length === 0) throw new Error('anchor requires members');
    const ordered = [...members].sort((left, right) => left.id.localeCompare(right.id));
    let best = ordered[0]!;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const candidate of ordered) {
        const total = ordered.reduce((sum, point) => sum + Math.sqrt(distanceSquared(candidate, point)), 0);
        if (total < bestDistance) {
            best = candidate;
            bestDistance = total;
        }
    }
    return best;
}

export function auditAnchor(points: readonly ResearchPoint[], tagId: string, anchor: Anchor, sizes = [15, 30, 60]) {
    const members = points.filter((point) => point.tagIds.includes(tagId));
    if (members.length === 0) throw new Error('audit requires members');
    const taggedTotal = points.filter((point) => point.tagIds.length > 0).length;
    const taggedPrevalence = members.length / taggedTotal;
    const ordered = points.map((point) => ({ point, distance: Math.sqrt(distanceSquared(anchor, point)) }))
        .sort((left, right) => left.distance - right.distance || left.point.id.localeCompare(right.point.id));
    return {
        anchor: { x: anchor.x, y: anchor.y },
        nearestMemberDistance: Math.min(...members.map((point) => Math.sqrt(distanceSquared(anchor, point)))),
        neighborhoods: sizes.map((requested) => {
            if (!Number.isInteger(requested) || requested < 1) throw new Error('neighborhood size must be positive');
            const neighbors = ordered.slice(0, requested);
            const supporting = neighbors.filter(({ point }) => point.tagIds.includes(tagId));
            const tagged = neighbors.filter(({ point }) => point.tagIds.length > 0);
            const counts = new Map<string, number>();
            for (const { point } of supporting) counts.set(point.bookId, (counts.get(point.bookId) ?? 0) + 1);
            const taggedSupportShare = tagged.length === 0 ? null : supporting.length / tagged.length;
            return {
                requested,
                actual: neighbors.length,
                radius: neighbors.at(-1)?.distance ?? 0,
                memberCount: supporting.length,
                memberShare: supporting.length / neighbors.length,
                taggedCount: tagged.length,
                untaggedCount: neighbors.length - tagged.length,
                taggedSupportShare,
                taggedLift: taggedSupportShare === null ? null : taggedSupportShare / taggedPrevalence,
                supportingBookCount: counts.size,
                largestSupportingBookShare: supporting.length === 0 ? null : Math.max(...counts.values()) / supporting.length,
                neighborIds: neighbors.map(({ point }) => point.id),
            };
        }),
    };
}
