import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

/** Public-release isolation gate: approved content may ship, private production metadata may not. */
function walk(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) walk(full, out);
        else out.push(full);
    }
    return out;
}

const files = walk('dist');
const hay = files.map((file) => readFileSync(file, 'utf8')).join('\n');
const snapshot = JSON.parse(readFileSync('src/data/public-snapshot.json', 'utf8')) as {
    visibility: string;
    books: { id: string; coverPath?: string }[];
    highlights: { id: string; bookId: string; tagIds: string[]; pathVector?: number[] }[];
    tags: { id: string }[];
    map?: { points: { highlightId: string }[]; labels: { tagId: string }[] };
};
const policy = JSON.parse(readFileSync('.private/curation/publication-policy.json', 'utf8')) as {
    books: Record<string, { decision: string; cover: string; excludedHighlightIds: string[] }>;
};

let bad = 0;
function check(label: string, condition: boolean): void {
    if (!condition) bad += 1;
    console.log(`${condition ? 'pass' : 'FAIL'}  ${label}`);
}

console.log('dist files:', files.map((file) => relative('.', file).replace(/\\/gu, '/')).join(', '));
check('public snapshot visibility', snapshot.visibility === 'public');
check('public snapshot is non-empty', snapshot.books.length > 0 && snapshot.highlights.length > 0);
check('all public books are policy-approved', snapshot.books.every((book) => policy.books[book.id]?.decision === 'publish'));
check('all public highlights belong to approved books', snapshot.highlights.every((highlight) => policy.books[highlight.bookId]?.decision === 'publish'));
check('excluded highlights are absent', snapshot.highlights.every((highlight) => !Object.values(policy.books).some((book) => book.excludedHighlightIds.includes(highlight.id))));
check('public snapshot has no local cover paths', snapshot.books.every((book) => book.coverPath === undefined || !book.coverPath.startsWith('local-covers/')));
check('public map covers every public highlight', snapshot.map?.points.length === snapshot.highlights.length);
check('public map labels are public tags', snapshot.map?.labels.every((label) => snapshot.tags.some((tag) => tag.id === label.tagId)) ?? false);
check('path vectors are only on tagged/reviewed projection', snapshot.highlights.every((highlight) => highlight.pathVector === undefined || highlight.tagIds.length > 0));

for (const needle of [
    'WEREAD_API_KEY', 'VOYAGE_API_KEY', 'COHERE_API_KEY', 'OPENAI_API_KEY', 'SILICONFLOW_API_KEY',
    'SiliconFlow_API_KEY', 'userVid', 'bookmarkId', '.private/embeddings', 'embedding evaluation labels',
    '.private/tags', 'candidate-vocabulary.json', 'candidate-seeds.json', 'curated-seeds.json',
    'candidate-query-vectors.json', 'vocabulary-manifest.json', 'share-cards', 'flomo-starmap',
    'flomo_178', 'weread_image',
    'publication-review', 'reviewComplete', 'excludedHighlightIds', '__publication_policy', 'tag-studio',
    '__tag_vocabulary', '__tag_assignments', 'studio-rationale', 'possible-missing-tag',
]) {
    check(`dist excludes ${needle}`, !hay.includes(needle));
}

const publicCoverFiles = readdirSync('public/covers', { withFileTypes: true }).filter((entry) => entry.isFile());
check('every referenced cover exists', snapshot.books.filter((book) => book.coverPath !== undefined).every((book) => publicCoverFiles.some((file) => `covers/${file.name}` === book.coverPath)));
check('no private cover files are in public covers', publicCoverFiles.every((file) => /^[-a-z0-9]+\.jpg$/u.test(file.name)));

console.log(`public content: ${String(snapshot.books.length)} books, ${String(snapshot.highlights.length)} highlights, ${String(snapshot.tags.length)} tags`);
console.log(`public map: ${String(snapshot.map?.points.length ?? 0)} points, ${String(snapshot.map?.labels.length ?? 0)} labels`);
console.log(`public covers: ${String(publicCoverFiles.length)}`);
console.log(bad === 0 ? 'isolation gate: clean' : `isolation gate: ${String(bad)} problem(s)`);
process.exitCode = bad === 0 ? 0 : 1;
