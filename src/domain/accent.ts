/**
 * Colour handling for cover-derived accents.
 *
 * A cover is the only saturated thing on the page, so any accent taken from it is deliberately
 * muted: low saturation, mid-dark lightness. That keeps the passage as the visual centre
 * (PRODUCT_BRIEF P1) while the world layer stops being grey.
 */
export const DEFAULT_ACCENT = '#425a4b';

/** The range a cover accent is muted into, so a sampled colour cannot shout on paper. */
export const MUTED_SATURATION = { min: 0.12, max: 0.34 } as const;
export const MUTED_LIGHTNESS = { min: 0.3, max: 0.46 } as const;

/** Hues a colour with no hue at all (a grey sample) falls back to. */
const NEUTRAL_HUE = 210;

export type Rgb = { r: number; g: number; b: number };
export type Hsl = { h: number; s: number; l: number };

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

function toHex(value: number): string {
    return clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0');
}

export function rgbToHex({ r, g, b }: Rgb): string {
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function relativeLuminance(rgb: Rgb): number {
    const channel = (value: number) => {
        const scaled = value / 255;
        return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

export function contrastRatio(left: Rgb, right: Rgb): number {
    const first = relativeLuminance(left);
    const second = relativeLuminance(right);
    const lighter = Math.max(first, second);
    const darker = Math.min(first, second);
    return (lighter + 0.05) / (darker + 0.05);
}

/** Parses `#rgb` / `#rrggbb` (with or without the hash). Anything else is not a colour. */
export function hexToRgb(value: string): Rgb | null {
    const text = value.trim().replace(/^#/u, '');
    const expanded = text.length === 3 ? [...text].map((char) => `${char}${char}`).join('') : text;
    if (!/^[0-9a-f]{6}$/iu.test(expanded)) {
        return null;
    }
    return {
        r: Number.parseInt(expanded.slice(0, 2), 16),
        g: Number.parseInt(expanded.slice(2, 4), 16),
        b: Number.parseInt(expanded.slice(4, 6), 16),
    };
}

export function rgbToHsl({ r, g, b }: Rgb): Hsl {
    const red = r / 255;
    const green = g / 255;
    const blue = b / 255;
    const max = Math.max(red, green, blue);
    const min = Math.min(red, green, blue);
    const l = (max + min) / 2;
    const delta = max - min;
    const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));

    const h = (() => {
        if (delta === 0) {
            return NEUTRAL_HUE;
        }
        if (max === red) {
            return (60 * (((green - blue) / delta) % 6) + 360) % 360;
        }
        if (max === green) {
            return 60 * ((blue - red) / delta + 2);
        }
        return 60 * ((red - green) / delta + 4);
    })();

    return { h, s, l };
}

export function hslToHex(h: number, s: number, l: number): string {
    const chroma = (1 - Math.abs(2 * l - 1)) * s;
    const secondary = chroma * (1 - Math.abs(((h / 60) % 2) - 1));
    const offset = l - chroma / 2;
    const sector = Math.floor(h / 60) % 6;
    const parts: [number, number, number] =
        sector === 0
            ? [chroma, secondary, 0]
            : sector === 1
              ? [secondary, chroma, 0]
              : sector === 2
                ? [0, chroma, secondary]
                : sector === 3
                  ? [0, secondary, chroma]
                  : sector === 4
                    ? [secondary, 0, chroma]
                    : [chroma, 0, secondary];

    return rgbToHex({
        r: (parts[0] + offset) * 255,
        g: (parts[1] + offset) * 255,
        b: (parts[2] + offset) * 255,
    });
}

/** Mutes a sampled colour so it can sit on paper without shouting. */
export function muteColor(rgb: Rgb): string {
    const { h, s, l } = rgbToHsl(rgb);
    return hslToHex(
        h,
        clamp(s, MUTED_SATURATION.min, MUTED_SATURATION.max),
        clamp(l, MUTED_LIGHTNESS.min, MUTED_LIGHTNESS.max),
    );
}

/**
 * Average of the more saturated pixels in a small sample, so a white border or a beige background
 * does not wash the accent out. Falls back to the overall average, then to nothing.
 */
export function accentFromPixels(pixels: Rgb[]): string | null {
    if (pixels.length === 0) {
        return null;
    }
    const saturationOf = (pixel: Rgb) => {
        const max = Math.max(pixel.r, pixel.g, pixel.b);
        const min = Math.min(pixel.r, pixel.g, pixel.b);
        return max === 0 ? 0 : (max - min) / max;
    };
    const colourful = pixels.filter((pixel) => saturationOf(pixel) >= 0.15 && saturationOf(pixel) <= 0.95);
    const source = colourful.length >= 4 ? colourful : pixels;
    const average = source.reduce(
        (total, pixel) => ({ r: total.r + pixel.r / source.length, g: total.g + pixel.g / source.length, b: total.b + pixel.b / source.length }),
        { r: 0, g: 0, b: 0 },
    );
    return muteColor(average);
}

export const PAPER: Rgb = { r: 250, g: 249, b: 246 };
