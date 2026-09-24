import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { MapContour, MapLayout, Snapshot } from '../src/domain/types.ts';
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
const artifact = {
    sourceVersion: map.version,
    pointsHash: hash(map.points),
    densityHash: hash(map.density),
    candidate,
};
await mkdir(dirname(OUTPUT), { recursive: true });
await writeFile(OUTPUT, JSON.stringify(artifact), 'utf8');
console.log(`candidate contours: ${candidate.map((entry) => `${entry.level}:${entry.segments.length}`).join(', ')}`);
console.log(`current contours: ${map.contours.map((entry) => `${entry.level}:${entry.segments.length}`).join(', ')}`);
console.log(`comparison artifact: ${OUTPUT}`);
