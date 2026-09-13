# V2-B Implementer Prompt

> 状态：**已执行的历史提示词**。V2-B 已在 `46bee2c` 完成，并在 `a0815b2` 通过复核修复；后续不要再次使用本文件开工。下一批使用 `docs/14-ROOMS-CONTINUOUS-IMPLEMENTER-PROMPT.md`。

以下是当时供实现模型在 `E:\Desktop\henrys-reading-world` 中使用的开工提示词。**本轮只做 V2-B，不进入房间路由、色彩或动效开发。**

---

你是 Henry's Reading World 的实现 Agent。项目目录：

```text
E:\Desktop\henrys-reading-world
```

V2-A 的代码基线为：

```text
e2b82a1 V2-A: full library on schema 2 with book theme shelves
```

HEAD 可能在其后包含一笔只更新 `docs/07–13`、README、AGENTS 和 Product Brief 的规划提交；不得因此回退或覆盖。

开始前按顺序完整阅读：

1. `AGENTS.md`
2. `PRODUCT_BRIEF.md`
3. `docs/10-PRODUCT-DIRECTION-V2.md`
4. `docs/12-ROOMS-COLOR-MOTION-DIRECTION.md`
5. `docs/11-V2-IMPLEMENTATION-PLAN.md`
6. `docs/08-REVIEW-CHECKLIST.md`（重点看 V2-A 记录与已知限制）
7. `docs/07-IMPLEMENTATION-HANDOFF.md`
8. `docs/01–06` 与 `docs/09`（历史/技术/数据边界）

权威顺序：`docs/12` 是最新空间与视觉决定；公平算法与数据语义以 `docs/10`、`docs/11 §4` 为准。旧文档中 Opening / Contrast / Surprise、逐句主题、只选 30–50 条、单页长世界层、视觉永远停在无背景色等冲突内容均已过时。

## 当前真实状态

- schemaVersion 2；local-only 快照 4,663 条真实划线 / 130 本书 / 14 个书籍主题书架；127 本有本地封面。
- v1 的 20 本 / 46 条稳定 ID 已由 `npm run verify:ids` 防守，不得改变。
- V2-A 已完成；当前 `serendipity.ts` 只是过渡选择器，仍可能按书中划线数量加权。
- 当前 UI 仍是一张兼容性长页面；房间路由与 Book Aura 已获用户确认，但分别属于 V2-C1 / V2-C2，本轮不要提前实现。
- 只使用已有真实数据，不造句、书、作者、年份或逐句标签；启动页面不需要 `WEREAD_API_KEY`。

## 本轮唯一目标：V2-B Fair Discovery Engine

严格实现 `docs/11 §4`：

```text
scope -> eligible books -> choose book -> eligible highlights in book -> choose highlight
```

### 必须完成

1. 引入纯函数类型：
   - `StageScope = {kind:'all'} | {kind:'theme'; themeId:string}`
   - `SelectionScope = StageScope | {kind:'book'; bookId:string}`
   - reason 只允许 `all / theme / book / fallback`
2. Encounter state 增加持久 `stageScope`；`NEXT_STAGE` 使用它。
3. `SET_STAGE_SCOPE` 必须原子地切换 scope 并提交该范围内的一条划线，不能出现标签已切换但句子仍在旧范围的瞬间。
4. `NEXT_IN_BOOK` 是临时动作，不改变 `stageScope`；下一次 `NEXT_STAGE` 回到原 all/theme scope。
5. 选择书：
   - 主题通过 `Book.themeIds` 找书，绝不读取 Highlight 主题；
   - 多书时排除当前书；
   - 优先该 scope cycle 尚未出现过的书；
   - 同级书均匀抽取或按 session 曝光次数做简单反比权重；
   - **绝不按 highlightCount 加权。**
6. 选中书后再选句：
   - 优先该 scope/book cycle 未见划线；
   - 排除 currentId 与最近少量 ID；
   - 耗尽后明确 reset；必要时稳定逐级放宽，不死循环。
7. cycle 状态按 scope key 保存，例如 `all / theme:t-005 / book:b-023`；不同主题不能互相消耗。
8. 所有随机入口接收可注入 RNG；候选先按稳定 ID 排序，固定输入可复现。
9. 可以实现纯机械长句节奏：连续长句且有替代书/句时优先非长句；不得使用意义、质量、代表性或 Henry 人设评分。
10. 保持现有 UI 可运行。只做最小的兼容接线/诊断，不做 `/themes`、`/books` 路由，不做背景色、房间转场或 IA 重排。

### 必测性质

- 构造一本 200 条和一本 2 条的书，用固定 RNG/确定输入证明它们在选书层机会相同；删除或改写 V2-A 中钉住“按条数加权”的已知限制测试。
- 多书时相邻不重复；单书、单句可稳定继续。
- all scope 不被划线多的书垄断；完整书 cycle 内每本书最多出现一次后才 reset。
- theme scope 只选带该 themeId 的书，但测试文案不能说句子本身属于主题。
- 切换主题立即提交该范围内记录，后续 `NEXT_STAGE` 持续留在主题。
- `NEXT_IN_BOOK` 后 `stageScope` 不变，下一次 `NEXT_STAGE` 回到原范围。
- all、theme A、theme B、book cycles 相互独立；耗尽 reset 正确。
- 空主题、悬空 themeId、无标签书、无划线书、空快照不死循环，给出稳定 fallback/空状态。
- 快速点击 20 次只提交一次、pending 取消、focus、reduced-motion 回归继续通过。
- 现有真实快照 4,663 / 130 / 14 加载正常；初始 DOM 仍不渲染数千条划线。

## 明确禁止

- 不进入 V2-C1/C2：不建路由、不重排页面、不实现 Book Aura、不添加房间动画。
- 不增加依赖，除非现有工具确实无法完成；纯算法不应需要新依赖。
- 不修改真实快照内容、主题分类、ID map 或封面文件。
- 不恢复 qualityScore / pinned / openingCandidate / surpriseCandidate / topicIds。
- 不做 embedding、搜索、推荐学习、analytics、社交、部署、push 或公开快照导出。
- 不删除测试后以更少测试数声称通过。

## 执行顺序

1. `git status`、确认基线和现有用户修改；工作区不干净时先判断来源，不覆盖。
2. 阅读当前 `types / selection / serendipity / encounter / useEncounter / sequence` 及对应测试，画出最小状态迁移。
3. 先写/迁移纯算法性质测试，再实现两阶段引擎。
4. 接入 encounter reducer/hook 与当前兼容 UI。
5. 逐层跑 unit → local smoke/validator → E2E → build；失败时定位，不放宽产品硬规则。
6. 用真实 local-only 快照做浏览器回归，但不输出大段原文。
7. 更新 `docs/08-REVIEW-CHECKLIST.md` 的 V2-B 执行记录。
8. 做一个小步本地 Git commit；不 push。
9. 停止并汇报，不自动进入 V2-C1。

## 最低验证命令

```powershell
npm run verify:ids
npm run typecheck
npm run lint
npm run test
npm run smoke:local
npm run validate:data:local
npm run test:e2e
npm run build
```

若 package script 名称不同，先检查 `package.json`，报告实际命令。必须确认 public build 不包含 `.private`、`local-covers`、原始 ID 或凭证标记；local-private build 继续被拒绝。

## 完成后回报

```text
V2-B 完成范围：
主要修改文件：
两阶段选书/选句的实现方式：
scope 与 cycle 状态结构：
公平性确定性证据（200 vs 2）：
NEXT_IN_BOOK 后 stageScope 证据：
真实数据规模与稳定 ID 结果：
实际运行命令及结果：
浏览器环境、视口、操作与证据路径：
保留的兼容 UI / 临时实现：
未验证或 blocked：
与 docs/10/11/12 的偏差：
下一片：V2-C1（不得自行开始）
本地 commit：
```