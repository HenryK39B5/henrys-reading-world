import { useMemo } from 'react';
import { describeDeadEnd } from '../domain/encounter.ts';
import { indexSnapshot } from '../domain/snapshot.ts';
import type { Snapshot } from '../domain/types.ts';
import { EncounterStage } from '../features/encounter/EncounterStage.tsx';
import { useEncounter } from '../features/encounter/useEncounter.ts';
import { Nav } from './Nav.tsx';
import { DATA_MODE } from './snapshotSource.ts';
import './page.css';

export type ReadingWorldPageProps = {
    snapshot: Snapshot;
    warnings: string[];
};

/** The real page: brand, light navigation and the passage stage. */
export function ReadingWorldPage({ snapshot, warnings }: ReadingWorldPageProps) {
    const index = useMemo(() => indexSnapshot(snapshot), [snapshot]);
    const nowYear = useMemo(() => new Date().getFullYear(), []);
    const encounter = useEncounter(index.snapshot.highlights, nowYear);

    const current = encounter.state.currentId === null ? undefined : index.highlightsById.get(encounter.state.currentId);
    const book = current === undefined ? undefined : index.booksById.get(current.bookId);

    return (
        <div className="shell">
            <header className="site-header">
                <h1 className="brand">Henry's Reading World</h1>
                <Nav />
            </header>

            {DATA_MODE === 'local' ? <p className="local-badge">仅本机 · 未公开审核</p> : null}

            <main id="random" className="stage-region">
                {current === undefined || book === undefined ? (
                    <p className="muted">这条划线暂不可用。</p>
                ) : (
                    <EncounterStage
                        highlight={current}
                        book={book}
                        phase={encounter.state.phase}
                        busy={encounter.busy}
                        nowYear={nowYear}
                        commitCount={encounter.state.commitCount}
                        deadEnd={describeDeadEnd(encounter.state)}
                        onNext={encounter.next}
                    />
                )}
            </main>

            {DATA_MODE === 'local' && warnings.length > 0 ? (
                <details className="coverage-notes">
                    <summary>数据覆盖提示（{warnings.length}）</summary>
                    <ul className="detail-list">
                        {warnings.map((warning) => (
                            <li key={warning}>{warning}</li>
                        ))}
                    </ul>
                </details>
            ) : null}
        </div>
    );
}
