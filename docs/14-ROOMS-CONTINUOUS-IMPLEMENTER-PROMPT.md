# 14 — 连续房间开发批次 Implementer Prompt

> 状态：V2-B 已完成并通过 GPT-5.6 Sol 独立复验。本文件用于下一次 DeepSeek v4.1 Flash 连续开发。
>
> 执行顺序：**V2-C1 房间路由与现场记忆 → V2-D 全量分批浏览 → V2-C2 Book Aura 与呼吸动效**。
>
> 工作方式：三个内部阶段分别测试、记录、commit；Gate 通过后直接继续，不停下等待。全部结束后统一汇报。

## 1. 角色与目标

你是实现模型，在 `E:\Desktop\henrys-reading-world` 中连续完成一个完整的房间体验批次。

本批次结束时，用户应能：

1. 在门厅、主题书架、主题房间、所有书、书籍房间和 About 之间通过稳定 URL 移动；
2. 从主题或书库进入一本书，再返回原房间时恢复原句、scope、筛选、批次和必要滚动位置；
3. 在 130 本书和 4,663 条真实划线中按批次浏览，而不是一次渲染全部内容；
4. 感受到来自真实封面的低浓度 Book Aura 与轻盈进入节奏，同时文字仍是视觉中心。

不要进入 V2-E：本批次不做分享卡、复制、二维码、部署、公开快照或发布审核。

## 2. 开工前必读与基线

完整阅读并遵守：

1. `AGENTS.md`
2. `docs/10-PRODUCT-DIRECTION-V2.md`
3. `docs/12-ROOMS-COLOR-MOTION-DIRECTION.md`
4. `docs/11-V2-IMPLEMENTATION-PLAN.md`
5. `docs/07-IMPLEMENTATION-HANDOFF.md`
6. `docs/08-REVIEW-CHECKLIST.md` 的 V2-A、V2-B 与 V2-B 复核修复记录
7. 当前 app / encounter / world / cover accent / snapshot index 代码及全部 E2E

开工基线：

```text
commit: a0815b2
schema: 2
local-only: 4,663 highlights / 130 books / 14 themes / 127 local covers
stable ids: 20 books + 46 highlights guarded by npm run verify:ids
unit: 120 / 120
Playwright: 24 / 24
```

先运行 `git status --short`、`npm run check:local`、`npm run verify:ids`。保护用户已有工作，不覆盖未提交修改。

## 3. 连续执行规则

- 按 **C1 → D → C2** 实施；不得先做视觉，再回头重构页面结构。
- 每个阶段完成后运行该阶段 unit/E2E、更新 `docs/08`、做一笔本地 commit。
- Gate 通过后立即进入下一阶段，不等待用户重新启动。
- 只有以下情况暂停：新的产品边界冲突、隐私/发布决策、不可逆操作、或经过修复仍无法通过的 Gate。
- 最后统一运行全量验证并汇报三个内部 commit；不 push、不部署。

## 4. 本批次不能破坏的 V2-B 契约

- 先公平选书，再从该书选句；不得按 `highlightCount` 加权。
- 多书时不连续选择当前书。
- 首屏不能先按句长筛书；选中书没有 20–120 字划线时诚实降级。
- `NEXT_IN_BOOK` 不改变持久 `stageScope`，也不消耗 `all/theme` cycle。
- all、每个 theme、每本 book 的 cycle 独立；所有随机入口可注入 RNG。
- 罕见的 299 字开局已验收为合法路径；不得通过隐藏、截断、改写或预筛书规避。

## 5. 内部阶段一：V2-C1 房间路由、现场记忆与新 IA

### 5.1 路由

建立真实路径：

```text
/                   门厅 / 随便看看
/themes             主题书架
/themes/:themeId    主题房间
/books              所有书
/books/:bookId      书籍房间
/about              关于
```

要求：

- 使用 History API 的真实 URL，不退回 hash 路由。
- 可以增加**最多一个**专用路由依赖；若增加，说明用途并提交 lockfile。不得增加状态库或动画库。
- 直接刷新每个有效 URL 都能恢复当前房间。
- 无效 theme/book ID 显示安静错误态，并提供可用返回入口。
- 页面返回动作与浏览器 Back 结果一致。
- 路由切换后主内容获得合理焦点；不要劫持正常 Tab 顺序。

### 5.2 页面职责

- `/`：仅一句、出处、`再来一句`、去主题/书库/About 的低权重入口；不得继续向下铺原长页面。
- `/themes`：14 个真实书架入口、说明、真实数量、最多 3～4 张真实小封面或窄书脊；不展开划线墙。
- `/themes/:id`：`正在逛：<主题>`、书架语义说明、一句、出处、留在主题的 `再来一句`、书架书目入口、换主题、回随便看看。
- `/books`：独立书库，年份只在这里生效。
- `/books/:id`：独立书籍房间，先完成低色彩结构；完整批次列表在 V2-D 补齐。
- `/about`：只保留真实收藏范围与可选 owner.about；删除内部防御文案。

### 5.3 现场记忆（硬要求）

必须用可测试的数据结构保存房间现场，不依赖 DOM 偶然状态：

- 门厅的当前句、出处开关和 all cycle；
- 每个主题房间自己的当前句、scope/cycle 与出处状态；
- 所有书的年份筛选、已加载批次和滚动位置；
- 从哪个房间进入书籍房间，以及返回目标；
- 主题/书库返回后的必要焦点。

关键行为：

1. theme A 连续换 3 次 → 进入一本书 → Back → 恢复 theme A 原句，不重抽、不重复消耗 cycle；
2. theme A → themes → theme B → Back → 恢复 theme A 原句；
3. books 筛选年份并追加批次 → 进入一本书 → Back → 筛选、批次、滚动位置仍在；
4. 书籍房间的随机划线是该房间自己的状态，不能覆盖门厅或主题房间保存的句子；
5. 从主题显式点击“回到随便看看”时切回 all scope；普通返回书籍房间不得无故切换 scope。

必要时重构 encounter/session 边界，但算法继续留在 domain 层。不要靠全局可变变量或数组下标记忆内容。

特别测试：路由切换发生在 quote `entering` 阶段时，不能复用旧计时器缩短新房间动画、留下 busy 状态或提交旧 pending。

### 5.4 C1 Gate

新增 unit/E2E 覆盖：

- 六个路径直接访问与刷新；
- 无效 ID；
- 上述完整 Back/恢复旅程；
- 主题 scope 连续抽取不越界；
- 门厅不再包含书目/主题/About 长页 DOM；
- 1440、390、键盘与 reduced-motion 的低色彩结构；
- public 空快照在每个路径都有诚实空状态。

通过后：更新 `docs/08`，commit，例如 `V2-C1: room routes and restorable reading state`，继续 V2-D。

## 6. 内部阶段二：V2-D 全量内容分批浏览

### 6.1 所有书

- 默认按最近留下真实划线的年份排列；稳定同级顺序使用 book ID。
- 初始显示 12 本，每次追加 20 本，最终正好到 130 本。
- 年份筛选只影响书库和单书顺序列表，不影响主题总览或主题舞台。
- 筛选改变时批次稳定重置；返回恢复此前筛选和已加载数量。
- 封面使用 lazy loading；无封面继续使用真实书名排版，不造替代图。

### 6.2 书籍房间

- 显示真实封面、书名、作者、真实划线数和主题入口。
- 一处随机真实划线；`随机看一处` 只在本书内，注入 RNG 并避免当前/最近 ID。
- 顺序列表初始 10 条，每次追加 20 条；末批数量必须正确。
- 顺序以稳定 highlight ID 为准，不用数组下标作为身份。
- 年份筛选存在时只过滤列表；不能把不存在的内容替换成假句子。
- 书籍房间随机区和顺序列表都不能修改保存中的 hall/theme 现场。
- 最大书 531 条可以逐批走到末尾，但初始 DOM 不得包含全部 531 条。

### 6.3 全量可达与 DOM

必须证明：

- 130 本书都可从 `/books` 到达；
- 每条 highlight 都可从对应 `/books/:id` 的顺序批次到达；
- 不要求在一个测试页面同时创建 4,663 个 passage 节点；可用纯函数 + 最大书 E2E 证明；
- 首页、主题首页、书库初始页和单书初始页 DOM 均保持有界；
- 320/390 下无横向溢出，长标题、无封面和 299/398 字划线可读。

### 6.4 D Gate

新增 unit/E2E 覆盖：

- 书库 12 → +20 → 最终 130；
- 最大书 10 → +20 → 最终 531，末批正确；
- 年份筛选、清除和 Back 恢复；
- 书籍随机不越界、不覆盖来源房间状态；
- 全量 reachability 纯函数验证；
- 初始 DOM 密度与封面 lazy loading。

通过后：更新 `docs/08`，commit，例如 `V2-D: batched full-library and book reading`，继续 V2-C2。

## 7. 内部阶段三：V2-C2 Book Aura 与呼吸动效

### 7.1 色彩归属

复用当前真实封面取色能力，不给主题人工语义色：

- 门厅：当前划线所属书 accent，纸色混入约 4%～7%；
- `/themes`：中性纸色，颜色只来自各书架真实封面/书脊；
- 主题房间：中性基础 + 当前句所属书局部 3%～6%；
- `/books`：中性纸色，真实封面负责色彩；
- 书籍房间：该书 accent 约 8%～12%；
- About：中性纸色。

正文墨色保持高对比；不做高饱和整屏渐变、主题彩色卡片 Dashboard、封面墙、玻璃拟态、随机光斑或通用 AI 渐变。

### 7.2 动效

- 房间内容约 8～12px 轻位移，320～420ms 淡入；
- 环境色 600～900ms 接续，慢于句子；
- 标题/句子/操作错峰不超过 80ms；
- 首次进入先纸张，约 300ms 内句子出现，约 700ms 环境色进入；
- 换句继续原位淡出/淡入，连续点击不叠加；
- 不做永久循环背景动画、3D、视差、门扇、抽卡或翻牌；
- 纯 CSS 能完成时不加动画依赖。

`prefers-reduced-motion: reduce`：取消位移、错峰和长颜色过渡，状态立即准确；不能仅把 duration 改成近零却仍闪动。

### 7.3 C2 Gate

真实数据截图至少包含：

- 1440 / 390：门厅、主题书架、主题房间、所有书、书籍房间；
- 至少 6 本封面色差异样本；
- 无封面书回退；
- 299 字开局候选与全库最长 398 字划线；
- 快速换句、房间 Back、reduced-motion；
- 正文、按钮、焦点和 muted text 的对比度。

截图放 `.private/review/rooms-batch/`，不得进入 public build。

通过后：更新 `docs/08`，commit，例如 `V2-C2: book aura and quiet room transitions`。

## 8. 最终全批次验证

全部阶段完成后实际运行：

```text
npm run check:local
npm run verify:ids
npm run smoke:local
npx playwright test
npm run build
npx vite build --mode local-private   # 必须拒绝
```

还要检查：

- public dist 无真实划线、封面文件、原始 ID、密钥或个人字段；
- 路由 bundle 不包含 `.private` 内容；
- 首屏和各房间初始 DOM 不含全库文本墙；
- 既有公平算法性质测试继续通过，测试总数不得因删除旧页面测试而净减少；
- Markdown 链接有效；工作区干净。

## 9. 最终统一汇报

只在全部三个内部阶段结束后汇报：

1. C1 / D / C2 各自完成内容和 commit；
2. 路由与现场记忆的数据结构；
3. 书库/单书批次与全量可达证据；
4. Book Aura 色彩来源、浓度和 reduced-motion 处理；
5. 真实浏览器旅程、视口与截图路径；
6. 全部命令及结果；
7. 仍未验证或需要产品判断的事项；
8. 与 `docs/10/11/12` 的偏差；
9. 下一批 V2-E（不得自行开始）。

不要在 C1 或 D 完成时停下等待；通过内部 Gate 后继续。