import { memberMedoid, type Anchor, type ResearchPoint } from './spatialRepresentativeness.ts';

export const DEVELOPMENT_TOPICS = ['tag-050', 'tag-026', 'tag-040', 'tag-041', 'tag-048', 'tag-031', 'tag-045', 'tag-020'] as const;
export const HOLDOUT_TOPICS = ['tag-034', 'tag-008', 'tag-052', 'tag-006', 'tag-017', 'tag-053', 'tag-004', 'tag-016'] as const;
export const STUDY_RADII = [250, 500, 750] as const;

function distance(left: Anchor, right: Anchor): number {
    return Math.hypot(left.x - right.x, left.y - right.y);
}

function samePosition(left: Anchor, right: Anchor): boolean {
    return left.x === right.x && left.y === right.y;
}

export function localMemberAnchor(members: readonly ResearchPoint[], radius: number, bookCapped: boolean): ResearchPoint {
    if (members.length === 0) throw new Error('anchor requires members');
    if (!Number.isFinite(radius) || radius <= 0) throw new Error('radius must be finite and positive');
    const candidates = [...members].sort((left, right) => left.id.localeCompare(right.id)).map((point) => {
        const byBook = new Map<string, number>();
        let totalDistance = 0;
        for (const other of members) {
            const separation = distance(point, other);
            totalDistance += separation;
            if (samePosition(point, other) || separation > radius) continue;
            const weight = Math.exp(-0.5 * (separation / (radius / 2)) ** 2);
            byBook.set(other.bookId, (byBook.get(other.bookId) ?? 0) + weight);
        }
        const score = [...byBook.values()].reduce((sum, value) => sum + (bookCapped ? Math.min(1, value) : value), 0);
        return { point, score, totalDistance };
    });
    candidates.sort((left, right) => right.score - left.score || left.totalDistance - right.totalDistance || left.point.id.localeCompare(right.point.id));
    return candidates[0]!.point;
}

function neighborhoodStats(neighbors: readonly { point: ResearchPoint; distance: number }[], tagId: string) {
    const members = neighbors.filter(({ point }) => point.tagIds.includes(tagId));
    const tagged = neighbors.filter(({ point }) => point.tagIds.length > 0);
    const books = new Map<string, number>();
    for (const { point } of members) books.set(point.bookId, (books.get(point.bookId) ?? 0) + 1);
    return {
        actual: neighbors.length,
        radius: neighbors.at(-1)?.distance ?? 0,
        memberCount: members.length,
        memberShare: neighbors.length === 0 ? null : members.length / neighbors.length,
        taggedCount: tagged.length,
        untaggedCount: neighbors.length - tagged.length,
        taggedSupportShare: tagged.length === 0 ? null : members.length / tagged.length,
        supportingBookCount: books.size,
        largestSupportingBookShare: members.length === 0 ? null : Math.max(...books.values()) / members.length,
        neighborIds: neighbors.map(({ point }) => point.id),
    };
}

/** Exclude coincident anchor points uniformly; include the entire k-boundary tie. */
export function auditLocalAnchor(points: readonly ResearchPoint[], tagId: string, anchor: Anchor) {
    if (!points.some((point) => point.tagIds.includes(tagId))) throw new Error('audit requires members');
    const ordered = points.filter((point) => !samePosition(point, anchor))
        .map((point) => ({ point, distance: distance(point, anchor) }))
        .sort((left, right) => left.distance - right.distance || left.point.id.localeCompare(right.point.id));
    return {
        anchor: { x: anchor.x, y: anchor.y },
        excludedCoincidentCount: points.length - ordered.length,
        kNeighborhoods: [15, 30, 60].map((requested) => {
            const boundary = ordered[Math.min(requested, ordered.length) - 1]?.distance;
            const neighbors = boundary === undefined ? [] : ordered.filter((entry) => entry.distance <= boundary);
            return { requested, ...neighborhoodStats(neighbors, tagId) };
        }),
        radiusNeighborhoods: STUDY_RADII.map((requestedRadius) => ({
            requestedRadius,
            ...neighborhoodStats(ordered.filter((entry) => entry.distance <= requestedRadius), tagId),
        })),
    };
}

export function anchorCandidates(members: readonly ResearchPoint[]) {
    const medoid = memberMedoid(members);
    return {
        medoid,
        localDensity: localMemberAnchor(members, 500, false),
        localBookCapped: localMemberAnchor(members, 500, true),
    };
}
