import type { Snapshot } from '../domain/types.ts';
import { validateSnapshot } from '../domain/validate.ts';
import publicSnapshot from '../data/public-snapshot.json';

export type DataMode = 'public' | 'local';

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

export async function loadSnapshot(mode: DataMode, fetcher?: FetchLike): Promise<SnapshotLoad> {
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
            raw = publicSnapshot;
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
