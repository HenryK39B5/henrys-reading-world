# 27 — V3 Batch 5 世界地图实况

> 日期：2026-09-19
>
> 状态：**Batch 5E 结构性精修已完成，用户已通过地图产品方向与功能 Gate，并授权进入 Batch 6。** 全部 4,663 条真实划线参与未命名语义地形，当前 294 条 reviewed 试点及其 56 个 Topic Tag 提供命名区域、小径与详情入口。全量标注后将重建地图并与用户共同完成最终视觉精修。public snapshot 仍为空；正式 export、push 与部署均未开始。

## 1. 本阶段完成什么

Batch 5 将 Batch 4 的路径试点扩展成一个可浏览的阅读世界：

- `/map` 展示全部 4,663 个真实点形成的地形；
- reviewed 标签中心形成 56 个可命名主题区域；
- 区域内 reviewed 点可打开完整划线详情；
- 从书房或地图选择器点亮一本书时，该书全部真实点使用 Book Aura；
- Browser Back 恢复世界 / 区域位置、缩放、详情与点亮书；
- Canvas 提供视觉地图，语义列表提供完整键盘与屏幕阅读器替代；
- 未标注点只作为地形，不被虚构为任何 Topic Tag。

地图不是新的推荐算法、相似划线入口或 AI 搜索。消费者运行时不读取 embedding，也不调用模型。

## 2. 独立地图布局

地图没有复用 Batch 4 的 16 维 `pathVector`。本机布局管线为：

1. 读取已锁定的 4,663 × 1024 本机 embedding；
2. 固定 seed 稀疏随机投影到 96 维；
3. 使用 `umap-js@1.4.0` 运行固定参数 UMAP；
4. 裁掉每轴外侧 1% 极端值并量化为 0–10,000；
5. 用 reviewed 成员坐标中位数生成 56 个标签中心；
6. 从全部点生成 64×40、0–255 密度网格；
7. 由密度网格生成三层真实等高线。

连续两次生成结果完全一致：

```text
4,663 个点
56 个标签中心
624 条等高线段
layout hash 83eb9aed7b95da0998c69b4bd63d6a112f7d9d35ad05c3455d28aa49ecc1d329
```

私有 `.private/maps/local-layout.json` 保存模型、维度、seed、UMAP 参数、snapshot / tag / layout hash。消费者 snapshot 只保存版本、量化点、标签中心、密度和等高线，不含模型名、原始向量、置信度、理由或私有 note。

## 3. 地图产品行为

### 3.1 世界总览

- 单一 Canvas 绘制密度、等高线、全部点与避让后的主题标签；
- 总览只让标签可点击，不为 4,663 个点创建 DOM 按钮；
- `+`、`−`、复位、滚轮、拖动、方向键均可控制 viewport；
- 小径列表提供全部 56 个主题的真实书数 / 划线数与等价入口。

### 3.2 主题区域

- `/map?tag=<tagId>` 放大该标签的真实 reviewed 成员范围；
- 当前主题点加深，邻近地形继续可见；
- 只有当前区域点进入 Canvas 命中集合；
- 区域划线列表按稳定 ID 列出同一可交互集合，并可打开详情；
- `沿小径继续` 进入同一 Topic Tag 的有限公平路径。

### 3.3 划线详情

- `/map?...&h=<highlightId>` 显示完整真实原文、出处与全部 Topic Tag；
- 可分享、进入书房、沿任一线索继续或关闭详情；
- 分享仍绑定稳定 highlight ID，卡片与复制文字不截断标签；
- 移动端详情位于 Canvas 下方，不覆盖地图或其他控件。

### 3.4 Book Aura

- `/map?book=<bookId>` 点亮该书所有真实点；
- 从书籍房间进入时自动选择当前书；
- 地图内选择器可切换 130 本真实书籍或取消点亮；
- 颜色来自该书真实封面 accent，无封面时使用既有默认色；
- 显示该书真实点数与涉及的 reviewed 小径；
- 不绘制连接所有点的蜘蛛网。

## 4. 路由与现场恢复

地图 URL 使用三个可组合参数：

```text
/map?tag=tag-001&book=b-001&h=h-001
```

- `tag`：主题区域；
- `book`：点亮书；
- `h`：当前详情；
- 未知 ID 在解析边界被移除，不伪装成功；
- world 与每个 tag scope 各自保存 viewport；
- 拖动 / 缩放只更新 session，不为每一帧制造 history；
- 打开区域、书或详情写入真实 history，Browser Back 恢复原 scope、viewport 与语义现场。

## 5. 渲染与可访问性

- 4,663 点、密度和等高线全部在一个 Canvas 绘制；
- DOM 不随全量点数线性增长，也不同时渲染 4,663 段文字；
- Canvas 有键盘焦点、方向键平移与 `+/-` 缩放；
- 主题列表与区域划线列表是可独立完成任务的原生链接 / 按钮；
- 1440 / 768 / 390 / 360 / 320 及 720×450 的 200% 等价视口无横向溢出；
- reduced-motion 取消地图位移动画与长过渡，状态直接到位；
- Canvas 像素检查证明世界、区域和 Book Aura 均非空；
- public 空快照在 `/map` 显示诚实空态。

## 6. 视觉判断

最终方向保持“纸、墨、光与地形”：

- 世界点默认低对比，先读出连续地形而不是散点工具；
- 密度与等高线来自真实布局，不使用手画装饰；
- reviewed 标签为地形命名，但未标注点不获得虚构归属；
- 主题区域通过局部放大和少量实点建立方向，不用彩虹色或热力 Dashboard；
- Book Aura 是唯一较强色彩层，颜色归属于书，不归属于标签；
- 桌面地图保持宽阔，移动端保留首屏后的大画布，并让详情自然下移。

私有视觉证据位于 `.private/review/v3-batch5/`：

```text
world-1440 / 390 / 320.png
region-1440 / 390 / 320.png
detail-390.png
book-aura-1..6.png
region-reduced-motion-390.png
```

六本 Book Aura 覆盖至少四种真实封面色；所有截图均经过横向溢出检查。

## 7. 实际验证

| 命令 | 结果 |
| --- | --- |
| `npm run map:layout`（Batch 5A 连续两次） | 两次 layout hash 完全一致；4,663 点 / 56 标签中心 / 624 线段 |
| `npm run check:local` | typecheck、lint、**294 单测 / 31 文件**、schema 3 local 校验通过 |
| `npm run test:e2e -- --workers=2` | **114 / 114** local Chromium |
| 地图 / rooms / privacy / keyboard / zoom 定向 E2E | **45 / 45** |
| `npm run capture:v3-batch5` | **3 / 3**；世界、区域、详情、六本 Aura、reduced-motion |
| `npm run test:tags` | **10 / 10** |
| `npm run test:publication` | **9 / 9** |
| `npm run test:public` | **1 / 1**；`/map` 空态通过 |
| `npm run verify:ids` | 20 本 / 46 条种子 ID 稳定；总量 4,663 / 130 |
| `npm run smoke:local` | **6 / 6** |
| `npm run build` | public 空快照构建成功；71 modules |
| `npm run isolation:public` | clean；真实书名 / 原文 / coverPath 为 0，私有标签 / embedding / 凭证探针 absent |
| `npm run build -- --mode local-private` | 按预期拒绝，保护错误原文未变 |

local 校验继续诚实报告 10 个试点 warning：4,369 条尚无 reviewed Topic Tag、8 个试点标签低于未来公开建议阈值、真实材料无原始换行。它们不影响全部点参与地图，但会影响 Batch 6 后的区域命名密度。

## 8. 文件边界

主要实现：

- `scripts/embeddings/mapLayout.ts`
- `scripts/build-map-layout.ts`
- `src/domain/map.ts`
- `src/features/map/MapCanvas.tsx`
- `src/features/map/MapRoom.tsx`
- `src/features/map/useMapView.ts`
- `src/features/map/map.css`
- `e2e/map.spec.ts`
- `e2e/capture-v3-batch5.spec.ts`

`umap-js` 只由本机构建脚本导入；public 消费者 bundle 不运行 UMAP。正常静态客户端只消费已量化的安全布局。

## 9. 未验证与下一步

尚未验证：

- Safari；
- 真机触摸拖动与移动端浏览器地址栏变化；
- 真实首次访客是否能自然理解“区域、点亮一本书、详情”的关系；
- 全量标签完成后的最终地名密度与公开地图布局。

下一步是用户体验地图 Gate，重点看：

1. 世界总览是否像一件作品，而不是数据工具；
2. 主题区域放大是否保留方向感；
3. Book Aura 是否清晰表达“一本书散落在世界中的位置”；
4. 手机上地图与详情的节奏是否自然。

用户于 2026-09-20 确认地图已具备产品雏形、功能体验成立，并授权在一轮结构性精修后直接进入 Batch 6。Batch 5E 随后完成：增强地形层次、标签自动避让与纸面底、区域定义、Book Aura 状态带、多标签双环、指针中心缩放、双指缩放、缩放读数和详情 accent；`check:local` 为 295 单测 / 31 文件，local Chromium 115 / 115，视觉取证 3 / 3。

下一步已进入 Batch 6 全量 4,663 条标签生产。全量完成后重建地图并与用户共同调整最终视觉。public snapshot、public covers、repo、push、workflow 与部署仍需后续独立授权。

## Batch 6 后最终重建（2026-09-20）

Batch 6 内容质量 Gate 关闭后，地图已使用最终 1,694 条 reviewed assignments 重建：

- 全部 4,663 条仍参与全量地形；
- 1,694 条 reviewed 点参与 56 个命名区域与主题小径；
- 2,969 条 draft 继续只作为未命名地形，不造标签；
- 固定 seed、96 维稀疏投影、UMAP 参数、64×40 密度网格与 624 条等高线段保持不变；
- 新 layout version：`map-v1-52bf307f447c-2777f32e274f`；
- 新 layout hash：`567534bf71bfc5f6266ceb8ecd26267c4399888d87a1d606fed784a03d9fcd9e`。

最终 local snapshot、地图 / 小径 / 隐私 / 键盘 E2E 与 1440 / 390 / 320 截图均已验证。尚未进入 public export。

## 最终地图视觉与交互精修（2026-09-20）

根据最终地图 Gate 前的用户意见，完成：

- 世界区域和区域划线都默认显示 12 项，提供“展开全部 / 收起”和明确的显示进度；
- 「交易」等超长区域不再默认形成近两万像素高的页面，完整内容仍可按需到达；
- 顶部导航新增独立「世界地图」入口，地图不再从属于主题小径；移动端导航自动换行且无横向溢出；
- 移动端地图提高至 72svh，上下控制分层，缩小时减少标签、放大后增加次级标签；
- 滚轮监听改为非 passive 原生监听：地图实际缩放时阻止页面同步滚动，到达缩放边界时归还页面滚动；
- “点亮一本书”重绘为带 Book Aura 的原生选择器，保留键盘和移动端可用性；选书后的相关小径先显示 6 条，其余使用 disclosure 展开。

验证：`check:local` 300 / 300、完整 local Chromium 116 / 116、Tag Studio 10 / 10、200% 与 320 / 360 / 390 / 768 / 1440 响应矩阵通过；public build 与 isolation gate 通过。当前停在用户最终地图体验 / 视觉 Gate。
