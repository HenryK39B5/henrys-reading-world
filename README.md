# Henry's Reading World

一个可以随便抽一句、按主题书架或按书闲逛的个人阅读空间。

## 当前状态

- 阶段：v1 Slice 0–4、V2-A～V2-E4D 均已完成；**Release-A（V2-E4E → 有限随机书籍轮 → 发布清单与本机审核器 → 私有 preview 与隔离 Gate）已实现并验收**。
- 发布审核：用户已完成两轮审核，私有清单当前为 **108 本公开 / 22 本排除 / 6 条单独排除**，`reviewComplete=true`；下一阶段才讨论 Release-B（正式 public snapshot 与封面缩略图）、Release-C（Pages base/静态入口/workflow）与部署。未生成 public snapshot、未创建 GitHub repo、未 push。
- 产品方向：轻松漫游与公平原则见 `docs/10`，房间/Book Aura 见 `docs/12`；公开审核、随机书籍房间和 GitHub Pages 目标以 `docs/17-PUBLICATION-DIRECTION-AND-RELEASE-A.md` 为最新权威；下一批唯一实现 Prompt 为 `docs/18-RELEASE-A-PUBLICATION-REVIEW-IMPLEMENTER-PROMPT.md`。
- 硬约束：所有开发只使用 Henry 本人的真实划线，不使用 fake / demo 数据；主题属于书籍，不做逐句人格标签。
- 当前页面数据（local-only）：**4,663 条真实划线 · 130 本书 · 14 个主题书架 · 2024–2026**；房间一次只渲染一个视觉中心，全部内容通过舞台、主题书架与单书房间分批可达。
- 原始数据与快照只存在于本机 `.private/`，已被 `.gitignore` 排除，不进入前端包。
- 公开快照 `src/data/public-snapshot.json` 仍为空 → 当前页面在本机显示真实内容，公开发布仍待审核。

## 快速开始

```powershell
npm ci                      # 首次：按锁文件安装依赖（已安装过则跳过）
npm run snapshot:local      # 由已抓取的原始数据生成 .private/local-snapshot.json（schema 2，全量）
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
npm run test:e2e            # Playwright，真实 Chromium，104 个用例（房间、随机书籍轮、深链、分享与卡片、滚动锁、缩放、键盘、错误、隐私）
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

房间与真实 URL（`docs/12 §2–3`）：

1. `/` 门厅：读一句话 → `再来一句` → `分享`；底部可去主题书架、所有书或 About。
2. 点书名（出处行）→ 原位展开面板 → `再看一处`（同书）→ `查看这本书` 进入书籍房间。
3. `/themes` 主题书架 → 某个书架房间：`再来一句` 持续留在该书架。
4. `/books` 所有书：初始 12 本、每次 +20，可按真实年份或书架筛选；点书进入 `/books/:id`——书籍房间不再展开列表，而是**一次一句的有限随机轮**：`本轮已看 X / N`，首轮每条恰好一次、0 重复，看完后提示并等你点 `重新看一轮`。
5. 浏览器返回与 `返回上一处` 一致；回到房间时恢复原句、筛选、批次与滚动位置。
6. 分享：`分享` 打开 dialog，锁定当时那一条的稳定 ID（换句不会改变它）；可复制原文与本机链接（剪贴板被拒时提供可全选的替代文本），并预览一张**属于这本书的卡片**：卡面是由该书真实封面 accent 派生的低饱和深色，暖米白正文，双细框，页脚分为两层——先《书名》与作者，再由一条细线隔开站点署名与本机徽标；短/中句约 4:5，299/398 字自然增高并提示“长文预览已延长比例”，不裁剪、不缩字。复制出的纯文本同样是两层：原文与出处之后空一行，再接“来自 Henry's Reading World”。

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
- 不能外发的只有凭证：`WEREAD_API_KEY`、账号标识、原始回包中的个人字段。
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
| [18 — Release-A 实现 Prompt](docs/18-RELEASE-A-PUBLICATION-REVIEW-IMPLEMENTER-PROMPT.md) | 下一批唯一入口：V2-E4E → 随机书籍房间 → 本机发布审核器 → 私有 preview Gate |

## 真实数据现状

- 笔记本概览全部分页：132 本有笔记的书；已抓取 130 本划线，共约 4,700 行（`.private/weread/highlights/`）。
- 候选池：4,663 条（去重、长度 8–400 字）；其中短 1,054 / 中 2,626 / 长 983。
- v2 快照：**4,663 条划线 · 130 本书 · 14 个主题书架**，127 本有本地封面。
- 每本书的 1–3 个书架标签由 Agent 依据书名、作者与等距样本一次性生成（`.private/curation/book-themes.json`），未使用 embedding 或逐句分类。
- **已知数据缺口（真实情况，未用假数据补齐）**：Henry 的真实划线中没有带原始换行的样本；年份只跨 2024–2026，无法呈现"来自 4 年前"这类更长的时间纵深。校验器会持续报告前者。

## 两个不同的完成标准

1. **工程原型可评审**：真实划线在本机可用，工程检查与浏览器验证通过。（Slice 0–4 与 V2-A～V2-E4 已达成）
2. **Prototype Gate 通过**：需要 Henry 确认可对评审访客展示的内容范围，并完成真实访客体验评审。

不要因为第 1 项完成就声称第 2 项成立。本机许可不等于公开发布许可；上传与部署尚未授权。
