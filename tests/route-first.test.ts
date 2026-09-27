import { describe, expect, it } from 'vitest';
import { routeFirst } from '../scripts/research/routeFirst.ts';

const graph = {
    ids: ['s', 'a', 'b', 'c', 'd', 'e'],
    books: { s: 'one', a: 'one', b: 'two', c: 'three', d: 'four', e: 'five' },
    nominations: {
        s: [{ id: 'a', score: .92 }, { id: 'b', score: .88 }, { id: 'c', score: .84 }, { id: 'd', score: .8 }, { id: 'e', score: .75 }],
        b: [{ id: 's', score: .88 }, { id: 'c', score: .7 }],
        c: [{ id: 's', score: .84 }, { id: 'd', score: .69 }],
        d: [], e: [], a: [],
    },
};

describe('route-first passage walk', () => {
    it('records only original nominations and excludes same-book candidates, with truthful band fallback', () => {
        const route = routeFirst(graph, 's', 'paced', () => 0, 3);
        expect(route.steps.map((step) => [step.toId, step.rank, step.expectedBand, step.bandFallback])).toEqual([
            ['b', 2, 'inner', false], ['c', 2, 'side', true], ['d', 2, 'outer', true],
        ]);
        expect(route.status).toBe('limit');
        expect(route.visitedIds).toEqual(['s', 'b', 'c', 'd']);
        expect(new Set(route.visitedBooks).size).toBe(4);
    });
    it('compares nearest under the same cross-book/new-book constraint, and stops honestly', () => {
        const nearest = routeFirst(graph, 's', 'nearest', () => { throw Error('nearest must not draw'); });
        expect(nearest.steps.map((step) => step.toId)).toEqual(['b', 'c', 'd']);
        expect(nearest.status).toBe('dead-end');
        expect(nearest.steps[0]!.availableCrossBook).toBe(4);
        expect(nearest.steps[0]!.availableBooks).toBe(4);
    });
    it('rejects unknown seed/invalid RNG and refuses fabricated neighbor links', () => {
        expect(() => routeFirst(graph, 'missing', 'paced', () => 0)).toThrow();
        expect(() => routeFirst(graph, 's', 'paced', () => 1)).toThrow();
        expect(() => routeFirst({ ...graph, nominations: { ...graph.nominations, s: [{ id: 'ghost', score: .5 }] } }, 's', 'paced', () => 0)).toThrow();
    });
});
