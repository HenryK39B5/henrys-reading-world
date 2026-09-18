# 24 — V3 Batch 2：标签发现与词表 Gate

> 日期：2026-09-18
>
> 状态：**实现与私有内容生产已完成，用户词表 Gate 已关闭。** 用户已批准 53 个候选标签全部进入 Batch 3 试标；试标、Studio 与状态见 `docs/25-BATCH-3-TAG-STUDIO.md`。
>
> 本文不自动授权开始 schema 3、主题小径、消费者 UI、正式公开导出、push 或部署。

## 1. 本阶段完成范围

Batch 2 完成四件事：

1. 使用 Batch 1 选定的默认模型为全部真实划线生成私有 embedding；
2. 用 embedding 与书籍配额选择 300 条标签发现样本；
3. 建立 30–60 个目标范围内的第一版受控候选词表；
4. 为每个候选建立人工种子，并明确需要用户审核的相邻边界。

没有修改 schema 2、local snapshot、publication policy、public snapshot 或任何消费者页面。

## 2. 全量私有 embedding

命令：

```powershell
npm run embeddings:generate -- --provider siliconflow --model BAAI/bge-large-zh-v1.5 --dimensions 1024 --batch-size 32
```

结果：

```text
snapshot highlights       4,663
原有评测缓存                 300
本批新增                   4,363
最终缓存                   4,663 / 4,663
维度                       1,024
模型                       BAAI/bge-large-zh-v1.5
```

缓存仍使用文本 hash、snapshot hash、原子批次保存和失败续跑。重跑同一命令时应为 0 个新请求。

## 3. 300 条多样性样本

命令：

```powershell
npm run tags:sample
```

选择算法 `embedding-book-fair-v1`：

1. 每本书先取最靠近本书 embedding 中心的一条，确保书籍覆盖；
2. 在同一本书内取与第一条语义距离较远的一条，并对不同长度带给少量加分；
3. 按主 Book Theme 轮转，从尚有候选的书中补第三条，直到 300 条；
4. 每书最多三条；候选与最终结果都按 stable ID 确定性打破平局，不使用随机数。

实际覆盖：

```text
样本                       300
书籍                       130 / 130
Book Theme                 14 / 14
每书                       1–3 条
书中心点                   130
书内语义边缘               111
主题轮转第三条              59
短 / 中 / 长               111 / 138 / 51
```

少数书本身只有一条可用划线，因此每书下限为一条；高划线书仍不能超过三条。

## 4. 语义簇只作辅助

`npm run tags:clusters` 对 300 条样本执行固定 36 簇的 spherical k-means：

- farthest-first 确定性初始化；
- 固定最大迭代次数；
- 输出每簇书籍、Book Theme 倾向和代表原文；
- 不把一个簇直接命名为一个标签；
- 不把单标签聚类误当成未来 1–3 个平等 Topic Tag assignment。

实际簇大小不均衡，包含稀有单点和较大的混合簇。这正说明 embedding 适合帮助发现局部邻域和离群点，不适合独自决定正式词表。

## 5. 第一版候选词表

私有词表达到 Batch 2 目标：

```text
候选 Topic Tag             53
内部概念家族                 6
相邻边界                    35 组
每标签 embedding 候选种子     8 条，按书去重
embedding 候选种子总数       424
每标签人工复核种子             3 条，来自三本不同书
人工复核种子总数             159
```

每个标签均包含：

- 候选 ID；
- 二至四字名称；
- 中等抽象度定义；
- includes；
- excludes；
- aliases；
- 内部 family；
- 三条人工复核真实种子；
- 与相邻标签的边界说明。

概念家族只用于 Studio 内部组织，不形成公开层级。

## 6. 词表质量观察

- 53 个标签均有三本不同书的人工种子，不依赖单本高划线书；
- 8 个候选的 query top-5 平均相似度低于内部观察线，但全文关键词复核仍显示跨书真实材料，因此暂不因单一 cosine 删除；
- 11 组标签的 top-8 种子存在至少三条重叠，属于优先检查“应合并还是允许多标签共存”的边界；
- 部分关系类词语会召回软件中的“依赖关系”等关键词伪相关；Batch 3 不得自动接受 nearest neighbours；
- 语义弱召回、种子重叠和聚类不均衡均保留为真实诊断，没有通过手工美化指标隐藏。

当前建议不是立即压缩词表，而是让 53 个候选先进入 250–300 条试标；用实际标签频次、多标签比例、跨书覆盖和边界冲突再决定合并或删除。

## 7. 私有产物

```text
.private/embeddings/full-generation--siliconflow--baai-bge-large-zh-v1.5--1024.json
.private/embeddings/vectors/siliconflow--baai-bge-large-zh-v1.5--1024.json
.private/tags/discovery-sample.json
.private/tags/discovery-sample.md
.private/tags/discovery-clusters.json
.private/tags/discovery-clusters.md
.private/tags/candidate-vocabulary.json
.private/tags/candidate-query-vectors.json
.private/tags/candidate-seeds.json
.private/tags/candidate-review.md
.private/tags/curated-seeds.json
.private/tags/candidate-audit.json
.private/tags/BATCH-2-GATE.md
```

以上文件均被 `.gitignore` 排除。完整原文、向量、候选理由、相似度和人工种子不会进入 public build。

## 8. 新增命令与实现

```powershell
npm run embeddings:generate
npm run tags:sample
npm run tags:clusters
npm run tags:seeds
npm run tags:audit
```

主要实现：

```text
scripts/embedding-generate.ts
scripts/tag-discovery-sample.ts
scripts/tag-discovery-clusters.ts
scripts/tag-candidate-seeds.ts
scripts/tag-candidate-audit.ts
scripts/embeddings/tagDiscovery.ts
scripts/embeddings/clustering.ts
```

纯函数测试覆盖：

- 书籍公平与确定性抽样；
- 每书二至三条配额行为；
- 缺向量时 fail-closed；
- spherical k-means 确定性；
- 重复 ID、零向量和非法输入拒绝。

## 9. 数据与网络边界

- 全量 embedding 请求只发送划线正文与模型参数；
- 标签 query 请求只发送候选名称、定义、includes 和 excludes；
- 没有发送 stable ID、书 ID、账号标识、微信原始字段、publication policy 或私有 note；
- API key 未进入日志、缓存、报告、代码、Git 或 public build；
- public / local 消费者运行时仍无模型请求；
- 所有标签内容仍是 draft，不进入 schema 2 快照。

## 10. 实际验证

| 命令 | 结果 |
| --- | --- |
| 首次 `embeddings:generate` | 从 300 条评测缓存补齐 4,363 条；最终 4,663 / 4,663 |
| 同命令重跑 | `newly requested: 0`；验证 hash cache 与续跑路径 |
| `npm run tags:sample` | 300 条 / 130 本 / 14 Book Theme；每书 1–3；短中长 111 / 138 / 51 |
| `npm run tags:clusters` | 36 个确定性私有语义簇；无空簇 |
| `npm run tags:seeds` | 53 标签 / 424 跨书候选种子 / 35 组边界 |
| `npm run tags:audit` | 159 条人工种子；每标签三条且来自三本不同书；8 个弱召回观察项 / 11 组种子重叠观察项 |
| `npm run check:local` | typecheck、lint、**263 单测 / 23 文件**、schema 2 local 校验通过；唯一警告仍为无原始换行 |
| `npm run verify:ids` | 20 本 / 46 条种子 ID 稳定；总量 4,663 / 130 |
| `npm run smoke:local` | **6 / 6** 真实数据 smoke 通过 |
| `npm run test:public` | **1 / 1** public 空态 E2E 通过 |
| `npm run build` | public build 成功；public snapshot 仍为 0 本 / 0 条 |
| `npm run isolation:public` | clean；private tags 文件名、向量、凭证与真实内容均 absent |
| `npx vite build --mode local-private` | 按预期退出 1，保护错误原文保持不变 |
| 凭证反向扫描 | source 0 命中；private embedding / tags 产物 0 命中；`.private` tracked 0 |

本阶段没有消费者 UI 或 CSS 变化，因此没有生成视觉截图。public 空态与 isolation 只证明私有标签生产工具没有污染产品构建，不冒充标签产品体验验收。

## 10. 用户 Gate（已关闭）

2026-09-18 用户回复“批准全部候选进入 Batch 3 试标”：

- 名称与定义：全部接受；
- 相邻边界：保留 35 组，不需要改名或合并；
- 缺失主题：用户未提出补充；
- 过宽 / 过细：8 个弱召回与 11 组种子重叠保留到真实试标判断；
- 允许整套 53 个候选进入 Batch 3 试标。

因此 Batch 3 把候选升级为稳定词表 `tag-001…tag-053`，并未在发现阶段删词。三个在真实试标中仍然偏薄的标签（运气 / 幸福 / 道德）已记录在 `docs/25 §5`，由用户在 Batch 3 Gate 决定补种子或合并。
