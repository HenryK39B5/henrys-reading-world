# 08 — 执行记录与 Prototype Review

## 当前真实状态

| 项目 | 状态 | 说明 |
| --- | --- | --- |
| 产品基线 | 已阅读，未改写 | PRODUCT_BRIEF.md v0.1 |
| 开发文档 | 已准备 | 用户追加“只用真实数据”已纳入 |
| Codex skill 移植 | 完成 | 项目 `.agents/skills/weread-skills/`，原安装未改 |
| skill 版本 | 1.0.4 | 官方更新包已审查，项目约束已重新应用 |
| 只读辅助脚本 | 已建立并执行 | `scripts/weread-request.ps1`、`scripts/weread-fetch-highlights.ps1` |
| 微信读书连接 | 已验证 | notebooks / shelf / bookmarklist 均实际调用成功 |
| 已取数据 | 已全量抓取 | 笔记本全部分页：132 本有笔记；已抓 130 本划线约 4,700 行（仅存 `.private`） |
| 私密状态 | 已获开发授权 | 323 个书架条目均 secret=1；用户已授权全部书籍用于开发 |
| 真实划线原文 | 已获取并筛选 | 候选池 4,663 条（8–400 字去重后）；已入选 46 条 |
| 全部书籍开发授权 | 已批准 | 包括私密阅读；取消 6 本限制 |
| 本机开发快照 | 已生成 | `.private/local-snapshot.json`：46 条 / 20 本 / 5 主题，visibility=local-only |
| 前端工程骨架 | 已完成（Slice 0） | React 19 + TS 6 + Vite 8；严格数据校验、仅本机隔离 |
| 浏览器验证 | 已执行 | Playwright + Chromium：2 个 e2e 用例通过；1440 / 390 视口已截图 |
| 本机检查 | 已执行 | `check:local` 全绿：typecheck + lint + 27 个单测（5 文件）+ 数据校验 |
| 公开构建 | 已执行 | `npm run build` 成功；local 模式构建被拒绝；公开快照当前为空 |
| 可公开快照 | 留到发布前 | 公开清单未审核，真实内容未进入 `src/data/` |
| 数据覆盖缺口 | 已记录 | 真实划线无原始换行样本；年份仅 2024–2026；入选书籍 20 本超出 6–10 目标 |
| 产品 Gate | 未进行 | 无真实访客结果 |

原始返回、更新包、候选池、快照与截图全部留在 `.private/`，已被 `.gitignore` 排除，未进入前端包。

## 授权更新记录

用户在本轮明确授权读取全部书籍（包括私密阅读）的数据用于搭建产品。已同步 README、AGENTS、开发任务、数据与技术契约、启动提示词及 skill 项目规则，并在 `.private/curation/development-authorization.json` 保存授权范围摘要。

原来的“先问少量 / 最多 6 本 / 等待私密取数许可”规则已失效。用户授权后已按 Slice 0 完成真实取数与本机开发快照，未重复询问同一授权。

本次实际检查通过：本地 Markdown 链接、授权 JSON 的全书 / 私密包含及无限书条款、现有 PowerShell 请求脚本语法、旧授权阻塞语句扫描。仅核对当前进程密钥变量存在性（未显示值）。

## Slice 0 执行记录（已完成）

```text
日期 / 执行者：2026-09-12 / 实现 Agent（GPT-6 Astra 代为执行，用户指定）
Slice / task IDs：Slice 0 — T00 / T01 / T02 / T03 / T04
状态：verified（工程与数据部分）；产品体验验收不适用
数据模式与用户许可依据：登录授权见 .private/curation/development-authorization.json；快照 visibility=local-only
```

**完成内容**

- T03 真实数据：笔记本概览全部分页（120 条目、132 本有笔记）→ 按 bookId 去重建立 fetch-plan（130 本）→ 串行分批拓取划线成功 130/130，共约 4,700 行；失败 0。
- T03 快照：候选池 4,663 条（去重、8–400 字），人工挑选 46 条 / 20 本 / 5 主题，生成 `.private/local-snapshot.json` + 私有 source map。
- T00–T02 骨架：React 19 + TS 6 + Vite 8、严格数据契约与校验器、索引层、真实空状态、仅本机 middleware、数据工具链。
- T04 隔离：`dev:local` 使用 Vite 模式名 `local-private`（原计划的 `local` 被 Vite 保留给 `.env` 后缀，已改名并记录）；local 模式构建直接报错拒绝。

**主要修改文件**：`package.json`、`tsconfig.json`、`vite.config.ts`、`eslint.config.mjs`、`playwright.config.ts`、`index.html`、`src/domain/{types,length,validate,snapshot}.ts`(+2 test)、`src/app/{App.tsx,StatusPanel.tsx,snapshotSource.ts}`(+2 test)、`src/data/public-snapshot.json`、`src/styles/global.css`、`scripts/{build-candidate-pool,build-local-snapshot,validate-snapshot}.ts`、`scripts/weread-fetch-highlights.ps1`、`e2e/slice-0.spec.ts`、`tests/local-snapshot.smoke.test.tsx`。

**实际命令 → 结果**

| 命令 | 结果 |
| --- | --- |
| `npm run pool -- --books 24 --per-book 8` | 候选 4,663 条 / 130 本；短名单 192 条供人工挑选 |
| `npm run snapshot:local` | 46 条 / 20 本 / 5 主题；仅 1 条覆盖警告 |
| `npm run validate:data:local` | OK，visibility=local-only，警告：无原始换行样本 |
| `npm run typecheck` / `lint` | 无错误 |
| `npm run test` | 5 文件 / 27 用例全通过 |
| `npm run smoke:local` | 真实快照经 loader 加载并渲染出首条真实划线 |
| `npx playwright test` | 2/2 通过（真实 Chromium） |
| `npx vite build --mode local-private` | 按预期拒绝，未生成 dist |
| `npm run build`（public） | 成功（公开快照为空） |

**浏览器与视口 → 操作 → 结果**

- Chromium 1440×900 与 390×844 打开 `/`：品牌、`仅本机 · 未公开审核`、真实覆盖计数与首条真实划线均渲染。
- HTTP 探测：`/.private/...`、`/@fs/.../.private/...`、`/.agents/...`、`/scripts/...` → 403；`/.env` 与编码变体只返回 SPA shell（无文件内容、无密钥标记）；`POST /__local_snapshot` → 405。
- 证据路径（私有，不上传）：`.private/review/slice-0/desktop-1440.png`、`.private/review/slice-0/mobile-390.png`。

**未验证 / 尚未完成**

- 尚未实现文字舞台、换句、出处、主题、分享（Slice 1–5）。
- 真实访客体验评审尚未进行（Prototype Gate）。
- 公开快照为空，未做公开构建内容的真实数据审查。
- 移动端真机 / Safari、200% 缩放、键盘全流程待 Slice 5。

**数据覆盖缺口（真实，不补假数据）**

- Henry 的真实划线中没有任何带原始换行的样本 → 校验器持续报告该警告。
- 年份只有 2024 / 2025 / 2026 → 不呈现“来自 4 年前”类长尾时间纵深。
- 入选 20 本书，高于文档目标 6–10 本：为保留书籍多样性而有意超出；如需收窄，只删减 selection 即可重新生成快照。
- 主题标题与划分由 Agent 根据真实原文提出，仍标记为待用户复核。

**需要用户判断的问题**

1. 是否同意当前主题划分与标题（5 个：随机与运气 / 交易与自我克制 / 权力与体制 / 向内寻找 / 金钱的位置）。
2. 是否保留包含政治史与敏感题材的真实划线（如 `c-0001`、`c-0008` 等已标 reviewNote 的条目）——本机开发已可用，公开发布前需单独确认。


## 后续每片记录（追加，不覆盖历史）

```text
日期 / 执行者：
Slice / task IDs：
状态：todo / in-progress / blocked / verified
数据模式与用户许可依据：
变更文件：
命令 → 实际结果：
浏览器与视口 → 操作 → 结果：
证据路径（本机私密证据不得公开）：
未验证项：
产品偏差 / 设计判断：
下一步：
```

## Gate 2 前工程检查

- [ ] 30–50 条真实划线，原文与出处核对，访客展示范围由用户确认。
- [ ] 不存在生成文本、虚假年份 / 累积时长 / 个人介绍。
- [ ] 原文、ID、book / topic 引用与发布权限校验通过。
- [ ] 短 / 中 / 长 / 原始换行真实样本覆盖；缺少则明确记录。
- [ ] 首屏文字中心，统计在深处，不像 Dashboard。
- [ ] 3–5 次换句的多样性、快速点击、耗尽与 reduced-motion 验证。
- [ ] 出处原位展开，同书 / 跨书逻辑正确。
- [ ] 至少 3 个主题连接多本书，年份真实。
- [ ] 分享固定内容、稳定链接、复制失败、长卡片可读。
- [ ] 320px / 390px / 768px / 1440px、200% 缩放和键盘路径可用。
- [ ] 类型检查 / lint / 单测 / E2E / 构建有实际结果。
- [ ] 开发服务器私有路径不可读，公开包无私密数据、密钥和原始标识。
- [ ] 仅本机授权的截图 / 录屏没有离开本机。

## Critique #1 提交材料

在用户授权评审范围内提供：

1. 桌面首屏、手机首屏、长句和出处展开截图。
2. 世界 / 主题 / About 全页截图。
3. 连续 3–5 次换句 → 出处 → 主题的一段录屏。
4. 已知体验问题与真实数据覆盖不足。
5. 测试执行摘要和不可验证项。

不要用截图修饰、假文案或最漂亮的单一句子掩盖真实页面问题。

## 真实访客体验记录

至少 3 位首次访客，不提前解释产品理念。让其自由使用 30–60 秒后询问 Brief §14 的六个问题。无远程埋点，由观察者手工记录即可。

| 访客（匿名） | 是否自然换句 ≥3 次 | 是否打开书 / 主题 | 对项目的描述原话 | 对主人阅读兴趣的印象 | 阻碍 / 不适 |
| --- | --- | --- | --- | --- | --- |
| 待访客 1 | 未测 | 未测 | 未记录 | 未记录 | 未记录 |
| 待访客 2 | 未测 | 未测 | 未记录 | 未记录 | 未记录 |
| 待访客 3 | 未测 | 未测 | 未记录 | 未记录 | 未记录 |

Agent 不编造访客语录、不填写“预期成功”为实际成功。主题策展和书封不能替代真实反馈。

## Review 结论模板

- 结论：通过 / 有条件通过 / 继续原型 / 暂停。
- 证据：真实观察，而不是功能数。
- 核心问题：访客是否觉得“我好像稍微认识这个人一点了”？
- 本轮要改的最多 3 项：
- 不做的扩张：
- 何时复评：
- 是否允许进入 Gate 3：需用户明确决定。

**Gate 2 不等于可公开发布。** Gate 4 仍需版权、隐私、部署地址、移动端分享与真实内容撤回机制 review。
