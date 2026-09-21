import type { SnapshotIndex } from '../../domain/snapshot.ts';
import { totalCountText, yearSpanText } from '../../domain/world.ts';

export type AboutRoomProps = {
    index: SnapshotIndex;
};

/**
 * 关于: the real collection range, and nothing about the reader (docs/12 §2.6).
 *
 * Internal principles, release process and "what this page refuses to do" are not the visitor's
 * business, so they are not written here.
 */
export function AboutRoom({ index }: AboutRoomProps) {
    const span = yearSpanText(index);
    const about = index.snapshot.owner.about;

    return (
        <section className="room room-about" aria-labelledby="about-heading" data-room="about">
            <h1 id="about-heading" className="room-heading" data-testid="room-heading">
                关于
            </h1>
            {about === undefined ? null : (
                <p className="about-line" data-testid="about-line">{about}</p>
            )}
            <p className="room-note about-detail" data-testid="about-detail">
                {totalCountText(index)}
                {span === null ? '。' : `，集中在 ${span}。`} 每条划线都保留原始文字与出处。
            </p>
            <p className="room-note about-context" data-testid="about-context">
                这里展示的是我在阅读中留下的原文划线。单句脱离原书后可能失去部分上下文，也不代表我认同作者的全部观点。
            </p>

            <nav className="room-exits" aria-label="去别的房间">
                <a className="room-exit" href="/" data-testid="exit-hall">
                    回到随便看看
                </a>
                <a className="room-exit" href="/themes">
                    逛主题书架
                </a>
                <a className="room-exit" href="/books">
                    看看所有书
                </a>
            </nav>
        </section>
    );
}
