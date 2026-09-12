import { indexSnapshot } from '../domain/snapshot.ts';
import type { SnapshotLoad } from './snapshotSource.ts';

export type LoadState = { status: 'loading' } | SnapshotLoad;

/**
 * Slice 0 status panel.
 *
 * It exists to prove that real, validated material reaches the render path and to show honest
 * empty/error states. The encounter stage, source reveal and world sections arrive in Slice 1+.
 * No placeholder passage is ever rendered here.
 */
export function StatusPanel({ state }: { readonly state: LoadState }) {
    if (state.status === 'loading') {
        return <p className="muted">正在读取真实划线数据…</p>;
    }

    if (state.status === 'error') {
        return (
            <section aria-labelledby="status-heading">
                <h1 id="status-heading" className="panel-heading">
                    数据无法加载
                </h1>
                <p className="muted">页面保持空白，不使用任何占位书摘。</p>
                <ul className="detail-list">
                    {state.errors.map((error) => (
                        <li key={error}>{error}</li>
                    ))}
                </ul>
            </section>
        );
    }

    if (state.status === 'empty') {
        return (
            <section aria-labelledby="status-heading">
                <h1 id="status-heading" className="panel-heading">
                    尚未准备可展示的真实划线
                </h1>
                <p className="muted">
                    这里只展示 Henry 本人的真实划线与出处。数据准备完成前保持空白，不生成示例内容。
                </p>
            </section>
        );
    }

    return <DataReady state={state} />;
}

function DataReady({ state }: { readonly state: Extract<SnapshotLoad, { status: 'ready' }> }) {
    const index = indexSnapshot(state.snapshot);
    const { coverage } = index;
    const sample = index.snapshot.highlights[0];
    const sampleBook = sample === undefined ? undefined : index.booksById.get(sample.bookId);

    return (
        <section aria-labelledby="status-heading">
            <h1 id="status-heading" className="panel-heading">
                真实划线数据已就绪
            </h1>
            <p className="muted">
                {coverage.highlightCount} 条划线 · {coverage.bookCount} 本书 · {coverage.topicCount} 个主题 ·{' '}
                {coverage.yearCount} 个年份
            </p>
            <p className="muted">
                篇幅分布：短 {coverage.bands.short} · 中 {coverage.bands.medium} · 长 {coverage.bands.long}
                {coverage.hasOriginalLineBreak ? ' · 含原始换行' : ''}
            </p>
            {sample === undefined || sampleBook === undefined ? null : (
                <p className="stage-sample">
                    {sample.text}
                    <span className="attribution">
                        ——《{sampleBook.title}》{sampleBook.author}
                    </span>
                </p>
            )}
            {state.warnings.length > 0 ? (
                <details className="warnings">
                    <summary>数据覆盖提示（{state.warnings.length}）</summary>
                    <ul className="detail-list">
                        {state.warnings.map((warning) => (
                            <li key={warning}>{warning}</li>
                        ))}
                    </ul>
                </details>
            ) : null}
        </section>
    );
}
