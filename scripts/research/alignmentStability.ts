export type Point2 = readonly [number, number];
export type Alignment = { scale: number; angleRadians: number; reflected: boolean; sourceCentroid: Point2; targetCentroid: Point2; rmse: number; normalizedRmse: number; points: Point2[] };

function centroid(points: readonly Point2[]): Point2 {
    if (points.length === 0) throw new Error('alignment requires points');
    return [points.reduce((sum, point) => sum + point[0], 0) / points.length, points.reduce((sum, point) => sum + point[1], 0) / points.length];
}
function rms(points: readonly Point2[]): number {
    const center = centroid(points);
    return Math.sqrt(points.reduce((sum, point) => sum + (point[0] - center[0]) ** 2 + (point[1] - center[1]) ** 2, 0) / points.length);
}
function validatePair(source: readonly Point2[], target: readonly Point2[]): void {
    if (source.length !== target.length || source.length < 2 || source.some((p) => p.length !== 2 || p.some((x) => !Number.isFinite(x))) || target.some((p) => p.length !== 2 || p.some((x) => !Number.isFinite(x)))) throw new Error('alignment requires equal finite point pairs');
}
function fit(source: readonly Point2[], target: readonly Point2[], reflected: boolean): Alignment {
    validatePair(source, target);
    const sc = centroid(source); const tc = centroid(target);
    let xx = 0; let xy = 0; let yx = 0; let yy = 0; let sourceEnergy = 0;
    for (let i = 0; i < source.length; i += 1) {
        const sx = source[i]![0] - sc[0]; const sy = (source[i]![1] - sc[1]) * (reflected ? -1 : 1);
        const tx = target[i]![0] - tc[0]; const ty = target[i]![1] - tc[1];
        xx += sx * tx; xy += sx * ty; yx += sy * tx; yy += sy * ty; sourceEnergy += sx * sx + sy * sy;
    }
    const angle = Math.atan2(xy - yx, xx + yy);
    const numerator = Math.cos(angle) * (xx + yy) + Math.sin(angle) * (xy - yx);
    const scale = sourceEnergy === 0 ? 1 : numerator / sourceEnergy;
    const points = source.map((point) => {
        const sx = point[0] - sc[0]; const sy = (point[1] - sc[1]) * (reflected ? -1 : 1);
        return [tc[0] + scale * (Math.cos(angle) * sx - Math.sin(angle) * sy), tc[1] + scale * (Math.sin(angle) * sx + Math.cos(angle) * sy)] as [number, number];
    });
    const error = Math.sqrt(points.reduce((sum, point, i) => sum + (point[0]! - target[i]![0]) ** 2 + (point[1]! - target[i]![1]) ** 2, 0) / points.length);
    return { scale, angleRadians: angle, reflected, sourceCentroid: sc, targetCentroid: tc, rmse: error, normalizedRmse: error / Math.max(rms(target), Number.EPSILON), points };
}

export function alignSimilarity(source: readonly Point2[], target: readonly Point2[], allowReflection = false): Alignment {
    const direct = fit(source, target, false);
    if (!allowReflection) return direct;
    const reflected = fit(source, target, true);
    return reflected.rmse < direct.rmse ? reflected : direct;
}

export function applyAlignment(points: readonly Point2[], alignment: Pick<Alignment, 'scale' | 'angleRadians' | 'reflected' | 'sourceCentroid' | 'targetCentroid'>): Point2[] {
    return points.map((point) => {
        const sx = point[0] - alignment.sourceCentroid[0];
        const sy = (point[1] - alignment.sourceCentroid[1]) * (alignment.reflected ? -1 : 1);
        return [
            alignment.targetCentroid[0] + alignment.scale * (Math.cos(alignment.angleRadians) * sx - Math.sin(alignment.angleRadians) * sy),
            alignment.targetCentroid[1] + alignment.scale * (Math.sin(alignment.angleRadians) * sx + Math.cos(alignment.angleRadians) * sy),
        ];
    });
}

export function alignFromAnchors(source: readonly Point2[], target: readonly Point2[], anchorIndices: readonly number[], allowReflection = false): Alignment {
    if (anchorIndices.length < 2 || new Set(anchorIndices).size !== anchorIndices.length || anchorIndices.some((index) => index < 0 || index >= source.length || index >= target.length)) throw new Error('alignment requires at least two valid unique anchors');
    const sourceAnchors = anchorIndices.map((index) => source[index]!);
    const targetAnchors = anchorIndices.map((index) => target[index]!);
    const fitted = alignSimilarity(sourceAnchors, targetAnchors, allowReflection);
    return { ...fitted, points: applyAlignment(source, fitted) };
}


export function normalizedDisplacements(left: readonly Point2[], right: readonly Point2[]) {
    validatePair(left, right);
    const scale = Math.max(rms(right), Number.EPSILON);
    const values = left.map((point, i) => Math.hypot(point[0] - right[i]![0], point[1] - right[i]![1]) / scale).sort((a, b) => a - b);
    const quantile = (fraction: number) => values[Math.min(values.length - 1, Math.floor((values.length - 1) * fraction))]!;
    return { median: quantile(0.5), p95: quantile(0.95), maximum: values.at(-1)! };
}

export function pairwiseDistanceCorrelation(left: readonly Point2[], right: readonly Point2[], sampleLimit = 2000): number {
    validatePair(left, right);
    const pairs: { left: number; right: number }[] = [];
    const stride = Math.max(1, Math.ceil(left.length / Math.sqrt(sampleLimit)));
    for (let i = 0; i < left.length; i += stride) for (let j = i + 1; j < left.length; j += stride) pairs.push({ left: Math.hypot(left[i]![0] - left[j]![0], left[i]![1] - left[j]![1]), right: Math.hypot(right[i]![0] - right[j]![0], right[i]![1] - right[j]![1]) });
    const mean = (key: 'left' | 'right') => pairs.reduce((sum, pair) => sum + pair[key], 0) / pairs.length;
    const ml = mean('left'); const mr = mean('right');
    let numerator = 0; let dl = 0; let dr = 0;
    for (const pair of pairs) { const a = pair.left - ml; const b = pair.right - mr; numerator += a * b; dl += a * a; dr += b * b; }
    return numerator / Math.sqrt(dl * dr);
}
