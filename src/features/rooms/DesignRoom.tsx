import { sitePath } from '../../app/sitePath.ts';
import { ExplanationNav } from './ExplanationNav.tsx';

/** Explain the experience available in this build, not features promised for a future release. */
export function DesignRoom() {
    return (
        <article className="room room-design" aria-labelledby="design-heading" data-room="design">
            <ExplanationNav current="design" />
            <header className="design-intro">
                <p className="room-kicker">阅读方式</p>
                <h1 id="design-heading" className="room-heading" data-testid="room-heading">这个网站怎么运作</h1>
                <p className="design-lead">从一句话出发，不必急着去哪里。</p>
                <p className="design-summary">
                    这里把真实的阅读划线整理成一个可以闲逛的地方。你可以偶遇一句话，也可以认准一本书、沿着一个主题，
                    或在地图上走近一片文字。没有必须读完的路线，也不需要完成任务。
                </p>
            </header>

            <section className="design-section" aria-labelledby="design-encounter">
                <h2 id="design-encounter">从一句开始</h2>
                <p>
                    在“随便看看”里，一句一句读时，先遇见一本书，再遇见书里的一条划线；优先轮换尚未出现的书和句子。
                    划线很多的书不会仅凭数量占据首页。长短偏好帮助调整阅读节奏，不给内容打分，也不学习访客的个人偏好。
                </p>
                {__PLAY_WORLD_ENABLED__ ? <>
                    <p>
                        也可以换一种节奏：河流让几处文字持续经过，潮汐让一批文字到来、停留，再退去。
                        不必每次都做选择；看到感兴趣的一处，轻点就能留住完整原文，其他文字继续流动。
                        留住的句子不会被计时带走，读完再主动放回。
                    </p>
                    <p>
                        三种方式共用真实内容。切换方式时，正在读的原文与实际主题范围会保留；
                        文字目录和暂停按钮提供不追逐动效的读法。水路与岸线只是呈现，不代表句子之间的语义距离。
                    </p>
                </> : null}
                <p>每句都保留出处。想继续同一本书，就进入书房；想留给别人，可以分享这处原文的固定链接。</p>
            </section>

            <section className="design-section" aria-labelledby="design-topics">
                <h2 id="design-topics">书的主题，句子的主题</h2>
                <p>
                    <a href={sitePath('/books')}>书架</a>让你按书找文字，<a href={sitePath('/themes')}>主题书架</a>则整理整本书的方向。
                    句子旁的主题标签，描述的是这处划线涉及的概念：一本书谈到的事很多，不能把整本书的分类自动贴给每句话。
                </p>
                <p>
                    一条划线可以有一至三个地位平等的主题，也可以暂时没有标签。
                    标签是进入内容的线索，不是对作者观点的赞同；没有标签，也不意味着它没有价值或不属于某个主题。
                </p>
            </section>

            <section className="design-section" aria-labelledby="design-paths">
                <h2 id="design-paths">沿主题跨书阅读</h2>
                <p>
                    <a href={sitePath('/paths')}>主题小径</a>把不同书中涉及同一概念的划线放到一起。
                    读到一个同时带有其他主题的句子，可以从这里转向另一条小径；也可以留在当前主题里，继续读下一句。
                </p>
                <p>
                    小径先兼顾不同书的出现机会，再在选中的书里挑句子。
                    预先计算的语义距离可以调节相近与跳跃的节奏，资料不足时仍能公平地继续阅读。
                    小径不是论证链，也不表示这些作者彼此引用或观点一致。
                </p>
            </section>

            <section className="design-section" aria-labelledby="design-map">
                <h2 id="design-map">地图怎样形成</h2>
                <p>
                    <a href={sitePath('/map')}>世界地图</a>把当前收录范围内的真实划线放进一张固定的二维地图，每个点都是一处原文。
                    走近或放大一片地方，就能读圆心附近的一句，也能选另一本书，在同一片范围里对读。
                    详情看完后，可以回到刚才的位置。
                </p>
                <p>
                    位置来自提前计算的文本向量与二维布局；地形显示点的聚集，地名取自已有主题成员。
                    未标注的句子仍然参与整体地形。相邻不保证意思相同，山脊也不是主题的边界——地图提供的是探索的方向，而不是语义结论。
                </p>
                <p>访客浏览时不会调用模型，点位不会随着你的点击重新排列。完整原文与出处始终比地图上的关系更重要。</p>
            </section>

            <section className="design-section" aria-labelledby="design-scope">
                <h2 id="design-scope">公开范围与阅读语境</h2>
                <p>
                    线上使用单独审核过的书籍、划线和封面；本机开发可以使用更完整的阅读记录。
                    网站的结构与阅读方式可以共用，两套内容范围不会因此合并。
                    公开版的完整收录内容仍会被下载到浏览器，一次一句的呈现不是访问限制。
                </p>
                <p>
                    摘录不能代替原书，也未必代表记录者赞同其中的观点。出处、更正与移除说明见
                    <a href={sitePath('/about')}>内容与来源说明</a>；实现方法和限制另见<a href={sitePath('/design/technical')}>技术实现</a>。
                </p>
            </section>

            <nav className="room-exits" aria-label="继续探索">
                <a className="room-exit" href={sitePath('/')}>随便看看</a>
                <a className="room-exit" href={sitePath('/paths')}>进入主题小径</a>
                <a className="room-exit" href={sitePath('/about')}>返回关于</a>
            </nav>
        </article>
    );
}
