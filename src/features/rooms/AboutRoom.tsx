import type { SnapshotIndex } from '../../domain/snapshot.ts';
import { totalCountText, yearSpanText } from '../../domain/world.ts';
import { sitePath } from '../../app/sitePath.ts';
import { ExplanationNav } from './ExplanationNav.tsx';

export type AboutRoomProps = {
    index: SnapshotIndex;
};

/**
 * 关于: the real collection range, and nothing about the reader (docs/12 §2.6).
 *
 * This page keeps the collection and source disclosure concise; visitors who want the product
 * explanation can follow the separate design page without interrupting the reading flow.
 */
export function AboutRoom({ index }: AboutRoomProps) {
    const span = yearSpanText(index);
    const about = index.snapshot.owner.about;

    return (
        <section className="room room-about" aria-labelledby="about-heading" data-room="about">
            <ExplanationNav current="about" />
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
                这里不是书评的结论，也不是一份知识清单，而是一些阅读时愿意停下来的地方。
                文字来自真实的微信读书划线；离开原书后可能失去部分上下文，也不代表我认同作者的全部观点。
            </p>

            <p className="room-note about-map-note" data-testid="about-map-note">
                {index.snapshot.visibility === 'public'
                    ? '你现在看到的是单独审核过的公开内容，不是完整的本机阅读记录。'
                    : '你现在看到的是本机阅读范围；线上另用单独审核过的公开内容，页面更新不会把两套资料合并。'}
                地图提供探索线索，地形表示当前点位的聚集，不代表完整的语义关系或个人偏好。
            </p>

            <p className="room-note about-design-link">
                想从哪里开始，可以看<a href={sitePath('/design')} data-testid="about-design-link">这个网站怎么运作</a>；
                想看数据、标签和地图的实现，可以读<a href={sitePath('/design/technical')} data-testid="about-technical-link">技术实现</a>。
            </p>

            <p className="room-note about-rights" data-testid="about-rights">
                内容与来源说明：这里展示的是个人阅读记录中的原文摘录，不是本站原创内容，也不代表作者、出版社或微信读书的立场。书名、作者信息与书封属于各自权利人；如需对展示内容提出更正或移除请求，请联系项目维护者。
            </p>

            <nav className="room-exits" aria-label="去别的房间">
                <a className="room-exit" href={sitePath('/')} data-testid="exit-hall">
                    回到随便看看
                </a>
                <a className="room-exit" href={sitePath('/themes')}>
                    逛主题书架
                </a>
                <a className="room-exit" href={sitePath('/books')}>
                    看看所有书
                </a>
            </nav>
        </section>
    );
}
