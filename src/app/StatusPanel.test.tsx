import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { EMPTY_SNAPSHOT, type Snapshot } from '../domain/types.ts';
import { StatusPanel } from './StatusPanel.tsx';

/**
 * Structural fixtures only: they exercise the render path, are never shown to visitors and are
 * never presented as anyone's reading history. Real passages stay in .private/local-snapshot.json.
 */
function readySnapshot(): Snapshot {
    return {
        ...EMPTY_SNAPSHOT,
        visibility: 'local-only',
        themes: [{ id: 't-001', title: 'Theme One' }],
        books: [{ id: 'b-001', title: 'Book & <One>', author: 'Author One', themeIds: ['t-001'] }],
        highlights: [{ id: 'h-001', bookId: 'b-001', text: 'first passage', year: 2023, tagIds: [] }],
    };
}

describe('StatusPanel', () => {
    it('renders the loading state without any passage', () => {
        const html = renderToStaticMarkup(<StatusPanel state={{ status: 'loading' }} />);
        expect(html).toContain('正在读取真实划线数据');
    });

    it('renders the empty state instead of placeholder content', () => {
        const html = renderToStaticMarkup(
            <StatusPanel state={{ status: 'empty', snapshot: EMPTY_SNAPSHOT, warnings: [] }} />,
        );
        expect(html).toContain('尚未准备可展示的真实划线');
        expect(html).not.toContain('stage-sample');
    });

    it('renders the error state with the reported reasons', () => {
        const html = renderToStaticMarkup(<StatusPanel state={{ status: 'error', errors: ['数据快照校验失败'] }} />);
        expect(html).toContain('数据无法加载');
        expect(html).toContain('数据快照校验失败');
    });

    it('renders real coverage, escapes markup and shows warnings when present', () => {
        const html = renderToStaticMarkup(
            <StatusPanel
                state={{ status: 'ready', snapshot: readySnapshot(), warnings: ['content: sample warning'] }}
            />,
        );
        expect(html).toContain('1 条划线 · 1 本书 · 1 个主题书架 · 1 个年份');
        expect(html).toContain('first passage');
        expect(html).toContain('Book &amp; &lt;One&gt;');
        expect(html).not.toContain('<One>');
        expect(html).toContain('content: sample warning');
    });
});
