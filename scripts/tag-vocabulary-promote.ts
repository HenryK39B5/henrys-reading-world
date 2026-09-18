import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { sha256 } from './embeddings/core.ts';
import { validateTopicTagVocabulary, type TopicTagVocabulary } from '../src/domain/topicTags.ts';

async function writeAtomic(path: string, value: unknown): Promise<void> {
    await mkdir(dirname(path), { recursive: true });
    const temporary = `${path}.tmp-${String(process.pid)}`;
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    await rename(temporary, path);
}

async function main(): Promise<void> {
    const root = resolve(process.cwd(), '.private', 'tags');
    const candidate = JSON.parse(await readFile(resolve(root, 'candidate-vocabulary.json'), 'utf8')) as {
        schemaVersion: number;
        families: Array<{ id: string; title: string }>;
        tags: Array<{
            id: string;
            title: string;
            definition: string;
            includes: string[];
            excludes: string[];
            aliases: string[];
            familyId?: string;
        }>;
    };
    if (candidate.schemaVersion !== 1 || candidate.tags.length !== 53 || candidate.families.length !== 6) {
        throw new Error('approved Batch 2 candidate vocabulary is missing or has changed');
    }
    const familyIds = new Map(candidate.families.map((family, index) => [family.id, `family-${String(index + 1).padStart(2, '0')}`]));
    const tagIds = new Map(candidate.tags.map((tag, index) => [tag.id, `tag-${String(index + 1).padStart(3, '0')}`]));
    const vocabulary: TopicTagVocabulary = {
        schemaVersion: 1,
        approvedAt: '2026-09-18',
        families: candidate.families.map((family, index) => ({
            id: familyIds.get(family.id) ?? '',
            title: family.title,
            editorialOrder: index + 1,
        })),
        tags: candidate.tags.map((tag, index) => ({
            id: tagIds.get(tag.id) ?? '',
            title: tag.title,
            definition: tag.definition,
            includes: tag.includes,
            excludes: tag.excludes,
            aliases: tag.aliases,
            ...(tag.familyId === undefined ? {} : { familyId: familyIds.get(tag.familyId) ?? '' }),
            editorialOrder: index + 1,
            status: 'reviewed',
            note: `Batch 2 candidate ${tag.id}; user approved the complete vocabulary for Batch 3 trial on 2026-09-18.`,
        })),
    };
    const checked = validateTopicTagVocabulary(vocabulary);
    if (!checked.ok) {
        throw new Error(`promoted vocabulary does not validate: ${checked.errors.join('; ')}`);
    }
    const normalized = checked.value;
    const vocabularyHash = sha256(JSON.stringify(normalized));
    await writeAtomic(resolve(root, 'vocabulary.json'), normalized);
    await writeAtomic(resolve(root, 'vocabulary-manifest.json'), {
        schemaVersion: 1,
        approvedAt: normalized.approvedAt,
        vocabularyHash,
        tags: normalized.tags.length,
        families: normalized.families.length,
        source: 'candidate-vocabulary.json',
        userGate: 'approved-complete-vocabulary-for-batch-3-trial',
    });
    await writeAtomic(resolve(root, 'id-migration.json'), {
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        families: Object.fromEntries(familyIds),
        tags: Object.fromEntries(tagIds),
    });
    console.log(`promoted vocabulary: ${String(normalized.tags.length)} stable tags / ${String(normalized.families.length)} private families`);
    console.log(`vocabulary hash: ${vocabularyHash}`);
}

await main();
