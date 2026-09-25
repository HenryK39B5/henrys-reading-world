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
                    公开地图沿用已经固定的二维坐标：公开范围只筛选获准展示的点位，<strong>不重新运行 UMAP，也不为发布移动点位</strong>。每个点对应一条真实划线；主题区域名称只来自已复核的主题成员，不由密度自动命名。
                </p>
                <p>
                    地形由公开的固定点位离线生成，使用 128 × 80 密度网格、7 层淡等值带和 7 层等值线。它首先表达这张二维投影上的局部聚集密度，不表达主题边界、个人偏好或跨书共鸣。
                </p>
                <p>
                    支持 WebGL2 时，地图用逐像素明暗绘制连续地形，并在上层绘制点、标签和详情；WebGL2 不可用、初始化失败或上下文丢失时，使用 Canvas2D 等值带回退。主题列表和划线列表同时提供键盘与读屏可用的替代入口。二维距离与密度只描述这张固定投影，不能证明原句之间的完整语义关系。
                </p>
            </section>

            <section className="design-section" aria-labelledby="technical-delivery">
                <h2 id="technical-delivery">在浏览器里交付</h2>
                <p>
                    公开站点是静态构建。获准快照和公开地形都是带版本指纹的 JSON 资源；地形在构建前会校验版本、固定点位 hash 和几何层数。公开站点不依赖本机私有数据、运行时接口或模型服务。
                </p>
                <p>
                    推送后由 GitHub Pages 工作流安装锁定依赖、重新构建并部署静态资源。改变公开内容或地图资源需要重新审核、导出、隔离检查、构建验证与部署。
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
