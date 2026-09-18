import type { Highlight, Snapshot } from '../../src/domain/types.ts';
import {
    EMBEDDING_EVALUATION_SCHEMA_VERSION,
    cosineSimilarity,
    lengthBand,
    type CachedEmbedding,
    type EvaluationCase,
    type EvaluationCorpus,
    type EvaluationCorpusEntry,
    type EvaluationLabels,
} from './core.ts';

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stableEntries(snapshot: Snapshot): EvaluationCorpusEntry[] {
    const books = new Map(snapshot.books.map((book) => [book.id, book]));
    return [...snapshot.highlights]
        .sort((left, right) => left.id.localeCompare(right.id))
        .map((highlight) => ({
            id: highlight.id,
            bookId: highlight.bookId,
            themeIds: [...(books.get(highlight.bookId)?.themeIds ?? [])],
            lengthBand: lengthBand(highlight.text),
        }));
}

function takeBookCoverage(entries: EvaluationCorpusEntry[], targetCount: number): EvaluationCorpusEntry[] {
    const byBook = new Map<string, EvaluationCorpusEntry[]>();
    for (const entry of entries) {
        const items = byBook.get(entry.bookId) ?? [];
        items.push(entry);
        byBook.set(entry.bookId, items);
    }
    const selected: EvaluationCorpusEntry[] = [];
    const selectedIds = new Set<string>();
    for (const [, items] of [...byBook].sort(([left], [right]) => left.localeCompare(right))) {
        const byBand = new Map<EvaluationCorpusEntry['lengthBand'], EvaluationCorpusEntry>();
        for (const item of items) {
            if (!byBand.has(item.lengthBand)) {
                byBand.set(item.lengthBand, item);
            }
        }
        const first = byBand.get('short') ?? byBand.get('medium') ?? byBand.get('long') ?? items[0];
        const second = byBand.get('long') ?? byBand.get('medium') ?? byBand.get('short') ?? items.at(-1);
        for (const item of [first, second]) {
            if (item !== undefined && !selectedIds.has(item.id) && selected.length < targetCount) {
                selected.push(item);
                selectedIds.add(item.id);
            }
        }
    }
    return selected;
}

export function selectEvaluationCorpus(
    snapshot: Snapshot,
    targetCount = 300,
    requiredIds: Iterable<string> = [],
): EvaluationCorpusEntry[] {
    if (!Number.isInteger(targetCount) || targetCount <= 0 || targetCount > snapshot.highlights.length) {
        throw new Error(`evaluation target count must be between 1 and ${String(snapshot.highlights.length)}`);
    }
    const entries = stableEntries(snapshot);
    const byId = new Map(entries.map((entry) => [entry.id, entry]));
    const selected = takeBookCoverage(entries, targetCount);
    const selectedIds = new Set(selected.map((entry) => entry.id));

    for (const id of [...new Set(requiredIds)].sort()) {
        const entry = byId.get(id);
        if (entry === undefined) {
            throw new Error(`evaluation labels reference unknown highlight ${id}`);
        }
        if (!selectedIds.has(id)) {
            selected.push(entry);
            selectedIds.add(id);
        }
    }

    const perBook = new Map<string, number>();
    for (const entry of selected) {
        perBook.set(entry.bookId, (perBook.get(entry.bookId) ?? 0) + 1);
    }
    const remaining = entries.filter((entry) => !selectedIds.has(entry.id));
    const bucketOrder: EvaluationCorpusEntry['lengthBand'][] = ['short', 'medium', 'long'];
    let pass = 0;
    while (selected.length < targetCount) {
        let added = false;
        for (const band of bucketOrder) {
            const candidate = remaining.find((entry) => {
                if (entry.lengthBand !== band || selectedIds.has(entry.id)) {
                    return false;
                }
                const primaryTheme = entry.themeIds[0] ?? '';
                const desiredThemeIndex = pass % Math.max(1, snapshot.themes.length);
                const desiredTheme = [...snapshot.themes].sort((left, right) => left.id.localeCompare(right.id))[desiredThemeIndex]?.id;
                return (desiredTheme === undefined || primaryTheme === desiredTheme) && (perBook.get(entry.bookId) ?? 0) < 4;
            });
            if (candidate !== undefined) {
                selected.push(candidate);
                selectedIds.add(candidate.id);
                perBook.set(candidate.bookId, (perBook.get(candidate.bookId) ?? 0) + 1);
                added = true;
                if (selected.length === targetCount) {
                    break;
                }
            }
        }
        if (!added) {
            const candidate = remaining.find((entry) => !selectedIds.has(entry.id) && (perBook.get(entry.bookId) ?? 0) < 4);
            if (candidate === undefined) {
                throw new Error('could not fill the evaluation corpus under the per-book cap');
            }
            selected.push(candidate);
            selectedIds.add(candidate.id);
            perBook.set(candidate.bookId, (perBook.get(candidate.bookId) ?? 0) + 1);
        }
        pass += 1;
    }

    if (selected.length > targetCount) {
        const required = new Set(requiredIds);
        const removable = selected.filter((entry) => !required.has(entry.id)).reverse();
        while (selected.length > targetCount) {
            const candidate = removable.shift();
            if (candidate === undefined) {
                throw new Error('required evaluation labels exceed the target corpus size');
            }
            const index = selected.findIndex((entry) => entry.id === candidate.id);
            if (index >= 0) {
                selected.splice(index, 1);
            }
        }
    }

    return selected.sort((left, right) => left.id.localeCompare(right.id));
}

export function parseEvaluationLabels(value: unknown): EvaluationLabels {
    if (!isRecord(value) || value.schemaVersion !== EMBEDDING_EVALUATION_SCHEMA_VERSION || !Array.isArray(value.cases)) {
        throw new Error('embedding evaluation labels: invalid top-level shape');
    }
    const topExtra = Object.keys(value).filter((key) => !['schemaVersion', 'cases'].includes(key));
    if (topExtra.length > 0) {
        throw new Error(`embedding evaluation labels: unsupported field(s) ${topExtra.join(', ')}`);
    }
    const cases: EvaluationCase[] = value.cases.map((raw, index) => {
        if (!isRecord(raw)) {
            throw new Error(`embedding evaluation labels.cases[${String(index)}]: expected an object`);
        }
        const extra = Object.keys(raw).filter((key) => !['id', 'kind', 'queryId', 'positiveIds', 'negativeIds', 'note'].includes(key));
        if (extra.length > 0) {
            throw new Error(`embedding evaluation labels.cases[${String(index)}]: unsupported field(s) ${extra.join(', ')}`);
        }
        const { id, kind, queryId, positiveIds, negativeIds, note } = raw;
        if (typeof id !== 'string' || id.length === 0 || typeof queryId !== 'string' || queryId.length === 0) {
            throw new Error(`embedding evaluation labels.cases[${String(index)}]: id and queryId are required`);
        }
        if (!['cross-book-related', 'near-boundary', 'keyword-false-friend'].includes(String(kind))) {
            throw new Error(`embedding evaluation labels.cases[${String(index)}]: invalid kind`);
        }
        if (!Array.isArray(positiveIds) || positiveIds.length === 0 || positiveIds.some((entry) => typeof entry !== 'string')) {
            throw new Error(`embedding evaluation labels.cases[${String(index)}].positiveIds: expected non-empty string array`);
        }
        if (!Array.isArray(negativeIds) || negativeIds.some((entry) => typeof entry !== 'string')) {
            throw new Error(`embedding evaluation labels.cases[${String(index)}].negativeIds: expected string array`);
        }
        if (note !== undefined && (typeof note !== 'string' || note.trim().length === 0)) {
            throw new Error(`embedding evaluation labels.cases[${String(index)}].note: expected non-empty string`);
        }
        return {
            id,
            kind: kind as EvaluationCase['kind'],
            queryId,
            positiveIds: positiveIds as string[],
            negativeIds: negativeIds as string[],
            ...(typeof note === 'string' ? { note } : {}),
        };
    });
    const caseIds = cases.map((item) => item.id);
    if (new Set(caseIds).size !== caseIds.length) {
        throw new Error('embedding evaluation labels: duplicate case id');
    }
    return { schemaVersion: EMBEDDING_EVALUATION_SCHEMA_VERSION, cases };
}

export function labelHighlightIds(labels: EvaluationLabels): string[] {
    return [...new Set(labels.cases.flatMap((item) => [item.queryId, ...item.positiveIds, ...item.negativeIds]))].sort();
}

export type EvaluationMetrics = {
    cases: number;
    meanReciprocalRank: number;
    recallAt5: number;
    recallAt10: number;
    pairAccuracy: number;
    meanPositiveSimilarity: number;
    meanNegativeSimilarity: number | null;
    meanMargin: number | null;
    neighborhoodBookDiversityAt10: number;
};

function mean(values: number[]): number {
    return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function evaluateEmbeddings(
    corpus: EvaluationCorpus,
    labels: EvaluationLabels,
    vectors: Record<string, CachedEmbedding>,
): EvaluationMetrics {
    const entries = new Map(corpus.entries.map((entry) => [entry.id, entry]));
    const reciprocalRanks: number[] = [];
    const recall5: number[] = [];
    const recall10: number[] = [];
    const pairAccuracies: number[] = [];
    const positiveSimilarities: number[] = [];
    const negativeSimilarities: number[] = [];
    const margins: number[] = [];
    const bookDiversities: number[] = [];

    for (const item of labels.cases) {
        const query = vectors[item.queryId]?.values;
        if (query === undefined) {
            throw new Error(`missing embedding for evaluation query ${item.queryId}`);
        }
        const ranked = corpus.entries
            .filter((entry) => entry.id !== item.queryId)
            .map((entry) => {
                const vector = vectors[entry.id]?.values;
                if (vector === undefined) {
                    throw new Error(`missing embedding for corpus highlight ${entry.id}`);
                }
                return { id: entry.id, bookId: entry.bookId, similarity: cosineSimilarity(query, vector) };
            })
            .sort((left, right) => right.similarity - left.similarity || left.id.localeCompare(right.id));
        const positiveSet = new Set(item.positiveIds);
        const positiveRanks = ranked
            .map((entry, index) => ({ entry, rank: index + 1 }))
            .filter(({ entry }) => positiveSet.has(entry.id));
        const bestRank = Math.min(...positiveRanks.map(({ rank }) => rank));
        reciprocalRanks.push(Number.isFinite(bestRank) ? 1 / bestRank : 0);
        recall5.push(positiveRanks.some(({ rank }) => rank <= 5) ? 1 : 0);
        recall10.push(positiveRanks.some(({ rank }) => rank <= 10) ? 1 : 0);

        const positiveScores = item.positiveIds.map((id) => {
            const vector = vectors[id]?.values;
            if (vector === undefined || !entries.has(id)) {
                throw new Error(`missing positive evaluation embedding ${id}`);
            }
            return cosineSimilarity(query, vector);
        });
        positiveSimilarities.push(...positiveScores);
        const bestPositive = Math.max(...positiveScores);
        if (item.negativeIds.length > 0) {
            const negativeScores = item.negativeIds.map((id) => {
                const vector = vectors[id]?.values;
                if (vector === undefined || !entries.has(id)) {
                    throw new Error(`missing negative evaluation embedding ${id}`);
                }
                return cosineSimilarity(query, vector);
            });
            negativeSimilarities.push(...negativeScores);
            const bestNegative = Math.max(...negativeScores);
            pairAccuracies.push(bestPositive > bestNegative ? 1 : 0);
            margins.push(bestPositive - bestNegative);
        }

        const books = new Set(ranked.slice(0, 10).map((entry) => entry.bookId));
        bookDiversities.push(books.size / Math.min(10, ranked.length));
    }

    return {
        cases: labels.cases.length,
        meanReciprocalRank: mean(reciprocalRanks),
        recallAt5: mean(recall5),
        recallAt10: mean(recall10),
        pairAccuracy: mean(pairAccuracies),
        meanPositiveSimilarity: mean(positiveSimilarities),
        meanNegativeSimilarity: negativeSimilarities.length === 0 ? null : mean(negativeSimilarities),
        meanMargin: margins.length === 0 ? null : mean(margins),
        neighborhoodBookDiversityAt10: mean(bookDiversities),
    };
}

export function corpusCoverage(corpus: EvaluationCorpus, highlights: Highlight[]): {
    books: number;
    themes: number;
    short: number;
    medium: number;
    long: number;
    characters: number;
} {
    const highlightsById = new Map(highlights.map((item) => [item.id, item]));
    return {
        books: new Set(corpus.entries.map((entry) => entry.bookId)).size,
        themes: new Set(corpus.entries.flatMap((entry) => entry.themeIds)).size,
        short: corpus.entries.filter((entry) => entry.lengthBand === 'short').length,
        medium: corpus.entries.filter((entry) => entry.lengthBand === 'medium').length,
        long: corpus.entries.filter((entry) => entry.lengthBand === 'long').length,
        characters: corpus.entries.reduce((sum, entry) => sum + [...(highlightsById.get(entry.id)?.text.replace(/\s/gu, '') ?? '')].length, 0),
    };
}
