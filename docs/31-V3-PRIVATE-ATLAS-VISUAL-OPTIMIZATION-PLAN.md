# 31 — V3「可漫游的私人图集」视觉优化实施计划

> 日期：2026-09-21
>
> 状态：Batch 7A implemented；7A视觉Gate尚未通过。用户已要求先作颠覆性方向探索；原7B/7C顺序暂停待修订，见 `docs/33-V3-READING-WORLD-RADICAL-DIRECTION-STUDY.md`。
>
> 输入：`docs/30-GPT6-ASTRA-DESIGN-REVIEW.md`
>
> 当前实现基线：`94e59a3`；产品代码基线：`bee0ad9`
>
> 发布状态：public snapshot 继续为空；本计划不授权 public export、public covers、repo、push、workflow 或部署。

## 0. 本计划解决什么

本轮不是继续逐个控件做零散精修，而是把审阅结论转化为三批受控施工：

1. **Batch 7A — 阅读版心与界面减法**：让访客先遇见文字，让房间、小径具有不同构图；
2. **Batch 7B — 地图作品化与详情抵达**：在不改真实布局的前提下，让地图从技术可视化变成可阅读地形；
3. **Batch 7C — 目录节奏与全局收口**：解决56条小径、14个书架和130本书的目录疲劳，并统一分享与出口。

工作方向已由用户确认采用审阅建议的：

> **可漫游的私人图集，以当代阅读室的可读性为约束。**

这是一项视觉和交互组织决定，不改变内容、标签、embedding、地图坐标、公平算法或公开范围。

## 1. 锁定边界

### 1.1 本轮不改

- 4,663条真实划线、130本书、14个Book Theme和56个Topic Tag；
- 1,694 reviewed / 2,969 draft assignments；
- stable book / highlight / tag ID；
- 按书公平、有限不重复、小径资格与embedding节奏算法；
- 地图4,663点坐标、标签中心、snapshot和layout hash；
- 未标注点只作为未命名地形；
- public/local/studio边界；
- 分享稳定ID、完整标签与长文不裁剪；
- 原生select、语义列表、键盘、200%、reduced-motion；
- public snapshot为空。

### 1.2 明确禁止的捷径

- 不重跑UMAP来获得“更漂亮”的地图；
- 不移动真实点或填补空白；
- 不把私有tag family变成公开分组；
- 不加搜索、推荐榜、AI总结或新功能解决视觉问题；
- 不引入外部字体CDN、动画库、图表库或地图框架；
- 不用整站截图diff替代设计判断；
- 不把目录摘要当作完整引文，详情和分享仍展示完整原文；
- 不把暖纸改成仿旧纸，不加噪点、罗盘、经纬线、虚构海岸或路线。

## 2. 施工总原则

### 2.1 固定内容做前后对照

所有方向比较使用同一批stable ID，不以随机抽到更漂亮的句子制造改进：

- 短 / 中 / 最长真实划线；
- `h-013`：真实三标签详情与分享；
- `tag-040`：高数量小径与地图区域；
- `b-013`：531点、高密度、暖色Aura；
- 再选5本覆盖分散 / 集中、浅 / 深、冷 / 暖和无封面，不只复用两本暖色书。

完整样本ID与原因记录在私有视觉manifest，不把真实内容写入public代码。

### 2.2 同时只改变一层

- 先构图与层级，再决定是否引入本地字体；
- 先地图背景 / 标签减法，再改密度 / 等高线；
- 先确认目录结构，再统一主题书架和所有书；
- 不在同一视觉比较中同时改内容、数据和布局。

### 2.3 每批独立Gate

每批必须：

- 更新 `docs/08-REVIEW-CHECKLIST.md`；
- 保存相同真实样本的before / after证据；
- 运行对应单测、E2E、public isolation；
- 独立本地commit；
- 视觉Gate未通过则不自动进入下一批。

## 3. Batch 7A — 阅读版心与界面减法

### 目标

建立“私人图集”的基础语言，让门厅、书房、小径在同一系统中具备不同空间角色，并把移动端首屏从界面说明还给文字。

### 7A-0：基线与方向稿

#### 工作

1. 建立 `.private/review/v3-private-atlas/before/`；
2. 固定短 / 中 / 长 / 最长、0 / 1 / 2 / 3标签、长书名、无封面样本；
3. 记录Windows Chromium实际字体、关键元素bounding box和首屏位置；
4. 为1440×1000与390×844准备两套静态方向对照：
   - 当前版；
   - 私人图集版：独立阅读版心、减弱页标题、明确出处基线；
5. 不在此阶段引入字体文件或修改数据。

#### Gate

- 同一真实文本可直接前后比较；
- 方向稿说明具体删掉 / 移位 / 降级了什么；
- 用户确认“私人图集”方向，而不是仅确认某个字号。

### 7A-1：全局框架与设计tokens

#### 工作

新增或整理语义tokens，避免每页独自硬编码：

```text
--measure-shell        约1160px
--measure-reading      760–880px方向区间
--measure-long-reading 约26–28个汉字宽
--measure-directory    shell范围
--measure-map          shell范围
--space-context-*      页面上下文间距
--aura-source-*        来源色标强度
--location-mark-*      当前空间 / 当前小径标记
```

实施：

- 桌面保持外框，不让阅读正文自动占满1160px；
- 移动导航改为有意的三列两行，保持六个显式入口和44px目标；
- 品牌、导航、Local状态和页面上下文重新合并首屏预算；
- Local状态仍明确可读，但不再总是占一条独立pill行；
- 统一focus ring、规则线强度与工具文字下限；
- 主动作保留pill，筛选和工具不再全部pill化。

#### 主要文件

- `src/styles/global.css`
- `src/app/page.css`
- `src/app/Nav.tsx`
- `src/app/ReadingWorldPage.tsx`
- 必要的共用房间结构，不建设新UI框架。

### 7A-2：门厅与出处

#### 工作

- “随便看看”降为轻量空间标记；
- 建立独立阅读柱，短 / 中句不再被外框宽度主导；
- 中短文本起点以桌面28–35%、移动28–38%视口作为方向目标；长文自然上移，不强行垂直居中制造空白；
- 出处按书名 → 作者 → 时间分层；移动端使用明确两层，不依赖偶然flex换行；
- 来源色只进入出处标记、局部规则线或低浓度纸面，不染正文；
- “再来一句”仍是主动作，分享继续降一级；
- 出处展开、连续快速点击、focus恢复与房间memory不改。

#### 主要文件

- `src/features/encounter/EncounterStage.tsx`
- `src/features/encounter/stage.css`
- `src/app/app.css` / `page.css` 中相关环境层。

### 7A-3：书房、主题房间、小径房间与About

#### 书房

- 桌面原型使用约96px书籍边栏、约32px间距和阅读主柱；
- 封面、书名、作者、计数是来源锚点，不是大详情页头；
- 移动封面约56–64px，计数和Book Theme降级；
- Book Aura使用来源色标和局部纸面光区，不做整页明显染色；
- 地图出口和书内轮次保持。

#### 小径房间

- 路径名与定义形成短页眉；
- “纯公平 / 有呼吸”移到进度附近的原生`details`或等价disclosure，状态可见、键盘可切换；
- 正文前不先呈现算法配置；
- 当前线索使用“短墨线 + 文本”位置标记，其他线索保持普通链接；
- 岔路切换仍保留当前句，不重播入场动画；live region说明方向改变。

#### 主题房间与About

- 主题房间沿用阅读版心，不把Book Theme冒充当前句语义；
- About先说明如何使用这个空间，数据只出现一次；
- 保留语境与非作者立场提醒，不写人格宣言。

#### 主要文件

- `src/features/rooms/BookRoom.tsx`
- `src/features/rooms/ThemeRoom.tsx`
- `src/features/rooms/AboutRoom.tsx`
- `src/features/rooms/rooms.css`
- `src/features/paths/PathRoom.tsx`
- `src/features/paths/paths.css`

### 7A-4：验证与视觉Gate

#### 自动验证

- `npm run check:local`
- 门厅 / 书房 / 路径 / About / 导航相关Chromium E2E；
- 完整`npm run test:e2e`；
- `npm run test:tags`；
- `npm run build`；
- `npm run isolation:public`；
- `git diff --check`。

#### 浏览器矩阵

- 1440×1000、768宽、390×844、360、320；
- 720×450的200%等价；
- reduced-motion；
- 短 / 中 / 最长；0 / 1 / 2 / 3标签；长书名、无封面；
- 键盘完整门厅 → 小径 → 书房路径。

#### Gate问题

1. 第一眼是否先读到文字，而不是状态、标题或算法控件？
2. 门厅、书房、小径是否能凭构图区分？
3. Aura是否可感但明确归属于书？
4. 长文是否比现状更舒适，而不是只是更窄？

Batch 7A代码、证据与自动验证已完成，实况见 `docs/32-BATCH-7A-PRIVATE-ATLAS-READING-SURFACES.md`。用户认为外观尚不惊艳、地图不足，**未通过7A视觉Gate**，并授权先探索颠覆性方向；本计划的7B地图施工不得被视为自动获批。第一轮同数据静态对照见 `docs/33-V3-READING-WORLD-RADICAL-DIRECTION-STUDY.md`，深化方向确认后再修订实施步骤。

## 4. Batch 7B — 地图作品化与详情抵达

### 目标

不改4,663点坐标和标签语义，只重做渲染层、控制层和世界 → 区域 → 详情的抵达体验。

### 7B-0：详情入口行为复核

先把审阅观察转成可复现规格：

- 从Canvas点进入详情；
- 从区域语义列表进入详情；
- 关闭详情；
- Browser Back；
- 世界、区域、书籍点亮四种上下文；
- 桌面与移动。

需要记录：打开后的viewport、`scrollY`、焦点元素、详情标题是否在可见范围、关闭后的来源项和地图位置。

若问题只在某一入口存在，只修该路径，不全局强制scroll-to-top。

### 7B-1：三种同坐标静态渲染对照

使用完全相同的snapshot、viewport和坐标生成：

1. **Current**：现有网格、点、折线和标签底板；
2. **Reduced**：取消总览网格、减少标签底板、现有密度 / 等高线不变；
3. **Terrain**：连续低浓度密度面、2–3级等高线、分层点半径、地名式标签。

实验过程留在 `.private/review/v3-private-atlas/map-experiments/`。只把选中方向写入消费者代码，不把永久debug开关、query参数或三套渲染器交付到public运行时。

#### 选择标准

- 去掉标签后仍可读出连续地形；
- 加回标签后不形成贴纸墙；
- 空白区域如实保留，不被装饰补齐；
- 同一截图在灰阶下仍有前后层次；
- 不制造不存在的山脉、边界或主题领地。

### 7B-2：Canvas图层实施

#### 背景与密度

- 暖纸保留；总览取消常驻方格；
- 使用既有64×40真实密度数据生成低浓度连续墨面；
- 不修改layout文件、UMAP参数或点坐标；
- 若渲染插值新增纯函数，放在domain / renderer层并补单测。

#### 等高线

- 只保留2–3层可辨等值线；
- 允许显示层插值平滑，但必须验证不自交、不跨空洞、不连接原本分离区域；
- 若现有数据不足以安全平滑，优先减少线条，不重建布局。

#### 点

以屏幕像素为方向起点：

```text
世界背景点：0.6–0.9px
区域成员：1.2–1.8px
点亮书籍：1.2–2px，密集处不得糊成实色块
当前点：2.5–3px + 清晰细环
```

- 多标签双环主要在区域 / 近看出现；
- 全量4,663点仍全部绘制；
- 不基于视觉减法改变可达性或算法权重。

#### 标签

- 普通地名13–15px，当前区域16–18px；
- 普通标签取消统一矩形底板，优先试纸色描边或局部文字让位；
- 当前区域可保留小面积底，但不加阴影；
- 桌面总览12–16个主地名，移动6–8个；缩放后渐进增加；
- 全56区域继续在语义列表完整可达。

#### 主要文件

- `src/features/map/MapCanvas.tsx`
- `src/domain/map.ts`
- 必要的新纯renderer helper与测试；
- `src/features/map/map.css`。

### 7B-3：地图页面构图与移动首屏

#### 桌面

- 标题与“点亮一本书”共享上缘或紧邻上下文；
- 缩放工具移到Canvas边缘轻控制区；
- 百分比降权，只在操作 / focus后明显；
- 不新增GIS侧栏。

#### 移动

当前实测390×844 Canvas起点约478px。方向目标：

- 默认字号下Canvas起点约240–300px；
- 标题、上下文和书籍select在图前完成；
- 缩放 / 复位放到画布边缘或紧邻画布之后，44px目标；
- Canvas使用剩余可用视口约460–520px作为方向，不盲目固定72svh；
- 320px、200%和动态地址栏自然增长，不以裁剪换首屏。

### 7B-4：Book Aura与书籍状态

- 原生select保留；去掉较重胶囊阴影；
- 选择器、来源色标、当前书点使用同源色；
- 状态区只保留书名和点数为主要信息；
- 前6条小径和完整disclosure后置，不再把Canvas持续下推约100–150px；
- 使用6本真实书覆盖：集中 / 分散、浅 / 深、冷 / 暖；另测无封面默认accent；
- 允许从真实书点生成极淡局部色密度，但不画任意halo、不染地名。

### 7B-5：世界、区域与详情三尺度

#### 世界

- 看轮廓和方向；点弱、地名清楚、控制少。

#### 区域

- 成员点加深，周边地形和少量邻近地名保留；
- fit padding先试15–20%；
- 对真实分散标签保留分散，不画虚假闭合领地。

#### 详情

- 桌面详情宽约340–400px，避开当前点；
- 移动先做状态原型：打开详情后Canvas缩为约240–300px上下文视窗，正文完整接在其后；
- 从列表进入时详情标题进入可视范围并获得适当焦点；
- 从Canvas进入时保持空间连续性；
- 关闭、Back恢复来源项、scroll、viewport和点亮书。

不要直接把移动详情改成bottom sheet；先验证尺寸变化不会造成跳动。

### 7B-6：验证与视觉Gate

#### 自动验证

- map pure functions / renderer tests；
- 现有map / keyboard / privacy / zoom / rooms E2E；
- 新增“列表进入详情可见 + focus + 关闭恢复”测试；
- 新增移动Canvas起点方向断言，但允许字体放大和200%自然增长，不写脆弱绝对像素；
- Canvas非空、世界 / 区域 / Aura像素差异；
- 4,663点layout hash不变；
- 完整`check:local`、`test:e2e`、build和public isolation。

#### 视觉证据

- 世界：1440 / 390 / 320；
- 区域：高密度、低密度、分散区域；
- Aura：6本+默认accent；
- 详情：Canvas入口、列表入口、移动、桌面；
- 200%、reduced-motion；
- before / Reduced / Terrain三套同坐标对照。

#### Gate问题

1. 地图是否先像作品，再像工具？
2. 去掉标签是否仍有可信地形？
3. 集中书是否仍能看见点的层次，而非色块？
4. 手机进入地图是否能在首个有效视口理解世界？
5. 列表和Canvas进入详情是否都真正抵达文字？

## 5. Batch 7C — 目录节奏、分享与全局收口

### 目标

在不损失全量可达的前提下，解决长目录重复感，使主题书架、所有书、小径和分享属于同一套“私人图集”语言。

### 7C-0：小径目录对照

使用同一56条真实小径比较：

- **方案1：单列渐进** — 首批12条 + 展开全部；
- **方案2：桌面双栏目录** — 两栏平面目录，移动单列；
- **方案3：单列渐进 + 完整名称索引** — 首批12条详细条目，全部56个名称提供紧凑跳转索引。

约束：

- 不做标签云；
- 不按热度排序或改变字号；
- 不公开私有family；
- 不隐藏定义和真实书数 / 划线数；
- 全56条键盘和屏幕阅读器可达。

优先验证方案3；若索引造成重复认知负担，则选择方案1或2，不为了满足报告机械叠加两套列表。

### 7C-1：小径列表实施

- 选择通过Gate的目录结构；
- 标题22–24px、定义13–14px作为起始区间；
- 计数稳定对齐，不漂在远端；
- 展开 / 收起恢复focus，Browser Back保留必要列表位置；
- 页面不再默认形成约6616px同节奏长页；
- 保留完整语义和URL。

### 7C-2：主题书架与所有书

#### 主题书架

- 桌面明确为封面组、名称 / 说明、计数三列；
- 封面只做来源样本，不扩大为拼贴墙；
- 移动说明紧随名称，计数后置；
- 仍按Book Theme归档，不把Topic Tag混入。

#### 所有书

- 保留小封面渐进列表；
- 书名、作者、计数建立稳定基线；
- 年份pill改为轻量页签 / 下划线状态，命中目标保持；
- 长书名、无封面、130本全量、year / theme filter与滚动恢复继续成立。

### 7C-3：分享、出口与微交互

- 分享卡深色出版方向保持；
- 只比较双框5 / 7 / 9px间距与外围说明层级，不重做卡片核心；
- 长文、1 / 2 / 3标签、390px自然增高；
- 页面出口统一为“返回 / 邻近空间 / 主循环”三个层级，不让所有链接同权；
- hover、focus、active、pending与reduced-motion收口；
- 不引入持续动效。

### 7C-4：最终审美与工程Gate

#### 完整命令

- `npm run check:local`
- `npm run smoke:local`
- `npm run test:e2e`
- `npm run test:tags`
- `npm run test:publication`
- `npm run test:public`
- `npm run build`
- `npm run isolation:public`
- `npm run verify:ids`
- `git diff --check`

### 完整视觉矩阵

- 1440 / 768 / 390 / 360 / 320；
- 200%；reduced-motion；完整键盘；
- 短 / 中 / 最长；0 / 1 / 2 / 3标签；
- 长书名、无封面；
- 路径列表 / 路径正文 / 岔路；
- 世界 / 区域 / 详情 / 6本Aura；
- 分享卡；
- public空态。

### 最终用户Gate

1. 同一真实划线前后对比，是否更愿意读？
2. 门厅、书房、小径、地图是否各有空间角色？
3. 是否记住了文字、书色和世界，而不是按钮与数字？
4. 地图是否减少了技术工具感而没有制造假地理？
5. 是否允许进入正式public标签 / 地图审核？

只有该Gate通过，才回到原`docs/22` Batch 7内容审核与Batch 8发布授权；视觉完成不自动授权发布。

## 6. 测试与证据增量

### 6.1 建议新增的E2E

- 移动导航三列两行、无横向溢出、六入口全部可达；
- 小径节奏disclosure状态、键盘切换、返回保持；
- 56条小径渐进展开 / 收起与完整可达；
- 地图列表进入详情后标题可见、焦点正确、关闭恢复来源；
- Canvas点进入详情不破坏viewport；
- 移动详情Canvas缩放 / 恢复没有页面横跳；
- 6本Aura状态与原生select；
- public空态不出现local内容或视觉实验开关。

### 6.2 建议新增的纯函数测试

仅在实现引入对应helper时新增：

- 密度插值稳定性；
- contour显示层不会输出非有限坐标；
- 标签可见数量与active标签强制保留；
- 密集Book Aura点半径 / opacity策略的确定性；
- renderer输入不改变layout和snapshot对象。

### 6.3 不做脆弱测试

- 不以每个元素的精确像素坐标作为所有视口的断言；
- 不以PNG像素完全相同作为跨平台Gate；
- 不断言系统宋体具体字形；
- 不用截图测试掩盖键盘、focus、历史和真实文本完整性。

## 7. 风险与回滚

| 风险 | 预防 | 回滚点 |
| --- | --- | --- |
| 全局tokens导致所有房间一起回归 | 先7A-0证据，tokens语义化，逐房间接入 | 7A-1独立commit |
| 阅读柱过窄，长文像手机网页 | 同一最长文本做26 / 28 / 30字宽对照 | 7A-2 |
| 移动首屏压缩过度，200%不可用 | 目标只适用于默认字号，放大自然增长 | 7A-4 |
| 地图平滑制造假地理 | 同坐标、限制插值，只改显示层并做空洞 / 自交检查 | 7B-1 / 7B-2 |
| Aura密度衰减被误解为删点 | 全点仍绘制，语义列表和layout count断言 | 7B-4 |
| 详情自动滚动破坏Back现场 | 区分Canvas与列表入口，记录focus / scroll / viewport | 7B-0 / 7B-5 |
| 小径索引重复且增加认知负担 | 三方案先比较，只选择一套消费者结构 | 7C-0 |
| 字体依赖扩大bundle或授权不清 | 本轮先用系统栈；字体另立依赖与授权Gate | 不进入当前默认施工 |
| 视觉实验进入public bundle | 实验保留`.private`，消费者只提交选中方案 | 每批public isolation |

## 8. 预计主要文件

```text
src/styles/global.css
src/app/page.css
src/app/Nav.tsx
src/app/ReadingWorldPage.tsx
src/features/encounter/EncounterStage.tsx
src/features/encounter/stage.css
src/features/rooms/BookRoom.tsx
src/features/rooms/ThemeRoom.tsx
src/features/rooms/ThemesRoom.tsx
src/features/rooms/BooksRoom.tsx
src/features/rooms/AboutRoom.tsx
src/features/rooms/rooms.css
src/features/paths/PathsRoom.tsx
src/features/paths/PathRoom.tsx
src/features/paths/paths.css
src/features/map/MapCanvas.tsx
src/features/map/MapRoom.tsx
src/features/map/map.css
src/features/map/useMapView.ts（仅在详情 / 移动状态需要时）
src/features/share/share.css
e2e/map.spec.ts
e2e/paths.spec.ts
e2e/rooms.spec.ts
e2e/zoom.spec.ts
e2e/keyboard.spec.ts
必要的新renderer纯函数与测试
```

不预先承诺每个文件都修改；以最小必要改动为准。

## 9. 计划内用户参与点

只需要三个视觉 / 产品Gate：

1. **7A-0方向Gate**：确认“私人图集”构图，不讨论代码细节；
2. **7B-1地图方向Gate**：Current / Reduced / Terrain三套同坐标静态对照中选定方向；
3. **7C-4最终Gate**：完整产品前后体验，决定是否进入正式public审核。

其余常规实现、测试和可逆CSS调整连续完成，不反复询问。

## 10. 开工顺序

若用户批准本计划：

```text
7A-0 固定真实样本与方向稿
→ 用户方向Gate
→ 7A-1～7A-4
→ 7B-0详情行为复核
→ 7B-1三套同坐标地图对照
→ 用户地图方向Gate
→ 7B-2～7B-6
→ 7C-0～7C-4
→ 用户最终审美Gate
```

计划阶段不修改产品代码。正式开工后，任何Batch都不得自行进入public export或部署。
