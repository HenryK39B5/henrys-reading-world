import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { bookIslandLayout, constellationEdges } from '../scripts/research/atlasForms.mjs';

type Point = { id: string; bookId: string; bookTitle: string; text: string };
type Graph = { points: Record<string, Point>; neighbors: Record<string, Array<{ id: string; score: number }>>; seeds: string[] };
const data = JSON.parse(readFileSync('.private/research/map/route-first/viewer-data.json', 'utf8')) as Graph;

describe('R4-L real-passage atlas chart geometry', () => {
    it('has exactly one stable coordinate per real highlight and one non-overlapping circle per real book', () => {
        const atlas = bookIslandLayout(data.points);
        expect(atlas.islands).toHaveLength(108);
        expect(Object.keys(atlas.byPoint).sort()).toEqual(Object.keys(data.points).sort());
        expect(atlas.islands.reduce((count, island) => count + island.count, 0)).toBe(3462);
        for (const island of atlas.islands) {
            const ids = Object.keys(data.points).filter((id) => data.points[id]!.bookId === island.id);
            expect(ids).toHaveLength(island.count);
            for (const id of ids) {
                const pos = atlas.byPoint[id]!;
                expect(Math.hypot(pos.x - island.x, pos.y - island.y)).toBeLessThan(island.radius);
            }
        }
        for (const [index, island] of atlas.islands.entries()) {
            for (const other of atlas.islands.slice(index + 1)) expect(Math.hypot(island.x - other.x, island.y - other.y)).toBeGreaterThan(island.radius + other.radius);
        }
        expect(bookIslandLayout(data.points)).toEqual(atlas);
    });
    it('only draws traceable real cross-book directed model neighbors around the current point', () => {
        const id = data.seeds[0]!; const trail = [id];
        const edges = constellationEdges(data, id, trail);
        expect(edges.length).toBeGreaterThan(0); expect(edges.length).toBeLessThanOrEqual(4);
        for (const edge of edges) {
            expect(data.neighbors[id]![edge.rank - 1]!.id).toBe(edge.id);
            expect(data.points[edge.id]!.bookId).not.toBe(data.points[id]!.bookId);
        }
        expect(constellationEdges(data, id, [...trail, edges[0]!.id]).some((edge) => edge.id === edges[0]!.id)).toBe(false);
        expect(constellationEdges(data, 'h-043', ['h-043'])).toHaveLength(0);
    });
});
