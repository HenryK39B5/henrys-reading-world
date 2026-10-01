import type { Snapshot } from '../domain/types.ts';
import { validateSnapshot } from '../domain/validate.ts';
// A fingerprinted static asset keeps the large approved collection out of the app's JavaScript chunk.
import publicSnapshotUrl from '../data/public-snapshot.json?url';

export type DataMode = 'public' | 'local';

export type PublicSnapshotRequest = Promise<{ ok: boolean; status: number; raw: unknown } | null>;
declare global {
    interface Window {
        /** HTML starts an approved public asset only; the app still validates it below. */
        __READING_WORLD_PUBLIC_SNAPSHOT__?: PublicSnapshotRequest;
    }
}

/** `dev:local` is the only mode that may read the private development snapshot. */
export const DATA_MODE: DataMode = __LOCAL_MODE__ ? 'local' : 'public';

export type SnapshotLoad =
    | { status: 'ready'; snapshot: Snapshot; warnings: string[] }
    | { status: 'empty'; snapshot: Snapshot; warnings: string[] }
    | { status: 'error'; errors: string[] };

type FetchLike = (input: string, init?: { cache?: RequestCache }) => Promise<{
    ok: boolean;
    status: number;
    json: () => Promise<unknown>;
}>;

export async function loadSnapshot(mode: DataMode, fetcher?: FetchLike,
    earlyPublicRequest?: PublicSnapshotRequest): Promise<SnapshotLoad> {
    const expectedVisibility = mode === 'local' ? 'local-only' : 'public';
    let raw: unknown;

    try {
        if (mode === 'local') {
            const doFetch = fetcher ?? (globalThis.fetch as unknown as FetchLike);
            const response = await doFetch('/__local_snapshot', { cache: 'no-store' });
            if (!response.ok) {
                return {
                    status: 'error',
                    errors: [
                        `本地快照不可用（HTTP ${String(response.status)}）。先运行 npm run snapshot:local，并使用 npm run dev:local。`,
                    ],
                };
            }
            raw = await response.json();
        } else {
            const earlyRequest = earlyPublicRequest ?? (fetcher === undefined && typeof window !== 'undefined'
                ? window.__READING_WORLD_PUBLIC_SNAPSHOT__ : undefined);
            if (earlyRequest !== undefined) {
                // Parsed once: React StrictMode may consume this shared result more than once.
                const response = await earlyRequest;
                if (response === null) return { status: 'error', errors: ['读取数据快照失败。'] };
                if (!response.ok) return { status: 'error', errors: [`公开数据暂时不可用（HTTP ${String(response.status)}）。`] };
                raw = response.raw;
            } else {
                // Tests / HTML without bootstrap retain the same explicit loading/error behavior.
                const doFetch = fetcher ?? (globalThis.fetch as unknown as FetchLike);
                const response = await doFetch(publicSnapshotUrl);
                if (!response.ok) {
                    return { status: 'error', errors: [`公开数据暂时不可用（HTTP ${String(response.status)}）。`] };
                }
                raw = await response.json();
            }
        }
    } catch {
        return { status: 'error', errors: ['读取数据快照失败。'] };
    }

    const result = validateSnapshot(raw, { expectedVisibility });
    if (!result.ok) {
        return { status: 'error', errors: result.errors };
    }
    if (result.snapshot.highlights.length === 0) {
        return { status: 'empty', snapshot: result.snapshot, warnings: result.warnings };
    }
    return { status: 'ready', snapshot: result.snapshot, warnings: result.warnings };
}
