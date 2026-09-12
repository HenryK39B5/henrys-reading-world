# Henry's Reading World

一个让别人通过你曾经停留过的文字，偶然认识你一点的个人阅读空间。

## 当前状态

- 阶段：第一轮 Experience Prototype。**Slice 0–3 已完成**（真实取数、快照、骨架、隔离、校验、文字舞台、换句手感、策展式序列、出处原位展开）；Slice 4（书籍与主题）尚未开始。
- 产品基线：`PRODUCT_BRIEF.md` v0.1，保持原文不变。
- 硬约束：所有开发只使用 Henry 本人的真实划线，不使用 fake / demo 数据。
- 数据（local-only，未公开审核）：**46 条真实划线 · 20 本书 · 5 个主题 · 3 个年份**。
- 原始数据与快照只存在于本机 `.private/`，已被 `.gitignore` 排除，不进入前端包。
- 公开快照 `src/data/public-snapshot.json` 仍为空 → 当前页面在本机显示真实内容，公开发布仍待审核。

## 快速开始

```powershell
npm ci
npm run snapshot:local      # 由已抓取的原始数据生成 .private/local-snapshot.json
npm run dev:local           # http://127.0.0.1:5173 （仅本机模式，读取私有快照）
npm run check:local         # typecheck + lint + test + 数据校验
npm run test:e2e            # Playwright（真实 Chromium，19 个用例）
```

公开路径（等待公开清单，暂不用于本机预览真实内容）：

```powershell
npm run dev                 # 只读取 src/data/public-snapshot.json（当前为空）
npm run build               # 公开构建；local 模式会被直接拒绝
npm run preview
```

数据工具：

```powershell
./scripts/weread-request.ps1 -ApiName '/book/bookmarklist' -Parameters @{ bookId = '<id>' } -OutputName 'highlights/xxx.json'
npm run pool -- --books 24 --per-book 8   # 生成候选池与人工挑选短名单（.private）
npm run validate:data:local
npm run smoke:local                       # 用真实快照做渲染冒烟检查
```

`dev:local` 使用 Vite 模式名 `local-private`（Vite 保留 `local` 用于 `.env` 后缀，不能作为模式名）。

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

## 真实数据现状

- 笔记本概览全部分页：132 本有笔记的书；已抓取 130 本划线，共约 4,700 行（`.private/weread/highlights/`）。
- 候选池：4,663 条（去重、长度 8–400 字）；其中短 1,054 / 中 2,626 / 长 983。
- 已入选 46 条，来自 20 本书，覆盖 2024–2026。
- **已知数据缺口（真实情况，未用假数据补齐）**：Henry 的真实划线中没有带原始换行的样本；年份只跨 2024–2026，无法呈现"来自 4 年前"这类更长的时间纵深。校验器会持续报告该覆盖警告。

## 两个不同的完成标准

1. **工程原型可评审**：真实划线在本机可用，工程检查与浏览器验证通过。
2. **Prototype Gate 通过**：需要 Henry 确认可对评审访客展示的内容范围，并完成真实访客体验评审。

不要因为第 1 项完成就声称第 2 项成立。本机许可不等于公开发布许可；上传与部署尚未授权。
