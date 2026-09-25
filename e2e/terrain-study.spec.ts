import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ContourMultiPolygon } from 'd3-contour';
import { expect, test, type Page } from '@playwright/test';
import type { MapContour, MapDensity, Snapshot } from '../src/domain/types.ts';

const snapshot = JSON.parse(readFileSync('src/data/public-snapshot.json', 'utf8')) as Snapshot;
const study = JSON.parse(readFileSync('.private/review/maintenance/m04/resolution/field-comparison.json', 'utf8')) as {
    sourceVersion: string;
    pointsHash: string;
    originalDensityHash: string;
    labelHash: string;
    levels: number[];
    fields: { density: MapDensity; contours: MapContour[]; coverage: { level: number; cells: number; segments: number }[] }[];
    midBands: ContourMultiPolygon[];
};
const hash = (value: unknown): string => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const output = join(process.cwd(), '.private/review/maintenance/m04/resolution');
const asset = '**/assets/public-snapshot-*.json';
const routes = [
    ['world', '/henrys-reading-world/map/'],
    ['region', '/henrys-reading-world/map/?tag=tag-040'],
] as const;

async function readyMap(page: Page, path: string): Promise<void> {
    await page.goto(path);
    const canvas = page.getByTestId('map-canvas');
    await expect(canvas).toBeVisible();
    await expect(page.getByTestId('map-summary')).toContainText('3462 个真实点');
    await expect.poll(() => canvas.evaluate((node) => (node as HTMLCanvasElement).width)).toBeGreaterThan(200);
}

test('matched grid resolutions use the same points, labels and reference density scale', async ({ page }) => {
    const map = snapshot.map;
    expect(map).toBeDefined();
    if (map === undefined) return;
    expect(study.sourceVersion).toBe(map.version);
    expect(study.pointsHash).toBe(hash(map.points));
    expect(study.labelHash).toBe(hash(map.labels));
    expect(study.originalDensityHash).toBe(hash(map.density));
    expect(study.fields[0]?.density).toEqual(map.density);
    mkdirSync(output, { recursive: true });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const field of study.fields) {
        const variant = `${String(field.density.columns)}x${String(field.density.rows)}`;
        await page.route(asset, (route) => route.fulfill({
            json: { ...snapshot, map: { ...map, density: field.density, contours: field.contours } },
        }));
        for (const width of [1440, 390, 320]) {
            await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
            for (const [name, path] of routes) {
                await readyMap(page, path);
                await page.getByTestId('map-canvas').screenshot({ path: join(output, `${variant}-${name}-${String(width)}.png`) });
                const colors = await page.getByTestId('map-canvas').evaluate((node) => {
                    const canvas = node as HTMLCanvasElement;
                    const data = canvas.getContext('2d')?.getImageData(0, 0, canvas.width, canvas.height).data;
                    const unique = new Set<string>();
                    if (data === undefined) return 0;
                    for (let i = 0; i < data.length; i += 4000) unique.add(`${data[i]},${data[i + 1]},${data[i + 2]},${data[i + 3]}`);
                    return unique.size;
                });
                expect(colors, `${variant}-${name}-${String(width)} rendered pixels`).toBeGreaterThan(3);
            }
        }
        await page.unroute(asset);
    }
});

test('precomputed isobands and a 2D WebGL field can sit behind real points and labels', async ({ page }) => {
    const map = snapshot.map;
    const field = study.fields[1]?.density;
    expect(map).toBeDefined();
    expect(field).toBeDefined();
    if (map === undefined || field === undefined) return;
    mkdirSync(output, { recursive: true });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.route(asset, (route) => route.fulfill({
        json: { ...snapshot, map: { ...map, density: field, contours: study.fields[1]?.contours } },
    }));
    for (const width of [1440, 390, 320]) {
        await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
        await readyMap(page, '/henrys-reading-world/map/');
        const bands = await page.evaluate(({ shapes, columns, rows }) => {
            const original = document.querySelector<HTMLCanvasElement>('[data-testid="map-canvas"]');
            if (original === null) return false;
            const overlay = document.createElement('canvas');
            const w = original.clientWidth;
            const h = original.clientHeight;
            overlay.width = w;
            overlay.height = h;
            overlay.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:0';
            original.style.position = 'relative';
            original.style.zIndex = '1';
            original.parentElement?.insertBefore(overlay, original);
            const ctx = overlay.getContext('2d');
            if (ctx === null) return false;
            const scale = Math.min(w, h) / 10000;
            for (const shape of shapes) {
                const path = new Path2D();
                for (const polygon of shape.coordinates) for (const ring of polygon) {
                    ring.forEach(([gx, gy], i) => {
                        const x = w / 2 + (((gx ?? 0) - 0.5) / (columns - 1) * 10000 - 5000) * scale;
                        const y = h / 2 + (((gy ?? 0) - 0.5) / (rows - 1) * 10000 - 5000) * scale;
                        if (i === 0) path.moveTo(x, y); else path.lineTo(x, y);
                    });
                    path.closePath();
                }
                const intensity = Math.max(0, Math.min(1, (shape.value - 48) / (232 - 48)));
                ctx.fillStyle = `rgba(${String(Math.round(122 + 42 * intensity))}, ${String(Math.round(166 + 13 * intensity))}, ${String(Math.round(131 - 5 * intensity))}, ${String(0.028 + intensity * 0.018)})`;
                ctx.fill(path, 'evenodd');
            }
            return ctx.getImageData(0, 0, w, h).data.some((value, i) => i % 4 === 3 && value > 0);
        }, { shapes: study.midBands, columns: field.columns, rows: field.rows });
        expect(bands).toBe(true);
        await page.getByTestId('map-canvas').locator('..').screenshot({ path: join(output, `bands-world-${String(width)}.png`) });

        // A separate test-only raster layer: WebGL2 samples the same 128x80 field, never vectors or private text.
        await readyMap(page, '/henrys-reading-world/map/');
        const webgl = await page.evaluate(({ density }) => {
            const original = document.querySelector<HTMLCanvasElement>('[data-testid="map-canvas"]');
            if (original === null) return { supported: false, pixels: 0, maximumAlpha: 0 };
            const overlay = document.createElement('canvas');
            overlay.width = original.clientWidth;
            overlay.height = original.clientHeight;
            overlay.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:0';
            original.style.position = 'relative';
            original.style.zIndex = '1';
            original.parentElement?.insertBefore(overlay, original);
            const gl = overlay.getContext('webgl2', { preserveDrawingBuffer: true, alpha: true, premultipliedAlpha: false });
            if (gl === null) return { supported: false, pixels: 0, maximumAlpha: 0 };
            const compile = (type: number, source: string): WebGLShader => {
                const shader = gl.createShader(type);
                if (shader === null) throw new Error('shader allocation failed');
                gl.shaderSource(shader, source);
                gl.compileShader(shader);
                if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(String(gl.getShaderInfoLog(shader)));
                return shader;
            };
            const vertex = compile(gl.VERTEX_SHADER, `#version 300 es\nvoid main() {\n float x = float(gl_VertexID % 2) * 2.0 - 1.0;\n float y = float(gl_VertexID / 2) * 2.0 - 1.0;\n gl_Position = vec4(x, y, 0.0, 1.0);\n}`);
            const fragment = compile(gl.FRAGMENT_SHADER, `#version 300 es\nprecision highp float;\nuniform sampler2D field;\nuniform vec2 viewport;\nout vec4 color;\nvoid main() {\n float scale = min(viewport.x, viewport.y) / 10000.0;\n vec2 map = vec2(5000.0 + (gl_FragCoord.x - viewport.x * 0.5) / scale, 5000.0 + (viewport.y * 0.5 - gl_FragCoord.y) / scale);\n if(any(lessThan(map, vec2(0.0))) || any(greaterThan(map, vec2(10000.0)))) { color=vec4(0.0); return; }\n vec2 uv = map / 10000.0;\n float level = texture(field, uv).r;\n float relief = smoothstep(0.12, 0.85, level);\n vec2 texel = 1.0 / vec2(textureSize(field, 0));\n float slope = length(vec2(texture(field, uv + vec2(texel.x, 0.0)).r - texture(field, uv - vec2(texel.x, 0.0)).r, texture(field, uv + vec2(0.0, texel.y)).r - texture(field, uv - vec2(0.0, texel.y)).r));\n color = vec4(mix(vec3(0.45, 0.63, 0.48), vec3(0.78, 0.72, 0.52), relief), relief * 0.16 + slope * 0.05);\n}`);
            const program = gl.createProgram();
            if (program === null) throw new Error('program allocation failed');
            gl.attachShader(program, vertex);
            gl.attachShader(program, fragment);
            gl.linkProgram(program);
            if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(String(gl.getProgramInfoLog(program)));
            gl.useProgram(program);
            gl.uniform2f(gl.getUniformLocation(program, 'viewport'), overlay.width, overlay.height);
            const tex = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, tex);
            gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, density.columns, density.rows, 0, gl.RED, gl.UNSIGNED_BYTE, new Uint8Array(density.values));
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.viewport(0, 0, overlay.width, overlay.height);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
            const data = new Uint8Array(overlay.width * overlay.height * 4);
            gl.readPixels(0, 0, overlay.width, overlay.height, gl.RGBA, gl.UNSIGNED_BYTE, data);
            let pixels = 0;
            let maximumAlpha = 0;
            for (let i = 3; i < data.length; i += 4) {
                if (data[i] > 0) pixels += 1;
                maximumAlpha = Math.max(maximumAlpha, data[i] ?? 0);
            }
            return { supported: true, pixels, maximumAlpha };
        }, { density: field });
        if (!webgl.supported) {
            test.info().annotations.push({ type: 'WebGL2 unavailable', description: `no GPU comparison at ${String(width)}px` });
            await expect(page.getByTestId('map-canvas')).toBeVisible();
            continue;
        }
        expect(webgl.pixels).toBeGreaterThan(1000);
        expect(webgl.maximumAlpha).toBeLessThan(90);
        await page.getByTestId('map-canvas').locator('..').screenshot({ path: join(output, `webgl-world-${String(width)}.png`) });
    }
});
