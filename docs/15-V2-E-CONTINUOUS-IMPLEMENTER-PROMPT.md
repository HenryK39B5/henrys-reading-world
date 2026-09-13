# 15 — V2-E 最终收尾批次 Implementer Prompt

> 状态：**已执行的历史提示词**。V2-E1 / V2-E2 / V2-E3 已全部完成。用户体验后新增窄范围视觉修订 V2-E4；当前唯一入口见 `docs/16-V2-E4-SHARE-CARD-VISUAL-IMPLEMENTER-PROMPT.md`。
>
> 基线：`9e2d0af Fix review findings: year scope, aura travel, stable book order`。
>
> 执行顺序（已完成）：**V2-E1 稳定深链与错误状态 → V2-E2 固定内容的复制与分享预览 → V2-E3 200% 缩放、完整键盘与最终工程 Gate**。
>
> 工作方式：三个内部阶段分别测试、记录、commit；Gate 通过后直接继续，不停下等待。全部结束后统一汇报。不部署、不 push、不导出公开快照。

## 1. 角色与本批次目标

你是 Henry's Reading World 的实现 Agent，在 `E:\Desktop\henrys-reading-world` 中完成本机静态原型的最后一个开发批次。

房间体验已经成立。用户实际使用后的反馈是：它既允许访客像“刷手机”一样随便刷新真实划线，也允许沿主题或一本书深入；当前尺度与平衡值得保护。**本批次不是继续增加探索功能，而是让一句真实划线可以被稳定定位、诚实复制，并把现有体验收尾到可访问、可复验。**

结束时应做到：

1. 一个稳定 highlight ID 可通过 `/?h=<id>` 直接打开、刷新恢复；
2. 分享/复制永远锁定打开时的那条划线，不会被后台换句改掉；
3. local-only 模式可复制真实文字和明确标注的本机链接，但不能伪装成可公开传播；
4. CSS 分享预览在短句、299 字开局与 398 字最长划线上都不裁剪；
5. 200% 缩放、完整键盘、reduced-motion、错误与失败回退经过浏览器验证；
6. 公开空快照、私有数据隔离与 V2-B/C/D 契约继续成立。

## 2. 开工前必读与当前基线

完整阅读并遵守：

1. `AGENTS.md`
2. `docs/10-PRODUCT-DIRECTION-V2.md`
3. `docs/12-ROOMS-COLOR-MOTION-DIRECTION.md`
4. `docs/11-V2-IMPLEMENTATION-PLAN.md`
5. `docs/02-TECHNICAL-DESIGN.md §4–7`
6. `docs/05-UX-SPEC.md §8–10`
7. `docs/07-IMPLEMENTATION-HANDOFF.md`
8. `docs/08-REVIEW-CHECKLIST.md` 的连续房间批次、独立复核修复与 V2-E 规划记录
9. 当前 router / encounter / room memory / StageRoom / BookRoom / snapshot source / E2E 全部实现

开工基线：

```text
commit: 9e2d0af
schema: 2
local-only: 4,663 highlights / 130 books / 14 themes / 127 local covers
stable ids: 20 books + 46 highlights guarded by npm run verify:ids
unit: 151 / 151 (11 files)
Playwright local: 44 / 44
Playwright public empty-state: 1 / 1
public snapshot: empty
```

先运行：

```text
git status --short
npm run check:local
npm run verify:ids
npx playwright test
npm run test:public
```

保护用户已有工作；数字必须重跑，不照抄。启动页面不需要 `WEREAD_API_KEY`。

## 3. 不能破坏的产品与工程契约

- 只用 Henry 的真实划线；不造句、书、作者、年份、主题、统计或分享样例。
- 主题属于 Book，不给具体句子贴主题语义标签。
- 保留 V2-B：先公平选书、再选句；不按划线数加权；多书不连续同书；all/theme/book cycle 隔离；长度规则不能先筛书。
- 保留 V2-C1：六房间真实 URL、浏览器 Back、原句/筛选/批次/滚动现场恢复。
- 保留 V2-D：130 本与 4,663 条全量可达但不同时渲染；年份只属于书籍空间。
- 保留 V2-C2：Book Aura 来自真实封面；换句环境色 700ms；reduced-motion 无位移、无长过渡。
- 分享必须锁定稳定 highlight ID，不能使用数组下标、当前随机位置或 DOM 文本匹配作为身份。
- 不增加搜索、收藏、点赞、浏览历史、自动播放、无限滚动、推荐学习、analytics 或“每日一句”。
- 不在单书 531 行顺序列表上铺一排分享按钮；第一版只分享**当前视觉中心**。
- 不增加状态库、动画库、UI 套件；默认不新增依赖。确需一个测试期 a11y 依赖时说明用途并提交 lockfile，不增加运行时依赖。
- 不实现 Web Share、PNG 下载、二维码、SEO、部署或公开发布。
- 不修改 `.private/local-snapshot.json`、主题分配、稳定 ID、公开快照或发布状态。

## 4. 已确认的 V2-E 产品决策

### 4.1 规范深链

唯一规范分享入口：

```text
/?h=<encodeURIComponent(stableHighlightId)>
```

- 内容身份只有稳定 highlight ID；房间、主题、年份和临时 scope 不进入分享 URL。
- `h` 只在门厅 `/` 有意义。其他房间收到多余 `h` 时保留房间并用 `replaceState` 规范化移除，不把句子硬塞进主题/书籍房间。
- 有效 `h`：门厅直接显示该条真实划线，reason 为 `fallback`，记入 all cycle，打开不算一次用户换句 commit；出处与 Aura 必须属于该条的书。当前 `OPEN_HIGHLIGHT` 是 `count: true` 的用户直接选择语义，不能不加区分地拿来做深链；应新增 `OPEN_DEEP_LINK` 或抽取共享 helper，以 `count: false` 保持 URL 打开语义。
- 无效、撤回或当前快照不存在的 `h`：显示轻提示 `这条划线暂不可用`，同时按公平 all scope 显示正常首句；不白屏、不泄露旧内容、不得复用 ID。
- 从有效/无效深链执行 `再来一句` 或 `再看一处` 后，页面内容已不再是 URL 指定记录，因此用 **replaceState** 清除 `?h=`，不能 push 新历史，也不能让地址栏继续指向旧句。
- 只打开/收起出处、打开/关闭分享 dialog 不清除 `h`；进入另一个房间按正常房间导航处理。
- 普通随机换句不把当前 ID写入 URL，避免浏览器 Back 退几十句。

### 4.2 分享入口范围

第一版只在以下当前视觉中心提供低权重 `分享`：

1. 门厅 / 主题房间的当前舞台句；
2. 书籍房间顶部的当前随机划线。

主题书架、书库列表、单书顺序列表、About 不逐行增加分享按钮。第一版不支持从长列表直接分享任意条目；若未来需要，另作产品决定，本轮不为此扩交互。

### 4.3 local-only 能做什么

local-only 模式允许：

- `复制文字`；
- `复制本机链接`（`http://127.0.0.1.../?h=...`），旁边持续说明 `仅在这台电脑的本机预览中有效`；
- 查看 CSS 卡片预览，卡片带 `仅本机 · 未公开审核`。

local-only 模式禁止：

- `navigator.share`、Web Share、上传、下载 PNG、二维码或任何外部发送；
- 文案暗示链接已经公开可访问。

public 模式当前是空快照，因此 V2-E 不凭空实现或演示系统分享。真实公开链接与外部行为留给 PUB-05。

### 4.4 分享文字与预览

复制文字固定格式：

```text
<原文>

——《书名》作者
Henry's Reading World
```

- 原文逐字保留，不改写、不裁剪、不加营销文案；缺作者继续使用当前真实回退口径。
- 卡片采用页面内 CSS editorial preview：句子主角、出处低权重、角落品牌；不放大封面、不做鸡汤图或通用渐变。
- 短/中句保持约 4:5；长文本无法在可读字号内完整容纳时允许自然增高，并显示 `长文预览已延长比例`；禁止 line-clamp、省略号和无限缩小。
- 299 字 `h-4647` 与全库最长 398 字真实划线必须进入卡片截图验收；不要把这些 ID 写成业务逻辑常量，测试从真实快照按长度查找。

## 5. 连续执行规则

- 按 **E1 → E2 → E3** 实施；先让 ID/URL 身份正确，再做复制/dialog，最后统一做视觉与无障碍收尾。
- 每阶段：unit/E2E → 更新 `docs/08` → 本地 commit → Gate 通过后直接下一阶段。
- 不一次写完全部功能后才测试。
- 只有新的产品边界冲突、隐私/发布决策、不可逆操作或修复后仍无法通过的 Gate 才暂停。
- 不 push、不部署。

## 6. V2-E1 — 稳定深链与错误状态

### 6.1 实现要求

- 扩展 router/query 解析，使 hall route 能表示规范化的 `highlightId: string | null`；`routePath` 输出带 h 的完整位置，但 `routeKey` / scroll key / stage session key 必须仍把所有 `/?h=…` 视为同一个门厅 `/`。
- h 的增加/替换/清除只是同一房间里的内容定位，不能触发房间重新醒来、主区域重新聚焦、滚动归零或新建 Aura key；当前 `ReadingWorld` 以 `router.path` 驱动 focus 与 aura key，实施时必须改用不含 h 的房间 identity。
- 深链参数不应把同一个门厅拆成无限套现场：`/?h=h-001` 是一次直接打开上下文，清除 `h` 后仍回到门厅 all session。避免为每个 highlight 建独立随机 cycle。
- 当前 `OPEN_HIGHLIGHT` 采用 `count: true`；深链需要独立的 `count: false` domain 事件或共享 helper。不能在 React 组件里直接改 `currentId` 绕开 exposure bookkeeping，也不能为了方便改变已有用户直接选择测试的语义。
- 首次直接加载有效 h 时不要先可见地画出一条随机句再替换，尤其不能让辅助技术先播报错误内容；可以让 hall session 用已校验 initial ID 初始化，SPA 内 h 变化再走深链事件，但必须继续防守 React StrictMode 双初始化。
- 直接访问与同文档 SPA 导航到 `/?h=` 都生效。
- 有效记录显示后，出处开关、同书再看、查看这本书、Aura、复制所需书籍索引都一致。
- 无效 ID 状态是轻提示，不是未知路径页；正常舞台仍可用。
- h 参数不得进入主题房间 scope、书籍列表筛选或分享 URL 的其他参数。
- 内容变化后清除 h 用 replace，不新增历史 entry；浏览器 Back 行为仍可信。

### 6.2 必测

Unit：

- hall `?h=` 解析/格式化/规范化；编码异常与空参数；其他房间移除 h；同一 h 无重复 effect/曝光；
- 有效深链事件写入 all cycle、不改变持久 scope、`commitCount` 不增加；已有 `OPEN_HIGHLIGHT` 的用户动作语义不被无意改变；
- routePath 可含 h，但 room/stage/scroll key 不含 h；h 变化不触发房间进入焦点或 Aura wake；
- 无效 ID 返回明确状态且公平 opening 仍存在；
- 清除 h 的判断是纯函数或可独立测试。

E2E（真实数据）：

- `/?h=<有效ID>` 直接访问、刷新、SPA 导航都显示精确原文/出处/Aura；
- 从深链换句后 URL 变 `/` 且 history length 不增加；Back 不退到“上一句”；
- 深链打开出处 → 书籍房间 → Back，门厅仍是指定句，直到用户换句；
- `/?h=不存在/撤回ID`：轻提示 + 正常真实 opening + 下一次操作清提示并移除 query；
- `/themes/:id?h=...`、`/books/:id?h=...` 保留房间并移除 h；
- public 空快照的 h 不白屏、不泄露 local 内容。

### 6.3 E1 Gate

通过后更新 `docs/08`，commit，例如：

```text
V2-E1: stable highlight links and honest unavailable states
```

然后直接进入 E2。

## 7. V2-E2 — 固定内容的复制与分享预览

### 7.1 状态边界

建议建立可测的分享状态：

```ts
type ShareState = {
  open: boolean;
  highlightId: string | null; // OPEN_SHARE 时固定
  copyStatus: 'idle' | 'copied' | 'failed';
};
```

- `OPEN_SHARE` 固定当前视觉中心的稳定 ID；dialog 后续只通过 ID 从 snapshot index 读取内容。
- 打开后即使外部状态发生变化，分享文字、链接和预览仍是同一条；关闭后再打开才重新锁定。
- 转场 busy 时分享入口不可操作；不能复制 pending 新句或即将离开的旧句。
- 分享状态与 hall/theme/book room session 分离，不污染 discovery cycle、批次或返回现场。

### 7.2 Dialog 与焦点

- 优先原生 `<dialog>`，标题明确，`aria-labelledby`/说明正确。
- 打开后焦点进入第一个主要动作（建议 `复制文字`）；Tab / Shift+Tab 不离开 modal；Esc 关闭；关闭后焦点回原触发按钮。
- 不因打开 dialog 自动写剪贴板；重复打开/关闭不留 backdrop、滚动锁或焦点残留。
- 页面只保留一个 dialog DOM；不要每个 passage 一份。

### 7.3 复制与失败回退

- `复制文字` 使用固定格式；成功后才显示 `已复制`。
- Clipboard API 不存在、拒绝或抛错时显示 `自动复制失败，请手动复制`，并提供可全选的只读 `<textarea>` 或等效原生文本控件；不能假成功。
- `复制本机链接` 使用当前 origin 生成绝对 URL，但 path/query 只能是规范 `/?h=`，不带 year/theme/追踪 query；持续显示仅本机提示。
- 测试允许模拟 Clipboard 成功/拒绝等浏览器能力，**业务文字仍必须来自真实快照**；失败 fixture 不能进入产品 UI。

### 7.4 卡片预览

- CSS 预览随锁定 ID，不随当前舞台变化。
- 4:5 是短/中句默认，不是裁切容器；长文自然增高。
- 测试/截图至少覆盖：18 字、常规中句、299 字、398 字；全部真实。
- 390px 与 200% 等价窄宽下 dialog 可滚动但背景页面不误滚；关闭控件始终可达。

### 7.5 必测与 E2 Gate

- hall、theme、book random 三个入口各自锁定正确 ID；书库/顺序列表无成排分享按钮；
- 打开分享 → 尝试快速换句/导航 → 分享内容仍固定或 modal 正确阻止背景操作；
- 复制文字成功、Clipboard 拒绝与手动 fallback；
- 复制链接只含一个 `h`；local-only 文案与卡片徽标；无 `navigator.share` 调用；
- dialog 初始焦点、Tab 环、Esc、关闭焦点恢复；
- 18/299/398 字卡片无截断、无横向溢出。

通过后更新 `docs/08`，commit，例如：

```text
V2-E2: fixed-id copy dialog and editorial share preview
```

然后直接进入 E3。

## 8. V2-E3 — 最终响应式、键盘与工程 Gate

### 8.1 人工/浏览器主路径

视口：320×800、360×800、390×844、768×1024、1440×900；另做真实 Chromium **200% 浏览器缩放**。自动化可补等价窄宽重排，但不能把 viewport 缩小冒充已经验证真实 200%。

完整键盘旅程：

```text
门厅
→ 出处展开/收起
→ 再看一处
→ 查看这本书
→ 单书年份筛选/批次
→ 返回
→ 主题书架
→ 主题房间
→ 分享 dialog
→ 复制失败 fallback
→ Esc 关闭
→ 回门厅
```

验证：

- Tab / Shift+Tab / Enter / Space / Esc 全部可走；
- 焦点可见，dialog 焦点不逃逸，关闭/返回焦点合理；
- 页面无横向溢出，299/398 字、长书名、无封面、长卡片完整；
- Aura 不遮字；reduced-motion 无位移、长颜色/对话框过渡；
- 200% 下导航、dialog、卡片与关闭按钮不重叠/不可达；
- 封面失败回退真实书名；无效 path/theme/book/h 均可离开；
- 后台标签恢复和快速连续操作不产生过期复制/分享状态。

### 8.2 Network / privacy

浏览器 Network 证明：

- 客户端不请求微信读书、字体 CDN、analytics、远程卡片生成或上传；另用能力 stub 证明 local-only UI 不调用 `navigator.share`；
- 只加载本机 snapshot/cover 路径和应用资源；
- `.private`、`.agents`、scripts、API key、账号字段继续不可经 HTTP 读取；
- public dist 无真实划线、封面文件、稳定业务内容、原始 ID、密钥或个人字段；
- local-private production build 继续拒绝；
- local-only 分享不能绕过 build/发布边界。

### 8.3 浏览器边界

- Playwright Chromium 必须实际通过。
- 若本机没有 Safari / iPhone / Android 真机，可继续完成实现，但在 `docs/08` 明确写 **未验证**；不得把 Chromium 模拟视口写成真机/Safari 通过。
- 不为本批次安装浏览器兼容 polyfill，除非真实失败且修复属于当前范围。

### 8.4 E3 Gate

- 新增完整键盘、200%/reflow、dialog、错误、network 与 privacy E2E；
- 关键截图放 `.private/review/v2-e/`，至少：dialog 1440/390、18/299/398 字卡片、200% 缩放、Clipboard 失败、reduced-motion；
- 更新 README 实际命令与当前体验路径；
- 更新 `docs/08`，commit，例如：

```text
V2-E3: final keyboard zoom and privacy gates
```

## 9. 最终全批次验证

实际运行：

```text
npm run check:local
npm run verify:ids
npm run smoke:local
npx playwright test
npm run test:public
npm run capture:review
npm run build
npx vite build --mode local-private   # 必须拒绝
```

还要检查：

- Markdown 链接、尾随空白、`git diff --check`、工作区干净；
- 测试总数相对 151 unit / 44 local E2E / 1 public E2E 净增加，不能靠删除旧测试通过；
- public dist 文件清单和敏感字符串探针；
- 没有业务假数据、没有新增远程请求、没有依赖数组下标的分享身份；
- `docs/07/08/11/README` 与真实实现一致；
- 不生成 public snapshot，不部署、不 push。

## 10. 最终统一汇报

只在 E1、E2、E3 全部完成后汇报：

1. 三个内部 commit 与完成范围；
2. 深链 URL、有效/无效 ID、清除 h 与 Back 的状态语义；
3. 分享状态如何固定 highlight ID；
4. 复制成功/失败、本机链接与卡片长文策略；
5. dialog 焦点、完整键盘、200% 与 reduced-motion 证据；
6. 真实截图路径、浏览器和视口；
7. unit/E2E/build/privacy/network 全部实际结果；
8. 未验证的 Safari/真机项；
9. 与 `docs/10/12/15` 的偏差；
10. 下一阶段仅为 **Public Release Gate（PUB-01～PUB-07）**，不得自行开始公开导出、部署或上传。
