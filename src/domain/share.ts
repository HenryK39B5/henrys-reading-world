/**
 * Sharing one passage (docs/15 §4.3–4.4, §7).
 *
 * The identity of a shared passage is a stable highlight id — never an array position, never "whatever
 * the stage happens to show". So the share state keeps exactly one thing: which passage was locked when
 * the dialog opened. Everything the visitor copies or previews is read back through that id, which is
 * why a stage change behind the dialog cannot rewrite what is already on the clipboard (docs/15 §7.1).
 *
 * Pure and framework-free: the reducer, the address and the copied text are all unit-testable without a
 * browser, and the React layer only wires a dialog to it.
 */
import type { Book, Highlight } from './types.ts';

export const SITE_NAME = "Henry's Reading World";

/** Fallbacks that match the rest of the page, so a missing field never invents a person or a title. */
export const UNKNOWN_TITLE = '出处缺失';
export const UNKNOWN_AUTHOR = '作者信息暂缺';

export type ShareCopyStatus = 'idle' | 'copied' | 'failed';

export type ShareState = {
    /** The locked passage, or null when no dialog is open. */
    highlightId: string | null;
    /** Outcome of the most recent copy attempt inside this dialog. */
    copyStatus: ShareCopyStatus;
};

export const CLOSED_SHARE: ShareState = { highlightId: null, copyStatus: 'idle' };

export type ShareEvent =
    | { type: 'OPEN_SHARE'; highlightId: string }
    | { type: 'CLOSE_SHARE' }
    | { type: 'COPY_RESULT'; ok: boolean };

export function shareReducer(state: ShareState, event: ShareEvent): ShareState {
    switch (event.type) {
        case 'OPEN_SHARE':
            // Opening — or reopening — always re-locks the passage and forgets the previous copy result.
            return { highlightId: event.highlightId, copyStatus: 'idle' };
        case 'CLOSE_SHARE':
            return CLOSED_SHARE;
        case 'COPY_RESULT':
            // A result only ever describes the passage that is locked; with nothing locked it is dropped.
            return state.highlightId === null
                ? state
                : { ...state, copyStatus: event.ok ? 'copied' : 'failed' };
        default:
            return state;
    }
}

/**
 * Canonical address of one passage.
 *
 * The room, the year filter and the temporary scope are deliberately absent: they are where the visitor
 * happened to be, not what was shared (docs/15 §4.1).
 */
export function shareHref(highlightId: string): string {
    return `/?h=${encodeURIComponent(highlightId)}`;
}

/** The same address as an absolute URL, so it can be pasted somewhere else. */
export function shareUrl(origin: string, highlightId: string): string {
    return `${origin.replace(/\/+$/u, '')}${shareHref(highlightId)}`;
}

/**
 * What `复制文字` puts on the clipboard: the real passage, verbatim, with its real source and the site
 * name. Nothing is rewritten, trimmed, prettified or added.
 */
export function shareText(highlight: Highlight, book: Book | undefined): string {
    const title = orFallback(book?.title, UNKNOWN_TITLE);
    const author = orFallback(book?.author, UNKNOWN_AUTHOR);
    return `${highlight.text}\n\n——《${title}》${author}\n${SITE_NAME}`;
}

/** A field the snapshot left blank is missing, not an empty thing to print. */
function orFallback(value: string | undefined, fallback: string): string {
    return value === undefined || value.trim().length === 0 ? fallback : value;
}

/** The address shown in the dialog, matching what `复制本机链接` writes. */
export function shareLinkLabel(localOnly: boolean): string {
    return localOnly ? '复制本机链接' : '复制链接';
}
