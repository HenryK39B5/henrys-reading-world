# 23 — V3 Batch 1：私有 embedding 基础与厂商评测

> 日期：2026-09-18
>
> 状态：**Batch 1A 基础设施与真实评测集已完成；Batch 1B 真实厂商对比等待本机凭证。** 本文不授权公开导出、运行时模型、push 或部署。
>
> 权威关系：用途与边界见 `docs/19–20`，施工 Gate 见 `docs/22 §4`。价格与免费额度会变化，正式全量生成前必须重新核对厂商官方页面。

## 1. 本阶段目标

Batch 1 只回答两个问题：

1. 如何安全、可恢复、可比较地为真实划线生成私有 embedding；
2. 哪个模型对当前中文真实语料“够用”，而不是哪个模型在通用榜单上最高。

它不开始标签词表、全量标签生产、schema 3、主题小径或世界地图 UI。

## 2. 已实现基础设施

新增命令：

```powershell
npm run embeddings:prepare
npm run embeddings:baseline
npm run embeddings:evaluate -- --provider voyage
npm run embeddings:evaluate -- --provider cohere
npm run embeddings:evaluate -- --provider openai
npm run embeddings:compare
```

实现能力：

- provider-neutral TypeScript 接口；
- Voyage、Cohere、OpenAI 三个固定官方 endpoint adapter；
- 凭证只读取 `VOYAGE_API_KEY / COHERE_API_KEY / OPENAI_API_KEY`；
- 对应 `VITE_*` 凭证会被明确拒绝；
- 文本使用 `NFC + LF` 的版本化输入规范；
- local snapshot 与每条文本均使用 SHA-256 hash；
- 批量、限流等待、429 / 5xx 重试、失败续跑与原子缓存；
- provider / model / dimensions / snapshot hash / token 用量 / 成本估算 / 请求数写入 `.private/embeddings/`；
- 终端只输出数量、指标、耗时、成本和错误类别，不打印向量、完整原文、密钥或厂商错误正文；
- 私有 comparison 只比较相同 corpus 与相同人工 case；不会自动批准 provider。

初始维度统一为 512，原因是当前只有 4,663 条文本，地图与小径主要需要稳定相对关系；是否升到 1024 必须由真实评测证明，而不是预先扩大存储。

## 3. 真实评测集

`npm run embeddings:prepare` 从 `.private/local-snapshot.json` 生成：

```text
300 条真实划线
130 本书全部覆盖
14 个 Book Theme 全部覆盖
短 105 / 中 88 / 长 107
28,067 个非空白字符
22 个人工语义 case
```

人工 case 只在 `.private/embeddings/evaluation/labels.json`，覆盖：

- 跨书明确相关；
- 相邻概念边界；
- 相同关键词但语义不同；
- 随机性、风险、等待、权力、孤独、死亡、亲密关系、选择、恐惧、自由、幸福、意义、记忆、概率、财富、市场自我控制、睡眠等真实材料。

评测指标：

- Mean Reciprocal Rank；
- Recall@5 / Recall@10；
- 正例与人工 hard negative 的 pair accuracy；
- 正负相似度 margin；
- top-10 跨书多样性。

指标不代替人工查看邻居。特别是不同模型的 cosine 绝对值不可直接横向比较，因此 comparison score 不使用原始相似度数值。

## 4. 非语义基线

为验证整条缓存与评测管线，建立了字符 unigram / bigram lexical hash 下限。它不是候选 provider，也不能用于正式标签或地图。

当前结果：

```text
MRR                 0.1863
Recall@10           0.4091
Pair accuracy       0.5238
Book diversity@10   0.9318
```

真正 embedding 至少应明显超过这一语义下限；如果只提升关键词命中、却不能拉开 hard negative，不算“够用”。

## 5. 第一轮厂商候选

### 5.1 默认候选：Voyage `voyage-4-lite`

官方资料（2026-09-18 核对）：

- 官方说明支持 multilingual retrieval 与 clustering；
- 32K context；
- 默认 1024 维，也支持 256 / 512 / 2048；
- pricing 页面列出前 200M tokens 免费，之后 `$0.02 / 1M tokens`。

第一轮参数：

```powershell
npm run embeddings:evaluate -- --provider voyage --model voyage-4-lite --dimensions 512 --price-per-million-tokens 0.02
```

本项目做 passage-to-passage 相似、聚类和地图，不是 query-to-document 搜索，因此 adapter 不设置 retrieval `input_type`。

官方入口：

- <https://docs.voyageai.com/docs/embeddings>
- <https://docs.voyageai.com/docs/embeddings-api>
- <https://docs.voyageai.com/docs/pricing>

### 5.2 默认对照：Cohere `embed-v4.0`

官方资料（2026-09-18 核对）：

- 支持 100+ 语言；
- 支持 `clustering` input type；
- 支持 256 / 512 / 1024 / 1536 维；
- trial key 为每月 1,000 次调用、每分钟 2,000 inputs；
- production pricing 为 `$0.12 / 1M tokens`。

300 条评测使用默认批次最多 4 次请求，处于 trial call 范围内。

```powershell
npm run embeddings:evaluate -- --provider cohere --model embed-v4.0 --dimensions 512 --price-per-million-tokens 0.12
```

官方入口：

- <https://docs.cohere.com/docs/cohere-embed>
- <https://docs.cohere.com/reference/embed>
- <https://cohere.com/pricing>
- <https://docs.cohere.com/docs/rate-limits>

### 5.3 可选低成本控制：OpenAI `text-embedding-3-small`

当前官方价格为 `$0.02 / 1M tokens`，默认 1536 维并支持 `dimensions` 参数。它不作为完成 Batch 1 的必要第三家；若用户已有 key，可作为成熟接口控制组。

```powershell
npm run embeddings:evaluate -- --provider openai --model text-embedding-3-small --dimensions 512 --price-per-million-tokens 0.02
```

官方入口：

- <https://developers.openai.com/api/docs/guides/embeddings>
- <https://developers.openai.com/api/docs/models/text-embedding-3-small>
- <https://openai.com/api/pricing/>

## 6. 暂不进入第一轮的候选

- Gemini 免费额度可用，但官方 pricing 当前明确区分 free tier 与 paid tier 的数据使用政策；本项目已有更直接的免费候选，因此不为省下极低费用优先发送完整评测集。
- 阿里云百炼 / DashScope 对中文有吸引力，但 2026-09 的新 embedding 文档要求 workspace-aware endpoint；待首轮结果不足时再增加 adapter，避免先扩大凭证与区域配置面。
- 本地开源模型仍可作为无外发回退，但本阶段不引入大型模型下载或 Python / GPU 工具链；字符 hash 只负责评测下限。

这不是永久排除。若 Voyage / Cohere 均不能明显越过基线，再扩充候选。

## 7. 凭证操作边界

当前进程未检测到任何候选 provider key，因此没有真实文本被发送给 embedding 厂商。

完成 Batch 1B 至少需要下列两个环境变量：

```text
VOYAGE_API_KEY
COHERE_API_KEY
```

要求：

- 在本机安全设置并重启 Agent / 终端，使新进程继承变量；
- 不在聊天中粘贴 key；
- 不写 `.env`、代码、Git、截图或命令历史；
- 不使用 `VITE_` 前缀；
- 只给当前评测使用，完成后可撤销。

## 8. Batch 1B Gate

拿到两个本机环境变量后：

1. 重跑工程基线；
2. 运行 Voyage 512；
3. 运行 Cohere 512；
4. 运行 `npm run embeddings:compare`；
5. 人工检查每个 case 的 top neighbours，尤其是关键词伪相关；
6. 若一方明显胜出，选默认与回退；
7. 若结果接近，比较 1024 维或增加 OpenAI / DashScope，而不是凭品牌选择；
8. 更新 `docs/08`，完成 Batch 1 commit。

在此 Gate 前，不能把 lexical baseline、mock adapter 测试或厂商宣传材料写成真实模型通过。
