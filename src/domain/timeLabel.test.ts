import { describe, expect, it } from 'vitest';
import { describeBookCollection, relativeYearLabel } from './timeLabel.ts';

describe('relativeYearLabel', () => {
    it('uses fuzzy wording instead of exact dates', () => {
        expect(relativeYearLabel(2025, 2025)).toBe('今年的一次划线');
        expect(relativeYearLabel(2024, 2025)).toBe('一年前');
        expect(relativeYearLabel(2022, 2025)).toBe('来自 3 年前');
        expect(relativeYearLabel(2010, 2025)).toBe('很久以前的一次划线');
    });

    it('shows nothing when the year is missing, instead of claiming a period', () => {
        expect(relativeYearLabel(undefined, 2025)).toBeNull();
    });

    it('never claims a future passage', () => {
        expect(relativeYearLabel(2026, 2025)).toBeNull();
    });

    it('stops at five years for the explicit wording', () => {
        expect(relativeYearLabel(2020, 2025)).toBe('来自 5 年前');
        expect(relativeYearLabel(2019, 2025)).toBe('很久以前的一次划线');
    });
});

describe('describeBookCollection', () => {
    it('words a per-book count as a local collection, not a platform total', () => {
        expect(describeBookCollection(3)).toBe('这里收录了 3 处划线');
    });
});
