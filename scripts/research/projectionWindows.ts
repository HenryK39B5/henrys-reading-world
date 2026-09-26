import { covariance, EigenvalueDecomposition, Matrix } from 'ml-matrix';

export type RankedNeighbor = { index: number; distance: number };
export type LinearModel = { mean: number[]; eigenvalues: number[]; basis: number[][]; totalVariance: number };

function validateRows(rows: readonly (readonly number[])[]): void {
    if (rows.length < 2 || rows[0]!.length === 0) throw new Error('at least two non-empty vectors required');
    const dimensions = rows[0]!.length;
    if (rows.some((row) => row.length !== dimensions || row.some((value) => !Number.isFinite(value)))) throw new Error('finite equal dimensions required');
}

export function normalizeRows(rows: readonly (readonly number[])[]): number[][] {
    validateRows(rows);
    return rows.map((row) => {
        const norm = Math.hypot(...row);
        if (norm === 0) throw new Error('zero vector');
        return row.map((value) => value / norm);
    });
}

function eigenModel(matrix: Matrix, mean: number[], components: number): LinearModel {
    if (!Number.isInteger(components) || components < 1 || components > matrix.columns) throw new Error('invalid component count');
    const eigen = new EigenvalueDecomposition(matrix, { assumeSymmetric: true });
    const ordered = eigen.realEigenvalues.map((value, index) => ({ value, index })).sort((a, b) => b.value - a.value || a.index - b.index);
    const basis = ordered.slice(0, components).map(({ index }) => {
        const vector = eigen.eigenvectorMatrix.getColumn(index);
        const pivot = vector.reduce((best, value, lane) => Math.abs(value) > Math.abs(vector[best]!) ? lane : best, 0);
        const sign = vector[pivot]! < 0 ? -1 : 1;
        return vector.map((value) => value * sign);
    });
    return { mean, basis, eigenvalues: ordered.map(({ value }) => value), totalVariance: matrix.trace() };
}

export function fitPca(rows: readonly (readonly number[])[], components: number): LinearModel {
    validateRows(rows);
    const matrix = new Matrix(rows.map((row) => [...row]));
    return eigenModel(covariance(matrix), matrix.mean('column'), components);
}

export function projectLinear(rows: readonly (readonly number[])[], model: LinearModel): number[][] {
    return rows.map((row) => {
        if (row.length !== model.mean.length) throw new Error('projection dimension mismatch');
        return model.basis.map((axis) => row.reduce((sum, value, index) => sum + (value - model.mean[index]!) * axis[index]!, 0));
    });
}

/** Separate sample centering; shared projection origin for all foreground/background points. */
export function fitContrastive(foreground: readonly (readonly number[])[], background: readonly (readonly number[])[], alpha: number): LinearModel {
    validateRows(foreground);
    validateRows(background);
    if (!Number.isFinite(alpha) || alpha < 0) throw new Error('finite nonnegative alpha required');
    const fg = covariance(new Matrix(foreground.map((row) => [...row])));
    const bg = covariance(new Matrix(background.map((row) => [...row])));
    if (fg.columns !== bg.columns) throw new Error('contrast dimensions differ');
    return eigenModel(Matrix.sub(fg, Matrix.mul(bg, alpha)), Array.from({ length: fg.columns }, () => 0), 2);
}

export function rotatePcaPlane(scores: readonly (readonly number[])[], degrees: number): number[][] {
    if (!Number.isFinite(degrees)) throw new Error('finite angle required');
    const angle = degrees * Math.PI / 180;
    return scores.map((row) => {
        if (row.length < 4) throw new Error('four principal scores required');
        return [Math.cos(angle) * row[0]! + Math.sin(angle) * row[2]!, Math.cos(angle) * row[1]! + Math.sin(angle) * row[3]!];
    });
}

export function orderedNeighbors(rows: readonly (readonly number[])[], ids: readonly string[], queryIndex: number, metric: 'cosine-unit' | 'euclidean'): RankedNeighbor[] {
    if (rows.length !== ids.length || new Set(ids).size !== ids.length || rows[queryIndex] === undefined) throw new Error('invalid neighbor IDs/query');
    const query = rows[queryIndex]!;
    const results: RankedNeighbor[] = [];
    for (let index = 0; index < rows.length; index += 1) {
        if (index === queryIndex) continue;
        const row = rows[index]!;
        if (row.length !== query.length) throw new Error('neighbor dimension mismatch');
        let value = 0;
        for (let lane = 0; lane < row.length; lane += 1) {
            value += metric === 'cosine-unit' ? query[lane]! * row[lane]! : (query[lane]! - row[lane]!) ** 2;
        }
        const distance = metric === 'cosine-unit' ? Math.max(0, 1 - value) : Math.sqrt(value);
        if (!Number.isFinite(distance)) throw new Error('non-finite neighbor distance');
        results.push({ index, distance });
    }
    return results.sort((a, b) => a.distance - b.distance || ids[a.index]!.localeCompare(ids[b.index]!));
}

export function takeNeighborhood(ordered: readonly RankedNeighbor[], k: number, includeTies = false): RankedNeighbor[] {
    if (!Number.isInteger(k) || k < 1) throw new Error('positive integer k required');
    const boundary = ordered[Math.min(k, ordered.length) - 1]?.distance;
    if (!includeTies || boundary === undefined) return ordered.slice(0, k);
    return ordered.filter((entry) => entry.distance <= boundary + 1e-12);
}

export function compareNeighborhoods(reference: readonly RankedNeighbor[], projected: readonly RankedNeighbor[], k: number, includeTies = false) {
    const high = takeNeighborhood(reference, k, includeTies);
    const low = takeNeighborhood(projected, k, includeTies);
    const highSet = new Set(high.map(({ index }) => index));
    const ranks = new Map(reference.map(({ index }, rank) => [index, rank + 1]));
    const overlap = low.filter(({ index }) => highSet.has(index)).length;
    const ranked = low.map(({ index }) => {
        const rank = ranks.get(index);
        if (rank === undefined) throw new Error('neighborhood reference and projection IDs differ');
        return rank;
    });
    return {
        requestedK: k, highCount: high.length, projectedCount: low.length, overlap,
        recall: high.length === 0 ? null : overlap / high.length,
        precision: low.length === 0 ? null : overlap / low.length,
        medianNormalizedHighRank: ranked.length === 0 ? null : median(ranked.map((rank) => rank / reference.length)),
        meanNormalizedHighRank: ranked.length === 0 ? null : ranked.reduce((sum, rank) => sum + rank / reference.length, 0) / ranked.length,
        outsideHighTopTenPercentShare: ranked.length === 0 ? null : ranked.filter((rank) => rank > Math.ceil(reference.length * 0.1)).length / ranked.length,
    };
}

export function median(values: readonly number[]): number {
    if (values.length === 0) throw new Error('median requires values');
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}
