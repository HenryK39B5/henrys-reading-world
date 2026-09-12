/**
 * Fuzzy time wording (docs/05 §7). Only an approved year is used, and the current year is
 * injected so tests never depend on the wall clock.
 */
export function relativeYearLabel(year: number | undefined, currentYear: number): string | null {
    if (year === undefined || !Number.isInteger(year) || !Number.isInteger(currentYear)) {
        return null;
    }
    const diff = currentYear - year;
    if (diff < 0) {
        return null;
    }
    if (diff === 0) {
        return '今年的一次划线';
    }
    if (diff === 1) {
        return '一年前';
    }
    if (diff <= 5) {
        return `来自 ${diff} 年前`;
    }
    return '很久以前的一次划线';
}

/** Real count wording for one book. Never presented as the platform-wide highlight total. */
export function describeBookCollection(count: number): string {
    return `这里收录了 ${count} 处划线`;
}
