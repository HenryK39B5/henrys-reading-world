import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { UMAP } from 'umap-js';
import { validateSnapshot } from '../src/domain/validate.ts';
import type { Snapshot } from '../src/domain/types.ts';
import {
    highlightTextHash,
    snapshotEmbeddingHash,
    type EmbeddingCache,
} from './embeddings/core.ts';
import {
    MAP_LAYOUT_ALGORITHM,
    MAP_LAYOUT_SEED,
    MAP_PROJECTION_DIMENSIONS,
    assembleMapLayout,
    cosineDistance,
    mapLayoutHash,
    mapTagHash,
    mulberry32,
    normalizeMapPoints,
    projectForMap,
} from './embeddings/mapLayout.ts';

const ROOT = process.cwd();
const LOCAL_SNAPSHOT_PATH = join(ROOT, '.private/local-snapshot.json');
const PUBLIC_SNAPSHOT_PATH = join(ROOT, 'src/data/public-snapshot.json');
const CACHE_PATH = join(ROOT, '.private/embeddings/vectors/local--xenova-bge-large-zh-v1.5-a48549b-q8-cls--1024.json');
const MAP_DIR = join(ROOT, '.private/maps');

type Scope = 'local' | 'public';

type MapLayoutArtifact = {
    manifest: {
        schemaVersion: 1;
        layoutVersion: string;
        scope: Scope;
        algorithm: typeof MAP_LAYOUT_ALGORITHM;
        seed: number;
        sourceModel: string;
        sourceDimensions: number;
        projectedDimensions: number;
        snapshotHash: string;
        tagHash: string;
        pointCount: number;
        labelCount: number;
        parameters: {
            nNeighbors: number;
            minDist: number;
            spread: number;
            nEpochs: number;
        };
        layoutHash: string;
        generatedAt: string;
    };
    layout: Snapshot['map'];
};

function scopeFromArgs(): Scope {
    const argument = process.argv.find((entry) => entry.startsWith('--scope='));
    if (argument === undefined) return 'local';
    const scope = argument.slice('--scope='.length);
    if (scope !== 'local' && scope !== 'public') throw new Error('--scope must be local or public');
    return scope;
}

async function readJson(path: string): Promise<unknown> {
    return JSON.parse(await readFile(path, 'utf8')) as unknown;
}

async function main(): Promise<void> {
    const scope = scopeFromArgs();
    const snapshotPath = scope === 'local' ? LOCAL_SNAPSHOT_PATH : PUBLIC_SNAPSHOT_PATH;
    const parsed = validateSnapshot(await readJson(snapshotPath), {
        expectedVisibility: scope === 'local' ? 'local-only' : 'public',
    });
    if (!parsed.ok) throw new Error(`snapshot does not validate: ${parsed.errors.join('; ')}`);
    const snapshot = parsed.snapshot;
    const cache = (await readJson(CACHE_PATH)) as Partial<EmbeddingCache>;
    if (
        cache.provider !== 'local' ||
        cache.model !== 'Xenova/bge-large-zh-v1.5@a48549b-q8-cls' ||
        cache.dimensions !== 1024 ||
        cache.vectors === undefined
    ) {
        throw new Error('default local embedding cache has an unexpected model or shape');
    }

    const snapshotHash = snapshotEmbeddingHash(snapshot);
    const tagHash = mapTagHash(snapshot);
    const layoutVersion = `map-v1-${snapshotHash.slice(0, 12)}-${tagHash.slice(0, 12)}`;
    const parameters = { nNeighbors: 24, minDist: 0.14, spread: 1.25, nEpochs: 350 };

    let embedding: number[][] = [];
    if (snapshot.highlights.length > 0) {
        const projected = snapshot.highlights.map((highlight) => {
            const cached = cache.vectors?.[highlight.id];
            if (cached === undefined || cached.textHash !== highlightTextHash(highlight)) {
                throw new Error(`default local embedding cache is missing or stale for ${highlight.id}`);
            }
            return projectForMap(cached.values);
        });
        const umap = new UMAP({
            nComponents: 2,
            ...parameters,
            distanceFn: cosineDistance,
            random: mulberry32(MAP_LAYOUT_SEED),
        });
        console.log(
            `map layout: ${String(projected.length)} points, ${String(MAP_PROJECTION_DIMENSIONS)} projected dimensions, fixed seed ${String(MAP_LAYOUT_SEED)}`,
        );
        embedding = await umap.fitAsync(projected, (epoch) => {
            if (epoch > 0 && epoch % 50 === 0) console.log(`  UMAP epoch ${String(epoch)} / ${String(parameters.nEpochs)}`);
        });
        if (embedding.length !== snapshot.highlights.length || embedding.some((point) => point.length !== 2 || point.some((value) => !Number.isFinite(value)))) {
            throw new Error('UMAP produced an invalid two-dimensional layout');
        }
    }

    const points = normalizeMapPoints(
        snapshot.highlights.map((highlight, index) => ({
            highlightId: highlight.id,
            x: embedding[index]?.[0] ?? 0,
            y: embedding[index]?.[1] ?? 0,
        })),
    );
    const layout = assembleMapLayout(snapshot, layoutVersion, points);
    const outputPath = join(MAP_DIR, `${scope}-layout.json`);
    const artifact: MapLayoutArtifact = {
        manifest: {
            schemaVersion: 1,
            layoutVersion,
            scope,
            algorithm: MAP_LAYOUT_ALGORITHM,
            seed: MAP_LAYOUT_SEED,
            sourceModel: cache.model,
            sourceDimensions: cache.dimensions,
            projectedDimensions: MAP_PROJECTION_DIMENSIONS,
            snapshotHash,
            tagHash,
            pointCount: layout.points.length,
            labelCount: layout.labels.length,
            parameters,
            layoutHash: mapLayoutHash(layout),
            generatedAt: new Date().toISOString(),
        },
        layout,
    };
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, JSON.stringify(artifact, null, 2), 'utf8');
    console.log(`map layout written: ${outputPath.slice(ROOT.length + 1)}`);
    console.log(`  points: ${String(layout.points.length)}; labels: ${String(layout.labels.length)}; contours: ${String(layout.contours.reduce((sum, contour) => sum + contour.segments.length, 0))}`);
    console.log(`  layout version: ${layoutVersion}; hash: ${artifact.manifest.layoutHash}`);
}

try {
    await main();
} catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
}
