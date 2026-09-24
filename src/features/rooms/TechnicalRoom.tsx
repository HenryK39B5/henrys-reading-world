import { sitePath } from '../../app/sitePath.ts';

/** Optional technical companion to the shorter, visitor-facing design explanation. */
export function TechnicalRoom() {
    return (
        <article className="room room-design" aria-labelledby="technical-heading" data-room="technical">
            <header className="design-intro">
                <p className="room-kicker">延伸阅读</p>
                <h1 id="technical-heading" className="room-heading" data-testid="room-heading">技术实现</h1>
                <p className="design-lead">
                    这个阅读世界由提前整理好的真实划线、关系和地图组成。下面是从本机准备内容到浏览器呈现的关键步骤，以及它们各自的边界。
                </p>
            </header>

            <section className="design-section" aria-labelledby="technical-data">
                <h2 id="technical-data">从阅读记录到公开快照</h2>
                <p>
                    划线先在本机整理成有稳定 ID 的书与句子。公开审核以书为单位，也能排除单条划线或某本书的封面。
                    导出时只保留获准展示的内容、出处、主题和地图投影；完整本机记录、审核决定的内部字段与原始高维向量不进入公开快照。
                </p>
                <p>
                    公开版是一份已经交付给浏览器的数据集，不是按请求临时抽取的一句。改变公开内容需要重新审核、导出、验证与部署。
                </p>
            </section>

            <section className="design-section" aria-labelledby="technical-selection">
                <h2 id="technical-selection">按书公平，再选句子</h2>
                <p>
                    首页先在当前范围内选一本书，再从书里选还未读过的划线；每个阅读范围都记录本轮已出现的书，避免划线数量最多的书占满探索过程。
                    主题书架限定的是可选书籍范围，书房则只在同一本书的划线里轮换。当前轮结束后才开始下一轮。
                </p>
                <p>
                    句长影响阅读切换的节奏，不代表质量评分；系统也不会根据访客点击训练个人偏好。
                </p>
            </section>

            <section className="design-section" aria-labelledby="technical-tags">
                <h2 id="technical-tags">两层主题与跨书小径</h2>
                <p>
                    书籍主题整理整本书；划线主题描述某一句可支持的概念，两者不互相推导。
                    本机 embedding 与 Agent 用于发现候选并辅助复核，无法可靠标注的内容保留未标注状态；同一句的多个主题没有主次。
                </p>
                <p>
                    小径同样先轮换书籍，再从选中的书里挑句子。有可用的预计算低维语义投影时，余弦相似度把候选分成近、中、远三档来调节节奏；
                    资料不足时退回均匀选择。访客可以使用纯公平模式，浏览时不会调用模型。
                </p>
            </section>

            <section className="design-section" aria-labelledby="technical-map">
                <h2 id="technical-map">点、地形与区域名称</h2>
                <p>
                    地图的输入是本机模型生成的划线向量。地图专用的稀疏随机投影先压到 96 维，再用固定随机种子的 UMAP 排布成二维；
                    少量边缘离群点经分位数裁剪，坐标被映射到固定画布。公开版从既有布局中筛选获准划线，<strong>不重新运行 UMAP 或移动剩余点</strong>。
                </p>
                <p>
                    每个点对应一条真实划线。64 × 40 的网格叠加点位附近的高斯权重，形成密度底图；三层等值线来自这张网格。
                    主题区域的名称放在已复核成员点位的中位数附近。密集地形可以由未标注句子形成，但不会因此被自动命名。
                </p>
                <p>
                    地图用 Canvas 绘制点与地形，并提供主题区域和划线列表供键盘阅读。二维距离与密度只描述这张投影，不能证明原句之间的完整语义关系。
                </p>
            </section>

            <section className="design-section" aria-labelledby="technical-delivery">
                <h2 id="technical-delivery">在浏览器里交付</h2>
                <p>
                    公开站点是静态构建。获准快照作为单独的带版本指纹的 JSON 资源下载；已公开房间有静态入口，
                    分享地址通过稳定划线 ID 返回同一句。页面没有账号系统或运行时 AI 服务；本机审核与标签工具不属于公开站点。
                </p>
                <p>
                    技术隔离只决定哪些文件进入网站，不替代逐条内容判断，也不自动提供书摘或封面的使用许可。
                    关于出处、更正与上下文，请看<a href={sitePath('/about')}>内容与来源说明</a>。
                </p>
            </section>

            <nav className="room-exits" aria-label="继续探索">
                <a className="room-exit" href={sitePath('/design')}>返回网站说明</a>
                <a className="room-exit" href={sitePath('/map')}>看看地图</a>
            </nav>
        </article>
    );
}
