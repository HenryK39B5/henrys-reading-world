# 25 — V3 Batch 3：稳定词表、私有试标与 Local Tag Studio

> 日期：2026-09-18
>
> 状态：**实现、私有试标与浏览器验收已完成，停在 Batch 3 Gate。** 用户已批准 Batch 2 的完整候选词表进入试标；300 条试标已完成机器辅助标注与逐条全文复核，其中 268 条 marked `reviewed`、32 条明确保留 `draft`。Henry 尚未逐条看过这 300 条。
>
> 本文不授权 schema 3、主题小径、世界地图、正式公开导出、push 或部署。范围与下一步见 `docs/22 §6–7`。

## 1. 本阶段完成范围

Batch 3 回答一个问题：**这套标签在一个真实批次里是否真的可用。**

完成四件事：

1. 把用户批准的 53 个候选标签升级为带稳定 ID 的本机词表；
2. 建立严格的私有 assignment 契约（1–3 个平等标签、状态、信心、理由、候选、标记）；
3. 完成同一批 300 条真实划线的试标，并对每条做全文复核与结构审计；
4. 建立只在本机运行的 Local Tag Studio，用于逐条复核、修改和保存。

没有修改 schema 2、local snapshot、publication policy 或 public snapshot。

## 2. 稳定词表

`npm run tags:promote` 把 `candidate-vocabulary.json` 一次性转换为 `vocabulary.json`：

```text
标签                     53（tag-001 … tag-053）
内部概念家族              6（family-01 … family-06）
状态                     reviewed
public 名称              2–4 字
editorialOrder           固定，决定显示顺序
approvedAt               2026-09-18
```

关键决定：

- 候选 ID `ct-0NN` 只用于发现阶段；公开与后续阶段一律使用稳定 `tag-NNN`；
- 显示顺序由 `editorialOrder` 决定，**不表示第一个是主标签**；
- 标签地位平等，`tagIds` 不区分 primary / secondary；
- `includes` / `excludes` / `definition` 是边界依据，不是自动匹配规则；
- `familyId` 只用于 Studio 内部分组，不成为公开层级；
- 改名不换 ID（`docs/20 §4`），因此分享链接与地图坐标在改名后仍然有效。

## 3. 私有 assignment 契约

`src/domain/topicTags.ts` 是纯 TypeScript 契约，被脚本、Studio、服务端和测试共用：

```ts
type HighlightTagAssignment = {
    highlightId: string;
    tagIds: string[];        // 1–3 个，按 editorialOrder 排序
    status: 'draft' | 'reviewed';
    confidence: 'low' | 'medium' | 'high';
    rationale: string;       // 私有，不进快照
    candidates: { tagId: string; score: number }[];  // 私有
    flags: AssignmentFlag[];
    updatedAt: string;
};
```

校验器拒绝：未知 highlight、未知 tag、0 个或 4 个以上标签、重复标签、未按词表顺序、重复 `highlightId`、缺少必需条目、出现契约外字段、缺 tag 名称或定义、非法状态与信心。

`updateHighlightAssignment`、`migrateMergedTag` 是仅有的两个变更入口，避免 Studio 与命令行各自实现一套迁移逻辑。

## 4. 试标方法与真实结果

`npm run tags:trial:generate` 对 300 条发现样本运行 seed-centroid + query 集成打分：

```text
每个标签的分数 = 0.7 × 与三条人工种子的核心相似度 + 0.3 × 与候选定义的相似度
标准化        按标签自身在全语料上的均值与标准差
词面证据      命中标签名 / alias / includes 时加固定分
纳入阈值      第二、第三标签需同时越过分数与 margin 门槛
```

`npm run tags:trial:review` 再做一次逐条全文复核，规则是：

- 高 / 中信心且边界清晰 → 接受为 `reviewed`；
- 低信心但原文有明确词面证据 → 依定义修正标签，标为 `reviewed`，理由写明是词面证据；
- 低信心且原文单独无法支撑任何标签 → 保持 `draft`，并打上 `low-confidence` 与 `possible-missing-tag`，**不猜**；
- 明显选错标签的条目 → 依全文改写，并在理由中记录是人工 override。

真实结果：

```text
试标总数                300
reviewed / draft        268 / 32
1 / 2 / 3 个标签        145 / 86 / 69
多标签比例              51.7%
信心 high / medium / low  79 / 189 / 32
标签覆盖                53 / 53
零覆盖标签              0
覆盖超过 25% 的过宽标签    0
不足 3 本的偏薄标签        3
```

## 5. 一致性与真实诊断

`npm run tags:trial:audit` 同时输出机器一致性与结构问题：

```text
全部标签都出现在 embedding top-5        269
没有任何标签出现在 top-5                22
人工 override / 词面证据覆盖             68
```

如实说明这组数字的含义：

- **68 条与 embedding 提议不同。** 这些是逐条全文复核的结果，不是模型输出。它们同时也是风险最高的条目：如果复核判断错了，错在这里最集中。
- **22 条的全部标签都不在 top-5。** 原因是 override 与词面规则改写过标签，而 `candidates` 保留原始 top-5。这正好是 Studio 需要人工看一眼的清单。
- **51.7% 是多标签。** 说明岔路是常态而不是例外，符合「一条划线可以同时属于多条小径」的产品预期；但也意味着小径算法必须真的支持交叉，而不能假设每条划线只有一个归属。
- **三个偏薄标签**：`tag-004 运气`（1 本）、`tag-030 幸福`（2 本）、`tag-034 道德`（2 本）。

偏薄标签的判断留到 Batch 3 Gate：可以补充种子重跑该标签的候选，也可以与相邻标签合并。当前**没有**为了凑数给它们硬塞内容——保持真实的低覆盖比制造假分布更诚实。

## 6. Local Tag Studio

`npm run tags:studio` 打开 `http://127.0.0.1:5175/tag-studio.html`。

提供：

- 300 条试标列表与**完整原文**，不截断；
- 按状态、信心、标记、家族筛选，并按 ID / 原文 / 书名 / 标签搜索；
- embedding top-5 候选一键采纳；
- 按家族分组的标签勾选，勾选框带定义与 excludes 提示；
- 当前标签的完整定义、includes、excludes 对照；
- 状态、信心、四个标记、私有理由的编辑；
- 「标记为待定」把条目退回 `draft` 并打上标记，而不是静默猜一个；
- 保存时整份文件通过严格校验后才原子替换 `assignments.json`。

边界：

- 只在 `tags:studio` 模式存在读写接口；
- 普通 `dev:local` 下 Studio 文档虽然存在于磁盘，但**读不到任何词表与试标**，也无法写入（`e2e/tag-studio-absent.spec.ts`）；
- 生产构建根本不产出 `tag-studio.html`，隔离探针另行断言；
- 写入要求同源且端口必须是 5175，其他来源一律 403；
- 自动化测试通过 `READING_WORLD_TAG_DIR` 写到 `.private/review/batch-3/test-tags/`，**绝不覆盖真人正在看的试标**。

这是内容生产工具，不是产品页面。它不追求克制审美，也完全不参与公开产物。

## 7. 标签合并与改名

`npm run tags:migrate`：

```powershell
npm run tags:migrate -- --merge tag-031 --into tag-030 --yes
npm run tags:migrate -- --rename tag-004 --title 运气与偶然 --yes
```

- 合并会把源标签的全部 assignment 迁到目标标签并去重，然后**重新校验整份文件**才写盘；
- 改名保留稳定 ID，因此不改动任何 assignment；
- 两个文件都通过原子替换写入，避免词表与试标出现不一致的中间状态；
- 必须显式 `--yes`：这是会改写真人产物的操作。

## 8. 数据与网络边界

- 本阶段新增的 API 调用只有标签定义与种子的统计打分，**没有新增任何外部模型请求**；全部向量沿用 Batch 2 已生成的私有缓存；
- 词表、试标、候选分数、理由、标记、审计报告全部只在 `.private/tags/`，被 `.gitignore` 排除；
- `rationale`、`candidates`、`confidence`、`flags` 是私有字段，明确不进入任何快照；
- 消费者代码没有新增模型调用、没有新增公开路由、没有新增依赖；
- public snapshot 仍为 schema 2、0 本 / 0 条；publication policy 未被触碰；
- 稳定 ID、正文、主题、年份均未改变。

## 9. 实际验证

| 命令 | 结果 |
| --- | --- |
| `npm run tags:promote` | 53 个稳定标签 / 6 个家族；词表通过严格校验 |
| `npm run tags:trial:generate` | 300 条候选；1 / 2 / 3 标签与信心分布符合契约 |
| `npm run tags:trial:review` | 300 条全文复核；268 reviewed / 32 draft |
| `npm run tags:trial:audit` | 53 / 53 标签覆盖；0 孤儿；0 过宽；3 偏薄 |
| `npm run check:local` | typecheck、lint、**265 单测 / 24 文件**、schema 2 local 校验通过；唯一警告仍为无原始换行 |
| `npm run verify:ids` | 20 本 / 46 条种子 ID 稳定；总量 4,663 / 130 |
| `npm run smoke:local` | 6 / 6 真实数据 smoke 通过 |
| `npm run test:e2e` | **106 / 106**（原 104 + 2 个 Studio 缺席用例） |
| `npm run test:tags` | **10 / 10** Studio 浏览器验收（真实快照 + 试标副本） |
| `npm run test:publication` | 9 / 9 审核器用例仍通过 |
| `npm run test:public` | 1 / 1 public 空态通过 |
| `npm run build` | public build 成功；public snapshot 0 本 / 0 条 |
| `npm run isolation:public` | clean；新增 Studio 入口、两个路由、词表 / 试标 / 审计文件名、私有理由与标记探针全部 absent |
| `npx vite build --mode local-private` | 按预期退出 1 |
| `npx vite build --mode tag-studio-private` | 按预期退出 1 |
| 凭证反向扫描 | source 0 命中；`.private/embeddings`、`.private/tags`、测试副本 0 命中；`.private` tracked 0 |
| `git diff --check` / Markdown 链接 / 尾随空白 | 通过 / 0 / 0 |

## 10. 未验证项与偏差

- **Henry 尚未逐条审核 300 条试标。** 268 条 `reviewed` 是机器辅助 + 全文复核的结果，不等于用户认可。
- 32 条仍为 `draft`，需要人在 Studio 里逐条决定；这批集中在原文单独不足以支撑任何标签的条目。
- 68 条与 embedding 提议不一致，是正确性风险最高的子集。
- 三个偏薄标签尚未处理。
- 标签定义在真实边界处是否足够区分，目前只有 300 条证据，不足以证明 4,663 条全量适用。
- 真机移动端与 Safari 继续未验证；Studio 是桌面工具，没有做移动端验收，也**不打算**做。
- 尚未产生任何小径、地图、schema 3 或分享改动。

## 11. Batch 3 Gate 与下一步

建议的 Gate 内容：

1. 抽查若干条 `reviewed` 是否合理（可以用 Studio 的家族与信心筛选快速切到边界条目）；
2. 对 32 条 `draft` 做取舍：补标签、改标签，或确认「确实无法归类」；
3. 处理三个偏薄标签：补种子、并入相邻标签，或接受低覆盖；
4. 确认标签数量与抽象度是否适合进入 Batch 4；
5. 是否允许进入 Batch 4（schema 3、主题小径、岔路与视觉基础）。

用户不批准前，不开始 schema 3、小径、地图或全量标注，也不改动 public snapshot。

## 12. 执行者交接记录

- Batch 0–2 由前一个实现会话完成，提交到 `fa2b56a`。
- 用户在 Batch 3 开始时明确指定由当前会话（运行时标签 `PI_MODEL=deepseek-flash`，`PI_PROVIDER=cc-switch-deep-seek`）接手继续。
- 此前项目曾记录「暂不交给 DeepSeek v4.1 Flash」。该安排已被用户本次决定取代，特此记录，以免文档状态与实际执行者不符。
- 本次接手时先核对工作区与既有改动，未回退或覆盖前任会话的任何产物；Batch 3 的领域契约、脚本、Studio、测试与本文档均为本次新增。
- 无法从会话内部验证模型权重身份，只能如实报告 harness 暴露的配置值。
