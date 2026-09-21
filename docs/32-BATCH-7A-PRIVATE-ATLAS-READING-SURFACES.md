# 32 — Batch 7A：私人图集阅读版心与界面减法实况

> 日期：2026-09-21
>
> 状态：implemented and verified；等待用户7A视觉Gate
>
> 方向：可漫游的私人图集，以当代阅读室的可读性为约束
>
> 数据：local-only 4,663条 / 130本 / 56 Topic Tag；内容、标签、算法、地图坐标和public范围均未改

## 1. 本阶段完成什么

Batch 7A建立了私人图集的阅读层基础，不再让门厅、书房和小径只依靠标题文字区分空间。

### 全局框架

- 新增shell、reading、directory、map、long-reading和当前位置的语义tokens；
- 桌面外框保持1160px，阅读面收束到860px，长文约28个汉字宽；
- 移动导航改为明确的三列两行，六个一级入口全部显式保留；
- Local状态从独立pill改为小色点与文字，边界仍明确可读；
- 主操作保留pill，来源、分类和工具动作进一步文字化。

### 门厅与主题房间

- “随便看看”降为低权重空间标记；
- 短 / 中句更早进入视口，长文不再因统一垂直居中被向下推；
- 短 / 中 / 长使用更克制的字号和行距；
- 出处在移动端明确分成书名、作者与时间层级，不依赖偶然flex换行；
- 当前书色改为局部阅读光区，并在文字前加入同源短色标，正文保持深墨；
- 主题房间使用当前位置短线，继续明确“书架不是句子标签”。

### 书籍房间

- 桌面改为96px书籍边栏 + 32px间距 + 阅读主柱；
- 书封与书名是来源锚点，当前划线与书名列对齐；
- Book Theme链接取消pill外形，改为来源下的轻量文字线索；
- 移动封面缩为60×87px，书名、作者、计数形成紧凑来源头；
- 正文上方使用真实Book Aura短线，整页Aura改为局部光区；
- 书内有限轮、分享、地图出口与返回现场均保持原行为。

### 主题小径

- 小径名称使用与主题房间一致的当前位置短墨线；
- 路径定义收进短页眉，正文提前出现；
- “纯公平 / 有呼吸”从正文前移到进度旁的原生`details`，当前状态在summary中可见；
- 当前Topic Tag从普通下划线改为短墨线 + 文本，岔路仍保留当前句；
- 加入当前小径live status；算法、资格、有限轮和Back恢复未改。

### About

- 先展示既有owner.about作为使用邀请；
- 4,663条 / 130本 / 年份范围只出现一次；
- 原文可能脱离上下文与“不代表认同作者全部观点”的提醒继续保留。

## 2. 同一真实材料的前后证据

固定真实样本：

```text
最短：h-1076，8字，0标签
中等：h-443，90字，0标签
最长：h-231，398字，3标签
分享 / 三标签：h-013
书房：b-013
小径：tag-040
```

视觉证据：

```text
.private/review/v3-private-atlas/before/
.private/review/v3-private-atlas/after/
```

关键量化变化：

| 场景 | Before | After |
| --- | ---: | ---: |
| 桌面最短句起点 | 404px | 284px |
| 桌面中句起点 | 347px | 284px |
| 桌面最长文起点 | 217px | 208px |
| 移动最短句起点 | 441px | 297px |
| 移动中句起点 | 290px | 297px |
| 移动最长文起点 | 290px | 261px |
| 桌面中句可用宽度 | 1050px | 860px |
| 桌面最长文可用宽度 | 810px | 700px |
| 移动最长文页面高度 | 1942px | 1902px |

判断：短 / 中内容不再因为舞台垂直居中而悬在页面中后段；长文仍提前开始且完整显示。移动导航稳定为两行，每行三个入口。

## 3. 主要修改文件

```text
src/styles/global.css
src/app/page.css
src/features/encounter/stage.css
src/features/rooms/rooms.css
src/features/rooms/AboutRoom.tsx
src/features/paths/PathRoom.tsx
src/features/paths/paths.css
e2e/paths.spec.ts
e2e/rooms.spec.ts
```

没有新增依赖、字体文件、数据字段、运行时请求或视觉实验开关。

## 4. 自动验证

### 完整验证

```text
npm run check:local
  typecheck / lint
  300 / 300 Vitest，32文件
  schema 3 local snapshot通过

npm run test:e2e
  117 / 117 local Chromium

npm run test:tags
  10 / 10

npm run build
  public空快照生产构建通过

npm run isolation:public
  clean；真实书名、原文、封面、私有标签字段与凭证探针均未进入public产物
```

### 最终微调后的定向复核

最长文本根据“长文自然上移”原则增加独立vertical rule后，执行：

```text
slice-1 + zoom Chromium：16 / 16
typecheck / lint：通过
git diff --check：通过
```

### 施工中捕获的问题

第一次完整E2E为115 / 117：小径节奏`details`展开后，按钮在720×450和768px视口向右超出。没有放宽测试；修为桌面154px受限宽度、移动100%以内左对齐后，zoom定向2 / 2，随后完整local Chromium 117 / 117。

## 5. 新增验收覆盖

- 390与320移动导航必须形成3 + 3两行；
- 六个入口保持在viewport内，无横向溢出；
- 小径节奏默认收起，展开后可切换，summary立即显示当前状态；
- About中的真实划线数与书数各只出现一次；
- 既有Aura来源、对比度、颜色过渡与reduced-motion测试继续通过。

## 6. 视觉判断

已成立：

- 同一真实文字比界面更早出现；
- 门厅、小径和书房具备不同构图，但继续属于同一暖纸 / 深墨系统；
- Book Aura从全页染色变成局部光区与来源色标；
- 小径不再要求访客先理解算法设置；
- 320px、390px与200%下没有以裁剪换构图。

仍等待用户判断：

- 私人图集方向是否比旧版更有身份，同时仍保持自然、不刻意；
- 860px阅读面与约28字长文宽度是否舒适；
- 移动三列两行导航是否有意而非过度规整；
- 书房边栏和小径当前位置短线是否形成了共同视觉签名；
- 局部Aura是否足够可感，又不抢正文。

## 7. 未验证与下一步

尚未验证：

- Safari；
- 真机触摸与动态地址栏；
- macOS实际宋体fallback；
- 真实首次访客；
- 本阶段不处理的目录页和地图作品化。

若用户通过7A视觉Gate，下一步进入Batch 7B：

1. 复核地图语义列表进入详情的focus / scroll / Back；
2. 使用同一布局生成Current / Reduced / Terrain三套地图对照；
3. 停在7B-1地图方向Gate，不直接连续进入Canvas最终施工。

public export、repo、push和部署仍未开始。
