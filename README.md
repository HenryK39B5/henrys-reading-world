# Henry's Reading World

一个可以随便抽一句、按主题书架、主题小径或按书闲逛的个人阅读空间。

## 当前状态

- 阶段：v1 Slice 0–4、V2-A～V2-E4D、Release-A、V3 Batch 0–6 均已完成；**schema 3、56 条真实主题小径与 4,663 点阅读世界地图已进入 Local World**。Batch 6 最终 assignments 为 **1,694 reviewed / 2,969 draft**；累计 688 条全文 override 已应用，自动 reviewed 高风险为 0。消费者 snapshot、路径投影和最终地图均已重建；地图已完成渐进展开、移动端重排、独立导航入口、滚轮隔离与书籍选择器精修；产品与艺术指导审阅见 `docs/30-GPT6-ASTRA-DESIGN-REVIEW.md`；「可漫游的私人图集」施工计划见 `docs/31-V3-PRIVATE-ATLAS-VISUAL-OPTIMIZATION-PLAN.md`，Batch 7A 阅读版心与界面减法的工程实现记录于 `docs/32-BATCH-7A-PRIVATE-ATLAS-READING-SURFACES.md`；用户认为视觉尚不惊艳，7A视觉Gate未通过，原7B–7C计划暂停。已完成同数据颠覆性方向探索（`docs/33-V3-READING-WORLD-RADICAL-DIRECTION-STUDY.md`），用户选定跨页关系；同版式配色证据见 `docs/34-V3-CROSS-PAGE-PALETTE-STUDY.md`；用户认为深图浅文手机断层，已授权全深色可交互样板（`docs/35-V3-DARK-CROSS-PAGE-INTERACTIVE-PROTOTYPE.md`）。地图/阅读局部全深样板已完成（`docs/36-V3-DARK-CROSS-PAGE-PROTOTYPE-RESULT.md`），亮书选书弹层的精修与下一轮地图构图/全站深色方向见 `docs/37-V3-MAP-IMPACT-AND-DARK-SYSTEM-DIRECTION.md`，**独立视觉Gate仍未通过**；其他房间仍保留7A浅色，这是局部样板范围而非最终深图浅文方案，原7B–7C暂停，未获公开发布许可。
- 发布审核：用户已完成两轮审核，私有清单当前为 **108 本公开 / 22 本排除 / 6 条单独排除**，`reviewComplete=true`。这些决定继续有效，但 Release-B 暂停到 V3 Gate 之后；未生成 public snapshot、未创建 GitHub repo、未 push。
- 产品方向：`docs/19-PRODUCT-DIRECTION-V3.md`；标签 / 小径 / 地图规格：`docs/20-TAGS-PATHS-MAP-SPEC.md`；视觉：`docs/21-V3-VISUAL-DIRECTION.md`；施工：`docs/22-V3-IMPLEMENTATION-PLAN.md`；embedding 实际评测：`docs/23-EMBEDDING-EVALUATION.md`；Batch 2 标签发现：`docs/24-BATCH-2-TAG-DISCOVERY.md`；Batch 3 试标与 Studio：`docs/25-BATCH-3-TAG-STUDIO.md`；Batch 4 小径与视觉实况：`docs/26-BATCH-4-PATHS-AND-VISUAL.md`；Batch 5 世界地图实况：`docs/27-BATCH-5-WORLD-MAP.md`；Batch 6 全量标签实况：`docs/28-BATCH-6-FULL-TAGGING.md`；Batch 7A 私人图集阅读面实况：`docs/32-BATCH-7A-PRIVATE-ATLAS-READING-SURFACES.md`；颠覆性方向探索：`docs/33-V3-READING-WORLD-RADICAL-DIRECTION-STUDY.md`；跨页配色对照：`docs/34-V3-CROSS-PAGE-PALETTE-STUDY.md`；全深交互样板边界：`docs/35-V3-DARK-CROSS-PAGE-INTERACTIVE-PROTOTYPE.md`；实况：`docs/36-V3-DARK-CROSS-PAGE-PROTOTYPE-RESULT.md`；视觉冲击与全站配色方向：`docs/37-V3-MAP-IMPACT-AND-DARK-SYSTEM-DIRECTION.md`。
- 硬约束：所有开发只使用 Henry 本人的真实微信读书划线，不使用 fake / demo 数据；Book Theme 属于书籍，V3 Topic Tag 属于划线，但不做人格标签、质量评分或 AI 观点总结。
- 当前页面数据（local-only）：**4,663 条真实划线 · 130 本书 · 14 个主题书架 · 56 个 Topic Tag · 2024–2026**；1,694 条 reviewed 划线可沿小径与命名地图区域访问，其余 2,969 条继续通过原房间全量可达并只形成未命名地形。
- 原始数据与快照只存在于本机 `.private/`，已被 `.gitignore` 排除，不进入前端包。
- 公开快照 `src/data/public-snapshot.json` 仍为空 → 当前页面在本机显示真实内容；新增标签、地图与视觉 Gate 完成前不正式导出。

## 快速开始

```powershell
npm ci                      # 首次：按锁文件安装依赖（已安装过则跳过）
npm run map:layout          # 从本机 embedding 重建固定 seed 地图布局
npm run snapshot:local      # 生成 schema 3 local snapshot：全量内容 + reviewed 标签试点 + 地图
npm run dev:local           # 打开 http://127.0.0.1:5173
```

重建数据管线（仅在需要重新生成 ID / 主题 / 快照时）：

```powershell
npm run idmap:v2            # 稳定 ID 映射（保留已发布 ID，只追加）
npm run dossiers:v2         # 每本书的等距样本 dossier（供书架分类）
npm run verify:ids          # 校验已发布 ID 仍指向同一条真实划线
npm run snapshot:local      # 生成全量 local-only 快照
```

`dev:local` 是**唯一能看到真实划线的开发模式**：它读取 `.private/local-snapshot.json`，并在页面顶部标出“仅本机 · 未公开审核”。

常用命令：

```powershell
npm run check:local         # typecheck + lint + 单测 + 快照校验（开发主校验）
npm run verify:ids          # 20 本 / 46 条稳定 ID 指向同一真实材料
npm run test:e2e            # Playwright，真实 Chromium：房间、小径、岔路、分享、缩放、键盘与隐私
npm run capture:v3-batch4  # Batch 4 的 1440 / 390 / 320、最长文、三岔路与 reduced-motion 证据
npm run capture:v3-batch5  # Batch 5 世界 / 区域 / 详情 / 6 本 Book Aura / reduced-motion 证据
npm run test:publication    # 发布审核器的浏览器验收（独立服务器与端口，使用临时清单目录）
npm run capture:review      # 生成评审截图 + 可读数字，输出到 .private/review/rooms-batch/
npm run capture:v2e         # 生成 V2-E 证据截图（dialog、卡片、200% 缩放、剪贴板失败），输出到 .private/review/v2-e/
npm run capture:v2e4        # 生成 V2-E4 卡片证据（整张卡片、三本书的色域、200%、剪贴板失败），输出到 .private/review/v2e4/
npm run capture:release-a   # Release-A 证据：书轮与复制文本（产品）+ 审核器五个状态，输出到 .private/review/release-a/
npm run isolation:public    # 对 dist 做反向泄漏探针（审核器、policy、真实内容、凭证）
npm run publication:init       # 生成私有发布清单（全部未审核；已存在时不覆盖）
npm run publication:review     # 本机逐书审核界面（127.0.0.1:5174，不进入生产包）
npm run publication:preview    # 只写 .private/ 的私有投影与 audit
npm run covers:fetch        # 下载真实书封到 .private/covers/（只由 dev:local 服务）
npm run smoke:local         # 用真实快照做渲染冒烟检查
npm run test:public         # 公开（空快照）模式下每个房间的诚实空状态
```

V3 私有 embedding 评测（全部产物只写 `.private/embeddings/`）：

```powershell
npm run embeddings:prepare   # 300 条真实评测集：130 本 / 14 书架 / 短中长覆盖
npm run embeddings:baseline  # 非语义字符 hash 下限；不能冒充候选模型
npm run embeddings:evaluate -- --provider local
npm run embeddings:evaluate -- --provider siliconflow --model BAAI/bge-m3 --dimensions 1024
npm run embeddings:compare
npm run embeddings:neighbours -- --provider local
npm run embeddings:generate -- --provider local
npm run tags:sample          # 300 条按书公平、多样性发现样本
npm run tags:clusters        # 私有语义簇辅助报告，不等于正式标签
npm run tags:seeds           # 候选标签的跨书种子与边界候选
npm run tags:audit           # 词表、人工种子与用户 Gate 审计
```

V3 标签试标与本机 Studio（产品构建里不存在这些接口）：

```powershell
npm run tags:promote         # 56 个候选标签 → 稳定 tag-001…tag-056
npm run tags:trial:generate  # 300 条试标候选（embedding 集成打分）
npm run tags:trial:review    # 逐条全文复核：接受 / 依词面证据修正 / 保留 draft
npm run tags:trial:audit     # 覆盖、多标签比例、一致性、偏薄标签与待复核清单
npm run tags:full:generate   # baseline 外 4,363 条，固定 18 批 top-10 候选
npm run tags:full:reranker:evaluate # 在 294 条试点上评测本机 reranker
npm run tags:full:rerank     # 本机完整划线 × 标签定义交叉编码；可续跑
npm run tags:full:review     # 双模型保守升级；不为覆盖率强贴标签
npm run tags:full:override   # 应用本机全文审计 override；明确误配降回 draft
npm run tags:full:audit      # 全文风险队列、标签分布与 draft 边界
npm run tags:review-queue    # 生成 review-queue.generated.md，绝不覆盖用户填写版
npm run tags:review-import   # 只读导入用户已填写的少量意见，不覆盖 Markdown
npm run tags:review-apply    # 仅应用完全落在现有词表内的明确决定
npm run tags:studio          # 本机 Studio：127.0.0.1:5175，完整原文与原子保存
npm run test:tags            # Studio 浏览器验收（写到 .private/review/batch-3/ 副本）
npm run tags:migrate -- --merge tag-031 --into tag-030 --yes   # 合并标签
npm run tags:migrate -- --rename tag-004 --title 运气与偶然 --yes  # 改名，保留稳定 ID
```

私有字段 `rationale`、`candidates`、`confidence`、`flags` 只用于本机内容生产，不进入任何快照。

当前默认 embedding 为本机 `Xenova/bge-large-zh-v1.5@a48549b-q8-cls`，无需 API key，4,663 条已全部在本机生成。SiliconFlow / Voyage / Cohere / OpenAI adapter 只保留为历史评测能力；未经用户新的明确许可，不得重新把远程 provider 设为默认或发送新的划线文本。结果与边界见 `docs/23`。

公开路径（当前只用于验证构建，不展示真实内容）：

```powershell
npm run dev                 # 只读取 src/data/public-snapshot.json（当前为空 → 显示真实空状态）
npm run build               # 公开构建；local 模式会被直接报错拒绝
npm run preview
```

只读取数（仅当需要新数据时，需要环境变量 `WEREAD_API_KEY`；跑页面不需要它）：

```powershell
./scripts/weread-request.ps1 -ApiName '/book/bookmarklist' -Parameters @{ bookId = '<id>' } -OutputName 'highlights/xxx.json'
./scripts/weread-fetch-highlights.ps1 -BuildPlan
npm run pool -- --books 24 --per-book 8   # 生成候选池与人工挑选短名单
npm run snapshot:local                    # 挑选结果 → 开发快照
```

`dev:local` 使用 Vite 模式名 `local-private`（Vite 保留 `local` 用于 `.env` 后缀，不能作为模式名）。端口固定 5173 且 `strictPort`，被占用时会直接失败而不是换端口。

### 当前体验路径

当前代码已进入 V3 Batch 5；真实 URL 与主要循环：

1. `/` 门厅：读一句话 → `再来一句` → `分享`；底部可去主题书架、主题小径、所有书或 About。
2. 点书名（出处行）→ 原位展开面板 → `再看一处`（同书）→ `查看这本书` 进入书籍房间。
3. `/themes` 主题书架 → 某个书架房间：`再来一句` 持续留在该书架。
4. `/paths` 主题小径：56 个稳定线索按 editorial order 展示真实书数 / 划线数；进入 `/paths/:tagId` 后按书公平完成有限轮，可切换“纯公平 / 有呼吸”。
5. 多标签划线是岔路：点击另一线索时当前句保留，下一次继续才离开；浏览器 Back 恢复原路径、原句与轮次。
6. `/map` 阅读世界地图：单一 Canvas 绘制全部 4,663 个真实点与等高线；点击标签进入主题区域，区域列表可打开完整划线详情；`点亮一本书` 用真实 Book Aura 标出该书全部点。URL 的 `tag` / `book` / `h` 保存语义现场，Browser Back 恢复原位置与缩放。
7. `/books` 所有书：初始 12 本、每次 +20，可按真实年份或书架筛选；点书进入 `/books/:id`——书籍房间是一次一句的有限随机轮，并可直接在地图点亮这本书。
8. 浏览器返回与 `返回上一处` 一致；回到房间时恢复原句、筛选、批次与滚动位置。
9. 分享锁定稳定 highlight ID；页面、复制文字和卡片完整显示该条全部 Topic Tag，不截断为 `+N`。

### 公开发布审核（Release-A，尚未公开）

发布审核在**本机**完成，不在网站里，也不需要 `WEREAD_API_KEY`：

```powershell
npm run publication:init       # 生成 .private/curation/publication-policy.json（全部未审核）
npm run publication:review     # 在 http://127.0.0.1:5174/publication-review.html 逐书审核
npm run publication:preview    # 只写 .private/ 的私有投影与 audit，不碰 src/data/public-snapshot.json
npm run test:publication       # 审核器的浏览器验收（用临时目录，不碰你真实清单）
```

规则：**未审核 = 不公开**；书是主要单位（公开/排除），公开书可单独排除个别划线；封面默认公开但可逐书关闭；130 本必须先全部做出决定才能标记“审核完成”。当前审核已完成（108 / 22 / 6）。随机书籍房间改善的是浏览体验，**不减少实际发布的文字量**——版权与隐私按真正进入投影的全部内容计算。

外部导入文件若带有 `.epub`、来源后缀或错误作者，可在 `.private/curation/book-metadata-overrides.json` 用稳定项目 book ID 做用户批准的标题/作者修正；原始采集记录保持不变，备注不会进入快照。

稳定深链 `/?h=<highlightId>` 可直接打开某一条真实划线；刷新、书签、新标签页都指向同一条；从其他房间带 `h` 会被规范化为该房间地址。地址里的划线失效时页面提示 `这条划线暂不可用` 并正常公平开局。

选择器先公平选书、再从该书中选句，不按划线条数加权（`docs/10 §6`）。房间环境色来自当前书真实封面：门厅约 5%、主题房间约 4.5%、书籍房间约 10%，书库与 About 保持中性。

## 数据与发布边界

- 开发阶段：真实划线可读取、使用、传输、发给外部模型审阅（用户 2026-09-12 确认）。`.private/` 不入库、不进公开构建，是为了保持“尚未做发布决定”的状态。
- 不能外发的只有凭证：`WEREAD_API_KEY`、embedding API key、账号标识、原始回包中的个人字段。
- 正式公开发布前需讨论公开范围（登记为 PUB-01）。

## 实际版本

| 工具 | 版本 |
| --- | --- |
| Node.js | v24.13.1 |
| npm | 11.8.0 |
| React | ^19.3.0 |
| TypeScript | ^6.0.3 |
| Vite | ^8.3.0 |
| Vitest | ^5.0.0 |
| ESLint | ^10.10.0 |
| @playwright/test | 见 `package-lock.json` |

## 文档索引

| 文档 | 解决什么问题 |
| --- | --- |
| [PRODUCT_BRIEF.md](PRODUCT_BRIEF.md) | 产品目标、原则、原型边界 |
| [AGENTS.md](AGENTS.md) | 所有实现 Agent 的工作规则 |
| [01 — 范围与决策](docs/01-SCOPE-AND-DECISIONS.md) | 本轮做什么、不做什么 |
| [02 — 技术与工程](docs/02-TECHNICAL-DESIGN.md) | 栈、模块、状态、URL、工程约定 |
| [03 — 数据契约](docs/03-DATA-CONTRACT.md) | 公开数据、校验、内容准备 |
| [04 — 偶遇算法](docs/04-SERENDIPITY-SPEC.md) | 选句与降级规则 |
| [05 — 界面与交互](docs/05-UX-SPEC.md) | 响应式、切换、出处、探索、分享、无障碍 |
| [06 — 任务与验收](docs/06-IMPLEMENTATION-PLAN.md) | Slice 0–5、完成标准、测试矩阵 |
| [07 — 模型交接](docs/07-IMPLEMENTATION-HANDOFF.md) | 开始施工、续接、回报模板、模型分工 |
| [08 — Review 记录](docs/08-REVIEW-CHECKLIST.md) | 执行记录与 Prototype Gate 检查 |
| [09 — 微信读书流程](docs/09-WEREAD-DATA-WORKFLOW.md) | skill 移植、真实数据获取与发布边界 |
| [10 — Product Direction v2](docs/10-PRODUCT-DIRECTION-V2.md) | Critique #1 后的最新产品目标、主题语义与公平漫游原则 |
| [11 — v2 施工计划](docs/11-V2-IMPLEMENTATION-PLAN.md) | schema 2、公平算法、房间路由、色彩动效与分片验收 |
| [12 — 房间、色彩与呼吸感](docs/12-ROOMS-COLOR-MOTION-DIRECTION.md) | Critique #2 后的空间结构、Book Aura、导航记忆与动效语言 |
| [13 — V2-B 开工 Prompt](docs/13-V2-B-IMPLEMENTER-PROMPT.md) | 已执行的 V2-B 历史实现提示词 |
| [14 — 连续房间开发 Prompt](docs/14-ROOMS-CONTINUOUS-IMPLEMENTER-PROMPT.md) | 已执行的 V2-C1 → V2-D → V2-C2 历史提示词 |
| [15 — V2-E 最终收尾 Prompt](docs/15-V2-E-CONTINUOUS-IMPLEMENTER-PROMPT.md) | 已执行的 V2-E1 → V2-E2 → V2-E3 历史提示词 |
| [16 — V2-E4 分享卡片视觉修订 Prompt](docs/16-V2-E4-SHARE-CARD-VISUAL-IMPLEMENTER-PROMPT.md) | 已执行的 V2-E4A → V2-E4B → V2-E4C 历史提示词 |
| [17 — 公开发布方向与 Release-A](docs/17-PUBLICATION-DIRECTION-AND-RELEASE-A.md) | 书级审批、单条排除、封面开关、有限随机书籍房间、Pages 目标与系统审核流程 |
| [18 — Release-A 实现 Prompt](docs/18-RELEASE-A-PUBLICATION-REVIEW-IMPLEMENTER-PROMPT.md) | 已执行的 Release-A 历史 Prompt |
| [19 — Product Direction V3](docs/19-PRODUCT-DIRECTION-V3.md) | 一个世界、两个数据范围、一个 Studio；房间、小径、地图的顶层产品方向 |
| [20 — 标签、小径与地图规格](docs/20-TAGS-PATHS-MAP-SPEC.md) | Topic Tag、embedding、路径算法、岔路、地图与 schema 3 草案 |
| [21 — V3 视觉方向](docs/21-V3-VISUAL-DIRECTION.md) | 纸、墨、光、地形、Book Aura、分享与视觉 Gate |
| [22 — V3 实施计划](docs/22-V3-IMPLEMENTATION-PLAN.md) | Batch 0–8、用户 Gate、测试与发布恢复顺序 |
| [23 — Embedding 评测](docs/23-EMBEDDING-EVALUATION.md) | 私有 provider 管线、300 条真实评测集、SiliconFlow 历史对照与本机 q8 + CLS 默认 |
| [24 — Batch 2 标签发现](docs/24-BATCH-2-TAG-DISCOVERY.md) | 全量 embedding、按书公平样本、私有候选词表、人工种子与用户 Gate |
| [25 — Batch 3 试标与 Studio](docs/25-BATCH-3-TAG-STUDIO.md) | 56 个稳定标签、私有 assignment 契约、300 条试标、收口审计与 Local Tag Studio |
| [26 — Batch 4 主题小径与视觉基础](docs/26-BATCH-4-PATHS-AND-VISUAL.md) | schema 3、真实试点投影、公平小径、岔路、全标签分享与浏览器证据 |
| [27 — Batch 5 世界地图](docs/27-BATCH-5-WORLD-MAP.md) | 全量固定 seed 地图布局、Canvas 地形、主题区域、详情、Book Aura、恢复与视觉证据 |

## 真实数据现状

- 笔记本概览全部分页：132 本有笔记的书；已抓取 130 本划线，共约 4,700 行（`.private/weread/highlights/`）。
- 候选池：4,663 条（去重、长度 8–400 字）；其中短 1,054 / 中 2,626 / 长 983。
- schema 3 快照：**4,663 条划线 · 130 本书 · 14 个主题书架 · 56 个 Topic Tag**；1,694 条 reviewed 划线带 1–3 个标签与 16 维量化路径投影，2,969 条 draft 内容不造标签；地图为全部 4,663 条提供独立 0–10,000 二维点位、64×40 密度网格与三层等高线。
- 每本书的 1–3 个 Book Theme 由 Agent 依据书名、作者与等距样本生成（`.private/curation/book-themes.json`）；V3 将在不替代 Book Theme 的前提下新增逐条 Topic Tag，并使用私有 embedding 辅助内容生产。
- **已知数据缺口（真实情况，未用假数据补齐）**：Henry 的真实划线中没有带原始换行的样本；年份只跨 2024–2026，无法呈现"来自 4 年前"这类更长的时间纵深。校验器会持续报告前者。

## 两个不同的完成标准

1. **工程原型可评审**：真实划线在本机可用，工程检查与浏览器验证通过。（Slice 0–4 与 V2-A～V2-E4 已达成）
2. **Prototype Gate 通过**：需要 Henry 确认可对评审访客展示的内容范围，并完成真实访客体验评审。

不要因为第 1 项完成就声称第 2 项成立。本机许可不等于公开发布许可；上传与部署尚未授权。
