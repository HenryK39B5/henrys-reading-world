# V3 Batch 6：全量标签生产实况

> 日期：2026-09-20
>
> 状态：completed；内容质量 Gate 已关闭，消费者 snapshot、路径投影与最终地图已重建，等待最终地图体验 / 视觉 Gate
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

## 4. 最终结果

最终 `.private/tags/assignments.json`：

- 总计：4,663；
- reviewed：1,694；
- draft：2,969；
- reviewed coverage：36.3%；
- preserved baseline：300；
- provenance：ensemble 875 / lexical 11 / override 805 / human 3 / unresolved 2,969；
- 全文审计 override：累计 688 条决定，覆盖高风险确认、错误修正、多标签边界收缩与四轮最强 draft 边界复核；
- reviewed 标签数分布：单标签 1,020 / 双标签 434 / 三标签 240，平均 1.54 个。

全量审计结论：

- 自动 reviewed 风险分 `>= 5`：0；已全文确认的项目改为 `override` provenance，不再反复进入自动风险队列；
- thin tag：0；
- broad tag：0；
- 单书集中标签：3 个（「精力」「货币」「宣传控制」），来源分别与专书主题和政治史材料分布一致；
- 逐标签强 / 中 / 弱样本与多轮 draft 停止线复核修正了顺带关键词、否定表述、文学描写和多标签过度扩张；
- 停止线之后的最高分 draft 已稳定出现词面偶合、否定语境和现有词表无法可靠概括的内容，因此剩余 2,969 条保持 draft，不再以覆盖率为目标继续扩张。

私有证据：

- `.private/tags/batch6/calibration.json`
- `.private/tags/batch6/reranker-evaluation.json`
- `.private/tags/batch6/full-audit.json`
- `.private/tags/batch6/review-sample.md`

## 5. 消费者重建与验证

- `npm run tags:full:override`：累计 688 条全文决定原子应用，结果为 1,694 reviewed / 2,969 draft；
- `npm run tags:full:audit`：自动 high-risk 0；thin 0 / broad 0 / 单书集中 3；
- `npm run snapshot:local`：1,694 条 reviewed 导出标签与 16 维路径投影，2,969 条 draft 保持空 `tagIds`；
- `npm run map:layout`：4,663 点 / 56 标签中心 / 624 条等高线段；layout hash `567534bf71bfc5f6266ceb8ecd26267c4399888d87a1d606fed784a03d9fcd9e`；
- `npm run check:local`：typecheck、lint、300 单测 / 32 文件、最终 schema 3 local snapshot 校验通过；
- `npm run smoke:local`：6 / 6；
- `npm run test:tags`：连续两次 10 / 10；
- 消费者 Chromium 地图 / 小径 / 隐私 / 键盘：18 / 18；
- `npm run build` 与 `npm run isolation:public`：public 空快照构建通过，产物不含真实内容、私有标签字段、模型缓存或凭证探针；
- 最终截图：`.private/review/v3-batch6/`，覆盖 1440 / 390 / 320 世界、区域与移动详情。

## 6. 下一步

Batch 6 内容质量 Gate 已关闭。当前停在最终地图体验 / 视觉 Gate，与用户共同检查全量区域密度、标签层级、移动详情和长区域列表，再决定最后一轮产品级视觉调整。

public export、public covers、repo、push、workflow 和部署仍未获授权，也未执行。
