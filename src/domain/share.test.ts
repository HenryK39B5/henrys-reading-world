import { describe, expect, it } from 'vitest';
import {
    CLOSED_SHARE,
    SITE_NAME,
    UNKNOWN_AUTHOR,
    UNKNOWN_TITLE,
    shareHref,
    shareReducer,
    shareText,
    shareUrl,
    type ShareState,
} from './share.ts';
import type { Book, Highlight } from './types.ts';

/**
 * Sharing properties (docs/15 §4.3–4.4, §7).
 *
 * The whole point of locking one id is that nothing the page does afterwards can change what a visitor
 * copied. These tests hold that line without a browser, and the text format is checked byte for byte so
 * no "improvement" can slip into somebody else's sentence.
 *
 * Placeholder text only: a real passage is never reproduced in a unit test.
 */
const PLACEHOLDER = '一段用于验证的占位文本。';

const HIGHLIGHT: Highlight = { id: 'h-001', bookId: 'b-001', text: PLACEHOLDER, year: 2025 };
const BOOK: Book = { id: 'b-001', title: '书名占位', author: '作者占位', themeIds: ['t-001'] };

function open(state: ShareState, id: string): ShareState {
    return shareReducer(state, { type: 'OPEN_SHARE', highlightId: id });
}

describe('the share state locks one highlight id', () => {
    it('starts closed and locks the passage it was opened with', () => {
        const state = open(CLOSED_SHARE, 'h-001');
        expect(state.highlightId).toBe('h-001');
        expect(state.copyStatus).toBe('idle');
    });

    it('re-locks on every open instead of keeping the previous passage', () => {
        const first = open(CLOSED_SHARE, 'h-001');
        const copied = shareReducer(first, { type: 'COPY_RESULT', ok: true });
        const second = open(copied, 'h-002');
        expect(second.highlightId).toBe('h-002');
        // A new dialog must not inherit the old "已复制" state.
        expect(second.copyStatus).toBe('idle');
    });

    it('never lets a copy result change which passage is locked', () => {
        let state = open(CLOSED_SHARE, 'h-001');
        for (const ok of [true, false, true, false]) {
            state = shareReducer(state, { type: 'COPY_RESULT', ok });
            expect(state.highlightId).toBe('h-001');
        }
        expect(state.copyStatus).toBe('failed');
    });

    it('ignores a copy result while nothing is open', () => {
        expect(shareReducer(CLOSED_SHARE, { type: 'COPY_RESULT', ok: true })).toBe(CLOSED_SHARE);
    });

    it('closes back to the shared empty state', () => {
        expect(shareReducer(open(CLOSED_SHARE, 'h-001'), { type: 'CLOSE_SHARE' })).toBe(CLOSED_SHARE);
    });
});

describe('the shared address is one passage and nothing else', () => {
    it('builds the canonical hall link', () => {
        expect(shareHref('h-001')).toBe('/?h=h-001');
        expect(shareUrl('http://127.0.0.1:5173', 'h-001')).toBe('http://127.0.0.1:5173/?h=h-001');
        expect(shareUrl('https://example.test/', 'h-001')).toBe('https://example.test/?h=h-001');
    });

    it('carries no room, filter or tracking parameter', () => {
        const href = shareHref('h-001');
        const params = new URLSearchParams(href.slice(href.indexOf('?')));
        expect([...params.keys()]).toEqual(['h']);
        expect(href).not.toContain('year');
        expect(href).not.toContain('theme');
    });

    it('encodes an id that needs encoding, and only once', () => {
        const href = shareHref('h 00&1');
        expect(href).toBe('/?h=h%2000%261');
        expect(new URLSearchParams(href.slice(href.indexOf('?'))).get('h')).toBe('h 00&1');
    });
});

describe('the copied text is the real passage plus its real source', () => {
    it('formats the passage, the source and the site provenance in that order', () => {
        expect(shareText(HIGHLIGHT, BOOK)).toBe(
            `${PLACEHOLDER}\n\n——《书名占位》作者占位\n\n来自 ${SITE_NAME}`,
        );
    });

    it('keeps the site name on its own paragraph, so it does not read as a second author', () => {
        const text = shareText(HIGHLIGHT, BOOK);
        const lines = text.split('\n');
        // blank, source, blank, provenance: the author line never has the site name appended to it.
        expect(lines.at(-1)).toBe(`来自 ${SITE_NAME}`);
        expect(lines.at(-2)).toBe('');
        expect(lines).toContain('——《书名占位》作者占位');
        expect(lines.find((line) => line.includes('作者占位'))).not.toContain(SITE_NAME);
    });

    it('keeps the passage verbatim, including its own line breaks', () => {
        const multi = { ...HIGHLIGHT, text: '第一行\n第二行' };
        const text = shareText(multi, BOOK);
        expect(text.startsWith('第一行\n第二行\n\n')).toBe(true);
    });

    it('states a missing author or book instead of inventing one', () => {
        expect(shareText(HIGHLIGHT, undefined)).toBe(
            `${PLACEHOLDER}\n\n——《${UNKNOWN_TITLE}》${UNKNOWN_AUTHOR}\n\n来自 ${SITE_NAME}`,
        );
        // A blank field is missing, not an empty thing to print next to a real book title.
        expect(shareText(HIGHLIGHT, { ...BOOK, author: '  ' })).toBe(
            `${PLACEHOLDER}\n\n——《书名占位》${UNKNOWN_AUTHOR}\n\n来自 ${SITE_NAME}`,
        );
    });
});
