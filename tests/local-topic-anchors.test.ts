import { describe, expect, it } from 'vitest';
import { auditLocalAnchor, localMemberAnchor } from '../scripts/research/localTopicAnchors.ts';
import type { ResearchPoint } from '../scripts/research/spatialRepresentativeness.ts';

const point = (id: string, x: number, bookId = 'book', tagIds = ['topic']): ResearchPoint => ({ id, x, y: 0, bookId, tagIds });

describe('local topic anchors: exploratory, not production gates', () => {
    it('rejects empty or invalid anchor selection', () => {
        expect(() => localMemberAnchor([], 500, true)).toThrow();
        for (const radius of [0, -1, Infinity, NaN]) expect(() => localMemberAnchor([point('a', 0)], radius, false)).toThrow();
    });

    it('returns a real local member, not the midpoint between distant groups', () => {
        const members = [point('a', 0), point('b', 10), point('c', 20), point('d', 1000)];
        expect(localMemberAnchor(members, 100, false).id).toBe('b');
    });

    it('makes the book-cap objective visibly different from raw density', () => {
        const members = [
            ...Array.from({ length: 10 }, (_, index) => point(`a${index}`, index)),
            point('b0', 1000, 'other0'), point('b1', 1010, 'other1'), point('b2', 1020, 'other2'),
        ];
        expect(localMemberAnchor(members, 100, false).id.startsWith('a')).toBe(true);
        expect(localMemberAnchor(members, 100, true).id.startsWith('b')).toBe(true);
    });

    it('is deterministic under input reorder and all-isolated ties', () => {
        const members = [point('b', 1000), point('a', 0)];
        expect(localMemberAnchor(members, 1, true).id).toBe('a');
        expect(localMemberAnchor([...members].reverse(), 1, true)).toEqual(localMemberAnchor(members, 1, true));
    });

    it('excludes all coincident points equally and includes complete k-boundary ties', () => {
        const points = [point('self', 0), point('overlap', 0), ...Array.from({ length: 20 }, (_, index) => point(`t${index}`, 10))];
        const audit = auditLocalAnchor(points, 'topic', { x: 0, y: 0 });
        expect(audit.excludedCoincidentCount).toBe(2);
        expect(audit.kNeighborhoods[0]).toMatchObject({ requested: 15, actual: 20, memberCount: 20, radius: 10 });
    });

    it('records unknowns separately from reviewed support at fixed radii', () => {
        const audit = auditLocalAnchor([point('a', 10), point('u', 15, 'book', []), point('o', 20, 'book', ['other']), point('far', 1000)], 'topic', { x: 0, y: 0 });
        expect(audit.radiusNeighborhoods[0]).toMatchObject({ actual: 3, memberCount: 1, untaggedCount: 1, taggedSupportShare: 0.5 });
    });

    it('handles a singleton without inventing supporting neighbors', () => {
        const members = [point('self', 0)];
        expect(localMemberAnchor(members, 500, true).id).toBe('self');
        expect(auditLocalAnchor(members, 'topic', members[0]!).kNeighborhoods[0]).toMatchObject({ actual: 0, memberCount: 0, memberShare: null, taggedSupportShare: null });
    });
});
