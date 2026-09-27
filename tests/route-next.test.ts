import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { chooseNext, deterministicNext, historySeed, routeBands, visibleForks, type NextData } from '../scripts/research/routeNext.mjs';

const file = '.private/research/map/route-first/viewer-data.json';
const data = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) as NextData & { seeds: string[] } : null;

describe.skipIf(!data)('one-step research walk on the frozen real highlights', () => {
    const graph = data!;
    it('keeps every automatic step within the real directed top-16, cross-book and non-repeating', () => {
        for (const seed of graph.seeds) {
            const trail = [seed];
            for (let index = 0; index < 6; index += 1) {
                const result = deterministicNext(graph, trail);
                expect(result).toEqual(deterministicNext(graph, trail));
                if (result.status === 'dead-end') break;
                expect(result.status).toBe('ready');
                const next = result.candidate!;
                const band = routeBands.find((entry) => entry.name === result.expectedBand)!;
                const eligible = graph.neighbors[trail.at(-1)!]!.map((item, offset) => ({ id: item.id, rank: offset + 1 }))
                    .filter((item) => !trail.includes(item.id) && graph.points[item.id]!.bookId !== graph.points[trail.at(-1)!]!.bookId);
                if (!result.bandFallback) expect(next.rank).toBeGreaterThanOrEqual(band.start);
                if (!result.bandFallback) expect(next.rank).toBeLessThanOrEqual(band.end);
                else expect(eligible.filter((item) => item.rank >= band.start && item.rank <= band.end)).toHaveLength(0);
                if (!result.bookFallback) expect(trail.map((id) => graph.points[id]!.bookId)).not.toContain(graph.points[next.id]!.bookId);
                expect(graph.neighbors[trail.at(-1)!]![next.rank - 1]!.id).toBe(next.id);
                expect(graph.points[next.id]!.bookId).not.toBe(graph.points[trail.at(-1)!]!.bookId);
                expect(trail).not.toContain(next.id);
                expect(visibleForks(graph, trail, result).some((entry) => entry.candidate?.id === next.id)).toBe(true);
                trail.push(next.id);
            }
            if (trail.length === 7) {
                expect(deterministicNext(graph, trail).status).toBe('limit');
                expect(visibleForks(graph, trail).every((fork) => fork.candidate === null)).toBe(true);
            }
        }
    });
    it('returns an honest known dead end, preserves the same step after backtracking, and changes seed with the route', () => {
        expect(deterministicNext(graph, ['h-043'])).toMatchObject({ status: 'dead-end', candidate: null, available: 0 });
        const first = deterministicNext(graph, ['h-3501']);
        expect(first.status).toBe('ready');
        const before = ['h-3501', first.candidate!.id];
        expect(deterministicNext(graph, before)).toEqual(deterministicNext(graph, [...before]));
        expect(historySeed(before)).not.toBe(historySeed(['h-3501']));
    });
    it('rejects a duplicated route or invalid RNG rather than silently assigning a quote', () => {
        expect(() => deterministicNext(graph, ['h-3501', 'h-3501'])).toThrow('invalid reading trail');
        expect(() => chooseNext(graph, ['h-3501'], () => 1)).toThrow('invalid random draw');
        expect(() => chooseNext(graph, ['h-3501'], () => Number.NaN)).toThrow('invalid random draw');
    });
});
