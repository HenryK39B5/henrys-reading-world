import { lengthBand } from '../../domain/length.ts';
import type { Phase } from '../../domain/encounter.ts';
import { relativeYearLabel } from '../../domain/timeLabel.ts';
import type { Book, Highlight } from '../../domain/types.ts';
import './stage.css';

export type EncounterStageProps = {
    highlight: Highlight;
    book: Book | undefined;
    phase: Phase;
    busy: boolean;
    nowYear: number;
    /** Committed changes this session; a plain diagnostic counter, also asserted in the browser tests. */
    commitCount: number;
    /** Why the visitor cannot move on, when that is the case. */
    deadEnd: string | null;
    onNext: () => void;
};

/**
 * The passage stage: the sentence is the only visual centre (PRODUCT_BRIEF P1).
 * Source reveal (Slice 3) and share (Slice 5) are deliberately absent here.
 */
export function EncounterStage({ highlight, book, phase, busy, nowYear, commitCount, deadEnd, onNext }: EncounterStageProps) {
    const band = lengthBand(highlight.text);
    const timeLabel = relativeYearLabel(highlight.year, nowYear);

    return (
        <section
            className="stage"
            data-band={band}
            data-phase={phase}
            data-commit-count={commitCount}
            aria-labelledby="stage-heading"
        >
            <h2 id="stage-heading" className="sr-only">
                当前划线
            </h2>

            {/* One live region for the whole change: the passage and its source are announced together. */}
            <div className="stage-live" aria-live="polite" aria-atomic="true">
                <blockquote className="stage-passage">
                    <p className="stage-text" data-testid="stage-passage">
                        {highlight.text}
                    </p>
                </blockquote>
                <p className="stage-attribution">
                    <span aria-hidden="true">——</span>
                    <cite className="stage-book">《{book?.title ?? '出处缺失'}》</cite>
                    <span className="stage-author">{book?.author ?? '作者信息暂缺'}</span>
                    {timeLabel === null ? null : <span className="stage-time">{timeLabel}</span>}
                </p>
            </div>

            <div className="stage-actions">
                <button
                    type="button"
                    className="next-button"
                    data-testid="next-quote"
                    aria-disabled={busy || deadEnd !== null}
                    onClick={onNext}
                >
                    <span className="next-label">再来一句</span>
                    <span aria-hidden="true" className="next-glyph">
                        ↻
                    </span>
                </button>
            </div>

            {deadEnd === null ? null : (
                <p className="stage-note" data-testid="stage-note">
                    {deadEnd}
                </p>
            )}
        </section>
    );
}
