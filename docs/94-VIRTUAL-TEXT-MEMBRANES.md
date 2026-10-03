# 94 — 虚拟文字薄片：原整站的一稿

**验收更新：Henry实际看本稿后明确认为诡异、没有美感，美术Gate未通过。22/430/Pages4仅工程证据，不抵消否决；后续游戏美术/独立体验价值方向见[95](95-GAME-ART-FIRST-EXPERIENCE-RESET.md)。以下“待体验”保留为当时施工状态，不是当前状态。**

日期：2026-10-03（UTC+8）。接93。Henry实际看93后认为视觉挺好、交互小巧神奇有趣，以“果盘”概括；这是本人知情定性反馈，不抹去前91失败，也不是独立首访/全设备Gate。他随后明确不偏好盘子/实体书过于写实的呈现，要求充分发挥网站虚拟介质，借游戏设计重视交互/体验，而非拟真翻页。Agent提议悬浮文字薄片，Henry明确要求按Agent最想做的想法做一稿并继续推进。

## 范围与设计

原完整站点、既有React/Three/R3F栈、loopback play分支与批准输入的private静态Pages检查；不要求Henry再选引擎/模式，不做隔离手感小样。不改snapshot/Tag/生产点位地形/既有向量/公开范围，不调模型、取新数据或push/deploy。

去掉盘子/展台、实体书壳、书脊、封面、两叶翻页、拟真阴影/环境图。每处真实划线对应一整片微曲、发光、有边界的悬浮膜；色彩/形状/摆放只属构图，不代表Tag、相似度、作者立场或新数据发现。不是无限分形、巨量点粒子/关系图或可走人物。不加声音/积分/任务/锁关。

选中时同一片膜有限舒展、文字清晰，原文DOM立即更新，不等待动画；选页不改anchor/相机。明确继续/换片/主题进入才更换内容窗口并做短暂显露；实际来路/稳定h与anchor/书房/小径/完整来源/全部Tag/分享继续原实现。手机焦点固定中心+2背景片、其他真实划线有完整DOM列表，桌面最多7片。24字真实摘录及省略号放在膜上，书名简写只是纹理来源提示，不生成新文或伪造原书分页，全文/书名/作者继续DOM。原“书页之间”工作名保留，不另设一套全站名词。

动作反馈借游戏的可触边界、局部响应、明确状态和短暂显露，不借复杂控制器/必学规则/持续镜头运动；无自由镜头/模式选择。虚拟不等于抽象到无法点。

## 内部阶段一：装饰曲面/有限动作纯函数（完成）

新增`src/features/play/filmGeometry.ts`：filmPose仅7/3明确构图slot；filmSeed绑定stable ID复跑装饰色，非Book/Tag分类；filmPoint是单片非对称微曲膜，无书脊/对称两叶；filmStep有限指数收敛到精确目标，非有限输入报错、dt限幅。`tests/film-geometry.test.ts`4例，和既有play14合计18/18，坐标/动画数值是明确装饰测试，不fake语料。

整站UI草稿已替换ReadingScene，移除Drei helpers/封面纹理/环境/阴影，改少量几何、自有shader与仅本地真实摘录纹理；没有新依赖。初typecheck通过，lint发现excerptTexture的page闭包依赖warning，改为primitive文本/书名参数，不关闭规则。新第一4张真实图/console见`.private/review/virtual-films/first-*`、`virtual-films-first.log`，没有page/console错误与横溢出；首次Agent看图发现文字小、下方入口裁切，保留反例后调24字/80px摘录与desktop视域。首次4个脚本终点4.665/3.408/49.797/48.853s含等待截图且dev不受控，非首原文/首3D或生产/物理设备成绩；不解释为更省算力。初计数desktop21call/14geometry/7texture/3program，phone9/6/3/3，仅此规模，不是VRAM/60fps/长时证明。

阶段一只纯helper/测试/本文/AGENTS/08小步本地提交，UI仍工作区继续，不称新美术/游戏体验通过。

## 内部阶段二：完整站点与静态Pages（历史工程完成；美术已否决）

本轮实际新22浏览器例（含直接曲面点击/即时全文/稳定anchor相机/拖不误选/10次选取资源/idle/live reduced-motion/context损失恢复/真实scope/Back/触屏/最长文/320）、静态项目base4例、全check/隔离/公开投影、修后真实图和成本已执行，细节见下节。旧93的18/426/4不是本轮成绩。reduced-motion取消曲面过渡/入场/升降/倾转，保留立即状态与稳定正文；demand帧只有限响应，不连续漂浮/粒子，隐藏后可唤醒；原正常React投影标签，不用Drei Html多root。

未验：Henry新视觉/虚拟性/自然性与娱乐反馈、独立首访、实物手机/Safari、真实200%缩放、读屏、长时低端性能与权利。线上第二版继续有效；最终拟发布场景/关系与范围仍另决定。

## 实际命令、反例、成本与收口

- `npm run check`新**62文件430/430**、类型/lint/公开data/terrain/普通build通过；`isolation:public`、`publication:verify`、`validate:data:local`均过，原未审Tag/换行coverage不抹去。已批准snapshot/terrain/本机向量SHA仍与93完全相同。正常public还是index-x2roO1Xt.js477.35KB/145.11gzip、旧CSS/JSON，只有81modules，没有新Scene/Three包。
- 同时跑两套Playwright时首次**21/22与3/4**，分别browserContext.close/apiRequestContext.dispose的trace/network ENOENT：共用test-results被另一套清理。未将其算成功，保存first日志，配置独立private results-local/results-pages后同断言重跑：`npx playwright test --config e2e/config/playwright.play-world.config.ts`**22/22**（11+11/1worker/4.7min），`...playwright.reading-pages.config.ts`**4/4**（2+2/1worker/1.8min）。没有删失败断言或用旧成绩代替。
- 新增真实曲面直接射线点击：根据固定构图slot投影点，确切读取对应真实ID/全文、h变而anchor/相机不变，并捕获pageerror/console shader error；不是只点DOM列表。10次连续选择desktop geometry/texture计数与初始相同，live reduced-motion停止动画/一段无新帧；另有idle1s、真实WebGL损失恢复/noGL、模拟touch、scope/Back/父级/分享/源书/最长文/320/720×450缩放等效、非法关系额外vectors拒后诚实偶遇。计数不代表长期泄漏/VRAM/60fps或物理Safari证明。
- 新static输出真实PlayWorldRoom-DlAXatAL.js**889,126B / 236,856B gzip**，CSS8245/2511；仍有>500KB警告，不改阈值隐藏。只有已批准公开材料和同源静态资源，两个private端点404、无/__请求、真实Pages base与刷新/书房往返/分享、无pageerror/网络404/横溢出。没有public模型邻接时明确只偶遇，不偷用本机API冒充可部署。
- 图证：`virtual-films/first-*`保留小字/下方入口裁切，修24字80px字纹理/desktop视域11.8后读取final-chromium-1440/390、static-webkit-390；新的完整桌面whole-desktop-final、完整手机timing-whole-chromium-390已实际读取。无物理底座/书壳/书脊/封面/两叶，真文材质在单曲面，Native文本/出处/Tag/返回完整。材质为柔和发光膜，纹理微字仍不宜代替原文阅读，艺术/可玩自然性待Henry实际新稿反馈。
- 分段计时（新独立dev390×900，各engine仅1样本，非受控/冷启动或生产）：Chromium dom523ms、真文1783、scene-ready1813、等待结束3317、整页截图3458、scene截图3574；WebKit分别20735/21645/21897/23407/23484/23645。该样本截图各只77–161ms，慢主要已在DOMContentLoaded之前，但**尚不知导航/资源/编译/工具或CPU具体原因，不作因果诊断/真机保证**。与初49s整段不是公平提速对照；WebKit开发成本未解决，不因为少shader就称性能好。
- 偏差：首E2E沿用reading-garden/final与static名称，覆盖了旧93的8张场景图；旧93首图/失败图/whole-followup完整页证据仍存。之后改virtual-films专用截图/trace目录，不声称精确恢复旧final图。分段脚本只390，误读不存在的1440 timing图一次ENOENT，未称读取成功，随后单独生成并实际读whole-desktop-final。
- 不新增依赖/模型/微信读书/内容/Tag/向量/原地形点位或公开导出；锁文件未动，旧eslint链audit高风险仍历史未解决，本轮未新跑audit或声称安全。阶段一`f061a5e`、阶段二小步本地commit，未push/deploy。127.0.0.1:5216 listener仍PID12916、map200，新薄片就在原完整站可看；浏览器工程通过不替Henry判新美术/娱乐Gate。
