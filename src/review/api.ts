/**
 * Talking to the local review server (docs/17 §5.4).
 *
 * Three fixed routes and nothing else. Reads fail loudly when the server is not in review mode, so the
 * screen says so instead of showing an empty list that looks like "nothing to review".
 */
import type { PublicationPolicy } from '../domain/publication.ts';
import type { Snapshot } from '../domain/types.ts';

export class ReviewApiError extends Error {}

export async function loadSnapshot(): Promise<Snapshot> {
    const response = await fetch('/__local_snapshot', { cache: 'no-store' });
    if (!response.ok) {
        throw new ReviewApiError(
            `读不到本机快照（HTTP ${String(response.status)}）。请用 npm run publication:review 启动审核器。`,
        );
    }
    return (await response.json()) as Snapshot;
}

export async function loadPolicy(): Promise<PublicationPolicy | null> {
    const response = await fetch('/__publication_policy', { cache: 'no-store' });
    if (response.status === 404) {
        return null;
    }
    if (!response.ok) {
        throw new ReviewApiError(`读不到发布清单（HTTP ${String(response.status)}）。`);
    }
    const body = (await response.json()) as { policy: PublicationPolicy | null };
    return body.policy;
}

export type SaveResult = { ok: true } | { ok: false; errors: string[] };

export async function savePolicy(policy: PublicationPolicy): Promise<SaveResult> {
    const response = await fetch('/__publication_policy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(policy),
    });
    if (response.status === 200) {
        return { ok: true };
    }
    if (response.status === 422) {
        const body = (await response.json()) as { errors?: string[] };
        return { ok: false, errors: body.errors ?? ['清单未通过校验。'] };
    }
    return { ok: false, errors: [`保存失败（HTTP ${String(response.status)}）。`] };
}
