# 91 — 可游玩阅读世界：完整站点本机探索

日期：2026-10-03（UTC+8）。首轮授权/工程历史，接续 `docs/88–90`；不替换已发布第二版。

> **同日用户验收：视觉/交互均未通过。** Henry认为不好看、操作奇怪且不知如何操作；不是再给说明/测试成绩就能抵消。最新纠正与联网3D专题见`docs/92-3D-STACK-AND-EXPERIENCE-RESET-STUDY.md`。球体/分形只是自由灵感，非指定路线；首轮代码与图保留作失败证据，不再作已认可或待首次体验的设计。

## 1. 本轮授权与边界

Henry对直接操作世界和在世界里旅行没有明显偏好，允许两种都尝试；要求更 fancy 的视觉和体验，接受较长加载和较大资源，让Agent自行平衡效果、加载与运行性能，并明确要求开始后续工作。因此90的“继续讨论、不实际开发”是上一轮边界，本轮可以进入本机实现，不再要求他先选赢家。

仍在**现有完整网站**推进，而非隔离手感小样。原文/出处/稳定ID不变；不逐案生成故事、作者发言、关系或新标签，不把空间装饰当语义真值。不引入远程模型、运行时AI、账号、遥测、积分任务/关卡/解谜解锁。公开snapshot/Tag/原地图点位与地形不动，不push/deploy。

探索组合：球中世界、焦点透镜、展开曲面共用单点回应、真实阅读、主题入口和返回；直接操作与旅行式抵达也是同站候选，不等于选定最终游戏类型或角色。允许美感/好奇/动作回应本身有价值，不以每一步知识增量作硬Gate。

## 2. 内部阶段一：真实材料与可复跑基础（完成）

输入为现有 `.private/local-snapshot.json` 的 **4,663处 / 130本** 与已有本机bge-large-zh-v1.5的1024维缓存。全部逐条核对输入规范textHash、维数/有限值/非零范数；没有重新抓取WeRead或调用模型。

- 递归采用已复核标签交集，未知仍未知。根集合保留2,969处未标注原文，1,694处已有标签；局部入口至少4处，严格缩小，同成员合并，稀薄/相同停止。全量遍历得到144种不同成员集合：根1、单标签56、双标签87；阈值下没有更深的有效集合。6个单标签与全部87个双标签停止，不假造无限分形。
- 显示投影：固定seed `0x72ab19`、24维符号投影、该空间的前三PCA轴，符号稳定化；局部只重心化/缩放这三轴。是损失信息的表现坐标，不保证屏幕/球面邻近代表原空间近邻；不是新的Tag、人工拖点、生产地图或语义赢家。
- 候选关系：先试24维距离取96条再原空间重排，13个稳定ID等距抽样的top16数值找回均值仅0.2980769，保留失败artifact/报告，不接界面。
- 改为遍历全部 **10,869,453无序对**，范数归一的Float32向量、Float64累计余弦，每点top16、ID破同分。约14.48s/15.24s两次；13个抽样点与原Float64缓存的穷举top16找回均为1。这不是独立语义判断，也不代表所有浮点边界/参数/机器均等价。
- 新artifact仅ID、三维显示坐标、候选索引与快照指纹，560,179bytes；全部向量、分数、数值报告留private。输入内容/Tag身份指纹在工具、端点与浏览器交叉核对；contract拒绝额外字段、漏项/重复/未知ID、非有限坐标、越界/自环/重复边。
- 同机两次artifact SHA均 `5c44a769979e87d76e23fda485e80ad229dfa5c0780a470e66425e2ffdaf9ea3`。生产物不含计时；报告独立。数值复跑不等于美术、语义或阅读收益验证。

代码：`src/domain/playWorld.ts`、`scripts/research/prepare-play-world.mjs`、`tests/play-world.test.ts`。7个测试用已发布真实材料/稳定ID及明确的数值显示夹具，不制作fake书摘。

实际命令：`node scripts/research/prepare-play-world.mjs`、`node scripts/research/prepare-play-world.mjs .private/play-world-exact-v2-repro.json`；既有输出拒绝覆盖，复跑必须新private路径。准备依赖本机现有private缓存，不能宣称纯clone可复跑。

`npm run check`：类型/lint通过，60文件419单测通过，公开数据/地形验证及build通过。公开JS仍477.35KB / gzip145.11KB、公开JSON仍1,997.53KB / gzip517.68KB；界面代码草稿尚未浏览器验收，不以此check声称可玩/美观。

新增开发依赖精确锁定 `three@0.180.0`、`@types/three@0.180.0`，用于GPU几何、3D相机、PBR光照与资源释放，不引入游戏/物理/动画框架。npm registry实际确认两个版本，不宣称最新；normal公开build不包含探索Three代码。npm安装审计发现既有eslint→minimatch的brace-expansion5.0.9有1项high；已核对原HEAD锁文件同版本，不是新Three链引入，没有借机升级或宣称audit干净。

一手核对通过Node HTTPS保存Three官网文档壳和r180的OrbitControls/RoomEnvironment源码及SHA；阅读RoomEnvironment的PBR/PMREM用法与dispose实现。官网壳返回200不等于完整API/全部源码审阅，不冒称provider-hosted搜索。

## 3. 内部阶段二：整站世界与阅读（首轮工程完成；Henry视觉/交互未通过）

本机mode `play-private` / `npm run dev:play`已实际启动，入口 `http://127.0.0.1:5216/map`，当前进程12916。首轮进程11004在收口时已停止，PID被其他进程复用，未终止该进程；重新启动本项目Vite，复查/map与派生端点均HTTP200（560,179bytes）。代码阶段提交be383d1，阶段一d3abaf2。普通dev:local和公开构建继续既有地图；新lazy分支只在该模式开启，生产build拒绝private模式，不设新的公开入口。

共用真实原文/小径/书房/分享与导航；独立私有端点只提供上述派生几何，不开放任意文件、模型、写接口或Studio权限。两种参与与三容器是探索选择，不把局部世界强立唯一父子主题分类。候选在局部只使用全局邻居的成员内子图，尚未做局部重新建邻居对照。

实现 `src/features/play/PlayWorldRoom.tsx`、`PlayScene.ts`、`play.css`、只读loopback插件及原整站lazy分支。拨动采用轨道相机/直接触碰；走进采用光粒抵达/跟随视点和可见真点方向控制，不是完整人物自由步行。球、聚焦曲面、弯折曲面共用真实集合/候选/原文；显示点密度形成起伏，PBR、光晕、轨道与折叠是艺术表现，不是现实地理或确定语义。小球含有限真实成员预览，最多8个可视入口，全部入口另有列表；不创建4,663个DOM按钮。`world`条件查询只在此mode识别，原文仍绑定稳定h；已有实际来路可返回，刷新可回总世界，书房/审核小径/分享仍在原整站。点亮书籍用真实成员及真实封面Aura。原文片段可停下读完整原文/全部Tag/出处，未知ID有不可用说明，未将替代原文伪装成请求ID。

画布/环境/共享程序复用，换世界只更新几何，离开释放；DPR≤1.5，静止/离屏不绘制，媒体reduced-motion实时取消抵达与阻尼。GPU失去时继续读，恢复重建环境；无GL有真实阅读退路。未实施携带/双物件组合/连续人物走路/声音/关卡，不称这些已通过体验。

## 4. 新验收、成本与边界

- 最后 `npm run check`：60文件419单测，类型/lint、公开数据/地形/build通过；本机数据验证、`isolation:public`clean、`publication:verify`通过。公开JS/CSS/JSON仍同名同大小。snapshot ccef39…、terrain a94db8…、vector49dbdb…保持，生产点位/标签不变。输出穿越、已有artifact/report覆盖、private build均实际拒绝，没有public测试文件。
- 最后新浏览器矩阵 **20/20**（Chromium10 + WebKit10、1worker、120s/test，实际4.6min）：1440/390两参与三形态、原文/分享/书房返回、递归/Back/刷新、键盘/live reduced-motion、720×450的200%等价布局/320窄屏/真实最长文、Book Aura、原生touch tap进入/退出、GL损失/恢复及无GL、未知ID/extra-vector拒绝、端点只读/原向量拒绝。命令 `npx playwright test --config e2e/config/playwright.play-world.config.ts`。这不是实物Safari/iOS、真实浏览器200%缩放或读屏成绩。
- `.private/review/play-world/`保留12张形态×引擎×1440/390截图、两最终390图、首版full-page及14/18/20三轮日志。浅白/拥挤与首版手机球体裁切未删，已修光照、避让和初始相机同步尺寸。两effect依赖/cleanup lint警告已修，不关规则。曾先误查不存在的public/map-terrain.json，改查实际src/data/public-map-terrain.json完成指纹；曾两次codemode文档脚本语法失败且未执行，改独立精确编辑，没有将失败报为成功。
- 单次现有本机开发站点、新页面390×844/DPR2：首文/首次3D Chromium3.648/3.835s，WebKit5.678/6.285s；没有清除全部Vite/GPU缓存，不是受控冷启动或手机网络成绩。早期WebKit14–15s抓图另保留，不能把不同批次差异称普遍提速。
- 开发传输 **15,997,346 encoded bytes / 86 requests**，包含开发模块/source maps等，不是未来发布包；派生几何GET一次，外部请求0。六次切换Chrome384–686ms/WebKit200–247ms（含自动化点击/等待），均同一canvas；geometry计数19/20、纹理1、程序7/8轮换不单调增长，最后静止1s渲染计数不变。不是VRAM/堆内存/长期泄漏排除、60fps或硬件排名；renderer查询字符串不作物理GPU证明。脚本 `.private/research/play-world/performance.mjs`，报告/原页/失败/构建/拒绝日志均private。

阶段一已本地提交 `d3abaf2`，本阶段仍小步本地提交，不push/deploy。最终玩法/艺术未选，Henry实际游玩与审美、独立首访、物理Safari/iOS、读屏、低端长时、权利仍未验；旧线上第二版继续有效。Henry随后“请继续”接续收口，不是新增发布或远程许可。
