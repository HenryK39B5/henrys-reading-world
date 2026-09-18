import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { embeddingPrivatePaths } from './embeddings/privatePaths.ts';

type Metrics = {
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

type ProviderReport = {
    schemaVersion: number;
    generatedAt: string;
    provider: string;
    model: string;
    dimensions: number;
    corpusHighlights: number;
    evaluationCases: number;
    requests: number;
    inputTokens: number | null;
    elapsedMilliseconds: number;
    estimatedCostUsd: number | null;
    metrics: Metrics;
};

function isProviderReport(value: unknown): value is ProviderReport {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return false;
    }
    const report = value as Partial<ProviderReport>;
    return (
        typeof report.provider === 'string' &&
        typeof report.model === 'string' &&
        typeof report.dimensions === 'number' &&
        typeof report.metrics === 'object' &&
        report.metrics !== null
    );
}

function score(report: ProviderReport): number {
    const metrics = report.metrics;
    return (
        metrics.pairAccuracy * 0.35 +
        metrics.recallAt10 * 0.25 +
        metrics.meanReciprocalRank * 0.2 +
        metrics.recallAt5 * 0.1 +
        metrics.neighborhoodBookDiversityAt10 * 0.1
    );
}

async function main(): Promise<void> {
    const paths = embeddingPrivatePaths();
    const names = await readdir(paths.reports);
    const reports: ProviderReport[] = [];
    for (const name of names.filter((entry) => entry.endsWith('.json')).sort()) {
        const parsed = JSON.parse(await readFile(resolve(paths.reports, name), 'utf8')) as unknown;
        if (isProviderReport(parsed)) {
            reports.push(parsed);
        }
    }
    if (reports.length < 2) {
        throw new Error(`at least two provider reports are required; found ${String(reports.length)}`);
    }
    const baselineRaw = JSON.parse(await readFile(resolve(paths.reports, 'baseline--lexical-hash-v1--512.json'), 'utf8')) as {
        metrics: Metrics;
    };
    const ranked = reports
        .map((report) => ({ ...report, comparisonScore: score(report) }))
        .sort((left, right) => right.comparisonScore - left.comparisonScore || left.provider.localeCompare(right.provider));
    const comparison = {
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        note: 'The score is a consistent engineering aid, not an automatic publishing or provider decision. Manual neighbour review remains required.',
        weights: {
            pairAccuracy: 0.35,
            recallAt10: 0.25,
            meanReciprocalRank: 0.2,
            recallAt5: 0.1,
            neighborhoodBookDiversityAt10: 0.1,
        },
        lexicalBaseline: baselineRaw.metrics,
        providers: ranked,
    };
    const output = resolve(paths.evaluation, 'comparison.json');
    await writeFile(output, `${JSON.stringify(comparison, null, 2)}\n`, 'utf8');
    for (const report of ranked) {
        console.log(
            `${report.provider}/${report.model}/${String(report.dimensions)}: score ${report.comparisonScore.toFixed(4)}, MRR ${report.metrics.meanReciprocalRank.toFixed(4)}, R@10 ${report.metrics.recallAt10.toFixed(4)}, pair ${report.metrics.pairAccuracy.toFixed(4)}`,
        );
    }
    console.log(`private comparison: ${output}`);
}

await main();
