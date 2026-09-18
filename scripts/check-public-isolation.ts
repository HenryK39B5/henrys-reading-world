import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

/** The Release-A isolation gate: what a public build may and may not contain (docs/18 §6.2). */
function walk(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
            walk(full, out);
        } else {
            out.push(full);
        }
    }
    return out;
}

const files = walk('dist');
const hay = files.map((file) => readFileSync(file, 'utf8')).join('\n');
const snapshot = JSON.parse(readFileSync('.private/local-snapshot.json', 'utf8')) as {
    books: { id: string; title: string; coverPath?: string }[];
    highlights: { text: string }[];
};
const policy = JSON.parse(readFileSync('.private/curation/publication-policy.json', 'utf8')) as {
    books: Record<string, unknown>;
};

console.log('dist files:', files.map((file) => relative('.', file).replace(/\\/gu, '/')).join(', '));

const mustBeAbsent: [string, string][] = [
    ['review entry', 'review-root'],
    ['review document name', 'publication-review'],
    ['review screen markup', 'review-books'],
    ['policy field reviewComplete', 'reviewComplete'],
    ['policy field excludedHighlightIds', 'excludedHighlightIds'],
    ['policy route', '__publication_policy'],
    ['policy file path', 'publication-policy'],
    ['preview/audit file names', 'publication-preview-snapshot'],
    ['review note placeholder', '不会进入网站'],
];
let bad = 0;
for (const [label, needle] of mustBeAbsent) {
    const present = hay.includes(needle);
    if (present) {
        bad += 1;
    }
    console.log(`${present ? 'PRESENT (must not be)' : 'absent'}  ${label}`);
}

const titles = snapshot.books.filter((book) => book.title.length > 3 && hay.includes(book.title)).length;
const passages = snapshot.highlights.filter((highlight) => hay.includes(highlight.text.trim())).length;
const covers = snapshot.books.filter((book) => book.coverPath !== undefined && hay.includes(book.coverPath)).length;
console.log(`real book titles: ${String(titles)} | real passages: ${String(passages)} | cover paths: ${String(covers)}`);
if (titles + passages + covers > 0) {
    bad += 1;
}

for (const needle of [
    'WEREAD_API_KEY',
    'VOYAGE_API_KEY',
    'COHERE_API_KEY',
    'OPENAI_API_KEY',
    'SILICONFLOW_API_KEY',
    'SiliconFlow_API_KEY',
    'userVid',
    'bookmarkId',
    '.private/embeddings',
    'embedding evaluation labels',
    '.private/tags',
    'candidate-vocabulary.json',
    'candidate-seeds.json',
    'curated-seeds.json',
    'candidate-query-vectors.json',
    'share-cards',
    'flomo',
    'weread_image',
]) {
    const present = hay.includes(needle);
    if (present) {
        bad += 1;
    }
    console.log(`${present ? 'PRESENT (must not be)' : 'absent'}  credential/reference probe ${needle}`);
}

// These are code branches the client genuinely has (the local data mode), not data.
console.log(`note: __local_snapshot present as a code path: ${String(hay.includes('__local_snapshot'))}`);
console.log(`note: policy entries in the file: ${String(Object.keys(policy.books).length)}`);
console.log(bad === 0 ? 'isolation gate: clean' : `isolation gate: ${String(bad)} problem(s)`);
process.exitCode = bad === 0 ? 0 : 1;
