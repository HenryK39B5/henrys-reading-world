import { sitePath } from '../../app/sitePath.ts';
import type { SnapshotIndex } from '../../domain/snapshot.ts';
import { ExplanationNav } from './ExplanationNav.tsx';

/** Explain the loaded map/data contract, never silently describe a local candidate as the public map. */
export function TechnicalRoom({ index }: { index: SnapshotIndex }) {
    const local = index.snapshot.visibility === 'local-only';
    const exactMap = index.snapshot.map?.version.startsWith('exact-cosine-48-v1-') ?? false;
    return (
        <article className="room room-design" aria-labelledby="technical-heading" data-room="technical"
            data-explained-map={exactMap ? 'exact-neighbors' : 'fixed-baseline'}>
            <ExplanationNav current="technical" />
            <header className="design-intro">
                <p className="room-kicker">实现细节</p>
                <h1 id="technical-heading" className="room-heading" data-testid="room-heading">技术实现</h1>
                <p className="design-lead">复杂的准备留在本机，轻松的阅读留在浏览器。</p>
                <p className="design-summary">
                    这是一个由 React 与 TypeScript 构建的静态网站。真实划线、主题与地图提前准备，
                    浏览器负责呈现、选择与返回，不在阅读过程中调用生成式 AI。
                </p>
            </header>

            <section className="design-section" aria-labelledby="technical-data">
                <h2 id="technical-data">从阅读记录到公开快照</h2>
                <p>
                    原始阅读记录先在本机整理为有稳定 ID 的书籍与划线。公开审核可以决定展示哪些书、哪些句子，以及是否展示封面；
                    线上只读取单独导出的已审核快照，不读取本机完整记录。
                    改页面结构，不等于扩大公开范围。
                </p>
                <p>
                    导出保留原文、出处、已复核的主题和用于显示的派生数据，排除凭证、平台账号字段、内部审核备注与原始高维向量。
                    分享链接绑定稳定的划线 ID，而不是数组中的第几个位置。公开版的完整快照会交付浏览器，不是按请求秘密抽取一句。
                </p>
            </section>

            <section className="design-section" aria-labelledby="technical-selection">
                <h2 id="technical-selection">按书公平，再选句子</h2>
                <p>
                    一句一句读时，先在当前范围轮换书籍，再在选中的书里选择未见划线。书籍划线数量不会直接变成被抽中的权重。
                    书房限定同一本书，主题书架限定一组书；轮次状态保存在浏览器侧，不需要账户或远程同步。
                </p>
                <p>句长可以影响阅读节奏，但不是质量分。没有根据访客点击建立的个人画像，也没有远程访问统计。</p>
            </section>

            {__PLAY_WORLD_ENABLED__ ? <section className="design-section" aria-labelledby="technical-water">
                <h2 id="technical-water">流动的预览，稳定的原文</h2>
                <p>
                    河流和潮汐使用 Canvas2D 绘制水面与文字预览，Pretext 辅助测量文字排版。
                    水与文字共用动画时间，岸线按当前帧更新，静态纹理和路径缓存复用；这是一种场景呈现，不是流体物理模拟。
                </p>
                <p>
                    预览只截取真实原文的连续前缀，不生成摘要或拼接新句。
                    选择后的全文由普通 DOM 呈现，保留原生滚动、复制、来源与全部主题标签，不等待动画结束，也不会自动收走。
                    原生按钮、文字目录、暂停和减少动态设置提供不同的操作方式；这些实现不等同于已经完成所有读屏与真机验证。
                </p>
            </section> : null}

            <section className="design-section" aria-labelledby="technical-tags">
                <h2 id="technical-tags">两层主题与跨书小径</h2>
                <p>
                    书籍主题整理整本书，划线主题描述某一句涉及的概念，两者不互相推导。
                    本机 embedding 与 Agent 用于发现候选并辅助复核，无法可靠标注的内容保留未标注状态；多个标签没有主次之分。
                </p>
                <p>
                    小径先轮换书，再选句。有可用的预计算低维语义投影时，以余弦相似度区分近、中、远来调节节奏；
                    资料不足时退回均匀选择，也可以使用纯公平模式。模型相似不等于作者引用、因果关系或观点相同。
                </p>
            </section>

            <section className="design-section" aria-labelledby="technical-map">
                <h2 id="technical-map">点、地形与区域名称</h2>
                {exactMap ? <p>
                    当前这张地图在本机直接计算原1024维文本向量的精确余弦近邻，再由 UMAP 生成二维布局，统一缩放而不逐轴拉伸或裁切离群点。
                    地名落在附近有同主题真实划线支持的成员点上，不用标签把所有内容强行划成互斥区域。
                    本轮采用不以标签调整坐标的版本；没有标签的内容同样保留。
                </p> : <p>
                    当前加载的是已固定的地图版本。它由本机文本向量经过随机投影与 UMAP 生成二维坐标；
                    既有公开版沿用获准点位，不重新运行 UMAP，也不为发布移动点位。
                    这描述的是当前数据版本，不是未来地图不能更新的规则。
                </p>}
                <p>
                    地形由点位离线生成，使用128 × 80密度网格、7层等值带与等值线。
                    它表达二维点位的局部聚集，不是主题国界、阅读价值或个人偏好。二维压缩始终有损，近邻保留率也不是语义准确率。
                </p>
                <p>
                    支持 WebGL2 时使用连续明暗地形；不可用或上下文丢失时，退回 Canvas2D 等值带。
                    点、地名和原文由相应图层与 DOM 呈现，主题与划线列表保留不依赖画布的入口。
                </p>
            </section>

            <section className="design-section" aria-labelledby="technical-delivery">
                <h2 id="technical-delivery">静态交付，明确边界</h2>
                <p>
                    Vite 将页面和已审核数据构建成静态文件，可由 GitHub Pages 托管；书房、小径与说明页都有可直接访问的静态入口。
                    浏览不需要登录、数据库或运行时模型服务。本机开发工具与研究结果不会因为页面更新而自动进入公开站点。
                </p>
                <p>{local
                    ? '当前是本机数据范围。地图派生数据通过只读本机端点校验后提供；这不代表线上采用了同样的内容或坐标。正式公开前，仍需核对单独的公开快照及其匹配地形。'
                    : '公开地形在构建前校验版本、点位指纹与几何层数。地图首次绘制就使用这份公开地形，不等待再次请求；浏览器不会向本机开发端点取数据。'}</p>
                <p>
                    发布前检查数据隔离、原文与稳定链接、静态子路径、键盘和窄屏阅读；模型指标、自动测试、实际体验与内容审核是不同的检查，不能互相替代。
                    出处和更正说明见<a href={sitePath('/about')}>内容与来源说明</a>。
                </p>
            </section>

            <nav className="room-exits" aria-label="继续探索">
                <a className="room-exit" href={sitePath('/design')}>返回网站说明</a>
                <a className="room-exit" href={sitePath('/map')}>看看地图</a>
            </nav>
        </article>
    );
}
