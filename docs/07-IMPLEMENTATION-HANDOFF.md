# 07 — 实现交接入口（V3）

> 当前产品方向：`docs/19-PRODUCT-DIRECTION-V3.md`。
>
> 标签、小径、embedding 与地图：`docs/20-TAGS-PATHS-MAP-SPEC.md`。
>
> 最新视觉方向：`docs/21-V3-VISUAL-DIRECTION.md`。
>
> 施工细节与 Batch：`docs/22-V3-IMPLEMENTATION-PLAN.md`。
>
> Release-A 及两轮公开审核均已完成；私有清单为 108 本公开、22 本排除、6 条单独排除。Release-B 因 V3 产品迭代暂停。Batch 0–2 已完成到用户词表 Gate：默认模型已覆盖全部 4,663 条，第一版私有候选词表与人工种子已建立。实际状态见 `docs/23–24`。

## 当前状态（2026-09-18）

- 当前代码基线：`6b6e0a0 Publication review: add context note and clean imported metadata`，React / TypeScript / Vite。
- v1 Slice 0–4、V2-A～V2-E4D 与 Release-A1～A4 均已完成。
- schemaVersion 2；local-only 快照 **4,663 条真实划线 / 130 本书 / 14 个书籍主题书架**；127 本有本地封面。
- v1 的 20 本 / 46 条项目稳定 ID 已保留；`npm run verify:ids` 提供永久回归防线。
- 最近验证：**248 单测 / 19 文件、104 local Playwright、9 审核器 Playwright、1 public 空态**、6 真实数据 smoke；实现 Agent 开工时仍须重跑，不照抄数字。
- 用户已实际使用并确认核心体验与分享卡片风格的一致性成立；卡片现已改为锁定书籍 Book Aura 派生的深色出版卡片，正文与次要文字在真实卡面上实测 9.33–11.49 与 5.94–7.31。
- GPT-5.6 Sol 独立验收中首次全量 E2E 为 80/81，dialog 背景滚动偶发到 210px；已在 V2-E4A 定位根因（聚焦把页面拉回顶部、`overflow:hidden` 不阻止程序化滚动、StrictMode 第二次锁录取到被钳制的 0）并修复。
- 真机移动端与 Safari 仍未验证（见 `docs/08` 的 V2-E4C 未验证项）。
- 公开快照仍为空；私有 policy 已完成审核并可生成 private preview，但正式 export、public covers、repo、push 与部署仍未授权。

## 已确认的产品方向

1. 只使用 Henry 的真实微信读书划线，不接入其他来源，不做人格策展、AI 总结或 Dashboard。
2. Book Theme 继续属于 Book；Highlight 新增 1–3 个地位平等的 Topic Tag。标签是线索，同标签形成小径，多标签划线形成岔路。
3. embedding 只用于本机标签发现、标注候选、一致性检查、地图布局和小径软节奏；不做独立类似划线入口、AI 搜索、问答或消费者运行时模型。
4. 小径算法继续先按书公平、再选句；embedding 只能在选中书内部调节语义跳跃，不能破坏首轮不重复与全量可达。
5. 产品采用一个 Reading World、Public/Local 两个数据范围和一个 Local Studio；不建设登录或远程后台。
6. 主导航扩为门厅、主题书架、主题小径、所有书、About；世界地图从小径模块进入并有稳定 `/map` 房间。
7. 地图展示全部划线点作为地形，但总览使用 Canvas / 预计算图层，不创建数千 DOM 控件；小径列表是无障碍替代。
8. 视觉允许系统重构：纸、墨、光与地形；Book Aura 继续属于书，地图可点亮一本书，分享显示全部标签。
9. 已完成的书级 / 单条公开决定继续有效；新增标签与地图需要补充审核，Release-B 暂停。

## 后续施工顺序

1. **V3 Batch 0**：已完成，建立权威文档、标签 / 地图规格、视觉方向与实施计划。
2. **Batch 1**：已完成 provider-neutral 基础、300 条真实评测集、SiliconFlow 三模型对比、人工 neighbour review 与默认 / 回退选择。
3. **Batch 2**：已完成全量 4,663 条 embedding、300 条按书公平发现样本、53 个私有候选标签、35 组边界与 159 条人工种子；当前停在用户词表 Gate。
4. **Batch 3**：用户批准词表后才开始 Local Tag Studio 与 250–300 条试标。
5. **Batch 4**：schema 3、主题小径、岔路、分享全部标签与关键视觉原型。
6. **Batch 5**：世界地图与点亮一本书。
7. **Batch 6–7**：全量 4,663 条标注、全产品视觉统一与公开标签审核。
8. **Batch 8**：用户批准后才恢复 Release-B～E。

每个 Batch 内部仍按纯领域 → UI → 浏览器 Gate 小步测试、记录与 commit；完整顺序见 `docs/22`。

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

## V2-E4 已实现的内容（完成记录）

- dialog 保留浅色纸面；卡片为锁定书籍 Book Aura 派生的低饱和深色出版卡片（`src/domain/sharePalette.ts`）。
- 卡片不显示书封，只使用真实封面色；无封面或封面加载失败回退默认 accent。
- 只做 CSS DOM 预览，不下载/复制图片、不做 Canvas/SVG 导出、二维码或 Web Share。
- 未加入头像、日期、统计、主题标签、随机模板、固定黑金或 flomo 黄。
- 卡片文字、出处与 palette 都锁定 stable highlight ID，不继承会变化的房间 Aura。
- 参考图仍在 `.private/reference/share-cards/`，不可经 HTTP 读取，未进入产品或构建。
- 执行记录：`docs/08` 的 V2-E4A/E4B/E4C 三节；Prompt：`docs/16-V2-E4-SHARE-CARD-VISUAL-IMPLEMENTER-PROMPT.md`。

## 实现边界

- 只使用已有真实数据，不造句、书、作者、年份、标签覆盖或统计。
- 允许私有 embedding API 与逐句 Topic Tag 内容生产；向量、候选、confidence、理由与模型报告不进 public snapshot。
- 不引入消费者运行时模型、AI 搜索 / 问答、人格分析、登录、评论、点赞、关注、多用户主页或自动同步。
- 继续保护 `.private`、API key、账号与原始 bookmark 字段；不部署、不 push。
- 视觉重构必须保护长文本、稳定 ID、按书公平、键盘、移动端、200% 与 reduced-motion。
- 不为常规代码结构、测试数量和已确认产品方向反复询问。

## 回到用户的条件

只在以下情况暂停并升级：

1. 第一版标签词表的抽象度、边界或数量出现真实产品分歧；
2. embedding 候选都达不到“够用”，或厂商数据政策需要用户取舍；
3. 按书公平、全部可达与 embedding 呼吸节奏无法同时满足；
4. 地图审美、交互、性能或无障碍需要改变 `docs/20/21` 的顶层决定；
5. 标签需要超过 3 个、引入核心 / 次级标签或改变 stable ID；
6. 需要正式 public export、public cover、repo、push、workflow 或部署；
7. 需要其他不可逆操作。

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
