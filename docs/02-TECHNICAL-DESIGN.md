# 02 — 技术与工程设计

## 1. 栈与命令

React + TypeScript strict + Vite + 原生 CSS。单页、无 router、无后端、无全局状态库。测试用 Vitest、Testing Library、Playwright；可用 axe 检查可访问性。不要引入 UI 套件、动画库或运行时推荐服务。

首次安装选择兼容的稳定版本，保存 `package-lock.json`，README 记录实际版本。

| npm script | 必须做什么 |
| --- | --- |
| `dev` | 仅监听 `127.0.0.1` 的 Vite |
| `dev:local` | 当前施工使用：已授权全部书籍的真实数据，本机私有模式 |
| `typecheck` | `tsc --noEmit` 或等效项目引用检查 |
| `lint` | ESLint，含 hooks / a11y 基础规则 |
| `test` | Vitest 非 watch 单次执行 |
| `validate:data` | 验证公开快照结构、引用、字段白名单 |
| `build` | 数据校验 + 类型检查 + Vite build，只接受 public 模式 |
| `check` | public 路径：typecheck + lint + test + validate:data + build |
| `validate:data:local` | 校验 `.private/local-snapshot.json` 的结构、引用与 local-only 权限 |
| `check:local` | 当前施工路径：typecheck + lint + 基于本机真实快照的 test + validate:data:local；不生成 production 包 |
| `test:e2e` | Playwright；配置本地 webServer（`dev:local`）；缺浏览器不得谎报通过 |

脚本未实现前文档中的命令只是约定。当前先完成 `check:local` 和以 `dev:local` 为 webServer 的 E2E。没有公开快照时，public `build / check` 保持待发布前验证，不把它误作本机开发阻塞；不得自动造数据或允许 local-only 进入 production 包。

## 2. 建议目录

```text
.agents/skills/weread-skills/ # 已移植 skill，不作为网站资源
.private/                    # 忽略：原始数据、审阅表、本地快照、敏感截图
scripts/
  weread-request.ps1         # 已有：单次只读取数
  weread-fetch-highlights.ps1 # 已有：可续取的分批拓取
  build-candidate-pool.ts    # 已有：原始数据 → 候选池 + 短名单
  build-local-snapshot.ts    # 已有：候选池 + 挑选 → local-only 快照
  validate-snapshot.ts       # 已有：快照严格校验
src/
  app/                       # App、状态面板、快照加载、样式
  domain/                    # 类型、长度分档、校验器、索引
  data/public-snapshot.json  # 公开快照（当前为空）
  styles/                    # tokens、global
  test/                      # （暂未使用）
public/covers/               # 仅获准使用的本地书封（暂无）
tests/                       # 需要真实私有数据的冒烟测试
e2e/                         # Playwright 浏览器验收
```

上述是职责边界，不要求每个目录都抽象成多层。少量组件可以同文件；避免一个文件包办数据导入、排序、转场和整页 JSX。

## 3. 单向数据流

经过授权的 API 原始结果 → 本地最小化整理 / 人工审核 → 类型一致的快照 → 校验 → React。

浏览器绝不调用微信读书，不持有 `WEREAD_API_KEY`。`VITE_*` 变量会暴露到客户端，禁止用于密钥。不要扫描 `.env` 或原始响应查找凭证。

域层建立 `Map<id, entity>` 索引；统计来自当前快照，不从多处维护重复计数。错误数据在边界拒绝，不在每个组件里猜测修补。

## 4. 公开模式与仅本机模式

用户现已授权读取全部书籍（含私密阅读）的相关真实数据用于开发；**当前直接采用 local-only 路径，不需再等待逐书 / 逐条审批或公开清单确认**。公开清单与发布检查留到发布前，待审原始数据不放入正常前端包：

- 单独运行 `dev:local`（Vite 模式名 `local-private`），Vite `command === 'serve'` 且显式本机模式才可读取 `.private/local-snapshot.json`。
- 一个很小的开发期 middleware 只在固定 `/__local_snapshot` GET 路径返回该最小化快照；不得按请求参数读取任意文件，不暴露原始目录。
- 仅绑定 `127.0.0.1`；不允许通配 CORS / allowedHosts；响应 `Cache-Control: no-store`。禁止 LAN、隧道、远程截图服务、service worker 和预缓存。
- 页面持续显示 `仅本机 · 待公开审核`，关闭外部分享、可传播链接及上传；可测试本地预览和只在本机的复制。
- middleware 不进入 production bundle；执行 local 模式 build 必须直接失败。正常 build 只读取 `src/data/public-snapshot.json` 且 `visibility === 'public'`。
- 默认 `dev` 不可静默退回 local；数据不存在时显示空状态和开发提示。
- `server.fs.deny` 保留 Vite 原有敏感文件规则，并显式增加 `.private`、`.agents`、`scripts`、`.git`、`.env*` 等路径；测试直接路径、`/@fs/` 和编码变体不可读。middleware 是唯一受控例外，只返回字段白名单快照。
- 这不是本机多用户安全系统；本地有访问权的程序仍可能读取文件。所有原始数据保留在当前用户设备上。

本机模式只需小型 middleware、校验和明确状态，不建设复杂私有预览系统。用户未来批准 public 快照后沿用同一数据契约切换为静态来源。

## 5. 状态与事件

`EncounterState`：`currentId`、`historyIds`（曝光顺序，可重复）、`seenInCycle`、`globalDrawCount`、`phase: idle|exiting|entering`、`pendingId`。

UI 状态：出处开关、当前选书 / 主题 / 年份、分享预览的固定 `highlightId`。历史计数只在内容真正提交显示时更新；React StrictMode 二次调用不能消耗两次选句或注册重复计时器。

- `NEXT_GLOBAL`：空闲才接受，立即进入 exiting；选好 pendingId，不提前计为曝光。
- `COMMIT_QUOTE`：原子更新当前句、历史、计数、来源层状态，再进入 entering。
- `TRANSITION_END`：回 idle；计时器清理与 token 防止旧回调覆盖新状态。
- `OPEN_HIGHLIGHT(id)`：取消正在进行的转场，直接切到指定有效记录，记曝光；不消耗首页随机阶段计数。
- `NEXT_IN_BOOK(bookId)`：使用局部候选，不消耗 globalDrawCount，但记曝光；出处保持展开并更新。
- `OPEN_SHARE`：固定当前 ID；后续换句不得改变已打开的分享内容。

出处在全局换句 / 跨书选择后关闭；同书“再看一处”保持打开。使用纯 reducer 或同等可测设计，避免散落多个互相竞态的 setTimeout。

## 6. URL 与分享

- 四个导航使用 `#random / #books / #topics / #about`，同时滚动至对应标题。
- 精确划线链接使用当前 origin + 当前 pathname（保留子路径）+ `?h=<encodeURIComponent(id)>#random`。
- 分享 URL 不复制其他 query 参数，避免传播追踪或敏感参数。
- 初次加载 `h` 有效则优先展示该条，记曝光；下一次首页换句走 Contrast。`h` 无效则显示轻提示 `这条划线暂不可用` 并正常选 Opening。
- 每次普通换句不写 history，避免返回键要退几十步。分享时即时构造链接。
- 内部点击某条进入舞台时 `replaceState` 更新 `h`；处理 `popstate` / `hashchange` 恢复外部导航，不让 hash 变化重新随机选句。
- 已删除或撤回的 ID 不可复用于其他内容。深链不可绕过当前快照审核边界。
- 本机 `localhost` / `127.0.0.1` 链接明确标注仅本机有效；不声称已公开可访问。

## 7. 工程底线

无服务端密钥、无 `dangerouslySetInnerHTML`、不执行数据字段中的脚本 / Markdown 指令。远程 URL 默认不进入快照；若后续开放，必须按协议和主机白名单审核。书封失败时用真实书名占位，不生成假封面。

生产包、源码映射、日志、截图和测试 artifacts 都是隐私检查对象。Git 忽略规则只防误提交，不替代开发服务器隔离。构建后检查无私有原始字段和文件；正常客户端不得发往微信读书、字体 CDN 或统计服务。
