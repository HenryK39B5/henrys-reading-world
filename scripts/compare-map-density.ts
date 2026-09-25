import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { contours } from 'd3-contour';
import type { Snapshot } from '../src/domain/types.ts';
import { interpolatedContours } from './embeddings/contourCandidate.ts';
import { densityAtResolution } from './embeddings/densityStudy.ts';

const source = join('src', 'data', 'public-snapshot.json');
const output = join('.private', 'review', 'maintenance', 'm04', 'resolution', 'field-comparison.json');
const snapshot = JSON.parse(await readFile(source, 'utf8')) as Snapshot;
const map = snapshot.map;
if (snapshot.visibility !== 'public' || map === undefined || map.points.length !== snapshot.highlights.length) {
    throw new Error('study requires the complete approved public map');
}
const hash = (value: unknown): string => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const levels = [48, 96, 136, 160, 184, 208, 232];
const fields = [[64, 40], [128, 80], [256, 160]].map(([columns = 0, rows = 0]) => {
    const density = densityAtResolution(map.points, columns, rows);
    const traced = interpolatedContours(density, levels);
    return {
        density,
        contours: traced,
        coverage: levels.map((level) => ({ level, cells: density.values.filter((value) => value >= level).length, segments: traced.find((entry) => entry.level === level)?.segments.length ?? 0 })),
    };
});
if (hash(fields[0]?.density) !== hash(map.density)) throw new Error('study field differs from approved 64x40 density');
const mid = fields[1]?.density;
if (mid === undefined) throw new Error('missing 128x80 field');
const midBands = contours().size([mid.columns, mid.rows]).thresholds(levels).smooth(true)(mid.values);
const artifact = {
    sourceVersion: map.version,
    pointsHash: hash(map.points),
    originalDensityHash: hash(map.density),
    labelHash: hash(map.labels),
    levels,
    fields,
    midBands,
};
await mkdir(dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(artifact), 'utf8');
console.log(`study: ${fields.map(({ density, coverage }) => `${density.columns}x${density.rows}: ${coverage.map((entry) => `${entry.level}=${entry.cells}`).join(' ')}`).join('\n')}`);
console.log(`local artifact: ${output}`);
