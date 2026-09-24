import { sitePath } from '../../app/sitePath.ts';

/** Visitor-facing product explanation. Keep it about the finished experience, not the build diary. */
export function DesignRoom() {
    return (
        <article className="room room-design" aria-labelledby="design-heading" data-room="design">
            <header className="design-intro">
                <p className="room-kicker">关于这个网站</p>
                <h1 id="design-heading" className="room-heading" data-testid="room-heading">
                    这个网站怎么运作
                </h1>
                <p className="design-lead">
                    这里收录了我在微信读书留下、经过筛选公开的原文划线。你可以随手读一句，
                    再顺着它的出处、主题或地图，看看其他书里有什么关联。
                </p>
            </header>

            <section className="design-section" aria-labelledby="design-encounter">
                <h2 id="design-encounter">从一句开始</h2>
                <p>
                    首页一次显示一条划线。点击“再来一句”时，系统先从当前范围选一本书，再从这本书里选一句；
                    优先展示还没遇见过的内容。这样，划线很多的书不会仅凭数量占据首页。句子的长短会影响展示节奏，
                    但不会成为内容好坏的评分，也不会按访客的点击建立个人偏好。
                </p>
                <p>
                    每句都保留书名与作者。想多看看同一本书，可以从出处进入书房；书房也一次读一句，
                    这一轮看完后才重新开始。
                </p>
            </section>

            <section className="design-section" aria-labelledby="design-topics">
                <h2 id="design-topics">书的主题，句子的主题</h2>
                <p>
                    <a href={sitePath('/themes')}>主题书架</a>整理整本书：一本书可以放在不止一个书架上。
                    句子的主题标签则描述这处划线能够支持的概念。同一本书谈到的事很多，书架主题不会自动变成书中每句话的标签。
                </p>
                <p>
                    我平时会在 flomo 给笔记留下主题线索，这启发了逐句标注的做法。
                    Agent 帮助发现候选主题，标签的定义和边界仍需要复核；无法可靠归类的句子会保留未标注状态。
                    标签也不代表我认同句子表达的观点。
                </p>
            </section>

            <section className="design-section" aria-labelledby="design-paths">
                <h2 id="design-paths">沿主题跨书阅读</h2>
                <p>
                    <a href={sitePath('/paths')}>主题小径</a>把不同书里涉及同一概念的划线连起来。
                    一句有多个合适的标签时，可以从这句转向另一条小径；这些标签没有主次之分。
                </p>
                <p>
                    小径先兼顾不同书的出现机会，避免被某本划线很多的书占满。
                    条件允许时，预先算好的语义距离会帮助选择相近或跨度较大的下一句；
                    缺少可靠数据时，就在选中的书里随机选择未见内容。
                </p>
            </section>

            <section className="design-section" aria-labelledby="design-map">
                <h2 id="design-map">地图怎样形成</h2>
                <p>
                    在本机准备内容时，我们用 embedding 模型把划线转换成语义向量，再把它们之间的关系排布到二维地图。
                    <a href={sitePath('/map')}>世界地图</a>里的每个点都对应一条当前范围内的真实划线。
                    有可靠主题标签的句子帮助地图标出可进入的主题区域；未标注的句子仍然参与整体地形。
                </p>
                <p>
                    地图上的距离提供探索线索，二维位置无法完整表达一句话的含义。
                    访客浏览时不会调用模型；地图位置和主题区域已经提前准备好。
                </p>
            </section>

            <section className="design-section" aria-labelledby="design-scope">
                <h2 id="design-scope">公开范围与阅读语境</h2>
                <p>
                    公开版只收录经过审核决定展示的书、划线和封面；本地版还可以回看更完整的个人阅读记录。
                    页面一次显示一句，公开版的完整收录内容仍会被下载到访客浏览器中。随机呈现只改变阅读方式，不隐藏已经公开的文字。
                </p>
                <p>
                    原文划线离开书籍后可能失去部分上下文。关于引用、出处与更正请求，请看
                    <a href={sitePath('/about')}>内容与来源说明</a>。
                </p>
            </section>

            <nav className="room-exits" aria-label="继续探索">
                <a className="room-exit" href={sitePath('/design/technical')}>技术实现</a>
                <a className="room-exit" href={sitePath('/')}>随便看看</a>
                <a className="room-exit" href={sitePath('/paths')}>进入主题小径</a>
                <a className="room-exit" href={sitePath('/about')}>返回关于</a>
            </nav>
        </article>
    );
}
