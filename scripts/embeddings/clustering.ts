export type ClusterInput = { id: string; values: number[] };

export type ClusterMember = { id: string; similarity: number };

export type SemanticCluster = {
    index: number;
    centroid: number[];
    members: ClusterMember[];
};

function normalize(values: number[]): number[] {
    const norm = Math.sqrt(values.reduce((sum, value) => sum + value * value, 0));
    if (!Number.isFinite(norm) || norm === 0) {
        throw new Error('semantic clustering requires finite non-zero vectors');
    }
    return values.map((value) => value / norm);
}

function dot(left: number[], right: number[]): number {
    if (left.length === 0 || left.length !== right.length) {
        throw new Error('semantic clustering requires equal non-empty dimensions');
    }
    let result = 0;
    for (let index = 0; index < left.length; index += 1) {
        result += (left[index] ?? 0) * (right[index] ?? 0);
    }
    return result;
}

function meanNormalized(vectors: number[][]): number[] {
    const dimensions = vectors[0]?.length ?? 0;
    if (vectors.length === 0 || dimensions === 0 || vectors.some((vector) => vector.length !== dimensions)) {
        throw new Error('cannot build a semantic centroid from empty or mismatched vectors');
    }
    const mean = Array.from<number>({ length: dimensions }).fill(0);
    for (const vector of vectors) {
        for (let index = 0; index < dimensions; index += 1) {
            mean[index] = (mean[index] ?? 0) + (vector[index] ?? 0);
        }
    }
    return normalize(mean);
}

export function sphericalKMeans(inputs: ClusterInput[], clusterCount: number, maxIterations = 12): SemanticCluster[] {
    if (!Number.isInteger(clusterCount) || clusterCount <= 0 || clusterCount > inputs.length) {
        throw new Error('cluster count must be a positive integer no larger than the input count');
    }
    if (!Number.isInteger(maxIterations) || maxIterations <= 0) {
        throw new Error('max iterations must be a positive integer');
    }
    const sorted = [...inputs].sort((left, right) => left.id.localeCompare(right.id));
    if (new Set(sorted.map((entry) => entry.id)).size !== sorted.length) {
        throw new Error('semantic clustering input ids must be unique');
    }
    const dimensions = sorted[0]?.values.length ?? 0;
    const normalized = sorted.map((entry) => {
        if (entry.values.length !== dimensions) {
            throw new Error('semantic clustering input dimensions do not match');
        }
        return { id: entry.id, values: normalize(entry.values) };
    });
    const centroids: number[][] = [normalized[0]?.values ?? []];
    const centroidSeedIds = new Set([normalized[0]?.id]);
    while (centroids.length < clusterCount) {
        const candidate = normalized
            .filter((entry) => !centroidSeedIds.has(entry.id))
            .map((entry) => ({
                entry,
                distance: 1 - Math.max(...centroids.map((centroid) => dot(entry.values, centroid))),
            }))
            .sort((left, right) => right.distance - left.distance || left.entry.id.localeCompare(right.entry.id))[0];
        if (candidate === undefined) {
            throw new Error('could not initialize semantic cluster centroids');
        }
        centroids.push(candidate.entry.values);
        centroidSeedIds.add(candidate.entry.id);
    }

    let assignments = Array.from<number>({ length: normalized.length }).fill(-1);
    for (let iteration = 0; iteration < maxIterations; iteration += 1) {
        const nextAssignments = normalized.map((entry) => {
            let bestIndex = 0;
            let bestSimilarity = Number.NEGATIVE_INFINITY;
            for (let index = 0; index < centroids.length; index += 1) {
                const similarity = dot(entry.values, centroids[index] ?? []);
                if (similarity > bestSimilarity) {
                    bestSimilarity = similarity;
                    bestIndex = index;
                }
            }
            return bestIndex;
        });
        const unchanged = nextAssignments.every((assignment, index) => assignment === assignments[index]);
        assignments = nextAssignments;
        if (unchanged) {
            break;
        }
        for (let clusterIndex = 0; clusterIndex < clusterCount; clusterIndex += 1) {
            const members = normalized.filter((_, index) => assignments[index] === clusterIndex);
            if (members.length === 0) {
                const replacement = normalized
                    .map((entry, index) => ({
                        entry,
                        distance: 1 - dot(entry.values, centroids[assignments[index] ?? 0] ?? []),
                    }))
                    .sort((left, right) => right.distance - left.distance || left.entry.id.localeCompare(right.entry.id))[0];
                if (replacement === undefined) {
                    throw new Error('could not recover an empty semantic cluster');
                }
                centroids[clusterIndex] = replacement.entry.values;
            } else {
                centroids[clusterIndex] = meanNormalized(members.map((entry) => entry.values));
            }
        }
    }

    return centroids.map((centroid, index) => ({
        index: index + 1,
        centroid,
        members: normalized
            .filter((_, memberIndex) => assignments[memberIndex] === index)
            .map((entry) => ({ id: entry.id, similarity: dot(entry.values, centroid) }))
            .sort((left, right) => right.similarity - left.similarity || left.id.localeCompare(right.id)),
    }));
}
