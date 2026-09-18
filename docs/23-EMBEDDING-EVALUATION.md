# 23 — V3 Batch 1：私有 embedding 基础与厂商评测

> 日期：2026-09-18
>
> 状态：**Batch 1 已完成。** 已建立 provider-neutral 私有管线，并使用同一组 300 条真实划线完成 SiliconFlow 三模型对比。默认模型为 `BAAI/bge-large-zh-v1.5`，回退为 `BAAI/bge-m3`。
>
> 本文是 Batch 1 的历史实况。Batch 2 已在用户授权后完成到词表 Gate，见 `docs/24-BATCH-2-TAG-DISCOVERY.md`；仍不授权 Batch 3、正式公开导出、运行时模型、push 或部署。用途与边界见 `docs/19–20`。

## 1. 本阶段回答的问题

Batch 1 只回答：

1. 如何安全、可恢复、可比较地为真实划线生成私有 embedding；
2. 哪个模型对当前中文真实语料“够用”；
3. 当模型失败时，哪些判断必须留给人工标签与 Studio。

它没有开始标签词表、全量标签生产、schema 3、主题小径或世界地图 UI。

## 2. 私有参考材料整理

用户提供的材料已复制到项目内私有参考目录，桌面原文件保持不动：

```text
.private/reference/providers/siliconflow/embedding-models-overview.md
.private/reference/weread-products/微读助手-1.jpg
.private/reference/weread-products/微读助手-2.jpg
.private/reference/weread-products/微读助手-3.jpg
.private/reference/weread-products/微读助手-4.jpg
.private/reference/weread-products/随手摘.png
.private/reference/README.md
```

这些文件被 `.gitignore` 排除，只作为模型选择和产品研究输入，不进入 public build。`flomo-starmap.png` 是一般视觉参考，不属于“基于微信读书 skill 的产品截图”，因此没有混入该目录。

## 3. 已实现基础设施

命令：

```powershell
npm run embeddings:prepare
npm run embeddings:baseline
npm run embeddings:evaluate -- --provider siliconflow --model <model> --dimensions <n>
npm run embeddings:compare
npm run embeddings:neighbours -- --provider siliconflow --model <model> --dimensions <n>
```

实现能力：

- provider-neutral TypeScript 接口；
- Voyage、Cohere、OpenAI、SiliconFlow adapter；
- SiliconFlow 固定调用 `https://api.siliconflow.cn/v1/embeddings`；
- 凭证优先读取进程环境变量，也可从 Git ignored `.env` 中只读取当前 provider 对应的变量；
- SiliconFlow 接受官方大写 `SILICONFLOW_API_KEY`，并兼容用户当前的 `SiliconFlow_API_KEY`；
- 所有 `VITE_*` key 明确拒绝；
- 文本使用 `NFC + LF` 的版本化输入规范；
- local snapshot 与每条文本使用 SHA-256 hash；
- 批量、限流等待、429 / 5xx 重试、失败续跑与原子缓存；
- provider / model / dimensions / snapshot hash / token 用量 / 成本估算 / 请求数写入 `.private/embeddings/`；
- 终端只输出数量、指标、耗时、成本和错误类别，不打印向量、完整原文、密钥或厂商错误正文；
- 私有 neighbour report 才包含完整原文，用于人工检查；
- comparison 只比较相同 corpus 与相同人工 case，不自动批准标签或发布内容。

SiliconFlow 官方接口中，BGE 模型使用固定维度；`dimensions` 只发送给支持自定义输出维度的 Qwen3 Embedding 系列。

## 4. 真实评测集

`npm run embeddings:prepare` 从 `.private/local-snapshot.json` 确定性生成：

```text
300 条真实划线
130 本书全部覆盖
14 个 Book Theme 全部覆盖
短 105 / 中 88 / 长 107
28,067 个非空白字符
22 个人工语义 case
```

人工 case 位于 `.private/embeddings/evaluation/labels.json`，覆盖：

- 跨书明确相关；
- 相邻概念边界；
- 相同关键词但语义不同；
- 随机性、风险、等待、权力、孤独、死亡、亲密关系、选择、恐惧、自由、幸福、意义、记忆、概率、财富、市场自我控制、睡眠等真实材料。

指标：

- Mean Reciprocal Rank；
- Recall@5 / Recall@10；
- 正例与人工 hard negative 的 pair accuracy；
- top-10 跨书多样性；
- 正负相似度与 margin 只用于单模型诊断，不直接跨模型比较。

## 5. 非语义下限

字符 unigram / bigram lexical hash 只验证 corpus → cache → metrics → report 全流程，不是候选 provider：

```text
MRR                 0.1863
Recall@10           0.4091
Pair accuracy       0.5238
Book diversity@10   0.9318
```

三个真实模型都明显超过该下限。

## 6. SiliconFlow 三模型结果

同一组 300 条、22 case、1024 维：

| 模型 | 定位 | MRR | Recall@10 | Pair accuracy | Book diversity@10 | 综合工程分 |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| `BAAI/bge-large-zh-v1.5` | 中文特化、固定 1024 维 | **0.4734** | **0.7727** | **0.9524** | **0.8818** | **0.7821** |
| `Qwen/Qwen3-Embedding-0.6B` | 低价 Qwen3、可变维度 | 0.4467 | 0.7273 | 0.8571 | 0.8409 | 0.7143 |
| `BAAI/bge-m3` | 多语言、长上下文、固定 1024 维 | 0.3804 | 0.6818 | 0.9048 | 0.8227 | 0.7000 |

调用摘要：

```text
BAAI/bge-large-zh-v1.5       300 inputs / 10 requests / 28,367 tokens
BAAI/bge-m3                  300 inputs / 10 requests / 19,620 tokens
Qwen3-Embedding-0.6B         300 inputs / 10 requests / 17,960 tokens
Qwen 评测估算费用             ¥0.0012572
```

两款 BGE 在用户提供的平台模型清单中标为免费；费用描述不是账单凭证，正式全量生成前仍应查看 SiliconFlow 当时定价。

## 7. 人工 neighbour review

已为每个模型生成 22 case × top-10 私有报告：

```text
.private/embeddings/evaluation/neighbours/
```

人工观察：

- `bge-large-zh-v1.5` 在不确定性、随机性、孤独、死亡与新生、意义、记忆重构、交易中的自我控制、睡眠与精力等案例中，前几名大多形成可解释的概念邻域；
- 它能明显压低“随机数字”“自由市场修辞”“宝贵财富”“统计意义上的死亡”等关键词伪相关；
- `Qwen3-Embedding-0.6B` 在政治权力、亲密关系等个别 case 更强，但在 hard-negative 稳定性上不如中文 BGE；
- `bge-m3` 的整体检索排名较低，但长上下文、多语言与稳定免费定位使它适合作为回退；
- 三个模型都不能替代人工定义标签。风险社会化、政治权力、机会、个人自由、信任等边界 case 仍会因标签定义或正例选择不同而改变排序；
- 邻域中存在“同一本书 / 同一种写法”聚集，后续多样性抽样和主题小径仍必须先执行书籍公平约束。

评测集本身也有边界：22 case 足以做厂商 / 模型筛选，不足以证明所有未来标签质量。Batch 2 词表与 Batch 3 试标仍要建立新的内容 Gate。

## 8. 默认与回退

### 默认：`BAAI/bge-large-zh-v1.5`

理由：

- 当前真实语料是中文；
- 三项主要质量指标均为第一；
- hard-negative 分离最稳定；
- 当前划线最大 398 字，适合该模型官方 512-token 上限；
- 用户提供的 SiliconFlow 清单标为免费；
- 1024 维对 4,663 条语料的本机缓存与地图处理规模可接受。

### 回退：`BAAI/bge-m3`

理由：

- 同平台、同 API、无需新增凭证；
- 8K context，适合作为未来输入规范变化或更长文本的回退；
- 多语言能力更宽；
- pair accuracy 仍明显高于 lexical 下限；
- 用户提供的清单标为免费。

### 保留候选：`Qwen/Qwen3-Embedding-0.6B`

不作为第一回退，但保留用于：

- 将来测试 256 / 512 维压缩；
- 地图布局对维度敏感时作低成本对照；
- BGE 服务状态或模型上下线变化时快速切换。

## 9. 数据与凭证边界

- 用户已明确授权将项目相关真实划线发送给该 embedding API；
- 本次只发送最小化划线文本和模型参数，没有发送账号标识、微信原始 bookId / bookmarkId、secret 状态、publication policy 或 API key 以外的凭证；
- stable highlight ID 只用于本机缓存映射，没有放入 API 请求；
- `SiliconFlow_API_KEY` 只从 Git ignored `.env` 读取到当前 Node 进程，未输出、未写入缓存、报告、代码、Git 或 public build；
- vectors、manifest、comparison、neighbour report 全部位于 `.private/embeddings/`；
- public / local 消费者运行时仍为 0 模型请求。

## 10. Batch 1 Gate 结论

- [x] provider-neutral 接口；
- [x] 私有凭证与 `VITE_*` 拒绝；
- [x] 批量、重试、续跑、hash 缓存与 manifest；
- [x] 300 条真实 corpus；
- [x] 至少两个候选在同一评测集可比较；
- [x] 默认模型与回退已选；
- [x] lexical mock 未冒充真实 provider；
- [x] private vectors / reports 不进 Git / public；
- [x] public build 无外部模型请求；
- [x] 人工 neighbour review 已完成。

Batch 1 当时完成后按 Gate 停止；用户随后明确要求进入 Batch 2。Batch 2 的全量 embedding、300 条多样性样本、第一版候选词表与用户 Gate 见 `docs/24`。

## 11. 官方接口依据

- <https://api-docs.siliconflow.cn/docs/api/embeddings-post>
- <https://cloud.siliconflow.cn/models>

官方 API 当前列出的文本模型包括 BGE 与 Qwen3 Embedding 系列；Qwen3 支持可选 `dimensions`，BGE 使用模型固定维度。模型、价格和服务状态可能变化，重建前必须重新核对。
