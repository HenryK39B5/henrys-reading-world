import { PATH_VECTOR_DIMENSIONS } from '../../src/domain/types.ts';

/** Stable integer mixer; changing it requires a new projection version. */
function signFor(sourceIndex: number, targetIndex: number): number {
    let value = Math.imul(sourceIndex + 1, 0x45d9f3b) ^ Math.imul(targetIndex + 1, 0x119de1f3);
    value ^= value >>> 16;
    value = Math.imul(value, 0x45d9f3b);
    value ^= value >>> 16;
    return (value & 1) === 0 ? -1 : 1;
}

/**
 * Deterministic random-sign projection followed by L2 normalisation and int8-style quantisation.
 *
 * This is a small derived navigation aid, not a raw model vector. The consumer can compare two points
 * for path pacing, while the 1024-dimensional source remains private and the projection can never make
 * an untagged passage eligible for a path.
 */
export function projectPathVector(source: readonly number[]): number[] {
    if (source.length === 0 || source.some((value) => !Number.isFinite(value))) {
        throw new Error('path projection requires a non-empty finite vector');
    }
    const projected = Array.from<number>({ length: PATH_VECTOR_DIMENSIONS }).fill(0);
    for (let targetIndex = 0; targetIndex < projected.length; targetIndex += 1) {
        let sum = 0;
        for (let sourceIndex = 0; sourceIndex < source.length; sourceIndex += 1) {
            sum += (source[sourceIndex] ?? 0) * signFor(sourceIndex, targetIndex);
        }
        projected[targetIndex] = sum;
    }
    const norm = Math.sqrt(projected.reduce((total, value) => total + value * value, 0));
    if (norm === 0) {
        throw new Error('path projection requires a non-zero vector');
    }
    return projected.map((value) => Math.max(-127, Math.min(127, Math.round((value / norm) * 127))));
}
