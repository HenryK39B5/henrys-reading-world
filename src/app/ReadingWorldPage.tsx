import { useCallback, useMemo, useRef, useState } from 'react';
import { describeDeadEnd, unseenInBookCount } from '../domain/encounter.ts';
import { indexSnapshot } from '../domain/snapshot.ts';
import type { Snapshot } from '../domain/types.ts';
import { totalCountText, yearSpanText } from '../domain/world.ts';
import { EncounterStage } from '../features/encounter/EncounterStage.tsx';
import { useEncounter } from '../features/encounter/useEncounter.ts';
import { World } from '../features/world/World.tsx';
import { Nav } from './Nav.tsx';
import { DATA_MODE } from './snapshotSource.ts';
import './page.css';

export type ReadingWorldPageProps = {
    snapshot: Snapshot;
    warnings: string[];
};

/** The real page: stage, in-place source, then books, topics and about. */
export function ReadingWorldPage({ snapshot, warnings }: ReadingWorldPageProps) {
    const index = useMemo(() => indexSnapshot(snapshot), [snapshot]);
    const nowYear = useMemo(() => new Date().getFullYear(), []);
    const encounter = useEncounter(index.snapshot.highlights, index.snapshot.books);
    const stageRef = useRef<HTMLElement>(null);
    const [yearFilter, setYearFilter] = useState<number | null>(null);
    const [openBookId, setOpenBookId] = useState<string | null>(null);

    const current = encounter.state.currentId === null ? undefined : index.highlightsById.get(encounter.state.currentId);
    const book = current === undefined ? undefined : index.booksById.get(current.bookId);
    const bookHighlightCount = current === undefined ? 0 : (index.highlightsByBook.get(current.bookId)?.length ?? 0);
    // Counted for the current visit to this book, which is exactly what "再看一处" can offer next.
    const bookUnseenCount = unseenInBookCount(encounter.state, index.snapshot.highlights);

    /**
     * Passages chosen in the list views replace the stage above, so the page has to bring the visitor
     * back to it: scroll the stage into view and move focus there, or a keyboard user would be left
     * reading a list while the content they asked for changed out of sight.
     */
    const openInStage = useCallback(
        (id: string) => {
            encounter.open(id);
            const node = stageRef.current;
            if (node !== null) {
                node.scrollIntoView({ block: 'start' });
                node.focus();
            }
        },
        [encounter],
    );

    const openBookSection = useCallback((bookId: string) => {
        setOpenBookId(bookId);
        const target = document.getElementById('books');
        target?.scrollIntoView({ block: 'start' });
    }, []);

    return (
        <div className="shell">
            <header className="site-header">
                <h1 className="brand">Henry's Reading World</h1>
                <Nav />
            </header>

            {DATA_MODE === 'local' ? <p className="local-badge">仅本机 · 未公开审核</p> : null}

            <main id="random" className="stage-region" ref={stageRef} tabIndex={-1}>
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
                        sourceOpen={encounter.state.sourceOpen}
                        bookHighlightCount={bookHighlightCount}
                        bookUnseenCount={bookUnseenCount}
                        deadEnd={describeDeadEnd(encounter.state)}
                        onNext={encounter.next}
                        onNextInBook={encounter.nextInBook}
                        onOpenSource={encounter.openSource}
                        onCloseSource={encounter.closeSource}
                        onOpenBook={openBookSection}
                    />
                )}
            </main>

            <World
                index={index}
                nowYear={nowYear}
                yearFilter={yearFilter}
                onYearFilterChange={setYearFilter}
                openBookId={openBookId}
                onOpenBook={setOpenBookId}
                onOpenHighlight={openInStage}
            />

            <section id="about" className="world-section about-section" aria-labelledby="about-heading">
                <h2 id="about-heading" className="section-heading">
                    关于
                </h2>
                <p className="about-line" data-testid="about-line">
                    {totalCountText(index)}
                    {yearSpanText(index) === null ? '' : `，集中在 ${yearSpanText(index) ?? ''}`}。
                </p>
                <p className="about-note">
                    这里只呈现 Henry 自己留下的划线与出处。时间标签是模糊的，页面不统计时长、不做排行榜，也不评价阅读者。
                </p>
            </section>

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
