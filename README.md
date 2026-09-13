# Henry's Reading World

一个可以随便抽一句、按主题书架或按书闲逛的个人阅读空间。

## 当前状态

- 阶段：v1 的 **Slice 0–4**、**V2-A**（schema 2、全量 4,663 条 / 130 本 / 14 个书架）、**V2-B**（两阶段公平发现引擎）、**V2-C1**（房间路由与现场记忆）、**V2-D**（全量分批浏览）与 **V2-C2**（Book Aura 与呼吸动效）均已完成。下一步只剩 V2-E（分享、深链与最终无障碍）。
- 产品方向：`PRODUCT_BRIEF.md` 是历史基线；轻松漫游与公平原则见 `docs/10-PRODUCT-DIRECTION-V2.md`，最新房间/色彩/动效决定见 `docs/12-ROOMS-COLOR-MOTION-DIRECTION.md`，施工路线见 `docs/11-V2-IMPLEMENTATION-PLAN.md`。
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
npm run test:e2e            # Playwright，真实 Chromium，24 个用例
npm run capture:review      # 生成评审截图 + 可读数字，输出到 .private/review/critique-1/
npm run covers:fetch        # 下载真实书封到 .private/covers/（只由 dev:local 服务）
npm run smoke:local         # 用真实快照做渲染冒烟检查
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

1. `/` 门厅：读一句话 → `再来一句`；底部可去主题书架、所有书或 About。
2. 点书名（出处行）→ 原位展开面板 → `再看一处`（同书）→ `查看这本书` 进入书籍房间。
3. `/themes` 主题书架 → 某个书架房间：`再来一句` 持续留在该书架。
4. `/books` 所有书：初始 12 本、每次 +20，可按真实年份或书架筛选；点书进入 `/books/:id`，初始 10 处、每次 +20。
5. 浏览器返回与 `返回上一处` 一致；回到房间时恢复原句、筛选、批次与滚动位置。

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
| [14 — 连续房间开发 Prompt](docs/14-ROOMS-CONTINUOUS-IMPLEMENTER-PROMPT.md) | 下一批连续完成 V2-C1 → V2-D → V2-C2 的完整提示词 |

## 真实数据现状

- 笔记本概览全部分页：132 本有笔记的书；已抓取 130 本划线，共约 4,700 行（`.private/weread/highlights/`）。
- 候选池：4,663 条（去重、长度 8–400 字）；其中短 1,054 / 中 2,626 / 长 983。
- v2 快照：**4,663 条划线 · 130 本书 · 14 个主题书架**，127 本有本地封面。
- 每本书的 1–3 个书架标签由 Agent 依据书名、作者与等距样本一次性生成（`.private/curation/book-themes.json`），未使用 embedding 或逐句分类。
- **已知数据缺口（真实情况，未用假数据补齐）**：Henry 的真实划线中没有带原始换行的样本；年份只跨 2024–2026，无法呈现"来自 4 年前"这类更长的时间纵深。校验器会持续报告前者。

## 两个不同的完成标准

1. **工程原型可评审**：真实划线在本机可用，工程检查与浏览器验证通过。（Slice 0–4 与 V2-A 已达成）
2. **Prototype Gate 通过**：需要 Henry 确认可对评审访客展示的内容范围，并完成真实访客体验评审。

不要因为第 1 项完成就声称第 2 项成立。本机许可不等于公开发布许可；上传与部署尚未授权。
