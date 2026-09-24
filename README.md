# Henry's Reading World

一个由真实微信读书划线组成的个人阅读空间。从一句话出发，可以按书、主题书架、跨书主题小径或世界地图继续阅读。

- 网站：https://henryk39b5.github.io/henrys-reading-world/
- 站内说明：https://henryk39b5.github.io/henrys-reading-world/design/
- [上线后维护任务](docs/48-MAINTENANCE-ROADMAP.md) · [发布验收记录](docs/47-PUBLIC-RELEASE-CLOSEOUT.md)

## 公开范围

公开版包含已审核决定展示的 108 本书、3,462 条划线、56 个主题标签及 108 张封面。每个地图点对应一条真实划线；标签只给有可靠人工复核结果的划线命名，其余划线仍参与地形。访客浏览时不调用 AI 服务。单句呈现不构成访问限制：已批准的文字随公开快照交付给浏览器。

书的主题书架与划线的主题标签是两个不同层次。小径先兼顾书籍出现机会，再在条件允许时利用预先计算的语义距离调节阅读节奏。地图二维点位来自本机离线处理，公开版沿用已固定的坐标。更多关于体验的解释见网站的 `/design/`；技术记录见 [V3 规格](docs/20-TAGS-PATHS-MAP-SPEC.md) 和 [地图实现](docs/27-BATCH-5-WORLD-MAP.md)。

## 运行公开版

使用 Windows 原生 Node.js 24 和 npm；不需要微信读书账号或 API key。

```powershell
npm ci
npm run dev
```

打开 `http://127.0.0.1:5173/`。`npm run dev` 读取仓库中的 `src/data/public-snapshot.json`；当前快照与封面已审核并用于线上站点。

```powershell
npm run typecheck
npm run lint
npm run test
npm run build
npm run test:public
npx playwright test --config playwright.pages.config.ts
```

`npm run build` 只生成公开站点。Pages 式测试使用构建后的 `dist/`，包含 Chromium 与 Playwright WebKit；WebKit 不等同于真机 Safari。项目使用 React、TypeScript、Vite、Vitest 和 Playwright，依赖版本以 `package-lock.json` 为准。

## 本机维护

`.private/` 存放完整阅读快照、来源数据、发布审核清单、封面原件和离线内容生产产物，已被 Git 忽略。公开仓库的克隆不含这些文件，也不能运行依赖它们的命令。仅在拥有本机材料的维护环境中使用：

```powershell
npm run dev:local          # 完整本机阅读范围
npm run publication:review # 本机发布审核器
npm run tags:studio        # 本机主题标签 Studio
npm run check:local        # 类型、lint、单测和本机快照校验
npm run test:e2e          # 完整本机 Chromium 回归
```

`npm run publication:verify` 还需本机发布清单及已构建的公开产物；它会核对公开投影、固定地图坐标、封面字节和静态房间入口。正式内容调整应先经过审核、重新导出与本机验证，不能直接修改公开快照来绕过发布决定。具体边界见 [数据流程](docs/09-WEREAD-DATA-WORKFLOW.md) 和 [公开审阅方向](docs/17-PUBLICATION-DIRECTION-AND-RELEASE-A.md)。

## 仓库结构与部署

- `src/`：阅读体验、领域逻辑和已批准的公开快照；`public/covers/`：公开封面。
- `scripts/`：数据校验、离线内容生产、公开投影与构建检查；私有输入只来自本机。
- `e2e/`、`tests/`：浏览器与纯函数回归；专项截图/审计配置在 `e2e/config/`，日常测试配置留在根目录；`docs/`：产品决策、实现记录及维护清单。
- `.github/workflows/deploy-pages.yml`：`master` 推送后以 `npm ci`、`npm run build` 生成 Pages artifact 并部署。网站托管在 `/henrys-reading-world/` 子路径下。

提交源码不等于批准新内容公开。工作流会在推送 `master` 时自动部署，因此本机改动应先通过公开隔离与投影校验，并按维护清单完成验收，再决定是否推送。历史实施结果保存在 [执行记录](docs/08-REVIEW-CHECKLIST.md)；发布后尚未完成的设备、读屏和权利判断见 [发布验收记录](docs/47-PUBLIC-RELEASE-CLOSEOUT.md)。
