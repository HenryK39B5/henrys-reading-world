import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { MAP_COORDINATE_MAX, type MapContour, type MapLayout, type Snapshot } from '../src/domain/types.ts';
import { interpolatedContours } from './embeddings/contourCandidate.ts';

const SOURCE = join('src', 'data', 'public-snapshot.json');
const OUTPUT = join('.private', 'review', 'maintenance', 'm04', 'candidate-contours.json');
const hash = (value: unknown): string => createHash('sha256').update(JSON.stringify(value)).digest('hex');

const snapshot = JSON.parse(await readFile(SOURCE, 'utf8')) as Snapshot;
const map: MapLayout | undefined = snapshot.map;
if (snapshot.visibility !== 'public' || map === undefined || map.points.length !== snapshot.highlights.length) {
    throw new Error('comparison requires the complete approved public map');
}
const candidate: MapContour[] = interpolatedContours(map.density);
// More high-density isolines expose local peaks while retaining the same low-density footprint.
const reliefLevels = [48, 96, 136, 160, 184, 208, 232];
const relief: MapContour[] = interpolatedContours(map.density, reliefLevels);
const { columns, rows, values } = map.density;
const bookByHighlight = new Map(snapshot.highlights.map((highlight) => [highlight.id, highlight.bookId]));
const peaks: { column: number; row: number; value: number; nearbyPoints: number; books: number; largestBookShare: number }[] = [];
for (let row = 2; row < rows - 2; row += 1) {
    for (let column = 2; column < columns - 2; column += 1) {
        const value = values[row * columns + column] ?? 0;
        if (value < 190) continue;
        let higher = false;
        for (let dy = -2; dy <= 2; dy += 1) {
            for (let dx = -2; dx <= 2; dx += 1) {
                if ((dx !== 0 || dy !== 0) && (values[(row + dy) * columns + column + dx] ?? 0) > value) higher = true;
            }
        }
        if (higher || peaks.some((peak) => Math.hypot(peak.column - column, peak.row - row) < 4)) continue;
        const counts = new Map<string, number>();
        for (const point of map.points) {
            const x = point.x / MAP_COORDINATE_MAX * (columns - 1);
            const y = point.y / MAP_COORDINATE_MAX * (rows - 1);
            if (Math.hypot(x - column, y - row) > 2.5) continue;
            const bookId = bookByHighlight.get(point.highlightId);
            if (bookId !== undefined) counts.set(bookId, (counts.get(bookId) ?? 0) + 1);
        }
        const nearbyPoints = [...counts.values()].reduce((sum, count) => sum + count, 0);
        peaks.push({ column, row, value, nearbyPoints, books: counts.size,
            largestBookShare: nearbyPoints === 0 ? 0 : Math.max(...counts.values()) / nearbyPoints });
    }
}
peaks.sort((left, right) => right.value - left.value || left.row - right.row || left.column - right.column);
const artifact = {
    sourceVersion: map.version,
    pointsHash: hash(map.points),
    densityHash: hash(map.density),
    candidate,
    relief,
    peaks,
    reliefLevels,
};
await mkdir(dirname(OUTPUT), { recursive: true });
await writeFile(OUTPUT, JSON.stringify(artifact), 'utf8');
console.log(`candidate contours: ${candidate.map((entry) => `${entry.level}:${entry.segments.length}`).join(', ')}`);
console.log(`current contours: ${map.contours.map((entry) => `${entry.level}:${entry.segments.length}`).join(', ')}`);
console.log(`relief contours: ${relief.map((entry) => `${entry.level}:${entry.segments.length}`).join(', ')}`);
console.log(`sampled high peaks: ${JSON.stringify(peaks.slice(0, 8))}`);
console.log(`comparison artifact: ${OUTPUT}`);
