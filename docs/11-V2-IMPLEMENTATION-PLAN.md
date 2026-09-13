# 11 — v2 迁移与施工计划

> 状态：交给实现模型的当前施工路线。
>
> 产品依据：`docs/10-PRODUCT-DIRECTION-V2.md`；空间、色彩与动效以 `docs/12-ROOMS-COLOR-MOTION-DIRECTION.md` 为最新权威。
>
> 原则：按片迁移、每片测试并记录；不要把全量数据、schema、算法、路由与视觉一次性全部改完后才排错。

## 0. 当前基线与迁移目标

当前 commit 基线：`e2b82a1`（V2-A 完成）。工作区应先保持干净。

V2-A 已有：schema 2、4,663 条 / 130 本 / 14 个书籍主题书架、稳定 ID、防泄漏全量 local-only 快照；当前 UI 仍是兼容性长页面，选择器仍是待替换的过渡实现。独立复核为 87 单测、24 E2E。

后续 v2 目标：

- 约 4,663 条候选池真实划线全部进入 local-only 快照；约 130 本有划线书籍进入书库；
- 主题从 Highlight 移到 Book，形成 8～15 个宽主题书架；
- 舞台支持 `all` 与持久 `theme` scope，书内换句保持临时 book scope；
- 随机改为先公平选书、再选划线，不再使用编辑质量或前三阶段；
- 主题点击进入主题舞台，不直接展开大段句子；
- 书内划线分批显示，保证全部可到达而非全部同时渲染；
- v2 稳定后再继续原 Slice 5（分享、深链、卡片与最终可访问性）。

## 1. 目标数据契约（schemaVersion: 2）

```ts
type Snapshot = {
  schemaVersion: 2;
  visibility: 'public' | 'local-only';
  owner: Owner;
  themes: Theme[];
  books: Book[];
  highlights: Highlight[];
};

type Theme = {
  id: string;
  title: string;
  description?: string; // 只说明书架收录范围，不描述 Henry 人格
};

type Book = {
  id: string;
  title: string;
  author: string;
  description?: string;
  coverPath?: string;
  themeIds: string[];    // 1 个主标签在前，之后最多 2 个次标签；允许暂时为空
};

type Highlight = {
  id: string;
  bookId: string;
  text: string;
  year?: number;
};
```

移除 Highlight 的 `topicIds / qualityScore / standaloneReadable / pinned / openingCandidate / surpriseCandidate`。私有审核账本仍可保留发布风险、原始映射和编辑备注，但这些不进入前端快照。

公开空快照同步升级为 schema 2；不得把 local-only 数据写进 `src/data/`。

## 2. 稳定 ID 迁移

不能因为扩库而改变当前 46 条和 20 本书的项目内 ID。

新增 `.private/curation/id-map-v2.json`：

```ts
type IdMapV2 = {
  books: Array<{ planIndex: number; id: string }>;
  highlights: Array<{ candidateId: string; id: string }>;
};
```

迁移规则：

1. 从现有 `selection.json`、`selection-source-map.json` 引入已有 `b-001…b-020` 与 `h-001…h-046` 映射。
2. 其余书按 planIndex 稳定升序分配后续 `b-*`。
3. 其余划线按 `(planIndex, candidateId)` 稳定顺序分配后续 `h-*`。
4. 脚本重复执行必须得到完全相同的映射；已有映射只追加、不重排、不复用撤回 ID。
5. 不把原始 bookId / bookmarkId 写进快照、日志或前端。

## 3. 私有主题准备文件

新增两个仅本机文件：

- `.private/curation/book-dossiers.json`：每本书的 planIndex、书名、作者、候选划线数，以及供 Agent 分类的有限真实样本；不含账号字段。
- `.private/curation/book-themes.json`：主题词表 + planIndex 到 themeIds 的分配。

建议 dossier 每本书选取不超过 12 条：按候选顺序等距采样，并保证短/中/长在有数据时都出现；不是挑“最好”的句子。终端只输出数量和文件路径，不打印全文。

`book-themes.json` 约束：

- 8～15 个宽主题；
- 每书 1 个主标签、0～2 个次标签；确实无法判断可为空或进入宽泛 `其他`；
- 标签命名平实，像书架分类，不使用人格化结论；
- theme ID 稳定，主题改名不换 ID；
- validator 检查引用、重复、每书最多 3 个标签；主题覆盖少不阻止开发，但报告警告。

Agent 分类是一次性的本地数据准备，不接入运行时模型。先生成分类结果并输出主题/书籍数量摘要供用户快速查看，不要求用户逐书审核后才继续本机施工。

## 4. Fair Discovery Engine v1

替代 `src/domain/serendipity.ts` 的阶段式算法。可保留旧文件直到新引擎测试通过，再删除或改名归档。

### 4.1 类型

```ts
type StageScope =
  | { kind: 'all' }
  | { kind: 'theme'; themeId: string };

type SelectionScope = StageScope | { kind: 'book'; bookId: string };

type SelectionReason = 'all' | 'theme' | 'book' | 'fallback';
```

Encounter state 新增持久 `stageScope`。`NEXT_STAGE` 使用它；`NEXT_IN_BOOK` 不改变它。`SET_STAGE_SCOPE` 必须原子选择新范围中的一句并提交，不能出现标签已切换而句子仍来自范围外的瞬间。

### 4.2 两阶段抽样

```text
scope -> eligible books -> choose book -> eligible highlights in book -> choose highlight
```

硬规则：

- 主题通过 `Book.themeIds` 选书，绝不依赖 Highlight 标签；
- 候选书多于一本时不选当前书；
- 优先当前 scope cycle 未出现过的书；
- 同级书按均匀概率或简单的 session 曝光反比权重抽取，绝不按 highlightCount 加权；
- 选中书后优先该 scope cycle 未出现的划线；
- 排除 currentId 和最近 ID，必要时逐级放宽；
- pool 耗尽后明确 reset；空主题、单书、单句稳定降级；
- 可在连续长句且有替代项时优先非长句，除此之外不做内容质量评分；长度偏好只在选中书内部排序，**不得先按句长筛选候选书**；选中书没有任何 20–120 字划线时正常降级，显示它自己的划线。
- 所有随机入口注入 RNG，候选按稳定 ID 排序后再抽取。

建议将 cycle 状态按 scope key 保存，例如 `all / theme:<id> / book:<id>`；不能继续用单一 `seenInCycle` 让不同主题互相消耗。

### 4.3 必测性质

- 一本 200 条划线的书不会比一本 2 条划线的书获得约 100 倍选中机会：固定 RNG/大量确定输入验证选书层公平，而非概率式 flaky 断言。
- 多书时相邻不重复书；单书时可继续。
- 主题 scope 只选带该 themeId 的书，但不声称句子语义属于主题。
- 切换主题立即提交范围内记录，后续 `NEXT_STAGE` 持续留在主题。
- `NEXT_IN_BOOK` 不改变 stageScope；下一次 `NEXT_STAGE` 回到原 all/theme 范围。
- scope 各自 cycle、耗尽 reset、空主题、单句、无标签书均不死循环。
- 快速点击、reduced-motion、取消 pending 与现有状态机保证继续通过。

## 5. 房间式 UI 与信息架构

本节已由用户在 Critique #2 后确认，完整行为见 `docs/12`。不再把舞台、主题、书籍、年份和 About 接成一张长页面，而是使用稳定 URL 形成同一个阅读世界中的独立房间：

```text
/                   门厅 / 随便看看
/themes             主题书架
/themes/:themeId    主题房间
/books              所有书
/books/:bookId      书籍房间
/about              关于
```

### 5.1 门厅与主题房间

- 门厅只保留当前一句、出处、`再来一句` 与去主题/书库/About 的低权重入口，不再向下铺完整世界层。
- 主题书架只显示摘要、真实数量与少量封面，不直接展开划线墙。
- 主题房间显示一条来自该书架中某本书的划线；`再来一句` 持续停留在该主题。
- 主题说明使用书架语义，不声称当前句子本身属于主题。

### 5.2 导航与现场记忆

- 浏览器返回与页面返回一致；刷新可从 URL 恢复房间。
- 从主题或所有书进入一本书，返回后恢复原范围、原句、筛选、已展开批次和必要滚动位置。
- `NEXT_IN_BOOK` 不改变持久 all/theme scope；回门厅不得无故重抽一句。
- 无效 theme/book ID 给出安静、可返回的错误态。

### 5.3 所有书与书籍房间

- 所有书初始显示 10～12 本，每次追加约 20 本；默认按最近留下划线的时间排列。
- 年份只属于所有书与单书顺序列表，不过滤主题书架或主题舞台。
- 书籍房间提供封面、真实元数据、一处随机划线、`随机看一处` 与分批顺序列表。
- 单书划线初始 8～12 条，每次追加约 20 条；不一次渲染 157 条或全库 4,663 条。
- 暂不增加搜索、评分、复杂排序与虚拟列表。

### 5.4 色彩与呼吸动效

色彩和动效单独放在 V2-C2，不与路由迁移混做：

- 颜色来自真实书封的 muted accent，不给主题人为分配语义色；
- 门厅约 4%～7%、主题房间局部约 3%～6%、书籍房间约 8%～12%；
- 房间进入约 320～420ms，环境色约 600～900ms，位移仅 8～12px；
- 换句的颜色变化慢于文字；连续点击不叠加动画；
- 第一版不做永久循环呼吸动画；纯 CSS 可完成时不加动画库；
- reduced-motion 取消位移、错峰与长颜色过渡，状态立即准确提交。

### 5.5 About

About 是独立小房间，只显示真实范围和可选的 Henry 自写介绍。删除访客无须阅读的内部防御文案。

## 6. 施工切片

### V2-A — 数据准备与 schema 2（已完成）

- 实际完成：稳定 ID map、书籍 dossier、14 个宽主题书架、schema 2 契约与全量 local-only 快照（4,663 条 / 130 本）；v1 的 46 条与 20 本 ID 原封保留；`verify:ids` 防守。执行记录见 `docs/08`。
- 已知遗留：选择器仍是过渡实现（按划线条数加权），属 V2-B；主题展开与年份作用域属 V2-C。

- 建 dossier、主题分配文件、稳定 ID map。
- 建全量 local-only snapshot builder；升级类型、validator、index、公开空快照。
- 先让当前 UI 在 schema 2 + 全量数据下能安全加载，允许暂时用兼容 read model；不要同时重写算法/UI。

验收：约 4,663 条 / 约 130 本；当前 46 条和 20 本 ID 保持；无原始 ID/凭证；public build 仍为空；`check:local` 通过。若真实数量因重建规则略有变化，报告实际值，不硬编码旧数字。

### V2-B — Fair Discovery Engine

- 实际完成：`discovery.ts` 取代 `serendipity.ts`；两阶段公平引擎（先选书、再选句）、`all / theme:<id> / book:<id>` 三套独立 cycle、持久 `stageScope`、原子 `SET_STAGE_SCOPE`、机械长度规则。真实数据首次 130 次抽完全部 130 本、600 次 0 重复；旧“按条数加权”的已知限制测试已由 45 条新性质测试取代。执行记录与复核修复见 `docs/08`。
- 已知遗留：主题/房间 UI 与 scope 控件属 V2-C1；首屏只做机械可读长度偏好，不做按长度预筛书。

- 新两阶段选择器与 scope-aware cycle。
- reducer/hook 接入 `stageScope / NEXT_STAGE / SET_STAGE_SCOPE`。
- 保持旧 UI 可运行，先用测试证明公平与状态正确。

验收：算法性质测试 + 快速点击/reduced-motion 回归；删除 Opening/Contrast/Surprise 的产品依赖和诊断文案。

### V2-C1 — 房间路由、现场记忆与新 IA

- 建立 `/`、`/themes`、`/themes/:id`、`/books`、`/books/:id`、`/about` 的稳定房间结构。
- 门厅不再向下铺完整世界层；主题总览不再展开划线墙。
- 主题房间接入 V2-B 的持久 scope；所有书和书籍房间建立独立页面职责。
- 实现浏览器返回、刷新恢复、来源房间与滚动/筛选/批次记忆；年份只属于书籍空间。
- 先保证低色彩版本结构正确，不在本片精调 Book Aura。

验收：all → themes → theme A 连续 3 次 → book → back 恢复 theme A 原现场 → themes → theme B → home → books（筛选/展开）→ book → back 恢复书库现场；直接刷新各 URL；无效 ID；桌面/390px、键盘与焦点。

### V2-C2 — Book Aura 与呼吸动效

- 按 `docs/12 §4–6` 接入房间/当前书的颜色归属、浓度和环境过渡。
- 门厅、主题、书籍房间分别截图调色；不为主题分配人为语义色。
- 实现短暂空间醒来、房间进入/返回与换句颜色过渡；快速点击不叠加。
- 不增加动画库；第一版不做永久循环背景动画。

验收：1440 / 390 的门厅、主题书架、主题房间、书籍房间截图；短/中/长划线；至少 6 本封面色差异样本；快速点击；reduced-motion 无位移/闪烁；正文和控件对比度继续合格。

### V2-D — 全量内容浏览

- 所有书与单书内容分批显示；同书随机入口。
- 检查 130 本、4,663 条下 DOM 数量、交互响应与封面加载。
- 确保每条 highlight 至少可通过对应书籍房间到达；测试不要尝试在一个页面同时渲染全部。

验收：最多划线书可逐批走到末尾；末批数量正确；书库最多追加到第 130 本；无横向溢出；房间初始 DOM 不含数千条 passage。

### V2-E — 原 Slice 5

在 v2 状态和房间结构稳定后再实现：稳定 highlight 深链、复制、4:5 分享预览、失败回退、200% 缩放、完整键盘和错误状态。分享只锁定 highlight ID；房间与临时 scope 是上下文，不替代内容身份。

## 7. 每片交付要求

每片完成后：

1. 更新 `docs/08-REVIEW-CHECKLIST.md`；
2. 报告修改文件、实际命令与结果；
3. 运行对应 unit/E2E，不把旧测试删除后数量变少称为通过；
4. 用真实数据截图/浏览器验证；
5. 小步本地 commit，不 push、不部署；
6. 遇到真正产品冲突才问用户，不为已确定的全量开发许可、主题书架语义、公平抽样或 `docs/12` 已确认的房间/色彩/动效方向重复询问。

## 8. 明确非目标

本轮迁移不做 embedding、逐句标签、运行时模型、AI 人格、推荐学习、analytics、搜索系统、传统社交、自动同步、部署、PNG 下载、二维码或发布审核。发布前政治敏感内容与版权仍登记为 Gate 4 项，不阻塞 local-only 全量开发。
