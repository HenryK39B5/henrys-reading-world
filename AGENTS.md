# 实现 Agent 工作约定

## 目标与权威顺序

本轮实现 Henry's Reading World V3：在既有真实划线房间体验上加入逐条主题标签、主题小径、embedding 辅助内容生产、阅读世界地图与全局视觉重构；同时保留只在本机运行的 Studio / 发布审核工具。不建设公众登录、远程后台或运行时 AI 服务。

阅读顺序：`PRODUCT_BRIEF.md` → **`docs/19-PRODUCT-DIRECTION-V3.md` → `docs/20-TAGS-PATHS-MAP-SPEC.md` → `docs/21-V3-VISUAL-DIRECTION.md` → `docs/22-V3-IMPLEMENTATION-PLAN.md` → `docs/23-EMBEDDING-EVALUATION.md` → `docs/24-BATCH-2-TAG-DISCOVERY.md` → `docs/25-BATCH-3-TAG-STUDIO.md` → `docs/26-BATCH-4-PATHS-AND-VISUAL.md` → `docs/27-BATCH-5-WORLD-MAP.md` → `docs/28-BATCH-6-FULL-TAGGING.md` → `docs/29-GPT6-ASTRA-DESIGN-REVIEW-BRIEF.md` → `docs/29A-GPT6-ASTRA-TEXT-ONLY-DESIGN-REVIEW-PACKET.md`** → `docs/17-PUBLICATION-DIRECTION-AND-RELEASE-A.md` → `docs/10-PRODUCT-DIRECTION-V2.md` → `docs/12-ROOMS-COLOR-MOTION-DIRECTION.md` → `docs/11-V2-IMPLEMENTATION-PLAN.md` → `docs/18-RELEASE-A-PUBLICATION-REVIEW-IMPLEMENTER-PROMPT.md` → `docs/01-SCOPE-AND-DECISIONS.md` → `docs/02-TECHNICAL-DESIGN.md` → `docs/03-DATA-CONTRACT.md` → `docs/04-SERENDIPITY-SPEC.md` → `docs/05-UX-SPEC.md` → `docs/06-IMPLEMENTATION-PLAN.md` → `docs/07-IMPLEMENTATION-HANDOFF.md`。`19–22` 是当前 V3 产品与施工权威，`23` 记录 Batch 1 实际评测，`24` 记录 Batch 2 标签发现，`25` 记录 Batch 3 稳定词表、试标与 Local Tag Studio，`26` 记录 Batch 4 schema 3、主题小径、岔路与视觉基础，`27` 记录 Batch 5 全量地图布局、Canvas 世界、主题区域与 Book Aura，`28` 记录 Batch 6 全量候选、双模型复核与质量审计实况，`29` 是当前交给高能力模型的产品审美与整体体验审阅任务书，`29A` 是模型无图片视觉能力时的文字化证据包；`17/18` 保留已完成的公开审核与 Release-A 契约；`10–12` 保留 V2 公平、房间和 Book Aura 历史基线，冲突处由 V3 取代。

用户明确要求所有产品开发使用真实微信读书数据，不使用 fake data。Critique #1 后产品从“前三句策展并塑造印象”调整为全量真实划线的轻松漫游；V3 进一步确认：Book Theme 继续作为书架分类，Highlight 新增 1–3 个地位平等的 Topic Tag，形成主题小径与岔路；embedding 只用于本机标签发现、标注辅助、地图布局和小径软节奏，不做独立类似划线入口、AI 搜索、问答或人格分析。产品采用一个 Reading World、Public/Local 两个数据范围和一个 Local Studio。公开范围的既有决定继续有效，但 Release-B 暂停到 V3 Gate 之后。真正出现新冲突时再请用户决定。

开始数据工作前，额外完整阅读 `docs/09-WEREAD-DATA-WORKFLOW.md`、`.agents/skills/weread-skills/SKILL.md`、`PROJECT-ADAPTATION.md` 与所调用能力文件。不依赖客户端自动加载 skill。

## 执行规则

- 先检查目录、现有实现及 Git 状态；保护既有工作，不因为本交接写着“无代码”就覆盖后续代码。
- 当前 Slice 0–4、V2-A～V2-E4D、**Release-A（A1～A4）与 V3 Batch 0–6** 均已完成；Batch 6 最终 assignments 为 1,694 reviewed / 2,969 draft，累计 688 条全文 override 已应用，自动 reviewed 高风险为 0。低信心内容诚实保留 draft，不为覆盖率强贴标签。local snapshot、1,694 条路径投影与 4,663 点最终地图已重建；最终地图精修已完成渐进展开、移动端重排、独立导航入口、滚轮隔离和 Book Aura 书籍选择器，当前停在用户体验 / 视觉 Gate，并已准备 GPT-6 Astra 审美审阅材料与最新全产品截图包。正式导出 public snapshot、复制 public covers、创建 repo、push 或部署仍需单独 Gate。
- 使用 Windows 原生 Node/npm/Git 与 PowerShell。不要混用 WSL 路径。
- 不在非空项目根目录直接运行可能覆盖文档的脚手架；优先逐文件建立 Vite 配置。
- 版本首次安装时选择彼此兼容的稳定版本并提交 npm 锁文件，不凭空声称某版本是最新。
- 不引入登录、数据库、远程后台、同步服务、AI 人格分析、社交、远程统计或 Window 嵌入。允许显式 Batch 中的本机 Studio 与离线 embedding API 调用；public/local 消费者运行时不得调用模型。
- 已授权移植并使用项目内微信读书 skill 获取相关真实数据；仅按 `09` 的取数边界操作。不访问 SiYuan、滴答清单、其他个人目录或凭证存储来补样本。
- 用户已明确授权读取全部书籍（包括私密阅读）的项目相关真实数据用于产品开发。取消少量 / 6 本限制，不因 secret=1 或未知状态停工，不再逐书逐批询问。可直接完成分页、读取真实划线、建立 local-only 快照并开发；正式公开发布仍单独确认，详见 `09 §1`。
- 仅已确认可公开的快照进入 `src/`、`public/` 和正常构建产物。开发中的真实数据走 `dev:local` 路径（见 `02` / `09`）。**注**：用户已确认开发阶段内容可自由传输使用，隔离的目的不是保密，而是“公开发布决定尚未做出”——不要把它当成保密要求，但也不要自行把内容改成已发布状态。
- 真正不能外发的只有凭证：`WEREAD_API_KEY`、账号标识、原始回包中的个人字段，不得出现在会话输出、代码、提交或外部请求中。
- 没有真实材料就保持空状态和数据阻塞，不写 demo / mock / fake 书摘、作者、阅读年份或统计；不能把生成文本归给真实作者。
- 不上传内容，不部署，不自动 push，不添加遥测。需要这些操作时先取得授权。
- 可进行任务相关安装、构建、测试；网络或工具不可用时明确报告，不把未执行写成通过。
- 可以做小步本地 Git 提交（若仓库存在或已在本目录初始化），不得改全局身份配置、重写历史或丢弃用户修改。

## 代码要求

- TypeScript strict；数据和算法独立于 React；选择算法接收可注入 RNG 与时间。
- Book Theme 与 Highlight Topic Tag 必须是不同类型与语义；Topic Tag 每条 1–3 个、地位平等，不恢复质量分、人格标签或 Opening/Contrast/Surprise。
- embedding provider、缓存、评测与向量只在 `.private` / scripts / Studio；public snapshot 不含原始高维向量、置信度、理由或私有 note。默认 provider 已改为本机 `Xenova/bge-large-zh-v1.5@a48549b-q8-cls`；SiliconFlow 结果只作历史对照，不再发送新的划线文本。若未来重新启用任何远程 provider，必须先获用户明确许可，API key 只来自非 `VITE_*` 环境变量。
- 小径算法先满足按书公平、首轮不重复与全量可达，再在选中书内部使用 embedding 调节近/中/远节奏；无 embedding 时必须稳定降级。
- 地图总览不得创建 4,663 个 DOM 按钮或同时渲染全文；使用 Canvas/预计算图层或等效低 DOM，并提供小径列表与区域列表作为无障碍替代。
- 不使用 `dangerouslySetInnerHTML` 展示内容；不引入不必要的状态、动画、UI 或推荐框架。视觉以 `docs/21` 为准；纯 CSS 能完成时不用动画库，reduced-motion 必须取消位移、缩放与长过渡。
- 原生语义优先；键盘、移动端、长文本、200% 缩放和 reduced-motion 是主路径要求。
- 分享必须绑定稳定 highlight ID，不能依赖数组下标或当前随机位置；V3 卡片与复制文本显示该条全部 Topic Tag，不截断为 `+N`。
- 每片补充必要测试与真实截图，不以“编译通过”替代交互和视觉验收。
- 新增依赖须说明用途；纯 CSS 能完成的过渡不用动画库。

## 每个内部阶段与连续批次完成后

每个内部阶段都更新 `docs/08-REVIEW-CHECKLIST.md` 的执行记录并做小步本地 commit，说明：完成范围、修改文件、实际命令和结果、浏览器证据、未验证项、偏差和下一步。只要阶段 Gate 通过且没有新的产品冲突，可连续进入同一批次的下一阶段；整个批次结束后再统一停止汇报。Batch 0 完成后按 `docs/22` 明确停止汇报，不自动启动 Batch 1。

缺浏览器时可以继续纯函数、静态检查和实现，但界面验收保持未验证；在对应视觉 Gate 前必须补齐。不要反复为已明确的常规实现事项提问；只有产品边界、隐私、真实材料和不可逆操作需要升级。全部书籍的开发取数授权已经解决，local-only 快照现有 4,663 条 / 130 本；V3 可直接进行私有 embedding、标签与地图开发。既有公开清单审核已完成，但新增标签与地图仍需在正式 export 前复核。
