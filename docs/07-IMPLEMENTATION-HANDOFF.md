# 07 — v2 实现交接入口

> 当前产品方向：`docs/10-PRODUCT-DIRECTION-V2.md`。
>
> 最新空间与视觉决定：`docs/12-ROOMS-COLOR-MOTION-DIRECTION.md`。
>
> 施工细节与切片：`docs/11-V2-IMPLEMENTATION-PLAN.md`。
>
> 下一批唯一开工提示词：`docs/16-V2-E4-SHARE-CARD-VISUAL-IMPLEMENTER-PROMPT.md`。`docs/15` 已执行完毕，只作历史记录。

## 当前状态（2026-09-13）

- 当前代码基线：`a8083ef V2-E3: final keyboard zoom and privacy gates`，React / TypeScript / Vite。
- v1 Slice 0–4、V2-A、V2-B、V2-C1、V2-D、V2-C2 与 V2-E1/E2/E3 均已完成；V2-E4 为用户实际体验后确认的窄范围视觉修订。
- schemaVersion 2；local-only 快照 **4,663 条真实划线 / 130 本书 / 14 个书籍主题书架**；127 本有本地封面。
- v1 的 20 本 / 46 条项目稳定 ID 已保留；`npm run verify:ids` 提供永久回归防线。
- 最近验证：171 单测 / 12 文件、81 local Playwright、1 public 空态 Playwright；实现 Agent 开工时仍须重跑，不照抄数字。
- 用户已实际使用并确认核心体验与分享卡片风格的一致性成立，但指出卡片与 dialog 同为白色纸面，视觉过于苍白、单一；用户确认采用 Book Aura 深色出版卡片，只重做 CSS 预览、不导出图片、不显示书封。
- GPT-5.6 Sol 独立验收中首次全量 E2E 为 80/81，dialog 背景滚动偶发到 210px；单用例 10/10、share spec 50/50、第二次全量 81/81。V2-E4A 必须修复滚动根与测试前置假设，不得按 flake 忽略。
- 真机移动端与 Safari 仍未验证（见 `docs/08` 的 V2-E3 未验证项）。
- 公开快照仍为空；开发可使用全部真实内容，发布仍待 PUB-01～PUB-07 决定。

## 已确认的产品方向

1. 不做人设策展，不使用 Opening / Contrast / Surprise、质量分或逐句主题安排访客印象。
2. 主题属于书籍；划线只通过书籍继承浏览范围，UI 不声称句子本身属于主题。
3. 算法只优化公平、防重复、scope 与机械阅读节奏；必须先选书、再选句，不能按划线数量加权。
4. 4,663 条全部可达但不同时渲染。
5. 信息架构采用房间：门厅 `/`、主题书架 `/themes`、主题房间 `/themes/:id`、所有书 `/books`、书籍房间 `/books/:id`、About `/about`。
6. 色彩采用 Book Aura：来自真实封面，有明确空间归属；不做主题人为语义色、高饱和大色块或封面墙。
7. 呼吸感来自留白、轻微进入/返回与慢于文字的环境色过渡；第一版不做永久循环背景动画。
8. 浏览器返回和页面返回一致，恢复进入前范围、原句、筛选、批次和必要滚动位置。

## 后续施工顺序

1. **连续房间批次：已完成并复核关闭**（V2-C1 → V2-D → V2-C2；修复提交 `9e2d0af`）。
2. **V2-E 最终开发批次：已完成**（E1 稳定深链与错误状态 → E2 固定 ID 的复制与分享预览 → E3 200% 缩放、完整键盘与最终工程 Gate）。
3. **V2-E4 分享卡片视觉修订：下一批**（E4A 滚动锁 → E4B Book Aura 出版卡片 → E4C 视觉与工程 Gate）。
4. **Public Release Gate**：V2-E4 后才讨论 PUB-01～PUB-07；不得自动进入公开导出、部署或上传。

连续批次不是“一次写完再测试”：V2-E4 必须按 A → B → C 逐阶段测试、记录与 commit；Gate 通过后可直接继续，无需停下等待。

## 已完成：V2-E 的硬边界（历史记录）

- 唯一规范深链是 `/?h=<stableHighlightId>`；`h` 只在门厅有意义，主题/书籍/年份不进入分享 URL。
- 从深链换句后用 replace 清除旧 `h`，不新增 history entry；有效/无效/撤回 ID 的完整语义见 `docs/15 §4/§6`。
- 分享只属于当前视觉中心：门厅/主题舞台与书籍房间顶部随机句；不在单书顺序列表上铺分享按钮。
- 分享 dialog 必须在打开时锁定稳定 highlight ID；复制与卡片不能随后台状态漂移。
- local-only 允许复制真实文字和明确标注的本机链接、查看带本机徽标的 CSS 预览；禁止 Web Share、上传、PNG、二维码或暗示链接已公开。
- 卡片短/中句约 4:5；299/398 字长文自然增高，不裁剪、不无限缩字。
- E3 必须实际验证 200% 浏览器缩放、完整键盘、Clipboard 失败、reduced-motion、network/privacy；没有 Safari/真机时必须明确未验证。
- 不得回退 V2-B 公平规则、V2-C1 现场记忆、V2-D 全量可达或 V2-C2 色彩归属；不得修改快照与发布状态。
- 不部署、不 push、不做公开快照。完整 Prompt：`docs/15-V2-E-CONTINUOUS-IMPLEMENTER-PROMPT.md`。

## V2-E4 已确认边界

- dialog 保留浅色纸面；卡片改为锁定书籍 Book Aura 派生的低饱和深色出版卡片。
- 卡片不显示书封，只使用真实封面色；无封面回退默认 accent。
- 只做 CSS DOM 预览，不下载/复制图片、不做 Canvas/SVG 导出、二维码或 Web Share。
- 不加入头像、日期、统计、主题标签、随机模板、固定黑金或 flomo 黄。
- 卡片文字、出处与 palette 都锁定 stable highlight ID，不能继承会变化的房间 Aura。
- 参考图只在 `.private/reference/share-cards/`，不得导入产品或构建。
- 完整 Prompt：`docs/16-V2-E4-SHARE-CARD-VISUAL-IMPLEMENTER-PROMPT.md`。

## 实现边界

- 只使用已有真实数据，不造句、书、作者、年份、标签覆盖或统计。
- 不引入 embedding、向量库、运行时模型、逐句 Agent 分类、推荐学习或 analytics。
- 不引入登录、评论、点赞、关注、多用户主页或自动同步。
- 继续保护 `.private`、API key、账号与原始 bookmark 字段；不部署、不 push。
- 不为常规代码结构、测试数量和已确认产品方向反复询问。

## 回到高推理模型 / 用户的条件

只在以下情况暂停并升级：

1. 两阶段公平与用户确认的 all/theme/book 行为出现无法同时满足的冲突；
2. 实现必须改变 schema 2、稳定 ID、主题属于 Book 的语义或全量真实数据边界；
3. 房间恢复语义在 V2-C1 出现 `docs/12` 未覆盖的重要产品分歧；
4. Book Aura 实际截图需要改变已确认的颜色归属、浓度上限或动效原则；
5. 拟增加搜索、收藏、自动播放、embedding、社交、部署、发布或其他非目标能力；
6. 深链规范入口、local-only 分享边界或长卡片不裁剪三项已确认决定无法同时满足；
7. 需要不可逆操作。

## 每片回报模板

```text
V2 Slice / 任务：
完成内容：
主要修改文件：
真实数据来源与快照规模：
稳定 ID 是否保持：
实际运行命令及结果：
浏览器环境、尺寸、操作与证据路径：
未验证 / blocked：
与 docs/10/11/12 的偏差：
下一片（不得自行开始）：
本地 commit：
```
