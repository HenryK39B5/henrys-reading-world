import { pathCountText, summarizePaths } from '../../domain/paths.ts';
import type { SnapshotIndex } from '../../domain/snapshot.ts';

export function PathsRoom({ index }: { index: SnapshotIndex }) {
    const paths = summarizePaths(index);

    return (
        <section className="room room-paths" aria-labelledby="paths-heading" data-room="paths">
            <header className="paths-head">
                <div>
                    <p className="room-kicker">跨书的思想线索</p>
                    <h1 id="paths-heading" className="room-heading" data-testid="room-heading">
                        主题小径
                    </h1>
                </div>
                <span className="paths-total">{paths.length} 条可走的小径</span>
            </header>

            {paths.length === 0 ? (
                <p className="room-note" data-testid="paths-empty">
                    目前还没有完成审核的主题小径。
                </p>
            ) : (
                <ol className="path-list" data-testid="path-list">
                    {paths.map((entry, indexNumber) => (
                        <li className="path-list-item" key={entry.tag.id}>
                            <a className="path-list-link" href={`/paths/${encodeURIComponent(entry.tag.id)}`}>
                                <span className="path-list-number" aria-hidden="true">
                                    {String(indexNumber + 1).padStart(2, '0')}
                                </span>
                                <span className="path-list-copy">
                                    <strong className="path-list-title">{entry.tag.title}</strong>
                                    {entry.tag.description === undefined ? null : (
                                        <span className="path-list-description">{entry.tag.description}</span>
                                    )}
                                </span>
                                <span className="path-list-count">{pathCountText(entry)}</span>
                                <span className="path-list-arrow" aria-hidden="true">
                                    →
                                </span>
                            </a>
                        </li>
                    ))}
                </ol>
            )}

            <nav className="room-exits" aria-label="主题小径的出口">
                <span className="room-note">世界地图将在下一阶段开放。</span>
                <a className="room-exit" href="/themes">
                    逛主题书架
                </a>
                <a className="room-exit" href="/">
                    随便看看
                </a>
            </nav>
        </section>
    );
}
