import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { Snapshot } from '../src/domain/types.ts';
import { validateTopicTagVocabulary } from '../src/domain/topicTags.ts';
import { scoreTagPassagePairs, TAG_RERANKER_MODEL } from './embeddings/tagReranker.ts';

type Suggestion = {
    highlightId: string;
    candidates: Array<{ tagId: string }>;
};

type SuggestionBatch = { suggestions: Suggestion[] };
type RankedScore = { tagId: string; score: number };
type ScoreCache = Record<string, RankedScore[]>;

function tagQuery(tag: { title: string; definition: string; includes: string[]; aliases: string[] }): string {
    const aliases = tag.aliases.length === 0 ? '' : `；也常写作：${tag.aliases.join('、')}`;
    return `主题“${tag.title}”：${tag.definition} 典型内容包括：${tag.includes.join('、')}${aliases}。`;
}

async function writeAtomic(path: string, value: unknown): Promise<void> {
    await mkdir(dirname(path), { recursive: true });
    const temporary = `${path}.tmp`;
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    await rename(temporary, path);
}

async function main(): Promise<void> {
    const root = resolve(process.cwd(), '.private');
    const batchRoot = resolve(root, 'tags', 'batch6');
    const snapshot = JSON.parse(await readFile(resolve(root, 'local-snapshot.json'), 'utf8')) as Snapshot;
    const vocabularyCheck = validateTopicTagVocabulary(JSON.parse(await readFile(resolve(root, 'tags', 'vocabulary.json'), 'utf8')) as unknown);
    if (!vocabularyCheck.ok) throw new Error(vocabularyCheck.errors.join('; '));
    const tagById = new Map(vocabularyCheck.value.tags.map((tag) => [tag.id, tag]));
    const highlightById = new Map(snapshot.highlights.map((highlight) => [highlight.id, highlight]));
    const suggestionFiles = (await readdir(resolve(batchRoot, 'suggestions')))
        .filter((name) => /^batch-\d+\.json$/u.test(name))
        .sort();
    const suggestions: Suggestion[] = [];
    for (const name of suggestionFiles) {
        const batch = JSON.parse(await readFile(resolve(batchRoot, 'suggestions', name), 'utf8')) as SuggestionBatch;
        suggestions.push(...batch.suggestions);
    }
    const cachePath = resolve(batchRoot, 'reranker-scores.json');
    let scores: ScoreCache = {};
    try {
        const parsed = JSON.parse(await readFile(cachePath, 'utf8')) as { model?: string; scores?: ScoreCache };
        if (parsed.model === TAG_RERANKER_MODEL && parsed.scores !== undefined) scores = parsed.scores;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    const pending = suggestions.filter((suggestion) => scores[suggestion.highlightId]?.length !== suggestion.candidates.length);
    let completed = suggestions.length - pending.length;
    for (let offset = 0; offset < pending.length; offset += 3) {
        const group = pending.slice(offset, offset + 3);
        const definitions: string[] = [];
        const passages: string[] = [];
        for (const suggestion of group) {
            const highlight = highlightById.get(suggestion.highlightId);
            if (highlight === undefined) throw new Error(`missing highlight ${suggestion.highlightId}`);
            for (const candidate of suggestion.candidates) {
                const tag = tagById.get(candidate.tagId);
                if (tag === undefined) throw new Error(`missing tag ${candidate.tagId}`);
                definitions.push(tagQuery(tag));
                passages.push(highlight.text);
            }
        }
        const groupScores = await scoreTagPassagePairs(definitions, passages);
        let cursor = 0;
        for (const suggestion of group) {
            scores[suggestion.highlightId] = suggestion.candidates.map((candidate) => ({
                tagId: candidate.tagId,
                score: groupScores[cursor++] ?? Number.NEGATIVE_INFINITY,
            }));
            completed += 1;
        }
        if (completed % 30 < group.length || completed === suggestions.length) {
            await writeAtomic(cachePath, {
                generatedAt: new Date().toISOString(),
                model: TAG_RERANKER_MODEL,
                candidateCount: 10,
                scores,
            });
            console.log(`reranked ${String(completed)} / ${String(suggestions.length)}`);
        }
    }
    await writeAtomic(cachePath, {
        generatedAt: new Date().toISOString(),
        model: TAG_RERANKER_MODEL,
        candidateCount: 10,
        scores,
    });
    console.log(`Batch 6 reranker complete: ${String(suggestions.length)} highlights with local-only scores`);
}

await main();
