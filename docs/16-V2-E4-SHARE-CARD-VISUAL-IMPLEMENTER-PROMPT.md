# 16 — V2-E4 分享卡片视觉修订 Implementer Prompt

> 状态：**已执行的历史提示词**。V2-E4A（dialog 滚动锁）→ V2-E4B（Book Aura 出版卡片）→ V2-E4C（视觉与工程 Gate）已全部完成。本机原型开发批次再次结束，下一阶段是 Public Release Gate（PUB-01～PUB-07），需用户决定。
>
> 执行记录见 `docs/08` 的 V2-E4A/E4B/E4C 三节。
>
> 基线：`a8083ef V2-E3: final keyboard zoom and privacy gates`。
>
> 执行顺序：**V2-E4A dialog 滚动锁可靠性 → V2-E4B Book Aura 出版卡片 → V2-E4C 视觉与全量工程 Gate**。
>
> 工作方式：连续完成三个内部阶段；每阶段测试、更新 `docs/08` 并做本地 commit，Gate 通过后直接继续。全部结束后统一汇报。不部署、不 push、不生成公开快照。

## 1. 角色与本批次目标

你是 Henry's Reading World 的实现 Agent，在 `E:\Desktop\henrys-reading-world` 中完成 V2-E 后的一次窄范围视觉修订。

V2-E 的深链、固定 ID、复制、失败回退、键盘、缩放和隐私已经成立。用户实际体验后的结论是：

- 分享卡片与整个产品的风格一致，这一点应保留；
- 但当前卡片与 dialog 都是同一片白色，只有文字与极细边框，显得过于“苍白”、单一，不像一个值得分享的视觉物件；
- 用户提供了 flomo 与微信读书的分享图作为审美参考，并确认采用高推理模型的建议：**先只重做 CSS 预览，不实现图片导出；卡片不显示书封，只继承该书的 Book Aura 色彩。**

结束时应做到：

1. dialog 背景滚动锁不再偶发失效，关闭后精确恢复原位置与原样式；
2. 分享卡片与浅色 dialog 明确分层，不再是白底中的另一张白纸；
3. 卡片使用被锁定划线所属书籍的真实封面 accent，生成低饱和深色出版卡面与暖色文字；
4. 颜色、原文、出处始终绑定同一个 stable highlight ID，不会随背后舞台变化；
5. 最短 8 字、常规中句、299 字与 398 字真实文本均完整可读、不裁剪；
6. 320/390/720/1440、200% 等价重排、真实 2× 放大、键盘、reduced-motion、public 空态与 privacy 契约继续成立。

这不是新功能扩张：不增加搜索、收藏、模板选择器、图片下载、二维码、头像或统计。

## 2. 开工前必读与真实基线

完整阅读并遵守：

1. `AGENTS.md`
2. `docs/10-PRODUCT-DIRECTION-V2.md`
3. `docs/12-ROOMS-COLOR-MOTION-DIRECTION.md`
4. `docs/11-V2-IMPLEMENTATION-PLAN.md` 的 V2-E / V2-E4
5. `docs/02-TECHNICAL-DESIGN.md §4–7`
6. `docs/05-UX-SPEC.md §8–10`
7. `docs/07-IMPLEMENTATION-HANDOFF.md`
8. `docs/08-REVIEW-CHECKLIST.md` 的 V2-E1/E2/E3 与 V2-E4 交接记录
9. `src/domain/accent.ts`、`src/app/covers.ts`、`src/app/ReadingWorld.tsx`
10. `src/domain/share.ts`、`src/features/share/{useShare,ShareDialog,share.css}`
11. `e2e/{share,zoom,keyboard,privacy,capture-v2e}.spec.ts`

用户提供的参考图已整理到：

```text
.private/reference/share-cards/
├─ README.md
├─ flomo/
└─ weread/
```

可以逐张阅读以理解构图，但这些图：

- 只用于本机设计参考；
- 不复制、裁切、嵌入或作为产品背景；
- 不进入 `src/`、`public/`、Git 或构建产物；
- 不把 flomo 黄色、微信读书固定黑金、头像、二维码或统计照搬进产品。

开工基线（必须自己重跑）：

```text
commit: a8083ef
schema: 2
local-only: 4,663 highlights / 130 books / 14 themes / 127 local covers
stable ids: 20 books + 46 highlights guarded by npm run verify:ids
unit: 171 / 171 (12 files)
Playwright local: 81 tests
Playwright public empty-state: 1 test
public snapshot: empty
```

先运行：

```powershell
git status --short
npm run check:local
npm run verify:ids
npx playwright test
npm run test:public
```

数字必须重跑，不照抄。保护用户已有工作。启动页面不需要 `WEREAD_API_KEY`。

## 3. 验收复核发现：不能忽略的滚动问题

GPT-5.6 Sol 在 `a8083ef` 上独立重跑时得到：

1. 第一次完整 Playwright：**80/81**；失败为 `e2e/share.spec.ts` 的 dialog 背景不滚动断言，滚轮后 `window.scrollY` 从测试假设的 0 变为 210；
2. 该用例单独重复 10 次：10/10；
3. 整个 share spec 重复：50/50；
4. 第二次完整 Playwright：81/81。

这说明它是低频时序/滚动根风险，但已经真实失败过，**不得写成“无法复现所以不处理”**。当前实现只把 `document.body.style.overflow` 设为 `hidden`；文档滚动根可能是 `document.documentElement`，测试也错误地假定打开前必定位于 `scrollY=0`。

修复目标：

- 同时防守 `document.documentElement` 与 `document.body`；
- 保存两者原有 inline style，并在关闭/卸载后原样恢复；
- 保存打开前的实际滚动位置，关闭后不跳到顶部或其他位置；
- dialog 自己仍可滚动，背景不可因 backdrop 上的 wheel/touch 滚动；
- StrictMode setup → cleanup → setup 不留下锁、错误恢复或重复监听；
- 非模态 `showModal` fallback 也能关闭并恢复；
- 测试比较“打开前后实际位置不变”，不要假定初始值一定为 0。

不为此引入 scroll-lock 依赖。

## 4. 已确认、不得再次询问的设计决策

### 4.1 输出范围

本批次只重做页面内 CSS 预览：

- 不下载 PNG；
- 不复制图片；
- 不做 Canvas / SVG 导出；
- 不调用 Web Share；
- 不上传到远程卡片服务；
- 不生成二维码。

图片导出如果未来需要，另作明确产品决定；不要预埋不可测试的半成品按钮。

### 4.2 不显示书封

卡面不放封面缩略图、封面裁切、封面背景或放大的模糊封面。封面只作为**颜色来源**：

```text
locked highlight id
→ locked book
→ locked book coverPath
→ existing local cover sampling
→ muted accent
→ deterministic share palette
```

无封面、图片加载失败或 Canvas 采样失败时使用 `DEFAULT_ACCENT`。不能为缺失封面生成假图或手挑一种新颜色。

### 4.3 不加入的身份与装饰

- 不放头像或用户名 `HenryLiu`；保留低权重 `Henry's Reading World`。
- 不放当前日期：当前日期不是划线日期，会制造错误出处含义。
- 不放“读了 N 天 / N 条笔记”等统计。
- 不放主题标签：主题属于 Book，不给分享的句子贴主题语义。
- 不做多套模板、随机版式或用户模板选择器。
- 不做固定黑金或固定 flomo 黄；每本书的颜色来自真实封面。
- 不做噪点、玻璃、霓虹、通用 AI 渐变、巨大引号或鸡汤海报。

### 4.4 一套 Book Aura 出版卡片

卡片采用一个稳定系统：

- dialog 继续是现有浅色纸张与克制 UI；
- 卡片成为明显独立的**低饱和深色有色纸面**；
- 背景从该书 muted accent 派生，而不是所有书统一纯黑；
- 正文使用暖米白/纸色，不用刺眼纯白；
- 一道细双框、内框或窄“书脊线”建立出版物边界；
- 原文仍是最大视觉中心；
- 书名/作者形成清晰的出处区，并用细线与正文分区；
- 站点名与 `仅本机 · 未公开审核` 保持低权重，不能与出处竞争；
- 4:5 是短/中句默认比例；长文继续自然增高。

目标不是“装饰更多”，而是让卡片具有三个明确层次：

```text
有来源的色域 → 完整原文 → 出处与低权重品牌
```

## 5. 颜色架构与稳定身份

### 5.1 不能直接继承房间 Aura

当前 `.shell` 的 `--aura` 属于房间/当前舞台。分享内容虽然通常与舞台一致，但分享状态的契约是“打开时锁定 ID，背后状态不能改写它”。因此卡片不能只写：

```css
background: var(--aura);
```

否则一旦背后 stage、route 或 Aura 改变，卡片的文字仍是旧句而颜色可能属于新书。

卡片颜色必须通过 `share.state.highlightId` 找到 `sharedHighlight.bookId` 与该书 `coverPath`，独立得到**锁定书籍 accent**。可以在 `ReadingWorld` 或 `ShareDialog` 中复用 `coverUrl` / `useCoverAccent`，但身份链必须可读、可测试。

### 5.2 建议建立纯 palette 函数

建议在 domain 层新增或扩展纯函数，例如：

```ts
type SharePalette = {
  background: string;
  text: string;
  mutedText: string;
  rule: string;
};

function sharePalette(accent: string): SharePalette;
```

要求：

- 输入同一 accent 永远得到同一结果；
- 不使用 RNG、日期、书名 hash 或 theme；
- 派生为深色、低饱和表面，不把 accent 原样当大面积背景；
- 主文字与背景对比度至少 WCAG AA（≥4.5:1）；
- 出处、品牌和徽标也至少 4.5:1，不能因为“低权重”而不可读；
- 无法解析的颜色安全回退到 `DEFAULT_ACCENT` palette；
- 不依赖 CSS `color-mix()` 才能正确显示；关键颜色由可单测的 TypeScript 计算。

可复用 `src/domain/accent.ts` 的 RGB、luminance、contrast 能力；不要复制另一套不一致的颜色数学。若需要公开 hex 解析/HSL 转换，补纯函数与测试。

### 5.3 颜色到达与 reduced-motion

- 颜色加载完成后允许一次克制的 background-color 过渡，但不能让文字先在低对比背景上出现；
- 卡片不做位移、翻转或永久呼吸；
- `prefers-reduced-motion: reduce` 时颜色直接准确到位，无长过渡；
- 同一 locked ID 的重渲染不得造成闪回默认绿；
- 关闭后重新分享另一条，才允许锁定新的书籍色。

## 6. V2-E4A — dialog 滚动锁可靠性

### 6.1 实现

优先做成一个职责明确、可清理的 hook/helper，避免继续把多个 document style 操作堆在 `ShareDialog` effect 中。要求：

- 记录 `html` / `body` 的原始 inline overflow、overscroll 或实现所需的 position/top/width；
- 锁定期间 backdrop wheel 不改变 `window.scrollX/Y`；
- dialog 内滚动仍可到达 398 字卡片与关闭按钮；
- 关闭、Esc、按钮关闭、组件卸载与非模态 fallback 都精确恢复；
- 多次开关不积累负 top、不跳动、不遗留 `overflow:hidden`；
- 不改变房间自己的 scroll memory 语义。

### 6.2 必测

- 从真实的非零页面滚动位置打开 dialog，backdrop wheel 后位置不变；关闭后仍是原位置；
- 从顶部打开同样成立；
- 720×450 dialog 内部可滚动到关闭按钮，背景仍不动；
- 连续打开/关闭至少 5 次，无锁残留；
- Esc 与按钮关闭都恢复触发器焦点和原滚动位置；
- `showModal` 不存在的 fallback 恢复正确；
- 该测试至少做一轮 `--repeat-each=10`，并在 `docs/08` 记录。

通过后更新 `docs/08`，commit：

```text
V2-E4A: harden dialog scroll locking
```

然后直接进入 E4B。

## 7. V2-E4B — Book Aura 出版卡片

### 7.1 结构

可以调整 `ShareDialog.tsx` 中卡片内部语义结构与 `share.css`，但保留：

- 一个 `<blockquote>`，原文逐字不变；
- 清晰的 `<cite>` / 书名 / 作者出处；
- 站点名；
- local-only 徽标；
- `data-testid=share-card/share-card-text` 与已有锁定 ID 测试，或同步更新测试而不降低覆盖。

禁止将文本转成图片或 canvas 才能显示；DOM/CSS 仍是可访问预览。

### 7.2 长度策略

真实快照当前边界：

- 最短：8 个非空白字符；
- 中句：测试从真实快照动态寻找；
- 299 字开局样本；
- 最长：398 字。

不要把具体 ID 写进业务逻辑。短/中句：

- 默认约 4:5；
- 留白可以存在，但应被色域、边框与出处结构组织，不再像空白文档。

299/398 字：

- 卡片自然增高；
- 保持可读字号和行距；
- `长文预览已延长比例` 继续由实际渲染高度决定；
- 不 line-clamp、不省略、不内部滚动卡片、不无限缩字。

### 7.3 真实色彩覆盖

E2E 至少从真实快照选择 6 本有封面的书，要求：

- 分享卡片计算背景至少出现 4 个明显不同的最终色值；
- 每张颜色属于对应 locked book；
- 任一 dialog 后台状态变化都不改变已锁卡片的 `data-highlight-id`、文本、出处和背景色；
- 无封面书/封面请求失败时使用同一默认 palette，卡片仍完整；
- 不请求外部 CDN，仍只走 `__local_cover`。

### 7.4 视觉截图

新建独立证据目录，不覆盖 V2-E 历史截图：

```text
.private/review/v2-e4/
```

建议新增 `npm run capture:v2e4`。至少生成：

- `share-dialog-1440.png`
- `share-dialog-390.png`
- `card-shortest.png`
- `card-medium.png`
- `card-299.png`
- `card-longest.png`
- `card-aura-1.png`、`card-aura-2.png`、`card-aura-3.png`（来自三本真实不同封面）
- `zoom-200-dialog.png`
- `clipboard-failure-1440.png`
- `reduced-motion-1440.png`

截图必须等待真实封面 accent 与 CSS 动画稳定；复用 V2-E3 已建立的 `document.getAnimations()` / `animations:'disabled'` 方法，不能拍到默认色或入场透明态后误判完成。

通过后更新 `docs/08`，commit：

```text
V2-E4B: book-aura editorial share cards
```

然后直接进入 E4C。

## 8. V2-E4C — 最终 Gate

### 8.1 浏览器路径

在 Chromium 实际验证：

- hall / theme / book 顶部三个分享入口；
- 深链 `/?h=` 打开 → 分享，卡片文字/出处/颜色都属于该 ID；
- 打开分享后尝试后台换句/导航，锁定内容与 palette 不漂移；
- Clipboard 成功与失败 fallback；
- 320×800、390×844、720×450、1440×900；
- 200% 等价重排与真实 2× 放大；
- Tab / Shift+Tab / Enter / Space / Esc；
- reduced-motion；
- 最短/中/299/398 字；
- 无封面与封面加载失败。

### 8.2 Network / privacy

继续证明：

- 没有 flomo / 微信读书图片进入产品请求；
- 没有远程字体、分析、卡片服务、上传或 `navigator.share`；
- public dist 不含参考图、真实封面、真实书名/划线、账号字段或凭证；
- `.private/reference/share-cards` 不可通过 HTTP 读取；
- local-private production build 继续拒绝；
- public empty snapshot 的每个房间仍诚实。

### 8.3 文档

更新：

- `docs/08-REVIEW-CHECKLIST.md`：三个阶段的实际命令、数字、截图、未验证项与偏差；
- `README.md`：新增/更新 `capture:v2e4` 与当前分享卡片说明；
- `docs/07` / `docs/11`：将 V2-E4 标记完成，下一步恢复为 Public Release Gate；
- `docs/16`：完成后标记为已执行历史 Prompt。

真机与 Safari 如果仍不可用，继续明确写未验证，不能用 Chromium 模拟冒充。

## 9. 最终全批次验证

实际运行：

```powershell
npm run check:local
npm run verify:ids
npm run smoke:local
npx playwright test
npm run test:public
npm run capture:review
npm run capture:v2e
npm run capture:v2e4
npm run build
npx vite build --mode local-private   # 必须拒绝
```

额外运行：

```powershell
npx playwright test e2e/share.spec.ts --repeat-each=5
# 滚动锁对应的精确用例至少 --repeat-each=10
```

并检查：

- `git diff --check`、Markdown 本地链接、尾随空白、工作区；
- 测试总数不能靠删除旧测试下降；
- public dist 文件清单与真实内容/参考图/敏感字符串探针；
- 卡片主文字、出处、品牌的实际对比度；
- 参考图仍只在 `.private/reference/share-cards/`；
- 不修改 `.private/local-snapshot.json`、主题、稳定 ID、public snapshot 或发布状态；
- 不部署、不 push。

## 10. 暂停并升级的条件

只有以下情况才暂停询问用户/高推理模型：

1. 必须实现图片导出、二维码、头像、日期、统计或模板选择器才能完成设计；
2. 必须展示真实封面图片，而非只用其颜色；
3. 卡片大面积 Book Aura 与可读性无法同时满足；
4. 修复滚动锁会改变房间 scroll memory / Back 语义；
5. 需要新增运行时依赖；
6. 需要修改稳定 ID、快照、主题或发布边界；
7. 需要部署、上传、push 或其他不可逆外部行为。

常规 CSS、palette 数学、测试结构与组件拆分不要反复询问。

## 11. 最终统一汇报

全部完成后一次性汇报：

1. V2-E4A/B/C commits；
2. 滚动锁根因、修复结构与重复测试结果；
3. 卡片 palette 如何从 locked highlight → locked book → cover accent 派生；
4. 为什么不会随后台 Aura 漂移；
5. 8/中/299/398 字与无封面策略；
6. 三个以上真实 Book Aura 卡片截图路径；
7. 320/390/720/1440、200%、键盘、reduced-motion 证据；
8. unit/E2E/build/privacy/network 的实际结果；
9. Safari/真机未验证项；
10. 与本 Prompt 的偏差；
11. 下一阶段仍仅为 Public Release Gate，未部署、未 push、未生成 public snapshot。
