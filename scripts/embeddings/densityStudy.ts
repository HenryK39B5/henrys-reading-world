import { MAP_COORDINATE_MAX, type MapDensity, type MapPoint } from '../../src/domain/types.ts';
import { MAP_DENSITY_COLUMNS, MAP_DENSITY_ROWS } from './mapLayout.ts';

/** Re-sample the existing Gaussian field without changing its bandwidth in map coordinates. */
function rawDensity(points: readonly MapPoint[], columns: number, rows: number): number[] {
    if (!Number.isInteger(columns) || !Number.isInteger(rows) || columns < 2 || rows < 2) {
        throw new Error('density grid needs at least two rows and columns');
    }
    const values = Array<number>(columns * rows).fill(0);
    const scaleX = (columns - 1) / (MAP_DENSITY_COLUMNS - 1);
    const scaleY = (rows - 1) / (MAP_DENSITY_ROWS - 1);
    for (const point of points) {
        const cx = (point.x / MAP_COORDINATE_MAX) * (columns - 1);
        const cy = (point.y / MAP_COORDINATE_MAX) * (rows - 1);
        for (let y = Math.max(0, Math.floor(cy - 4 * scaleY)); y <= Math.min(rows - 1, Math.ceil(cy + 4 * scaleY)); y += 1) {
            for (let x = Math.max(0, Math.floor(cx - 4 * scaleX)); x <= Math.min(columns - 1, Math.ceil(cx + 4 * scaleX)); x += 1) {
                const dx = (x - cx) / scaleX;
                const dy = (y - cy) / scaleY;
                values[y * columns + x] = (values[y * columns + x] ?? 0) + Math.exp(-(dx * dx + dy * dy) / (2 * 1.55 * 1.55));
            }
        }
    }
    return values;
}

/** Keep the original grid maximum as the common scale so thresholds mean the same thing at every resolution. */
export function densityAtResolution(points: readonly MapPoint[], columns: number, rows: number): MapDensity {
    const reference = rawDensity(points, MAP_DENSITY_COLUMNS, MAP_DENSITY_ROWS);
    const maximum = Math.max(0, ...reference);
    const raw = columns === MAP_DENSITY_COLUMNS && rows === MAP_DENSITY_ROWS ? reference : rawDensity(points, columns, rows);
    return { columns, rows, values: maximum === 0 ? raw : raw.map((value) => Math.min(255, Math.round(Math.sqrt(value / maximum) * 255))) };
}
