import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Snapshot } from '../src/domain/types.ts';
import { densityAtResolution } from '../scripts/embeddings/densityStudy.ts';

const map = (JSON.parse(readFileSync('src/data/public-snapshot.json', 'utf8')) as Snapshot).map;

describe('offline density resolution study on approved map points', () => {
    it('reproduces the approved 64x40 field exactly and preserves the same spatial bandwidth', () => {
        expect(map).toBeDefined();
        if (map === undefined) return;
        const unchanged = JSON.stringify(map);
        const baseline = densityAtResolution(map.points, 64, 40);
        expect(baseline).toEqual(map.density);
        for (const [columns, rows] of [[128, 80], [256, 160]]) {
            const field = densityAtResolution(map.points, columns ?? 0, rows ?? 0);
            expect(field.values).toHaveLength((columns ?? 0) * (rows ?? 0));
            expect(field.values.every((value) => Number.isInteger(value) && value >= 0 && value <= 255)).toBe(true);
            let difference = 0;
            for (let y = 0; y < 40; y += 1) {
                for (let x = 0; x < 64; x += 1) {
                    const nearestX = Math.round(x * (field.columns - 1) / 63);
                    const nearestY = Math.round(y * (field.rows - 1) / 39);
                    difference += Math.abs((baseline.values[y * 64 + x] ?? 0) - (field.values[nearestY * field.columns + nearestX] ?? 0));
                }
            }
            expect(difference / (64 * 40)).toBeLessThan(3);
        }
        expect(JSON.stringify(map)).toBe(unchanged);
    });

    it('refuses invalid grids', () => {
        expect(() => densityAtResolution([], 1, 40)).toThrow();
        expect(() => densityAtResolution([], 64, 0)).toThrow();
    });
});
