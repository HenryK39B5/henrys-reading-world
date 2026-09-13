/**
 * The colour of a share card (docs/16 §4.4, §5).
 *
 * A card is a small publication, not a poster and not a white sheet: one real passage arrives as a
 * low-saturation dark surface that belongs to its book, with warm paper-coloured ink on it. The division
 * of labour is deliberate and comes from the reference cards the user provided — the *surface* carries the
 * book (that is the Book Aura the rest of the product already has), while the *ink* stays warm paper for
 * every book, so no reader has to re-tune their eye to a greenish white on one card and a bluish white on
 * the next.
 *
 * Three properties matter more than taste here, and all three are provable without a browser:
 *
 * 1. it is derived from one colour and nothing else — the same accent always produces the same card, with
 *    no randomness, no date, no title hash and no external palette;
 * 2. both the passage and the quieter lines (source, brand, local-only badge) stay above WCAG AA against
 *    the surface they actually sit on, which is solved for rather than eyeballed;
 * 3. an unreadable accent (a typo, an empty string, a colour that is somehow pure black) falls back to the
 *    project's default instead of producing blank-on-blank.
 */
import { DEFAULT_ACCENT, contrastRatio, hexToRgb, hslToHex, rgbToHsl, type Hsl, type Rgb } from './accent.ts';

export type SharePalette = {
    /** The card's surface, carrying the book. */
    background: string;
    /** The passage. */
    text: string;
    /** Source, brand and the local-only badge. */
    mutedText: string;
    /** The hairlines that divide surface, passage and source. */
    rule: string;
};

/** Where a card's surface starts: dark enough to be a card, tinted enough to be *that* book's card. */
const SURFACE_LIGHTNESS = 0.2;
/** How much of the accent's own saturation survives into the surface. */
const SURFACE_SATURATION_SHARE = 0.75;
const SURFACE_SATURATION = { min: 0.1, max: 0.26 } as const;

/**
 * Warm paper ink: the same colour on every card, and the reason a card reads as a publication. The
 * saturation is deliberately not tiny — at this lightness a small HSL saturation collapses into plain white,
 * which is the very thing the cards were asked to stop being.
 */
const INK_BASE: Hsl = { h: 38, s: 0.38, l: 0.91 };
const MUTED_INK_BASE: Hsl = { h: 38, s: 0.22, l: 0.72 };

/** The passage has to be comfortably readable, not merely legal. */
const TEXT_CONTRAST = 7;
/** The quieter lines are still text: AA is the floor, and it is checked, not assumed. */
const MUTED_CONTRAST = 4.6;

function asRgb(value: string): Rgb | null {
    return hexToRgb(value);
}

function surface(accent: Hsl): string {
    const saturation = Math.min(
        SURFACE_SATURATION.max,
        Math.max(SURFACE_SATURATION.min, accent.s * SURFACE_SATURATION_SHARE),
    );
    return hslToHex(accent.h, saturation, SURFACE_LIGHTNESS);
}

/**
 * Raises a colour's lightness until it stands out enough against the card.
 *
 * Stepping instead of guessing means the readability of the ink never depends on how dark or how saturated
 * a particular book's cover happened to be: the surface carries the colour, and the ink is lifted to meet
 * its target on that surface. The loop is bounded, so a palette is always returned.
 */
function readable(bg: Rgb, base: Hsl, target: number, step: number): string {
    let lightness = base.l;
    let colour = hslToHex(base.h, base.s, lightness);
    for (let attempt = 0; attempt < 40 && lightness < 1; attempt += 1) {
        const parsed = asRgb(colour);
        if (parsed === null || contrastRatio(parsed, bg) >= target) {
            return colour;
        }
        lightness = Math.min(1, lightness + step);
        colour = hslToHex(base.h, base.s, lightness);
    }
    return colour;
}

/** The share card's palette for one book accent. */
export function sharePalette(accent: string): SharePalette {
    // An accent that cannot be read is not a colour: the project default is the only honest answer.
    const source = asRgb(accent) === null ? DEFAULT_ACCENT : accent;
    const parsed = asRgb(source);
    const accentHsl = rgbToHsl(parsed ?? { r: 66, g: 90, b: 75 });

    const background = surface(accentHsl);
    const backgroundRgb = asRgb(background);
    if (backgroundRgb === null) {
        // Unreachable: `hslToHex` always produces a valid six-digit colour.
        return sharePalette(DEFAULT_ACCENT);
    }

    return {
        background,
        text: readable(backgroundRgb, INK_BASE, TEXT_CONTRAST, 0.01),
        mutedText: readable(backgroundRgb, MUTED_INK_BASE, MUTED_CONTRAST, 0.02),
        // The hairlines only have to read as a division, so they sit between the surface and the ink.
        rule: hslToHex(accentHsl.h, Math.min(0.3, accentHsl.s * 0.6), 0.36),
    };
}
