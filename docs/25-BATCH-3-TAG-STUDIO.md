# 25 — V3 Batch 3：稳定词表、私有试标与 Local Tag Studio

> 日期：2026-09-19
>
> 状态：**Batch 3 已收口。** 用户已填写的 14 条意见全部有处置：3 条直接应用为 `human`，11 条由实现 Agent 完成词表与逐句判定，待决数为 0。稳定词表由 53 个扩为 56 个，新增「债务」「失败」「希望」；300 条试标最终为 294 `reviewed` / 6 `draft`，6 条无法在不猜测的前提下归类，明确不进入 reviewed 数据，也不要求用户继续逐条审核。
>
> 本文不授权 schema 3、主题小径、世界地图、正式公开导出、push 或部署。范围与下一步见 `docs/22 §6–7`。

## 1. 本阶段完成范围

Batch 3 回答一个问题：**这套标签在一个真实批次里是否真的可用。**

完成四件事：

1. 把用户批准的 53 个候选标签升级为带稳定 ID 的本机词表，并在收口审计后追加 3 个跨书缺口标签；
2. 建立严格的私有 assignment 契约（1–3 个平等标签、状态、信心、理由、候选、标记）；
3. 完成同一批 300 条真实划线的试标，并对每条做全文复核与结构审计；
4. 建立只在本机运行的 Local Tag Studio，用于逐条复核、修改和保存。

没有修改 schema 2、local snapshot、publication policy 或 public snapshot。

## 2. 稳定词表

`npm run tags:promote` 把 `candidate-vocabulary.json` 一次性转换为 `vocabulary.json`：

```text
标签                     56（tag-001 … tag-056）
内部概念家族              6（family-01 … family-06）
状态                     reviewed
public 名称              2–4 字
editorialOrder           固定，决定显示顺序
approvedAt               2026-09-19
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
    provenance: 'ensemble' | 'lexical' | 'override' | 'unresolved' | 'human';
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
reviewed / draft        294 / 6
1 / 2 / 3 个标签        113 / 114 / 73
多标签比例              62.3%
信心 high / medium / low 68 / 226 / 6
标签覆盖                56 / 56
零覆盖标签              0
覆盖超过 25% 的过宽标签    0
不足 3 本的偏薄标签        1（运气；全语料 64 条 / 23 本，保留）
```

## 5. 一致性与真实诊断

`npm run tags:trial:audit` 同时输出机器一致性与结构问题：

```text
全部标签都出现在 embedding top-5        265
没有任何标签出现在 top-5                26
```

每条试标还带结构化 `provenance`，记录标签是怎么来的，而不是写在散文里：

```text
ensemble    152   模型提议经全文复核后保留
human         3   Henry 已填写且能直接映射现有词表
override    128   全文复核、词表缺口或新增标签污染检查后改写
lexical      11   低信心但原文有明确字面依据
unresolved    6   原文单独撑不起任何词表标签，诚实保留 draft
```

实现 Agent 已重点复核 **145 条**非 `ensemble` / 非 `human` 条目；这不是用户待办。

- **128 条 override。** 除原有全文纠错外，还包括新增标签后的污染复核：新增标签曾把「债务」错投到解雇、时间浪费、贫困和纯货币段落，把「希望」错投到礼貌性“希望你”、统计期望和一般文学语句；这些误标已逐条移除。
- **11 条 lexical。** 对「爱」「国债」等可能同词不同义的规则做了逐条复核，明显误判改为 override。
- **6 条无法归类。** `h-1025`、`h-3432`、`h-3480`、`h-3526`、`h-3768`、`h-4130` 保持 `draft`；占位标签只用于诊断，不进入 reviewed 数据。
- **32 条的全部最终标签不在原始 top-5。** 原始候选继续保留作私有诊断，但不凌驾于全文判断。
- **62.3% 是多标签。** 岔路是常态而不是例外，小径算法不得假设每条划线只有一个归属。
- **唯一试标偏薄标签是「运气」**：试标仅 1 本，但全语料词面证据为 64 条 / 23 本，因此保留；「幸福」「道德」均达到 3 本。

`unresolved` 与 `human` 这两个值让「谁做的决定」永远不会丢失：任何在 Studio 改过的条目都会变成 `human`，不再可能被当成模型提议。

偏薄标签处置已完成：不为试标比例补造 assignment；「运气」以全语料跨书证据保留。新增「失败」在试标中覆盖 4 本，「债务」覆盖 7 本，「希望」有 4 本 reviewed 与 2 条 draft 占位，均经过新增标签专项污染复核。

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
| `npm run tags:promote` | 56 个稳定标签 / 6 个家族；词表通过严格校验 |
| `npm run tags:seeds` | 56 个标签、448 个候选种子、41 组边界；仅本机 embedding |
| `npm run tags:trial:generate` | 300 条候选；加入 3 个新标签后整批重算 |
| `npm run tags:trial:review` + `tags:review-apply` | 294 reviewed / 6 draft；3 条用户决定为 `human`；11 条词表建议 Agent 已判定；待决 0 |
| `npm run tags:trial:audit` | 56 / 56 标签覆盖；0 孤儿；0 过宽；1 个试标偏薄但有 64 条 / 23 本全语料证据；provenance ensemble 152 / override 128 / lexical 11 / unresolved 6 / human 3 |
| `npm run tags:review-import` | 只读导入 14 条用户填写；不改原 Markdown；source hash 保持一致 |
| `npm run tags:review-queue` | 生成 `review-queue.generated.md`；绝不覆盖包含用户手写内容的 `review-queue.md` |
| `npm run check:local` | typecheck、lint、**269 单测 / 25 文件**、schema 2 local 校验通过；唯一警告仍为无原始换行 |
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

- 用户不再承担逐条内容审核。现有 300 条是 Agent 生产批次，不表示 Henry 逐条背书。
- 用户填写的 14 条已全部处置：3 条直接应用；11 条词表外建议中，「负债」规范为新标签「债务」，「失败」新增；另外由全语料缺口审计补入「希望」。
- 「过拟合」并入认知偏差 + 学习；「沉醉」不单列；「版权」并入制度 + 风险；「财产」并入财富；「混沌随机性」并入复杂性；「标准」并入不确定性 + 制度；「专制」并入管理 + 权力；「监管 / 舆论监督」并入自由 + 宣传控制；「准备」对应句保持 draft。
- 6 条 `draft` 是诚实的无法归类结果，不是用户 Gate；128 override 与 11 lexical 已完成 Agent 复核。
- 偏薄标签已最终处理：运气保留，不合并。
- 标签定义在真实边界处是否足够区分，目前只有 300 条证据，不足以证明 4,663 条全量适用。
- 真机移动端与 Safari 继续未验证；Studio 是桌面工具，没有做移动端验收，也**不打算**做。
- 尚未产生任何小径、地图、schema 3 或分享改动。

## 11. Batch 3 收口方式：Agent 审核，用户只做产品决定

### 11.1 用户不再需要继续填写队列

`.private/tags/review-queue.md` 保留为诊断材料，但不再是用户待办。新增：

- `npm run tags:review-import`：只读解析用户已经填写的内容，绝不覆盖原 Markdown；
- `.private/tags/user-review-notes.json`：保存 source hash、原始回答、可映射标签与词表外概念；
- `npm run tags:review-apply`：只自动应用完全落在已批准词表内的 1–3 个标签；包含新概念的回答不会被部分吞掉，而是保留给词表判定。

最终结果：14 条成功导入，3 条直接应用，11 条由 Agent 完成语义判定，`still pending vocabulary adjudication: 0`。

### 11.2 Agent 的收口标准

1. 11 个词表外建议已完成全语料频次、跨书覆盖与边界检查；
2. 新增标签限定为能跨书形成小径且现有词表无法清楚表达的概念；最终新增债务、失败、希望；
3. 6 条 draft 保留「无法归类」，没有为了数字硬贴标签；
4. override / lexical 与三个新增标签的全部试标命中均已复核；发现系统性污染后已修规则并整批重跑；
5. 偏薄标签已有明确处置，不再等待用户拍板。

### 11.3 进入 Batch 4 的边界

用户已经明确要求当前实现 Agent 继续推进，并拒绝逐条审核负担。完成上述 Agent 判定、更新审计并通过回归后，可连续进入 Batch 4；不再等待用户逐条勾选。正式 public snapshot、public covers、repo、push 与部署仍保持原 Gate，不因本次调整自动授权。

## 12. 执行者交接记录

- Batch 0–2 由前一个实现会话完成，提交到 `fa2b56a`。
- 用户在 Batch 3 开始时明确指定由当前会话（运行时标签 `PI_MODEL=deepseek-flash`，`PI_PROVIDER=cc-switch-deep-seek`）接手继续。
- 此前项目曾记录「暂不交给 DeepSeek v4.1 Flash」。该安排已被用户本次决定取代，特此记录，以免文档状态与实际执行者不符。
- 本次接手时先核对工作区与既有改动，未回退或覆盖前任会话的任何产物；Batch 3 的领域契约、脚本、Studio、测试与本文档均为本次新增。
- 无法从会话内部验证模型权重身份，只能如实报告 harness 暴露的配置值。
- 2026-09-18 用户再次交接：当前会话报告 `PI_MODEL=gpt-5.6-sol`、`PI_PROVIDER=openai-codex`。本会话保留 DeepSeek 已提交实现与用户在 `.private/tags/review-queue.md` 的修改，没有回退或覆盖；新增本机 embedding 迁移、用户意见导入与 Agent-owned 审核规则。
