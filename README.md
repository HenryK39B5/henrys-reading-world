# Henry's Reading World

一个由真实微信读书划线组成的个人阅读空间。从一句话出发，可以按书、主题书架、跨书主题小径或世界地图继续阅读。

![React](https://img.shields.io/badge/React-24362e?style=flat-square&logo=react&logoColor=dae6d4) ![TypeScript](https://img.shields.io/badge/TypeScript-24362e?style=flat-square&logo=typescript&logoColor=dae6d4) ![Vite](https://img.shields.io/badge/Vite-24362e?style=flat-square&logo=vite&logoColor=dae6d4) ![Playwright](https://img.shields.io/badge/Playwright-24362e?style=flat-square&logo=playwright&logoColor=dae6d4)

- 网站：https://henryk39b5.github.io/henrys-reading-world/
- 站内说明：https://henryk39b5.github.io/henrys-reading-world/design/
- [上线后维护任务](docs/48-MAINTENANCE-ROADMAP.md) · [首次发布验收记录](docs/47-PUBLIC-RELEASE-CLOSEOUT.md)

第二次上线已由 Henry 体验确认并授权发布：可阅读的地图、跨书真句对读、稳定停驻、多尺度地名、连续阅读比例与新站点图标已上线。公开内容范围、地图坐标与地形保持不变；实施与性能边界见 [阅读连续性与冷启动](docs/84-READING-CONTINUITY-AND-COLD-START.md)，部署与线上复核见 [第二次上线记录](docs/85-SECOND-RELEASE-CLOSEOUT.md)。

## 本机游玩式探索（未上线）

**最新收尾：[图标与介绍页](docs/107-SITE-ICON-AND-EXPLANATION-CLOSEOUT.md)。** 已打磨SVG书页/水纹图标与PNG派生、关于/阅读方式/技术说明及文章版心；说明按当前功能和数据版本区分本机/公开，不改变审核内容。71文件479检查、专项24/24、public9/9、深层图标2/2及三方式静态4/4通过。正式公开的新结构接线仍待完成，本轮没有push/deploy；线上内容继续使用独立审核快照，不复制完整本机数据。

**地图算法基线：[地图坐标与局部地名打磨](docs/106-MAP-COORDINATE-POLISH.md)。** Henry已明确肯定105整站，要求上线准备前最后改善地图。106采用原1024维精确近邻、等比坐标及有局部支持的真实成员地名，保留缩放/悬停/对读/返回；只挂完整本机play模式的地图。70文件475检查、新地图14/14、三方式整合10/10通过；模型近邻仍不等于语义真值，原文反例详106。普通public/local和线上第二版不变；新地图待实看，随后才做公开接线与发布，尚未push/deploy。

**105历史记录：[随便看看三种方式与潮汐空间连续](docs/105-BROWSE-FORMS-AND-TIDE-CONTINUITY.md)。** Henry已肯定104整体效果，河流基本满意、潮汐沙水获认可；本轮授权后取消潮汐旁文重排、按浅深水显连续真前缀，将一句一句/河流/潮汐归入根入口“随便看看”，/map恢复真实地图。本机导航合并为五项，书架内保留全部书籍/按书籍主题；普通public/local与已发布版不变。68文件464检查、完整文字流38/38、后补单句周期与入场收口后的整合10/10、静态三方式4/4；详105中的时间顺序/失败记录，不能代替新美感与真实设备验收。

首轮把球中世界、焦点曲面、展开曲面与拨动/光粒抵达接在同一完整网站里。**Henry实际反馈不好看且操作困惑，视觉/交互均未通过**；保留作失败对照，不是已认可方案。[3D专题](docs/92-3D-STACK-AND-EXPERIENCE-RESET-STUDY.md)后，Henry将技术选择交Agent、要求最终GitHub Pages可部署。现已用React/Three/R3F9/按需Drei在原整站本机重构为[书页之间](docs/93-PAGES-READY-READING-SCENE-REBUILD.md)：选真书页读原文，明确继续才换内容起点，固定相机；不再保留六组合/方向器。完整原文仍DOM、书房/小径/分享/返回共用。Henry实际看93认为视觉挺好、交互小巧有趣，但随后不偏好果盘/实体书过于写实，要求虚拟原生与游戏体验。现已在同整站完成[悬浮文字薄片一稿](docs/94-VIRTUAL-TEXT-MEMBRANES.md)：无实物底座/书壳/封面/书脊，单片微曲发光膜/真摘录，选择有限舒展、全文立即，明确继续再换窗口。**Henry实看94已明确否决其诡异/无美感，美术未通过**；下一步[游戏场景美术优先](docs/95-GAME-ART-FIRST-EXPERIENCE-RESET.md)，要求即使不读内容也值得体验，不继续薄片加效小修。随后Henry明确Agent自由发挥并继续；已在原整站本机完成[暮光庭院一稿](docs/96-TWILIGHT-GARDEN-PLAYABLE-SCENE.md)：原创暮色/回廊/阶梯/水面/柏树/天体完整构图，直接拖光/浮桥独立游玩，真实阅读按需打开/收起、h深链立即全文，手机3独立入口与全7文字目录。**Henry随后认为庭院与阅读没有天然联系、物体绑定文字生硬，建议作为废案**；历史工程保留，不继续装修。经[Pretext brainstorm](docs/97-TEXT-AS-SCENE-PRETEXT-BRAINSTORM.md)、[模式讨论](docs/98-TEXT-WORLD-CORE-INTERACTION-MODES.md)、[文字流抓放](docs/99-FLOWING-TEXT-CATCH-AND-RELEASE-DISCUSSION.md)，Henry指出随机漫步重复原随机一句且有选择负担，原下一句不改；随后要求同时多处可辨文字、认可潮汐探索感并允许Agent选方向或两稿。现在原整站本机已完成[河流与潮汐两稿](docs/100-RIVER-AND-TIDE-TEXT-WORLD-TRIAL.md)：Pretext0.0.9排版+Canvas2D/DOM，桌面7/窄屏4，多处持续经过或批潮到来/停留/退去；靠近局部稳住、轻点全文留到主动放回、其他字流让白继续、回看/真实范围探索。无水景物体/拼句/作者故事，文字本身共场；Henry随后认为实现效果不理想，要求重新设计，100不再是待首次反馈。现已在原站完成[潮汐第二稿](docs/101-TIDE-TYPOGRAPHIC-REDESIGN.md)：错落不等宽/字级构图替代三列排布，批次扫入/安定/退去，阅读中心与旁文让位；默认新稿，river前稿留对照。Henry已肯定101流动基础接近想象，但仍认为美感/自然性不足；先讨论水带文字到岸/回水的设计，随后授权开发。现在已完成[水岸与河湾一稿](docs/102-WATER-CARRIES-TEXT.md)：可辨岸线/浅深水与文字共享潮进退或弯曲水路、近岸阅读/主动放回入流。Henry已实看肯定102效果明显变好、开始有意境，认可方向并授权继续打磨；最新[连续阅读与水岸细部](docs/103-WATER-READING-POLISH.md)已完成固定即时全文/预览过渡、分水路归还、手机长文边界与原生滚动、湿岸浅水层次；Henry已实看103认为更精致且喜欢，同时指出潮水卡顿/选中残影与大字号突兀。最新[连续水面与小巧文字](docs/104-SMOOTH-WATER-SMALL-PASSAGES.md)已实现同帧水字/静态纹理缓存、无重复预览残影/600ms归还、两行小巧预览与更轻标题；Henry随后已实看肯定整体、河流基本满意及潮汐沙水；其遗留反馈由105接续，WebKit性能未彻底解决。仅真实资料，不替换已发布第二版。

```powershell
npm run dev:play
# http://127.0.0.1:5216/              随便看看（首次一句一句）
# http://127.0.0.1:5216/?view=tide   潮汐
# http://127.0.0.1:5216/?view=river  河流
# http://127.0.0.1:5216/map          真正的世界地图
```

完整本机范围需要已有private快照/封面；匹配派生图提供真实模型候选，无图仍可明确偶遇，不假造关联。已有embedding缓存才能首次`npm run play:prepare`；artifact/report拒覆盖，不自动抓取/调用模型。private mode拒正式build，普通local/public继续原地图。104历史稿67文件460检查通过；初35/36因WebKit双模式虚拟推进单例超时，按模式各44秒拆分保留断言与单例时限。新38集外层中断33过后补6（1项重叠），最终38逐项覆盖，不称一次全过；静态4/4、模拟touch2/2、原生长文wheel/End2/2。拆分增加累计测试预算，非声称原性能问题已修；历史失败均保留。320碰撞/动态capture稳定等待失败与修复留存，艺术/自然性/实机/读屏/长时尚未过。旧庭院434/13+11+2/Pages4与薄片22/430为历史证据，不能抵消否决。旧[91](docs/91-PLAYFUL-WORLD-LOCAL-EXPLORATION.md)保留失败对照。

无需private语料/后台的Pages静态可行性检查只用已批准旧公开输入，输出仍private，不上线：

```powershell
npx playwright test --config e2e/config/playwright.text-flow-pages.config.ts
```

该命令build显式play-static-check，使用仅静态文件的loopback5316检验真实`/henrys-reading-world/`子路径（双引擎×1440/390，4/4），不请求private端点或外部资产；不是新关系/新内容导出或push/deploy许可。旧静态结构见[93](docs/93-PAGES-READY-READING-SCENE-REBUILD.md)，两稿历史见[100](docs/100-RIVER-AND-TIDE-TEXT-WORLD-TRIAL.md)，潮汐第二稿见[101](docs/101-TIDE-TYPOGRAPHIC-REDESIGN.md)，水岸/河湾基础见[102](docs/102-WATER-CARRIES-TEXT.md)，连续阅读见[103](docs/103-WATER-READING-POLISH.md)，新动效/精致度与同机性能观察见[104](docs/104-SMOOTH-WATER-SMALL-PASSAGES.md)。正常public/普通local仍是有效第二版，104历史私有懒块73,254B/gzip26,564B不是105或全站总量。原完整本机交互回归命令：`npx playwright test --config e2e/config/playwright.text-flow.config.ts`。

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

- `src/`：阅读体验、领域逻辑和已批准的公开快照；`public/covers/`：公开封面；`public/favicon.svg`：独立设计的站点图标源文件。`npm run icons:generate` 从它再生成 `public/favicon-32.png` 与 `public/apple-touch-icon.png`，不要手工修改生成图。
- `scripts/`：数据校验、离线内容生产、公开投影与构建检查；私有输入只来自本机。
- `e2e/`、`tests/`：浏览器与纯函数回归；专项截图/审计配置在 `e2e/config/`，日常测试配置留在根目录；`docs/`：产品决策、实现记录及维护清单。
- `.github/workflows/deploy-pages.yml`：`master` 推送后以 `npm ci`、`npm run build` 生成 Pages artifact 并部署。网站托管在 `/henrys-reading-world/` 子路径下。

提交源码不等于批准新内容公开。工作流会在推送 `master` 时自动部署，因此本机改动应先通过公开隔离与投影校验，并按维护清单完成验收，再决定是否推送。历史实施结果保存在 [执行记录](docs/08-REVIEW-CHECKLIST.md)；发布后尚未完成的设备、读屏和权利判断见 [发布验收记录](docs/47-PUBLIC-RELEASE-CLOSEOUT.md)。
