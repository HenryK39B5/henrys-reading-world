import { contours } from 'd3-contour';
import { MAP_COORDINATE_MAX, type MapContour, type MapDensity } from '../../src/domain/types.ts';
import { MAP_CONTOUR_LEVELS } from './mapLayout.ts';

/** Alternative line geometry on the existing density grid; no points or field values are recalculated. */
export function interpolatedContours(density: MapDensity, levels: readonly number[] = MAP_CONTOUR_LEVELS): MapContour[] {
    const { columns, rows } = density;
    const generator = contours().size([columns, rows]).thresholds([...levels]).smooth(true);
    const project = (value: number, maximum: number): number =>
        Math.round(Math.max(0, Math.min(1, (value - 0.5) / (maximum - 1))) * MAP_COORDINATE_MAX);
    return generator(density.values).map((geometry) => {
        const segments: number[][] = [];
        for (const polygon of geometry.coordinates) {
            for (const ring of polygon) {
                for (let index = 1; index < ring.length; index += 1) {
                    const start = ring[index - 1];
                    const end = ring[index];
                    if (start === undefined || end === undefined) continue;
                    const [startX, startY] = start;
                    const [endX, endY] = end;
                    if (startX === undefined || startY === undefined || endX === undefined || endY === undefined) {
                        throw new Error('contour ring has an incomplete coordinate');
                    }
                    const x0 = project(startX, columns);
                    const y0 = project(startY, rows);
                    const x1 = project(endX, columns);
                    const y1 = project(endY, rows);
                    // D3 closes threshold polygons around the grid frame. Those frame edges are not isolines.
                    if ((x0 === x1 && (x0 === 0 || x0 === MAP_COORDINATE_MAX)) ||
                        (y0 === y1 && (y0 === 0 || y0 === MAP_COORDINATE_MAX)) ||
                        (x0 === x1 && y0 === y1)) continue;
                    segments.push([x0, y0, x1, y1]);
                }
            }
        }
        return { level: geometry.value, segments };
    });
}
