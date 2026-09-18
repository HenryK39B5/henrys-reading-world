import { resolve } from 'node:path';

const PROJECT_ROOT = process.cwd();

export function embeddingPrivatePaths(): {
    root: string;
    evaluation: string;
    corpus: string;
    labels: string;
    reports: string;
    cache: string;
    manifest: string;
} {
    const root = resolve(process.env.READING_WORLD_EMBEDDING_DIR ?? resolve(PROJECT_ROOT, '.private', 'embeddings'));
    const evaluation = resolve(root, 'evaluation');
    return {
        root,
        evaluation,
        corpus: resolve(evaluation, 'corpus.json'),
        labels: resolve(evaluation, 'labels.json'),
        reports: resolve(evaluation, 'reports'),
        cache: resolve(root, 'vectors'),
        manifest: resolve(root, 'manifest.json'),
    };
}

export const LOCAL_SNAPSHOT_PATH = resolve(PROJECT_ROOT, '.private', 'local-snapshot.json');
