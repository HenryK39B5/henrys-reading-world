import { describe, expect, it } from 'vitest';
import { DEFAULT_ACCENT, contrastRatio, hexToRgb } from './accent.ts';
import { sharePalette } from './sharePalette.ts';

/**
 * The share card's colour contract (docs/16 §4.4, §5.2).
 *
 * These are the properties that cannot be checked by looking at one screenshot: that the same book always
 * produces the same card, that the text on it is readable whatever the cover happened to be, and that a
 * broken colour cannot produce an unreadable card.
 *
 * Accents below stand in for real covers — a muted green like the project's own default, a deep red, a
 * near-black, a pale yellow — because the point is the arithmetic, not any one book.
 */
const ACCENTS = ['#425a4b', '#8b4f48', '#2b3a5c', '#101010', '#f0d98c', '#7a5c2e', '#3d435c', '#8c7560'];

function background(accent: string): string {
    return sharePalette(accent).background;
}

function luminance(hex: string): number {
    const rgb = hexToRgb(hex);
    if (rgb === null) {
        throw new Error(`not a colour: ${hex}`);
    }
    const channel = (value: number) => {
        const scaled = value / 255;
        return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

describe('the share palette is derived from one accent and nothing else', () => {
    it('returns the same card for the same accent', () => {
        for (const accent of ACCENTS) {
            expect(sharePalette(accent)).toEqual(sharePalette(accent));
        }
    });

    it('produces every value as a real six-digit colour', () => {
        for (const accent of ACCENTS) {
            const palette = sharePalette(accent);
            for (const value of [palette.background, palette.text, palette.mutedText, palette.rule]) {
                expect(value, `${accent} → ${value}`).toMatch(/^#[0-9a-f]{6}$/u);
            }
        }
    });

    it('gives different books visibly different cards', () => {
        const surfaces = ACCENTS.map((accent) => background(accent));
        // Six accents that stand for eight books: at least four distinct surfaces, so a reader would never
        // mistake one book's card for another's.
        expect(new Set(surfaces).size).toBeGreaterThanOrEqual(4);
        expect(background('#2b3a5c')).not.toBe(background('#8b4f48'));
    });

    it('keeps the surface dark, because a card is not a poster', () => {
        for (const accent of ACCENTS) {
            expect(luminance(background(accent)), accent).toBeLessThan(0.06);
        }
    });
});

describe('everything written on a card is readable on that card', () => {
    it('keeps the passage well above AA on its own surface', () => {
        for (const accent of ACCENTS) {
            const palette = sharePalette(accent);
            const surface = hexToRgb(palette.background);
            const text = hexToRgb(palette.text);
            if (surface === null || text === null) {
                throw new Error('palette produced an unparseable colour');
            }
            expect(contrastRatio(text, surface), `${accent} passage`).toBeGreaterThanOrEqual(7);
        }
    });

    it('keeps the source, brand and badge above AA too', () => {
        for (const accent of ACCENTS) {
            const palette = sharePalette(accent);
            const surface = hexToRgb(palette.background);
            const muted = hexToRgb(palette.mutedText);
            if (surface === null || muted === null) {
                throw new Error('palette produced an unparseable colour');
            }
            // The quieter lines are quieter, never unreadable: 4.5 is the WCAG AA floor for body text.
            expect(contrastRatio(muted, surface), `${accent} source`).toBeGreaterThanOrEqual(4.5);
        }
    });

    it('keeps the hairlines visible without competing with the text', () => {
        for (const accent of ACCENTS) {
            const palette = sharePalette(accent);
            const surface = hexToRgb(palette.background);
            const rule = hexToRgb(palette.rule);
            if (surface === null || rule === null) {
                throw new Error('palette produced an unparseable colour');
            }
            const ratio = contrastRatio(rule, surface);
            expect(ratio, `${accent} rule`).toBeGreaterThan(1.5);
            expect(ratio, `${accent} rule`).toBeLessThan(8);
        }
    });
});

describe('a colour that cannot be read falls back to the project default', () => {
    it('handles nonsense, blanks and missing values', () => {
        const fallback = sharePalette(DEFAULT_ACCENT);
        for (const accent of ['', '   ', 'not-a-colour', '#12345', '#gggggg', 'rgb(1,2,3)']) {
            expect(sharePalette(accent), JSON.stringify(accent)).toEqual(fallback);
        }
    });

    it('accepts the shorthands a real cover sampling could produce', () => {
        expect(sharePalette('#abc')).toEqual(sharePalette('#aabbcc'));
        expect(sharePalette('aabbcc')).toEqual(sharePalette('#aabbcc'));
    });
});
