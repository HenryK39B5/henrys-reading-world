import type { LengthBand } from './types.ts';

/** Length bands drive typography only; the passage itself is never altered. */
export const SHORT_MAX = 40;
export const MEDIUM_MAX = 120;

export function countNonWhitespace(text: string): number {
    let count = 0;
    for (const char of text) {
        if (!/\s/u.test(char)) {
            count += 1;
        }
    }
    return count;
}

export function lengthBand(text: string): LengthBand {
    const length = countNonWhitespace(text);
    if (length <= SHORT_MAX) {
        return 'short';
    }
    if (length <= MEDIUM_MAX) {
        return 'medium';
    }
    return 'long';
}

/** True when the passage keeps a line break that belongs to the original text. */
export function hasOriginalLineBreak(text: string): boolean {
    return /\r?\n/u.test(text.trimEnd());
}

/** Deduplication key: collapse whitespace, keep paragraph breaks. */
export function normalizeForKey(text: string): string {
    return text
        .replace(/\r\n?/gu, '\n')
        .split('\n')
        .map((line) => line.replace(/[^\S\n]+/gu, ' ').trim())
        .filter((line) => line.length > 0)
        .join('\n');
}
