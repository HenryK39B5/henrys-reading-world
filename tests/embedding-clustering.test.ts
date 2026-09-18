import { describe, expect, it } from 'vitest';
import { sphericalKMeans } from '../scripts/embeddings/clustering.ts';

describe('private semantic clustering', () => {
    it('is deterministic and keeps separated directions in different clusters', () => {
        const inputs = [
            { id: 'a', values: [1, 0] },
            { id: 'b', values: [0.9, 0.1] },
            { id: 'c', values: [0.8, 0.2] },
            { id: 'd', values: [-1, 0] },
            { id: 'e', values: [-0.9, -0.1] },
            { id: 'f', values: [-0.8, -0.2] },
        ];
        const first = sphericalKMeans(inputs, 2);
        const second = sphericalKMeans(inputs, 2);

        expect(second).toEqual(first);
        expect(first.every((cluster) => cluster.members.length === 3)).toBe(true);
        const memberSets = first.map((cluster) => cluster.members.map((member) => member.id).sort());
        expect(memberSets).toContainEqual(['a', 'b', 'c']);
        expect(memberSets).toContainEqual(['d', 'e', 'f']);
    });

    it('rejects duplicate ids and zero vectors', () => {
        expect(() => sphericalKMeans([{ id: 'a', values: [1] }, { id: 'a', values: [2] }], 1)).toThrow('ids must be unique');
        expect(() => sphericalKMeans([{ id: 'a', values: [0] }], 1)).toThrow('finite non-zero vectors');
    });
});
