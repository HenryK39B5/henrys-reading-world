import { describe, expect, it } from 'vitest';
import { countNonWhitespace, hasOriginalLineBreak, lengthBand, normalizeForKey } from './length.ts';

describe('length banding', () => {
    it('ignores whitespace when counting', () => {
        expect(countNonWhitespace('a b\nc ')).toBe(3);
        expect(countNonWhitespace('   ')).toBe(0);
    });

    it('bands by non-whitespace length', () => {
        expect(lengthBand('x'.repeat(40))).toBe('short');
        expect(lengthBand('x'.repeat(41))).toBe('medium');
        expect(lengthBand('x'.repeat(120))).toBe('medium');
        expect(lengthBand('x'.repeat(121))).toBe('long');
    });

    it('detects line breaks that belong to the passage', () => {
        expect(hasOriginalLineBreak('第一行\n第二行')).toBe(true);
        expect(hasOriginalLineBreak('单行文本\n')).toBe(false);
        expect(hasOriginalLineBreak('单行文本')).toBe(false);
    });

    it('deduplicates on collapsed whitespace while keeping paragraphs', () => {
        expect(normalizeForKey('  一段   文字  ')).toBe('一段 文字');
        expect(normalizeForKey('第一段\r\n\r\n第二段')).toBe('第一段\n第二段');
        expect(normalizeForKey('a\tb')).toBe(normalizeForKey('a b'));
    });
});
