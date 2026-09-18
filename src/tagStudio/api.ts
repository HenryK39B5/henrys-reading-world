/**
 * Talking to the local tag-studio server.
 *
 * Three reads and one write, all on fixed routes. The write only exists in `tags:studio`; a plain `dev`
 * or a production build answers 404, so the browser product can never reach these files.
 */
import type { Snapshot } from '../domain/types.ts';
import type { TopicTagAssignments, TopicTagVocabulary } from '../domain/topicTags.ts';

export class TagStudioApiError extends Error {}

async function load<T>(path: string): Promise<T> {
    const response = await fetch(path, { cache: 'no-store' });
    if (!response.ok) {
        throw new TagStudioApiError(`读不到 ${path}（HTTP ${String(response.status)}）。请用 npm run tags:studio 启动 Studio。`);
    }
    return (await response.json()) as T;
}

export function loadStudioSnapshot(): Promise<Snapshot> {
    return load<Snapshot>('/__local_snapshot');
}

export function loadVocabulary(): Promise<TopicTagVocabulary> {
    return load<TopicTagVocabulary>('/__tag_vocabulary');
}

export function loadAssignments(): Promise<TopicTagAssignments> {
    return load<TopicTagAssignments>('/__tag_assignments');
}

/** Returns the validation errors, or an empty array when the file was written. */
export async function saveAssignments(assignments: TopicTagAssignments): Promise<string[]> {
    const response = await fetch('/__tag_assignments', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(assignments),
    });
    if (response.ok) {
        return [];
    }
    if (response.status === 422) {
        const body = (await response.json()) as { errors?: string[] };
        return body.errors ?? ['试标未通过校验。'];
    }
    return [`保存失败（HTTP ${String(response.status)}）。`];
}
