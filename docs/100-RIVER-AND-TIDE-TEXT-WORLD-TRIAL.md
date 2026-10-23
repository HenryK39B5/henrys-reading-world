# 100 — 河流与潮汐：多处真实文字的整站两稿

后续反馈：Henry实际认为此前设计不太合适，不一定是idea坏而是实现效果不理想，要求重新设计。本稿实现效果未通过，不再标等待首次反馈；工程成绩仅保留历史。2026-10-23新潮汐第二稿见`docs/101-TIDE-TYPOGRAPHIC-REDESIGN.md`，Agent选择聚焦潮汐、river留前稿对照，未替用户接受新设计。

2026-10-05（UTC；本机UTC+8日志跨午夜）。接99。Henry要求河流/瀑布必须同时多处可辨文段，否则仍是随机一句；他认可潮汐像海边捡贝壳的探索感，让Agent说明最终方向，也可把两种做成网站后一起看。Agent选择在原完整站本机做两稿：河流持续经过，潮汐成批到来/停留/退去。不是用户已选最终形态或艺术认可，不加两个正式公众入口，不替换现有随机一句，不发布。

## 范围与施工分工

- 同一真实快照/整站/map，原文、出处、全部Tag、稳定ID、分享、书房/小径/实际来路与公开隔离保留；舞台以桌面7/窄屏4处真实段落作为起始，非单句自动播放。稀薄主题/模型范围诚实少于此数，不造数据补位。
- 轻点留住一处，DOM全文立即、不定时放走；其他文字继续，留出阅读空白；放回、简单回看、可选探索实际本机候选/正Tag范围。选择不改变内容范围，探索/主题才改范围；不设强制候选岔路。
- Agent偏潮汐的休息节奏但保留河流对照，两项原生切换，不扩成六模式控制台。形态只是排版与时间，不是生产地图/语义地理或真实水面物体。
- 技术选Pretext排版+Canvas2D动态文字+原生DOM按钮/全文；不引入物理/AI/后台/外部字体纹理模型。旧Three/R3F庭院源码/测试/截图留为被否决历史，本稿不继续装饰96。

## 阶段A：排版依赖与真实采样/时序基础（实际）

- 干净`cbfdeb4`开始，`npm view @chenglou/pretext version license engines --json`实际registry返回0.0.9/MIT，随后`npm install --save-dev --save-exact @chenglou/pretext@0.0.9`增加1包，锁文件更新。未声称性能/中文最佳或永久最新。阅读所装包`dist/layout.d.ts`/package metadata，采用实际prepareWithSegments/layoutWithLines/clearCache API，measure/layout在段落与尺寸缓存，非每帧prepare。旧审核链仍1 high，未autofix，不称安全清零。
- 新`src/domain/textFlow.ts`：按书先选/真正ID/批内唯一、避开当前批并诚实穷尽；只截原文Unicode前缀预览；river/tide时间pose纯函数、active clock与大调度间隔clamp。位置/节奏无数据语义。
- 新`tests/text-flow.test.ts`从既有真公开快照读取，不造书摘：7/7，含可复跑/ID原对象/跨书/穷尽去重/旧批避让/有限时间姿态/批潮与连续流区别/静止时钟/Unicode前缀。
- 初typecheck因function声明闭包丢ctx/root非空窄化失败，改const箭头闭包保留窄化、未弱化strict；随后typecheck通过，lint通过。第一图片转发codemode invalid image output保留，改直接read实际图。
- 本机原5216无listener，任务范围内启动Vite play-private PID25304，stdout/stderr在`.private/review/text-flow-dev.*.log`。首实际捕捉Chromium/WebKit×1440/390×两形态于`.private/review/text-flow/first`，桌面7、手机4、无记录pageerror；实际read Chrome1440潮汐/390潮汐，非新艺术Gate。脚本耗时含导航等待截图，不宣称冷启动/真机/fps：WebKit仍显著慢（约14–51秒多步骤脚本），未定位。
- 此阶段仅基础作小步commit；完整room/Canvas重构还在工作区、尚未完成交互验收。当前公开snapshot/terrain hash与原基线吻合，未改Tag/向量/点位/私有源数据。后续逐段测试，不把旧434/浏览器/Pages成绩挪给本稿。

## 阶段B：整站两稿完成与本轮验证（实际）

- `TextFlowScene.tsx`使用所装Pretext排版、Canvas2D绘制与最多7个原生选择按钮；每段固定缓存原文前缀/行布局，不每帧prepare，布局缓存上限128、显示姿态缓存只保留当批。桌面7/窄屏4同时可辨（1000px以内采用单列），不是单句自动播放。river持续经过、逐槽更新，tide34秒一批的到来/停留/退去，进入首屏直接处于可读阶段、不等空潮。窄预览最多3行/宽4行，长文另有立即完整DOM。纯修饰曲线不是关系/地形；旧3D/庭院源码不删，但新room不导入Three/R3F。
- `PlayWorldRoom.tsx`/`play.css`共用抓放：靠近先稳这一段，其他时间继续；点击立即留住、全文在同场空白展开（无卡片底框）、focus转原文、其他字行低干扰让开并继续。直到主动放回，不计时冲走；闭合focus返控制，简单回看、换批和目录/键盘仍可达。手机停驻以全文为主，不宣称此时四段同时完整可读。帧目标约30、DPR≤1.5，暂停/reduced/隐藏与离屏停推进；不是实机fps/CPU证明。键盘聚焦动态目标时暂停待激活，鼠标仅局部稳住。
- 内容从原有真实范围按书抽取；选择只改稳定h，不默认写入关联anchor/更换范围；主动“沿这处”取匹配的实际本机候选，不随机补假关系；静态无图时入口disabled但正常偶遇。真实正Tag交集/上一范围/书房/分享/刷新/来路保留；无新算法训练、Tag或公开坐标变更。
- 首Chromium8/9失败于320px真实长文预览的点击区重叠；按实际Pretext行数缩短真实前缀/保持字体（不截全文），不放宽相等/碰撞断言。最初两次额外捕捉在动态第一段上被Playwright自动稳定等待卡住（capture-final/second日志30秒），保留。加入段落靠近停驻与真实鼠标先靠近，native click正常，不force；独立11用例含实体坐标靠近/其余时钟前进/原文准确。不把工具稳定等待等同所有真实用户无法点击。
- 最终`npm run check`：64文件/441测试/typecheck/lint/public数据/地形/正常build通过；`isolation:public`/`publication:verify`/`validate:data:local`通过，私有输入仍4663/130、已有2969未知Tag诚实。3个protected SHA（public snapshot/terrain/本机1024向量）与96记录逐字一致，正常公开JS/CSS/JSON产物仍原同名同大小。
- 最终新`e2e/config/playwright.text-flow.config.ts`：**一次串行完整22/22，Chromium11+WebKit11，5.1分钟**（日志e2e-complete-final；旧分段/初红仍保存）。1440/390/320多处/真实ID/点击区无重叠、direct catch/full original/全Tag/不隐式关联、放回focus/书房分享刷新、44秒虚拟时钟原文不被换/其他更新、暂停/live reduce/最长真实划线/布局缓存、准确模型与主题父返、拖不误选、键盘停驻、2D不可用原生降级/坏artifact拒绝/只读与私有向量边界均覆盖。虚拟时钟不是44秒真实硬件性能。
- 新静态配置`playwright.text-flow-pages.config.ts`：仅已批准公开输入到private静态文件；双引擎×1440/390 **4/4（58.1秒）**，两形态/稳定h/真实原文/项目子路径/刷新/书房返回/分享、同源、无`/__`请求/私有端点404/无记录错误与溢出。不是发布。新私有懒块`PlayWorldRoom-CYl3-Qei.js`63,876B/gzip23,242B；CSS`PlayWorldRoom-BxE4mc53.css`7,877B/gzip2,199B，非完整站总量/冷启动成绩。
- 独立实际`hasTouch`390双引擎tap/放回probe2/2，不是真机。新captured双引擎/两尺寸/两形态与held/整站图，最终`.private/review/text-flow/capture-complete`；实际read最终WebKit390潮汐/Chrome1440held，首图/失败图/日志分目录保留，未覆93–96。`capture.mjs`/`touch.mjs`在private/research/text-flow；UTF16 shell日志另转UTF8副本。WebKit开发导航/全脚本较慢仍在，无受控根因或已修性能结论。
- 基础commit9122b3b，完整稿与本记录做下一小步本地commit。确认listener仍127.0.0.1:5216/PID25304；现站map为两稿文字流，非96庭院。public/普通local第二版与“随机一句”不动，无新WeRead抓取/模型传输/新公开快照Tag向量点位地形/push/deploy。

## 未验证与下一步

两稿第一版工程完成，待Henry在同完整网站实际比较，不称已获新美感/自然性/愿意停留Gate；Agent仍更期待潮汐，非用户选定。独立首访、物理手机/Safari/读屏、实际200%浏览器缩放、长时/低端、字体矩阵尚未过；WebKit成本原因未定位。不能以441/22/4抵消真实反馈。下一步按实际体验在同站迭代，不引入隔离样本/引擎盲选/批量评分。发布/新公开范围/远程模型仍需单独许可。
