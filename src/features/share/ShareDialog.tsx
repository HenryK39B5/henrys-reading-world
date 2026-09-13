import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import {
    SITE_NAME,
    UNKNOWN_AUTHOR,
    UNKNOWN_TITLE,
    shareLinkLabel,
    shareText,
    shareUrl,
    type ShareCopyStatus,
} from '../../domain/share.ts';
import { sharePalette } from '../../domain/sharePalette.ts';
import type { Book, Highlight } from '../../domain/types.ts';
import { useScrollLock } from './useScrollLock.ts';
import './share.css';

export type ShareDialogProps = {
    /** The locked passage. It is read-only here: the dialog never re-derives it from the stage. */
    highlight: Highlight;
    book: Book | undefined;
    /**
     * The accent of the locked passage's own book.
     *
     * Its own accent, not the room's: the card must belong to the book that was shared even if the room
     * behind the dialog has moved on to another one by the time this is painted (docs/16 §5.1).
     */
    accent: string;
    /** The content is real but the deployment is not, so the link only resolves on this machine. */
    localOnly: boolean;
    copyStatus: ShareCopyStatus;
    onCopyResult: (ok: boolean) => void;
    onRequestClose: () => void;
};

/** Clipboard access is a browser capability, never a guarantee (docs/05 §8). */
async function writeClipboard(text: string): Promise<boolean> {
    try {
        const clipboard = navigator.clipboard as Clipboard | undefined;
        if (clipboard === undefined || typeof clipboard.writeText !== 'function') {
            return false;
        }
        await clipboard.writeText(text);
        return true;
    } catch {
        // A denied permission or an insecure context must surface as a failure, never as a fake success.
        return false;
    }
}

/**
 * True when the card needs more room than its 4:5 default.
 *
 * Measured rather than guessed from a character count: the same passage needs a different height at
 * 390px than at 1440px, and the note the visitor reads has to describe what is actually on screen.
 */
function useExtendedCard(ref: React.RefObject<HTMLDivElement | null>): boolean {
    const [extended, setExtended] = useState(false);

    useLayoutEffect(() => {
        const element = ref.current;
        if (element === null || typeof ResizeObserver === 'undefined') {
            return;
        }
        const measure = () => {
            const width = element.offsetWidth;
            if (width === 0) {
                return;
            }
            setExtended(element.offsetHeight > width * 1.25 + 1);
        };
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(element);
        return () => {
            observer.disconnect();
        };
    }, [ref]);

    return extended;
}

/**
 * The share dialog: one passage, one link, one preview (docs/15 §7).
 *
 * Everything shown here comes from the passage that was locked on open. Nothing on this screen reads the
 * current stage, so a change behind the modal cannot make the copied text disagree with the preview.
 */
export function ShareDialog({
    highlight,
    book,
    accent,
    localOnly,
    copyStatus,
    onCopyResult,
    onRequestClose,
}: ShareDialogProps) {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const cardRef = useRef<HTMLDivElement>(null);
    const copyTextRef = useRef<HTMLButtonElement>(null);
    /** Set only when a real browser `showModal` is unavailable, so the dialog is still usable. */
    const [modal, setModal] = useState(true);
    /** The payload of the copy that failed, offered as plain selectable text. */
    const [manual, setManual] = useState<{ label: string; text: string } | null>(null);

    const extended = useExtendedCard(cardRef);
    const title = book?.title ?? UNKNOWN_TITLE;
    const author = book?.author ?? UNKNOWN_AUTHOR;
    /**
     * One book, one card.
     *
     * The palette is a pure function of the locked book's accent, so the surface cannot depend on the room,
     * the stage or anything else that may change while the dialog is open.
     */
    const palette = sharePalette(accent);
    const url = shareUrl(typeof window === 'undefined' ? '' : window.location.origin, highlight.id);
    const linkLabel = shareLinkLabel(localOnly);

    /**
     * The lock is taken first, before the dialog is shown and before anything in it is focused.
     *
     * Order matters here, and the reason is a real defect this pass found: focusing the dialog's first
     * control makes the browser scroll the focused element into view, which threw the page to the top for
     * any reader who opened the dialog from further down. Locking first means the offset that is saved and
     * restored is the reader's real one; the focus below then avoids scrolling altogether.
     *
     * The page behind the modal is not what is being read: it must not scroll away underneath it, and the
     * reader's place in it must survive the dialog being opened and closed (docs/16 §6).
     */
    useScrollLock();

    /**
     * Opening is entirely imperative, and `open` is deliberately never passed as a prop.
     *
     * Two traps live here. React owns every prop it is given, so a re-render would remove the `open`
     * attribute `showModal()` set — closing the dialog the moment it opened. And an effect that is not
     * idempotent is a bug React itself reports: in development the setup runs twice around a cleanup, so
     * the effect must do nothing when the dialog is already open, and must not close it on the way out.
     * Removing the element from the document is what closes it.
     */
    useLayoutEffect(() => {
        const dialog = dialogRef.current;
        if (dialog === null || dialog.open) {
            return;
        }
        let opened = false;
        if (typeof dialog.showModal === 'function') {
            try {
                dialog.showModal();
                opened = dialog.open;
            } catch {
                opened = false;
            }
        }
        if (!opened) {
            // A dialog that cannot become modal still has to be usable and closable.
            try {
                dialog.show();
            } catch {
                dialog.setAttribute('open', '');
            }
            setModal(false);
        }
    }, []);

    // The first real action holds the focus, so a keyboard visitor lands on something they can use —
    // without the browser moving the page to get there.
    useLayoutEffect(() => {
        copyTextRef.current?.focus({ preventScroll: true });
    }, []);

    const copy = useCallback(
        async (label: string, text: string) => {
            setManual(null);
            const ok = await writeClipboard(text);
            onCopyResult(ok);
            if (!ok) {
                setManual({ label, text });
            }
        },
        [onCopyResult],
    );

    return (
        <dialog
            ref={dialogRef}
            className="share-dialog"
            data-testid="share-dialog"
            data-highlight-id={highlight.id}
            data-modal={modal ? 'true' : 'false'}
            aria-labelledby="share-heading"
            onClose={onRequestClose}
        >
            <h2 id="share-heading" className="share-heading">
                分享这一处划线
            </h2>

            <div
                className="share-card"
                data-testid="share-card"
                data-extended={extended ? 'true' : 'false'}
                data-accent={accent}
                style={
                    {
                        '--card-bg': palette.background,
                        '--card-text': palette.text,
                        '--card-muted': palette.mutedText,
                        '--card-rule': palette.rule,
                    } as CSSProperties
                }
                ref={cardRef}
            >
                <blockquote className="share-card-text" data-testid="share-card-text">
                    {highlight.text}
                </blockquote>
                <div className="share-card-meta">
                    <p className="share-card-source">
                        《<cite className="share-card-title">{title}</cite>》
                        <span className="share-card-author">{author}</span>
                    </p>
                    {/**
                     * The site's own signature, kept apart from the source.
                     *
                     * Author and site name are different kinds of fact — who wrote it, and where this preview
                     * came from — and when they sit ten pixels apart the second reads as a continuation of the
                     * first. Its own block, its own hairline and more air between them make the foot of the card
                     * say 出处 then 署名 (docs/16 §4.4).
                     */}
                    <div className="share-card-imprint" data-testid="share-card-imprint">
                        <p className="share-card-brand">{SITE_NAME}</p>
                        {localOnly ? <p className="share-card-badge">仅本机 · 未公开审核</p> : null}
                    </div>
                </div>
            </div>

            {extended ? (
                <p className="share-note" data-testid="share-card-extended">
                    长文预览已延长比例
                </p>
            ) : null}

            <div className="share-actions">
                <button
                    type="button"
                    className="share-button"
                    data-testid="share-copy-text"
                    ref={copyTextRef}
                    onClick={() => {
                        void copy('文字', shareText(highlight, book));
                    }}
                >
                    复制文字
                </button>
                <button
                    type="button"
                    className="share-button"
                    data-testid="share-copy-link"
                    onClick={() => {
                        void copy('链接', url);
                    }}
                >
                    {linkLabel}
                </button>
                <button
                    type="button"
                    className="share-button share-button-quiet"
                    data-testid="share-close"
                    onClick={onRequestClose}
                >
                    关闭
                </button>
            </div>

            {/* One persistent polite region, so a result is announced when its text changes. */}
            <p className="share-status" role="status" data-testid="share-status">
                {copyStatus === 'copied' ? '已复制' : copyStatus === 'failed' ? '自动复制失败，请手动复制' : ''}
            </p>

            {manual === null ? null : (
                <div className="share-manual-block">
                    <textarea
                        className="share-manual"
                        data-testid="share-manual"
                        readOnly
                        rows={5}
                        value={manual.text}
                        aria-label={`可手动复制的${manual.label}`}
                        onFocus={(event) => {
                            event.currentTarget.select();
                        }}
                    />
                </div>
            )}

            {localOnly ? (
                <p className="share-local" data-testid="share-local-hint">
                    仅在这台电脑的本机预览中有效，尚未公开发布。
                </p>
            ) : null}
        </dialog>
    );
}
