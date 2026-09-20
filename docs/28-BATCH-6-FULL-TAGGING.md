# V3 Batch 6：全量标签生产实况

> 日期：2026-09-20
>
> 状态：in progress；候选、双模型复核与全量审计管线已建立，消费者 snapshot 尚未重建
>
> 数据范围：local-only 4,663 条 / 130 本 / 56 个稳定 Topic Tag

## 1. 目标与边界

Batch 6 为全部真实划线生成可续跑、可审计的标签建议。无法可靠归类的划线继续保留 `draft`，不为了地图覆盖率强贴标签。既有 300 条试标是独立 baseline，不被自动生产覆盖；其中 294 条 reviewed、6 条 draft。

模型、分数、候选、全文审计和缓存全部留在 `.private/tags/batch6/`。消费者 snapshot、public snapshot 和运行时均不包含 reranker、置信度、理由或私有 note。

## 2. 当前管线

1. `tags:full:generate`：使用稳定词表种子、294 条 reviewed 示例、跨书近邻、词面证据和本机 embedding 为 baseline 外 4,363 条生成 top-10 候选；固定按稳定 highlight ID 分为 18 批，每批最多 250 条。
2. `tags:full:reranker:evaluate`：在既有 294 条 reviewed 试点上评测本机 `Xenova/bge-reranker-base@280bcc2-q8`；模型只在本机运行。
3. `tags:full:rerank`：对每条 top-10 候选做“标签定义 → 完整划线”的本机交叉编码打分，结果只写入私有缓存。
4. `tags:full:review`：只把 embedding high 且 primary 位于 reranker 前二的结果升级为 reviewed；生成项只保留一个强支持标签，多标签候选继续留在 draft 等待边界复核。
5. `tags:full:audit`：输出标签分布、单书集中度、过宽 / 过薄检查、自动 reviewed 风险排序和逐标签 reviewed / draft 全文样本。

## 3. 评测与失败路径

首轮 embedding 诊断复用 294 条试点，只能作为诊断而非独立 held-out：

- top-1 命中：75.5%；
- exact set：32.7%；
- mean precision / recall：70.7% / 59.2%；
- top-10 覆盖全部实际标签：88.1%；
- embedding high top-1：91.0%。

本机 reranker 不能独立承担分类：其单独 top-1 只有 52.0%，因此没有替代 embedding。它只作为第二模型否决器：在 embedding high 且 primary 位于 reranker 前二时，试点 top-1 为 94.4%。

曾尝试把第一轮自动 reviewed 结果加入训练继续传播；全文抽样发现政治史文本被系统性泛化为「改革 / 宣传控制」，因此该 refinement 已回滚，不进入当前 assignments。

## 4. 当前结果

当前 `.private/tags/assignments.json`：

- 总计：4,663；
- reviewed：1,318；
- draft：3,345；
- preserved baseline：300；
- provenance：ensemble 875 / lexical 11 / override 429 / human 3 / unresolved 3,345；
- 全文审计 override：累计 312 条决定，覆盖高风险确认、错误修正、多标签边界收缩和 158 条最强 draft 晋升；
- reviewed 标签数分布：单标签 980 / 双标签 244 / 三标签 94，平均 1.33 个。

全量审计发现：

- 自动 reviewed 风险分 `>= 5`：0；已全文确认的项目改为 `override` provenance，不再反复进入自动风险队列；
- thin tag：0；
- broad tag：0；
- 单书集中标签：2 个（「精力」「货币」），集中来源与书名主题一致，但最终分布仍需复核；
- 逐标签强 / 中 / 弱代表样本发现并修正了顺带关键词、否定表述、文学描写和多标签过度扩张；
- 最强 draft 边界逐条阅读全文后晋升 158 条，其余低信心内容继续保留 draft；当前仍是中间状态，不得直接宣称 Batch 6 完成。

私有证据：

- `.private/tags/batch6/calibration.json`
- `.private/tags/batch6/reranker-evaluation.json`
- `.private/tags/batch6/full-audit.json`
- `.private/tags/batch6/review-sample.md`

## 5. 验证

- `npm run check:local`：typecheck、lint、300 单测 / 32 文件、现有 local snapshot 校验通过；
- `npm run tags:full:override`：累计 312 条全文决定原子应用，结果为 1,318 reviewed / 3,345 draft；
- `npm run tags:full:audit`：自动 high-risk 0；thin 0 / broad 0 / 单书集中 2；
- 当前 local snapshot 仍保持 Batch 3 的 294 reviewed 试点，因此校验中的 4,369 条未标注 warning 是预期状态，不代表 Batch 6 assignments 已消费。

## 6. 下一步

1. 继续按标签和书籍检查剩余 draft 边界，优先处理跨书可验证且不依赖词面偶合的条目；
2. 复核「精力」「货币」单书集中和低计数标签的跨书代表性；
3. 不再使用自动 reviewed 自训练传播；无法可靠确认的内容继续保留 draft；
4. 完成 assignment validator、Tag Studio 与真实数据 smoke；
5. 只有质量 Gate 通过后才重建 local snapshot、路径投影和最终地图布局。

public export、public covers、repo、push、workflow 和部署仍未获授权，也未执行。
