# 08 — 执行记录与 Prototype Review

## 当前真实状态

| 项目 | 状态 | 说明 |
| --- | --- | --- |
| 产品基线 | V3 Batch 0–6 已完成 | 产品 / 施工以 `docs/19–22` 为准，Batch 1–6 实况见 `docs/23–28`；最终 local 地图已重建，等待体验 / 视觉 Gate |
| 开发文档 | 已准备 | 用户追加“只用真实数据”已纳入 |
| Codex skill 移植 | 完成 | 项目 `.agents/skills/weread-skills/`，原安装未改 |
| skill 版本 | 1.0.4 | 官方更新包已审查，项目约束已重新应用 |
| 只读辅助脚本 | 已建立并执行 | `scripts/weread-request.ps1`、`scripts/weread-fetch-highlights.ps1` |
| 微信读书连接 | 已验证 | notebooks / shelf / bookmarklist 均实际调用成功 |
| 已取数据 | 已全量抓取 | 笔记本全部分页：132 本有笔记；已抓 130 本划线约 4,700 行 |
| 私密状态 | 已获开发授权 | 323 个书架条目均 secret=1；用户已授权全部书籍用于开发 |
| 真实划线原文 | 已获取并全量入库 | 候选池与 schema 3 local-only 快照均为 4,663 条（8–400 字去重后）；1,694 条 reviewed 带 Topic Tag，2,969 条 draft 不造标签 |
| 全部书籍开发授权 | 已批准 | 包括私密阅读；取消 6 本限制 |
| 本机开发快照 | 已生成 | `.private/local-snapshot.json`：4,663 条 / 130 本 / 14 个书籍主题书架 / 56 个 Topic Tag，visibility=local-only；1,694 条 reviewed 带 16 维路径投影；全部 4,663 条带最终独立地图点位 |
| 前端工程骨架 | 已完成（Slice 0） | React 19 + TS 6 + Vite 8；严格数据校验、仅本机隔离 |
| 文字舞台（Slice 1） | 已完成 | 真实句子为视觉中心；三档排版；导航（3 项待开放）；160/280ms 转场 |
| 换句交互（Slice 1） | 已完成 | 状态机 + 快速连点防重入 + reduced-motion 即时切换 + 单一 aria-live |
| 策展序列（Slice 2） | 已完成 | Opening / Contrast / Surprise / Exploration、评分、去重优先、cycle 重置、book scope |
| Surprise 机制修订 | 已按用户反馈调整 | 去掉“距今年份”分支，改为“换书 + 带来本次会话未出现过的主题”的领域意外 |
| 出处展开（Slice 3） | 已完成 | 原位展开、真实收录计数、再看一处 / 收起、焦点回归、耗尽与单条明确说明 |
| 书籍 / 主题 / About（Slice 4） | 已完成 | 书籍区与书详情、5 个主题的跨书连线、真实年份筛选与空交集处理、真实计数 About |
| 导航 | V3 五项主导航 + 地图次入口已开放 | 随机 / 主题书架 / 主题小径 / 所有书 / 关于为主导航；小径、书房与地图区域提供 `/map` 入口 |
| 浏览器验证 | Batch 5E 全量重跑 | Playwright + Chromium（本机）：**115 个 local 消费者用例** + **10 个 Tag Studio** + **9 个审核器** + **1 个 public 空态**；地图视觉取证 3 / 3 |
| 本机检查 | Batch 5E 全绿 | `check:local`：typecheck + lint + **295 个单测（31 文件）** + schema 3 数据校验；Batch 5 的 `verify:ids`、6 个真实数据 smoke、public build、`isolation:public` 与 local-private build 拒绝继续有效 |
| 视觉检查（Astra） | 已执行 | 1440 / 390 实际截图；发现并修正孤字成行、26px 点击目标、出处行间距、移动端书目节奏 |
| 评审证据工具 | 已建立 | `npm run capture:review`：截图 + 可读数字（字号 / 行数 / 对比度 / 点击目标 / 溢出 / 延迟）|
| 封面与色彩（视觉修复） | 已完成 | 127 张真实书封下载到 `.private/covers/`；`local-covers/` 仅由 dev:local 服务；每本书主色从封面实时提取并降饱和 |
| 连续换句录屏 | 有意不做 | 见下方“证据策略” |
| 公开构建 | 已执行 | `npm run build` 成功；local 模式构建被拒绝；公开快照当前为空 |
| 发布审核清单 | 已完成两轮审核 | 私有 policy：108 本公开 / 22 本排除 / 6 条单独排除，`reviewComplete=true`，private preview `releaseReady=true` |
| 可公开快照 | 仍未生成 | `src/data/public-snapshot.json` 保持 0 本 / 0 条；正式 export、public covers、repo、push 与部署留给后续 Release-B～E |
| 数据覆盖缺口 | 已更新 | 真实划线无原始换行样本（唯一剩余警告）；年份仅 2024–2026；V2-A 后已不再限于 30–50 条样本 |
| Product Critique #1 | 已完成方向评审 | 用户确认：不以塑造 Henry 印象为算法目标；改为全量真实划线的轻松漫游、书籍主题书架与公平两阶段抽样 |
| v2 施工准备 | 已完成 | 最新产品决定见 `docs/10`，迁移与验收路线见 `docs/11` |
| V2-A 全量数据与 schema 2 | 已完成 | 4,663 条 / 130 本 / 14 个书籍主题书架；v1 的 46 条与 20 本 ID 原封保留；详见下方 V2-A 执行记录 |
| V2-B 公平发现算法 | 已完成（含复核修复） | 两阶段公平引擎 + all/theme 持久 scope + 分 scope cycle；真实数据首次 130 次抽完全部 130 本且 0 重复；复核后收紧为“多书时排除当前书”硬规则；详见下方 V2-B 执行记录与复核修复 |
| Product Critique #2 | 已完成方向评审 | 用户确认房间式结构、Book Aura 色彩归属、返回保留现场与轻盈呼吸动效；见 `docs/12` |
| V2-C1 房间路由与现场记忆 | 已完成 | 六个真实路径、每房间独立舞台会话、批次与滚动记忆；149 单测 / 34 Playwright；详见下方 V2-C1 执行记录 |
| V2-C2 Book Aura 与呼吸动效 | 已完成（含复核修复） | 真实封面环境色、房间进入/换句 700ms、reduced-motion；最终 local Playwright 总数 44；详见下方记录 |
| V2-D 全量分批浏览 | 已由 Release-A1 接管单书入口 | 书库 12→130 保留；单书顺序列表已迁移为有限随机轮，4,663 条可达契约由每书一轮的并集证明 |
| V2-E1/E2/E3 | 已完成并独立复核 | 深链、固定 ID 分享、复制失败、200%/键盘/privacy 均成立；基线 `a8083ef` |
| V2-E4 交接准备 | 已执行完毕 | 交接 Prompt 为 `docs/16-V2-E4-SHARE-CARD-VISUAL-IMPLEMENTER-PROMPT.md`；E4A/E4B/E4C/E4D 均已实现、测试并提交 |
| Release-A 公开审核准备 | 已执行完毕 | V2-E4E、有限随机书籍轮、书级 publication policy/单条排除/封面开关、本机审核器与私有 preview 均已实现并验收；详见下方 Release-A1～A4 四节；权威 `docs/17`，Prompt `docs/18` |
| V3 Batch 0 顶层设计 | 已完成 | 新增 `docs/19–22`，重置权威顺序并完成产品、标签 / 地图、视觉与施工顶层设计；Release-B 暂停，未改代码 / schema / 快照 |
| V3 Batch 1 embedding 评测 | 已完成并迁移到本机 | SiliconFlow 三模型结果保留为历史对照；当前默认 `Xenova/bge-large-zh-v1.5@a48549b-q8-cls`，同集综合分 0.7810，4,663 条本机向量已完成，后续不再发送新的划线文本 |
| V3 Batch 2 标签发现 | 已完成并获用户批准 | 全量 4,663 条 embedding、300 条按书公平样本、53 个私有候选标签、35 组边界、159 条人工种子；用户已批准完整词表进入 Batch 3 |
| V3 Batch 3 稳定词表与试标 | 已收口 | 56 个稳定标签；14 条用户意见全部处置（3 条直接应用、11 条 Agent 判定、待决 0）；300 条试标 294 reviewed / 6 draft；0 孤儿、0 过宽，唯一偏薄「运气」有全语料 64 条 / 23 本证据 |
| V3 Batch 4 schema 3、小径与视觉 | 已完成，用户体验 Gate 已通过 | 294 条 reviewed 投影为 56 条真实小径；公平有限轮、可关闭语义节奏、岔路保持当前句、Back 恢复、全部标签分享及 1440 / 390 / 320 视觉基础完成；详见 `docs/26` |
| V3 Batch 5 世界地图 | 已完成方向 / 功能 Gate，等待最终视觉 Gate | 4,663 点固定 seed 地图、56 个主题区域、Canvas、详情、Book Aura、语义列表与恢复完成；Batch 6 后最终布局已重建；详见 `docs/27` |
| V3 Batch 6 全量标签 | 已完成 | 1,694 reviewed / 2,969 draft；688 条全文 override；自动 high-risk 0；snapshot、路径投影与最终地图已重建；详见 `docs/28` |
| 真实访客 Gate | 未进行 | 用户本人体验反馈非常积极（V2-E4D 就是其反馈驱动的收尾），但尚无首次访客结果，不冒充产品 Gate 通过 |

原始返回、更新包、候选池、快照与截图全部留在 `.private/`，已被 `.gitignore` 排除，未进入前端包。

## V3 Batch 0 — 权威重置与顶层设计（2026-09-18）

```text
日期 / 执行者：2026-09-18 / 当前实现 Agent
范围：V3 Batch 0 — 产品方向、标签 / 小径 / embedding / 地图规格、视觉方向、实施计划
状态：verified（文档与工程基线）；视觉页面与 embedding 尚未开始
代码基线：6b6e0a0
```

### 完成范围

1. 新增 `docs/19-PRODUCT-DIRECTION-V3.md`：确认只专注微信读书真实划线；书是房间、书架是街区、标签是线索、小径连接房间、多标签划线形成岔路；产品采用一个 Reading World、Public/Local 两个数据范围和一个 Local Studio。
2. 新增 `docs/20-TAGS-PATHS-MAP-SPEC.md`：区分 Book Theme 与 Highlight Topic Tag；标签每条 1–3 个且地位平等；定义受控词表、分批内容生产、私有 embedding 边界、按书公平优先的小径算法、岔路保留当前句、三层世界地图、点亮一本书、全部标签分享与 schema 3 草案。
3. 新增 `docs/21-V3-VISUAL-DIRECTION.md`：将审美作为核心产品能力；方向为纸、墨、光与地形；保留文字中心与 Book Aura，允许全局视觉重构；明确小径、地图、分享、动效、响应式与视觉 Gate。
4. 新增 `docs/22-V3-IMPLEMENTATION-PLAN.md`：Batch 0–8；下一步为私有 embedding 厂商评测，不是 Release-B；用户只参与标签词表、小径、地图、最终公开与部署等真实 Gate。
5. 更新 `AGENTS.md`、README、PRODUCT_BRIEF、`docs/02/03/07/09/10/11/12/17/18`：旧文档作为历史保留，冲突处由 V3 取代；修正 `docs/03` 中仍残留的 schema 1 示例为当前 schema 2。
6. 用户提供的五张划线产品宣传图和一张 flomo 认知地图只用于视觉 / 产品分析，未复制到项目、Git 或 public 产物。

### 已锁定的顶层判断

- 不为追求差异化而追求差异化；优先做最适合真实材料的产品。
- 取消“核心标签 / 连接标签”区别；同一划线的 Topic Tag 平等。
- embedding 用于标签发现、标注辅助、地图与小径软节奏；不做独立类似划线、AI 搜索、问答或运行时模型。
- 小径先公平选书，再在书内使用 embedding 控制近 / 中 / 远跳跃；无 embedding 稳定降级。
- 世界地图展示全部点作为地形，但总览低 DOM；标签赋予人工策展名称，多标签点形成山口；书籍可使用 Book Aura 在地图中亮起。
- Public World 与 Local World 共用消费者体验；完整私有内容、搜索、标签 / embedding / 地图诊断和出版控制属于 Local Studio。
- 分享卡片与纯文本显示全部 Topic Tag，自然换行，不截断为 `+N`。
- 既有 108 / 22 / 6 公开决定不重开；新增标签和地图在正式 export 前补充审核；Release-B 暂停。

### 实际命令与结果

| 命令 | 结果 |
| --- | --- |
| `npm run check:local` | **248 单测 / 19 文件**；typecheck、lint、schema 2 local 校验通过；唯一警告仍为无原始换行样本 |
| `npm run verify:ids` | 20 本 / 46 条种子 ID 仍指向同一真实材料；总量 4,663 / 130 |
| `npm run smoke:local` | **6 / 6** 真实数据 smoke 通过 |
| `npm run test:public` | **1 / 1** public 空态 E2E 通过 |
| `npm run build` | public build 成功；public snapshot **0 本 / 0 条** |
| `npm run isolation:public` | clean；真实书名 / 划线 / coverPath 均 0，policy / review / 凭证探针 absent |
| `npx vite build --mode local-private` | 按预期退出 1：`Local mode cannot be used for a production build.` |
| `git diff --check` | 通过 |
| Markdown 本地链接 / 尾随空白 | **0 / 0** |

### 数据与发布状态

- local snapshot 未修改：schema 2，4,663 条 / 130 本 / 14 个 Book Theme；
- publication policy 未修改：108 publish / 22 exclude / 6 单条 exclude，`reviewComplete=true`；
- public snapshot 未修改：schema 2，0 本 / 0 条；
- 未生成 embedding、标签分配、地图坐标或 schema 3；
- 未创建 repo、remote、workflow；未 push、deploy 或复制 public covers。

### 浏览器与视觉证据

Batch 0 没有修改产品代码或样式，因此未生成新的浏览器截图，也未把旧截图冒充 V3 视觉通过。视觉方向依据当前真实页面、既有本机证据和用户提供的参考图完成；真实 V3 门厅 / 小径 / 地图截图属于 Batch 4–5。

### 未验证项

- V3 标签词表、embedding 厂商、路径节奏与地图布局均尚未实现或实测；
- V3 视觉只完成方向，没有页面原型；
- 真机移动端与 Safari 继续未验证；
- schema 3 与 public tag / map isolation 尚未开始。

### 下一步

按 `docs/22` 停止在 Batch 0 汇报；不自动启动 Batch 1。下一批是私有 embedding 基础与免费 / 低成本厂商真实语料评测。

## V3 Batch 1A — 私有 embedding 基础与真实评测集（2026-09-18）

```text
日期 / 执行者：2026-09-18 / 当前实现 Agent
范围：Batch 1A — provider-neutral 管线、缓存 / 续跑、真实 corpus、人工 case、非语义基线
状态：verified（基础设施）；Batch 1B blocked by local provider credentials
代码基线：2871ee4
```

### 完成范围

1. 新增 `scripts/embeddings/` 纯 TypeScript 基础：版本化文本规范、SHA-256 text / snapshot hash、cosine、严格 vector 检查、私有路径、评测选择与指标。
2. 新增 Voyage / Cohere / OpenAI adapter：固定官方 endpoint、批量、429 / 5xx 重试、token usage、可选成本估算；拒绝空 key 与 `VITE_*` key；错误不读取或打印厂商响应正文。
3. 新增 `embedding-prepare.ts`：从 schema 2 local snapshot 确定性抽取 300 条，全部 130 本 / 14 个 Book Theme，短中长覆盖；人工 case 中的 ID 强制入集。
4. 新增 `.private/embeddings/evaluation/labels.json`：22 个由完整真实划线人工核对的跨书相关、近义边界、关键词伪相关 case；原文与理由均不进 Git。
5. 新增增量 `embedding-evaluate.ts`：只补缺失 / text hash 变化项，每批原子保存，失败可续跑；向量、manifest、报告只写 `.private/embeddings/`。
6. 新增 `embedding-compare.ts`：至少两份真实 provider 报告才比较；统一指标权重只作为工程辅助，不自动选厂商或批准标签。
7. 新增字符 unigram / bigram lexical hash 下限，验证 corpus → cache → metrics → report 全流程；明确它不是 embedding 候选。
8. 更新 public isolation 探针，新增 Voyage / Cohere / OpenAI key、private embedding 路径与 labels 文案检查。
9. 新增 `docs/23-EMBEDDING-EVALUATION.md`，记录厂商短名单、当前价格 / 免费额度核对、命令、数据边界与凭证 Gate；更新 AGENTS、README、`docs/07`。

### 真实评测集

```text
300 条真实划线
130 本书
14 个 Book Theme
短 105 / 中 88 / 长 107
28,067 个非空白字符
22 个人工语义 case
```

人工 case 覆盖随机性、风险、等待、权力、孤独、死亡、亲密关系、选择、恐惧、自由、幸福、意义、记忆、概率、财富、市场自我控制与睡眠等；每个 case 只记录 stable ID、类别和私有简短理由。

### Lexical 下限

```text
MRR                 0.1863
Recall@10           0.4091
Pair accuracy       0.5238
Book diversity@10   0.9318
```

这组数据仅证明评测管线能抓住字面重合并暴露关键词伪相关。正式模型必须明显改善 retrieval 与 hard-negative 分离，不能把此结果写成 provider 通过。

### 实际命令与结果

| 命令 | 结果 |
| --- | --- |
| `npm run check:local` | typecheck、lint、**256 单测 / 21 文件**、schema 2 local 校验通过；唯一警告仍为无原始换行 |
| `npm run verify:ids` | 20 本 / 46 条种子 ID 稳定；总量 4,663 / 130 |
| `npm run smoke:local` | **6 / 6** 真实数据 smoke 通过 |
| `npm run embeddings:prepare` | 300 条 / 130 本 / 14 书架；105 / 88 / 107；22 case |
| `npm run embeddings:baseline` | 私有 lexical report 成功；指标如上 |
| `npm run embeddings:evaluate -- --provider voyage` | 按预期在请求前退出 1：`VOYAGE_API_KEY is not set` |
| `npm run embeddings:evaluate -- --provider cohere` | 按预期在请求前退出 1：`COHERE_API_KEY is not set` |
| `npm run embeddings:compare` | 按预期退出 1：尚无两份真实 provider report |
| `npm run test:public` | **1 / 1** public 空态 E2E 通过 |
| `npm run build` | public build 成功；0 本 / 0 条 |
| `npm run isolation:public` | clean；新增 3 个 embedding key 与 private embedding 探针均 absent |

### 浏览器与视觉证据

Batch 1A 只增加私有 scripts、测试和文档，没有修改消费者 UI、审核器 UI 或样式。因此不生成新截图，也不重复运行 104 个 local 浏览器用例来冒充 embedding 质量证据。public 空态 E2E 用于确认脚本未污染浏览器入口。

### 公开隔离与数据状态

- 没有 provider key，因此 **0 条真实划线发送给 embedding 厂商**；
- 私有 corpus、labels、vectors、reports 全部位于 `.private/embeddings/`；
- public snapshot 仍为 schema 2、0 本 / 0 条；
- local snapshot、publication policy、stable ID、划线原文均未修改；
- 未生成正式 embedding、Topic Tag、schema 3 或地图坐标；
- 未新增运行时网络请求、public dependency、repo、remote、push 或部署。

### 当前凭证 Gate

完成 Batch 1B 需要用户在本机安全设置并让新 Agent / 终端进程继承：

```text
VOYAGE_API_KEY
COHERE_API_KEY
```

不得把 key 粘贴到聊天、写入 `.env` / 代码 / Git 或使用 `VITE_` 前缀。第一轮固定比较 `voyage-4-lite` 与 `embed-v4.0` 的 512 维；若两者都未明显越过 lexical 下限，再扩第三候选，不凭品牌选型。

### 下一步

等待本机凭证后继续同一个 Batch 1：运行两家真实评测、人工检查 top neighbours、选择默认与回退、完成最终 Gate 和独立 commit。Gate 未完成前不进入 Batch 2 标签词表。

## V3 Batch 1B — SiliconFlow 三模型真实评测（2026-09-18）

```text
日期 / 执行者：2026-09-18 / 当前实现 Agent
范围：Batch 1B — SiliconFlow adapter、真实 API 评测、neighbour review、默认 / 回退选择
状态：verified
代码基线：8caea7c
```

### 用户输入与私有材料整理

1. 用户指定改用已有 SiliconFlow API key，并明确允许通过该平台调用 embedding 模型。
2. 只检查工作目录 `.env` 中 `SiliconFlow_API_KEY` 存在且非空；没有输出或复制 key。
3. 桌面原文件保持不动，复制到 Git ignored 私有参考目录：
   - `.private/reference/providers/siliconflow/embedding-models-overview.md`；
   - `.private/reference/weread-products/微读助手-1.jpg`～`微读助手-4.jpg`；
   - `.private/reference/weread-products/随手摘.png`；
   - `.private/reference/README.md` 记录来源和边界。
4. `flomo-starmap.png` 不是微信读书 skill 产品截图，因此没有混入该目录。

### 实现范围

- 新增 `siliconflow` provider，固定官方 endpoint `https://api.siliconflow.cn/v1/embeddings`；
- 支持官方 `SILICONFLOW_API_KEY` 与用户现有 `SiliconFlow_API_KEY`；
- 若进程环境没有 key，只逐行检查 `.env` 中当前 provider 的允许变量，不加载或输出其他值；
- `VITE_*` 变体继续明确拒绝；
- BGE 固定维度请求不发送 `dimensions`；Qwen3 系列才发送；
- 成本报告改为显式 USD / CNY，不再假定所有 provider 都按美元；
- 新增 `embeddings:neighbours`，将每个 case 的完整 query、正负例排名与 top-10 写到 `.private`，终端不打印原文；
- public isolation 增加 SiliconFlow 两种 key 名探针；
- 更新 `docs/23` 为 Batch 1 最终实际报告。

### 同集实测结果

同一组 300 条 / 130 本 / 14 Book Theme / 22 case，全部 1024 维：

| 模型 | MRR | Recall@10 | Pair accuracy | Book diversity@10 | 工程综合分 |
| --- | ---: | ---: | ---: | ---: | ---: |
| `BAAI/bge-large-zh-v1.5` | **0.4734** | **0.7727** | **0.9524** | **0.8818** | **0.7821** |
| `Qwen/Qwen3-Embedding-0.6B` | 0.4467 | 0.7273 | 0.8571 | 0.8409 | 0.7143 |
| `BAAI/bge-m3` | 0.3804 | 0.6818 | 0.9048 | 0.8227 | 0.7000 |
| lexical 下限 | 0.1863 | 0.4091 | 0.5238 | 0.9318 | 不参与 provider 选择 |

调用摘要：

```text
bge-large-zh-v1.5   300 inputs / 10 requests / 28,367 tokens
bge-m3              300 inputs / 10 requests / 19,620 tokens
Qwen3-0.6B          300 inputs / 10 requests / 17,960 tokens
Qwen 估算费用       ¥0.0012572
```

### 人工 neighbour review

- 三模型均生成 22 × top-10 私有报告；
- `bge-large-zh-v1.5` 在不确定性、随机性、孤独、死亡 / 新生、意义、记忆、交易自控和睡眠等 case 中形成最稳定的中文概念邻域；
- 它能压低随机数字、自由市场修辞、宝贵财富、统计学死亡等关键词伪相关；
- `Qwen3-0.6B` 在政治权力、亲密关系等少数 case 更强，但 hard-negative 稳定性较弱；
- `bge-m3` 总体排名较低，但 8K context、多语言与同平台免费定位适合作回退；
- 风险社会化、政治权力、机会、个人自由、信任等 case 继续显示人工标签边界的重要性；embedding 不自动决定 Topic Tag；
- 邻域仍会受同书 / 同写法影响，Batch 2 多样性抽样和未来小径必须继续先满足按书公平。

### 决定

- 默认：`BAAI/bge-large-zh-v1.5` / 1024 维；
- 回退：`BAAI/bge-m3` / 1024 维；
- 保留低价对照：`Qwen/Qwen3-Embedding-0.6B` / 1024 维；
- 不再为厂商榜单继续扩测。当前结果已达到“中文真实语料够用、成本可接受”的 Batch 1 目标。

### 数据与凭证状态

- 本次 API 请求只包含最小化划线文本、模型与必要参数；没有发送 stable ID、书 ID、账号标识、原始微信字段、publication policy 或私有 note；
- API key 未进入终端输出、缓存、报告、Git 或 public build；
- vectors、manifest、comparison 与 neighbour reports 全部位于 `.private/embeddings/`；
- public / local 消费者代码未增加模型请求；
- local snapshot、stable ID、publication policy 与 public snapshot 均未修改；
- 未开始 Topic Tag、schema 3、地图或 Batch 2。

### 实际命令与结果

| 命令 | 结果 |
| --- | --- |
| `npm run embeddings:evaluate -- --provider siliconflow --model BAAI/bge-m3 --dimensions 1024 --batch-size 32` | 300 / 300，10 requests；MRR 0.3804 / R@10 0.6818 / pair 0.9048 |
| `npm run embeddings:evaluate -- --provider siliconflow --model Qwen/Qwen3-Embedding-0.6B --dimensions 1024 --batch-size 32 --price-per-million-tokens 0.07 --price-currency CNY` | 300 / 300，10 requests；估算 ¥0.0012572；MRR 0.4467 / R@10 0.7273 / pair 0.8571 |
| `npm run embeddings:evaluate -- --provider siliconflow --model BAAI/bge-large-zh-v1.5 --dimensions 1024 --batch-size 32` | 300 / 300，10 requests；MRR 0.4734 / R@10 0.7727 / pair 0.9524 |
| 同一 bge-large 命令重跑 | exit 0，**0 个新 batch**，验证 text-hash cache / 失败续跑路径 |
| `npm run embeddings:compare` | 三模型同集比较成功；bge-large-zh-v1.5 综合分 0.7821 第一 |
| `npm run embeddings:neighbours ...` | 三份 22 case × top-10 私有完整原文报告生成成功 |
| `npm run check:local` | typecheck、lint、**259 单测 / 21 文件**、schema 2 local 校验通过；唯一警告仍为无原始换行 |
| `npm run verify:ids` | 20 本 / 46 条种子 ID 稳定；总量 4,663 / 130 |
| `npm run smoke:local` | **6 / 6** 真实数据 smoke 通过 |
| `npm run test:public` | **1 / 1** public 空态 E2E 通过 |
| `npm run build` | public build 成功；0 本 / 0 条 |
| `npm run isolation:public` | clean；SiliconFlow 两种 key 名、private embeddings 与真实内容均 absent |
| `npx vite build --mode local-private` | 按预期退出 1，保持原保护错误原文 |
| 凭证反向扫描 | tracked / untracked source **0 命中**；`.private/embeddings` **0 命中**；`.env` 与 private references 均被 Git ignore |

### 浏览器与视觉证据

本阶段只修改私有脚本、测试和文档，没有消费者 UI / CSS 变化，因此不生成视觉截图。public 空态与 build / isolation 用于证明 provider 代码没有进入浏览器产品路径。

### 下一步

Batch 1 完成后停止汇报，不自动进入 Batch 2。下一批将用默认模型为 4,663 条建立全量私有 embedding，并据此生成 250–300 条按书公平、多样性覆盖的标签发现样本，随后建立第一版标签词表与用户 Gate。

## V3 Batch 2 — 标签发现与词表 Gate（2026-09-18）

```text
日期 / 执行者：2026-09-18 / 当前实现 Agent
范围：全量 embedding、多样性样本、开放归纳、候选词表、人工种子与边界 Gate
状态：实现与私有内容生产 verified；等待用户词表 Gate
代码基线：53aaf00
```

### 完成范围

1. 新增 `embeddings:generate`：复用 Batch 1 默认模型与同一 text-hash cache，从 300 条评测缓存增量补齐全部 4,663 条；每批原子保存，失败可续跑。
2. 新增 `tagDiscovery.ts` 与 `tags:sample`：每书先选 embedding 中心点，再选书内语义边缘；按主 Book Theme 轮转补足第三条，每书最多三条。
3. 实际发现样本为 300 条 / 130 本 / 14 Book Theme；中心点 130、语义边缘 111、主题补位 59；短中长 111 / 138 / 51。
4. 新增确定性 spherical k-means 辅助报告：36 簇、farthest-first 初始化；簇只用于观察局部邻域和离群，不等同标签或 assignment。
5. 在 `.private/tags/candidate-vocabulary.json` 建立 53 个候选标签、6 个内部概念家族、定义 / includes / excludes / aliases 和 35 组相邻边界。
6. 新增 `tags:seeds`：对候选定义生成私有 query embedding，从全量语料按书去重召回每标签 8 条，共 424 条，并为每组边界生成交界候选。
7. 人工阅读候选和全文检索后建立 159 条策展种子：每标签 3 条、来自三本不同书；自动邻居未被冒充为人工通过。
8. 新增 `tags:audit`：严格检查词表规模、family 引用、种子存在性、每标签跨三书、候选按书去重、弱召回与种子重叠观察项。
9. 新增 `docs/24-BATCH-2-TAG-DISCOVERY.md`；候选名称、完整定义、向量、原文、理由和 Gate workbook 继续只保留在 `.private/tags/`。
10. public / local 消费者、schema 2、publication policy、public snapshot 与稳定 ID 均未修改。

### 内容结果与真实诊断

```text
全量向量                    4,663 / 4,663
标签发现样本                  300
书籍覆盖                     130 / 130
Book Theme                   14 / 14
候选标签                      53
内部概念家族                    6
相邻边界                      35
embedding 候选种子            424
人工复核种子                  159
```

- 8 个候选的定义 query top-5 平均 cosine 低于内部观察线；全文关键词复核仍确认跨书材料，因此保留到试标，不用单一相似度删词；
- 11 组标签的 top-8 种子重叠至少三条，优先在试标中判断应合并还是允许多标签共存；
- 关系类词语可召回软件“依赖关系”等伪相关，证明 Batch 3 不得自动接受 nearest neighbours；
- 36 个簇大小不均衡，包含单点与较大混合簇；如实保留，不把聚类修饰成天然标签体系；
- 当前建议先保留 53 个候选进入 250–300 条试标，再以真实频次、跨书覆盖、多标签比例和边界冲突决定合并 / 删除。

### 实际命令与结果

| 命令 | 结果 |
| --- | --- |
| 首次 `npm run embeddings:generate -- --provider siliconflow --model BAAI/bge-large-zh-v1.5 --dimensions 1024 --batch-size 32` | 从 300 条补齐 4,363 条；最终 4,663 / 4,663 |
| 同命令重跑 | `newly requested: 0`；cache / resume 验证通过 |
| `npm run tags:sample` | 300 条 / 130 本 / 14 书架；每书 1–3；短中长 111 / 138 / 51 |
| `npm run tags:clusters` | 36 个私有语义簇；无空簇 |
| `npm run tags:seeds` | 53 标签 / 424 候选种子 / 35 边界 |
| `npm run tags:audit` | 159 人工种子；每标签 3 条、三本不同书；8 个弱召回 / 11 组重叠观察项 |
| `npm run check:local` | typecheck、lint、**263 单测 / 23 文件**、schema 2 local 校验通过；唯一警告仍为无原始换行 |
| `npm run verify:ids` | 20 本 / 46 条种子 ID 稳定；总量 4,663 / 130 |
| `npm run smoke:local` | **6 / 6** 真实数据 smoke 通过 |
| `npm run test:public` | **1 / 1** public 空态 E2E 通过 |
| `npm run build` | public build 成功；0 本 / 0 条 |
| `npm run isolation:public` | clean；private tags 文件名、向量、凭证和真实内容均 absent |
| `npx vite build --mode local-private` | 按预期退出 1，保持原保护错误原文 |
| 凭证反向扫描 | source 0 命中；private embeddings / tags 0 命中；`.private` tracked 0 |

### 浏览器、视觉与数据状态

- 本阶段没有消费者 UI / CSS 变化，因此不生成视觉截图；
- public 空态 E2E 与 isolation 只证明私有内容生产工具未进入产品构建，不冒充主题小径体验验收；
- local snapshot 仍为 schema 2、4,663 条 / 130 本 / 14 Book Theme；
- public snapshot 仍为 schema 2、0 本 / 0 条；
- publication policy 仍为 108 publish / 22 exclude / 6 条单独 exclude；
- API 请求只发送划线正文或候选定义文本与模型参数，没有发送 stable ID、书 ID、账号字段、policy 或私有 note；
- API key 未进入终端、缓存、报告、代码、Git 或 public build。

### Gate 与下一步

Batch 2 停在用户词表 Gate。用户需要审核名称 / 定义、相邻边界、缺失主题、过宽 / 过细标签，并明确是否允许进入 Batch 3。批准前不开始 Local Tag Studio、250–300 条正式试标、schema 3、主题小径或地图。

### Gate 结果（已关闭）

2026-09-18，用户回复“批准全部候选进入 Batch 3 试标”：53 个候选标签全部保留，不要求改名、合并或删除，直接作为稳定词表进入试标。详见下方 Batch 3 记录。

## V3 Batch 3 — 稳定词表、私有试标与 Local Tag Studio（2026-09-18）

```text
日期 / 执行者：2026-09-18 / 当前实现会话（用户指定接手）
范围：词表升级、assignments 契约、300 条试标、结构审计、Local Tag Studio、合并 / 改名
状态：实现与浏览器验收 verified；等待用户内容 Gate
代码基线：fa2b56a
```

### 完成范围

1. 新增 `src/domain/topicTags.ts`：稳定词表与 assignment 的严格契约；1–3 个平等标签；`draft | reviewed` 状态；confidence、rationale、candidates、flags 均限定在私有层；仅提供 `updateHighlightAssignment` 与 `migrateMergedTag` 两个变更入口。
2. 新增 `tags:promote`：将用户批准的 53 个候选标签一次性升级为 `tag-001…tag-053` 稳定 ID，并写入词表哈希与 `ct-0NN → tag-NNN` 迁移表；候选发现 ID 不再进入后续阶段。
3. 新增 `tags:trial:generate`：seed-centroid + query 集成打分，按标签自身分布标准化，并对标签名 / alias / includes 命中给予词面证据；输出候选、信心与标记。
4. 新增 `tags:trial:review`：对 300 条逐条全文复核——接受、依词面证据修正、或显式保留 `draft`；不猜无法支撑的标签。
5. 新增 `tags:trial:audit`：输出 reviewed / draft、1–3 标签分布、多标签比例、信心分布、每标签书籍数与划线数、零覆盖 / 过宽 / 偏薄标签、机器一致性与待复核清单。
6. 新增 `tags:studio`（Vite `tag-studio-private`，127.0.0.1:5175）与 `src/tagStudio/`：完整原文、按状态 / 信心 / 标记 / 来源 / 家族筛选、ID / 原文 / 书名 / 标签搜索、候选一键采纳、定义与边界对照、标记为待定、私有理由、整份校验后原子保存；任何在界面上改过的条目 `provenance` 自动变为 `human`。
7. 新增 `src/app/privateTagPaths.ts`：`READING_WORLD_TAG_DIR` 可在进程级重定向词表与试标路径，使自动化测试绝不覆盖真人正在看的文件；仍不接受任何请求参数。
8. 新增 `tags:migrate`：标签合并与改名，合并后重新校验整份试标；改名保留稳定 ID，因此不改动任何 assignment。
9. 新增 `e2e/tag-studio/studio.spec.ts`（10 个用例）与 `playwright.tag-studio.config.ts`；新增 `e2e/tag-studio-absent.spec.ts`（2 个用例）证明产品模式下读不到、也写不了试标。
10. 扩展 `scripts/check-public-isolation.ts`：新增 Studio 入口、两个路由、词表 / 试标 / 审计 / 候选文件名、私有理由与标记探针。
11. 新增 `docs/25-BATCH-3-TAG-STUDIO.md`；完整原文、候选分数、理由与审计报告只在 `.private/tags/`。

### 审核材料（Gate 前补充）

首次完成后发现审核材料有两个真实缺口，因此补做：

1. 私有契约增加结构化 `provenance`（`ensemble | lexical | override | unresolved | human`），使「谁做的决定」不再靠匹配散文；`unresolved` 与 `human` 让“机器提议”与“人的决定”永不混淆。
2. 每条理由改为中文并记录可核对的事实：override 写明模型原提议与分数，lexical 写明命中的具体词；无法归类的条目写明为何撑不起任何标签。
3. 新增 `tags:review-queue` 生成 `.private/tags/review-queue.md`：把待审从 300 条压缩到 121 条，并按 A（必须决定）→ E（控制组抽查）排序。

补充后数字未变：200 / 50 / 18 / 32，需要人工过目 100 条。

### 试标真实结果

```text
试标总数                300
reviewed / draft        268 / 32
1 / 2 / 3 个标签        145 / 86 / 69
多标签比例              51.7%
信心 high / medium / low  79 / 189 / 32
标签覆盖                53 / 53
零覆盖 / 过宽 / 偏薄       0 / 0 / 3
全部标签在 embedding top-5  269
没有任何标签在 top-5        22
人工 override / 词面证据    68
```

诚信记录：

- 268 条 `reviewed` 是机器辅助 + 逐条全文复核，**不是 Henry 本人逐条审核**；
- 32 条明确保留 `draft`，集中在原文单独无法支撑任何标签的条目，没有为了凑齐比例强行贴标；
- 68 条与 embedding 提议不同，是正确性风险最高的子集；
- 偏薄标签为 `运气`（1 本）、`幸福`（2 本）、`道德`（2 本），留给用户决定补种子、合并或接受低覆盖；
- 50% 以上条目带两个以上标签，说明岔路是常态，Batch 4 的小径算法必须真的支持交叉。

### 实际命令与结果

| 命令 | 结果 |
| --- | --- |
| `npm run tags:promote` | 53 个稳定标签 / 6 个家族；词表哈希 `2ff42201…` |
| `npm run tags:trial:generate` | 300 条候选；1 / 2 / 3 = 163 / 68 / 69 |
| `npm run tags:trial:review` | 300 条全文复核；268 reviewed / 32 draft |
| `npm run tags:trial:audit` | 53 / 53 覆盖；0 孤儿；0 过宽；3 偏薄 |
| `npm run check:local` | typecheck、lint、**265 单测 / 24 文件**、schema 2 local 校验通过 |
| `npm run verify:ids` | 20 本 / 46 条种子 ID 稳定；总量 4,663 / 130 |
| `npm run smoke:local` | 6 / 6 真实数据 smoke 通过 |
| `npm run test:e2e` | **106 / 106**（原 104 + 2 个 Studio 缺席用例） |
| `npm run test:tags` | **10 / 10**（真实快照 + `.private/review/batch-3/test-tags/` 试标副本） |
| `npm run test:publication` | 9 / 9 仍通过 |
| `npm run test:public` | 1 / 1 public 空态通过 |
| `npm run build` | public build 成功；0 本 / 0 条 |
| `npm run isolation:public` | clean；Studio 入口、路由、词表 / 试标 / 审计文件名与私有字段全部 absent |
| `npx vite build --mode local-private` | 按预期退出 1 |
| `npx vite build --mode tag-studio-private` | 按预期退出 1 |
| 凭证反向扫描 | source 0 命中；private / 测试副本 0 命中；`.private` tracked 0 |

两处测试失败已定位为**测试写法**问题而非产品缺陷：Playwright 的 `check()` / `uncheck()` 会断言状态发生变化，而 Studio 故意拒绝 0 标签与第 4 个标签；改为 `click()` 并显式断言状态不变后通过。

### 浏览器与视觉证据

- Studio 的浏览器验收覆盖：真实 300 条列表与计数、五种筛选、修改后保存并刷新仍然生效、1–3 标签上下限、标记为待定、契约校验 422、跨源写入 403、产品文档不引用 Studio。
- 产品模式缺席用例覆盖：在 5173 上读不到词表 / 试标、写不进任何内容，Studio 文档在此模式下会进入错误态而不是显示数据。
- 本阶段**没有**为 Studio 生成截图：它是本机内容工具，不是产品界面，截图不能冒充小径或视觉验收；`docs/22 §7.4` 的视觉原型仍属于 Batch 4。

### 未验证项

- Henry 本人尚未审核 300 条试标；
- 32 条 draft 的处理方式未定；
- 三个偏薄标签未处理；
- 标签定义在边界处是否足够区分，只有 300 条证据；
- 真机移动端与 Safari 继续未验证（Studio 不做移动端验收）；
- 尚未产生 schema 3、小径、地图或分享改动。

### 执行者交接

用户在 Batch 3 开始时指定由当前会话接手继续；该会话的运行环境报告 `PI_MODEL=deepseek-flash`、`PI_PROVIDER=cc-switch-deep-seek`。此前项目记录的“暂不交给 DeepSeek v4.1 Flash”已被本次用户决定取代。接手时未回退或覆盖前任会话的产物；Batch 3 的契约、脚本、Studio、测试与文档均为本次新增。

### 下一步（已被下方 2026-09-18 更新取代）

原计划要求用户审核试标抽查、draft 与偏薄标签后再进入 Batch 4。用户随后明确表示该工作量不适合逐条人工处理；新的 Agent-owned 收口规则见下一节。

## V3 Batch 3C — 本机 embedding 迁移与审核责任收回（2026-09-18）

```text
当前实现环境：PI_MODEL=gpt-5.6-sol / PI_PROVIDER=openai-codex
起点提交：680a397
用户私有修改：.private/tags/review-queue.md（保留，未覆盖）
```

### 完成范围

1. 检查 Clash Verge：`verge-mihomo.exe` 监听 `127.0.0.1:7897`；5MB Hugging Face 实测直连约 479KB/s，显式代理约 277KB/s，因此不强制全局代理。模型下载已断点完成。
2. 新增 `local` embedding provider：`@huggingface/transformers@4.3.0`、固定 revision `a48549b…`、q8 ONNX、CLS pooling、L2 normalize；模型标识包含 revision / dtype / pooling，防止错误缓存复用。
3. 首轮误用 mean pooling，评测仅 0.6533；修正 CLS 后同集综合分 0.7810，几乎追平 SiliconFlow 0.7821。错误报告保留作防回归证据。
4. 本机生成全量 4,663 条：复用评测集 300、补齐 4,363，175 个本机 batch，约 29 分 15 秒，外部文本请求 0。
5. `tags:sample`、`tags:clusters`、`tags:seeds` 与 `tags:trial:generate` 默认全部切换到 local cache；远程 adapter 只保留历史复现能力。
6. 新增 `tags:review-import`：只读导入用户已经写入审核 Markdown 的 14 条，不修改原文件；输出 source hash 与结构化意见到 `.private/tags/user-review-notes.json`。
7. 新增 `tags:review-apply`：只应用完全落在已批准词表内的决定；3 条变为 `human`，11 条词表外建议完整保留给 Agent 判定，避免静默丢词或只采用一半。
8. 用户审核责任正式收回：29 条 draft、50 override、16 lexical 与三个偏薄标签由 Agent 处理；用户只在真正的新标签 / 合并 / 产品语义冲突时参与。

### 实际结果

```text
local evaluation       MRR 0.4655 / R@10 0.7727 / pair 0.9524 / diversity 0.8864
comparison score       local 0.7810 / SiliconFlow historical 0.7821
full local vectors     4,663 / 4,663
trial after migration  271 reviewed / 29 draft
provenance             ensemble 202 / override 50 / lexical 16 / unresolved 29 / human 3
coverage               53 / 53；orphan 0 / broad 0 / thin 3
user notes             14 imported / 3 applied / 11 vocabulary candidates
```

### 当前边界与下一步

- 不删除历史 SiliconFlow 缓存或 `.env`，也不读取 / 显示密钥；只停止新的远程文本调用。
- 不要求用户继续填写 `.private/tags/review-queue.md`。
- 下一步由 Agent 对 11 个词表外建议做全语料证据审计，处理 29 条 draft 与三个偏薄标签；完成并回归后连续进入 Batch 4。
- public snapshot 仍为空；未授权正式导出、repo、push 或部署。

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

1. 主题划分与标题已获用户确认（5 个：随机与运气 / 交易与自我克制 / 权力与体制 / 向内寻找 / **金钱与价值**；“金钱的位置”已按用户意见改名）。
2. 敏感题材真实划线（如 `c-0001`、`c-0008`，已标 `reviewNote`）本机开发保留；用户决定**先进行本机开发，公开发布时再处理这个事项**。已登记到下方“公开发布前待处理事项”。

## Slice 1 执行记录（已完成）

```text
日期 / 执行者：2026-09-12 / 实现 Agent
Slice / task IDs：Slice 1 — T10 / T11 / T12
状态：verified（工程与交互）；产品体验判断留待 Critique #1
数据模式与用户许可依据：真实数据 local-only；快照 46 条 / 20 本 / 5 主题
```

**完成内容**

- T10 舞台：品牌、四入口导航（书 / 主题 / 关于暂标为不可用，不留死链接）、真实句子舞台、出处行（书名・作者・模糊年份）与 `再来一句` 控件。
- T11 三档真实排版：短 28–52px / 中 24–40px / 长 20–30px，按去空白字符数分档；行宽约 30 个汉字；`pre-wrap` 保留原文换行与标点；不截断、不省略、不缩小到不可读。
- T12 转场：纯函数状态机 `idle → exiting(160ms) → 提交 → entering(280ms) → idle`；转场中重复点击一律丢弃（不排队、不闪烁、不叠字）；`prefers-reduced-motion` 时直接提交、不进入转场；单一 `aria-live="polite"` 区域同时报出句子与出处。
- 时间表达：只根据已审核年份生成模糊措辞（今年 / 一年前 / 来自 N 年前 / 很久以前），年份缺失则不提时间。
- 未做（按计划属于后续切片）：出处展开（Slice 3）、分享与稳定链接（Slice 5）、真正的策展算法（Slice 2，当前用 `selectSequential` 占位且已在代码与文档标明）。

**主要修改文件**：`src/domain/{selection,sequence,encounter,timeLabel}.ts`(+2 test)、`src/features/encounter/{EncounterStage.tsx,useEncounter.ts,stage.css}`、`src/app/{App.tsx,ReadingWorldPage.tsx,Nav.tsx,page.css}`、`src/styles/global.css`、`e2e/slice-1.spec.ts`、`e2e/slice-0.spec.ts`（随舞台落地更新）。

**实际命令 → 结果**

| 命令 | 结果 |
| --- | --- |
| `npm run check:local` | 全绿：typecheck + lint + **46 用例 / 7 文件** + 数据校验（1 条已知覆盖警告） |
| `npx playwright test` | **10/10 通过**（Slice 0 两个 + Slice 1 八个） |

**浏览器实测项（Chromium，真实数据）**

- 首屏：首条真实划线 + 出处 + 控件；`.stage-text` 在任意时刻只有 1 个节点。
- 不自动换句：静止 1.6s 文本不变。
- **20 次同一任务内连点 → 只前进一步**，期间 `aria-disabled=true`、焦点保持在按钮、转场结束后恢复为 false。
- 键盘 Enter 可触发换句；reduced-motion 下 900ms 内完成且从未停在 exiting 阶段。
- 短 / 中 / 长 三档在 1440px 下均可读、无横向溢出、无截断；320px 无横向溢出、按钮高度 ≥44px。
- aria-live 区域全页仅 1 个。
- 证据（私有，不上传）：`.private/review/slice-1/band-{short,medium,long}-1440.png`、`mobile-390.png`。

**偏差 / 待判断**

1. 导航的 `书 / 主题 / 关于` 当前以 `aria-disabled` 呈现，不做假链接；Slice 3–4 落地后改为真链接（`src/app/Nav.tsx` 一行开关）。
2. 页面底部的“数据覆盖提示”是仅本机模式的开发辅助，不在公开发布范围；移入 Gate 2 前需确认是否保留。
3. 当前选句顺序是占位的快照顺序（Slice 1 为了先验证排版与手感）；这**不是**产品算法，Slice 2 将按 `docs/04` 替换。

**未验证 / 缺口**

- 转场动画的实际观感（160/280ms 是否最好）需要人眼判断，列在 Brief §17 开放问题上。
- 未做 200% 缩放、Safari / 真机与完整键盘遍历（计划在 Slice 5）。

## Slice 2 执行记录（已完成）

```text
日期 / 执行者：2026-09-12 / 实现 Agent
Slice / task IDs：Slice 2 — T20 / T21 / T22
状态：verified（算法与交互）；体验判断留待 Critique #1
数据模式：真实数据 local-only；全局舞台只从 43 条独立可读划线中抽样（18 本书）
```

**完成内容**

- `selectNext`：阶段按 `globalDrawCount` 划分（0 Opening / 1 Contrast / 2 Surprise / ≥3 Exploration），阶段内部按降级梯队，最后一梯队总是全候选集。
- 去重先于评分：先排除当前句与当前 cycle 已看；全部看完则新 cycle（优先排除历史最后 3 个 ID，必要时从最早者逐步放回）；池内只剩当前句时返回 `only-current`，不空转。
- 评分按 `docs/04 §5` 公式实现（quality / pinned / 不同书 / 主题不交叉 / 时间跨度 / 新鲜度 / 近期同书惩罚 / 重复曝光惩罚），随后按 `max(1, score)` 轮盘抽样；候选先按 ID 稳定排序，保证固定 RNG 可复现。
- 主题缺失不算反差；年份缺失不算“旧”；`standaloneReadable=false` 的内容不进入全局随机池（只出现在书 / 主题层，Slice 3–4）。
- book scope 已实现（同书内选取、越界返回 `exhausted-book`、不隐式重置全局 cycle），供 Slice 3 直接使用。

**主要修改文件**：`src/domain/serendipity.ts` + `serendipity.test.ts`、`src/features/encounter/useEncounter.ts`（默认选择器改为 `selectNextQuote`）、`EncounterStage.tsx`（新增 `data-commit-count` 诊断计数）、`ReadingWorldPage.tsx`、`e2e/slice-1.spec.ts`（改为不依赖固定顺序）、`e2e/slice-2.spec.ts`。

**实际命令 → 结果**

| 命令 | 结果 |
| --- | --- |
| `npx vitest run src/domain` | 59 用例通过（其中 serendipity 23 条） |
| `npm run check:local` | 全绿：typecheck + lint + **69 用例 / 8 文件** + 数据校验 |
| `npx playwright test` | **13/13 通过** |
| `npx playwright test e2e/slice-2.spec.ts --repeat-each=3` | **9/9 通过**（抽样稳定性） |

**浏览器实测项（真实数据）**

- 第一句：带 opening 标记、独立可读、20–120 字（tier 1 生效）。
- 第二句：**不同书**且与第一句主题不交叉。
- 第三句：再次换书（本次实际抽到《挪威的森林》，与前一则政治史类内容形成明显反差）。
- 连续 7 次换句无重复，`data-commit-count` 与实际提交次数一致（=7）。
- 连续 6 次展示涉及 ≥4 本书，且未出现相邻同书。
- 证据（私有，不上传）：`.private/review/slice-2/draw-{1,2,3}-*.png`。

**偏差 / 待判断**

1. 真实年份只跨 2024–2026，因此“距今年份 ≥3 年”的 surprise 分支无法被真实数据触发；实际触发走的是策展标记 `surpriseCandidate`。这不是 bug，但意味着“时间纵深”目前只能靠人工标记表达，Prove 阶段需真实访客判断是否可惜。
2. Exploration 阶段（第 4 句起）不再强制每三句一次 surprise，符合 `docs/04`；实际观感需要人眼确认。
3. 第 4 句以后没有“换主题”的硬约束，只靠评分中的主题不交叉加分；长期连看是否仍显得有节奏，待 Critique #1。

## Slice 3 执行记录（已完成）

```text
日期 / 执行者：2026-09-12 / 实现 Agent
Slice / task IDs：Slice 3 — T30 / T31 / T32
状态：verified（交互与无障碍）；封面上线待素材授权
数据模式：真实数据 local-only
```

**完成内容**

- T30 出处行改为 button（`aria-expanded` / `aria-controls="source-panel"`），原位展开 / 收起，不跳页；收起后焦点回到出处按钮。
- T31 面板内容：书名占位框（无本地可用封面时的真实书名排版）、书名作者、`这里收录了 N 处划线`（来自当前快照，非平台总量）。
- T32 `再看一处`：只在同书内选句，保持面板展开，**不消耗 globalDrawCount**；本书只有一条或已全部看过时，**点击前**即 `aria-disabled=true` 并给出原因，绝不静默跳书。
- 状态机新增 `sourceOpen` 与 `pendingScope`：全局换句在请求时即关闭面板；同书换句提交后保持展开；直接打开其他划线关闭面板。

**主要修改文件**：`src/domain/encounter.ts`(+6 test)、`src/features/encounter/{EncounterStage.tsx,useEncounter.ts,stage.css}`、`src/app/ReadingWorldPage.tsx`、`e2e/slice-3.spec.ts`。

**实际命令 → 结果**

| 命令 | 结果 |
| --- | --- |
| `npm run check:local` | 全绿：typecheck + lint + **76 用例 / 8 文件** + 数据校验 |
| `npx playwright test` | **19/19 通过**（Slice 0/1/2/3） |

**浏览器实测项（真实数据）**

- 展开 / 收起、键盘 Enter 开关、`aria-expanded` 与面板可见性一致。
- 收录数文案与快照实际值一致（如“这里收录了 2 处划线”）。
- `再看一处` 换句后 `bookId` 不变、面板保持展开、`data-commit-count` +1。
- 走完一本书的全部划线后：`source-note` 显示“这本书里收录的划线都看过了”，按钮禁用。
- 单条书目：提示“这本书目前只收录了一处划线”。
- 全局 `再来一句` 后：`data-source-open=false`，面板隐藏。
- 证据（私有，不上传）：`.private/review/slice-3/{source-open,next-in-book,book-exhausted}-1440.png`。

**偏差 / 待判断**

1. **未实现“查看这本书”按钮**：书籍区域属于 Slice 4，此时放置该按钮会产生死链接（与导航待开放项同一原则）。Slice 4 会在书籍区域落地时补上，并接到书详情。
2. **未使用真实书封与出版社简介**：需要本地可公开的封面素材与经审核的简介来源；当前用书名占位框 + 真实计数，不拉取外部图片、不编造简介。已登记为 PUB-06 / PUB-07。
3. 出处按钮的视觉重量（下划线 + “⌄”提示）是否够轻、是否够可发现，需要人眼在 review 时判断。

## Slice 4 执行记录（已完成）

```text
日期 / 执行者：2026-09-12 / 实现 Agent
Slice / task IDs：Slice 4 — T40 / T41 / T42 / T43
状态：verified（工程与交互）；体验判断留待 Critique #1
数据模式：真实数据 local-only；5 个主题均连接多本书
```

**完成内容**

- T40 书籍区：`最近留下的划线`（按划线年份，明确注明与读完时间无关），默认 5 本 + `查看全部收录书籍`；每本显示真实收录数；点开为书详情（本快照内全部划线，最多先显 6 条，可展开），标题可聚焦。
- T41 主题区：5 个主题，每主题显示真实 `N 处划线 · M 本书`；“每书优先”排序，展开后先显 4 条（跨书），最多 12 条，提示总数。
- T42 年份筛选：只提供快照中真实存在的年份；同时作用于书籍列表、主题列表与书详情；交集为空时给出解释与`清除筛选`；计数始终描述整个快照，不因筛选变化。
- T43 About：`这里收录了 46 处划线，来自 20 本书，集中在 2024–2026 年。` + 一句不评价阅读者的说明；无 KPI 卡片、无时长。
- 导航四项全部放开；出处面板新增`查看这本书`（接书详情并聚焦标题）；从列表选句后滚回舞台并移焦（`main[tabindex=-1]`）。

**主要修改文件**：`src/domain/world.ts` + `world.test.ts`、`src/features/world/{World.tsx,world.css}`、`src/app/{ReadingWorldPage.tsx,Nav.tsx}`、`src/features/encounter/EncounterStage.tsx`（查看这本书）、`e2e/slice-4.spec.ts`。

**实际命令 → 结果**

| 命令 | 结果 |
| --- | --- |
| `npm run check:local` | 全绿：typecheck + lint + **86 用例 / 9 文件** + 数据校验 |
| `npx playwright test` | **23/23 通过**（Slice 0–4） |

**浏览器实测项（真实数据）**

- 完整走通：句子 → 出处 → `查看这本书` → 书详情（标题聚焦）→ 选一条回舞台 → 主题 → 另一本书的相关划线。
- 书 / 主题计数与快照一致（如“这里收录了 4 处划线”“10 处划线 · 5 本书”）。
- 2024 筛选下书列表数量等于该年实际有划线的书数；书详情只显该年划线；某主题在该年为空时给出解释并可清除筛选。
- `查看全部收录书籍` 展开后条数等于全部有划线的书数。
- 导航`关于`链接可用，About 行包含真实总数与年份跨度。
- 证据（私有，不上传）：`.private/review/slice-4/{world,year-filter}-1440.png`。

**偏差 / 待判断**

1. 书详情默认显示 6 条（超过才出现展开按钮）；真实数据下最多 4 条/本，因此该按钮实际很少出现。是否需要在真实样本扩充后再评估。
2. 主题展开上限 12 条：`随机与运气` 实际有 10 条，刚好在限内；主题变多后需要重新评估“先看多少条”。
3. 年份筛选目前是全局的（同时影响书与主题）。若访客更希望它只作用于书籍，Slice 5 可调整。

## Critique #1 · 证据策略与视觉检查（2026-09-12）

### 证据策略：截图要，录屏不要

原计划要求“连续 3–5 次换句的短录屏”。用户指出：录屏主要是给有视觉能力的读者（另一个视觉模型或本人）看的，而实测可以直接开页面体验。因此改为：

- **截图**：做，供用户与视觉模型审阅。内容可传输：用户已确认开发阶段不把真实划线当作保密内容；如需可以发给外部模型拿意见。仍建议不把原始 API 回包、`WEREAD_API_KEY` 或账号字段外发。
- **录屏**：不做。换句手感改用可测量数字表达（提交延迟、转场阶段、连点去重），而“手感”本身由用户直接体验页面判断。
- **可复现**：`npm run capture:review` 一次跑出截图 + 数字，任何人（包括后续 DeepSeek）都能重跑；截图落在 `.private/review/`（仅为不污染仓库，不是保密要求）。

### Astra 视觉检查发现与处理

| 发现 | 严重度 | 处理 |
| --- | --- | --- |
| 22 字短句在 52px 下断成 20+2，“孤字成行” | 高 | 短句上限 52→46px；短句/中句加 `text-wrap: balance`，长句用 `pretty`；实测短句回到 1 行 |
| 最小可点击高度 26px（导航链接、文字按钮） | 高（自定 44px 标准） | 导航链接 / 文字按钮 / 年份 chip 均提升到 44px；加入回归断言（e2e 逐元素量高） |
| 出处行间距松散（`——`与书名、作者与时间均 8px gap） | 中 | gap 改 0，用紧贴与 6px 小间距；破折号命名类 `.dash` |
| 移动端书目行节奏不一致（作者有时在第一行） | 中 | 作者与收录数包入 `.book-meta`，≤640px 下书名独占一行 |
| 短句行宽仅 ~20 字（文档目标 26–32） | 低 | 字优先于行宽（短句本来就字少）；已在 docs/05 §2 记录这个取舍 |

### 实测数字（真实数据，Chromium）

- 三档字号/行数：短 46px·1 行、中 38px·4 行（~28 字/行）、长 30px·5 行（~28 字/行）。
- 横向溢出：320 / 390 / 768 / 1440 均为 **0px**。
- 最小点击目标：四档视口均为 **44px**。
- 对比度（对纸色）：正文 14.6:1、次要文字 5.62:1、标题 14.6:1，均过 WCAG AA。
- 换句提交延迟：211–240ms（退出 160ms + 提交）；reduced-motion 下 67–74ms 且不进入转场阶段。
- 20 次同任务连点：提交计数只 +1。
- 结构：1 个 aria-live、标题层级 H1→H2(x4)/H3、舞台文本节点恒为 1、无 `<img>`（未使用书封）。

**仍然只能由人判断的**：句子在留白中的位置是否“安静而不空”、转场观感、主题命名是否自然、以及是否真的产生“我好像稍微认识这个人一点了”。

## 视觉修复：从“平白”到有图有色（2026-09-12，用户反馈驱动）

用户看页面后的两点反馈：① 审美方向对，但“太平白”，没有色彩、没有好看的图；② 划线数量偏少。

### ① 色彩与图像的修复

诊断：这是执行偏差，不是设计选择。`PRODUCT_BRIEF §7` 写明“书封（此时才成为视觉锚点）”，但我没下载任何封面（封面是 CDN 远程 URL，而契约禁止远程资源），于是出处层用了竖排书名占位框；颜色也只留了一个 `#425A4B` 且仅在 hover 出现。

| 项目 | 做法 |
| --- | --- |
| 真实封面 | `npm run covers:fetch` 从已缓存响应取 `book.cover`，下载 **127 张**到 `.private/covers/`；不热链 CDN |
| 服务方式 | `local-covers/<file>` + `dev:local` 的 `/__local_cover/…` 路由；文件名模式校验，无目录穿越；公开构建仍不含任何封面 |
| 出现位置 | 出处层（124px 主图）、书籍列表（34px 小书脊）、书详情（96px） |
| 色彩来源 | 浏览器内 canvas 采样封面 → 降饱和（S 0.12–0.34、L 0.30–0.46） |
| 色彩用法 | 仅小面积：书脊左边线、书名下划线、主题圆点、封面外圈细光晕；**句子仍是纸底墨字**（P1 不破） |
| 回退 | 无封面时用真实书名的排版框；取色失败时回退到默认 accent |

新增：`src/domain/accent.ts`（纯函数：取色、降饱和、对比度）、`src/app/covers.ts`（采样缓存 + URL 解析）、`scripts/fetch-covers.ts`。

### ② 划线数量偏少的原因（已向用户解释）

46 条来自 `PRODUCT_BRIEF §9.4 / §13.1`（“30–50 条人工确认的样本”），那是为“样本需手写、逐条把关”的原型阶段设的量。代价已量化：46 条里 43 条可进舞台池 → **第 44 次点击开始重复**；书详情只有 1–4 条（《黑天鹅》实际有 157 条）。

已向用户提议改为三层：舞台池（人工挑选的独立可读强句）/ 书籍库（每本书全部已抓划线，上下文在页面上）/ 主题（策展，作用于已复核子集）。**等待用户决定是否扩大**。

## Critique #1 产品结论：停止人设策展，转向轻松漫游（2026-09-12）

### 用户反馈与决定

用户认可当前真实封面、低饱和色彩和文字中心的视觉方向，但明确反对进一步增强“策展叙事”：如果算法精心安排 Opening / Contrast / Surprise 或连续几句的主题回声来帮助访客形成 Henry 印象，产品会接近“人设打造”和表演。这个页面应是轻松、娱乐性的阅读社交空间，不以强吸引、教育意义、留存或访客人格判断为目标。

已确认的新方向：

- 尽可能让约 4,663 条真实划线全部进入产品并可到达；不再把 30–50 条精选配额当产品上限。
- 算法可以精心打磨，但优化**书籍分布公平、防重复、scope 持久和阅读节奏**，不优化代表性或叙事。
- 主题不做逐句人工标签、不引入 embedding；Agent 基于书名、作者和该书真实划线样本，为约 130 本书分配 1～3 个宽主题书架标签。
- 划线在筛选时继承书籍主题，但 UI 只说“来自这个主题书架中的一本书”，不声称具体句子语义属于主题。
- 句子舞台保留；主题成为持久浏览 scope：`随便看看 / 正在逛：<主题>`。选定主题后，`再来一句` 留在该主题，直到主动退出或换主题。
- 随机采用两阶段：先选书、再选句；不能让划线数量多的书按条数垄断曝光。
- “全部展示”解释为全部可达，而非同时渲染：舞台一次一条，主题页展示书架摘要，单书划线分批加载。
- 主题书架放在书籍之前；年份只作为书籍区工具；About 删除内部产品防御文案。
- 色彩与图像停在当前强度，不增加首屏封面、彩色背景或封面墙。

### 对旧方向的影响

`docs/04` 的 Opening / Contrast / Surprise、Highlight 上的质量与策展字段、逐句 topicIds，以及原 Slice 5 的直接开工顺序均已过时。当前代码保留作为可回归的 v1 基线；实现 Agent 必须先按 `docs/11` 完成 V2-A～V2-D，再进入分享与打磨 V2-E。

### 评审结论

- 视觉方向：通过，暂时锁定。
- v1 核心叙事目标：由用户主动撤回，不再验收“3～5 句后形成指定印象”。
- v2 产品方向：用户已同意进入探索与施工准备。
- 真实访客 Gate：未进行；迁移完成后用“是否轻松理解并能在全部/主题/书之间闲逛”评审，不以点击次数或人格描述作为成功 KPI。

## V2-A 执行记录（已完成）

```text
日期 / 执行者：2026-09-12 / 实现 Agent
Slice / task IDs：docs/11 §6 — V2-A（全量数据准备与 schemaVersion 2）
状态：verified（数据、契约、全量加载、构建隔离）；V2-B 的公平两阶段算法尚未开始
数据模式与许可依据：真实数据 local-only，开发授权见 docs/09 §1；公开快照仍为空
```

**完成内容**

- 稳定 ID：新增 `scripts/build-id-map-v2.ts`（`npm run idmap:v2`）→ `.private/curation/id-map-v2.json`。20 本书 / 46 条 v1 ID 原封保留，其余按 planIndex 与 (planIndex, candidateId) 稳定追加；重跑只追加、不重排。
- 书籍 dossier：新增 `scripts/build-book-dossiers.ts`（`npm run dossiers:v2`）→ 130 本，每本至多 12 条等距样本（共 1,066 条），不挑“最好”的句子；终端只报告数量，不打印原文。
- 主题书架：`.private/curation/book-themes.json`，14 个宽标签（小说与文学 / 政治与制度 / 历史与人物 / 投资与交易 / 概率与决策 / 经济与市场 / 财富与商业 / 心理与关系 / 自我与成长 / 哲学与意义 / 科学与技术 / 阅读与思考方法 / 社会观察 / 其他），每本 1 主 + 0～2 次；未使用 embedding、向量库或逐句分类。
- schema 2 契约：`types.ts` / `validate.ts` / `snapshot.ts` / `world.ts` 迁移；Highlight 只保留 `id / bookId / text / year`，主题移到 `Book.themeIds`，`themes[]` 取代 `topics[]`。
- 全量快照：`scripts/build-local-snapshot.ts` 重写，由候选池 + ID map + 书籍主题 + 封面索引生成 **4,663 条 / 130 本 / 14 个主题书架**；127 本有本地封面，3 本无封面（回退到真实书名排版）。新增 `.private/curation/snapshot-source-map.json` 保留全部可追溯性。
- 过渡选择器：v1 的 Opening / Contrast / Surprise 与编辑评分已从引擎移除；`serendipity.ts` 只保证“先去重、再换书、优先本次未出现过的书、同级均匀抽取”，并在注释中标明 V2-B 将以两阶段公平引擎取代。
- UI 兼容读取：主题列表改为书架语义（“主题按书籍归档”），读取模型 `topics` → `themes` 重命名；尚未做 IA 重排与主题舞台（属 V2-C）。
- 新增 ID 稳定性防线：`scripts/verify-id-stability.ts`（`npm run verify:ids`）以 v1 冻结的 source map 与原始候选池为基准，校验已发布 ID 永远指向同一条真实划线。

**实际数据规模**

| 项目 | v1 | v2（当前） |
| --- | ---: | ---: |
| 划线 | 46 | **4,663** |
| 书籍 | 20 | **130** |
| 主题 / 书架 | 5（逐句） | **14（书籍）** |
| 本地封面 | 20 | **127 / 130** |
| 年份 | 2024–2026 | 2024–2026 |
| 首屏 DOM | — | **0 条划线节点 / 5 行书目 / 14 行书架 / 193 个元素** |

**实际命令 → 结果**

| 命令 | 结果 |
| --- | --- |
| `npm run idmap:v2` | 130 本 + 4,663 条 ID，无重复 |
| `npm run dossiers:v2` | 130 本 dossier，1,066 条样本 |
| `npm run snapshot:local` | 4,663 条 / 130 本 / 14 书架；覆盖警告 1 条（无原始换行） |
| `npm run verify:ids` | 20 本 + 46 条 v1 ID 仍指向同一真实材料 |
| `npm run typecheck` / `lint` | 无错误 |
| `npm run test` | **87 用例 / 9 文件**全通过 |
| `npm run smoke:local` | 3 用例通过（全量快照 + 每本书都有书架 + 无原始字段） |
| `npm run validate:data:local` / `validate:data` | local 4,663 / 130 / 14 通过；public 空快照通过且无警告 |
| `npx playwright test` | **24/24 通过** |
| `npm run build` | 成功；dist 仅 3 个文件，无封面文件、真实内容或密钥标记（仅保留 `local-covers/` 路径前缀字符串） |
| `npx vite build --mode local-private` | 按预期拒绝，未生成产物 |

**浏览器实测（Chromium，全量真实数据）**

- 三档排版保持：短 46px·1 行、中 38px·4 行、长 30px·7 行；320/390/768/1440 横向溢出 0px；最小交互高度 44px。
- 对比度：正文 14.6:1、出处 5.62:1、标题 14.6:1。
- 换句提交 213–240ms；20 次同任务连点仍只前进一步；reduced-motion 即时且不进入转场。
- 首次绘制密度：0 条划线节点、5 行书目、14 行书架、193 个元素——库扩大约 100 倍，首屏体量几乎不变。
- 走通：句子 → 出处 → 查看这本书 → 书详情 → 选句回舞台 → 主题书架 → 另一本书的划线；书目与书架计数与快照一致；年份筛选在书架 / 书 / 空交集上行为正确。
- 12 次连续换句覆盖 ≥10 本不同书且无相邻同书（对应 v2 “不围着一本大书转”的目标）。
- 证据（私有）：`.private/review/critique-1/`；改动前的 v1 截图备份在 `.private/review/v2-before-capture/`。

**偏差 / 待判断**

1. **过渡选择器仍按划线条数加权**：两阶段公平抽样（先选书再选句）属 V2-B，已在 `serendipity.test.ts` 用一条明确标注的测试钉住当前行为，V2-B 落地时应改写它。
2. **长句可直接出现在舞台**：v1 用 `standaloneReadable` 把上下文依赖的长段落挡在舞台外，v2 允许全部可达；docs/10 §6 允许的“连续长句时优先非长句”机械规则尚未实现（V2-B）。
3. **主题展开仍是 12 条列表**：v2 计划中主题应进入舞台 scope，不做划线墙（V2-C）。
4. **年份仍然作用于主题**：docs/10 §8 计划让年份只作用于书籍（V2-C）。
5. **计数未加千位分隔**（“4663 处划线”）：随 V2-C 文案调整一起处理；当前保持与快照数字严格一致，便于校验。
6. 主题分类由 Agent 依据书名、作者与等距样本一次性生成，仍是本机初版；未做逐书人工复核（公开前登记在 PUB-02）。

**未验证 / 缺口**

- 真实访客体验评审仍未进行；不得就此宣称产品 Gate 通过。
- 公开快照仍为空；发布前仍需 PUB-01 内容范围、PUB-06 封面版权与多尺寸缩略图、PUB-04 引用长度复核。
- 移动端真机 / Safari 与 200% 缩放仍属 V2-E。

**下一步**

V2-B：实现 docs/11 §4 的两阶段公平发现算法（先选书、再选句；all / theme 持久 scope、按 scope 维护 cycle），并替换过渡选择器与它钉住的既有行为测试。

## V2-B 执行记录（已完成）

```text
日期 / 执行者：2026-09-13 / 实现 Agent
Slice / task IDs：docs/11 §6 — V2-B（Fair Discovery Engine）
状态：verified（算法性质、真实数据规模、状态机、浏览器回归、构建隔离）
数据模式与许可依据：真实数据 local-only，开发授权见 docs/09 §1；公开快照仍为空
```

**完成内容**

- 新引擎 `src/domain/discovery.ts` 取代 `serendipity.ts`（连同旧测试删除，测试总数只增不减）：`scope -> eligible books -> choose book -> choose highlight`，纯函数、注入 RNG、候选按稳定 ID 排序。
- 契约 `src/domain/selection.ts` 重写：`StageScope = all | theme:<id>`、`SelectionScope` 增加 `book`、reason 只允许 `all / theme / book / fallback`、`CycleState` 与 `scopeKeyOf`、共享的 `withPassage` / `advanceCycle`（reducer 与测试用同一份 cycle 记账）。
- 选书层：依据 scope → 排除当前书（有其他书时）→ 分六个优先级层（本轮未抽过的有新内容 → 本轮已抽过但有新内容 → 其他书都无新内容时的当前书 → 本轮未抽过 → 其余），同层内部**均匀抽取**，完全不看该书的划线条数。
- 选句层：当前 scope cycle 未见 → 刚看过的少量 ID → 必要时重置该 scope 的划线 cycle；`再看一处` 不允许重复，耗尽时返回 `exhausted-book`。
- 机械长度规则：首屏优先 20–120 字；上一句为长句时优先非长句；长度只影响同层内排序，且没有候选时完全放弃，绝不覆盖“没见过优先”。
- `encounter.ts`：新增持久 `stageScope`、按 scope key（`all` / `theme:<id>` / `book:<id>`）保存的 cycles、`NEXT_STAGE`、`SET_STAGE_SCOPE`（原子切范围并提交）、`NEXT_IN_BOOK`（不改 stageScope）；`OPEN_HIGHLIGHT` 开始该书的新访问 cycle；新增 `unseenInBookCount`。
- 兼容接线：`useEncounter(highlights, books, selector)` 暴露 `setStageScope`，首屏改为引擎自己的公平开局抽；`ReadingWorldPage` 改用 `unseenInBookCount`。**未**新建路由、重排页面、加环境色或动效。
- 文档：`docs/02 §5–6` 更新为 v2 状态机与事件名，并标注房间路由属 V2-C1。

**两阶段选书/选句与 cycle 结构**

| 项目 | 实现 |
| --- | --- |
| 书候选 | scope 过滤（主题只看 `Book.themeIds`）→ 只看有划线的书 → 按 `book.id` 排序 |
| 书选择 | 6 个暴露度优先级层，同层均匀；`bookCycleReset` = 必须重用本轮已抽过的书 |
| 句选择 | 该 scope cycle 未见 → 排除当前与最近 3 条 → 宽松重试；耗尽量重置该 scope 划线 cycle |
| cycle 键 | `all` / `theme:<id>` / `book:<id>` 三套互不干扰 |
| book scope | 只抽当前书、不重置、不可重复 → 明确报告 `exhausted-book` |
| 随机 | 所有入口 `rng: () => number` 注入；同输入同序列必得同结果 |

**真实数据规模与稳定 ID**

- 快照不变：4,663 条 / 130 本 / 14 个书架 / 127 张本地封面。
- `npm run verify:ids`：20 本 + 46 条 v1 ID 仍指向同一真实材料；未改动快照、主题分类、ID map 或封面。

**公平性确定性证据（200 vs 2 及真实规模）**

单元层面（固定 RNG、可精确重复）：

- 规模 1000 与 1 的两本书，10 个均匀分布 RNG 值 → 各 5 次；本轮内 130 不参与加权。
- 5 本书（200 / 60 / 8 / 2 / 1 条）→ 前 5 次抽完全部 5 本，各 1 次。
- 200 / 2 两本书：前 4 次 2:2 交替且 0 重复；再抽 8 次得到 8 条不同划线，小书只贡献自己的 2 条，不被重复垫场。
- 9 条 / 3 本的库连续 9 次 → 9 条全不同（含“当前书是唯一还有新内容的地方”这一路径）。

真实快照（临时脚本，不入库；从不打印原文）：

| 测量 | 结果 |
| --- | --- |
| 前 130 次抽（随便看看） | 130 本各 1 次，最多 1 次，重复 0 条 |
| 连续 600 次 | 600/600 条不重复；130 本全覆盖；单本 1–6 次 |
| 最大书（531 条） | 占 1.00%（若按条数加权则为 11.39%） |
| 最小书（1 条） | 占 0.17% |
| 14 个主题 scope × 30 次 | 全部只抽该书架中的书（越界 0），30 次内覆盖 2/2～30/30 本 |
| 40 次开局抽（旧预筛行为，已删除） | 36 本不同书，长度 24–118 字；预筛删除后的 200 次开局见下方复核修复 |

**实际命令 → 结果**

| 命令 | 结果 |
| --- | --- |
| `npm run typecheck` / `npm run lint` | 无错误 |
| `npm run test` | **115 用例 / 9 文件全通过**（V2-A 为 87；删掉的 17 条旧选择器测试由 45 条新性质测试覆盖） |
| `npm run smoke:local` | 3/3 通过（真实全量快照） |
| `npm run validate:data:local` | 4,663 / 130 / 14 通过；仍为 1 条已知覆盖警告（无原换行） |
| `npm run verify:ids` | 通过 |
| `npx playwright test` | **24/24 通过** |
| 首次绘制 DOM | 0 条划线节点 / 5 行书目 / 14 行书架 / 193 个元素（与 V2-A 持平） |
| `npm run build` | 成功；dist 无真实划线内容、封面文件或密钥标记（`local-covers/` 前缀字符串仍在，见下方复核修复） |
| `npx vite build --mode local-private` | 按预期拒绝，未生成产物 |

**浏览器回归（Chromium，真实数据）**

- 首屏仍是 20–120 字可读划线；下一次换句换书；8 次连续换句 0 重复且 `data-commit-count` 仍为 7；12 次换句覆盖≥10 本且最大书只出现 1 次。
- 出处、`再看一处`（同书、不跨书、耗尽说明）、单条书说明、主题/书籍/年份与 DOM 密度全部继续通过。
- 证据（私有）：`.private/review/slice-2/draw-1-opening.png`、`draw-2-contrast.png`、`draw-3-surprise.png`；`.private/review/slice-3/book-exhausted-1440.png`。页面视觉与 IA 未改变（不属本片）。

**偏差 / 判断（请重点看第 1 条）**

1. **“没见过优先”曾高于“每本书均等轮次”**（已由复核修复）：当时当某本书的划线已全部展示、而当前书还没看过的划线时，引擎会留在当前书。复核后按 `docs/11 §4.2` 的硬规则处理：候选书多于一本时不选当前书，代价转移到小书自己的划线重复；见下方「V2-B 复核修复」。
2. **book scope 遇到耗尽不重置 cycle**，而是返回 `exhausted-book` 并说明（保持 docs/10 §5.3 与现有浏览器契约“不提供死控件”）；重置发生在 `OPEN_HIGHLIGHT` 开始该书新访问时。
3. **`SET_STAGE_SCOPE` 在 `entering`（上一句淡入中）时接受，只在 `exiting` 时忽略**，以免用户刚抽完一句就无法切书架；`再来一句` 的防重入语义未变（20 次连点仍只提交一次）。
4. **scope 目前没有界面入口**：本片按 docs/11 §6 “先用测试证明公平与状态正确”，主题/书房间 UI 属 V2-C1，因此主题 scope 的浏览器验收留到 V2-C1。
5. 首屏“可读长度偏好”仍是机械规则（20–120 字），与 docs/11 V2-A 遗留项一致，不是编辑策展。

**未验证 / 缺口**

- 主题舞台与房间式导航未实现（V2-C1）；Book Aura 与动效未实现（V2-C2）。
- 真实访客体验评审仍未进行；公开快照仍为空（PUB-01 等）。
- 隐藏循环动画之下的“环境色不叠加”与快速连续换色仍属 V2-C2 验收范围。

**下一步**

V2-C1：房间路由（`/`、`/themes`、`/themes/:id`、`/books`、`/books/:id`、`/about`）、返回现场记忆与信息架构重排，接入本片的 `stageScope`。不得自行开始。

## V2-B 复核修复（2026-09-13，短修复阶段）

```text
日期 / 执行者：2026-09-13 / 实现 Agent（复核意见来自独立验收）
范围：只修 V2-B 的算法语义、一处诊断标签与一份失真记录；不改路由、IA、Book Aura 或动效
状态：verified（120 单测、24 E2E、真实数据重测、构建隔离）
```

**复核发现 → 修复**

| 复核问题 | 原行为 | 修复后 |
| --- | --- | --- |
| `NEXT_IN_BOOK` 污染持久范围 cycle | `withExposure` 无论抽取来自范围还是书内，都写入当前 `stageScope` 的 cycle | 只有范围抽取与直接打开写范围 cycle；`NEXT_IN_BOOK` 只推进该书访问 cycle（`encounter.ts` 新增 `stage` 开关） |
| 首屏先按句长筛书 | `openingPools()` 先排除没有 20–120 字划线的书再抽书，4 本真实书永远无法开局 | 删除预筛；首屏与 `NEXT_STAGE` 用同一套公平选书，长度偏好只在选中书内部排序，无中长句时正常降级 |
| 多书时仍可能连选当前书 | `currentOnly` 层在“其他书没有未见划线”时回头选当前书 | 删除该层；“候选书多于一本时不选当前书”成为硬规则（`docs/11 §4.2`） |
| 参照实现把主题标成 `all` | `sequence.ts` 的 reason 只有 `all` / `book` | 主题走 `theme` |

**修复后的真实数据行为（4,663 / 130 / 14，临时脚本，不入库，不打印原文）**

| 测量 | 结果 |
| --- | --- |
| 前 130 次抽 | 130 本各不相同，重复 0 |
| 连续 600 次 | 600/600 条不重复；130 本全覆盖；单本 1–6 次；**相邻同书 0 次** |
| 最大书（531 条） | 占 1.00%（按条数加权会是 11.39%） |
| 14 个主题 × 30 次 | 越界 0 |
| 200 次开局 | 194 次落在 20–120 字；最短 18、最长 299 |

**新增/改写的测试**

- `discovery.test.ts`：删掉钉住“首屏按长度筛书”的旧用例，改为“公平抽中的书自己没有任何可读划线也照常开局”与“5 本构造书都能在首屏被抽到（其中 4 本没有带内划线）”；把“留在当前书”的用例拆成“有别的书就轮换”与“只有一本书时才留在本书”。
- `encounter.test.ts`：新增“范围 cycle 只由范围抽取与直接打开推进”和“`再看一处` 不动书架 cycle”两条用例。
- `e2e/slice-2.spec.ts`：首屏断言从“必须 20–120 字”改为“抽中的书带内有划线则必须在带内”，与新的两阶段顺序一致。

**偏差 / 判断**

1. **硬规则优先：书级轮换 > 单条划线零重复**。小书（1–2 条）在自己那一轮用完后会重复自己的划线，而不再让大书连续出现。真实 130 本书、4,663 条的规模下不受影响：600 次连续抽取仍是 600 条不重复、相邻同书 0 次。
2. **首屏不再保证 20–120 字**：约 97% 的开局仍在带内；剩下的来自 4 本没有中长划线的真实书（长度 18 / 126 / 133 / 242 / 299）。这是“先公平选书”的诚实降级，不是缺陷；若要首屏永不出现长文，需新增一条机械规则（带内优先、否则取最短），属产品口味决定，本片未自行加入。
3. **范围 cycle 只记范围抽取**：`再看一处` 看过的句子不算“范围已读”，因此同一句可能在很久之后的新一轮里再作为范围划线抽到。这是 docs/10 §5.3“临时书内动作不推进持久范围”的直接结果；换来的是“浏览一个书架不会被书内翻页消耗”。

**实际命令 → 结果**

| 命令 | 结果 |
| --- | --- |
| `npm run typecheck` / `lint` | 无错误 |
| `npm run test` | **120 用例 / 9 文件**全通过（V2-B 为 115） |
| `npm run validate:data:local` / `verify:ids` | 4,663 / 130 / 14 通过；20 本 + 46 条 ID 稳定 |
| `npx playwright test` | **24/24 通过**（首次绘制仍 193 个元素） |
| `npm run build` | 成功；dist 仅 3 个文件 |
| `npx vite build --mode local-private` | 按预期拒绝，未生成产物 |

**独立复验结论（2026-09-13，GPT-5.6 Sol）**

- 三项针对性复现全部闭环：`NEXT_IN_BOOK` 后持久范围 cycle 原样保留、book cycle 正确推进；多书时严格切换到另一书；带外书重新拥有首屏机会。
- 独立重跑：120/120 单测、24/24 Playwright、稳定 ID、public build 与 local-private 拒绝全部通过。
- 接受最坏 299 字首屏作为公平选书后的合法长文本路径，不再增加按长度预筛书或最短句兜底；V2-C2 必须把 299 字开局与全库最长 398 字划线纳入桌面/移动端视觉验收。
- **V2-B Gate 正式通过，可进入连续房间开发批次。**

**验收后遗留**

1. 公开 bundle 中保留 `local-covers/` 路径前缀字符串（本机封面路由分支）；无封面文件、无真实内容、无私人字段。
2. 主题/房间 UI、全量分批浏览与 Book Aura 属下一连续批次 V2-C1 → V2-D → V2-C2。

## V2-C1 执行记录（已完成）

```text
日期 / 执行者：2026-09-13 / 实现 Agent（连续房间批次第一段）
Slice / task IDs：docs/11 §5.1–5.3 与 docs/12 §2–3 — V2-C1 房间路由、现场记忆、新 IA
状态：verified（149 单测、34 Playwright、真实数据旅程、构建隔离）
数据模式与许可依据：真实数据 local-only；公开快照仍为空
```

**完成内容**

- 新增 `src/app/router.ts`：History API 真实路径、纯函数 `parseRoute` / `routePath` / `routeKey`、query 筛选（`?year=`、`?theme=`）、链接接管、`previousPath`、滚动位置记忆。无新增依赖。
- 新 IA：`/` 门厅、`/themes` 主题书架、`/themes/:id` 主题房间、`/books` 所有书、`/books/:id` 书籍房间、`/about` 关于；未知路径与无效 ID 有安静可返回的错误态。
- 房间组件 `src/features/rooms/*`：`HallRoom`、`ThemesRoom`、`ThemeRoom`、`BooksRoom`、`BookRoom`、`AboutRoom`、`UnknownRoom`、共用 `StageRoom`；删除旧的单页 `World.tsx` / `world.css` / `ReadingWorldPage.tsx`。
- 现场记忆：`useStageSessions(sessionKey, roomKey, …)` 为每个舞台房间保留自己的 `EncounterState`（当前句、scope cycle、历史）；离开房间时 `settleSession` 丢弃在途转场；`useBookRooms` 给每本书自己的随机划线；`useBatches` 记住已展开批次；`useRoomMemory` + router 恢复滚动位置。
- 门厅不再包含书目 / 主题 / About 长页：首次绘制 **70 个元素**（V2-A 为 193）。

**修复的两个真实缺陷**

1. **StrictMode 下会话与渲染不一致**：惰性初始化在开发模式下执行两次，store 里留下与屏幕上不同的一次随机抽（表现为返回房间后句子变了且 `data-commit-count` 为 0）。改为用 effect 将渲染中的会话镜像回 store。
2. **离开非舞台房间时的在途转场**：`useStageSessions` 现在同时接收会话键与**房间键**，去 `/themes`、`/books` 等也会 settle 舞台，旧计不会被“在别处”提交。

**路由与现场记忆的数据结构**

| 项目 | 实现 |
| --- | --- |
| 路由 | `parseRoute(pathname, search)` → `hall / themes / theme / books / book / about / unknown` |
| 记忆键 | `routeKey(route)`：`/`、`/themes/:id`、`/books?year=…&theme=…` |
| 舞台会话 | `Map<sessionKey, EncounterState>`，`sessionKey` = 门厅 `/` 或主题房间 `/themes/:id` |
| 书籍随机 | `Map<bookId, { currentId, seen, cycle }>`，与任何舞台 cycle 无关 |
| 批次 | `Map<"year|theme|bookId", loaded>`，初始 12（书库）/ 10（单书） |
| 滚动 | router 在改变 URL 前记录离开路径的 `scrollY`（pushState 会把滚动重置为 0） |

**浏览器旅程（Chromium，真实数据）**

- 六个路径直接访问 + 刷新均回到原房间；导航 `aria-current` 正确。
- 主题房间连抽 3 次 → 进书架 → 返回：原句保留、commit 计数不变、后续换句仍在该书架。
- 书架 A → 书架总览 → 书架 B → 后退 ×2 回到 A，原句仍在。
- 书库筛选年份 + 展开两批 + 滚动 → 进书 → 后退：筛选、批次标签、滚动位置（979px）都回来。
- 书籍房间随机换一处不越界；回门厅句子未变。
- 同一任务内“换一句 + 离开房间”：回来后仍是原句、`data-phase=idle`、commit 计数不变。

**实际命令 → 结果**

| 命令 | 结果 |
| --- | --- |
| `npm run check:local` | 149 用例 / 11 文件通过（V2-B 为 120），typecheck + lint 无错误 |
| `npx playwright test` | **34/34 通过**（V2-B 为 24） |
| `npm run capture:review` | 320/390/768/1440 无横向溢出；最小触控目标 44px；房间截图（当时未含主题房间 390，已在本页「独立复核修复」补齐） |
| 对比度（实测） | 正文 14.6、出处与出口 5.62（相对纸色） |

**视图与无障碍**

- 320 / 390 / 768 / 1440 无横向溢出；最小交互高度 44px（含品牌链接、年份与书架 chip）。
- 修复移动端出处排版：长书名与作者改为换行而非挤成两列。
- 房间切换后焦点落到主内容（`preventScroll`，不打断滚动恢复），不劫持 Tab 顺序。
- reduced-motion：commit 74ms、跳过转场阶段、无位移。

**偏差 / 判断**

1. **未引入路由依赖**：自写约 200 行 router（纯函数可测）而不是加 react-router；`docs/11 §5.1` 允许最多一个专用依赖，不用也符合要求。
2. **书籍房间顺序列表提前到 C1 实现**：批次基础设施与书库共用，先做避免返工；V2-D 只额外补全量可达证明与最大书验收。
3. **`?theme=` 书架筛选**：`docs/12 §2.3` 要求主题房间提供“看看书架里的书”入口，用书库的 query 筛选实现，保持六条路由不变。
4. 门厅改为只有一句与三个轻出口；总收藏量只在 About 出现，避免与 `docs/10 §8` 重复两个位置。

**未验证 / 缺口**

- Book Aura 色彩与呼吸动效（V2-C2）；分享、深链、200% 缩放（V2-E）。
- 真机移动端与 Safari 仍未验证。

**下一步**

V2-D（全量分批浏览验收）→ V2-C2（色彩与动效）。

## V2-D 执行记录（已完成）

```text
日期 / 执行者：2026-09-13 / 实现 Agent（连续房间批次第二段）
Slice / task IDs：docs/11 §6.1–6.4 与 docs/12 §2.4–2.5 — V2-D 全量分批浏览
状态：verified（批次基础在 V2-C1 落地，本段补全量可达证明与实测）
数据模式与许可依据：真实数据 local-only；公开快照仍为空
```

**完成内容**

- 书库 `/books`：初始 12 本，每次 +20，最终正好 130 本；按最近划线年份排序，同年按真实划线条数再按 book ID 稳定排序。
- 书籍房间 `/books/:id`：初始 10 处，每次 +20，直到该书全部划线；顺序以稳定 highlight ID 为序，不用数组下标。
- 年份筛选仅属于书库与单书列表；主题总览与主题房间不出现年份筛选（已断言）。
- `?theme=` 书架筛选给“看看书架里的书”一个真实入口（六条路由不变）。
- 无封面书继续用真实书名排版；封面一律 `loading="lazy"`。

**全量可达证明**

| 证明 | 方式 |
| --- | --- |
| 每条划线可达 | `unreachableHighlights(index)` 纯函数返回空；单测覆盖“划线指向不存在的书”的反例 |
| 130 本可达 | Playwright：`/books` 从 12 本点击到 130 本，断言末批标签与总行数 |
| 最大书可达末位 | Playwright：b-013 531 处从 10 处走到 531 处，末批数量正确 |
| 不一次渲染全库 | 实测：门厅 70 个元素；主题书架 244；书库初始 155；单书初始 87 |

**实测（Chromium，真实数据，1440×900）**

| 测量 | 结果 |
| --- | --- |
| 书库展开到 130 本 | 130 行 / 127 张封图（lazy）/ 1215 个元素 |
| 最大书首屏 | 10 / 531 处 |
| 最大书走到末位 | 531 / 531 处，20 次点击共 1886ms |
| 最大书全展开后 | 531 个 passage 节点 / 1126 个元素（仅在用户明确展开后） |
| 最长划线 | 398 字完整渲染，无裁切、无横向溢出 |
| 无封面书 | b-040 / b-081 / b-130 用真实书名排版，不造替代图 |

**实际命令 → 结果**

| 命令 | 结果 |
| --- | --- |
| `npm run check:local` | 149 用例 / 11 文件通过 |
| `npx playwright test` | **35/35 通过** |
| `npm run capture:review` | 全库展开、最大书全展开截图 + 密度/耗时数据 |

**偏差 / 判断**

1. 书籍房间的顺序列表在 V2-C1 已随批次基础设施一并实现，本段只补证明与实测，不改产品行为。
2. 年份筛选不做“无结果年份”的隐藏：选择后会诚实提示“这一年里没有收录划线”并提供清除，避免界面假装数据不存在。

**未验证 / 缺口**

- 真机移动端、Safari 与 200% 缩放仍属 V2-E。
- Book Aura 与呼吸动效属 V2-C2。

**下一步**

V2-C2：Book Aura 色彩与呼吸动效。

## V2-C2 执行记录（已完成）

```text
日期 / 执行者：2026-09-13 / 实现 Agent（连续房间批次第三段）
Slice / task IDs：docs/11 §5.4 与 docs/12 §4–6 — V2-C2 Book Aura 与呼吸动效
状态：verified（6 条专属浏览器用例、对比度实测、reduced-motion、截图）
数据模式与许可依据：真实数据 local-only；公开截图不进 public build
```

**完成内容**

- `ReadingWorld` 计算当前房间的“焦点书”：门厅与主题房间取当前句所属书，书籍房间取那本书；其余房间为中性。
- `useCoverAccent` 从真实封面取色，写入 `--aura`；`--aura-target` 按 docs/12 §4.2 取值：门厅 `0.05`、主题房间 `0.045`、书籍房间 `0.1`、书库与 About `0`（中性）。
- `.room-aura` 固定层在内容下方（`z-index: -1`）先铺纸色，`.room-aura-tint` 以单层平涂色 + 不透明度承载环境色；每进一个房间换 key，因此每次都从纸张开始，`aura-wake` 在 700ms 内进入（慢于句子）——即 docs/12 §5.3 的“空间醒来”。
- 呼吸感：房间本体只淡入（320ms），标题 / 句子 / 操作三组错峰 0 / 60 / 120ms，位移 10px，间隔 60ms（≤ 80ms 上限）。
- `prefers-reduced-motion: reduce`：直接 `animation: none`，环境色直接就是目标值，`transform: none`，状态立即准确；不是“极短动画”。

**色彩归属与浓度（实测）**

| 房间 | 归属 | 目标 | 实测不透明度 |
| --- | --- | --- | --- |
| 门厅 `/` | 当前句所属书的封面 | 0.05 | 0.05 |
| 主题房间 `/themes/:id` | 当前句所属书的封面，中性基础 | 0.045 | 0.032（测量时仍在 700ms 到达中） |
| 书籍房间 `/books/:id` | 那本书的封面 | 0.10 | 0.088–0.10 |
| 主题书架 / 所有书 / About | 无（中性纸色） | 0 | 0 |

真实封面 → 环境色（6 本样本，各书房间截图 `book-room-colour-1..6-1440.png`）：

```text
b-013 封面均值 rgb(140,83,75)  → aura #8b4f48（距离 6）
b-021 封面均值 rgb(211,200,206) → aura #7e6783
b-017 封面均值 rgb(212,67,98)  → aura #9d4d5e
b-022 封面均值 rgb(40,33,38)   → aura #574252
b-010 封面均值 rgb(202,132,19) → aura #8e6e46
b-007 封面均值 rgb(95,114,151) → aura #546992
```

无封面书（b-040 / b-081 / b-130）不造颜色：环境色回到项目默认 accent，房间用真实书名排版。

**对比度（对着真实染色后的纸色计算）**

| 房间 | 正文 | 出处 / 次要文字 |
| --- | --- | --- |
| 门厅（5%） | 13.5–13.8 | 5.2–5.3 |
| 主题房间（4.5%） | 13.9 | 5.3 |
| 书籍房间（10%） | 12.7–12.9 | 4.9–5.0 |
| 裸纸（无 aura） | 14.6 | 5.62 |

正文与次要文字都仍在 WCAG AA 以上；颜色只动背景，不动文字颜色，不牺牲可读性。

**实际命令 → 结果**

| 命令 | 结果 |
| --- | --- |
| `npm run check:local` | 149 用例 / 11 文件通过，typecheck + lint 无错（修复后为 151） |
| `npx playwright test` | **41/41 通过**（含 `e2e/aura.spec.ts` 6 条）（修复后为 44） |
| `npm run test:public` | 公开（空快照）模式下六个房间 + 未知路径均有诚实空状态，无本机徽标 |
| `npm run capture:review` | 六本封面色、无封面书、398 字最长划线、reduced-motion、对比度；房间截图当时缺主题房间 390、也不含 299 字指定开局（已在本页「独立复核修复」补齐） |

**浏览器证据（私有）**

`.private/review/rooms-batch/`：`hall-1440/390`、`themes-1440/390`、`theme-room-1440`（390 在本页修复阶段补齐）、`books-1440/390`、`book-room-1440`、`book-room-colour-1..6-1440`、`book-room-no-cover-1440/390`、`book-room-longest-passage-1440/390`、`book-room-longest-expanded-1440`；修复阶段新增 `opening-longest-1440/390`（299 字开局）、`opening-shortest-1440`（18 字）、`theme-room-390`。

**截图读法注意**

`opening-longest-*.png` 等整页截图中，固定定位的环境色层只覆盖首个视口高度，页面下半部分看起来是纯纸色。这是 `fullPage` 截图对 `position: fixed` 层的已知表现，不是运行时上下色差；真实浏览器中固定层始终盖满整个视口。

**偏差 / 判断**

1. **环境色用不透明度层而非 `color-mix` 动画**：`@property` + 自定义属性动画在第一次尝试里没有生效（同元素上的默认声明遮蔽了传入值）。改用“单层平涂 + `opacity`”后行为可预测、可测量，也更易在 reduced-motion 下关闭。
2. **不做顶部渐变光晕**：docs/12 §4.2 给的是每房间一个浓度带，平涂之上的渐变会把页面最强处推出带外，因此只保留平涂。
3. **门厅浓度取 5%、书籍房间取 10%**，都在各自区间中段；主题房间取 4.5%，偏区间下缘，因为房间里已经有一句大字。

**未验证 / 缺口**

- 真机移动端、Safari（`color-mix` 已不再依赖，但 opacity 层与动画仍需真机确认）、200% 缩放与分享属 V2-E。
- 永久循环背景动画未做（docs/12 §5.4 要求先看截图再评估）。

**下一步**

本连续批次（C1 → D → C2）已完成；V2-E（深链、复制、分享、错误态、200% 缩放、完整无障碍）作为最终独立批次，不自行开始。

## 连续房间批次：GPT-5.6 Sol 独立复核与修复（2026-09-13）

```text
日期 / 执行者：2026-09-13 / 实现 Agent（响应独立复核）
范围：V2-C1 / V2-D / V2-C2 的 3 项契约偏差 + 1 项证据缺口
状态：verified（全部修复并重跑全量验证）
数据模式与许可依据：真实数据 local-only；新增截图仍只在 .private/
```

复核（GPT-5.6 Sol）在 C1/D/C2 完成后重跑了全部 Gate 并独立提出 4 项；本阶段逐项修复，不重做架构。

**修复 1：书库年份筛选进入单书列表（V2-D 阻塞）**

- 现象：`/books?year=2024` 列出的书链接是 `/books/b-017`，年份在进入书籍房间时丢失，单书顺序列表退回全书全年级。
- 修改：`src/features/rooms/BooksRoom.tsx` — 新增 `bookHref(bookId, year)`，书库行链接携带当前年份；书架筛选 `?theme=` 不传递（书架是找书的方式，不是一本书的属性）。
- 测试：`e2e/rooms.spec.ts` 新增 «the year filter follows the visitor into the opened book»：从真实快照挑一本跨年份的书 → 书库链接必须带 `?year=` → 进入后对应年份 chip 为 `aria-current` → 列表里每一条文本都属于该年份 → `返回上一处` 回到同一筛选。

**修复 2：换句时环境色要“走过去”而不是跳过去（V2-C2 阻塞）**

- 现象：`aura-wake 700ms` 只作用在房间进入的 `opacity`；Aura 层只按 `router.path` 设 key，所以同一房间内换句时 `background-color` 直接跳到新值（实测 `transition-duration: 0s`）。
- 修改：`src/features/rooms/rooms.css` — tint 层增加 `transition: background-color 700ms ease-out`；reduced-motion 块增加 `transition: none`，颜色仍然立即且准确。
- 测试：`e2e/aura.spec.ts` 新增 «a passage change moves the room colour to the next book instead of jumping»，在页面内用 `requestAnimationFrame` 采样换句后的颜色时间线：声明时长 0.6–0.9s、属性含 `background-color`，**实测 40 个不同中间色**（跳变只会给 2 个）；reduced-motion 一组断言采样只出现 ≤ 2 种颜色且 `transition-property: none`。
- 同步使 «the book room is the strongest aura» 改为轮询到颜色稳定在封面 accent（封面取色是异步的，颜色本来就不该在第一帧到位）。

**修复 3：同年书籍按稳定 ID 排序（V2-D 契约）**

- 现象：`orderByRecentHighlight()` 同年内先按 `highlightCount` 降序，与 docs/11 §6.1 “稳定同级顺序使用 book ID” 冲突，也等于隐式偏爱划线多的书。
- 修改：`src/domain/world.ts` — 同年回退到稳定 book ID 比较，划线数量不再参与排序。
- 测试：`src/domain/world.test.ts` 新增两条：同年 9 条划线的书必须排在 1 条划线的书之后；同一快照任意输入顺序得到同一序列。单测 149 → 151。

**修复 4：补齐遗漏的验收证据**

- 新增 `theme-room-390.png`（此前只有 1440，但文档写成了“六房间 1440/390”，已更正措辞）。
- 新增 `opening-longest-1440/390.png`：**确定性**地把 299 字开局候选（b-114 / h-4647）放到真正的舞台上。方法不用假深链：公平引擎在同一 scope 内排完一本书之前不会重复选书，所以在 b-114 所属的 t-004（21 本）里连续抽句，最多 21 次必出现它；实测 17–19 次。同一方式也覆盖了真实下限 `opening-shortest-1440.png`（b-116，18 字）。
- 新增 `e2e/rooms.spec.ts` «a book with nothing shorter can still open, whole»：对全部 4 本带外书（b-114 299 / b-120 242 / b-105 133 / b-116 18）各自在其最小书架内一轮必达，并断言渲染文本与快照逐字一致（非空白字符数相等）、band 正确、无裁剪、1440 与 390 无横向溢出。实测：b-105 21 抽、b-114 12 抽、b-116 2 抽、b-120 5 抽。

**实际命令 → 结果**

| 命令 | 结果 |
| --- | --- |
| `npm run check:local` | **151 用例 / 11 文件**通过，typecheck + lint 无错 |
| `npx playwright test` | **44/44 通过**（V2-C2 为 41） |
| `npm run capture:review` | 通过；新增 `theme-room-390`、`opening-longest-1440/390`、`opening-shortest-1440`；主题房间 390 溢出 0px，299 字开局 1440 为 10 行 / 390 为 19 行、溢出 0px |
| `npm run test:public` | 1/1 通过（未受本轮修改影响） |
| `npm run verify:ids` / `smoke:local` | 通过 |
| `npm run build` / `local-private` 拒绝 | 通过 / 按预期拒绝 |

**复核提出的其余判断**

- 299 字开局、18 字最短开局现已是可重复的仓库断言，不再是“抽样看到过一次”。
- 仍不新增按长度预筛书或最短句兜底：带外书照常开局，本轮只把它们的排版与可达性变成确定性验收。

**未验证 / 缺口（不变）**

- 真机移动端与 Safari；`color-mix` 已不依赖，但 opacity/transition 层仍需真机确认。
- 200% 缩放、深链、复制、分享仍属 V2-E；固定一层式的环境色在 `fullPage` 截图里只覆盖首个视口（见上文截图读法注意）。
- 永久循环背景动画仍未做。

**下一步**

V2-E（最终独立批次），不在本阶段开始。

## V2-E 开发前高推理交接准备（2026-09-13）

```text
日期 / 执行者：2026-09-13 / GPT-5.6 Sol
范围：只固化 V2-E 产品语义、Gate 与实现 Prompt；未修改产品代码
状态：ready-for-implementation
代码基线：9e2d0af
下一批 Prompt：docs/15-V2-E-CONTINUOUS-IMPLEMENTER-PROMPT.md
```

### 用户体验反馈与范围判断

用户实际打开网页自由浏览后确认：体验“非常震撼”，并且自己愿意像刷手机一样继续刷新，但刷到的是用户读过的书中的真实划线；当前产品也允许希望深入的人沿某一主题或某一本书继续探索，两个层次之间的尺度把握良好。

这条反馈作为 owner experience 的重要成功信号，但不冒充首次访客 Gate。高推理复核判断：核心循环与房间结构已经成立，下一步应收尾而不是扩产品面；不增加搜索、收藏、自动播放、无限滚动、排行榜、推荐学习或停留时长机制。

### 已确认的 V2-E 决策

1. **规范深链**：唯一分享格式为 `/?h=<stableHighlightId>`；`h` 只在门厅生效，主题/书籍/年份不进入分享 URL。
2. **URL 与历史**：有效 ID 精确打开；无效/撤回 ID 轻提示并公平开局；从深链换句后用 replace 清除旧 `h`，不 push 一条“上一句”历史。
3. **分享范围**：只分享当前视觉中心（门厅/主题舞台、书籍房间顶部随机句），不在最多 531 行的顺序列表逐行增加分享按钮。
4. **固定内容身份**：dialog 打开时锁定稳定 highlight ID；文字、链接与卡片随后不受舞台状态变化影响。
5. **local-only 边界**：允许复制真实文字与明确标注的 `复制本机链接`，允许查看带 `仅本机 · 未公开审核` 的 CSS 卡片；不实现 Web Share、上传、PNG、二维码或暗示链接已公开。
6. **长卡片**：短/中句约 4:5；299 字与 398 字真实长句自然增高并提示比例延长，不裁剪、不 line-clamp、不无限缩字。
7. **最终 Gate**：真实 200% 浏览器缩放、完整键盘/dialog 焦点、Clipboard 失败、reduced-motion、错误态、network/privacy；没有 Safari/真机时诚实保留未验证。
8. **执行纪律**：E1 深链/错误 → E2 复制/dialog/卡片 → E3 无障碍/工程 Gate；每阶段测试、记录、commit，连续完成后统一汇报。

### 文档变更

- 新增 `docs/15-V2-E-CONTINUOUS-IMPLEMENTER-PROMPT.md`；
- 更新 `AGENTS.md`、`docs/01/02/05/07/11/14` 与 README 的基线、URL、local-only 分享边界和下一批入口；
- `docs/14` 标为已执行历史提示词；`docs/15` 成为下一批唯一开工 Prompt。

### 仍不在本批次处理

- PUB-01～PUB-07：公开范围、主题复核、public snapshot、版权/引用长度、真实部署链接、封面使用与简介；
- 部署、上传、SEO、Web Share、PNG、二维码；
- 真实首次访客评审与无法在当前 Windows/Chromium 环境完成的 Safari/真机验证。

## V2-E4 分享卡片视觉修订交接准备（2026-09-13）

```text
日期 / 执行者：2026-09-13 / GPT-5.6 Sol
范围：独立验收 V2-E；固化分享卡片视觉修订、滚动可靠性与实现 Prompt；未修改产品代码
状态：ready-for-implementation
代码基线：a8083ef
下一批 Prompt：docs/16-V2-E4-SHARE-CARD-VISUAL-IMPLEMENTER-PROMPT.md
```

### 用户体验反馈与已确认决定

用户实际体验分享功能后确认：分享卡片的风格与整个产品一脉相承，这是应保留的优点；不足是卡片与 dialog 都是白色、只有文字与极细边框，过于“苍白”、单一。用户提供 4 张 flomo 与 4 张微信读书分享图作参考，并确认高推理建议：

1. **本批只重做 CSS 预览**：不下载/复制 PNG，不做 Canvas/SVG 导出、Web Share、上传或二维码。
2. **卡片不显示书封**：真实封面只作为颜色来源；无封面/采样失败回退 `DEFAULT_ACCENT`。
3. **Book Aura 出版卡片**：浅色 dialog 内形成低饱和深色卡面、暖米白文字、细框与清楚出处区；不是固定黑金或 flomo 黄。
4. **一个稳定系统**：不加头像、当前日期、统计、主题标签或随机模板。
5. **颜色也锁 ID**：卡片 palette 必须从 locked highlight → locked book → cover accent 派生，不能只继承可能随后台舞台变化的 `.shell --aura`。
6. **长文契约不变**：最短 8 字、中句、299 字与 398 字全部完整；4:5 只是默认，长文自然增高。

### 参考图片整理

用户提供的 8 张图片已从项目根目录移入：

```text
.private/reference/share-cards/
├─ README.md       # 原文件名映射与设计提炼
├─ flomo/          # 4 张
└─ weread/         # 4 张
```

它们有继续参考价值，不建议删除；仅作本机设计材料，不进入 Git、`src/`、`public/` 或构建。可提炼 flomo 的纸张/票据结构和微信读书的深色出版物分区，但不能导入、裁切或照搬这些图片及品牌元素。

### Sol 独立验收命令与结果

| 命令 | 实际结果 |
| --- | --- |
| `npm run check:local` | 171/171 单测（12 文件），typecheck/lint/data validation 通过；唯一数据警告仍是无原始换行样本 |
| `npm run verify:ids` | 20 本 / 46 条稳定 ID 未变；总量 4,663 / 130 |
| `npm run smoke:local` | 3/3 |
| `npm run test:public` | 1/1 |
| `npm run build` | 成功，public snapshot 仍为空 |
| `npx vite build --mode local-private` | 按预期拒绝 |
| 第一次 `npx playwright test` | **80/81**；唯一失败：dialog backdrop wheel 后 `window.scrollY=210` |
| 精确失败用例 `--repeat-each=10` | 10/10 |
| `e2e/share.spec.ts --repeat-each=5` | 50/50 |
| 第二次 `npx playwright test` | 81/81 |

### 验收判断

- **E1 深链**：通过；有效/无效 ID、replace 清除 `h`、room identity 与 all cycle 契约有覆盖。
- **E2 固定 ID 与复制**：功能通过；视觉有条件通过，需 V2-E4B 修订。
- **E3 键盘/缩放/privacy**：主体通过；滚动锁曾真实失败一次，需 V2-E4A 修复后才关闭风险。
- **总体**：V2-E 功能与工程主体通过，产品视觉为有条件通过；先完成 V2-E4，再回到 Public Release Gate。

### 实现陷阱与 Gate

- 当前 `ShareDialog` 只锁 `document.body.style.overflow`；V2-E4A 必须同时防守滚动根、保存并恢复实际滚动位置与原 inline style。测试不能假定打开前 `scrollY=0`。
- 当前卡片与 dialog 同用 `var(--paper)`；问题不是简单缺装饰，而是没有卡片/容器分层，也没有书籍来源色域。
- 不能直接让卡片继承 `.shell --aura`：固定原文可能与变化后的后台书籍颜色不一致。
- palette 建议用可单测纯函数从 accent 派生，主文字、出处与低权重品牌均需 ≥4.5:1；不要以低权重为理由牺牲可读性。
- 新证据必须进入 `.private/review/v2-e4/`，不覆盖 V2-E 历史截图；参考图片不进入产品网络请求。

### 文档变更

- 新增 `docs/16-V2-E4-SHARE-CARD-VISUAL-IMPLEMENTER-PROMPT.md`；
- 更新 `AGENTS.md`、README、`docs/02/05/07/11/12/15`；
- `docs/15` 保持已执行历史 Prompt；`docs/16` 成为下一批唯一入口。

### 下一步

DeepSeek v4.1 Flash 按 `docs/16` 连续完成 E4A → E4B → E4C。每阶段测试、记录、commit，Gate 通过后直接继续；全部完成后统一汇报。不部署、不 push、不生成 public snapshot。

> 本记录交存的是交接当时的状态（`状态：ready-for-implementation`）。实际执行与验收见上方 V2-E4C 与下方 V2-E4D 记录；本批次的真实结果以那两节为准。

## 公开审核收口：语境说明与元数据清洗（2026-09-17）

```text
日期 / 执行者：2026-09-17 / 实现 Agent
范围：用户两轮公开审核收口；About 语境说明；四本外部导入记录元数据清洗
状态：verified（本机 Chromium）；正式 public snapshot 仍为空
数据模式：完整 local-only 快照 + 私有 publication policy / preview
代码基线：dd25989（Release-A3）
```

### 用户决定与结果

- 第一轮书级审核完成后，第二轮独立扫描覆盖 110 本 / 3,787 条；用户最终整本排除 2 本，并逐条审核讨论项。
- 当前 policy：**108 本公开 / 22 本排除 / 0 未审核 / 6 条单独排除**，`reviewComplete=true`；private preview 为 **3,462 条 / 265,059 非空白字符 / 134 条 ≥200 字**，`releaseReady=true`。
- 高划线书与重复版本按用户决定保留；敏感词不自动等于排除，逐条结合文学/学术语境判断。
- `src/data/public-snapshot.json` 仍为 0 本 / 0 条，没有执行正式 export、封面复制、repo、push 或部署。

### About 语境说明

新增访客可见说明：`这里展示的是我在阅读中留下的原文划线。单句脱离原书后可能失去部分上下文，也不代表我认同作者的全部观点。`

- 放在 `/about`，不污染每一次随机阅读；
- 不为个别划线生成 AI 注释，不伪造前后段落，不改变原文；
- 新增 local E2E，锁定“原文划线 / 上下文 / 不代表完整认同”三个语义。

浏览器证据：`npm run capture:review` 通过；`.private/review/rooms-batch/about-1440.png` 已人工查看，1440 宽度下层级、行宽、留白与出口正常。

### 私有 metadata override

- 新增严格解析器 `scripts/bookMetadataOverrides.ts` 与 6 个单测；私有输入 `.private/curation/book-metadata-overrides.json` 只接受 schema 1、稳定 `b-xxx` ID、title / author / 私有 note。
- `npm run snapshot:local` 在不改原始 notebooks / fetch-plan 的前提下应用 4 项用户批准修正；未知 ID、空值、原始 source ID 或多余字段会拒绝重建。
- 清洗移除了外部文件名 / `.epub` / Z-Library 后缀、书名前不可见字符和错误作者；稳定 book/highlight ID、划线原文、主题与年份不变；私有 note 不进入快照。
- 真实数据 smoke 锁定四本清洗后的 title / author，并断言快照中无 `Z-Library`、`.epub` 或私有决定备注。

### 实际命令 → 结果

| 命令 | 结果 |
| --- | --- |
| `npm run snapshot:local` | 4,663 / 130 / 14；127 本有封面；metadata overrides **4**；唯一原有换行警告 |
| `npm run publication:preview` | 108 / 22 / 0；3,462 条；6 条单独排除；`releaseReady=true`；public snapshot 未写 |
| `npm run check:local` | **248 单测 / 19 文件**通过 |
| `npm run verify:ids` | 20 本 / 46 条稳定 ID 不变；总量 4,663 / 130 |
| `npm run smoke:local` | **6/6** |
| `npx playwright test` | **104/104** |
| `npm run test:publication` | **9/9** |
| `npm run test:public` | 1/1 |
| `npm run capture:review` | 1/1；About 截图人工查看通过 |
| `npm run build` | 成功；dist 仍为 3 个文件 |
| `npm run isolation:public` | clean |
| `npx vite build --mode local-private` | 按预期拒绝（退出码 1） |

### 未验证 / 下一步

- 真机与 Safari 未验证；公开快照、public cover 缩略图、历史扫描、Pages base 与部署均未开始。
- 下一步只讨论 Release-B 的正式 export 与封面/泄漏 Gate；不得因 private preview `releaseReady=true` 自动进入公开发布。

## Release-A4 私有 preview、隔离 Gate 与全批次验收（2026-09-13）

```text
日期 / 执行者：2026-09-13 / 实现 Agent（DeepSeek v4.1 Flash）
范围：Release-A4 — 私有 publication preview/audit、隔离 Gate、证据与全量验证
状态：verified（本机 Chromium）；真机与 Safari 未验证；正式 public snapshot 仍为空
数据模式：真实数据 local-only；未创建 GitHub repo、未 push、未部署、未复制 public cover
代码基线：73b80af（Release-A3）
```

### 完成内容

- `npm run publication:preview` 只写 `.private/publication-preview-snapshot.json` 与 `.private/publication-audit.json`；投影 `visibility` 恒为 `local-only`；audit 只含 ID / 数量 / 长度与状态，不复制被排除原文；`releaseReady` 只在无未审核书、引用完整、至少一条公开内容且决定合法时为 `true`。
- 新增 `npm run isolation:public`（`scripts/check-public-isolation.ts`）：对 `dist` 做反向泄漏探针，任何一项命中即非零退出，供 Release-B/C 继续复用。
- 新增 `npm run capture:release-a`：一次生成 10 张证据（产品侧 5 张 + 审核器侧 5 张）到 `.private/review/release-a/`。

### 隔离 Gate（全部实跑）

| 检查 | 结果 |
| --- | --- |
| `src/data/public-snapshot.json` | schema 2 / visibility public / books 0 / themes 0 / highlights 0（未被任何命令修改） |
| `npm run build` | 成功；dist 只有 3 个文件 |
| `npm run isolation:public` | **clean**：审核入口/审核页标记/policy 字段/policy 路由/policy 文件名/预览文件名/审核备注占位全部 absent |
| dist 真实内容探针 | 真实书名 0 / 真实划线 0 / 封面路径 0；凭证与参考图探针全 absent |
| `npx vite build --mode local-private` | 按预期拒绝（退出码 1） |
| `npx vite build --mode review-private` | **同样拒绝**（同一个 build 守卫，审核模式也不能进生产包） |
| 普通服务器上的 policy 接口 | 读不到清单内容（响应无 `reviewComplete`/`excludedHighlightIds`）；PUT 非 200，且清单文件字节前后一致 |
| 产品服务器上的审核器 | 打开 `/publication-review.html` 时显示诚实错误态，不出现可用的审核页；产品文档不引用审核器 |
| `.private` / `@fs` / 编码变体 | 仍不可读（privacy 用例组） |
| Git | 无 remote、无 `.github/` workflow、`.private` 被跟踪数 0；新增三个私有文件均被 `.gitignore` 覆盖 |

### 命令 → 实际结果（全部实跑）

| 命令 | 结果 |
| --- | --- |
| `npm run check:local` | **241 单测 / 18 文件**通过 |
| `npm run verify:ids` | 20 本 / 46 条稳定 ID 不变；4,663 / 130 |
| `npm run smoke:local` | **5/5**（含真实最大书 531 与全库 4,663 的随机轮可达证明） |
| `npx playwright test` | **103 通过**（含新的 policy 隔离用例） |
| `npm run test:publication` | **9/9 通过** |
| `npm run test:public` | 1/1 |
| `npm run publication:init` ×2 | 第一次生成 130 本全部未审核；第二次 `already in step`，**不覆盖** |
| `npm run publication:preview` | `published 0 / excluded 0 / unreviewed 130`；`releaseReady: false — 还有 130 本书未审核；没有任何划线会被公开`；public snapshot 未写 |
| `npm run capture:release-a` | 通过，10 张图写入 `.private/review/release-a/` |
| `npm run capture:v2e` / `capture:v2e4` / `capture:review` | 全部通过（无回归） |
| `npm run build` | 成功；dist 仍为 3 个文件 |
| `git diff --check` | 干净 |

### 证据（`.private/review/release-a/`，10 张，已逐张查看）

- `review-overview-1440/390`、`review-progress-mixed`（公开筛选下 4 本）、`review-book-open-1440`（b-013 的 531 条真实划线）、`review-highlight-excluded`（被排除那一条的行元素截图：`排除这条` 勾选、行变淡但**不被隐藏**）；
- `book-walk-1440/390`（《晚年周恩来》531 条 → `本轮已看 1 / 531`）、`book-walk-complete`（2 条书一轮看完：`这本书收录的 2 处划线已经看过一遍了` + `重新看一轮`）、`book-walk-restarted`（新轮从 1 开始）、`clipboard-provenance`（剪贴板被拒时的回退文本：出处后空一行再接 `来自 Henry's Reading World`）。

两对截图最初字节完全相同（我把同一视图拍了两次），已改为真正不同的证据：筛选后的列表与“被排除行的元素截图”。

### 未验证项（诚实列明）

- 真机与 Safari 未验证（本机只有 Chromium）；
- 未做真实 130 本审核（属用户下一步）；未生成正式 public snapshot、未复制 public covers、未创建 repo/未 push/未部署；
- 审核器 390 宽度的观感属人工项；长引用提示（≥200 字）只是风险暴露，不是法律结论。

### 偏差 / 设计判断

- **随机书籍房间不是版权过滤**：docs/17 §2 已明确；本阶段的预览/审计按实际投影的全部文字计算累计字符与长引用，不按首屏只显示一句计算。
- **审核器不复用产品视觉**：工具以信息密度为功能；产品页面的克制不适用于审核屏。
- **测试写入被重定向**：`READING_WORLD_PUBLICATION_DIR` 保证自动化测试永不覆盖你的真实清单。

### 下一步（不属于 Release-A）

1. 用户自行完成 130 本审核（`npm run publication:review`）；2. Release-B：正式 `publication:export`、public 缩略图、反向泄漏与 Git 历史扫描；3. Release-C：Pages `base`、静态房间入口与 404、手动 workflow；4. Release-D/E：人工发布 Gate 与实际部署（需用户再次明确授权）。

## Release-A3 publication policy 与本机审核器（2026-09-13）

```text
日期 / 执行者：2026-09-13 / 实现 Agent（DeepSeek v4.1 Flash）
范围：Release-A3 — 书级 publication policy、单条排除、逐书封面开关、本机审核器与安全保存（docs/18 §5）
状态：verified（本机 Chromium）；真机与 Safari 未验证；未生成正式 public snapshot
数据模式：真实数据 local-only；只新增只读审核工具与 .private 写入，未改快照/稳定 ID/主题
代码基线：72c02c9（Release-A1）
```

### 完成内容

- **纯领域契约** `src/domain/publication.ts`：`initialPublicationPolicy` / `reconcilePublicationPolicy` / `validatePublicationPolicy` / `publicationSummary` / `bookStats` / `selectedHighlights` / `projectPublicationPreview` / `releaseReadiness` 与一组纯编辑函数（书级决定、封面开关、单条排除、私有 note、审核完成）。无 I/O。
- **默认拒绝**：新书一律 `unreviewed`；不在清单里的书也当 `unreviewed` 处理；`projectPublicationPreview` 只投影 `publish` 的书。
- **单条排除**：`excludedHighlightIds` 必须属于该书且不重复，否则校验器报错（附 stable ID，不打印原文）；排除项在书被改为 `exclude` 再改回 `publish` 后仍然保留。
- **封面独立**：`cover` 与 `decision` 分开；关闭封面只是不把 `coverPath` 写进投影，书本身仍在。
- **书架重算**：只保留仍有公开划线的书架；`themeIds` 不悬空；空书（公开但一条不剩）被列为阻断项。
- **预览永不冒充发布**：投影 `visibility` 恒为 `local-only`，无论决定如何。
- **`npm run publication:init`**：不存在时生成；存在时只追加新书为 `unreviewed`，已有决定与单条排除一律保留；清单校验失败时**拒绝写入并报告**，不修复。
- **`npm run publication:preview`**：只写 `.private/publication-preview-snapshot.json` 与 `.private/publication-audit.json`；audit 只含 ID / 数量 / 长度，不含被排除原文；允许生成工作预览但 `releaseReady=false`。
- **本机审核器**：`npm run publication:review`（模式 `review-private`，端口 5174，严格本机）。独立文档 `publication-review.html` + `src/review/`；总进度、书级三态、封面开关、概览数字（划线条数 / 累计字符 / 最长 / ≥200 字条数）、展开后的真实划线（可按稳定 ID / 长度 / 年份排序）、单条排除、私有 note、保存与重载、审核完成开关。

### 写接口的安全边界（docs/18 §5.4）

只在 `review-private` 注册 `/__publication_policy`（GET/PUT）：

- 其他方法 405；非 `application/json` 415；body 上限 8 MB（超出 413）；
- **Origin 必须为本机且端口匹配**（伪造 `https://example.invalid` 实测 403，文件字节不变）；
- 写前用真实快照校验整份清单，不合法 422（例如指向别的项目或悬空 ID）；
- 临时文件 + `rename` 原子替换；`Cache-Control: no-store`；固定路径，请求不能指定文件；
- 普通 `dev` / `build` / `preview` 不存在该接口；从产品自己的服务器打开审核器会诚实报错而不是出现一个可用的审核页；
- `READING_WORLD_PUBLICATION_DIR` 只作为**进程环境变量**重定向可写文件，供自动化测试使用，绝不是请求参数——你的真实审核清单不会被测试覆盖。

### 命令 → 实际结果

| 命令 | 结果 |
| --- | --- |
| `npm run typecheck` / `lint` | 无错误 |
| `npm run check:local` | **241 单测 / 18 文件**通过（+32：`publication` 26 条 + 脚本 6 条） |
| `npx playwright test` | **103 通过**（+1：普通服务器上 policy 不可读写） |
| `npx playwright test --config playwright.publication.config.ts` | **9/9 通过**（审核器 UI、保存与重载、单条排除、封面开关、拒绝 premature complete、接口形状、伪造 Origin） |
| `npm run publication:init`（临时目录） | 生成 130 本全部未审核；第二次运行输出 `already in step`，不覆盖 |
| `npm run publication:preview`（全部未审核） | `books: published 0, excluded 0, unreviewed 130`；预览 `books/highlights/themes` 均为空；`releaseReady: false — 还有 130 本书未审核 / 没有任何划线会被公开` |
| `src/data/public-snapshot.json` | 前后字节完全一致（脚本测试断言） |
| 审核器实测（真实数据） | 已审核 4 / 130、预计公开 1055 条 / 118323 字符、长引用 156 条、书架 4 / 10；b-013 显示 531 条 / 85589 字符 / 最长 398 / ≥200 字 148 条 |

### 未验证项

- 真机与 Safari 未验证；审核器 390 宽度的观感属人工项；
- 未做真实 130 本审核（属用户下一步）；未生成正式 public snapshot、未复制 public covers。

### 偏差 / 设计判断

- **审核器不复用产品的视觉语言**：它是工具，信息密度是功能而非风格；产品页面的克制不属于审核屏。
- **面向界面的理由用中文**：`releaseReadiness.reasons` 直接展示给审核者，因此改为中文（单测同步）。
- **`visibility` 用 `local-only`**：预览不是发布，不应伪称 public。

### 下一步

Release-A4：私有 preview 证据、隔离 Gate 与全批次验证。

## Release-A2 书籍房间有限随机轮（2026-09-13）

```text
日期 / 执行者：2026-09-13 / 实现 Agent（DeepSeek v4.1 Flash）
范围：Release-A2 — 书籍房间从分批顺序列表迁移为有限、无重复的随机轮（docs/18 §4）
状态：verified（本机 Chromium）；真机与 Safari 未验证
数据模式：真实数据 local-only；未修改快照、稳定 ID、主题或发布状态
代码基线：dbf7c87（V2-E4E）
```

### 完成内容

- 新增纯领域模块 `src/domain/bookWalk.ts`：`startWalk` / `nextInWalk` / `restartWalk` / `walkProgress` / `walkRound`。候选按 stable ID 排序；所有抽取注入 RNG。
- `BookRoom` 删除顺序列表、`显示 X / N`、`再看 一处` 批次与单书年份筛选；现在显示书籍信息 + **一句**真实划线 + `本轮已看 X / N` + `再看一处` + 分享。
- 完成态：最后一条出现后显示 `这本书收录的 N 处划线已经看过一遍了`，`再看一处` 换成 `重新看一轮`；**不自动重置**。单条书：进入即完成，仍可看出处与分享。
- 单书年份筛选移除，`/books/:id?year=` 规范化为 `/books/:id`（replace，不新增历史）；书库年份筛选与返回现场不变。
- 会话内回到同一本书恢复当前句与进度；刷新开新的一轮；无 localStorage / 账号 / 跨设备状态。
- 删除不再使用的 `.passage-list` / `.passage-item` / `.passage-text` / `.book-list-section` / `.section-heading` 样式与 `INITIAL_PASSAGE_BATCH` / `PASSAGE_BATCH_STEP`。

### 发现并修复的真实缺陷（StrictMode + ref 缓存）

首次并行回归中，一本**只有 2 条的**书稳定出现：进度走到 `2 / 2`，但屏幕上仍是第一条原文（页面快照确认）。这不是测试问题：

- 旧写法在 **render 阶段**把新建的 walk 写进 `sessions` ref（`useState` 初始化器 + 切书时的 render 内 setState）；
- React 开发模式会丢弃第一次 render，而 ref 已被那次被丢弃的 render 写过；于是“屏幕上显示的 walk”与“事件处理器从缓存读到的 walk”是两份不同状态；
- 点击 `再看一处` 时，处理器基于第二份状态取“未见过”的条目，正好可能是第一份状态已经显示的那一条 → 文本不变、进度前进。

修复（`useBookRoom.ts` 重写）：

1. **每书缓存只从 effect 写入**（即只写 React 真正提交过的状态），被丢弃的 render 无法污染它；
2. **事件处理器只推进已提交的 state**，不再读缓存取当前状态；缓存只在进入一本书时用于恢复。

修复后同一用例并行 `--repeat-each=6` 18/18；修复前 5/6 失败。这是本阶段的主要收获：一个仅在 React 双渲染下出现的状态错位，在单跑中永远看不到。

### 可达性证明的迁移（docs/17 §3.4）

旧证明是“把分批列表走到末尾”；新证明更强，且不再依赖浏览器点击：

| 证明 | 结果 |
| --- | --- |
| 纯函数属性测试（`bookWalk.test.ts`） | 1 / 2 / 3 / 10 / 57 / 531 条：一轮恰好 N 次、N 个不同 ID、结束时 complete 且只能在最后一条后成立 |
| 真实最大书 b-013（`tests/local-snapshot.smoke.test.tsx`） | **531 条一轮 531 次，重复 0**（三种固定 RNG 各验一次） |
| 全部 130 本各一轮并集 | **4,663 / 4,663**；`unreachableHighlights` 为空 |
| 浏览器小样本书一轮走完 | 真实 2 条书：一轮 2 条不重复 → 完成提示 → 显式重开 → 新轮 1 / 2 |

### 命令 → 实际结果

| 命令 | 结果 |
| --- | --- |
| `npm run typecheck` / `lint` | 无错误 |
| `npm run check:local` | **209 单测 / 16 文件**通过（+13：`bookWalk` 12 条 + 阅读层调整） |
| `npm run smoke:local` | **5/5**（+2 条真实数据随机轮证明） |
| `npx playwright test` | **102 通过**（100 → 102：新增整轮完成/返回恢复两条） |
| `npx playwright test e2e/rooms.spec.ts -g "whole round|largest book|leaving and returning" --repeat-each=6` | **18/18** |
| `npm run capture:review` | 通过；书籍房间 `passageNodes 1` / `totalElements 60–61`（同一房间以前是 10 条列表），最大书 6 次抽取 339ms |
| `npm run verify:ids` | 20 本 / 46 条不变；4,663 / 130 |
| 浏览器实测 | 《黑天鹅》157 条 → `本轮已看 1 / 157`；最大书 b-013 531 条 → `1 / 531`；320/390/768/1440 溢出 0px |

### 未验证项

- 真机与 Safari 未验证；完成态/重开态的视觉观感属于人工判断项；
- 若一本书的可用划线在会话中变化（本产品不会发生），`nextInWalk` 会诚实报“本轮结束”而不是静默重复。

### 下一步

Release-A3：publication policy 与本机发布审核器。

## Release-A1 / V2-E4E 复制文本来源分层（2026-09-13）

```text
日期 / 执行者：2026-09-13 / 实现 Agent（DeepSeek v4.1 Flash）
范围：V2-E4E — 修正“复制文字”纯文本的来源层级（docs/18 §3）
状态：verified（本机 Chromium）；真机与 Safari 未验证
数据模式：真实数据 local-only；未修改快照、稳定 ID、主题或发布状态
代码基线：16813aa
```

### 完成内容

`shareText()` 由：

```text
原文

——《书名》作者
Henry's Reading World
```

改为：

```text
原文

——《书名》作者

来自 Henry's Reading World
```

- 站点名现在有自己的段落，并带“来自”，不再像是接在作者后面的第二个作者；
- 原文仍逐字转发，包含它自己的换行；缺书/作者的回退不变；
- 复制文字、失败时的只读 textarea 使用同一份 `shareText()`，因此两条路径同时修正；
- E4D 的 CSS 卡片 imprint 分层**保留未回退**（它是有效的额外视觉改进）；
- 这是一个真实误解的修正：用户原反馈一直是剪贴板文本，E4D 改的是卡片 DOM/CSS。

### 修改文件

- `src/domain/share.ts`（`shareText` 格式与注释）
- `src/domain/share.test.ts`（精确格式 + 新增“站点名自成一段且不附在作者行”用例）
- `e2e/share.spec.ts`（`expectedCopyText` 与两处断言）
- `docs/08-REVIEW-CHECKLIST.md`（本记录 + E4D 追加澄清）

### 命令 → 实际结果

| 命令 | 结果 |
| --- | --- |
| `npm run lint` | 无错误 |
| `npm run test` | **196 单测 / 15 文件**通过（+1） |
| `npx playwright test e2e/share.spec.ts` | **10/10 通过**（含 Clipboard 拒绝回退的精确断言） |

### 未验证项

- 真机与 Safari 未验证（本机只有 Chromium）；Windows 剪贴板 `\r\n` 归一化仍是测试侧比较方式，产品写入原文不变。

### 下一步

Release-A2：书籍房间有限随机轮。

## Release-A 产品与实现交接准备（2026-09-13）

```text
日期 / 执行者：2026-09-13 / GPT-5.6 Sol
范围：公开权限、随机书籍房间、系统审核与 GitHub Pages 方向；形成 Release-A 规范和实现 Prompt
状态：ready-for-implementation
代码基线：3f4a7df
直接权威：docs/17-PUBLICATION-DIRECTION-AND-RELEASE-A.md
唯一实现 Prompt：docs/18-RELEASE-A-PUBLICATION-REVIEW-IMPLEMENTER-PROMPT.md
```

### 用户确认的决定

1. GitHub Pages 使用 public project repository `henrys-reading-world`，目标路径 `henryk39b5.github.io/henrys-reading-world/`；现有 Blogverse 根站不迁移、不嵌入，本批不访问或修改 Blogverse workspace。
2. 全部 130 本进行系统审核；书是主要权限单位，未审核默认拒绝。
3. 公开书默认允许自己的划线，但可排除个别 stable highlight ID；第一版不做 selected-only，避免 4,663 条逐条勾选的维护负担。
4. 公开书封面默认允许，但可逐书关闭；Release-A 只保存决定，不复制 public cover。
5. 书籍消费者页面删除完整顺序列表，改为有限随机轮：第一轮每条恰好出现一次且 0 重复，完成后提示并由用户显式重开；完整列表只在本机发布审核器出现。
6. 第一版 Pages 使用手动 workflow；但 GitHub workflow、repo、remote、push 与部署均留到 Release-C～E，Release-A 不做。

### 关键产品判断：随机 UI 不是版权过滤

GitHub Pages 是静态发布。只要全部划线进入 public snapshot / public repo，即使消费者界面一次只画一句，文字也已公开可下载；“首轮不重复”还允许依次遍历全部公开内容。因此随机书籍房间的价值是：

- 与 Reading World 的轻松漫游语言一致；
- 不出现摘录墙；
- 降低整页复制的便利性；

但不能把它写成减少发布量或版权风险。publication preview/audit 必须按真正投影出的全部文字计算累计字符、最长条目与长引用提示。程序不自动判断法律结论。

### Release-A 四阶段

1. **A1 / V2-E4E**：修复 `复制文字` 的真实反馈——作者与站点来源之间空一行，站点改为 `来自 Henry's Reading World`；E4D CSS 卡片分层保留，但 docs/08 追加澄清当时误解。
2. **A2**：消费者书籍房间有限随机轮；年份只留书库，Back 恢复筛选；最大书 531 一轮无重复；全部 4,663 可达证明从 batch list 迁移到 finite cycles。
3. **A3**：私有 `publication-policy.json`、书级三态、单条 exclude、封面开关、本机审核器与安全保存。
4. **A4**：只写 `.private` 的 publication preview/audit、隔离与全量工程 Gate；正式 public snapshot 仍为空。

### 发布审核器边界

- 本机工具，不是公众账号/权限后台；
- 只绑定 127.0.0.1，不需要微信读书 key；
- 可以搜索、按年/长度/ID筛选，因为它是管理工具；消费者产品仍不加搜索；
- policy 使用稳定项目 ID，不记录原始 bookId/bookmarkId/账号/secret；
- reviewComplete 只有 130 本无 unreviewed 时成立；
- preview 重算 books/highlights/themes 与计数，只写 `.private`；
- Release-A 不生成 public snapshot、public covers 或 GitHub artifact。

### Blogverse 与 Pages 核对

已按用户要求只读 `E:\Desktop\henry-agent-hub\SKILLS\blogverse\SKILL.md` 及 publishing/customization/workspace references：现有 Blogverse 是 Hexo 6.3 + Volantis，根站为 `henryk39b5.github.io/`，实际 workspace 在 `F:\Working\Blogverse`。Reading World 作为独立 project site 合适，不应并入 Hexo 或共用 deploy 命令；公网稳定后再决定是否从 Blogverse 导航/Explore 链接过去。

### 本次修改

- 新增 `docs/17-PUBLICATION-DIRECTION-AND-RELEASE-A.md`；
- 新增 `docs/18-RELEASE-A-PUBLICATION-REVIEW-IMPLEMENTER-PROMPT.md`；
- 更新 `AGENTS.md`、README、`docs/02/03/07/08/11` 的当前权威、基线与下一批入口；
- 未修改产品代码、快照、主题、稳定 ID、封面、Git 配置或 remote。

### 未验证 / 暂不执行

- 未创建 publication policy、审核器或 preview（属于下一批实现）；
- 未实际完成 130 本审核；
- 未生成正式 public snapshot；
- 未做 Pages base-aware router、静态入口、404 或 workflow；
- 未创建 GitHub repo、push、部署或修改 Blogverse；
- 封面和引用的最终公开决定仍须在系统审核与 Release-B Gate 中逐项确认；非商业与网络可见不自动等于无版权风险。

### 下一步

切换到 DeepSeek v4.1 Flash，完整阅读并严格执行 `docs/18`，连续完成 A1 → A2 → A3 → A4；每阶段测试、更新 docs/08、独立 commit。全部结束后停止并交回 Sol 验收；不得进入 Release-B 或 Pages 部署。

## V2-E4D 卡片署名分层与证据收口（2026-09-13）

```text
日期 / 执行者：2026-09-13 / 实现 Agent（DeepSeek v4.1 Flash）
范围：V2-E4D — 卡片“出处 / 署名”分层、长卡片截图证据修正、文档状态收口
状态：verified（本机 Chromium）；真机与 Safari 未验证
数据模式：真实数据 local-only；未修改快照、稳定 ID、主题或发布状态
代码基线：d163caf（V2-E4C）
触发：用户实际体验分享页面后的反馈 + GPT-5.6 Sol 独立验收的两个收尾项
```

### 触发反馈

用户看真实页面后：**审美明显改善**；唯一建议是分享文字的作者之后紧接着 `Henry's Reading World` 有点奇怪，希望隔开、换行或优化。Sol 的独立验收同时指出两个收尾项：长卡片截图不完整、`docs/08` 顶部状态滞后。三项在本片一次解决，**未新增任何功能**。

### 1. 出处与署名分层

问题不是“行距小了”，而是语义混在一起：作者与站点名是两类不同的事实（谁写的 / 这份预览从哪来），相距 10px 时第二个读起来像第一段的续行。

结构（`ShareDialog.tsx`）：

```text
blockquote          原文（未动）
share-card-meta     ← 仍作为页脚容器（既有测试读取它的 muted 颜色）
  share-card-source   《书名》/ 作者
  share-card-imprint  ← 新增：独立区块 + 自己的细线
    share-card-brand    Henry's Reading World
    share-card-badge    仅本机 · 未公开审核
```

CSS（`share.css`）：

- `.share-card-imprint`：`margin-top: 18px; padding-top: 12px; border-top: 1px solid var(--card-rule)`；
- `.share-card-badge` **去掉自己的 border-top**（原先它自带一条）：两条细线相距不到 30px 会显得碎，现在页脚只有两条线，含义清楚——正文/出处一条、出处/署名一条；
- 品牌字号、字距、颜色、对比度全部不变（仍为 `--card-muted`）。

保留 `.share-card-meta` 作为容器是有意为之：`share-card.spec.ts`、`keyboard.spec.ts`、`zoom.spec.ts` 都从它读取次要文字颜色，改类名会静默把对比度断言变成空字符串比较。

新增断言（`share-card.spec.ts`，第 9 条）：署名距离出处 **≥14px**、`border-top-width > 0`、站点名在作者**下方**而不是旁侧、徽标**在 imprint 内部且自己不再带线**、品牌文字对卡面对比度 **≥4.5**。

### 2. 长卡片截图：不是“拍得不好”，是元素被顶出视口

Sol 看到 `card-299.png` 缺上边框、`card-longest.png` 顶部混入背后舞台。实测根因（临时探针，已删除）：

| 状态 | dialog 滚动口 | 卡片位置 | 截图结果 |
| --- | --- | --- | --- |
| 设计原样（1440×900） | `client=758 / scroll=1268 / scrollTop=476` | `y = -333` | 979px 残图，顶部是背后页面 |
| 解除滚动口 + `scrollTop=0`（1440×1500） | `1268 / 1268 / 0` | `y = 188` | 991px = 整张卡片（真实高 990.02） |

`scrollTop=476` 正是 V2-E4B 已记录的“浏览器把聚焦的 `复制文字` 滚入可见区域”：长文时卡片顶部被顶到视口上方数百像素，而 locator 截图只会拍到视口内那部分。**产品本体没有裁剪**（溢出一律 0/0，文字逐字完整），失真的是证据。

修正（`capture-v2e4.spec.ts`）：

1. 截图前解除 dialog 自己的 `max-height` / `overflow` 并把 `scrollTop` 归零（仅截图期间，`finally` 中还原）——dialog 才是 92svh 封顶的拥有者，卡片的宽、4:5 默认比例与长文增高都来自卡片自己的规则，不受此影响；
2. 卡片截图专用视口 1440×1500（另有宽度下限，避免降到手机档 padding）；
3. **截图前断言卡片完整落在视口内**（`y ≥ 0` 且 `y + height ≤ 视口高`），否则报出具体坐标；
4. **截图后读 PNG 的 IHDR 校验尺寸等于卡片盒**（不需新依赖，八个字节）：Chromium 的裁剪矩形是向外取整的整数矩形，因此容差 ±1px，超出即判为残图。

第 4 条立即生效：改完第 1–3 条之前它就以 `card-299 must be the whole card, not a fragment of it` 报错，而不是像上次那样默默写出残图。

### 3. 文档收口

- `docs/08` 顶部“当前真实状态”：浏览器验证改为 **99 local / 1 public**（并写明 E4A 根因已修复），本机检查改为 **195 单测 / 15 文件**，V2-E4 交接行由 `ready-for-implementation` 改为已执行完毕；
- V2-E4 交接记录末尾加一行说明：该节 `状态` 是交接当时的值，实际结果以 E4C/E4D 为准（追加，不篡改历史）；
- README 第 6 条补上署名分层。

### 命令 → 实际结果（全部实跑）

| 命令 | 结果 |
| --- | --- |
| `npm run typecheck` / `lint` | 无错误 |
| `npm run check:local` | **195 单测 / 15 文件**通过；数据校验仅剩既存的无原始换行警告 |
| `npx playwright test` | **100 通过**（E4C 后 99；+1 署名分层） |
| `npx playwright test e2e/scroll-lock.spec.ts --repeat-each=10` | **80/80** |
| `npx playwright test e2e/share.spec.ts e2e/share-card.spec.ts --repeat-each=5` | **95/95**（E4C 后 90；新增用例也参与重复） |
| `npm run test:public` | 1/1 |
| `npm run capture:v2e4` | 通过；13 张图重写，长卡片首次通过“整张卡片”校验 |
| `npm run build` | 成功；dist 仍为 3 个文件，无真实内容、封面或凭证 |
| `npx vite build --mode local-private` | 按预期拒绝 |
| `git diff --check` / Markdown 本地链接 / 尾随空白 | 全部干净 |

### 浏览器证据（`.private/review/v2-e4/`）

`card-longest.png`（991px，含上边框与全文）、`card-299.png`（798px，完整）、`card-shortest.png`／`card-18.png`／`card-medium.png`（400px，`data-extended=false`）、`card-aura-1/2/3.png`、`share-dialog-1440/390`、`zoom-200-dialog`、`clipboard-failure-1440`、`reduced-motion-1440`。已逐张人工查看。

### 未验证项

- 真机与 Safari 仍未验证（本机只有 Chromium）；
- 署名分层在真实交互式缩放菜单下未人工看过（仍以 200% 等价重排 + 真实 2× 为证据）；
- 卡片篇幅比上一版约高 30px，4:5 默认判定未变（8/18/42 字 `false`、299/398 字 `true` 已验），但极短卡片在不同字体族下的光学重心仍属人工观感项。

### 偏差 / 设计判断

- **没有给站点名加分隔符或图标**：加“·”或小图标会把署名变成第二个出处样式；用空行 + 细线分层是参考图里已有的出版物语言，也与卡内已有的双细框一致；
- **截图期解除 dialog 滚动口是一种摆拍吗**：不是。它改的是 dialog 的溢出容器，不是卡片；卡片尺寸、比例与增高规则全部来自卡片自己，且截图后立即还原。真正的防伪措施是尺寸校验——它刚在本片拦下过一张残图；
- **文档修正只动“当前真实状态”**：历史章节里的旧数字与旧状态保留（追加不覆盖），但在交接节末尾标明其时效，避免被误读为当前值。

### 追加澄清（V2-E4E，2026-09-13 用户澄清）

用户后续明确指出：当初说“作者后边立马就是 Henry's Reading World 显得有点奇怪”，指的是**点击“复制文字”得到的纯文本**，不是页面内的 CSS 卡片预览。E4D 改的是卡片页脚 DOM/CSS，`src/domain/share.ts` 的 `shareText()` 当时未修改，所以**用户原始反馈在 E4D 并未被解决**。

保留的结论：E4D 的卡片 imprint 分层和长卡片截图修正本身都成立且有效（见上方两节），但不要把 E4D 写成“已解决用户复制文本反馈”。该反馈由 V2-E4E 完成（见下方 Release-A1 记录）。

### 下一步

E4D 完成后本机原型开发批次结束；随后用户确认公开方向并批准 Release-A，由 V2-E4E 补上复制文本修正如实（见上方 Release-A 记录）。真机/Safari 与至少 3 位首次访客仍待补。

## V2-E4C 视觉与全量工程 Gate（2026-09-13）

```text
日期 / 执行者：2026-09-13 / 实现 Agent（DeepSeek v4.1 Flash）
范围：V2-E4C — 分享卡片的浏览器矩阵、网络与隐私、全批次工程 Gate
状态：verified（本机 Chromium）；真机与 Safari 未验证
数据模式：真实数据 local-only；未修改快照、稳定 ID、主题或发布状态
代码基线：951ecc6
```

### 完成内容

1. **三个分享入口**：门厅 / 主题房间舞台与书籍房间顶部的分享入口均由 `share.spec.ts` 覆盖；每条都断言锁定的是当前视觉中心的稳定 ID。
2. **深链 → 分享**：`share-card.spec.ts` 用 `/?h=<真实 id>` 打开后分享，卡片的 accent 由**独立计算**得出（在浏览器里重采样同一张真实封面的像素，再用项目自己的 `accentFromPixels` 算一遍），与卡片实际使用的 accent 必须相等，卡面也必须等于该 accent 的 palette。这是“颜色真的来自这本书”的证据，而不是“颜色看起来对”。
3. **多媒体矩阵**：320 / 360 / 390 / 768 / 1440（`zoom.spec.ts`）、720×450 等价 200%、真实 2× 放大；分享卡片新增 200% 专项（卡片无溢出、正文与次要文字对比度均 ≥AA）。
4. **键盘**：完整键盘旅程中新增卡片断言——预览持有真实文本、accent 是合法颜色、卡面等于该 accent 的 palette，复制成功后卡片状态**逐项不变**。
5. **网络与隐私**：新增“彩色卡片只向本机要它采样的那张封面”，并将 `.private/reference/share-cards/`（用户提供的 8 张参考图）加入不可经 HTTP 读取的路径清单；Vite 的 allow-list 拒绝已实际出现在服务器日志中。
6. **公共产物探针**：dist 共 3 个文件；真实划线 0 条、书名 0 个、封面路径 0 条、`share-cards` / `flomo` / `reference/` / 凭证名均不存在。

### 命令 → 实际结果（全部实跑）

| 命令 | 结果 |
| --- | --- |
| `npm run check:local` | **195 单测 / 15 文件**通过，typecheck + lint + 数据校验干净（唯一警告不变：无原始换行样本） |
| `npm run verify:ids` | 20 本 / 46 条稳定 ID 指向同一真实材料；4,663 / 130 |
| `npm run smoke:local` | 3/3 |
| `npx playwright test` | **99 通过**（本批次开始时的 81 → 99） |
| `npm run test:public` | 1/1 |
| `npx playwright test e2e/share.spec.ts e2e/share-card.spec.ts --repeat-each=5` | **90/90** |
| `npx playwright test e2e/scroll-lock.spec.ts --repeat-each=10` | **80/80**（E4A 已记） |
| `npm run capture:review` | 通过（3.7 分钟）；六房间 1440/390/320/768 溢出均 0px，最小点击目标 44px |
| `npm run capture:v2e` | 通过（19.9 秒），旧卡片证据集仍可重跑 |
| `npm run capture:v2e4` | 通过（23.9 秒），13 张图写入 `.private/review/v2-e4/` |
| `npm run build` | 成功；dist 仍为 3 个文件 |
| `npx vite build --mode local-private` | 按预期拒绝：`Local mode cannot be used for a production build.` |

### 卡片可读性实测（真实卡面，WCAG 公式）

| 卡面（来自真实封面） | 正文 `#f1eadf` | 出处/品牌/徽标 `#c7bca8` |
| --- | ---: | ---: |
| `#3f2927`（b-013） | 11.28 | 7.18 |
| `#362e38`（b-021） | 10.95 | 6.97 |
| `#40262b`（b-017） | 11.49 | 7.31 |
| `#38342e`（中句） | 10.35 | 6.59 |
| `#26403d`（299 字） | 9.33 | 5.94 |
| `#2d3932`（默认回退） | 10.08 | 6.42 |

正文全部超过 AAA（7），次要文字全部超过 AA（4.5）——包括最暗的卡面。

### 证据（`.private/review/v2-e4/`，13 张）

`card-shortest` / `card-18` / `card-medium` / `card-299` / `card-longest`（整张卡片，元素级截图）、`card-aura-1/2/3`（三本真实封面的不同色域）、`share-dialog-1440` / `share-dialog-390` / `zoom-200-dialog` / `clipboard-failure-1440` / `reduced-motion-1440`。

实测：8 / 18 / 42 字 `data-extended=false`，299 / 398 字 `true`，溢出一律 0/0。

### 未验证项（诚实列明）

- **真机移动端与 Safari 未验证**：本机只有 Chromium。新锁改写 `documentElement` / `body` 的 inline style，卡片使用 `aspect-ratio`、`outline` 偏移与 `svh`，这些在 Safari 上的实际表现仍未确认。
- **真实交互式浏览器缩放（Ctrl +/-）未手动执行**：用的是“CSS 像素视口减半”的等价重排 + 真实 2× 放大两条独立证据。
- **滚动条补值分支未在本机触发**：该环境槽宽为 0（`innerWidth === clientWidth`），仅由单测覆盖。
- `showModal` 不可用的非模态回退已由测试覆盖，但触发该分支的真实旧浏览器未验证。

### 偏差 / 设计判断

- **长文卡片会让 dialog 自身滚动**：实测长文打开时 `dialog.scrollTop = 270`，因为浏览器把聚焦的 `复制文字` 滚入可见区域（`preventScroll` 只管文档，不管 dialog 内部滚动容器）。保留这个行为，因为“键盘访客立即能看到可操作的控件”优先于“预览从顶部开始”；代价是长文时 dialog 需滚动，卡片证据因此改用元素级截图，避免窗口截图裁掉卡片。
- **短句卡片的留白是刻意的**：4:5 下短句必然有空白，但现在空白被色域、双细框与底部出处区组织，不再像空白文档。
- **颜色是“到达”的**：冷缓存下先默认 palette、再 600ms 过渡到本书颜色；每一帧都是可读卡片，测试断言它**落定**的位置。
- **参考图只做设计输入**：未复制、未裁切、未嵌入；`flomo` 黄、微信读书黑金、头像、二维码、日期与统计都没有进入产品。

### 下一步

V2-E4A → E4B → E4C 全部完成，本机原型开发批次再次结束。下一阶段仅为 **Public Release Gate（PUB-01～PUB-07）**，需用户决定后才开始；不得自行公开导出、部署或上传。

## V2-E4B Book Aura 出版卡片（2026-09-13）

```text
日期 / 执行者：2026-09-13 / 实现 Agent（DeepSeek v4.1 Flash）
范围：V2-E4B — 分享卡片改为锁定书籍 Book Aura 派生的低饱和深色出版卡片
状态：verified（本机 Chromium）；真机与 Safari 未验证
数据模式：真实数据 local-only；未修改快照、稳定 ID、主题或发布状态
代码基线：c1c4e52
```

### 完成内容

1. **纯 palette** `src/domain/sharePalette.ts`：`sharePalette(accent)` 由**一个颜色**派生 `background / text / mutedText / rule`。无 RNG、无日期、无书名 hash、无外部调色板；同一 accent 永远得到同一张卡。
2. **可读性是解出来的，不是眼睛看的**：卡面固定在 L 0.20、饱和度取 accent 饱和度的 75%（限 0.10–0.26），文字与次要文字的亮度**逐步抬升直到对比度达到目标**（正文 ≥7、出处/品牌/徽标 ≥4.6），因此一张极暗或极饱和的封面也不会产生不可读卡片。
3. **一个书一个色域，墨色恒定**：卡面与细线携带书（Book Aura），文字为恒定的暖米白（`#f1eadf` 一系）。参考图里 flomo 与微信读书用的也都是恒定墨色——这样读者不必为每本书重新适应一遍“绿白/蓝白”。
4. **可读的编码路径**：`accent.ts` 新增并导出 `hexToRgb` / `rgbToHsl` / `hslToHex`，`muteColor` 改为复用它们；新增 `accent.test.ts`（12 条）钉住原有范围、灰样本的中性 hue、像素平均的取舍，并用一个**手算核对过的**具体值（`rgb(141,83,76) → #8d534c`）证明这次拆分是行为保持的。
5. **颜色锁定 stable highlight ID**：`ReadingWorld` 不再使用房间的 `--aura`，而是由 `share.state.highlightId` → `sharedBook` → `coverPath` 独立取色（复用封面采样缓存），所以卡片背后的舞台变化不会重绘卡片。
6. **卡片视觉**：外层 1px 描边 + 内层 `outline` 偏移 7px 的双细框；正文与出处之间一条 hairline；出处区（书名 cream / 作者 muted / 品牌字距加大 / 本机徽标）；4:5 仍只是默认比例。

### 两个设计判断（来自参考图，但不照搬）

- **不引入**头像、当前日期、统计、二维码、主题标签、多套模板、固定黑金或 flomo 黄；参考图只用来提炼“深色色域 + 分区 + 细框 + 恒定墨色”这套出版物语言。
- **内框用 `outline` 而不是嵌套 div**：嵌套框架会改变卡片超过 4:5 时的成长方式，而“长文不裁剪”是本项目已经验证过的性质。`outline` 偏移不参与布局，因此长卡片的行为与 E2 完全一致。

### 修改文件

- `src/domain/sharePalette.ts`、`sharePalette.test.ts`（新增）
- `src/domain/accent.ts`（导出 `hexToRgb` / `rgbToHsl` / `hslToHex` 并重构 `muteColor`）、`accent.test.ts`（新增）
- `src/features/share/ShareDialog.tsx`、`share.css`
- `src/app/ReadingWorld.tsx`
- `e2e/share-card.spec.ts`（新增 8 条）、`e2e/capture-v2e4.spec.ts`、`playwright.capture-v2e4.config.ts`（新增）
- `playwright.config.ts`、`package.json`（`capture:v2e4`）
- `docs/08-REVIEW-CHECKLIST.md`

### 命令 → 实际结果

| 命令 | 结果 |
| --- | --- |
| `npm run check:local` | **195 单测 / 15 文件**通过（E4A 后 174/13：+9 `sharePalette`、+12 `accent`） |
| `npx playwright test` | **97 通过**（E4A 后 89；+8 分享卡片） |
| `npm run capture:v2e4` | 通过，11 张图 + 日志写入 `.private/review/v2-e4/` |
| `npm run verify:ids` | 20 本 / 46 条不变 |

### 浏览器证据（真实 Chromium，`.private/review/v2-e4/`）

- `card-shortest/medium/299/longest.png`：整张卡片（元素级截图，不是窗口截图）。实测 `data-extended` 在 8 / 42 字为 `false`、在 299 / 398 字为 `true`，溢出一律 0/0。
- `card-aura-1/2/3.png`：三本真实封面，卡面实测 `rgb(63,41,39)` / `rgb(54,46,56)` / `rgb(64,38,43)`（暖棕 / 灰紫 / 梅红），与各自 accent 的 palette 逐位一致。
- `share-dialog-1440.png`、`share-dialog-390.png`：浅色 dialog 与深色卡片分层清楚。
- `zoom-200-dialog.png`、`clipboard-failure-1440.png`、`reduced-motion-1440.png`。
- 6 本真实书在 E2E 中实测产生 **≥4 个明显不同的卡面**（测试刻意挑选 accent 不同的书）。

### 三个真实发现

1. **卡片颜色是“到达”的**：accent 由真实封面异步采样，冷缓存的深链会在采样完成前先画默认 palette，再在 600ms 内过渡到本书颜色。这是 `docs/16 §5.3` 明确允许的行为，且**每一帧都是可读卡片**（palette 是“任意颜色”的完备函数）；测试改为断言它**落定**在哪里，而不是取第一帧。
2. **深 dialog 里聚焦会滚动 dialog 自身**：长文卡片打开后实测 `dialog.scrollTop = 270`，因为浏览器把聚焦的 `复制文字` 滚入了可见区域（`preventScroll` 只管文档，不管 dialog 内部滚动容器）。这与 V2-E3 已记录的取舍一致（焦点可见优先，dialog 自身滚动），因此保留；但**窗口截图会拍到被裁的卡片**，所以卡片证据改为元素级截图。
3. **`margin: auto` 的分配是三份不是两份**：最初正文与出处都带 `margin-top: auto`，剩余空间被三个 auto margin 均分，短句因此偏上；去掉出处那个之后，正文落在卡片的光学中心，出处仍贴底。长文没有剩余空间，布局不受影响。

### 未验证项

- 真机与 Safari 未验证（与 V2-E3 相同）。
- 新增的 `accent.test.ts` 只覆盖纯函数；房间 accent 的真实渲染仍由 `aura.spec.ts` 在浏览器里验证。

### 下一步

V2-E4C（视觉与全量工程 Gate），不在本阶段开始。

## V2-E4A dialog 滚动锁可靠性（2026-09-13）

```text
日期 / 执行者：2026-09-13 / 实现 Agent（DeepSeek v4.1 Flash）
范围：V2-E4A — dialog 打开/关闭不再移动读者所在的页面
状态：verified（本机 Chromium）；真机与 Safari 未验证
数据模式：真实数据 local-only；未修改快照、稳定 ID 或主题
代码基线：cda3fd5
```

### 开工基线重跑（不照抄交接数字）

| 命令 | 结果 |
| --- | --- |
| `npm run check:local` | 171 单测 / 12 文件；typecheck + lint + 数据校验通过 |
| `npm run verify:ids` | 20 本 / 46 条稳定 ID 不变；4,663 / 130 |
| `npx playwright test` | 81 通过 |
| `npm run test:public` | 1 通过 |

### 根因：三个真实缺陷，而不是“偶发”

在 `a8083ef`/`cda3fd5` 上做真实探针（临时 spec，已删除），不是推测：

| 探针 | 实测 |
| --- | --- |
| `document.scrollingElement` | `HTML`（滚动根是 `documentElement`，不是 `body`） |
| 只锁 `body` 时滚轮 | `0` —— 用户滚动确实被挡住了 |
| 只锁 `body` 时 `window.scrollTo(0,150)` | **`145`** —— `overflow:hidden` 从未阻止**程序化**滚动 |
| `html` + `body` 同时锁时滚轮 | `0` |

1. **`overflow:hidden` 只挡用户滚动，不挡程序化滚动**，而已经进入合成器的滚轮事件可以在锁提交前就被应用（CPU 争用下）。所以旧实现真实失败过一次 0 → 210px。
2. **新发现：dialog 内首次聚焦把页面拉回顶部。** 细粒度日志显示滚动复位时 `active` 是 `share-copy-text`、`dialogOpen: true`：浏览器把刚聚焦的控件滚入视野，而在滚动根被锁的情况下，这等于把页面丢回顶部。**任何从下方打开分享的读者都会中招**，此前所有测试都从顶部打开，所以从未暴露。
3. **新发现：StrictMode 下第二次锁会记住被钳制的 0。** 开发模式 setup → cleanup → setup 在同一 task 内完成；第一次 unlock 时 `scrollTo` 被钳制（因为 `body` 刚回到流中、布局还没重算），第二个 lock 于是快照到 0，关闭后页面就留在顶部。

另外一个**假警报**：一度以为 `html{overflow:hidden}` 造成 5px 布局位移。实际 `offsetTop` 在所有状态下完全相同（heading 129 / stage 188 / room 121），只有 `getBoundingClientRect` 在变——因为量到的是**房间入场动画进行中**的 rect（docs/12 §5.1 的 8–12px 位移）。是我的测试量错了，不是锁移动了布局。

### 实现

- 新增 `src/features/share/useScrollLock.ts`：
  - 快照 `html`/`body` 的相关 inline style 与实际滚动位置；
  - 锁：两者 `overflow:hidden` + `overscroll-behavior:none`，并让 `body` 离开文档流（`position:fixed; top:-<Y>px; left:0; right:0`）——这才是“根本没有可滚动区域”的结构保证；`-Y` 保证画面停在读者原来的位置；
  - 关闭时按快照原样还原，并显式 `scrollTo` 回原位置；还原前先 `void documentElement.scrollHeight` 强制重算布局（修 StrictMode 的钳制问题）；
  - 滚动条宽度在**隐藏之前**测量并只在 >0 时补 `padding-right`（补隐藏滚动条带来的横向跳动）。
- `ShareDialog.tsx`：锁在 showModal 与聚焦**之前**取；dialog 首焦点改为 `focus({ preventScroll: true })`。
- `useShare.ts`：关闭后归还焦点也用 `preventScroll`，否则焦点回归本身会把页面滚回去。

### 修改文件

- `src/features/share/useScrollLock.ts`（新增）、`useScrollLock.test.ts`（新增）
- `src/features/share/ShareDialog.tsx`、`src/features/share/useShare.ts`
- `e2e/scroll-lock.spec.ts`（新增，8 条）
- `e2e/share.spec.ts`（旧断言改为真实契约）、`e2e/aura.spec.ts`、`e2e/deep-link.spec.ts`、`e2e/zoom.spec.ts`（等待方式改为条件式，见下）
- `docs/08-REVIEW-CHECKLIST.md`

### 命令 → 实际结果

| 命令 | 结果 |
| --- | --- |
| `npm run check:local` | **174 单测 / 13 文件**通过（+3 为 `scrollbarGutter`） |
| `npx playwright test` | **89 通过**（81 + 8 新的滚动锁）；连续两次全量均 89/89 |
| `npx playwright test e2e/scroll-lock.spec.ts --repeat-each=10` | **80/80** |
| `npx playwright test e2e/share.spec.ts --repeat-each=5` | **50/50** |
| `npm run verify:ids` | 20 本 / 46 条不变 |

### 浏览器证据（真实 Chromium）

`e2e/scroll-lock.spec.ts` 覆盖：从真实的非零滚动位置打开（先断言页面确实滚动了）→ 打开后画面位置逐一相同 → backdrop 滚轮 → 监听器记录到的滚动事件**为空**（连瞬时跳动都没有）→ 关闭后仍在原位；从顶部打开同样成立；720×450 下 dialog 自己可滚而页面不动；连续开关 5 次后 html/body 的 inline style 与开关前**逐项相等**（无残留 overflow / position / top / padding）；Esc 与按钮关闭都归还焦点与原位置；`showModal` 不存在时同样成立；程序化 `scrollTo(0,9999)` 也不能把页面留在别处。

### 顺带修掉的三处“计时猜测”（超出 E4A 范围，但是 Gate 阻塞项）

全量并行运行时出现的是**另一批**既存的不稳定检查，与本片改动**没有共享代码路径**（`aura.spec.ts` 从不打开 dialog、不滚动）：

| 现象 | 证据 | 处理 |
| --- | --- | --- |
| `aura.spec.ts` “a room wears the colour…” 偶发失败 | 两次全量分别失败在两个不同的 aura 断言；单独 `--repeat-each=5` 35/35 通过 | 固定 `waitForTimeout(900)` 改为条件等待：tint 到达 `--aura-target` 且无动画在运行 |
| `deep-link.spec.ts` “tints the hall with the linked passage book” 偶发失败 | 同一次全量 | `settledAura` 原来“连续两次相同就收”——而**默认占位色本身也是稳定的**，取样未完成时会提前返回占位色；改为必须稳定数次且不是 `DEFAULT_ACCENT` |
| `zoom.spec.ts` 真实 2× 放大下控件可达性偶发失败 | 单独运行 1/1 通过 | `reachableWhenMagnified` 原来是“请求滚动后同一 tick 测量”；改为有界轮询直到进入放大可见区 |

三处都**没有放宽断言**：判据仍是原来的数值与条件，只是不再用“等一会儿”代替“等条件”。这与 V2-E3 已经确立的做法一致（截图不再等时长，而是等真实动画状态）。

另外修掉一条**我自己在 E2 写错的断言**：`share.spec.ts` 里“关闭后位置不变”一度被改成“读取 dialog 打开后的 `scrollY` 再比较”，但锁生效时该值被固定在 0，关闭后又还原为真实偏移，于是必然不相等。现在改为比较 `.site-header` 在屏幕上的位置（页面是否真的滚走），并单独逐项断言关闭后没有残留。

### 未验证项

- **真机移动端与 Safari 未验证**：新锁直接改写 `documentElement`/`body` 的 inline style，Safari（尤其 iOS 的橡皮筋与 `visualViewport` 行为）需要真机确认。
- 交互式浏览器缩放菜单仍未手动执行（与 V2-E3 相同）。
- 补 `padding-right` 的分支在本机 Chromium 中测不到：该环境滚动条槽宽为 0（`innerWidth === clientWidth`），因此没有触发补值；逻辑本身由 `scrollbarGutter` 单测覆盖。

### 偏差 / 设计判断

- 不引入 scroll-lock 依赖；用 `body` 离开文档流这一结构手段，而不是“先滚动、再补救”。
- 锁同时覆盖 `html` 与 `body`（docs/16 §6 要求），但真正让页面不可移动的是 `body` 的 fixed + 负 top；只锁滚动根反而会把读者丢回顶部。

### 下一步

V2-E4B（Book Aura 出版卡片），不在本阶段开始。

## V2-E3 最终响应式、键盘与工程 Gate（2026-09-13）

```text
日期 / 执行者：2026-09-13 / 实现 Agent（DeepSeek v4.1 Flash）
范围：V2-E3 — 200% 缩放、320/360/390/768/1440 响应式、完整键盘旅程、错误与封面失败回退、网络与隐私
状态：verified（本机 Chromium）；真机与 Safari 未验证
数据模式与许可依据：真实数据 local-only
代码基线：672c424
```

### 完成内容

1. **真实缺口修复：封面加载失败**。新增 `src/app/CoverImage.tsx`，四处真实封面（出处面板、书籍房间头部、书单行、主题书架缩略图）统一在 `onError` 时回退到真实书名排版框；之前封面文件缺失会留下 broken image。
2. **200% 缩放**：六个房间在 1440×900 与 720×450（即 1440×900 的 200% 等价 CSS 像素视口）下逐一校验无横向溢出、控件不出视口、文字中心完整。
3. **真实放大**：本机 Chromium 用 `Emulation.setPageScaleFactor(2)` 真实放大 2×（`visualViewport.scale=2`、可见宽度减半、布局宽度不变），断言关键控件仍可滚动到达、键盘仍可操作、分享 dialog 仍能打开关闭。
4. **响应式矩阵**：320 / 360 / 390 / 768 / 1440 × 六个房间的全部组合，无横向溢出且控件不出视口；320px 下 398 字最长划线的分享卡片不裁剪、可关闭。
5. **完整键盘旅程**（一条连续会话，不用鼠标）：门厅 → 出处展开 → 再看一处 → 查看这本书 → 单书年份筛选 → 单书批次 → 返回上一处（两级）→ 主题书架 → 主题房间 → 分享 dialog → Esc → 回门厅。每个 Tab 停留点都断言焦点可见（outline 不为 0），激活全部用真实 Enter/Space，并包含一次 Shift+Tab 校验。
6. **错误态**：未知路径、不存在的主题/书籍、无结果的年份筛选、`showModal` 不存在时的非模态回退（`data-modal=false` 仍可打开/复制/关闭）。
7. **网络与隐私**：走完六个房间 + 分享 dialog，全部请求均同源（0 外部请求）；local-only 快照的字段白名单逐层断言（快照/owner/book/theme/highlight 四层）；`.private`、`.agents`、`scripts`、`.env`、`/@fs/` 与编码变体全部不可经 HTTP 读取，且真实划线片段与 `WEREAD_API_KEY` 未出现在任何响应中。

### 修改文件

- `src/app/CoverImage.tsx`（新增）
- `src/features/encounter/EncounterStage.tsx`、`src/features/rooms/BookRoom.tsx`、`BooksRoom.tsx`、`ThemesRoom.tsx`
- `e2e/support/snapshot.ts`（新增，共享真实快照读取）
- `e2e/zoom.spec.ts`、`e2e/keyboard.spec.ts`、`e2e/errors.spec.ts`、`e2e/privacy.spec.ts`（新增）
- `e2e/capture-v2e.spec.ts`、`playwright.capture-v2e.config.ts`（新增）
- `playwright.config.ts`、`package.json`（`capture:v2e` 脚本与忽略规则）
- `README.md`、`docs/07/08/11`

### 命令 → 实际结果

| 命令 | 结果 |
| --- | --- |
| `npm run check:local` | **171 单测 / 12 文件**通过，typecheck + lint 干净 |
| `npx playwright test` | **81 通过**（E2 后 62；新增 7 zoom / 3 keyboard / 5 errors / 4 privacy） |
| `npm run test:public` | 1/1 通过 |
| `npm run verify:ids` | 20 本 / 46 条稳定 ID 指向同一真实材料 |
| `npm run smoke:local` | 3/3 通过 |
| `npm run build` | 成功；dist 仅 3 个文件，**0 条真实划线、0 个书名**进入产物 |
| `npx vite build --mode local-private` | 按预期拒绝：`Local mode cannot be used for a production build.` |
| `npm run capture:review` | 通过（3.9 分钟），六房间 1440/390/320/768 溢出均 0px，最小点击目标 44px |
| `npm run capture:v2e` | 通过，13 张截图写入 `.private/review/v2-e/` |

### 浏览器证据（真实 Chromium，本机 local-only）

证据目录：`.private/review/v2-e/`

- `share-dialog-1440.png`、`share-dialog-390.png`：dialog 与 editorial 卡片，出处低权重、角落品牌、`仅本机 · 未公开审核` 徽标。
- `card-shortest.png`（8 字）→ `data-extended=false`；`card-medium.png`（42 字）→ `false`；`card-299.png`、`card-longest.png`（398 字）→ `true`；四者溢出一律 0/0。
- `zoom-200-hall.png`、`zoom-200-dialog.png`：720×450 下门厅与 dialog。
- `magnified-2x-hall.png`：真实 2× 放大下的门厅。
- `clipboard-failure-1440.png`：Clipboard 被拒时的 `自动复制失败，请手动复制` + 可全选只读文本。
- `reduced-motion-1440.png`：reduced-motion 下房间与颜色直接到位。
- `deep-link-unavailable-1440.png`：`/?h=<不存在>` 的轻提示 + 真实开局。
- 对比度复测（capture:review）：正文 12.7–13.9、次要文字 4.9–5.3，六个房间均无横向溢出。

### 两个真实技术发现

1. **截图不能靠“等一会儿”**：首版 E3 截图拍在房间入场动画进行中，画面几乎是空白（两张不同页面的截图字节完全相同，这是发现它的线索）。改为等待页面**实际启动的动画**结束（`document.getAnimations()` → `finished`）并用 Playwright 的 `animations: 'disabled'` 冻结末态，之后截图才是稳定画面。
2. **Playwright 在真实放大下不能用坐标点击**：`setPageScaleFactor(2)` 后可见区域小于布局视口，坐标命中不可靠。因此放大验证改为“可达性 + 键盘激活”，这本身就是放大用户真实的操作方式。

### 未验证项（诚实列明）

- **真机移动端 / iOS Safari / Android Chrome / 桌面 Safari 均未验证**：本机只有 Chromium。`<dialog>` 的 showModal、`svh`、`text-wrap: pretty/balance`、Canvas 取色与滚动恢复在 Safari 上的表现仍属未知。
- **真实交互式浏览器缩放（Ctrl +/- 菜单）未手动执行**：自动化用的是“CSS 像素视口减半”的等价重排 + 真实 2× 放大两条独立证据，不能互相冒充。
- `showModal` 不可用的非模态回退分支已由测试覆盖（移除原型方法），但真机上触发该分支的老浏览器未验证。

### 偏差 / 设计判断

- **200% 下 dialog 需要自身滚动**：720×450 时卡片 4:5 加动作区超过视口高度，dialog 内部滚动、关闭按钮需滚动到达（或按 Esc）。选择保持“卡片不裁剪、字号不缩水”，而不是把卡片压小。
- **年份筛选是独立历史记录**：键盘旅程确认，从 `?year=` 的书籍房间返回一次回到同书未筛选列表，再返回一次才是门厅。这是 `docs/02 §6` “筛选属于 URL”的直接后果，并且与浏览器后退一致，不是额外逻辑。
- **门厅会记住“再看一处”后的原句**：从书房间返回后显示的是离开时的句子，而不是深链原句；深链地址已在换句时按 `docs/15 §4.1` 清除。
- **public 产物里的 `local-covers` / `__local_cover` 字符串**：它们是 `covers.ts` 与校验器里的运行时代码分支（拒绝非法 `coverPath`），不是数据；public 快照的 book 标题与划线在 dist 中出现次数均为 0。

### 下一步（E3 完成当时）

V2-E1 → E2 → E3 全部完成，当时计划进入 Public Release Gate。用户随后实际体验分享卡片并新增 V2-E4 视觉修订；当前下一步以本文件上方 V2-E4 交接记录与 `docs/16` 为准。仍不得自行公开导出、部署或上传。

## V2-E2 固定 ID 的复制、dialog 与分享预览（2026-09-13）

```text
日期 / 执行者：2026-09-13 / 实现 Agent（DeepSeek v4.1 Flash）
范围：V2-E2 — 稳定 ID 锁定的分享 dialog、复制与失败回退、CSS 卡片预览
状态：verified
数据模式与许可依据：真实数据 local-only；未新增或修改快照
代码基线：54c25d3
```

### 完成内容

1. **纯分享层** `src/domain/share.ts`：`shareReducer`（锁定 ID + 复制结果）、`shareHref` / `shareUrl`（只含一个 `h`，无房间/年份/追踪参数）、`shareText`（原文 + 空行 + `——《书名》作者` + 站点名）、空字段回退。
2. **状态边界**：`useShare` 与所有房间 session 分离；只保存一个 ID 与复制结果。`OPEN_SHARE` 每次重新锁定；`COPY_RESULT` 不可能改变已锁 ID。
3. **dialog**：原生 `<dialog>` + `showModal`；标题、`aria-labelledby`、单一 DOM、打开时焦点进入 `复制文字`、Esc 关闭、关闭后焦点回到原触发器；打开期间锁住背景页面滚动。
4. **复制与失败回退**：成功后才显示 `已复制`；Clipboard 不存在/拒绝/抛错时显示 `自动复制失败，请手动复制` + 可全选的只读 `<textarea>`；local-only 下不调用 `navigator.share`。
5. **卡片预览**：4:5 为默认比例而非裁剪容器；实测高度超比例时自然增高并提示 `长文预览已延长比例`；卡片带 `仅本机 · 未公开审核` 徽标。
6. **分享入口范围**：只发生在当前视觉中心（门厅/主题舞台、书籍房间顶部随机句），均带 `data-share-trigger`；书库、主题书架、单书顺序列表、About 一个都没有。

### 修改文件

- `src/domain/share.ts`、`src/domain/share.test.ts`（新增）
- `src/features/share/useShare.ts`、`ShareDialog.tsx`、`share.css`（新增）
- `src/features/encounter/EncounterStage.tsx`、`src/features/encounter/stage.css`
- `src/features/rooms/StageRoom.tsx`、`HallRoom.tsx`、`ThemeRoom.tsx`、`BookRoom.tsx`
- `src/app/ReadingWorld.tsx`
- `e2e/share.spec.ts`（新增）、`e2e/rooms.spec.ts`（修正一条不成立的旧断言）
- `docs/08-REVIEW-CHECKLIST.md`

### 命令 → 实际结果

| 命令 | 结果 |
| --- | --- |
| `npm run typecheck` / `npm run lint` | 通过 |
| `npm run test` | **171 单测 / 12 文件**通过（E1 后 160） |
| `npx playwright test` | **62 通过**（E1 后 52；新增 10 条分享用例） |
| `npm run test:public` | 1/1 通过 |

### 三个真实技术发现（非猜测，均由证据定位）

1. **React 不能拥有通过 `showModal()` 打开的 `<dialog>`**：`open` 一旦作为 prop 传入，下一次渲染会移除 `showModal()` 设置的属性并关闭对话框。更隐蔽的是**幂等性**：开发模式下 effect 会 setup→cleanup→setup，我最初的清理函数里的 `dialog.close()` 直接触发 `close` 事件，把刚打开的分享状态清空。修正：打开全程命令式且幂等（已打开就返回），不再传 `open`，也不在清理阶段关闭。修正后实测 dialog 保持 `open=true` 且状态稳定。
2. **Windows 剪贴板把 `\n` 规范化为 `\r\n`**：首版断言逐字节比较时失败在此，不是产品缺陷。测试改为比较归一化后的文本，产品仍写入原文。
3. **Chromium 模态焦点环的边界**：从 dialog 最后一个控件继续 Tab 可能把焦点交给浏览器自身 chrome（`activeElement` 变回 `body`），这是浏览器行为。真正要守的性质是“焦点永远不会落到 dialog 之后的页面内容上”，测试据此重写。

### 修正一条已有但本身不成立的断言

全量回归暴露 `e2e/rooms.spec.ts` 的“带外书籍开局”用例失败：期望 b-105 渲染其**最长**划线（133 字），实测 126 字。核对真实数据与引擎后确认：b-105 只有两条划线（133 / 126 字），两条都不在 20–120 偏好带内，因此 `preferLength` 不过滤它们，`pickUniform` 在两者中公平随机选择。该断言要求“必为最长那条”，而引擎从未承诺过这一点；它之前只是运气通过。

- 证据：同一用例连跑三次，b-105 分别实测 133 / 126 / 126 字（`npm run` 输出已记录）。
- 修正：断言改为真实契约——渲染文本必须是该书的真实划线、逐字完整、长度落在统计带之外（这才是“带外书”的定义），band 与 390/1440 无溢出照旧校验。
- 与 V2-B 公平原则一致：不能为了迁就测试而让算法固定选最长句。

### 浏览器证据（真实 Chromium，本机 local-only）

- `复制文字` 写入的内容逐字等于真实原文 + 真实书名作者 + 站点名；`复制本机链接` 写入 `http://127.0.0.1:5173/?h=<id>`，query 只有 `h`。
- `data-highlight-id` 在 dialog 打开期间保持不变：即使在模态后尝试触发 `再来一句` 并连按 Tab，卡片文本与锁定 ID 均不变，复制内容仍属于锁定条目。
- 关闭后重新打开会锁定新句（ID 不同）。
- Clipboard 拒绝：`自动复制失败，请手动复制` + 只读 textarea；点击后自动全选；下一次成功复制会清掉回退面板。
- `navigator.share` 能力被 stub 后调用计数为 0。
- 卡片在 18 / 41–120 字样本上 `data-extended=false`，在 299 / 398 字上为 `true` 且提示可见；两种宽度下 `scrollHeight === clientHeight`、`scrollWidth === clientWidth`（无裁剪、无横向溢出）。

### 未验证项

- 真机移动端与 Safari 仍未验证；200% 浏览器缩放与完整键盘旅程属 V2-E3。
- `showModal` 不可用时的非模态回退分支已实现（`data-modal=false`）但本机 Chromium 不会进入该路径，属于未执行分支。

### 偏差 / 设计判断

- “长文已延长比例”由**实测卡面高度**判定，而不是按字数阈值猜；同一句话在 390px 与 1440px 需要的高度不同，提示必须描述真实渲染。
- 分享 dialog 打开时锁住背景滚动：原生 `<dialog>` 不自动给 body 加滚动锁，而背景随着弹窗滚走会直接影响阅读。

### 下一步

V2-E3（200% 缩放、完整键盘、最终工程 Gate），不在本阶段开始。

## V2-E1 稳定深链与错误状态（2026-09-13）

```text
日期 / 执行者：2026-09-13 / 实现 Agent（DeepSeek v4.1 Flash）
范围：V2-E1 — `/?h=<stable highlight id>`、无效链接的诚实状态、地址规范化
状态：verified
数据模式与许可依据：真实数据 local-only；未新增或修改快照
代码基线：b65d796
```

### 完成内容

1. **唯一规范深链** `/?h=<stableHighlightId>`。`h` 只在门厅有意义；解析层拒绝空值与不存在的位置，未知 ID 仍会到达页面以获得诚实状态。
2. **房间身份与内容定位分离**：新增 `roomPath()`。`routePath()` 输出含 h 的完整地址，但 `routeKey()` / 滚动键 / stage session 键 / Aura key / 聚焦依赖仍把 `/?h=…` 与 `/` 当作同一个门厅。
3. **`OPEN_DEEP_LINK` 新事件**：从现有 `OPEN_HIGHLIGHT` 抽出共享 helper，深链以 `count: false` 到达 —— 记入 all cycle、不改持久 scope、不增加 `commitCount`；原有“用户直接选择”仍为 `count: true`。
4. **首次直接加载不闪错句**：门厅 session 创建时用已校验 ID 做种子（`seedFor`），不再先画一条随机句再替换；无种子时保留原有 RNG 行为与 StrictMode 防守。
5. **SPA 内到达深链**：同一个 id 只处理一次；重复渲染、StrictMode 双调用均为 no-op。
6. **无效 / 撤回 ID**：显示 `这条划线暂不可用`，同时正常公平开局；不白屏、不泄露旧内容。
7. **换句后用 replace 清除 h**：由 `commitCount` 增长驱动，不新增 history entry。只开关出处面板、开关分享弹窗不清除。
8. **其他房间规范化移除 h**：`/themes`、`/themes/:id`、`/books`、`/books/:id` 保留房间与自身筛选，只丢掉不属于自己的 `h`。

### 修改文件

- `src/app/router.ts`、`src/app/router.test.ts`
- `src/domain/encounter.ts`、`src/domain/encounter.test.ts`
- `src/features/encounter/useStageSessions.ts`
- `src/app/ReadingWorld.tsx`、`src/features/rooms/HallRoom.tsx`
- `e2e/deep-link.spec.ts`（新增）
- `docs/08-REVIEW-CHECKLIST.md`

### 命令 → 实际结果

| 命令 | 结果 |
| --- | --- |
| `npm run typecheck` / `npm run lint` | 通过 |
| `npm run test` | **160 单测 / 11 文件**通过（V2-E1 前 151） |
| `npx playwright test` | **52 通过**（原 44；新增 8 条深链用例） |
| `npm run test:public` | 1/1 通过；公开空快照每个房间仍为诚实空状态 |
| `npm run validate:data:local` | OK 4,663 / 130 / 14（唯一警告不变：无原始换行样本） |

### 浏览器证据（真实 Chromium，本机 local-only）

- `/?h=<真实id>`：精确显示该条原文；刷新、书签、新标签页仍指向同一条。
- 出处面板展开后可见该书真实书名；开关面板不丢失 `h`。
- 深链所在书的门厅 Aura 与该书自己的书籍房间 Aura **完全相等**（颜色归属随书，不随房间猜测）。
- 深链是同一个门厅：Aura 层未被重建（DOM 探针存活）、`#room` 聚焦计数 0、`window.scrollTo` 调用计数 0。
- `再来一句` 后地址变为 `/`，`history.length` 不变，焦点仍在刚按下的控件上。
- 从 `/themes` 返回 `/?h=<id>`：原句与地址都恢复。
- `/?h=h-does-not-exist`：提示 + 真实开局；下一步操作清提示并移除 query。
- `/themes`、`/themes/:id`、`/books?year=2024`、`/books/:id` 收到 `h` 时只丢弃 `h`，房间与筛选不变。

### 未验证项

- 真机移动端、Safari 与 200% 缩放仍属 V2-E3。
- 分享 dialog、复制与卡片仍属 V2-E2。

### 偏差 / 设计判断

- 清除 `h` 的口径：规格写“下一次操作清除”，实现选择在**用户真正换句/换书时**清除（`commitCount` 增长），而不是在加载阶段就规范化掉 —— 这样刷新前后地址一致，未知 ID 的提示也能稳定显示到用户动手为止。
- 单元测试无需浏览器：深链的语义（是否计入 commit、是否写入范围、是否改变 scope）全部在 domain 层可验。

### 下一步

V2-E2（固定 ID 的复制、dialog 与分享预览），不在本阶段开始。

## Critique #2 产品结论：从单页平面进入一个个房间（2026-09-13）

### 用户反馈与决定

用户在 V2-A 真实全量页面上再次确认：当前文字排版、真实封面与整体 taste 很好，但页面仍显“苍白”。封面色主要停在小图片里，没有被页面环境接住；舞台、书籍、主题和 About 又全部位于同一张长页面，内容有层级但空间仍是平的。

用户同意以下建议：

- 门厅 `/` 只保留一句、出处、`再来一句` 与去主题/所有书/About 的低权重入口，不再向下铺完整世界层。
- 主题书架 `/themes`、主题房间 `/themes/:id`、所有书 `/books`、书籍房间 `/books/:id`、About `/about` 成为同一阅读世界里的独立房间。
- 主题房间采用“安静阅读室”：一次一条，`再来一句` 持续留在主题，可进入这个书架里的书。
- 颜色采用 Book Aura：来自真实封面并归属于当前房间/当前书；不给主题人为分配语义色。
- 门厅颜色约 4%～7%，主题房间局部约 3%～6%，书籍房间约 8%～12%；第一眼仍必须是文字。
- 呼吸感来自留白、轻微进入/返回、慢于文字的环境色过渡和“空间醒来”，不来自持续漂浮、3D、视差或拟物门动画。
- 首次进入先出现纸张，约 300ms 内句子出现，当前书环境色约 700ms 进入；无启动页和 Logo 动画。
- 第一版不做永久循环背景动画；reduced-motion 取消位移、错峰和长颜色过渡。
- 浏览器返回与页面返回一致；从书籍返回后恢复原主题/书库现场，不无故重抽一句。

### 对原计划的影响

- `docs/10 §8` 中“视觉继续保持现状、不增加彩色背景”的限制被本次明确反馈取代；文字中心、非 Dashboard 与不做大色块/封面墙继续成立。
- 原 V2-C 拆成 **V2-C1 房间路由与 IA**、**V2-C2 Book Aura 与呼吸动效**，避免算法、路由、结构和视觉同片施工。
- V2-B 范围不变，仍只做公平两阶段引擎和 scope 状态；不能借本次确认提前重写 UI。
- 新权威文档：`docs/12-ROOMS-COLOR-MOTION-DIRECTION.md`。
- 当时的下一片开工提示词：`docs/13-V2-B-IMPLEMENTER-PROMPT.md`（已执行；当前下一批见 `docs/14-ROOMS-CONTINUOUS-IMPLEMENTER-PROMPT.md`）。

### 评审结论

- V2-A 工程复核：通过（`verify:ids`、87 单测、24 E2E）。
- 当前视觉：taste 通过，但单页平面与色彩归属不足，不作为最终视觉。
- 房间、颜色、动效方向：用户确认，可进入分片施工。
- 该轮只更新规划与交接，未修改产品代码，也未启动 V2-B；按新切片顺序，V2-B 随后作为独立一片实施（见上方 V2-B 执行记录）。

## V3 Batch 3 收口（2026-09-19）

```text
日期 / 执行者：2026-09-19 / 当前实现 Agent
范围：Batch 3 最终词表判定、draft / override / lexical 复核、新增标签污染检查与回归
状态：verified（内容与工程）；不包含 schema 3、小径 UI 或地图
代码基线：eaf93d6
```

### 完成范围

1. 对用户提出的 11 个词表外概念完成全语料与边界审计：新增稳定标签 `tag-054 债务`、`tag-055 失败`；另由缺口审计补入 `tag-056 希望`。其余建议并入现有标签边界，`准备`对应句诚实保留 draft。
2. 逐条处理原 29 条 unresolved，并复核 override / lexical；最终 294 reviewed / 6 draft。6 条 draft 不进入后续 reviewed 数据，也不要求用户继续处理。
3. 对三个新增标签的全部试标命中做专项污染复核，移除债务→解雇/时间浪费/贫困、希望→礼貌请求/统计期望/一般文学段落等系统性误标。
4. 偏薄标签处置完成：`运气`试标仅 1 本，但全语料词面证据 64 条 / 23 本，因此保留；不为凑覆盖制造 assignment。
5. `.private/tags/review-queue.md` source hash 仍为 `203f381a…fd0c00`，未被生成器覆盖；`tags:review-apply` 报告 3 条直接应用、11 条 Agent 判定、0 条待决。

### 最终私有结果

```text
稳定词表                 56 标签 / 6 家族
试标                     300
reviewed / draft         294 / 6
1 / 2 / 3 标签           113 / 114 / 73
多标签                   62.3%
provenance               ensemble 152 / override 128 / lexical 11 / unresolved 6 / human 3
标签覆盖                 56 / 56
孤儿 / 过宽              0 / 0
试标偏薄                 运气 1 本（全语料 64 条 / 23 本，保留）
词表待决                 0
```

### 数据与边界

- 全部 embedding 与重算继续使用本机 `Xenova/bge-large-zh-v1.5@a48549b-q8-cls`；没有远程 embedding 请求。
- private 词表、种子、assignments、理由与审计继续只在 `.private/tags/`；public snapshot 仍为空 schema 2，publication policy 未修改。
- 未开始 schema 3、主题小径、地图、public export、public covers、repo、push 或部署。

### 实际命令与结果

| 命令 | 结果 |
| --- | --- |
| `npm run tags:promote` / `tags:seeds` / `tags:trial:generate` | 56 标签 / 448 候选种子 / 41 边界；300 条整批重算；仅本机模型 |
| `npm run tags:trial:review` / `tags:review-apply` / `tags:trial:audit` | 294 reviewed / 6 draft；3 条直接用户决定、11 条 Agent 判定、待决 0；56 / 56 覆盖 |
| `npm run tags:review-queue` | 生成 158 条 Agent 诊断报告；未覆盖用户手写文件 |
| `npm run check:local` | typecheck、lint、269 单测 / 25 文件、schema 2 local 校验通过；唯一警告仍为无原始换行 |
| `npm run verify:ids` / `npm run smoke:local` | 20 本 / 46 条种子稳定；6 / 6 真实数据 smoke 通过 |
| `npm run test:e2e` | 106 / 106 local Chromium 通过 |
| `npm run test:tags` | 首轮暴露测试按全局 editorialOrder 映射 checkbox 的陈旧假设；改为按可访问标签名定位后 10 / 10 通过 |
| `npm run test:publication` / `npm run test:public` | 9 / 9；1 / 1 通过 |
| `npm run build` / `npm run isolation:public` | public build 成功；隔离 clean；0 本 / 0 条 |
| `vite build --mode local-private` / `tag-studio-private` | 均按预期退出 1，保护错误文本保持不变 |
| `git diff --check` / `.private` tracked | 通过 / 0 |

### 浏览器证据

- 本阶段没有消费者 UI 或视觉变更，因此不新增产品截图，也不把旧截图冒充 V3 视觉验收。
- Studio 数据契约和 56 标签布局已由 10 个 Chromium E2E 验证；修复的是测试定位方式，不是放宽 1–3 标签约束。

### 未验证项

- 6 条 draft 是明确保留的内容空缺，不伪装为通过；4,663 条全量标注仍属于 Batch 6。
- 真机移动端、Safari 与首次访客继续未验证；Studio 不做移动端验收。

### 下一步

提交本阶段后，进入 Batch 4 schema 3、主题小径与 V3 视觉基础；正式发布 Gate 不变。

## V3 Batch 4A：schema 3 与 reviewed 试标投影（2026-09-19）

```text
日期 / 执行者：2026-09-19 / 实现 Agent
范围：schema 3、TopicTag 公共安全契约、reviewed assignment 本地投影
状态：verified（纯领域与真实本地数据）；消费者 UI 尚未开始
数据模式：完整 local-only 4,663 条 + 私有 Batch 3 词表 / assignments
代码基线：14995d7
```

### 完成范围

- `Snapshot` 升级为 schema 3：新增扁平 `tags` 与每条 `Highlight.tagIds`；Book Theme 仍只属于 Book。
- strict validator 新增 `tag-NNN`、2–4 字标题、未知引用、重复引用、最多 3 个标签、快照稳定顺序及私有生产字段拒绝。
- local builder 读取 `.private/tags/vocabulary.json` 与 `assignments.json`，只应用 `status=reviewed` 的 294 条分配。
- 6 条 draft 与尚未进入 Batch 6 的其余划线明确写为 `tagIds: []`；不读取其占位标签，不为覆盖率补造语义。
- public 空快照同步升级为 schema 3，仍保持 0 本 / 0 条 / 0 标签。
- publication preview 保留实际被选划线引用的标签定义，不携带 confidence、rationale、candidate、family 或 note。
- 派生索引新增 `tagsById`、`highlightsByTag`、`tagsInUse` 与 tagged coverage。

### 真实数据结果

- local：4,663 条 / 130 本 / 14 个 Book Theme / 56 个 Topic Tag。
- 已应用 reviewed 标签：294 条；明确未标注：4,369 条（含 6 条 draft）。
- 当前试点 56 个标签全部至少有一条 reviewed 划线；8 个标签尚未达到未来公开小径建议的 3 本 / 5 条阈值，只记 warning，不伪装成全量分布。
- 唯一历史数据警告仍为没有原始换行样本。

### 实际命令与结果

| 命令 | 结果 |
| --- | --- |
| `npm run snapshot:local` | schema 3 重建成功；294 reviewed 应用，4,369 未标注 |
| `npm run validate:data:local` | 通过；10 条诚实覆盖 warning |
| `npm run validate:data` | public schema 3 空快照通过 |
| `npm run typecheck` | 通过 |
| 定向 Vitest | 51 条 schema / tag / publication 相关测试通过 |

### 浏览器证据 / 未验证项

- 本阶段没有消费者页面变化，因此未生成截图；浏览器 Gate 留给 Batch 4C–4D。
- 主题小径算法、路由、岔路、分享全标签与视觉尚未实现。
- 真机、Safari 与首次访客仍未验证。

### 下一步

进入 Batch 4B：实现可注入 RNG 的小径公平轮、显式重开、岔路保持当前句，以及可关闭并稳定降级的书内 embedding 节奏。

## V3 Batch 4B：公平小径与本机语义节奏（2026-09-19）

```text
日期 / 执行者：2026-09-19 / 实现 Agent
范围：主题小径纯领域算法、低维路径投影、真实试点可达性证明
状态：verified（纯领域 + 真实 294 条 reviewed 试点）
代码基线：caaaa2c（Batch 4A）
```

### 完成范围

- 新增有限 `PathWalkState`：进入即计为已见、轮内不重复、完成后停住、只在明确操作后重开。
- 硬约束顺序固定为：当前 tag 资格 → 未见候选 → 按书公平 cycle → 尽量避开当前书 → 在选中书内选句。
- 所有候选按 stable highlight ID 排序；所有随机入口注入 RNG；固定输入可完全复现。
- embedding 节奏只在选书之后生效，随机走近 / 中 / 远宽区间，并避开单一最近重复与最远离群；向量缺失或书内候选不足时均匀降级。
- 岔路函数以当前多标签划线作为新路径首点，不移动当前文字，也不修改旧路径状态。
- 本机 builder 从已锁定的默认 1024 维缓存为 294 条 reviewed 划线生成 16 维 int8 风格随机投影；原始向量仍只在 `.private`。
- 未标注划线不携带路径投影；投影不改变标签资格，也不能让任何候选永久不可达。

### 真实数据结果

- 294 条 reviewed 划线均带 16 维量化路径投影；4,369 条未标注划线不带该字段。
- 56 / 56 条试点小径在 `uniform` 与 `semantic` 两种模式下均完成全量可达。
- 固定 seed 下，两种模式至少有一条真实小径产生不同顺序，证明开关不是同一算法的视觉假象；候选集合完全相同。

### 实际命令与结果

| 命令 | 结果 |
| --- | --- |
| `npm run snapshot:local` | 294 × 16 路径投影写入 schema 3 local snapshot |
| `npm run typecheck` | 通过 |
| `npm run lint` | 通过 |
| 定向 Vitest | 31 条通过；含 56 条真实小径双模式全量可达循环 |

### 浏览器证据 / 未验证项

- 本阶段是纯算法与数据派生，尚无新消费者页面，因此没有截图。
- 路由 session / Back 恢复与岔路视觉留给 Batch 4C。
- 16 维投影只服务小径软节奏，不作为地图布局；Batch 5 仍需独立的固定 seed 地图管线。

### 下一步

进入 Batch 4C：`/paths`、`/paths/:tagId`、主导航、路径 session、岔路保持当前句，以及门厅 / 书房 / 主题房间的全部线索入口。

## V3 Batch 4C–4D：消费者小径、全标签分享与视觉基础（2026-09-19）

```text
日期 / 执行者：2026-09-19 / 实现 Agent
范围：路径路由与 session、岔路、房间线索入口、分享全标签、V3 视觉基础与浏览器 Gate
状态：verified（本机 Chromium）；待用户体验 Gate
数据模式：schema 3 local-only；294 reviewed / 4,369 未标注；public 仍为空
代码基线：ea194a3（Batch 4B）
```

### 完成范围

- 新增 `/paths` 与 `/paths/:tagId`，五项主导航与 public 空态；56 条小径按稳定 editorial order 展示真实书数 / 划线数。
- 每个标签保存独立有限轮 session；纯公平 / 有呼吸可切换；完成后停住，必须明确重开。
- 多标签划线以全部平等文字线索显示；岔路先把交叉句写入目标 session，再 push URL，所以新路径保持当前句，下一次操作才离开，Browser Back 恢复原路径现场。
- 门厅、主题房间、书籍房间只在当前句已有 reviewed 标签时显示全部线索；未标注内容无占位词或模型候选。
- 分享复制文字和 Book Aura 卡片展示全部 Topic Tag，不用 `+N`；stable highlight ID、local-only 与滚动锁契约不变。
- V3 视觉 token、五项导航、小径目录、文字中心路径房间、节奏分段控制、规则线与 1440 / 390 / 320 响应式完成；reduced-motion 取消位移与长过渡。

### 实际命令与结果

| 命令 | 结果 |
| --- | --- |
| `npm run check:local` | typecheck、lint、**284 单测 / 29 文件**、schema 3 local 校验通过；4,369 未标注与 8 个低覆盖标签为诚实试点 warning |
| 定向 Vitest | 路由 / 分享 / 路径领域 **34 / 34** |
| `npm run test:e2e -- --workers=2` | **109 / 109** local Chromium；首次 4 worker 运行 108 / 109，唯一 2× 可达性时序项随后隔离重复 5 / 5，并在本次全套通过 |
| 定向路径 / 房间 / 隐私 / Slice 0 | **32 / 32** |
| 定向分享 / 键盘 | **13 / 13** |
| `npm run test:tags` / `test:publication` / `test:public` | **10 / 10**、**9 / 9**、**1 / 1** |
| `npm run verify:ids` / `smoke:local` | 20 本 / 46 条稳定 ID 不变；4,663 / 130；**6 / 6** smoke |
| `npm run capture:v3-batch4` | **3 / 3**；截图前等待 260ms 内容淡入结束 |
| `npm run build` / `npm run isolation:public` | public schema 3 空快照构建成功；dist 隔离 clean，真实书名 / 划线 / 封面路径均为 0 |
| `npm run build -- --mode local-private` | 按预期拒绝；保护错误原文保持不变 |
| `git diff --check` / `.private` tracked / remote / `.github` | 干净 / 0 / 无 / 无 |

### 浏览器证据

`.private/review/v3-batch4/`：`paths-1440/390/320.png`、`fork-1440/390/320.png`、`fork-reduced-motion-390.png`、`path-longest-390.png`、`share-longest-390.png`。已检查 1440 / 390 / 320 无横向溢出；最长 reviewed 划线和三标签卡片无裁切。

### 未验证项与边界

- 真机移动端、Safari 与真实首次访客未验证；Studio 不做移动端验收。
- 当前只有 294 条 reviewed 试点进入小径；4,369 条保持未标注且仍通过原房间可达，6 条 draft 未被强贴标签。
- 8 个试点标签未达到未来公开建议的 3 本 / 5 条；正式 public export 前仍要在全量标注后复核。
- 地图 `/map`、独立地图布局数据与 Canvas / 无障碍区域列表属于 Batch 5；不得复用 16 维小径投影冒充地图坐标。
- public snapshot、public covers、repo、push、workflow 与部署均未开始。

### 下一步

先由用户体验 Batch 4 的主题小径与视觉方向；Gate 通过后进入 Batch 5 世界地图 MVP。正式发布仍等待独立用户授权。

## V3 Batch 5A：全量地图布局与 schema（2026-09-19）

```text
日期 / 执行者：2026-09-19 / 实现 Agent
范围：独立地图降维、版本化私有 manifest、消费者安全 MapLayout、strict validator
状态：verified（纯领域 + 全量真实布局）；地图 UI 尚未开始
数据模式：schema 3 local-only；4,663 点 / 56 标签中心；public 仍为空
代码基线：2068185（Batch 4D）
```

### 完成范围

- 用户体验 Batch 4 后反馈主题小径“挺棒的”，明确授权进入 Batch 5。
- 新增 `umap-js@1.4.0` 作为只在本机构建脚本使用的成熟降维实现；消费者 bundle 不导入它。
- 全部 4,663 条真实划线从锁定的本机 1024 维 embedding，经地图专属 96 维稀疏随机投影后，以固定 seed UMAP 生成二维坐标；没有复用小径的 16 维 `pathVector`。
- 坐标裁掉外侧 1% 极端值后量化为 0–10,000；56 个标签中心使用 reviewed 成员坐标中位数；64×40 密度网格和三层等高线均由真实点生成。
- 私有 `.private/maps/local-layout.json` 保存模型、seed、参数、snapshot hash、tag hash 与 layout hash；消费者 snapshot 只含 version、point / label / density / contour。
- strict validator 要求 map 点一一覆盖全部 highlight，拒绝未知 / 重复引用、越界坐标、非法网格、非法等高线和任何额外私有字段。
- local snapshot 已附带 4,663 点 / 56 标签 / 624 等高线段；public 空快照不含 map。

### 实际命令与结果

| 命令 | 结果 |
| --- | --- |
| `npm run map:layout`（连续两次） | 两次均为 4,663 点 / 56 标签 / 624 线段；layout hash 均为 `83eb9aed…ecc1d329` |
| `npm run snapshot:local` | map 成功附加；snapshot 约 2.35 MB；原 10 条诚实内容 warning 不变 |
| 地图 / validator 定向 Vitest | **28 / 28** |
| `npm run check:local` | typecheck、lint、**291 单测 / 30 文件**、schema 3 local 校验通过 |
| `npm run validate:data` | public schema 3 空快照通过 |

### 未验证项 / 下一步

- 当前只完成布局数据，没有开放 `/map`，不能把数据 Gate 冒充地图视觉 Gate。
- UMAP 视觉质量、标签避让、世界 / 区域 / 详情交互、Book Aura、Back、移动端与性能留给 5B–5D。
- public / local 生成命令与输出路径独立；public 当前为空，因此未生成正式 public map，更未导出或发布。

下一阶段：Batch 5B Canvas 世界总览、主题区域、划线详情与无障碍区域列表。

## V3 Batch 5B–5D：消费者地图、Book Aura 与视觉 Gate（2026-09-19）

```text
日期 / 执行者：2026-09-19 / 实现 Agent
范围：Canvas 世界总览、主题区域、划线详情、语义替代、Book Aura、恢复、响应式与完整回归
状态：verified（本机 Chromium）；待用户地图体验 Gate
数据模式：schema 3 local-only；4,663 地图点 / 56 reviewed 区域；public 仍为空
代码基线：d73d925（Batch 5A）
```

### 完成范围

- 新增 `/map?tag=…&book=…&h=…`：世界总览、主题区域、稳定划线详情与点亮书可以组合并由真实 URL 表达。
- 单一 Canvas 绘制全部 4,663 点、64×40 密度、三层等高线、主题标签、当前区域点、Book Aura 点和当前详情点；没有创建 4,663 个 DOM 按钮或全文节点。
- 总览只开放标签命中；主题区域只开放当前 tag 的 reviewed 点；点亮书时该书全部点可交互，未标注点不获得虚构主题归属。
- 小径列表和当前区域划线列表作为完整语义替代；Canvas 支持焦点、方向键、`+/-`、拖动、滚轮和复位。
- 世界与每个主题 scope 独立保存 viewport；打开区域 / 书 / 详情写入 history，拖动缩放不污染 history；Browser Back 恢复原位置、缩放和语义现场。
- 从小径列表、小径房间和书籍房间进入地图；书房入口自动以该书真实 Book Aura 点亮全部点。
- 地图详情显示完整原文、出处、全部标签、分享、书房与小径入口；移动端详情移到 Canvas 下方。
- public 空快照 `/map` 显示诚实空态；snapshot map 白名单与私有 map manifest HTTP 阻断加入隐私回归。

### 实际命令与结果

| 命令 | 结果 |
| --- | --- |
| `npm run check:local` | typecheck、lint、**294 单测 / 31 文件**、schema 3 local 校验通过；10 条既有试点 warning 保留 |
| `npm run test:e2e -- --workers=2` | **114 / 114** local Chromium |
| 地图 / rooms / privacy / Slice 0 / keyboard / zoom 定向 E2E | **45 / 45** |
| `npm run capture:v3-batch5` | **3 / 3**；世界、区域、详情、六本 Aura、reduced-motion |
| `npm run test:tags` / `test:publication` / `test:public` | **10 / 10**、**9 / 9**、**1 / 1** |
| `npm run verify:ids` / `smoke:local` | 20 本 / 46 条种子 ID 稳定；4,663 / 130；**6 / 6** smoke |
| `npm run build` / `npm run isolation:public` | public 空快照构建成功；dist clean，真实书名 / 原文 / coverPath 为 0，私有 map / embedding / 凭证探针 absent |
| `npm run build -- --mode local-private` | 按预期拒绝；保护错误原文保持不变 |
| `git diff --check` | 通过 |

### 浏览器与视觉证据

- `.private/review/v3-batch5/world-1440.png`、`world-390.png`、`world-320.png`；
- `region-1440.png`、`region-390.png`、`region-320.png`；
- `detail-390.png`；
- `book-aura-1.png`～`book-aura-6.png`，至少四种真实封面色；
- `region-reduced-motion-390.png`；
- Canvas 像素检查非空；1440 / 390 / 320 与 200% 等价视口无横向溢出，标签和控件无重叠裁切。

### 设计判断与偏差

- 移动端没有按早期草案“默认只显示列表”；最终保持大画布为主路径，同时让语义列表紧邻地图并可独立完成同等任务，更符合地图作为作品的产品目标。
- 56 个标签中心都可进入区域，但当前只有 294 条 reviewed 点可在主题区域命名和打开；其余 4,369 点只构成未命名地形，避免 Batch 6 前伪造语义。
- Canvas 的地形、密度和等高线来自真实布局；标签避让只移动文字，不移动真实点或标签中心。
- Book Aura 不画连线，不把地图做成网络图或 Dashboard。

### 未验证项与下一步

- Safari、真机触摸和真实首次访客仍未验证。
- Batch 6 全量标注尚未开始；全量标签完成后地图区域密度和 public 布局仍需重建 / 复核。
- public snapshot、public covers、repo、push、workflow 与部署均未开始。

下一步：由用户体验 `/map` 的世界总览、主题区域、详情与 Book Aura。用户通过地图 Gate 后才进入 Batch 6；未通过则只修正 Batch 5，不提前扩全量标签。

## V3 Batch 5E：地图结构性精修与用户 Gate（2026-09-20）

```text
日期 / 执行者：2026-09-20 / 实现 Agent
范围：不依赖全量标签的地图视觉层次、标签避让、缩放手势、状态表达与移动端节奏
状态：verified（本机 Chromium）；用户已授权进入 Batch 6
数据模式：schema 3 local-only；仍为 294 reviewed 试点 / 4,663 地图点
代码基线：feb88ac（Batch 5D）
```

### 用户 Gate 与范围判断

- 用户体验后判断地图“起码现在已经具备雏形，功能上的体验也已经实现”，希望继续打磨到更接近产品级。
- 用户赞同“先做结构性精修，再全量标注，最后重建并共同精修最终地图”的顺序，并明确授权连续进入 Batch 6。
- 本阶段不手工移动真实点、不调整标签中心、不围绕 294 条试点做会被全量标注推翻的最终构图。

### 完成范围

- 加强密度场、三层等高线、全量点和主题点的墨色层次，保留暖纸与非 Dashboard 方向。
- 标签绘制加入多候选位置自动避让、克制引线与半透明纸面底；标签中心和真实点坐标不变。
- 当前区域多标签点增加细双环；Book Aura 点增加轻光晕，书籍信息形成低饱和状态带。
- 主题区域标题显示正式标签定义；世界 / 区域状态、缩放比例和最小操作提示进入地图边缘层。
- 滚轮缩放改为围绕指针下的地图坐标；新增双指平移缩放；拖动、键盘和复位契约保持不变。
- 详情层增加当前书 accent 顶线与克制进入；移动端只淡入、不位移，并降低工具栏和画布前的垂直占高。

### 实际命令与结果

| 命令 | 结果 |
| --- | --- |
| 地图领域定向 Vitest | **4 / 4**；新增指针锚点缩放坐标不漂移 |
| 地图定向 E2E | **6 / 6**；新增滚轮锚点与缩放读数验证 |
| 地图 + zoom 定向 E2E | 首轮 **13 / 14**，唯一失败为文案从“已有线索”改为“已命名点”；同步断言后地图套件 6 / 6 |
| `npm run check:local` | typecheck、lint、**295 单测 / 31 文件**、local schema 校验通过 |
| `npm run test:e2e -- --workers=2` | **115 / 115** local Chromium |
| `npm run capture:v3-batch5` | **3 / 3**；更新 1440 / 390 / 320、区域、详情、六本 Aura 与 reduced-motion 证据 |
| `git diff --check` | 通过 |

### 视觉证据与边界

- 更新后的 `.private/review/v3-batch5/` 显示：默认地图不再过淡，标签在高密区域仍可读，区域定义和选中状态明确，Book Aura 与普通地形有层级差。
- 320 / 390 首屏仍保留站点导航、地图标题和最小控制，但画布比上一版更早进入视野。
- 双指缩放已实现；Chromium 自动化验证覆盖几何与滚轮锚点，真机多指手势仍留待设备 Gate。
- Safari、真机与首次访客继续未验证。

### 下一步

立即进入 Batch 6：先建立可重复、可审计的全量候选与分批复核管线，再按 200–300 条批次推进；无法可靠归类的内容保留 draft。全量完成后重建地图并与用户共同精修最终视觉。

## V3 Batch 6A：全量候选、双模型否决与审计管线（2026-09-20）

```text
日期 / 执行者：2026-09-20 / 实现 Agent
范围：4,663 条真实划线的分批候选、本机 reranker 评测、保守 reviewed 决策与全量审计
状态：in-progress；管线 verified，内容质量 Gate 未关闭
数据模式：schema 3 local-only；assignments 1,318 reviewed / 3,345 draft；消费者 snapshot 仍为 294 reviewed 试点
代码基线：3beaacc（Batch 5E）
```

### 完成范围

- 建立 18 个可续跑批次，每批最多 250 条；baseline 外 4,363 条均有 top-10 候选，既有 300 条试标独立保存且不被覆盖。
- embedding ensemble 使用稳定词表种子、294 条 reviewed 示例、跨书近邻与词面证据；不按覆盖率强制升级低信心项。
- 下载并固定本机 `Xenova/bge-reranker-base@280bcc2-q8`；划线文本只在本机推理，没有发送到远程 provider。
- reranker 独立 top-1 仅 52.0%，因此明确否决“用 reranker 替代分类器”；只在 embedding high primary 位于 reranker 前二时作为第二模型支持。
- 回滚一次错误的自训练 refinement：全文抽样发现政治史文本被泛化为「改革 / 宣传控制」，该轮结果未保留在当前 assignments。
- 双模型初筛结果为 1,171 reviewed / 3,492 draft；自动生成 reviewed 只保留一个强支持标签，多标签候选继续留在 draft。
- 新增全量审计：风险排序、逐标签全文样本、draft 边界、单书集中、过宽 / 过薄标签和 provenance 分布。
- 累计应用 312 条全文 override：关闭自动高风险队列、修正中心主题和多标签边界，并逐条阅读全文晋升 158 条最强 draft；当前为 1,318 reviewed / 3,345 draft。
- reviewed 标签数分布为单标签 980 / 双标签 244 / 三标签 94，平均 1.33 个；thin / broad 为 0 / 0。

### 实际命令与结果

| 命令 | 结果 |
| --- | --- |
| `npm run tags:full:generate -- --force` | 4,363 条 / 18 批；high / medium / low = 1,243 / 2,162 / 958；top-10 全实际标签召回 88.1% |
| `npm run tags:full:reranker:evaluate` | 294 条试点；独立 top-1 52.0%，不合格；embedding high + reranker 前二的 primary 命中 94.4% |
| `npm run tags:full:rerank` | 4,363 条 top-10 候选完成本机交叉编码，私有缓存可续跑 |
| `npm run tags:full:review` | 4,663 assignments；双模型初筛 1,171 reviewed / 3,492 draft |
| `npm run tags:full:override` | 累计 312 条全文决定成功应用；1,318 reviewed / 3,345 draft |
| `npm run tags:full:audit` | 自动 high-risk 0；thin 0 / broad 0 / 单书集中 2 |
| `npm run check:local` | typecheck、lint、**300 单测 / 32 文件**、现有 local snapshot 校验通过 |
| `git diff --check` | 待本阶段提交前执行 |

### 设计判断与偏差

- 试点 calibration 复用训练示例，不是 held-out；94.4% 只能作为保守阈值诊断，不能替代全文抽样。
- 当前 1,318 reviewed 已关闭自动高风险队列，但 3,345 条 draft 仍需按标签与书籍边界继续复核；消费者 snapshot 没有重建，地图仍只命名原 294 条试点点位。
- 「精力」「亲密关系」「货币」出现单书集中，来源书本身分别以这些主题为核心，不自动判为错误，但必须抽样检查。
- 高风险全文队列已发现少量明显误配，因此本阶段只确认管线，不关闭 Batch 6 内容 Gate。

### 未验证项与下一步

- 继续按 56 个标签与书籍检查剩余 draft，优先处理跨书可验证、中心主题明确的边界项。
- 复核「精力」「货币」单书集中和低计数标签的跨书代表性；不再使用自动 reviewed 自训练传播。
- assignments 质量 Gate 通过后再重建 local snapshot、路径投影和地图布局。
- Tag Studio、真实数据 smoke、消费者 E2E、最终地图截图尚未针对 Batch 6 新 assignments 执行。
- public export、push 与部署仍未开始。

完整实况见 `docs/28-BATCH-6-FULL-TAGGING.md`。

## V3 Batch 6B–D：全文边界收口、消费者重建与最终地图 Gate（2026-09-20）

```text
日期 / 执行者：2026-09-20 / 实现 Agent
范围：多轮逐标签全文复核、停止线判断、final assignments、snapshot / path / map 重建、浏览器证据
状态：verified；Batch 6 内容质量 Gate 已关闭，等待最终地图体验 / 视觉 Gate
数据模式：schema 3 local-only；1,694 reviewed / 2,969 draft；4,663 最终地图点
代码基线：2fb35e7（Batch 6C）
```

### 完成范围

- 继续完成三轮逐标签最强 draft 全文复核与一轮停止线抽查；候选仅用于定位，最终按中心主题重判。
- 累计 688 条全文 override；最终 1,694 reviewed / 2,969 draft，coverage 36.3%。
- provenance：ensemble 875 / lexical 11 / override 805 / human 3 / unresolved 2,969。
- reviewed 标签数：单标签 1,020 / 双标签 434 / 三标签 240，平均 1.54；自动 high-risk 0，thin / broad 0 / 0。
- 停止线以下已稳定出现否定语境、词面偶合和词表无法概括的内容；这些条目诚实保持 draft，不再追求覆盖率。
- 重建 local snapshot：1,694 条 reviewed 带 16 维路径投影；2,969 条 draft 保持空 `tagIds`。
- 重建最终地图：4,663 点 / 56 标签中心 / 624 条等高线段；layout hash `567534bf71bfc5f6266ceb8ecd26267c4399888d87a1d606fed784a03d9fcd9e`。
- Tag Studio 测试从历史硬编码 300 条改为完整 assignment backlog，并消除运行中删除测试目录造成的服务读取竞态。
- 真实路径测试改为核对 snapshot tagged ID 与 reviewed assignments 完全一致，不再硬编码 294 条试点。

### 实际命令与结果

| 命令 | 结果 |
| --- | --- |
| `npm run tags:full:override` | 688 条决定；1,694 reviewed / 2,969 draft |
| `npm run tags:full:audit` | high-risk 0；thin 0 / broad 0 / 单书集中 3 |
| `npm run snapshot:local` → `npm run map:layout` → `npm run snapshot:local` | 最终 snapshot、路径投影和地图成功重建 |
| `npm run check:local` | typecheck、lint、300 单测 / 32 文件、最终 local snapshot 校验通过 |
| `npm run smoke:local` | 6 / 6 |
| `npm run test:tags`（连续两次） | 10 / 10；完整 4,663 条 backlog 冷启动稳定 |
| `npx playwright test e2e/map.spec.ts e2e/paths.spec.ts e2e/privacy.spec.ts e2e/keyboard.spec.ts --project=chromium` | 18 / 18 |
| `npm run build` | public 空快照生产构建通过 |
| `npm run isolation:public` | public 产物无真实书名、原文、私有标签字段、模型缓存或凭证探针 |
| `git diff --check` | 通过 |

### 浏览器证据

- Chromium：1440×1000、390×844、320×720；世界、最大区域「交易」与三标签详情均成功渲染。
- 证据：`.private/review/v3-batch6/world-1440.png`、`world-390.png`、`world-320.png`、`region-*`、`detail-390.png`。
- 世界总览保持单 Canvas；语义区域列表完整；移动详情无横向溢出；public / private 隔离通过。

### 未验证项与下一步

- Safari、真机触摸 / 双指缩放、低性能设备和真实首次访客仍未验证。
- 当前停在最终地图体验 / 视觉 Gate：重点讨论全量标签后的区域密度、标签层级、移动详情节奏和超长区域语义列表。
- public export、public covers、repo、push、workflow 与部署仍未开始。

## V3 最终地图视觉与交互精修（2026-09-20）

```text
日期 / 执行者：2026-09-20 / 实现 Agent
范围：渐进列表、独立地图导航、移动端布局、滚轮隔离、书籍选择器与 Book Aura 信息收束
状态：verified；等待用户最终地图体验 / 视觉 Gate
数据模式：schema 3 local-only；1,694 reviewed / 2,969 draft；地图布局未改写
代码基线：31dc6dd（Batch 6D）
```

### 完成范围

- 世界区域与区域划线默认显示 12 项，提供展开全部、收起和显示进度；完整语义替代仍可达。
- 顶部导航增加独立「世界地图」入口；地图 URL 的 active nav 不再落在主题小径。
- 移动端导航换行为两行，无横向溢出；地图高度提升为 72svh，工具栏和点亮书籍控件分层。
- 小屏世界总览优先显示 8 个主标签，放大后显示 12 个；桌面总览 18 个，深层放大最多 26 个。
- 修复滚轮同时缩放地图和滚动页面：实际缩放时使用 `{ passive: false }` 原生监听并 `preventDefault`，缩放边界则允许页面继续滚动。
- “点亮一本书”保留原生 select，重绘为 Book Aura 控件；选中后色彩、轨道点、书名状态一致。
- 选中书籍的相关小径先展示 6 条，其余通过 disclosure 展开，避免移动端标签墙。

### 实际命令与结果

| 命令 | 结果 |
| --- | --- |
| `npm run check:local` | typecheck、lint、300 单测 / 32 文件、最终 local snapshot 校验通过 |
| `npm run test:e2e` | 完整 local Chromium 116 / 116 |
| `npm run test:tags` | 10 / 10 |
| `npm run build` | public 空快照生产构建通过 |
| `npm run isolation:public` | public 产物隔离 gate clean |
| `git diff --check` | 通过 |

### 浏览器与视觉证据

- 1440×1000、390×844、320×720：世界总览、最大区域「交易」、三标签详情和点亮书籍均重新截图。
- 证据：`.private/review/v3-batch6/world-*`、`region-*`、`detail-390.png`、`book-picker-lit-390.png`。
- 200% zoom 与 320 / 360 / 390 / 768 / 1440 响应矩阵通过；无页面横向溢出。
- 滚轮测试在页面已滚动的状态下同时验证放大与缩小，页面 `scrollY` 保持不变。

### 未验证项

- Safari、真机触摸 / 双指缩放、低性能设备和真实首次访客仍未验证。
- public export、public covers、repo、push、workflow 与部署仍未开始。

## GPT-6 Astra 产品审美审阅准备（2026-09-21）

```text
日期 / 执行者：2026-09-21 / 实现 Agent
范围：为高能力模型准备整体产品与视觉设计 Critique 材料
状态：ready；等待外部审阅结论
代码基线：bee0ad9
```

### 已准备

- 新增 `docs/29-GPT6-ASTRA-DESIGN-REVIEW-BRIEF.md`：集中说明产品命题、锁定边界、当前完成度、视觉方向、必看页面、重点问题和期望输出格式。
- 明确要求把产品审美作为核心产品能力审阅，重点覆盖视觉身份、文字舞台、小径、地图、Book Aura、控件语言、分享卡片与移动端。
- 要求建议落到构图、排版、色彩、空间、动效和分批 Gate，避免“增强层级”等泛泛表达。
- 准备 `.private/review/gpt6-astra/` 最新真实截图包，共 13 张：门厅、小径、书房、所有书、地图世界 / 区域 / 详情 / Book Aura、About 和分享卡片，并附 `manifest.json`。
- 审阅任务只要求产出指导，不授权修改代码、数据、public snapshot、push 或部署。
- 新增 `docs/29A-GPT6-ASTRA-TEXT-ONLY-DESIGN-REVIEW-PACKET.md` 处理模型无视觉能力的边界：逐页文字转录 13 张截图，整理全局 tokens、字号、行高、栅格、Canvas 层级、响应式规则和 10 组结构性设计张力。
- 要求无视觉模型不得假装看过截图，并在正式报告中区分 DOM / CSS 可确认事实、基于文字转录的判断和必须由视觉能力或真实访客复核的事项。

### 未验证 / 下一步

- 等待 GPT-6 Astra 实际浏览本地页面并给出正式审阅；若模型可写仓库，目标文件为 `docs/30-GPT6-ASTRA-DESIGN-REVIEW.md`。
- 审阅结论需要由用户确认优先级后，才能进入下一轮视觉施工。

## 产品与艺术指导审阅交付（基于 bee0ad9）

- 新增 `docs/30-GPT6-ASTRA-DESIGN-REVIEW.md`：完整审阅、三个视觉方向、推荐私人图集、逐页修改、地图十层专项、三批实施与审美 Gate；建议尚待用户批准，不是施工授权。
- 本轮通过 PowerShell 执行 Node / Playwright Chromium 浏览：门厅换句5次、书内3次、小径继续、书架、地图滚轮缩放及键盘平移、区域列表打开详情、两本 Aura、390px地图与分享。
- 浏览器证据与实际尺寸：`.private/review/astra-critique/`。390×844 的地图 Canvas 起点约478px；从区域列表打开详情后观察到详情可能在可视范围外，列为待专项复核。
- 第一次 Node stdin 命令因 PowerShell 中文编码导致正则语法错误，未执行浏览；改用 ASCII selector 后完成。未修改产品代码、标签、快照或发布状态。
- 没有重跑完整测试；仅文档变更，执行 `git diff --check`。Safari、真机、完整岔路往返、跨色域六书与真实首次访客仍未验证；本轮两本 Aura 均偏暖，不冒充全色域验证。
- 下一步：用户确认视觉主方向与优先级后，再开始独立施工批次。

## 「可漫游的私人图集」视觉优化计划（2026-09-21）

```text
日期 / 执行者：2026-09-21 / 实现 Agent
范围：把 docs/30 产品与艺术指导审阅转成可施工、可回滚、可逐批验收的计划
状态：planned；等待用户确认后开工
代码基线：94e59a3；产品代码未修改
```

### 计划结果

- 新增 `docs/31-V3-PRIVATE-ATLAS-VISUAL-OPTIMIZATION-PLAN.md`，锁定不改内容、标签、算法、地图坐标和发布范围。
- Batch 7A：固定同一真实样本做前后对照，建立阅读版心、首屏预算、三列两行移动导航、门厅 / 书房 / 小径 / About差异构图。
- Batch 7B：先复核地图列表进入详情的focus / scroll问题，再用同坐标Current / Reduced / Terrain三套静态渲染选择方向；随后施工密度、等高线、点、标签、移动首屏、Book Aura和详情恢复。
- Batch 7C：比较小径单列渐进、桌面双栏、渐进+完整名称索引三种目录结构，再收口主题书架、所有书、分享与全站出口。
- 只设置三个用户Gate：7A-0私人图集方向、7B-1地图渲染方向、7C-4最终审美Gate；常规施工与测试不反复询问。
- 明确禁止重跑UMAP求美观、移动真实点、公开私有family、引入新功能、外部字体CDN、动画 / 地图库和把视觉实验留在public bundle。

### 验证

- 本阶段仅文档与计划变更；未修改消费者代码、数据、private assignments或public snapshot。
- 执行 `git diff --check`；未重跑产品测试。
- 正式施工后每批独立运行local完整检查、E2E、Tag Studio、public build / isolation并保存before / after真实截图。

## V3 Batch 7A：私人图集阅读版心与界面减法（2026-09-21）

```text
日期 / 执行者：2026-09-21 / 实现 Agent
范围：全局阅读tokens、门厅、主题房间、书房、小径、About、移动导航与局部Book Aura
状态：implemented and verified；等待用户7A视觉Gate
数据模式：schema 3 local-only；内容、标签、算法、地图坐标与public范围未改
代码基线：1a0884e（Batch 7A前）
```

### 完成范围

- 建立shell / reading / directory / map / long-reading语义宽度与上下文间距tokens；桌面阅读面从约1050px收束至860px，长文约28个汉字宽。
- 移动一级导航稳定为三列两行，六个入口全部显式保留；Local状态降为小色点文字，但“仅本机 · 未公开审核”仍完整可读。
- 门厅短 / 中句起点前移，最长文独立上移；出处在移动端分成书名、作者与时间两层。
- 书房使用96px来源边栏、正文阅读柱、真实Book Aura短线与局部光区；移动封面缩为60×87px。
- 小径把“纯公平 / 有呼吸”移入进度旁原生disclosure，当前状态可见且键盘可切换；当前线索改为短墨线标记。
- About先解释空间使用方式，4,663条与130本数据各只出现一次。
- 新增 `docs/32-BATCH-7A-PRIVATE-ATLAS-READING-SURFACES.md` 记录施工、量化前后差异和未验证项。

### 同一真实样本证据

- 样本：`h-1076`最短、`h-443`中等、`h-231`最长、`h-013`三标签、`b-013`书房、`tag-040`小径。
- Before：`.private/review/v3-private-atlas/before/`。
- After：`.private/review/v3-private-atlas/after/`，另含320px与reduced-motion补充截图。
- 桌面最短 / 中句起点分别由404 / 347px前移至284px；最长文217px→208px。
- 移动最短 / 中 / 最长分别为441→297px、290→297px、290→261px。
- 证据脚本：`.private/review/v3-private-atlas/capture-7a.mjs`；真实内容与截图继续只在 `.private/`。

### 实际命令与结果

| 命令 | 结果 |
| --- | --- |
| `npm run check:local` | typecheck、lint、300 / 300 Vitest（32文件）、4,663条 / 130本 / 14书架local snapshot校验通过 |
| `npm run test:e2e` | 完整local Chromium 117 / 117 |
| `npm run test:tags` | 10 / 10 |
| `npm run build` | public空快照生产构建通过 |
| `npm run isolation:public` | gate clean；真实书名、原文、封面、私有标签字段与凭证未进入public产物 |
| `git diff --check` | 通过 |

### 施工中发现与修复

- 第一次完整E2E为115 / 117：小径节奏disclosure展开后在720×450和768px超出右侧。保留测试并把桌面disclosure限制为154px、移动限制在100%内后，定向zoom 2 / 2，最终完整117 / 117。
- Aura仍来源于真实封面；颜色对比、过渡、rapid draw和reduced-motion既有测试继续通过。
- 生产构建仍只读取空的 `src/data/public-snapshot.json`；没有改变地图layout hash或重建数据。

### 未验证 / Gate

- Safari、真机触摸 / 动态地址栏、macOS实际字体fallback、低性能设备和真实首次访客未验证。
- 等待用户判断私人图集方向、860px阅读面、移动三列两行导航、书房边栏 / 小径短线与局部Aura。
- 7A视觉Gate未通过前不进入Batch 7B；public export、repo、push、workflow和部署仍未开始。

## 同数据颠覆性视觉方向探索（2026-09-23）

```text
日期 / 执行者：2026-09-23 / 实现 Agent
范围：在不修改产品代码与地图布局的前提下，比较浅纸陈列、墨色世界/纸上抵达、跨页出版三种构图
状态：第一轮静态对照完成；等待用户选择深化方向。7A视觉Gate未通过，原7B产品施工暂停
数据模式：schema 3 local-only；4,663真实点、56标签锚点、同一亮书b-013（531点）、同一真实详情h-013
代码基线：3b127a8；public仍为空
```

### 修改与证据

- 新增 `docs/33-V3-READING-WORLD-RADICAL-DIRECTION-STUDY.md`，记录三种方向的强弱、诚实限制和下一步Gate。
- 私有脚本 `.private/review/v3-private-atlas/explore-directions.mjs` 读取本机现有snapshot，产出18张真实数据桌面/移动世界、点亮、详情静态截图。
- 可并排打开 `.private/review/v3-private-atlas/direction-exploration/index.html`；同目录 `manifest.json` 记录各图的中心、缩放、绘制点数及Canvas起点。
- 序列化 map SHA-256仍为 `567534bf71bfc5f6266ceb8ecd26267c4399888d87a1d606fed784a03d9fcd9e`；没有移动点、造数据、改变标签或公开范围。
- 静态 A 浅纸较安全却不够颠覆；B 深浅材料转换强但有“星图”风险；C 跨页让地图与一句话建立关系，但移动端与地图颗粒仍须深化。**没有宣称三套已达到最终品质**。

### 实际命令与结果

- `node .private/review/v3-private-atlas/explore-directions.mjs`：生成18张同样本PNG、gallery与manifest，点数4663、亮书531、map hash匹配。
- Node manifest / PNG完整性核对：18 / 18 文件、4,663真实点、531亮书点、同中心与既有map hash匹配。首次通过PowerShell stdin传中文断言时因控制台编码把文字变为问号，**该次断言失败**；改为ASCII元数据断言后通过，未更改生成结果。
- `git check-ignore .private/review/v3-private-atlas/direction-exploration/index.html`：被忽略，不进入public产物；`git diff --check`通过。
- 此阶段仅写入Git可追踪的状态文档，没有修改消费者代码；没有把静态截图误记为键盘、焦点、触摸或构建通过。

### 未验证 / 下一步

- 静态稿没有真实控件、读屏、区域切换、Back、滚动恢复、200%与reduced-motion行为；Safari、真机与真实访客也未验证。
- 推荐以C的“跨页阅读关系”为结构原型，单独测试B的暗图/浅图材质变量；先由用户选择深化方向，再重写7B/7C实施计划，不自动进入产品改造。
- public export、public covers、repo、push、workflow与部署仍未启动。

## 跨页世界同版式配色对照（2026-09-23）

```text
日期 / 执行者：2026-09-23 / 实现 Agent
范围：用户确认跨页关系后，全亮 / 全深 / 深图浅文三种单变量静态配色研究
状态：静态对照与完整性核对完成；推荐深图浅文用于下一轮交互原型，等待用户颜色方向Gate
数据模式：同一schema 3 local-only快照；4,663点 / 56标签锚点 / b-013 531点 / h-013及h-231 398字
产品基线：3b127a8，产品代码和public快照未改
```

### 实际产物、命令与结果

- `docs/34-V3-CROSS-PAGE-PALETTE-STUDY.md` 记录方法、三版取舍、局限与Gate。
- 本机生成 `.private/review/v3-private-atlas/palette-study/` 的并排查看页、manifest与30张真实数据截图；桌面1440、移动390、窄屏320，包含世界/亮书/详情/最长文本。
- `node .private/review/v3-private-atlas/explore-directions.mjs --palette-study`：产出30张PNG，map SHA-256 `567534bf71bfc5f6266ceb8ecd26267c4399888d87a1d606fed784a03d9fcd9e`，未修改真实点。
- Node + sharp 对manifest、点数、完整PNG、标题/正文/Canvas bounding box及同一暗图像素检查通过：30/30；D全深与E深图浅文的地图在1440/390对应图里像素完全一致。
- 静态CSS指定颜色的主文本对比仅作为方向计算；未把它当作长时间阅读或真实浏览器字体验收。
- 用户提供的flomo认知地图、微信读书深色书摘和亮色产品参考均在 `.private/reference/` 中检视，没有复制素材或假语义山峰。

### 浏览器证据与判断

- Playwright Chromium截图：`.private/review/v3-private-atlas/palette-study/{c,d,e}-{world,lit,detail,long}-{desktop,mobile}.png` 及窄屏世界/长文；本地 `index.html` 可并排查看。
- 同一跨页关系下，C全亮阅读稳定但地图弱；D全深地图有力量但长文仍需真实读者验证；E深图浅文在地图→原文的材质转换和长文承载上最有潜力。三者均非最终作品。
- 390px Canvas顶部约195px，320px约233px，仅为此静态原型的构图测量；静态控件不可操作。

### 未验证与下一步

- 无真实地图交互、原生选择器、语义列表、焦点/Back、触摸、200%、reduced-motion、Safari或首次访客验证；本阶段未重跑消费者测试或生产构建，因为仅更改方向文档。
- 用户若确认E为可交互原型主候选，再修订原7B/7C施工计划并实现测试；**不自动批准整站配色或发布**。

## Batch 7D-0 — 全深跨页样板边界与地图详情抵达（2026-09-23）

- **范围**：用户否决深图浅文在手机上的突然变色，授权将全深作为可交互样板主方向；旧 `docs/34` 对 E 的判断保留为历史记录，当前边界与独立 Gate 见 `docs/35`。只修地图详情入口的可见性与焦点，不在此阶段换色。文件：`docs/31`、`docs/34`、`docs/35`、`src/features/map/MapRoom.tsx`、`e2e/map.spec.ts`、本记录。
- **先红后绿**：Chromium真实local快照新增两个回归测试，改前2/2失败（390px列表进入详情和320px最长原文直达均没有详情标题焦点）。修后9/9地图 E2E 通过、`npm run typecheck`通过、`git diff --check`通过。原地图视口与列表Back测试仍绿。
- **行为**：详情开启后焦点落在标题，标题不在视口时滚动到可读位置；Back/关闭返回仍存在的来源元素及离开时的窗口位置，原来源被卸载则退回Canvas。直达URL经页面原有room-memory定时恢复后仍能滚到正文。保留完整原文及真实标签。
- **未验证**：此阶段尚未拍摄7D样板前后图、尚未实现深色Canvas/阅读页；Canvas直接点选、关闭与桌面滚动在7D-1浏览器矩阵中继续测，Safari和真实设备依旧未测。
- **偏差 / 下一步**：修复了会使手机读者看不到刚打开原文的真实行为故障；随后以相同真实地图做全深交互样板，单独视觉Gate前不得将色板推荐当作成品。

## Batch 7D-1 / 7D-2 — 全深地图↔阅读交互样板与独立视觉 Gate（2026-09-23）

- **完成范围**：仅地图房间及同页外壳改为连续的深墨绿地形＋暖深灰阅读面；桌面并页、手机缩短详情地图并把完整原文第一段带进视口；详情 Aura 随真实来源书封，531点亮书改小半透明点避免实心伪地形；其他房间继续7A浅色。修改 `src/app/ReadingWorld.tsx`、`src/features/map/{MapRoom,MapCanvas,map.css}`；新增 `e2e/capture-7d.spec.ts`、`playwright.capture-7d.config.ts`、地图E2E；文档 `docs/35`、`docs/36`、本记录及状态入口。
- **浏览器证据**：本机真实快照 `b-013` / `h-013` / `h-231`，1440×900、390×844、320×720；after 25张PNG在 `.private/review/v3-private-atlas/dark-cross-page/after/`，12个视口×场景无横向溢出；Canvas截图、亮书滚入视口、完整长文元素和分享对照见 `docs/36`。地图序列化SHA-256未变。初拍before未等淡入结束，不能用于亮度的公平比较；此偏差不掩盖。
- **实际命令**：`npm run check:local` 300/300；`npm run test:e2e` 首次并行119/121（非地图房间等待真实快照超时），重跑两项2/2、完整 `npx playwright test --workers=1` 121/121；新增来源书封测试后再次完整单worker运行122/122，地图12/12；`npm run test:tags` 10/10；`npm run test:public` 1/1；`npm run build`、`npm run isolation:public`、`git diff --check`通过；capture 1/1，25张 after。多worker加载竞争仍应监控，不能称其首次全绿。
- **未验证/判断**：Safari、真实手机/200%、读屏、长时阅读舒适度及真实首次访客未验；全站尚未深色化，手机世界首屏的工具仍偏多。**停止在独立7D视觉Gate**，请用户先看真实交互样板，未授权原7B/7C、公快照/封面导出、push或部署。

## Batch 7D-3 — 亮书选择器细节与下一轮视觉方向（2026-09-23）

- **范围**：把系统弹出选书列表替换为同深色语言的原生模态书目对话框；从真实 `booksInUse` 检索书名/作者，选中书保留 `book=` URL、封面 Aura 与原地图坐标。搜索为空、无匹配、关闭、Escape 和返回焦点均有真实浏览器验证。320/390px缩放与选书并排，减少控制区纵向占位，使真地图更早出现在首屏。未更改主题标签、点位、公开范围或其他房间配色。文件：`src/features/map/MapBookPicker.tsx`、`MapRoom.tsx`、`map.css`、`e2e/map.spec.ts`、`e2e/capture-7d.spec.ts`、`docs/37` 与状态文档。
- **真实浏览器证据**：390px 实况 `.private/review/v3-private-atlas/dark-cross-page/after/mobile-book-picker.png`，并列对照同目录 `mobile-world.png` 与 `narrow-world.png`；13/13 地图测试，123/123 完整 Chromium E2E（单worker），最终手机断点调整后地图回归13/13、截图任务1/1。搜索的真实书名/作者与选中态来自本机快照；长书名换行而非截断，选择后的书名在地图工具栏允许省略，完整书名在紧接着的选中书来源行显示。独立卡片与地图点语义未动。
- **命令**：`npm run check:local` 300/300，`npm run build`、`npm run isolation:public`、`npm run test:public` 1/1、`git diff --check` 通过。Studio 本阶段未重跑（前一阶段10/10），Safari、真机、读屏、长时间深色阅读未验证。
- **产品判断**：用户肯定全深地图但认为整体冲击力仍不够；这项控件修复不等于7D视觉Gate通过。现行“地图深、其他页浅”只是局部施工隔离，不是最终全站配色定案。下一轮首选用相同真实布局试验「地形开场」，再将「从书入图」作为状态，与索引开场对照；见 `docs/37`。正式发布仍停。

## Batch 7E — 地形开场的局部构图试验（2026-09-23）

- **范围**：用户授权由实现者决定下一步后，先做 `docs/37` 的地形开场。仅世界总览 `/map` 及点亮书的世界层获得全幅地图；主题区域、详情与其他房间继续7D/7A的布局。改变容器和标题层级，世界顶部删除重复小径出口但主导航与底部仍可达；不改变真实布局、点、标签、默认缩放或路径算法。文件：`src/features/map/MapRoom.tsx`、`map.css`、`e2e/map.spec.ts`、`e2e/capture-7d.spec.ts`、`docs/38`和状态文档。
- **浏览器证据**：固定真数据的前一版 `.private/review/v3-private-atlas/dark-cross-page/after/` 与本轮 `7e/` 的1440/390/320世界、亮书、详情、长文及地图滚入视口截图；两者map SHA-256一致。390px地图全屏宽、无横向溢出，原始zoom=1；320px主题区域和详情未误套世界全幅。视觉仍待用户独立判断，不把工程正确当作「惊艳」结论。
- **实测命令与未验证**：`npm run check:local` 300/300，`npm run build`、`npm run isolation:public`、`npm run test:public` 1/1，7E截图1/1（26 PNG、12场景0横溢），地图+缩放22/22。完整 `npx playwright test --workers=1 --reporter=dot` 连续两次各123/124：第一次门厅数据加载等待超时、第二次分享弹层降级模拟遇一次滚动事件；两条单独复跑均1/1通过，**未宣称完整套件稳定全绿**。`npm run test:tags` 10/10。Safari、真机、读屏和长时间深色阅读仍待验证。下一步仅在用户看到真实样板后推进跨房间深色统一；public export / push / deploy 未授权。

## Batch 7F — 跨页深色阅读系统第一版（2026-09-23）

- **范围**：用户认可7E地形开场，但认为整站尚未达到商业产品的打磨程度，授权跨页艺术指导。消费页面统一 `shell--night` 暖深灰阅读材质，地图独立深墨绿；书房真实书封及Aura、小径位置标记、桌面双列平面目录、手机单列、导航/筛选/分享弹层共用层级。未改内容、标签、坐标、算法、Studio或公开边界。实现：`src/app/ReadingWorld.tsx`、`page.css`、`src/features/rooms/rooms.css`、`src/features/paths/paths.css`、`src/features/encounter/stage.css`；浏览器回归/捕获 `e2e/cross-page-dark.spec.ts`、`e2e/capture-cross-page.spec.ts`、`e2e/aura.spec.ts`、`e2e/map.spec.ts`、捕获配置及默认测试忽略。
- **浏览器证据**：`.private/review/v3-private-atlas/cross-page-dark/{before,after}/` 同一真实内容在1440/390/320的7个房间，21场景均无横溢，同一书房/小径原文及同一地图hash；额外手机分享与320px最长划线完整截图。新页眉曾让地图晚入首屏约30px，单独收紧地图空间后390px地形起点仅比原7E晚约8px。实际Aura对比度正文约12:1、次要文字约8:1。
- **命令与偏差**：`npm run check:local` 300/300；完整 `npx playwright test --workers=1 --reporter=dot` 最终127/127；最终页眉间距/根级color-scheme微调后地图/Aura/跨页专项24/24及截图1/1、再次`npm run check:local` 300/300，`npm run build`、`npm run isolation:public`、`npm run test:public`通过。首次完整跑126/127是旧Aura测试从根浅色变量计算新版深色纸面，修正为读取当前房间的纸面而不降低阈值；另一次60项局部跑59/60源自旧地图测试的“返回浅色”断言，已改为验证深色材料有区分。
- **Gate**：这只是连续深色系统的第一版，不宣称达到商业成熟。真机/Safari/读屏/真实浏览器200%、长时阅读和全书目异常标题尚未验收；下一步按 `docs/39` 做跨页精细设计审阅与独立视觉Gate。原7B/7C、公快照导出、公开封面、push与部署继续暂停。

## Batch 7G — 全内容边界与跨页回程收口（2026-09-23）

- **范围**：用户认可7F跨页深色方向后，逐页审计130本书、56条小径，发现硬几何问题0；仅精修320px真实长书名（完整标题顺着封面后展开）及3本无封面的诚实占位，原文/书名、Book Aura、地图坐标、发布范围均未变。代码：`src/features/rooms/BookRoom.tsx`、`BooksRoom.tsx`、`rooms.css`、`src/app/CoverImage.tsx`；测试：`e2e/audit-7g.spec.ts`、`e2e/7g-navigation.spec.ts`、`e2e/errors.spec.ts`、`e2e/rooms.spec.ts`、`e2e/scroll-lock.spec.ts`、`playwright.config.ts`及专用配置；详见`docs/40`。
- **浏览器证据**：`.private/review/v3-private-atlas/7g/{before,after}/`；320与1440逐页全量核对0溢出/覆盖/截断；320、390、720等价200%下的15个长标题/缺封面样本0溢出，真实封面等图片解码后再拍；390px地图`h-013`→书→Back→小径→书→Back→分享→地图路径通过。最长书名`b-099`手机正文新起点约y=588，原文不缩短。未安装新依赖。
- **命令与偏差**：前后全量审计各1/1，最终边界补拍1/1；`npm run check:local` 300/300，完整`npx playwright test --workers=1 --reporter=dot`最终128/128，`npm run build`、`npm run isolation:public`、`npm run test:public`通过。第一次完整127/128来自非showModal弹层测试偶发把打开时的scrollY=0事件算进后续滚轮；单测5次失败1次，改为确认弹层稳定后再记录，原滚轮零事件门槛不变，10次连续通过。Studio未重跑。
- **Gate**：工程收口完成；只有Chromium环境，Safari、真机、读屏、真实浏览器200%及长时阅读未验。视觉品质最终Gate与首次访客路径仍需独立判断；7B/7C及public export/covers/push/deploy继续暂停。

## Batch 7H — 真实使用验收包与本机可验证结果（2026-09-23）

- **范围**：建立首次访客任务卡，覆盖首页→书→返回、地图→划线→小径→返回、分享关闭和键盘完整路径；新增`e2e/audit-7h.spec.ts`与专用配置。未新增产品功能，未修改真实数据/地图/发布范围；详见`docs/41-BATCH-7H-FIRST-VISITOR-ACCEPTANCE.md`。
- **本机结果**：320/390/720/1440 CSS px的10条关键路线采集239个文字样本，最低对比度≥4.5且无横溢；390px首页、书库、小径、地图、详情键盘遍历无无名称焦点、不可见焦点或`aria-hidden`内焦点。亮书来源名使用浏览器Canvas颜色读回，修正了`color(srgb ...)`测量误判。Chromium探测确认`Ctrl+=`不改变视口，不能冒充浏览器菜单200%；720×450重排与CDP2×继续作为不同证据。
- **Gate**：本机未发现可复现的产品阻塞，因此没有为了测试制造代码改动。首次访客、Safari、真机触摸、读屏、系统菜单200%、低亮度长时阅读仍待人工验收；7B/7C、公快照导出、公开封面、push与部署继续暂停。

| 编号 | 事项 | 依据 |
| --- | --- | --- |
| PUB-01 | 公开发布决定：确认哪些划线与主题可对外公开（用户明确指出这一步留到开发完成、发布前讨论；开发阶段内容可自由传输使用） | 用户 2026-09-12 决定 |
| PUB-02 | 主题标题与划分的最终复核（当前已获用户口头同意，公开前再核） | docs/03 §6 |
| PUB-03 | 导出 `src/data/public-snapshot.json` 并做产物审查（无原始标识、无密钥、无私密字段） | docs/02 §4、PRIV-01 |
| PUB-04 | 版权与引用长度复核 | PRODUCT_BRIEF §14 / Gate 4 |
| PUB-05 | 分享链接、卡片预览与部署地址的真实外部行为验证 | Gate 4 |
| PUB-06 | 书封素材：已下载 127 张原始封面用于开发（单张约 80KB）。公开发布前需确认版权与使用范围，并生成多尺寸缩略图 | docs/05 §5、docs/02 §7 |
| PUB-07 | 书籍简介：确定是否使用出版社简介删节或自写编辑说明，并逐本核对 | docs/03 §2 |


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

## V3 Batch 7I - Stability and publication preparation (2026-09-23)

- Scope: freeze the current visual baseline and audit loading failure, empty/public states, unknown routes and IDs, missing map selections, stable sharing, focus return, and public isolation. No real content, tags, map coordinates, covers, or publication scope changed.
- Added `e2e/audit-7i.spec.ts` and `playwright.audit-7i.config.ts`; registered the audit in `playwright.config.ts`.
- Results: 7I audit 3/3; `npm run check:local` 300/300; full Chromium E2E 128/128; `npm run build`; `npm run isolation:public`; and `npm run test:public` 1/1 all passed.
- One initial full-E2E attempt lost the manually running Vite process after 93 tests and produced connection-refused failures. After restarting the local server, the complete run passed. This is retained as test-environment instability, not a product regression.
- Public snapshot remains empty. Public export, public covers, repository creation, push, workflow, deployment, Safari, real-device touch, screen readers, system-browser 200% zoom, low-brightness long reading, and first-visitor observation remain outside this Gate.
- Decision: local 7I stability is verified; next priority is publication-content and rights review. Batch 7B/7C remains paused. Details: `docs/42-BATCH-7I-STABILITY-AND-PUBLICATION-PREP.md`.

## V3 公开投影导出前审计（2026-09-23）

- 范围：复用已完成的 130 本书公开审核，不重新选书；新增只读 `publication:audit:v3`，内存中投影拟公开的书、划线、标签、路径向量与固定坐标过滤地图，只把汇总报告写到 Git 忽略的 `.private/`。没有更改 publication policy、local/public snapshot、封面或消费者 UI。
- 修改文件：`scripts/publication-v3-audit.ts`、`scripts/embeddings/mapLayout.ts`、`tests/map-layout.test.ts`、`package.json`、`docs/43-V3-PRE-EXPORT-PROJECTION-AUDIT.md` 与本记录。纯函数测试证明过滤不会移动点、标签中心/地形按保留点重算，缺失固定点位时拒绝继续。
- 真实结果：130 已审核，108 本/3,462 条拟公开，22 本/6 条排除；其中 reviewed 1,432 条、draft 2,030 条；56 个 Topic Tag、1,432 条 reviewed 路径投影；过滤地图 3,462 点/56 锚点，坐标原样保留。内存 schema 3 校验通过，public snapshot 仍 0 本/0 条。
- 实际命令：`npm run publication:audit:v3` 通过；`npm run check:local` 301/301；`npm run build`、`npm run isolation:public` 通过；Chromium `npm run test:public` 1/1。浏览器证据仅为公开空态；本阶段无视觉改动，不冒充完整 local E2E 或新的截图验收。
- 未验证/偏差：现有 `map:layout:public` 会重跑 UMAP，不能用于保持原坐标的正式导出；过滤地图目前仅内存生成，正式导出器尚未接入。Studio、Safari、真机、读屏、系统 200% 和版权个案判断未由本审计完成。
- 下一步与 Gate：未来导出器共用过滤逻辑，对真实 public snapshot/covers/构建与跨页行为重新验收；正式 public export、public covers、repo、push、workflow、部署仍需用户明确授权。详情见 `docs/43-V3-PRE-EXPORT-PROJECTION-AUDIT.md`。

## V3 Public snapshot export and local release acceptance (2026-09-23)

- User explicitly authorized local public export. `npm run publication:export` generated `src/data/public-snapshot.json` and 108 resized `public/covers/*.jpg`; no repository, push, workflow, or deployment action was performed.
- Export uses the existing publication policy projection, filters the fixed local map coordinates without rerunning UMAP or moving points, and writes a private metadata-only report to ignored `.private/publication-export-audit.json`.
- Exported scope: 108 books, 3,462 highlights, 13 book themes, 56 Topic Tags, 1,432 reviewed path vectors, 2,030 draft highlights without tags/vectors, 3,462 map points, 56 map labels, 108 cover derivatives; 22 books and 6 highlights remain absent.
- `npm run validate:data`, `npm run build`, `npm run isolation:public`, `npm run check:local` (301/301), and non-empty public Chromium `npm run test:public` (6/6) passed. Full local Chromium E2E first returned 127/128 because the browser session closed during one responsive-matrix test; the isolated retry passed. This is retained as environment instability, not a product failure.
- Isolation was updated for the non-empty release: approved public content is allowed, while private tools, credentials, raw IDs, tag-production fields, local paths, excluded items, and review metadata remain prohibited.
- Build note: the approved snapshot makes the minified JS bundle about 1.6 MB; this is a performance follow-up, not a content/isolation failure.
- Remaining: production-oriented review of static hosting base path, 404 fallback, bundle size, and final manual public-content review; Safari, real device, screen reader, system-browser 200%, low-brightness reading and first-visitor observation remain unverified. Deployment is still a separate explicit authorization. Details: `docs/44-V3-PUBLIC-SNAPSHOT-EXPORT-AND-ACCEPTANCE.md`.

## v1 Gate 2 工程检查（历史清单；v2 迁移后按 docs/11 验收）

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
