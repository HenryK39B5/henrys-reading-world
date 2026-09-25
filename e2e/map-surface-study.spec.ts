import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ContourMultiPolygon } from 'd3-contour';
import { expect, test } from '@playwright/test';
import { fitMapPoints, WORLD_MAP_VIEW, type MapViewport } from '../src/domain/map.ts';
import type { MapContour, MapDensity, Snapshot } from '../src/domain/types.ts';

const snapshot = JSON.parse(readFileSync('src/data/public-snapshot.json', 'utf8')) as Snapshot;
const study = JSON.parse(readFileSync('.private/review/maintenance/m04/resolution/field-comparison.json', 'utf8')) as {
    pointsHash: string;
    originalDensityHash: string;
    labelHash: string;
    fields: { density: MapDensity; contours: MapContour[] }[];
    midBands: ContourMultiPolygon[];
};
const hash = (value: unknown): string => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const folder = join(process.cwd(), '.private/review/maintenance/m04/surface');
const modes = ['current', 'crosses-bands', 'crosses-smooth', 'crosses-webgl', 'quiet-grid-bands', 'blank-bands'] as const;

test('map surface treatments keep the same real points, contour positions and readable regions', async ({ page }) => {
    const map = snapshot.map;
    const field = study.fields[1];
    expect(map).toBeDefined();
    expect(field).toBeDefined();
    if (map === undefined || field === undefined) return;
    expect(study.pointsHash).toBe(hash(map.points));
    expect(study.originalDensityHash).toBe(hash(map.density));
    expect(study.labelHash).toBe(hash(map.labels));
    mkdirSync(folder, { recursive: true });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript(() => {
        const originalBegin = CanvasRenderingContext2D.prototype.beginPath;
        const originalMove = CanvasRenderingContext2D.prototype.moveTo;
        const originalLine = CanvasRenderingContext2D.prototype.lineTo;
        const originalStroke = CanvasRenderingContext2D.prototype.stroke;
        const originalRect = CanvasRenderingContext2D.prototype.fillRect;
        const segments = new WeakMap<CanvasRenderingContext2D, number[][]>();
        const mapContext = (ctx: CanvasRenderingContext2D): boolean => ctx.canvas.dataset.testid === 'map-canvas';
        CanvasRenderingContext2D.prototype.beginPath = function () {
            if (mapContext(this)) segments.set(this, []);
            return originalBegin.call(this);
        };
        CanvasRenderingContext2D.prototype.moveTo = function (x, y) {
            if (mapContext(this)) segments.get(this)?.push([x, y]);
            return originalMove.call(this, x, y);
        };
        CanvasRenderingContext2D.prototype.lineTo = function (x, y) {
            if (mapContext(this)) {
                const path = segments.get(this);
                const previous = path?.at(-1);
                if (previous !== undefined) path?.push([previous[0] ?? x, previous[1] ?? y, x, y]);
            }
            return originalLine.call(this, x, y);
        };
        CanvasRenderingContext2D.prototype.fillRect = function (x, y, w, h) {
            const mode = sessionStorage.getItem('map-surface-mode');
            if (mode !== null && mode !== 'current' && mapContext(this) && typeof this.fillStyle === 'string' &&
                /^rgba\(135, 171, 142, 0\./u.test(this.fillStyle)) {
                document.documentElement.dataset.mapStudyCells = 'suppressed';
                return;
            }
            return originalRect.call(this, x, y, w, h);
        };
        CanvasRenderingContext2D.prototype.stroke = function (...args) {
            const mode = sessionStorage.getItem('map-surface-mode');
            if (mode === null || mode === 'current' || !mapContext(this) || this.strokeStyle !== 'rgba(155, 181, 153, 0.035)') {
                return originalStroke.apply(this, args);
            }
            document.documentElement.dataset.mapStudyGrid = 'replaced';
            const path = (segments.get(this) ?? []).filter((part) => part.length === 4);
            const xs = [...new Set(path.filter((part) => Math.abs((part[0] ?? 0) - (part[2] ?? 0)) < 0.1).map((part) => part[0] ?? 0))];
            const ys = [...new Set(path.filter((part) => Math.abs((part[1] ?? 0) - (part[3] ?? 0)) < 0.1).map((part) => part[1] ?? 0))];
            originalBegin.call(this);
            if (mode === 'blank-bands') return;
            this.save();
            if (mode === 'quiet-grid-bands') {
                const halfX = xs.length > 1 ? ((xs[1] ?? 0) - (xs[0] ?? 0)) / 2 : 0;
                const halfY = ys.length > 1 ? ((ys[1] ?? 0) - (ys[0] ?? 0)) / 2 : 0;
                for (const x of [...xs, ...xs.map((value) => value + halfX)]) {
                    originalMove.call(this, x, 0); originalLine.call(this, x, this.canvas.clientHeight);
                }
                for (const y of [...ys, ...ys.map((value) => value + halfY)]) {
                    originalMove.call(this, 0, y); originalLine.call(this, this.canvas.clientWidth, y);
                }
                this.strokeStyle = 'rgba(167, 187, 168, 0.018)';
                this.lineWidth = 0.6;
            } else {
                const radius = this.canvas.clientWidth < 520 ? 2.4 : 3;
                for (const x of xs) for (const y of ys) {
                    if (x < 5 || x > this.canvas.clientWidth - 5 || y < 5 || y > this.canvas.clientHeight - 5) continue;
                    originalMove.call(this, x - radius, y); originalLine.call(this, x + radius, y);
                    originalMove.call(this, x, y - radius); originalLine.call(this, x, y + radius);
                }
                this.strokeStyle = 'rgba(181, 198, 178, 0.16)';
                this.lineWidth = 0.9;
            }
            originalStroke.call(this);
            this.restore();
        };
    });
    await page.route('**/assets/public-snapshot-*.json', (route) => route.fulfill({
        json: { ...snapshot, map: { ...map, density: field.density, contours: field.contours } },
    }));
    const tagIds = new Set(snapshot.highlights.filter((highlight) => highlight.tagIds.includes('tag-040')).map((highlight) => highlight.id));
    const regionView = fitMapPoints(map.points.filter((point) => tagIds.has(point.highlightId)));
    await page.goto('/henrys-reading-world/map/');
    for (const mode of modes) {
        await page.evaluate((value) => sessionStorage.setItem('map-surface-mode', value), mode);
        for (const width of [1440, 390, 320]) {
            await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
            for (const [name, url, view] of [
                ['world', '/henrys-reading-world/map/', WORLD_MAP_VIEW],
                ['region', '/henrys-reading-world/map/?tag=tag-040', regionView],
            ] as const) {
                await page.goto(url);
                const canvas = page.getByTestId('map-canvas');
                await expect(canvas).toBeVisible();
                await expect(page.getByTestId('map-summary')).toContainText('3462 个真实点');
                await expect.poll(() => canvas.evaluate((node) => (node as HTMLCanvasElement).width)).toBeGreaterThan(200);
                if (mode !== 'current') {
                    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.mapStudyGrid)).toBe('replaced');
                    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.mapStudyCells)).toBe('suppressed');
                    const visiblePixels = await page.evaluate(({ shapes, density, view, smooth, gpu }) => {
                        const original = document.querySelector<HTMLCanvasElement>('[data-testid="map-canvas"]');
                        if (original === null) throw new Error('map canvas missing');
                        const overlay = document.createElement('canvas');
                        const w = original.clientWidth;
                        const h = original.clientHeight;
                        overlay.width = w;
                        overlay.height = h;
                        overlay.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:0';
                        original.style.position = 'relative';
                        original.style.zIndex = '1';
                        original.parentElement?.insertBefore(overlay, original);
                        const gl = gpu ? overlay.getContext('webgl2', { preserveDrawingBuffer: true, alpha: true, premultipliedAlpha: false }) : null;
                        if (gpu && gl === null) throw new Error('WebGL2 unavailable in study browser');
                        if (gl !== null) {
                            const compile = (type: number, source: string): WebGLShader => {
                                const shader = gl.createShader(type);
                                if (shader === null) throw new Error('shader allocation failed');
                                gl.shaderSource(shader, source);
                                gl.compileShader(shader);
                                if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(String(gl.getShaderInfoLog(shader)));
                                return shader;
                            };
                            const vertex = compile(gl.VERTEX_SHADER, `#version 300 es
void main() {
 float x = float(gl_VertexID % 2) * 2.0 - 1.0;
 float y = float(gl_VertexID / 2) * 2.0 - 1.0;
 gl_Position = vec4(x, y, 0.0, 1.0);
}`);
                            const fragment = compile(gl.FRAGMENT_SHADER, `#version 300 es
precision highp float;
uniform sampler2D field;
uniform vec2 viewport;
uniform vec3 view;
out vec4 color;
void main() {
 float scale = min(viewport.x, viewport.y) / 10000.0 * view.z;
 vec2 map = vec2(view.x + (gl_FragCoord.x - viewport.x * 0.5) / scale, view.y + (viewport.y * 0.5 - gl_FragCoord.y) / scale);
 if(any(lessThan(map, vec2(0.0))) || any(greaterThan(map, vec2(10000.0)))) { color=vec4(0.0); return; }
 vec2 uv = map / 10000.0;
 float level = texture(field, uv).r;
 float relief = smoothstep(0.12, 0.85, level);
 vec2 texel = 1.0 / vec2(textureSize(field, 0));
 float slope = length(vec2(texture(field, uv + vec2(texel.x, 0.0)).r - texture(field, uv - vec2(texel.x, 0.0)).r, texture(field, uv + vec2(0.0, texel.y)).r - texture(field, uv - vec2(0.0, texel.y)).r));
 color = vec4(mix(vec3(0.45, 0.63, 0.48), vec3(0.78, 0.72, 0.52), relief), relief * 0.16 + slope * 0.05);
}`);
                            const program = gl.createProgram();
                            if (program === null) throw new Error('program allocation failed');
                            gl.attachShader(program, vertex);
                            gl.attachShader(program, fragment);
                            gl.linkProgram(program);
                            if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(String(gl.getProgramInfoLog(program)));
                            gl.useProgram(program);
                            gl.uniform2f(gl.getUniformLocation(program, 'viewport'), w, h);
                            gl.uniform3f(gl.getUniformLocation(program, 'view'), view.centerX, view.centerY, view.zoom);
                            gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
                            gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
                            gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, density.columns, density.rows, 0, gl.RED, gl.UNSIGNED_BYTE, new Uint8Array(density.values));
                            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                            gl.viewport(0, 0, w, h);
                            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
                            const data = new Uint8Array(w * h * 4);
                            gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, data);
                            let visible = 0;
                            for (let i = 3; i < data.length; i += 40) if ((data[i] ?? 0) > 0) visible += 1;
                            return visible;
                        }
                        const ctx = overlay.getContext('2d');
                        if (ctx === null) throw new Error('study underlay unavailable');
                        const scale = Math.min(w, h) / 10000 * view.zoom;
                        const sx = (mapX: number): number => w / 2 + (mapX - view.centerX) * scale;
                        const sy = (mapY: number): number => h / 2 + (mapY - view.centerY) * scale;
                        if (!smooth) {
                            for (const shape of shapes) {
                                const path = new Path2D();
                                for (const polygon of shape.coordinates) for (const ring of polygon) {
                                    ring.forEach(([gx, gy], i) => {
                                        const x = sx(((gx ?? 0) - 0.5) / (density.columns - 1) * 10000);
                                        const y = sy(((gy ?? 0) - 0.5) / (density.rows - 1) * 10000);
                                        if (i === 0) path.moveTo(x, y); else path.lineTo(x, y);
                                    });
                                    path.closePath();
                                }
                                const intensity = Math.max(0, Math.min(1, (shape.value - 48) / 184));
                                ctx.fillStyle = `rgba(${String(Math.round(122 + 42 * intensity))}, ${String(Math.round(166 + 13 * intensity))}, ${String(Math.round(131 - 5 * intensity))}, ${String(0.035 + intensity * 0.012)})`;
                                ctx.fill(path, 'evenodd');
                            }
                        } else {
                            const pixels = ctx.createImageData(w, h);
                            const values = density.values;
                            const cw = density.columns;
                            const ch = density.rows;
                            const sample = (x: number, y: number): number => values[y * cw + x] ?? 0;
                            for (let py = 0; py < h; py += 1) for (let px = 0; px < w; px += 1) {
                                const mx = view.centerX + (px - w / 2) / scale;
                                const my = view.centerY + (py - h / 2) / scale;
                                if (mx < 0 || mx > 10000 || my < 0 || my > 10000) continue;
                                const gx = mx / 10000 * (cw - 1);
                                const gy = my / 10000 * (ch - 1);
                                const x0 = Math.floor(gx);
                                const y0 = Math.floor(gy);
                                const x1 = Math.min(cw - 1, x0 + 1);
                                const y1 = Math.min(ch - 1, y0 + 1);
                                const fx = gx - x0;
                                const fy = gy - y0;
                                const value = (sample(x0, y0) * (1 - fx) + sample(x1, y0) * fx) * (1 - fy) +
                                    (sample(x0, y1) * (1 - fx) + sample(x1, y1) * fx) * fy;
                                const strength = Math.max(0, Math.min(1, (value / 255 - 0.12) / 0.73));
                                const position = (py * w + px) * 4;
                                pixels.data[position] = Math.round(115 + 80 * strength);
                                pixels.data[position + 1] = Math.round(162 + 25 * strength);
                                pixels.data[position + 2] = Math.round(125 + 4 * strength);
                                pixels.data[position + 3] = Math.round(strength * 38);
                            }
                            ctx.putImageData(pixels, 0, 0);
                        }
                        const data = ctx.getImageData(0, 0, w, h).data;
                        let visible = 0;
                        for (let i = 3; i < data.length; i += 40) if ((data[i] ?? 0) > 0) visible += 1;
                        return visible;
                    }, { shapes: study.midBands, density: field.density, view: view as MapViewport, smooth: mode === 'crosses-smooth', gpu: mode === 'crosses-webgl' });
                    expect(visiblePixels, `${mode}-${name}-${String(width)} underlay pixels`).toBeGreaterThan(100);
                }
                await canvas.locator('..').screenshot({ path: join(folder, `${mode}-${name}-${String(width)}.png`) });
                const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
                expect(overflow).toBeLessThanOrEqual(1);
            }
        }
    }
});
