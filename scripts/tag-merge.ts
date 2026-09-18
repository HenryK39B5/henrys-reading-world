import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { validateSnapshot } from '../src/domain/validate.ts';
import {
    migrateMergedTag,
    validateTopicTagAssignments,
    validateTopicTagVocabulary,
} from '../src/domain/topicTags.ts';
import { LOCAL_SNAPSHOT_PATH } from './embeddings/privatePaths.ts';

/**
 * Merge two private topic tags, or rename one (docs/22 §6.2).
 *
 * Merging is the only operation that could silently corrupt the trial: every assignment that used the
 * source tag has to move to the target, and an assignment that already used both must not end up with a
 * duplicate. `migrateMergedTag` does that, then the whole result is re-validated against the real snapshot
 * before either file is replaced. Renaming keeps the stable tag ID and only changes the label a person
 * reads, so it cannot change any assignment.
 *
 * Usage:
 *   npm run tags:migrate -- --merge tag-031 --into tag-030 --yes
 *   npm run tags:migrate -- --rename tag-004 --title 运气与偶然 --yes
 *
 * Both files are only replaced after the merged result validates, and each is written through a rename, so
 * a failure cannot leave the vocabulary and the assignments disagreeing.
 */
type Args = { kind: 'merge'; source: string; target: string } | { kind: 'rename'; tagId: string; title: string };

async function writeAtomic(path: string, value: unknown): Promise<void> {
    await mkdir(dirname(path), { recursive: true });
    const temporary = `${path}.tmp-${String(process.pid)}`;
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    await rename(temporary, path);
}

function readArgs(argv: string[]): Args {
    const values = new Map<string, string>();
    for (let index = 0; index < argv.length; index += 1) {
        const key = argv[index];
        if (key === '--yes') {
            values.set('yes', 'true');
            continue;
        }
        if (key === undefined || !key.startsWith('--')) {
            throw new Error(`unexpected argument ${key ?? ''}`);
        }
        const value = argv[index + 1];
        if (value === undefined || value.startsWith('--')) {
            throw new Error(`missing value for ${key}`);
        }
        values.set(key.slice(2), value);
        index += 1;
    }
    if (values.get('yes') !== 'true') {
        throw new Error('this rewrites the private vocabulary and assignments; pass --yes to confirm');
    }
    const merge = values.get('merge');
    const rename = values.get('rename');
    if (merge !== undefined && rename !== undefined) {
        throw new Error('use either --merge or --rename');
    }
    if (merge !== undefined) {
        const target = values.get('into');
        if (target === undefined) {
            throw new Error('--merge requires --into');
        }
        return { kind: 'merge', source: merge, target };
    }
    if (rename !== undefined) {
        return { kind: 'rename', tagId: rename, title: values.get('title') ?? '' };
    }
    throw new Error('nothing to do: pass --merge ... --into ... or --rename ... --title ...');
}

async function main(): Promise<void> {
    const args = readArgs(process.argv.slice(2));
    const root = resolve(process.cwd(), '.private', 'tags');
    const vocabularyPath = resolve(root, 'vocabulary.json');
    const assignmentsPath = resolve(root, 'assignments.json');

    const snapshotCheck = validateSnapshot(JSON.parse(await readFile(LOCAL_SNAPSHOT_PATH, 'utf8')) as unknown, {
        expectedVisibility: 'local-only',
    });
    if (!snapshotCheck.ok) {
        throw new Error(`local snapshot does not validate: ${snapshotCheck.errors.join('; ')}`);
    }
    const vocabularyCheck = validateTopicTagVocabulary(JSON.parse(await readFile(vocabularyPath, 'utf8')) as unknown);
    if (!vocabularyCheck.ok) {
        throw new Error(`vocabulary does not validate: ${vocabularyCheck.errors.join('; ')}`);
    }
    const assignmentsCheck = validateTopicTagAssignments(
        JSON.parse(await readFile(assignmentsPath, 'utf8')) as unknown,
        snapshotCheck.snapshot,
        vocabularyCheck.value,
    );
    if (!assignmentsCheck.ok) {
        throw new Error(`assignments do not validate: ${assignmentsCheck.errors.join('; ')}`);
    }

    if (args.kind === 'rename') {
        const before = vocabularyCheck.value.tags.find((tag) => tag.id === args.tagId);
        if (before === undefined) {
            throw new Error(`unknown tag ${args.tagId}`);
        }
        if ([...args.title].length < 2 || [...args.title].length > 4) {
            throw new Error('a public tag title stays between 2 and 4 characters');
        }
        const renamed = {
            ...vocabularyCheck.value,
            tags: vocabularyCheck.value.tags.map((tag) => (tag.id === args.tagId ? { ...tag, title: args.title } : tag)),
        };
        const checked = validateTopicTagVocabulary(renamed);
        if (!checked.ok) {
            throw new Error(`renamed vocabulary does not validate: ${checked.errors.join('; ')}`);
        }
        await writeAtomic(vocabularyPath, checked.value);
        console.log(`renamed ${args.tagId}: ${before.title} -> ${args.title}`);
        console.log('stable tag ID, editorial order and every assignment are unchanged.');
        return;
    }

    const merged = migrateMergedTag(vocabularyCheck.value, assignmentsCheck.value, args.source, args.target);
    const checkedVocabulary = validateTopicTagVocabulary(merged.vocabulary);
    if (!checkedVocabulary.ok) {
        throw new Error(`merged vocabulary does not validate: ${checkedVocabulary.errors.join('; ')}`);
    }
    const checkedAssignments = validateTopicTagAssignments(merged.assignments, snapshotCheck.snapshot, checkedVocabulary.value);
    if (!checkedAssignments.ok) {
        throw new Error(`merged assignments do not validate: ${checkedAssignments.errors.join('; ')}`);
    }
    const affected = assignmentsCheck.value.assignments.filter((assignment) => assignment.tagIds.includes(args.source)).length;
    await writeAtomic(vocabularyPath, checkedVocabulary.value);
    await writeAtomic(assignmentsPath, checkedAssignments.value);
    console.log(`merged ${args.source} into ${args.target}; affected ${String(affected)} assignments`);
    console.log(`vocabulary now holds ${String(checkedVocabulary.value.tags.length)} tags`);
}

await main();
