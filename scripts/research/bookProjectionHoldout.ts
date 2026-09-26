export type HoldoutPoint = { id: string; bookId: string; tagIds: readonly string[] };

export function bookHoldout(points: readonly HoldoutPoint[], tagId: string, bookId: string) {
    const foreground: number[] = [];
    const background: number[] = [];
    const queries: number[] = [];
    const candidates: number[] = [];
    points.forEach((point, index) => {
        if (point.bookId === bookId) { if (point.tagIds.includes(tagId)) queries.push(index); return; }
        candidates.push(index);
        (point.tagIds.includes(tagId) ? foreground : background).push(index);
    });
    return {
        foreground, background, queries, candidates,
        status: queries.length === 0 ? 'no-queries' : foreground.length < 2 ? 'insufficient-foreground' : background.length < 2 ? 'insufficient-background' : 'evaluated',
    };
}

export function equalBookSummary(entries: readonly { bookId: string; value: number }[]) {
    const groups = new Map<string, number[]>();
    for (const entry of entries) {
        if (!Number.isFinite(entry.value)) throw new Error('finite book measurements required');
        const group = groups.get(entry.bookId) ?? []; group.push(entry.value); groups.set(entry.bookId, group);
    }
    const books = [...groups].sort(([a], [b]) => a.localeCompare(b)).map(([bookId, values]) => ({ bookId, queries: values.length, mean: values.reduce((a, b) => a + b, 0) / values.length }));
    return { bookCount: books.length, queryCount: entries.length, mean: books.length === 0 ? null : books.reduce((sum, book) => sum + book.mean, 0) / books.length, books };
}

export function nontrivialMemberTask(candidateCount: number, k: number): boolean {
    if (!Number.isInteger(candidateCount) || candidateCount < 0 || !Number.isInteger(k) || k < 1) throw new Error('integer candidate count and positive k required');
    return candidateCount > k;
}
