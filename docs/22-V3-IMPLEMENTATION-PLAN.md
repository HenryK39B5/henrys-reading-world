# 22 — V3 实施计划：标签、小径、地图与视觉重构

> 日期：2026-09-19
>
> 状态：V3 施工权威；Batch 0–6 与最终地图精修已完成，local snapshot、路径投影、独立地图入口、移动端布局和滚轮交互均已验证；当前等待用户最终体验 / 视觉 Gate。Release-B 继续暂停。
>
> Release-B 暂停。V3 不自动授权正式 public snapshot、public covers、repo、push、workflow 或部署。

## 1. 当前基线

- HEAD 起点：`6b6e0a0 Publication review: add context note and clean imported metadata`；
- schema 2；local-only 4,663 条 / 130 本 / 14 个 Book Theme；
- publication policy：108 本公开 / 22 本排除 / 6 条单独排除，`reviewComplete=true`；
- private preview：3,462 条拟公开，`releaseReady=true`（仅对 V2 内容范围）；
- public snapshot：0 本 / 0 条；
- 最近基线：248 单测 / 19 文件、104 local E2E、9 reviewer E2E、1 public E2E、6 real-data smoke；开工时重跑，不照抄；
- 真机移动端与 Safari 未验证；
- 唯一数据警告：没有保留原始换行的真实划线。

## 2. 实施原则

1. 每个 Batch 独立更新 `docs/08`、测试、浏览器证据与本地 commit；
2. 用户只参与真正的产品 / 内容 / 视觉 Gate，不为常规工程问题反复确认；
3. 所有 UI、截图与标注只使用真实数据；
4. embedding、候选标签、置信度、模型报告与 Studio 数据留在 `.private`；
5. public 运行时不调用模型；
6. Book Theme 与 Topic Tag 分层，不破坏现有书架；
7. stable book / highlight ID 永不重排或复用；
8. 先纯领域与私有工具，再消费者 UI，再世界地图，再全量内容；
9. 视觉与功能同时验收，不把“编译通过”当作产品完成；
10. 不在 V3 Gate 前进入正式公开导出或部署。

## 3. Batch 0 — 权威重置与 V3 顶层设计

### 范围

- 新增 `docs/19–22`；
- 更新 `AGENTS.md` 权威顺序与执行边界；
- 更新 README / docs/02 / 03 / 07 / 08 / 09 / 10 / 11 / 12 / 17 / 18 的状态与冲突说明；
- 明确 Release-B 暂停；
- 不改产品代码、快照或私有 policy。

### Gate

- 产品定义、标签语义、小径、岔路、地图层级、public/local/studio、视觉方向与实施顺序自洽；
- 旧“禁用逐条标签 / embedding”的文档不再误导新实现；
- Markdown 链接、尾随空白与工作区状态干净；
- public snapshot 保持空。

## 4. Batch 1 — 私有 embedding 基础与厂商评测

### 4.1 基础设施

- provider-neutral TypeScript 接口；
- 环境变量凭证，拒绝 `VITE_*`；
- 批量、限流、失败续跑与文本 hash 缓存；
- `.private/embeddings/manifest.json` 与向量文件；
- 模型、维度、输入规范、成本与 snapshot hash；
- 终端只输出数量、耗时、成本与错误类别。

### 4.2 真实评测集

约 300 条，覆盖：

- 文学；
- 投资、概率与决策；
- 哲学与自我；
- 政治、制度与社会；
- 技术与管理；
- 短 / 中 / 长；
- 跨书明确相关、近义边界与关键词伪相关。

候选优先免费或极低成本；达到“够用”即停止，不追求极致。

### 4.3 Gate

- 至少两种候选在同一真实评测集可比较；
- 选出一个默认模型与一个可选回退，或诚实报告没有候选够用；
- 凭证、向量和真实报告不进 Git / public；
- public network 仍为 0 外部模型请求；
- 更新 docs/08 并 commit。

需要用户动作时只要求在本机设置明确环境变量，不要求粘贴密钥到会话。

## 5. Batch 2 — 标签发现与词表 Gate

### 5.1 多样性样本

- 用 embedding + 书籍配额选择 250–300 条；
- 防止高划线书支配样本；
- 输出只在 `.private` 的样本集与覆盖摘要。

### 5.2 标签词表

实现 Agent 完成：

- 开放式归纳；
- 同义合并；
- 中等抽象度检查；
- 定义 / includes / excludes / aliases；
- 约 30–60 个候选；
- 标签种子与边界案例；
- 概念家族（仅内部）。

### 5.3 用户 Gate

用户审核：

- 名称与定义；
- 相邻标签边界；
- 缺失主题；
- 过宽 / 过细标签；
- 是否允许进入试标。

不要求用户逐条审核 300 条。

## 6. Batch 3 — Local Tag Studio 与 250–300 条试标

### 6.1 领域与私有契约

- strict tag vocabulary parser；
- highlight assignment parser；
- 1–3 个平等标签；
- stable tag ID；
- draft / reviewed / publish；
- confidence / rationale / candidate 只在私有层。

### 6.2 Studio

- 批次列表与完整原文；
- 候选标签、定义与边界；
- 接受 / 修改 / 清除；
- 低信心、离群、近义和漏标筛选；
- 标签合并 / 改名迁移；
- 按书、标签、ID、文本搜索；
- 原子保存、严格同源与本机端口；
- 普通 dev / public build 不存在接口。

### 6.3 试标与 Gate

- 250–300 条真实划线完成标注；
- 人工抽查与 embedding 一致性报告；
- 每标签书籍数、划线数、离群和多标签比例；
- 实现 Agent 负责逐条与低信心复核；用户只审核真正的词表命名、合并与产品边界，不承担内容生产劳动；
- 不修改 public snapshot。

Batch 3 最终实况（2026-09-19）：56 / 56 标签覆盖，0 孤儿、0 过宽；唯一试标偏薄的「运气」有全语料 64 条 / 23 本证据并保留；6 条无法归类内容保持 draft。详见 `docs/25-BATCH-3-TAG-STUDIO.md`。

## 7. Batch 4 — schema 3、主题小径与视觉基础

### 7.1 schema 3

- 新增 TopicTag 与 Highlight.tagIds；
- Book Theme 保留；
- local builder 应用 reviewed assignments；
- public 空快照同步升级但仍为空；
- strict validator、ID 稳定与防泄漏回归；
- 未标注内容在试点阶段的明确行为，不造标签。

### 7.2 小径领域算法

- 路径候选索引；
- 按书公平、首轮不重复、显式重开；
- 岔路保持当前句；
- embedding 关闭 / 开启两套可测路径；
- 语义近 / 中 / 远节奏只在选中书内；
- 真实试点可达性证明。

### 7.3 路由与 UI

- `/paths`；
- `/paths/:tagId`；
- 主导航新增主题小径；
- 门厅、主题房间、书房显示全部线索；
- 岔路状态、Back / refresh / focus / scroll memory；
- 分享卡片与复制文本显示全部标签。

### 7.4 视觉基础

先重构真实关键页面：

- 门厅；
- 小径列表；
- 小径房间；
- 岔路；
- 分享卡片。

建立 V3 tokens 和排版 / 控制层级，随后再扩展到其他房间。

### 7.5 Gate

- 真实试点内容完整可用；
- 纯公平与 embedding 节奏可对比；
- 1440 / 390 / 320、200%、键盘、reduced-motion；
- 1 / 2 / 3 标签与 398 字长文无裁剪；
- 用户体验小径与视觉原型后决定是否扩全量。

### 7.6 实际完成（2026-09-19）

- schema 3 local：4,663 条 / 130 本 / 14 Book Theme / 56 Topic Tag；294 条 reviewed 投影，4,369 条明确未标注；
- 294 条 reviewed 项导出 16 维量化路径投影，原始 1024 维向量仍在 `.private`；
- 56 条真实小径在纯公平 / semantic 两种模式下均全量可达；
- `/paths`、`/paths/:tagId`、五项导航、每路径 session、岔路保持当前句与 Back 恢复完成；
- 门厅、主题房间、书房显示全部 reviewed 线索；分享复制和卡片显示全部标签；
- 1440 / 390 / 320、200% 等价 reflow、键盘、reduced-motion、最长 reviewed 文本有浏览器证据；
- public snapshot 升级 schema 3 但仍为空；无 public export、repo、push 或部署。

完整实况见 `docs/26-BATCH-4-PATHS-AND-VISUAL.md`。

## 8. Batch 5 — 世界地图 MVP

### 8.1 私有布局管线

- 固定 seed 降维；
- 布局 manifest 与版本；
- point / label / density / contour 数据；
- public / local 独立投影；
- 模型或参数变化显式重建；
- 地图坐标导出不携带原始向量。

### 8.2 地图房间

- `/map`；
- Level 1 世界总览；
- Level 2 主题区域；
- Level 3 划线详情；
- 小径列表替代；
- 位置、缩放与 Back 恢复；
- Canvas / 低 DOM；
- 移动端主动打开；
- reduced-motion 直接到位。

### 8.3 点亮一本书

- 从书房进入地图；
- 地图内选择书；
- Book Aura 点亮该书全部点；
- 其他点降权；
- 显示涉及小径；
- 无蜘蛛网连线。

### 8.4 视觉 Gate

- 世界总览作为作品成立；
- 可操作性不破坏审美；
- 1440 / 390、Book Aura 至少 6 本；
- 标签避让、点密度、等高线、区域放大；
- 性能、键盘替代、200%、reduced-motion；
- 用户确认地图后才进入全量标注。

### 8.5 实际完成（2026-09-19）

- 地图专属 96 维稀疏投影 + 固定 seed UMAP 已覆盖全部 4,663 条真实划线，量化为 0–10,000 坐标；没有复用 16 维小径投影；
- local snapshot 携带 4,663 点、56 个 reviewed 标签中心、64×40 密度网格与 624 条三层等高线段；私有 manifest 保留模型、参数和 hash；
- `/map?tag=…&book=…&h=…` 完成世界总览、主题区域、划线详情与 Book Aura；只在主题区域或点亮书时开放点命中；
- 单一 Canvas 绘制全量地形，DOM 不随 4,663 点增长；主题列表和当前区域划线列表提供完整键盘 / 屏幕阅读器替代；
- 世界 / 各主题 viewport 独立记忆，Browser Back 恢复缩放、位置、当前区域与详情；移动端详情移到 Canvas 下方；
- 1440 / 390 / 320、200% 等价 reflow、键盘平移缩放、reduced-motion、三标签详情与至少 6 本真实 Book Aura 已有浏览器证据；
- public snapshot 继续为空且不含 map；没有 public export、public covers、repo、push、workflow 或部署。

完整实况见 `docs/27-BATCH-5-WORLD-MAP.md`。

### 8.6 Batch 5E 结构性精修与用户 Gate（2026-09-20）

- 用户确认地图已具备雏形、功能体验成立，要求继续打磨到更接近产品级，并授权随后直接进入 Batch 6；
- 增强真实密度、等高线、全量点与标签的视觉层次，标签增加自动避让、轻量引线和纸面底；
- 区域标题加入正式标签定义，多标签点增加克制双环，Book Aura 增加光晕与书籍状态带；
- 滚轮缩放改为围绕指针位置，新增双指缩放，缩放比例与世界 / 区域状态清晰显示；
- 地图详情获得书籍 accent 顶线与克制进入动效，移动端减少首屏控制占高；
- `check:local` 为 295 单测 / 31 文件，local Chromium 115 / 115，视觉取证 3 / 3；用户授权进入 Batch 6。

## 9. Batch 6 — 全量 4,663 条标签生产

每批 200–300 条：

1. embedding 候选；
2. 实现 Agent初标；
3. 自动一致性与离群检查；
4. 低信心 / 新标签 Gate；
5. 更新 local snapshot 与地图；
6. 批次测试、docs/08、commit。

持续报告：

- 已标 / 剩余；
- 平均标签数；
- 单 / 双 / 三标签分布；
- 每标签书籍 / 划线数；
- 过宽、孤岛、近义与离群；
- stable ID 与原文不变。

不得为满足覆盖强行使用空泛标签；必要时回到词表 Gate。

### 9.1 Batch 6 管线与收口实况（2026-09-20）

- baseline 外 4,363 条已按稳定 ID 分成 18 批，生成 top-10 embedding ensemble 候选；
- 本机 `Xenova/bge-reranker-base@280bcc2-q8` 已完成 294 条试点评测与全量候选打分；独立 top-1 仅 52.0%，因此只作第二模型否决，不作分类器；
- embedding high primary 位于 reranker 前二时，试点 top-1 为 94.4%；双模型初筛为 1,171 reviewed / 3,492 draft；
- 一次自动 reviewed 自训练 refinement 因政治史文本系统性泛化而回滚，不进入当前结果；
- 累计 688 条全文 override 已处理高风险确认、错误修正、多标签边界与多轮最强 draft 晋升；最终为 1,694 reviewed / 2,969 draft；
- 自动 high-risk 为 0，thin / broad 为 0 / 0；低信心、否定语境、词面偶合和词表无法稳定概括的内容继续保留 draft；
- local snapshot 已消费最终 assignments：1,694 条 reviewed 导出 16 维路径投影，其余 2,969 条只作为全量可达内容和未命名地图地形；
- 最终地图已按固定 seed 重建：4,663 点 / 56 标签中心 / 624 条等高线段，layout hash `567534bf71bfc5f6266ceb8ecd26267c4399888d87a1d606fed784a03d9fcd9e`；
- `check:local`、300 单测 / 32 文件、Tag Studio 10 / 10、消费者 Chromium 18 / 18、真实截图均通过；Batch 6 内容质量 Gate 已关闭。

完整实况见 `docs/28-BATCH-6-FULL-TAGGING.md`。

## 10. Batch 7 — V3 全产品统一与公开标签审核

### 10.1 视觉统一

- 主题书架、主题房间、所有书、书房、About；
- 地图、路径与原房间共享纸 / 墨 / 光系统；
- 移除遗留的通用列表 / pill / 间距不一致；
- 分享卡片 V3 全标签最终版。

### 10.2 内容审核

- 用户审核正式标签词表；
- 低信心与随机抽样；
- public 3,462 条上的 tag 投影；
- 地图标签、计数与排除泄漏；
- share card 标签换行与文案。

### 10.3 完整 Gate

- unit / integration / local E2E / reviewer E2E / public empty-state；
- 全量可达与路径公平；
- map 性能、DOM、内存与缩放；
- 320 / 360 / 390 / 768 / 1440；
- 真实 200%、键盘、reduced-motion；
- public build / isolation；
- Safari / 真机不可用则继续未验证。

## 11. Batch 8 — 恢复 Release-B～E

只有用户在 V3 Gate 后明确批准才执行：

- schema 3 正式 public snapshot；
- public cover 缩略图；
- public tag 与 map layout；
- 反向泄漏 / Git 历史扫描；
- Pages base、静态入口、404 与 workflow；
- 首次访客、真机与 Safari；
- repo / push / deployment 仍需单独授权。

## 12. 用户参与点

后续常规施工不反复询问。只在以下 Gate 邀请用户判断：

1. Batch 0：V3 产品与视觉方向；
2. Batch 1：embedding 候选没有明显够用结果或数据政策需取舍；当前默认已迁移到本机推理，未经新许可不再启用远程 provider；
3. Batch 2：第一版标签词表；
4. Batch 4：小径与视觉真实原型；
5. Batch 5：世界地图；
6. Batch 7：最终标签与公开 V3 范围；
7. Batch 8：正式导出与部署授权。

## 13. 每 Batch 交付格式

```text
Batch / 内部阶段：
完成范围：
主要修改文件：
真实数据与私有产物：
实际命令及结果：
浏览器证据与视口：
视觉 / 内容 Gate：
公开隔离状态：
未验证项：
偏差与设计判断：
下一阶段：
本地 commit：
```

## 14. Batch 0 完成后下一步

Batch 0 只建立权威，不自动开始 Batch 1。汇报并确认文档 Gate 后，再进入私有 embedding 基础与厂商评测；Batch 1 开工前完整阅读 `docs/09` 与项目内 weread skill，重跑当前工程基线。
