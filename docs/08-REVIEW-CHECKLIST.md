# 08 — 执行记录与 Prototype Review

## 当前真实状态

| 项目 | 状态 | 说明 |
| --- | --- | --- |
| 产品基线 | V3 权威已建立 | PRODUCT_BRIEF 保留历史基线；产品 / 施工以 `docs/19–22` 为准，Batch 1 实况见 `docs/23` |
| 开发文档 | 已准备 | 用户追加“只用真实数据”已纳入 |
| Codex skill 移植 | 完成 | 项目 `.agents/skills/weread-skills/`，原安装未改 |
| skill 版本 | 1.0.4 | 官方更新包已审查，项目约束已重新应用 |
| 只读辅助脚本 | 已建立并执行 | `scripts/weread-request.ps1`、`scripts/weread-fetch-highlights.ps1` |
| 微信读书连接 | 已验证 | notebooks / shelf / bookmarklist 均实际调用成功 |
| 已取数据 | 已全量抓取 | 笔记本全部分页：132 本有笔记；已抓 130 本划线约 4,700 行 |
| 私密状态 | 已获开发授权 | 323 个书架条目均 secret=1；用户已授权全部书籍用于开发 |
| 真实划线原文 | 已获取并全量入库 | 候选池与 schema 2 local-only 快照均为 4,663 条（8–400 字去重后） |
| 全部书籍开发授权 | 已批准 | 包括私密阅读；取消 6 本限制 |
| 本机开发快照 | 已生成 | `.private/local-snapshot.json`：4,663 条 / 130 本 / 14 个书籍主题书架，visibility=local-only（含义为“尚未做发布决定”） |
| 前端工程骨架 | 已完成（Slice 0） | React 19 + TS 6 + Vite 8；严格数据校验、仅本机隔离 |
| 文字舞台（Slice 1） | 已完成 | 真实句子为视觉中心；三档排版；导航（3 项待开放）；160/280ms 转场 |
| 换句交互（Slice 1） | 已完成 | 状态机 + 快速连点防重入 + reduced-motion 即时切换 + 单一 aria-live |
| 策展序列（Slice 2） | 已完成 | Opening / Contrast / Surprise / Exploration、评分、去重优先、cycle 重置、book scope |
| Surprise 机制修订 | 已按用户反馈调整 | 去掉“距今年份”分支，改为“换书 + 带来本次会话未出现过的主题”的领域意外 |
| 出处展开（Slice 3） | 已完成 | 原位展开、真实收录计数、再看一处 / 收起、焦点回归、耗尽与单条明确说明 |
| 书籍 / 主题 / About（Slice 4） | 已完成 | 书籍区与书详情、5 个主题的跨书连线、真实年份筛选与空交集处理、真实计数 About |
| 导航 | 全部放开 | 随机 / 书 / 主题 / 关于 均为真链接，无禁用项 |
| 浏览器验证 | 公开审核收口后已重跑 | Playwright + Chromium（本机）：**104 个 local 用例** + **9 个审核器用例**；1 个 public 空态用例通过；About 语境说明已截图人工查看 |
| 本机检查 | 公开审核收口后已重跑 | `check:local` 全绿：typecheck + lint + **248 个单测（19 文件）** + schema 2 数据校验；`verify:ids`、6 个真实数据 smoke、public build、`isolation:public` 与 local-private build 拒绝均通过 |
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
| V3 Batch 1 embedding 评测 | 已完成 | provider-neutral 管线、300 条真实评测集、SiliconFlow 三模型实测与人工 neighbour review；默认 `bge-large-zh-v1.5`，回退 `bge-m3` |
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

## 公开发布前待处理事项（发布阻断项，不阻断本机开发）

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
