# 93 — GitHub Pages约束下的新阅读场景重构

日期：2026-10-03（UTC+8）。接92，Henry明确把技术栈选择交给Agent，硬约束为最终GitHub Pages静态部署，并要求继续推进；不是新一次push/deploy许可。

## 1. 已选技术与实现动作

Agent选择现有React/TypeScript/Vite + Three0.180.0 + R3F9.8.1 + 按需Drei10.7.9。不再让Henry盲选栈或先选赢家，不上alpha、不升级其他工具。静态资产/DOM正文/原路由、项目base路径；不需后台、SSR、登录、模型服务或远程统计。R3F管理场景/资源/事件，Three渲染，Drei只取圆角几何/本地生成环境/悬停光标等实际需要的组件；不取远程HDR/字体预设、物理或游戏框架。

本轮Agent实施方向：**书页之间**——可辨识的真书/真划线对象，受控镜头，一次选择就看到真实原文；明确“从这页继续”才重组这片书页，明确主题进入/返回。不是已被Henry认可的最终美术/产品核心。球、分形、人物与自由镜头不作前置；不再公开两参与×三形态控制台/方向器。

数据与布局分开：真实anchor与最多6个其他页面，模型已有候选与按书偶遇分别标注，不把补齐偶遇当相似；场景摆放只是构图，不使用生产坐标/地形、不声称语义距离。条件Tag工具保留真实交集/实际来路/未知/稀薄停止，但前台不制造无限世界。全库可由按书偶遇、书房/小径进入，不为画面数量丢原文。

## 2. 内部阶段一：静态架构与纯内容动作（完成）

- 实际精确安装R3F9.8.1、Drei10.7.9：新增47包，既有Three/React/Vite不升级；npm仍1 high，未运行audit fix或宣称干净，后续核对归属。新增`src/domain/playExperience.ts`与`tests/play-experience.test.ts`。
- `readingPages`绑定真实anchor/原文/ID，依次真实模型候选与明确偶遇，按书优先、去重、有限稀薄；固定anchor时选择不改变内容窗口/候选；物体响应可变，手机把选中书页放在固定中心位，不以移动镜头或改anchor实现焦点。`readingFrame`校验局部身份，`readingAddress`分开h与anchor，参数而非数组位置适合静态目录URL；只显示采样RNG可注入/复跑，不造文本。
- `npx vitest run tests/play-experience.test.ts tests/play-world.test.ts`14/14；`npm run typecheck`修复后通过。首次场景TS发现nullable纹理与class override四错，实际修复；未关strict/lint规则。pure测试用现有公开真实材料，坐标/邻接仅明示数值夹具，不fake书。
- 整站草稿已用新Scene替代旧Map实验分支，旧PlayScene保留Git/源码对照；第一轮Chromium/WebKit×1440/390真实截图4例均一canvas、无pageerror/横溢出，5.034/3.256/21.863/16.871s仅本机不受控开发样本，未称真机/性能胜出。
- Agent已读取1440/390首图：封面太小、底座空大、标签仍显杂，不能以4例可运行称视觉收口；保留首图继续重做比例/展开动作。本阶段不新称美术/可理解Gate通过。

## 3. 内部阶段二：原整站场景/阅读/Pages静态证明（工程完成；美术/体验待反馈）

`PlayWorldRoom.tsx` / `ReadingScene.tsx` / CSS在原完整网站共用书房、小径、分享与返回；选择不改相机、不改anchor，“从这页继续”才打开下一片。“换一片书页”是全局按书偶遇；主题入口与原文对象分开。完整中文正文继续DOM，不贴旋转物体取代阅读。缺封面/GL/数据失败仍真实阅读，live reduced-motion需验。

新增显式`play-static-check`构建模式：**只读既有批准公开snapshot/covers，不含private向量/新内容**，产物仅`.private/play-static-check`，常规public/local原第二版不动；已实际build/仅静态文件服务器/双引擎浏览器证据4/4；不是新增公开内容或发布。没有图数据时走明确偶遇，不称模型候选；本机有图时仍fixed只读端点。最终若要公开模型派生关系须单独审其批准范围和静态导出；本轮不自动导出新snapshot/Tag/生产地形或发布。

Pages兼容需验证子路径`/henrys-reading-world/`、真实map/h/anchor/主题URL刷新与Back、书房/分享、所有资源同源、离线/GL退路，不用运行时API/自定义服务器/COOP/COEP要求。静态试验不能偷用localhost私有端点来冒充Pages成功。

本轮新工程证据见下节。真正200%浏览器缩放、真机触屏、长时资源/物理设备性能与Henry新视觉/自然性反馈仍待验；原20/419不是本轮新成绩。独立首访/实物Safari/iOS/读屏/权利仍另行未知。无push/deploy/新模型/WeRead/公开数据或生产点位地形修改。

## 4. 实施收口、反例与实际验证

- `ReadingScene.tsx`固定正交相机、最多7真划线对象（手机选中居固定中心+2背景书）、真实封面、生成本地光照、matte展台和选中翻开纸页；纸页纹理只提取对应真实原文前220字、长文明确省略，不生成句子/作者/页码，也**不声称复刻原书分页/排版**。完整原文、作者/书名/Tags仍DOM。选页响应和显式继续分离；同书可有不同真划线，尚有重复封面与标签拥挤的美术问题，不拿工程测试抵消。
- 仅R3F/Three/Drei常用helper，不用OrbitControls/方向器/模式表/人物/球/递归无限地形/外部字体、HDR或模型。DPR≤1.5、demand render、live reduced-motion取消升降；真实封面引用计数/延迟释放，晚到图片只删除自身cache entry；书页纹理销毁；context loss/restore与无GL仍可读/选/进书房。
- 第一轮18例**12过/6失败**：4个书房往返有`removeChild`/WebKit对应DOM移除错误，2个拖过书页发生误选（h-2261）。保留e2e-first日志/图；弃Drei Html嵌套DOM root，标签由外层正常React管理、投影到固定物件，Canvas/标签点击统一7px移动阈值，不patch node_modules/过滤错误/放宽读页断言。
- 修复后`npx playwright test --config e2e/config/playwright.play-world.config.ts` **18/18，Chromium9+WebKit9，1worker/4.5min**：1440/390、选择不改窗口/anchor/相机、明确继续、同canvas、全原文/分享/书房Back、真实Tag交集/父级/刷新、键盘/live reduced-motion/320/最长本机真文、720×450缩放等效、鼠标拖动不误选/idle1s不绘制、read-only资料/向量403或404/无GL、native模拟触屏、真实GL损失恢复、未知/范围外/非法向量字段降级诚实偶遇。不是实物手机/真实浏览器200%缩放或语义证明。
- Pages首启动失败是配置cwd落在e2e/config，`Cannot resolve entry module index.html`；修正根cwd后再遇Node24 JSON import attribute错误/No tests found，改readFileSync读取已批准fixture。第三次**4/4，双引擎×1440/390，1worker/2.1min**：只有静态文件（不是Vite SPA fallback/API），真实`/henrys-reading-world/map/`查询ID、选/刷新/书房/Back/分享、同源资源、无网络404/pageerror/横溢出，两个private端点404、无`/__`请求；没有图时只标偶遇，不假冒模型候选。命令`npx playwright test --config e2e/config/playwright.reading-pages.config.ts`会build private产物+启固定loopback5316静态测试host，结束后关，不部署。
- 新静态场景懒加载包约952KB raw/260KB gzip，有真实>500KB build警告，保留不调阈值假装没超。不是16MB开发模块或当前线上包；正式新关系导出/部署仍需另决定。正常public build依旧`index-x2roO1Xt.js`477.35KB/145.11KB gzip、CSS50.78/9.64、JSON1997.53/517.68，没有场景/Three包。
- `npm run check`**61文件426/426**+类型/lint/公开数据/地形/正常build通过；`isolation:public`、`publication:verify`、`validate:data:local`均通过。既有2,030/2,969未审Tag与原始换行coverage警告保留，不为场景补标签。npm audit仍**1 high：既有eslint10.10→minimatch10.2.6→brace-expansion5.0.9**；非新R3F链，不auto fix，也不称所有依赖安全。
- 新完整页截图`.private/review/reading-garden/whole-followup-{chromium|webkit}-{1440|390}.png`4例，一canvas/73按钮/无横溢出或pageerror，相机均0,4.8,10。首完整截图脚本只Chromium2过，WebKit导航30s timeout，保留whole-final日志；改domcontentloaded/90s导航等待后4/4，终点**4.996/4.054/46.145/45.589s**包含1.5s等待、截图，且不受控dev/软件GPU，不是首原文/首3D/手机/生产延迟或加速胜出；WebKit成本显著，仍需定位而非解释为性能已验。codemode图片转发一次invalid image output，read已执行，未假称看图；改direct read实际看完整390/1440和场景图。
- Agent图读结论：内容/书物/动作辨识强于旧点粒子控制台，但桌面空区、同书多划线封面重复和标签叠边仍不够惊艳；**没有宣称新美术/娱乐/自然性通过**。下一步基于此完整站反馈打磨视觉与有效动作，不要求评分表、不另做隔离小样/选择引擎。
- 再核对已批准snapshot、public terrain、local向量SHA与92均相同。5216 listener复查PID12916、loopback/map200，可看本机新版，不是旧六组合。阶段一本地commit `7acc8df`，阶段二小步本地提交，无push；所有失败/截图/log/静态试验产物private，仅测试/源码/docs版本化。
