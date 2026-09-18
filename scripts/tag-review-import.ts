import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { validateTopicTagVocabulary } from '../src/domain/topicTags.ts';

type ImportedReviewNote = {
    highlightId: string;
    tier: string;
    bookTitle: string;
    rawDecision: string;
    matchedTagIds: string[];
    unmatchedTerms: string[];
};

type ReviewQueueImport = {
    schemaVersion: 1;
    importedAt: string;
    sourcePath: string;
    sourceHash: string;
    entries: ImportedReviewNote[];
};

function sha256(value: string): string {
    return createHash('sha256').update(value, 'utf8').digest('hex');
}

function cleanBlankAnswer(value: string): string {
    return value.replace(/_/gu, '').trim();
}

export function parseReviewQueueNotes(markdown: string, titleToId: ReadonlyMap<string, string>): ImportedReviewNote[] {
    const entries: ImportedReviewNote[] = [];
    let current: { tier: string; highlightId: string; bookTitle: string } | undefined;
    for (const line of markdown.split(/\r?\n/gu)) {
        const heading = line.match(/^###\s+([A-E]\d+)\s+·\s+(h-\d+)\s+·\s+《(.+)》$/u);
        if (heading !== null) {
            const [, tier, highlightId, bookTitle] = heading;
            if (tier !== undefined && highlightId !== undefined && bookTitle !== undefined) {
                current = { tier, highlightId, bookTitle };
            }
            continue;
        }
        if (current === undefined || !line.startsWith('- 你的决定：')) {
            continue;
        }
        const changed = line.match(/改成\s*(_+)([^☐]+?)\1\s*☐/u);
        if (changed === null) {
            continue;
        }
        const rawDecision = cleanBlankAnswer(changed[2] ?? '');
        if (rawDecision.length === 0) {
            continue;
        }
        const terms = rawDecision
            .split(/[/、，,＋+]/u)
            .map((term) => term.trim())
            .filter((term) => term.length > 0);
        const matchedTagIds = [...new Set(terms.map((term) => titleToId.get(term)).filter((tagId): tagId is string => tagId !== undefined))];
        const unmatchedTerms = [...new Set(terms.filter((term) => !titleToId.has(term)))];
        entries.push({ ...current, rawDecision, matchedTagIds, unmatchedTerms });
    }
    return entries;
}

async function writeAtomic(path: string, value: unknown): Promise<void> {
    await mkdir(dirname(path), { recursive: true });
    const temporary = `${path}.tmp-${String(process.pid)}`;
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    await rename(temporary, path);
}

async function main(): Promise<void> {
    const tagsRoot = resolve(process.cwd(), '.private', 'tags');
    const queuePath = resolve(tagsRoot, 'review-queue.md');
    const vocabularyCheck = validateTopicTagVocabulary(JSON.parse(await readFile(resolve(tagsRoot, 'vocabulary.json'), 'utf8')) as unknown);
    if (!vocabularyCheck.ok) {
        throw new Error(`vocabulary does not validate: ${vocabularyCheck.errors.join('; ')}`);
    }
    const markdown = await readFile(queuePath, 'utf8');
    const titleToId = new Map(vocabularyCheck.value.tags.map((tag) => [tag.title, tag.id]));
    const entries = parseReviewQueueNotes(markdown, titleToId);
    const output: ReviewQueueImport = {
        schemaVersion: 1,
        importedAt: new Date().toISOString(),
        sourcePath: '.private/tags/review-queue.md',
        sourceHash: sha256(markdown),
        entries,
    };
    const outputPath = resolve(tagsRoot, 'user-review-notes.json');
    await writeAtomic(outputPath, output);
    console.log(`imported user review notes: ${String(entries.length)}`);
    console.log(`matched approved vocabulary only: ${String(entries.filter((entry) => entry.unmatchedTerms.length === 0).length)}`);
    console.log(`notes proposing new or aliased concepts: ${String(entries.filter((entry) => entry.unmatchedTerms.length > 0).length)}`);
    console.log(`private output: ${outputPath}`);
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    await main();
}
