# 18 — Release-A 发布审核系统 Continuous Implementer Prompt

> 状态：**下一批唯一开工提示词**。
>
> 日期：2026-09-13。
>
> 产品与数据权威：`docs/17-PUBLICATION-DIRECTION-AND-RELEASE-A.md`。
>
> 执行顺序：**A1 V2-E4E 复制文本 → A2 书籍有限随机轮 → A3 publication policy + 本机审核器 → A4 私有 preview 与工程 Gate**。
>
> 每阶段测试、更新 `docs/08`、本地 commit；Gate 通过后连续进入下一阶段。全部结束后一次汇报。**不生成正式 public snapshot、不复制 public covers、不创建 GitHub repo、不 push、不部署。**

## 1. 角色与目标

你是 Henry's Reading World 的实现 Agent，在 `E:\Desktop\henrys-reading-world` 中完成 Release-A。

用户已确认公开方向：

- GitHub Pages project site：`henryk39b5.github.io/henrys-reading-world/`；
- repo 未来为 public；本批不创建；
- 全部 130 本做系统审核；
- 书籍是主要权限单位；
- 公开书默认包含自己的划线，但可以排除个别 stable highlight ID；
- 公开书封面默认公开，但可逐书关闭；
- 消费者书籍房间不再展示完整列表，改为有限随机轮；
- 随机 UI **不是**版权过滤：policy / audit 仍按进入预览的全部文字计算。

结束时应有一个可在本机完成 130 本审核、保存决定并生成私有发布预览的工具，但 `src/data/public-snapshot.json` 必须仍为空。

## 2. 开工前必读

完整阅读：

1. `AGENTS.md`
2. `docs/17-PUBLICATION-DIRECTION-AND-RELEASE-A.md`
3. `docs/10-PRODUCT-DIRECTION-V2.md`
4. `docs/12-ROOMS-COLOR-MOTION-DIRECTION.md`
5. `docs/11-V2-IMPLEMENTATION-PLAN.md` 的 Book Room / V2-D / V2-E
6. `docs/02-TECHNICAL-DESIGN.md §3–7`
7. `docs/03-DATA-CONTRACT.md`
8. `docs/09-WEREAD-DATA-WORKFLOW.md §6–8`
9. `docs/07-IMPLEMENTATION-HANDOFF.md`
10. `docs/08` 的 V2-D、V2-E2、V2-E4D 与 PUB-01～07
11. `src/domain/{types,snapshot,validate,discovery,encounter,share}.ts`
12. `src/features/rooms/{BookRoom,useBookRoom,useBatches}.ts*`
13. `vite.config.ts` 与现有 privacy tests

开工先跑并记录，不照抄：

```powershell
git status --short
npm run check:local
npm run verify:ids
npm run smoke:local
npx playwright test
npm run test:public
npm run build
npx vite build --mode local-private # 必须拒绝
```

当前预期基线（仅供核对）：`3f4a7df`；195 单测 / 15 文件；100 local E2E；1 public。工作区应干净。

## 3. A1 — V2-E4E 复制文本来源分层

### 3.1 修正真实误解

用户原反馈指 `复制文字` 的纯文本，不是 CSS 卡片。当前：

```text
原文

——《书名》作者
Henry's Reading World
```

改为：

```text
原文

——《书名》作者

来自 Henry's Reading World
```

要求：

- 只修改 `shareText()` 的格式及精确单测/E2E；
- 原文逐字不变，保留原换行；
- 缺书/作者回退仍成立；
- Windows Clipboard `\r\n` 归一化测试继续正确；
- 失败 textarea 显示同一新格式；
- E4D 卡片 imprint 分层保留，不回退；
- 在 docs/08 追加澄清：E4D 修了有效的卡片视觉，但误解了用户原反馈。

测试后 commit：

```text
V2-E4E: separate copied source from site provenance
```

## 4. A2 — 书籍房间有限随机轮

### 4.1 产品结构

消费者 `BookRoom` 删除：

- 顺序划线列表；
- `显示 X / N` batch；
- `继续显示`；
- 单书年份筛选；
- 以数组下标为身份的任何路径。

保留/形成：

- 封面/真实书名/作者/主题/总收录数；
- 一处当前随机划线；
- 出处/年份（若当前条有）；
- `再看一处`；
- `本轮已看 X / N`；
- 分享当前视觉中心；
- 完成提示和显式 `重新看一轮`；
- 返回上一处与房间记忆。

完整列表只进入 A3 的本机审核器，不再进入消费者 DOM。

### 4.2 状态与算法

建立独立于 React 的纯 book-cycle 模型，可复用 discovery 的稳定排序/注入 RNG，但不要为一页列表继续保存 batch：

```ts
type BookWalkState = {
  currentId: string | null;
  seenIds: string[];
  complete: boolean;
  cycle: number;
};
```

不要求逐字照用此类型，但性质必须成立：

- 第一句计入 seen；
- `NEXT_BOOK_PASSAGE` 从本书未见 highlight 均匀选择；
- N 条内前 N 次恰好覆盖 N 个 stable ID，0 重复；
- 第 N 条后不自动 reset，按钮切为明确完成态；
- `RESTART_BOOK_WALK` 由用户触发，cycle +1，重新公平选一句；
- 所有随机注入 RNG；候选 stable ID 排序；
- 单条书稳定完成；
- 当前文档会话返回同书恢复 current/seen/complete；刷新可重新开一轮；
- 不用 localStorage、数据库或远程状态。

### 4.3 年份与 URL

- `/books` 年份筛选继续；
- 从筛选书库进入 book 时不再携带 `?year=`；Back 仍回原筛选 URL 和现场；
- 旧 `/books/:id?year=` 规范化为无 year 的 book URL（replace，不新增历史）；
- 更新 router tests、房间 tests 与 docs；
- 主题/书籍筛选的同级稳定排序不变。

### 4.4 可达性测试

- 纯函数构造边界：空（拒绝/错误）、1、2、N；
- 真实最大书 531 条：固定 RNG 一轮 531/531、重复 0、complete 只在最后成立；不打印原文；
- 全部 130 本：每书一轮可覆盖其全部 highlight ID，总并集 = local snapshot 4,663；
- 浏览器用真实小书走完一轮并看到提示，重开后进入新轮；
- 返回恢复进度；刷新重开；
- 列表节点、batch 控件与数百 passage DOM 不存在；
- 320/390/720/1440、键盘、200%、reduced-motion、分享继续成立。

更新 docs/08 后 commit：

```text
Release-A1: finite no-repeat book walks
```

## 5. A3 — publication policy 与本机审核器

### 5.1 Domain contract

新增纯领域模块（建议 `src/domain/publication.ts`，若审核器单独构建也可放共享 `publication/` 目录）：

- `PublicationPolicy` / `BookPublicationDecision` 类型；
- `initialPublicationPolicy(snapshot)`：130 本全部 `unreviewed`，cover 默认 `publish`，单条排除空；
- `validatePublicationPolicy(policy, snapshot)`；
- `publicationSummary(policy, snapshot)`；
- `projectPublicationPreview(policy, snapshot)`（纯过滤与重算）；
- 书级决定、cover toggle、highlight exclude 的 reducer/helper；
- 所有 ID 按 stable ID 排序，结果确定性；
- 错误只打印 ID/字段，不打印完整原文。

硬校验：

- schema/target 固定；
- policy book IDs 与 snapshot 对齐（新增/缺失书明确提示）；
- `excludedHighlightIds` 存在、属于该书、无重复；
- exclude 书不会产生 public cover/highlight；
- `reviewComplete=true` 时 unreviewed 必须 0；
- 不允许额外字段、原始 API ID、URL、账号或 secret 字段；
- filtered themes 只保留仍有公开书的书架，Book.themeIds 不悬空；
- preview 中每本书至少一条未排除 highlight，否则要求整本 exclude 或阻止 preview。

### 5.2 私有文件与初始化

新增命令，例如：

```powershell
npm run publication:init
```

- 文件不存在时生成 `.private/curation/publication-policy.json`；
- 已存在时不覆盖；
- 新增书只追加 unreviewed；已有决定不变；
- 删除/失效书产生明确 migration warning，不静默丢决定；
- 不打印书名/原文到终端，输出数量与路径即可。

### 5.3 审核器实现

实现一个与消费者生产入口分离的本机审核 workspace。允许实现者在以下两种结构中选更小且可测试的一种：

A. 独立 local review server + 独立 HTML/React entry；
B. 只有显式 review mode 才注入的独立页面与受控 middleware。

无论哪种：

- 普通 `dev`、`build`、`preview` 不注册 policy 读写接口；
- production bundle 不包含审核器 entry；
- 只绑定 `127.0.0.1`；
- 不引入数据库、登录或新 UI 框架；
- 无需 `WEREAD_API_KEY`；
- 原生语义、键盘、320/390 宽度可用；
- 可以在审核工具里搜索/筛选（消费者网站禁搜索不适用于管理工具）。

建议命令：

```powershell
npm run publication:review
```

功能：

- 全部 130 本与总进度；
- `unreviewed/publish/exclude`；
- 封面开关；
- 书名、作者、主题、highlight count、累计字符、最长字符、≥200 字条数；
- 展开单书完整真实划线；
- 按年份/长度/ID 排序或筛选；
- 单条 exclude；
- 私有 note；
- 保存/重载后决定不漂移；
- reviewComplete 在有 unreviewed 时不可打开或保存失败说明。

### 5.4 本机写接口安全（如使用）

- 只接受同源 `application/json`；
- 严格 Origin（127.0.0.1 + 实际 review 端口）；
- 非 GET/PUT 方法 405；
- body 上限；
- validator 在写前运行；
- 临时文件 + rename 原子替换；
- `Cache-Control: no-store`；
- 请求路径固定，不接受文件名参数；
- 关闭 server 后无接口；
- privacy E2E 直接证明 public/local normal server 不可读取 policy。

测试、docs/08 后 commit：

```text
Release-A2: local book-first publication review
```

## 6. A4 — 私有 publication preview 与最终 Gate

### 6.1 Preview 命令

新增：

```powershell
npm run publication:preview
```

输入：local snapshot + publication policy。

输出只到：

```text
.private/publication-preview-snapshot.json
.private/publication-audit.json
```

要求：

- preview 不写 `src/data/public-snapshot.json`；
- 不复制到 `public/`；
- visibility 不伪称 public；
- 重新计算 books/highlights/themes、themeIds 与计数；
- excluded 书籍和 highlight 完全不存在；
- audit 只写 ID、数量、长度与状态，不复制被排除全文；
- review 未完成时允许生成“工作预览”，但 audit 明确 `releaseReady=false`；
- `releaseReady=true` 只在 0 unreviewed、引用完整、至少一条公开内容、所有决策合法时成立；
- 无 decision 的书默认排除，永不默认公开。

### 6.2 隔离 Gate

必须证明：

- `src/data/public-snapshot.json` 仍是 schema 2 public 空快照；
- public build 不含 policy、review notes、review UI、local snapshot、被排除/未审核内容；
- review 写接口在普通 local server 与 production 不存在；
- `.private` / `@fs` / 编码路径不可读；
- local-private production build 继续拒绝；
- 没有新增 remote request、analytics、字体 CDN 或 Web Share；
- Git status 不含 `.private`；
- 没有 GitHub workflow、remote、push 或 deploy。

### 6.3 证据

新增私有证据目录：

```text
.private/review/release-a/
```

至少：

- review-overview-1440.png
- review-overview-390.png
- review-book-open-1440.png
- review-highlight-excluded.png
- review-progress-mixed.png
- book-walk-1440.png
- book-walk-390.png
- book-walk-complete.png
- book-walk-restarted.png
- clipboard-provenance.png

截图使用真实数据；不得把 policy、note 或原文传出本机。页面动画结束后再截图。

## 7. 最终命令

实际运行并记录：

```powershell
npm run check:local
npm run verify:ids
npm run smoke:local
npx playwright test
npm run test:public
npm run publication:init   # 第二次必须不覆盖已有策略
npm run publication:preview
# review server 对应 unit/integration/e2e
npm run capture:review
npm run capture:v2e
npm run capture:v2e4
npm run build
npx vite build --mode local-private # 必须拒绝
git diff --check
```

额外：

- Markdown 本地链接与尾随空白；
- public dist 文件清单与真实内容、policy、review note、参考图、凭证探针；
- 全部 130 本 policy 覆盖与 4,663 ID 投影性质；
- 最大书 531 的有限轮；
- 书籍消费者 DOM 不含顺序列表；
- 320/390/720/1440、200%、键盘、reduced-motion；
- Safari/真机未验证时诚实记录。

## 8. 测试数据规则

- UI、截图、真实数量与遍历使用 `.private/local-snapshot.json`；
- 不造假书、假作者、假划线、作者或年份；
- policy validator 的错误测试可从真实 policy/ID 删除字段或制造悬空引用，但不得进入正常 UI/截图；
- 不在测试日志打印整段真实原文；
- 不通过删测试降低数量；书籍列表旧测试要被随机轮性质测试替代。

## 9. 暂停并升级条件

仅在以下情况暂停：

1. 用户必须逐条 include 而非单条 exclude 才能完成审核；
2. 随机书籍房间与返回记忆、分享固定 ID 无法同时成立；
3. 本机 policy 保存必须引入数据库或远程服务；
4. 需要修改稳定 ID、原始快照或主题含义；
5. 需要生成正式 public snapshot / public covers；
6. 需要创建 repo、设置 remote、push、GitHub Actions 或部署；
7. 需要自动判定版权/隐私；
8. 需要访问 Blogverse workspace 或修改现有博客（本批禁止）。

## 10. Commit 顺序

1. `V2-E4E: separate copied source from site provenance`
2. `Release-A1: finite no-repeat book walks`
3. `Release-A2: local book-first publication review`
4. `Release-A3: private publication preview and release-a gates`

每个 commit 前更新 docs/08 并跑该阶段测试。全部 Gate 通过后一次汇报：

- 四个 commit；
- 用户反馈如何准确修正；
- 随机书籍房间的完成/重开/返回语义；
- 为什么随机 UI 不等于版权过滤；
- policy contract 与默认拒绝；
- 封面逐书关闭；
- 单条排除；
- review UI 安全边界；
- preview/audit 数字；
- 最大书 531 与全部 4,663 可达证据；
- unit/E2E/build/privacy 数字；
- Safari/真机未验证；
- 正式 public snapshot 仍为空；
- 未创建 repo、未 push、未部署；
- 下一步是用户实际完成 130 本审核，然后决定 Release-B。
