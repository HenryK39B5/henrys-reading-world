import { describe, expect, it } from 'vitest';
import {
    MUTED_LIGHTNESS,
    MUTED_SATURATION,
    accentFromPixels,
    contrastRatio,
    DEFAULT_ACCENT,
    hexToRgb,
    hslToHex,
    muteColor,
    rgbToHex,
    rgbToHsl,
    type Rgb,
} from './accent.ts';

/**
 * The colour maths behind every accent in the product (docs/12 §4).
 *
 * These are the functions that turn a sampled cover into the muted colour a room wears, and the share card
 * reuses the same parsing, HSL and contrast helpers — so they are pinned here rather than only through a
 * screenshot. The ranges are the documented ones: low saturation, mid-dark lightness, and a real contrast
 * check instead of an assumption.
 */
const EXTREMES: Rgb[] = [
    { r: 255, g: 0, b: 0 },
    { r: 0, g: 255, b: 0 },
    { r: 0, g: 0, b: 255 },
    { r: 255, g: 255, b: 0 },
    { r: 0, g: 0, b: 0 },
    { r: 255, g: 255, b: 255 },
    { r: 141, g: 83, b: 76 },
];

describe('parsing a colour', () => {
    it('reads the three- and six-digit forms, with or without the hash', () => {
        expect(hexToRgb('#aabbcc')).toEqual({ r: 170, g: 187, b: 204 });
        expect(hexToRgb('aabbcc')).toEqual({ r: 170, g: 187, b: 204 });
        expect(hexToRgb('#abc')).toEqual(hexToRgb('#aabbcc'));
        expect(rgbToHex({ r: 170, g: 187, b: 204 })).toBe('#aabbcc');
    });

    it('refuses anything that is not a colour', () => {
        for (const value of ['', '   ', '#12345', '#gggggg', 'rgb(1,2,3)', 'rebeccapurple']) {
            expect(hexToRgb(value), value).toBeNull();
        }
    });

    it('clamps out-of-range channels instead of writing a broken colour', () => {
        expect(rgbToHex({ r: -20, g: 300, b: 128 })).toBe('#00ff80');
    });
});

describe('muting a sampled cover colour', () => {
    it('keeps every accent inside the documented range', () => {
        for (const colour of EXTREMES) {
            const muted = hexToRgb(muteColor(colour));
            expect(muted, JSON.stringify(colour)).not.toBeNull();
            if (muted === null) {
                continue;
            }
            const { s, l } = rgbToHsl(muted);
            // A rounded hex can land a hair outside the range it was clamped into.
            expect(s, `${JSON.stringify(colour)} saturation`).toBeGreaterThanOrEqual(
                MUTED_SATURATION.min - 0.02,
            );
            expect(s, `${JSON.stringify(colour)} saturation`).toBeLessThanOrEqual(MUTED_SATURATION.max + 0.02);
            expect(l, `${JSON.stringify(colour)} lightness`).toBeGreaterThanOrEqual(MUTED_LIGHTNESS.min - 0.02);
            expect(l, `${JSON.stringify(colour)} lightness`).toBeLessThanOrEqual(MUTED_LIGHTNESS.max + 0.02);
        }
    });

    it('mutes a sampled cover colour to the value the rooms have always worn', () => {
        // A regression pin, hand-checked against the formula rather than copied from a log: for
        // rgb(141, 83, 76) the saturation is 0.299 and the lightness 0.426, both already inside the range, and
        // the hue is 6.35°, which gives #8d534c. Pinning it is what makes the refactor that split `muteColor`
        // into `rgbToHsl` + `hslToHex` provably behaviour-preserving.
        expect(muteColor({ r: 141, g: 83, b: 76 })).toBe('#8d534c');
    });

    it('gives a colour with no hue at all a neutral one instead of a random one', () => {
        const grey = hexToRgb(muteColor({ r: 128, g: 128, b: 128 }));
        expect(grey).not.toBeNull();
        if (grey === null) {
            return;
        }
        // 210 is the documented neutral hue: blue is never the smallest channel of the result.
        expect(grey.b).toBeGreaterThanOrEqual(grey.r);
        expect(rgbToHsl(grey).h).toBeCloseTo(210, 0);
    });

    it('stays readable over paper', () => {
        const paper: Rgb = { r: 250, g: 249, b: 246 };
        for (const colour of EXTREMES) {
            const muted = hexToRgb(muteColor(colour));
            expect(muted).not.toBeNull();
            if (muted === null) {
                continue;
            }
            // Accents are used for rules, dots and hairlines rather than body text, but a muted accent must
            // still be visible against the page it sits on.
            expect(contrastRatio(muted, paper), JSON.stringify(colour)).toBeGreaterThan(2);
        }
    });
});

describe('averaging a sampled cover', () => {
    it('has nothing to say about no pixels', () => {
        expect(accentFromPixels([])).toBeNull();
    });

    it('prefers the colourful pixels so a white border cannot wash an accent out', () => {
        const white: Rgb = { r: 255, g: 255, b: 255 };
        const pixels = [white, white, white, { r: 190, g: 40, b: 40 }, { r: 200, g: 50, b: 45 }];
        const accent = hexToRgb(accentFromPixels(pixels) ?? '');
        expect(accent).not.toBeNull();
        if (accent === null) {
            return;
        }
        // A red cover stays red: the average of the two colourful pixels is nothing like the white ones.
        expect(accent.r).toBeGreaterThan(accent.g);
        expect(accent.r).toBeGreaterThan(accent.b);
    });

    it('falls back to the whole sample when almost nothing is saturated', () => {
        const pixels: Rgb[] = [
            { r: 128, g: 128, b: 128 },
            { r: 130, g: 129, b: 131 },
            { r: 126, g: 127, b: 125 },
        ];
        expect(accentFromPixels(pixels)).toBe(muteColor({ r: 128, g: 128, b: 128 }));
    });
});

describe('the hsl helpers the share card is built on', () => {
    it('round-trips a hue without inventing a different colour', () => {
        for (const colour of EXTREMES) {
            const { h, s, l } = rgbToHsl(colour);
            const parsed = hexToRgb(hslToHex(h, s, l));
            expect(parsed, JSON.stringify(colour)).not.toBeNull();
            if (parsed === null) {
                continue;
            }
            expect(Math.abs(parsed.r - colour.r)).toBeLessThanOrEqual(1);
            expect(Math.abs(parsed.g - colour.g)).toBeLessThanOrEqual(1);
            expect(Math.abs(parsed.b - colour.b)).toBeLessThanOrEqual(1);
        }
    });

    it('produces the default accent as a real colour', () => {
        expect(hexToRgb(DEFAULT_ACCENT)).not.toBeNull();
    });
});
