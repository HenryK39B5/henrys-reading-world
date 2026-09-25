import { useEffect, useRef, useState } from 'react';
import type { MapViewport } from '../../domain/map.ts';
import { MAP_COORDINATE_MAX, type MapContour, type MapDensity } from '../../domain/types.ts';

export type MapStudyData = {
    density: MapDensity;
    contours: MapContour[];
    bands: Array<{ value: number; coordinates: number[][][][] }>;
};

type Renderer = { render: (view: MapViewport) => void; dispose: () => void };

function bandRenderer(canvas: HTMLCanvasElement, data: MapStudyData, width: number, height: number, opacity = 1): Renderer {
    const ctx = canvas.getContext('2d');
    if (ctx === null) throw new Error('Map study Canvas2D unavailable');
    return {
        render(view) {
            ctx.clearRect(0, 0, width, height);
            const scale = Math.min(width, height) / MAP_COORDINATE_MAX * view.zoom;
            for (const band of data.bands) {
                const shape = new Path2D();
                for (const polygon of band.coordinates) for (const ring of polygon) {
                    ring.forEach(([gx, gy], index) => {
                        const x = width / 2 + ((((gx ?? 0) - 0.5) / (data.density.columns - 1)) * MAP_COORDINATE_MAX - view.centerX) * scale;
                        const y = height / 2 + ((((gy ?? 0) - 0.5) / (data.density.rows - 1)) * MAP_COORDINATE_MAX - view.centerY) * scale;
                        if (index === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
                    });
                    shape.closePath();
                }
                const intensity = Math.max(0, Math.min(1, (band.value - 48) / 184));
                ctx.fillStyle = `rgba(${String(Math.round(122 + 42 * intensity))}, ${String(Math.round(166 + 13 * intensity))}, ${String(Math.round(131 - 5 * intensity))}, ${String((0.035 + intensity * 0.012) * opacity)})`;
                ctx.fill(shape, 'evenodd');
            }
        },
        dispose() {},
    };
}

function webglRenderer(canvas: HTMLCanvasElement, data: MapStudyData, width: number, height: number): Renderer | null {
    const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: false });
    if (gl === null) return null;
    const compile = (kind: number, source: string): WebGLShader => {
        const shader = gl.createShader(kind);
        if (shader === null) throw new Error('Map study shader allocation failed');
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
    const texture = gl.createTexture();
    if (program === null || texture === null) throw new Error('Map study GPU allocation failed');
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(String(gl.getProgramInfoLog(program)));
    gl.useProgram(program);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, data.density.columns, data.density.rows, 0, gl.RED, gl.UNSIGNED_BYTE, new Uint8Array(data.density.values));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.uniform2f(gl.getUniformLocation(program, 'viewport'), width, height);
    return {
        render(view) {
            gl.useProgram(program);
            gl.viewport(0, 0, width, height);
            gl.uniform3f(gl.getUniformLocation(program, 'view'), view.centerX, view.centerY, view.zoom);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        },
        dispose() {
            gl.deleteTexture(texture);
            gl.deleteProgram(program);
            gl.deleteShader(vertex);
            gl.deleteShader(fragment);
        },
    };
}

export function MapStudyTerrain({ data, view, width, height }: { data: MapStudyData; view: MapViewport; width: number; height: number }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const bandCanvasRef = useRef<HTMLCanvasElement>(null);
    const rendererRef = useRef<Renderer | null>(null);
    const bandRendererRef = useRef<Renderer | null>(null);
    const currentView = useRef(view);
    currentView.current = view;
    const [fallback, setFallback] = useState(false);
    useEffect(() => {
        const canvas = canvasRef.current;
        if (canvas === null) return;
        const ratio = Math.min(2, window.devicePixelRatio || 1);
        canvas.width = Math.round(width * ratio);
        canvas.height = Math.round(height * ratio);
        const handleLost = (event: Event): void => { event.preventDefault(); setFallback(true); };
        canvas.addEventListener('webglcontextlost', handleLost);
        let renderer: Renderer | null = null;
        try {
            renderer = fallback ? bandRenderer(canvas, data, canvas.width, canvas.height) : webglRenderer(canvas, data, canvas.width, canvas.height);
        } catch {
            setFallback(true);
        }
        if (renderer === null && !fallback) setFallback(true);
        rendererRef.current = renderer;
        renderer?.render(currentView.current);
        return () => {
            canvas.removeEventListener('webglcontextlost', handleLost);
            renderer?.dispose();
            rendererRef.current = null;
        };
    }, [data, fallback, height, width]);
    useEffect(() => {
        const canvas = bandCanvasRef.current;
        if (canvas === null) return;
        const ratio = Math.min(2, window.devicePixelRatio || 1);
        canvas.width = Math.round(width * ratio);
        canvas.height = Math.round(height * ratio);
        const renderer = bandRenderer(canvas, data, canvas.width, canvas.height, 0.28);
        bandRendererRef.current = renderer;
        renderer.render(currentView.current);
        return () => { renderer.dispose(); bandRendererRef.current = null; };
    }, [data, fallback, height, width]);
    useEffect(() => {
        rendererRef.current?.render(view);
        bandRendererRef.current?.render(view);
    }, [view]);
    return (
        <>
            <canvas key={fallback ? 'bands' : 'gpu'} ref={canvasRef} className="map-study-terrain" data-testid="map-study-terrain" data-renderer={fallback ? 'bands' : 'webgl2'} aria-hidden="true" />
            {fallback ? null : <canvas ref={bandCanvasRef} className="map-study-terrain" data-testid="map-study-bands" aria-hidden="true" />}
        </>
    );
}
