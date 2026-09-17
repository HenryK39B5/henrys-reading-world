# 17 — 公开发布方向与 Release-A 发布审核系统

> 日期：2026-09-13
>
> 状态：**Release-A 已实现并验收**（V2-E4E → 有限随机书籍轮 → 发布清单与本机审核器 → 私有 preview 与隔离 Gate）。执行记录见 `docs/08` 的 Release-A1～A4 四节。
>
> 本文件是 Public Release 阶段的产品与数据权威。它不自动授权生成正式 public snapshot、创建 GitHub 仓库、push 或部署；这些外部动作仍须在 Release-D / Release-E 由用户明确批准。
>
> 用户已于 2026-09-17 完成两轮公开审核：私有清单为 108 本公开、22 本排除、6 条单独排除，`reviewComplete=true`；About 已补充原文语境说明，四本外部导入记录使用私有 metadata override 清洗展示信息。下一步才讨论 Release-B。
>
> 既有轻松漫游、公平抽样、主题属于 Book、稳定 ID、Book Aura、隐私隔离继续成立。与 `docs/11` 的“单书顺序列表”冲突时，本文件的新书籍房间决定优先。

## 1. 已确认的发布目标

用户确认：

1. GitHub Pages 使用项目站点：`https://henryk39b5.github.io/henrys-reading-world/`；现有 Blogverse 根站继续位于 `https://henryk39b5.github.io/`，两者独立。
2. GitHub repository 使用 public（GitHub Free）；仓库名计划为 `henrys-reading-world`。
3. 公开审核以**书籍**为主要单位，降低 130 本 / 4,663 条数据的维护成本。
4. 仍保留可选的**单条划线排除**能力，处理少数敏感、过长、上下文依赖或用户不愿公开的内容；第一版不做 `selected-only` 白名单模式。
5. 公开书籍的封面默认允许公开，但必须能逐书关闭；未批准书籍的封面绝不能单独进入构建。
6. 第一版对全部 130 本进行一次系统审核；未审核不等于公开。
7. 第一版使用手动 GitHub Actions 部署；Release-A 不创建 workflow、不 push、不部署。

## 2. 必须先澄清：随机显示不等于没有公开

用户提出：书籍页面不再展示完整划线列表，而是一次随机显示一句；首轮所有句子不重复，全部出现后提示“已经全部看过一遍”。这个方向在产品上成立：它更轻、更像 Reading World，也避免书籍房间变成摘录墙。

但在 GitHub Pages 静态站中，选择器要在浏览器里随机访问一句，就必须先把候选文字随 public snapshot / JS / JSON 下载到浏览器；public repository 中的 public snapshot 也可直接阅读。因此：

- 去掉完整列表会降低视觉密度和整页复制的便利性；
- **不会降低 public snapshot 实际发布的文字总量**；
- “首轮不重复”仍允许访客逐句遍历全部公开划线；
- 版权与隐私审核必须按真正进入 public snapshot 的全部内容计算，不能按首屏只显示一句计算。

美国版权局也没有“低于固定字数即安全”的规则；fair use 是逐案、结合用途、作品性质、使用量与市场影响判断。本项目只在工程上暴露风险，不由程序宣告某条引用合法或非法。

## 3. 新的书籍房间：有限随机漫游

### 3.1 访客产品行为

书籍房间从：

```text
一处随机划线 + 分批顺序列表
```

调整为：

```text
书籍信息 + 一处随机划线 + 本轮进度 + 再看一处
```

消费者页面（local 阅读体验与 future public 页面）都使用同一套随机书籍房间，避免两套访客产品漂移。完整列表只存在于本机**发布审核器**中，用于审核，不属于消费者网站。

### 3.2 本轮与完成状态

- 进入一本书时显示一条真实划线，并把它计入本书当前轮次；
- `再看一处` 只在该书当前可用划线中选择未见条目；
- 首轮所有条目出现前绝不重复；候选按稳定 highlight ID 排序后使用可注入 RNG；
- 显示 `本轮已看 X / N`，不是平台阅读进度；
- 最后一条出现后显示：`这本书收录的 N 处划线已经看过一遍了`；
- 不自动偷偷重置；提供明确的 `重新看一轮`，用户触发后才清空本书轮次并公平开局；
- 单条书：进入即完成本轮，仍可查看出处与分享；
- 空书不应出现在有效快照；错误数据由 validator 拒绝；
- 离开再返回同一本书，当前句与本轮进度在当前文档会话中恢复；刷新可以从新轮开始，不引入 localStorage、账号或跨设备同步。

### 3.3 年份与返回

年份仍是 `/books` 书库的筛选工具。书籍房间不再有顺序列表，因此：

- 从筛选后的书库进入一本书时，书籍房间显示该书全部公开/本机可用划线的随机轮次，不按 year 缩小；
- 浏览器 Back 返回书库后，原年份筛选、批次与滚动位置继续恢复；
- 新生成的书籍链接不携带 `?year=`；既有带 year 的地址应规范化移除 year 或兼容读取后 replace 清除；
- 分享仍是规范门厅链接 `/?h=<stableHighlightId>`，项目站点 base 在 Release-C 接入。

### 3.4 与 V2-D 的关系

V2-D 的“4,663 条全部可达”继续成立，但可达证明从“单书批次列表最终走到底”迁移为：

```text
每本书有限随机轮在 reset 前遍历全部候选且 0 重复
```

删除列表测试不等于降低覆盖；必须以纯函数性质、真实最大书 531 条的确定性遍历和浏览器小样本旅程替代。

## 4. 发布权限模型：书级为主，单条排除为例外

### 4.1 私有策略文件

新增仅本机文件：

```text
.private/curation/publication-policy.json
```

建议契约：

```ts
type PublicationPolicy = {
  schemaVersion: 1;
  target: {
    repository: 'henrys-reading-world';
    basePath: '/henrys-reading-world/';
  };
  reviewComplete: boolean;
  books: Record<BookId, BookPublicationDecision>;
};

type BookPublicationDecision = {
  decision: 'unreviewed' | 'publish' | 'exclude';
  cover: 'publish' | 'exclude';
  excludedHighlightIds: string[];
  note?: string; // 本机审核备注，不进入 public snapshot
};
```

### 4.2 默认拒绝

- 不在 policy 中，或 `decision=unreviewed`：不允许正式导出；
- `decision=exclude`：书名、作者、描述、主题引用、全部划线、封面、静态路径和统计全部排除；
- `decision=publish`：默认允许该书划线，减去 `excludedHighlightIds`；
- 排除的 highlight ID 永久保留，不复用；已发布后撤回时旧深链落入“这条划线暂不可用”；
- `reviewComplete=true` 只允许在 130 本全部有明确 `publish/exclude` 决定后保存/导出；
- policy 只使用项目稳定 ID，不保存原始微信 bookId / bookmarkId、账号、secret 状态或凭证。

### 4.3 封面

- `decision=publish` 的书默认 `cover=publish`，符合用户当前决定；
- 审核器保留逐书 `不公开封面`；
- `decision=exclude` 时 `cover` 必须有效等价为 exclude，不得产生孤立封面；
- Release-A 只记录封面决定；Release-B 才从 `.private/covers/` 生成低分辨率 public 缩略图；不直接复制原始开发封面；
- 无封面或关闭封面继续使用真实书名回退与 `DEFAULT_ACCENT`。

### 4.4 单条排除

- 默认折叠在书级决定下，避免把日常审核变成 4,663 个 checkbox；
- 只允许排除属于该 bookId 的 stable highlight ID；
- 不允许通过删除文字、改写原文、截断段落来“变得可公开”；要么完整公开，要么整条排除；
- 第一版不支持“只选少数条”的 selected-only 模式；如果系统审核发现大量书需要逐条挑选，再升级契约，不提前增加复杂度。

## 5. 本机发布审核器

### 5.1 边界

审核器是本机出版工具，不是公众网站管理员后台：

- 只在 `127.0.0.1` 的显式本机命令运行；
- 不进入 public snapshot、生产 JS 或 Pages artifact；
- 不需要 `WEREAD_API_KEY`，只读最小化 local snapshot；
- policy 保存到 `.private/curation/`；
- 不部署登录、账号、角色、数据库、云同步或远程审核服务。

建议命令：

```powershell
npm run publication:review
```

### 5.2 书籍总览

每本展示：

- 书名、作者、主题；
- 划线数、累计非空白字符数、最长单条字符数；
- ≥200 字的条数（风险提示，不是法律结论）；
- 是否有本地封面、封面公开开关；
- `未审核 / 公开 / 排除`；
- `查看并排除个别划线`（高级折叠）；
- 私有 note；
- 审核进度。

统计：

```text
已审核 X / 130
公开 X 本 / 排除 X 本 / 未审核 X 本
预计公开 X 条划线 / X 字符
公开封面 X 张
单条排除 X 条
长引用待复核 X 条
```

### 5.3 单书审核

展开后按稳定 ID 显示该书完整真实划线供**本机审核**；可以按年份、长度和 stable ID排序，但不做质量评分、AI 判断、embedding 或自动内容决策。

每条提供：

- stable ID；
- 原文；
- 年份；
- 非空白字符数；
- `排除这条` 开关。

审核器可以提供搜索/筛选，因为它是本机管理工具，不是消费者产品；消费者网站继续没有搜索。

### 5.4 保存安全

若用本机 HTTP 写 policy：

- 只在显式 `publication:review` 模式启用；
- 绑定 `127.0.0.1`，固定 origin；
- 只接受 `application/json` 和同源请求，拒绝跨源；
- body 大小上限；
- 严格校验所有 stable ID、枚举和引用；
- 临时文件 + rename 原子替换；
- 错误日志不打印划线全文；
- public `dev/build/preview` 不存在该写接口。

实现者也可选择同等安全、可测试的独立本机 review server；不能把写接口堆进普通 public Vite 模式。

## 6. Preview 与正式导出分离

Release-A 只生成私有预览：

```text
.private/publication-preview-snapshot.json
.private/publication-audit.json
```

建议命令：

```powershell
npm run publication:preview
```

它应：

- 根据 policy 过滤 local snapshot；
- 重新计算 books / highlights / themes 与所有计数；
- 不复制公开封面，只报告计划；
- 报告 unreviewed、excluded book、excluded highlight、长引用、累计字符、孤立引用；
- 输出 `visibility=local-only` 或专用 preview 标记，绝不能被普通 build 读取；
- 不写 `src/data/public-snapshot.json`。

Release-B 才新增正式：

```powershell
npm run publication:export
```

正式导出必须要求：

- `reviewComplete=true`；
- 未审核书籍 0；
- policy 与 local snapshot stable ID 对齐；
- 用户已完成最终 review；
- public snapshot、封面与 Pages 产物经过反向泄漏探针。

## 7. Release-A 同时完成 V2-E4E

用户澄清：之前说“作者后紧接 Henry's Reading World”指的是**复制文字的纯文本**，不是 CSS 卡片预览。当前 `shareText()` 仍为：

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

更新纯函数、单测、Clipboard 成功/失败 E2E 与 docs/08。E4D 的卡片页脚分层保留，它是有效的额外视觉改进；但历史记录应追加澄清，不能继续声称 E4D 已解决用户原始的复制文本反馈。

## 8. GitHub Pages 决策（Release-C 才实现）

已确认目标：

```text
repository: henrys-reading-world (public)
basePath: /henrys-reading-world/
site: https://henryk39b5.github.io/henrys-reading-world/
```

Release-A 不实现 Pages，但所有 URL/导出设计必须为 base-aware 留边界。Release-C 将处理：

- Vite `base`；
- router 在项目 base 下解析与生成路径；
- 分享绝对 URL；
- public cover 路径；
- `/books`、公开 book ID、`/themes`、公开 theme ID、`/about` 的静态入口；
- `404.html`；
- public repo Git 历史与 artifact 扫描；
- GitHub Pages Actions（第一版 `workflow_dispatch` 手动触发）；
- 真实公网验证。

GitHub Pages 官方支持 public repository + GitHub Free，并支持自定义 Actions workflow 构建静态站。实际部署、push 和 GitHub 设置仍需用户再次明确授权。

## 9. 系统审核流程

### 第 1 轮：130 本书级决定

逐书 `publish / exclude`，封面默认 publish 可关闭。允许暂存，未审核不会误公开。

### 第 2 轮：风险聚合

只复核公开书中的：

- ≥200 字；
- 每本最长若干条；
- 累计公开字符特别高的书；
- 用户主动认为敏感的书；
- 缺失或异常元数据。

提供排除开关，不自动决定。

### 第 3 轮：主题与范围

从公开书重新计算 14 个书架：空书架移除，计数只描述公开内容。用户集中复核主题标题和公开归类。

### 第 4 轮：私有 public preview

用户以未来访客视角完整走一遍：门厅、主题、书库、随机书籍房间、分享、撤回深链、封面回退。

### 第 5 轮：批准 Release-B

用户确认范围后才生成正式 public snapshot 与 public covers。

## 10. Release-A 明确非目标

- 不生成正式 public snapshot；
- 不复制封面到 `public/`；
- 不创建 GitHub repository；
- 不 push、deploy 或修改 Blogverse；
- 不实现 Pages workflow / base path / static route entry（留 Release-C）；
- 不增加消费者搜索、收藏、自动播放、账号、登录、analytics、评论或推荐系统；
- 不由程序自动判断版权、隐私或“安全可公开”；
- 不修改稳定 ID、主题含义或微信读书原始缓存。

## 11. Release-A 完成标准

1. V2-E4E 复制文本修正并回归；
2. 书籍房间成为有限、无重复随机轮，完成态与显式重开成立；
3. 真实最大书 531 条在纯函数/脚本中一轮 531/531、0 重复；
4. local 房间返回记住当前句和进度；刷新重开一轮；
5. 顺序列表和 book batch 不再进入消费者 DOM；4,663 条仍可由每书轮次到达；
6. publication policy 默认拒绝、严格校验、逐书封面、单条排除成立；
7. 本机审核器可完成 130 本保存、恢复与进度统计；
8. publication preview 只写 `.private`，正式 public snapshot 仍为空；
9. public build 无审核器、policy、local snapshot、原文或私有路径；
10. 320/390/720/1440、键盘、200%、reduced-motion、分享与隐私回归；
11. Safari/真机如果不可用继续明确未验证；
12. 每阶段更新 docs/08 并独立 commit；全部 Gate 后统一汇报。
