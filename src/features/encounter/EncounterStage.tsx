import { useRef } from 'react';
import type { CSSProperties } from 'react';
import { CoverImage } from '../../app/CoverImage.tsx';
import { coverUrl, useCoverAccent } from '../../app/covers.ts';
import type { Phase } from '../../domain/encounter.ts';
import { lengthBand } from '../../domain/length.ts';
import { describeBookCollection, relativeYearLabel } from '../../domain/timeLabel.ts';
import type { Book, Highlight, TopicTag } from '../../domain/types.ts';
import { TopicClues } from '../paths/TopicClues.tsx';
import './stage.css';

export const SOURCE_PANEL_ID = 'source-panel';

export type EncounterStageProps = {
    highlight: Highlight;
    book: Book | undefined;
    tags: TopicTag[];
    phase: Phase;
    busy: boolean;
    nowYear: number;
    /** Committed changes this session; a plain diagnostic counter, also asserted in the browser tests. */
    commitCount: number;
    /** Whether the in-place source panel is expanded. */
    sourceOpen: boolean;
    /** How many passages of this book the snapshot holds. */
    bookHighlightCount: number;
    /** How many of them the visitor has not seen yet in this session. */
    bookUnseenCount: number;
    /** Why the visitor cannot move on, when that is the case. */
    deadEnd: string | null;
    /** Opens the book section for this book (Slice 4); absent when the section cannot be reached. */
    onOpenBook?: (bookId: string) => void;
    /** Opens the share dialog for this passage (V2-E); absent when sharing is not available here. */
    onShare?: (highlightId: string) => void;
    onNext: () => void;
    onNextInBook: () => void;
    onOpenSource: () => void;
    onCloseSource: () => void;
};

/**
 * The passage stage: the sentence is the only visual centre (PRODUCT_BRIEF P1).
 *
 * The source is revealed in place rather than on another page, and every control here either does
 * something real or is visibly unavailable. Share (Slice 5) and the book section (Slice 4) are not
 * rendered yet.
 */
export function EncounterStage({
    highlight,
    book,
    tags,
    phase,
    busy,
    nowYear,
    commitCount,
    sourceOpen,
    bookHighlightCount,
    bookUnseenCount,
    deadEnd,
    onNext,
    onNextInBook,
    onOpenSource,
    onCloseSource,
    onOpenBook,
    onShare,
}: EncounterStageProps) {
    const band = lengthBand(highlight.text);
    const timeLabel = relativeYearLabel(highlight.year, nowYear);
    const toggleRef = useRef<HTMLButtonElement>(null);
    const cover = coverUrl(book?.coverPath);
    const accent = useCoverAccent(cover);

    // The control reflects reality before it is pressed: one passage, or already all seen, means the
    // visitor is told why instead of being silently moved to another book.
    const bookNote =
        bookHighlightCount <= 1
            ? '这本书目前只收录了一处划线。'
            : bookUnseenCount === 0
              ? '这本书里收录的划线都看过了。'
              : null;
    const canLookFurther = bookNote === null;

    const handleClose = () => {
        onCloseSource();
        // The close control lives inside the panel, so focus must come back to the toggle.
        toggleRef.current?.focus();
    };

    return (
        <section
            className="stage"
            data-band={band}
            data-phase={phase}
            data-commit-count={commitCount}
            data-source-open={sourceOpen ? 'true' : 'false'}
            style={{ '--book-accent': accent } as CSSProperties}
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
                    <button
                        type="button"
                        className="source-toggle"
                        data-testid="source-toggle"
                        ref={toggleRef}
                        aria-expanded={sourceOpen}
                        aria-controls={SOURCE_PANEL_ID}
                        aria-disabled={busy}
                        onClick={() => {
                            if (sourceOpen) {
                                onCloseSource();
                                return;
                            }
                            onOpenSource();
                        }}
                    >
                        <cite className="stage-book">《{book?.title ?? '出处缺失'}》</cite>
                        <span className="stage-author">{book?.author ?? '作者信息暂缺'}</span>
                        <span aria-hidden="true" className="source-chevron">
                            {sourceOpen ? '⌃' : '⌄'}
                        </span>
                    </button>
                    {timeLabel === null ? null : <span className="stage-time">{timeLabel}</span>}
                </p>
            </div>

            <TopicClues tags={tags} />

            <div id={SOURCE_PANEL_ID} className="source-panel" hidden={!sourceOpen} data-testid="source-panel">
                <div className="source-body">
                    <div className="cover-frame">
                        <CoverImage
                            title={book?.title ?? '出处缺失'}
                            coverPath={book?.coverPath}
                            className="cover-image"
                            alt={`《${book?.title ?? ''}》书封`}
                            fallback={
                                <div className="cover-placeholder">
                                    <span className="cover-placeholder-title">{book?.title ?? '出处缺失'}</span>
                                </div>
                            }
                        />
                    </div>
                    <div className="source-meta">
                        <p className="source-book">
                            <cite>《{book?.title ?? '出处缺失'}》</cite>
                        </p>
                        <p className="source-author">{book?.author ?? '作者信息暂缺'}</p>
                        <p className="source-count" data-testid="source-count">
                            {describeBookCollection(bookHighlightCount)}
                        </p>
                        {bookNote === null ? null : (
                            <p className="source-note" data-testid="source-note">
                                {bookNote}
                            </p>
                        )}
                        <div className="source-actions">
                            <button
                                type="button"
                                className="ghost-button"
                                data-testid="next-in-book"
                                aria-disabled={busy || !canLookFurther}
                                onClick={() => {
                                    if (!busy && canLookFurther) {
                                        onNextInBook();
                                    }
                                }}
                            >
                                再看一处
                            </button>
                            {onOpenBook === undefined || book === undefined ? null : (
                                <button
                                    type="button"
                                    className="ghost-button"
                                    data-testid="open-book"
                                    onClick={() => {
                                        onOpenBook(book.id);
                                    }}
                                >
                                    查看这本书
                                </button>
                            )}
                            <button type="button" className="ghost-button" data-testid="close-source" onClick={handleClose}>
                                收起
                            </button>
                        </div>
                    </div>
                </div>
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
                {onShare === undefined ? null : (
                    <button
                        type="button"
                        className="share-trigger"
                        data-testid="share-open"
                        data-share-trigger="stage"
                        /* A transition in flight has two passages in it, so neither can be shared yet. */
                        aria-disabled={busy}
                        onClick={() => {
                            if (!busy) {
                                onShare(highlight.id);
                            }
                        }}
                    >
                        分享
                    </button>
                )}
            </div>

            {deadEnd === null ? null : (
                <p className="stage-note" data-testid="stage-note">
                    {deadEnd}
                </p>
            )}
        </section>
    );
}
