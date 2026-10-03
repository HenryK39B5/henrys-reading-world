# 92 — 3D 技术栈专题与体验重新定向

日期：2026-10-03（UTC+8）。接91的真实完整站点首轮，不替换线上第二版。

## 1. 用户反馈与现行结论

Henry实际体验后明确指出：**不好看；操作很奇怪，即使作为开发者知道大概方向，仍不知道怎么操作。** 因此91的视觉/交互Gate均未通过，不再写成等待第一次体验。20个浏览器测试/419单测只证明被编码的行为可执行，不证明这些行为可理解或值得玩。

Henry要求联网做3D技术栈专题并继续后续工作；同时纠正：游戏例子只是打开设计空间，不要求照搬球中世界、解谜或分形。分形可以用也可以不用，以产品适合与否决定。本轮按此前已明确的《茧》/COCOON记录例子，不把此次“简”另认定为已核对的新作品。例子名称不影响这个设计边界。

本轮实际完成：公开搜索/一手文档与registry核对、旧代码与两张真实截图复盘、本专题和执行记录。**没有安装候选引擎、制作下一版UI、引擎跑分、改变算法/数据/Tag/生产点位地形、调用模型、push/deploy。** 原本机开发许可没有撤回，但不能把91失败的六组合菜单继续加特效称为修复。

## 2. 为什么现有版本不成立（Agent复盘，非独立访客研究）

证据：`src/features/play/PlayWorldRoom.tsx`、`PlayScene.ts`、`play.css`；旧截图`.private/review/play-world/chromium-390-globe.png`和`chromium-1440-fold.png`已实际读取。旧代码/图片/失败保留，不删掉反例。

| 具体问题 | 代码/画面依据 | 应改变什么 |
| --- | --- | --- |
| 读者先面对控制台而非明确对象 | 两参与×三形状，加方向器/相机手势/点/小球/主题列表 | 研究开关不作为默认公众动作；不能靠命名让人懂 |
| 多种对象看上去像同一团粒子 | 原文点、主题球、当前光粒、曲线没有清楚层级；噪点主导表面 | 区分可读对象、局部入口、背景装饰；先能辨再谈fancy |
| 选择和移动耦合 | `setFocus`在普通拨动模式也重设相机；选原文同时改变镜头 | 选择原文不默认重排画面，主动进入才允许受控抵达 |
| “走进”并不等于走进 | 两模式都挂OrbitControls，方向键在拨动时转相机、旅行时选屏幕半平面里的点 | 一次只给一种清楚的操作模型；旅行不是换个名称/镜头距离 |
| 原文和世界仍有距离 | 片段浮在画布角落，完整原文要滚到下一块；图线端点多为无字小点 | 内容回应需就地可见，读者不用猜哪个点/哪条线值得点 |
| 表面塑料感/星尘海，不是成熟美术 | 通用环境/PBR、球或薄弯片、密集均质点、方形贴标签、装饰环 | 建立构图、尺度、材质、照明、排版与动静节奏，而非增加几何量 |

工程里已做的资源复用/上下文退路可保留；显示球面/曲面、默认相机逻辑与菜单不因“已实现”获得保留权。上表是源代码与两图的设计判断，不是新的物理手机试用或普遍用户研究。

## 3. 技术要服务的产品约束

- 这是现有React/TypeScript网站里的可游玩阅读，不先转成完整独立游戏。视觉吸引、好奇和动作回应本身可有价值；不要求每步新增知识。
- DOM继续承担完整中文原文、出处、全部Tag、复制/分享、书房/小径/返回；不能把正文烘成倾斜纹理替代可读文字。
- 3D承担场景、层次、少量可辨对象与动作回应；不是把4663条同时做成按钮或可点击星尘海的义务。
- 触屏、键盘、稳定阅读、reduced-motion、GL退路和实际来路是主路径。没有强制走路/解谜才能读文，不添加积分/账号/声音/遥测。
- 内容层只用真ID、正记录Tag、已有本机模型候选；美術对象/装饰不冒充语义发现。布局和关联仍分开，未知保持未知。
- 球体、分形、自由镜头、人物、物理、模型格式、任何单一库都不是预设产品需求。

## 4. 方案比较：不是人气榜或性能跑分

以下推荐是针对上述约束的Agent判断；能力来自一手资料，接入/美术成本尚未做同场景实测。

| 路线 | 已核对的能力 | 对本站的取舍/优先级 |
| --- | --- | --- |
| **Three.js直接使用** | 现有项目已经实现GPU场景；当前WebGPURenderer API有WebGPU与WebGL2后端 [S4] | 无需换库也能重做视觉；但现有类手工承担生命周期/拾取/镜头/状态，继续扩大容易把产品动作和渲染绑死。保留可复用部分，不把失败归咎于Three |
| **React + R3F 9 + Three + 按需Drei** | R3F为Three的React renderer，9配React19；按需帧/实例化、3D事件均有正式文档 [S1–S3] | **网页内场景首选试行**：融入原站、可将场景做可复用组件、阅读仍DOM。不是画质升级插件；事件仍需定义，3D穿透/遮挡不能按DOM直觉照搬 |
| **Babylon.js + React阅读壳** | 场景/动画、WebGL/WebGPU、Havok/角色控制、Inspector/资产工具等 [S5] | 若真正选择连续地面移动、碰撞、角色/关卡式复杂场景，再优先对照。当前不因为“游戏感”就引入整套机制；不据功能表声称本站更快/更美 |
| **PlayCanvas Engine / PlayCanvas React** | JS/MIT/TS声明，可独立用Engine；有正式React组件/事件/按需物理，Editor为浏览器制作工作流 [S6–S8] | 认真候选，不是只能云端/不能React。若场景编辑工作流成为瓶颈可前移；Engine standalone和账号/云Editor分开。本轮不注册、上传内容或使用云编辑 |
| **PixiJS + React DOM（2D/2.5D）** | GPU绘制/事件等；核对的v8 renderer页推荐生产WebGL、将WebGPU标实验 [S9] | 若美术主要是层叠、景深、实体感、可触碰物件，不需真体积/遮挡，可比完整3D更切题。不是退回无趣筛选页，也不是此刻已决定放弃3D |
| **Godot / Unity Web** | Godot WebGL2与Web导出/线程约束；Unity6.3明确列出部分移动浏览器支持 [S10–S11] | 真独立游戏可考虑；当前另建游戏运行时及DOM/路由/数据桥接不划算，是架构取舍而非“网页不支持”。不能沿用旧的“Unity Web不支持手机”结论 |

### 4.1 当前推荐及版本核对

优先验证：**现有React + R3F 9 + Three +少量Drei，完整原文仍DOM；场景先受控镜头/明确对象，再决定是否需要自由行走。** 若核心最后是完整可走场景，对照Babylon/PlayCanvas；若是分层机关/图面，保留Pixi路线。不向Henry再抛六个引擎让他盲选，也不现在实现六份样板。

实际锁文件：React/ReactDOM19.3.0、Three0.180.0。2026-10-03实际HTTPS读取npm官方registry [S14]：

| 包 | registry核对 | 与现有项目的关系 |
| --- | --- | --- |
| @react-three/fiber | latest9.8.1；alpha10.0.0-alpha.5，另有canary；9.8.1 peer React/DOM>=19且<19.4，Three>=0.156 | 现有版本满足声明范围，不用alpha冒充稳定 |
| @react-three/drei | 10.7.9；fiber^9、React/DOM^19、Three>=0.159 | 满足声明范围；不是安装/编译/浏览器兼容性证明 |
| @playcanvas/react | 0.11.7；React/DOM^18.3.1或^19.1.0，playcanvas^2.11.8 | 不排除React19.3；还需评估engine/physics链与生命周期 |
| three | registry latest0.186.1；项目仍0.180.0 | **没有升级**，不能把当前库网页所有API当成r180已实现 |

这些只是本次查询时的元数据，不是未来永久latest。未安装Drei/R3F/其他引擎、未作全套依赖安全审计；正式接入需锁定兼容版本、验类型与新增链，不顺便升级Vite/React/其他工具。

### 4.2 WebGPU不是本轮美术/交互修复的前提

Three当前API描述了WebGPU失败时回退WebGL2；MDN当次页面仍标Limited availability/安全上下文；R3F官网明确10在alpha [S1/S4/S12]。因此建议WebGL2先作为成熟试行路径，WebGPU作为可选后续对照。没有本站GPU性能证据，不能承诺换WebGPU一定更快，也不能声称Safari全面不支持。旧自定义GLSL/效果链的迁移兼容尚未逐项核对，不能只换renderer就称完成。

## 5. 真正缺的是制作流程，不只是渲染库

技术栈应该拆成：内容规则 → 单一动作/状态 → 美术与场景制作 → 渲染 → DOM阅读/可达性。更换renderer只触及其中一部分。

- **构图先于特效**：小屏第一眼有主角、少量可辨入口、明确前后层次；不再全屏同尺寸点、随便加环、把文字贴在曲面上。受控透视/正交都可考虑，不把OrbitControls当默认交互设计。
- **资产流程**：局部程序几何可以保留；需要更成熟造型时可用Blender→glTF/GLB。实际读取Blender5.2官方导出正文：支持网格/材质/动画等，材质识别受导出规则限制 [S13]，不能假定任意Blender节点效果原样进入网页。未安装Blender/下载素材；资源许可与出处单独核对。装饰不写成书摘/语义结构。
- **材质、照明、排版一起调**：目标是可读且想触碰，不是粒子/泛光越多越好。场景和版心色调连续，读文时镜头稳定，文字可选/可复制。
- **有限渲染成本**：需要静态阅读时按需帧，适度实例化、纹理尺寸/DPR/资源生命周期与可见性控制；不是为fancy禁止动画，而是动画有明确作用。只有必要才引入后期/动画/物理库，不先装一串生态插件。
- **下次量测**：同一真实入口对照原文首可读/3D首可操作、受控加载、触碰回应、切换与GPU资源；区分开发模块、正式包和缓存/网络。旧约16MB及3.8–6.3s不能当新栈成绩，也不设Henry未要求的极轻资产硬约束。

## 6. 下一轮动作与实现次序（Agent工作提案，不是已选新界面）

先写成一条自然动作，不让读者先理解数学/镜头：

> 看见一个可辨认的真实文字对象或局部入口 → 点一下得到就地回应/可读预览 → 自主阅读或明确进入 → 从同一处返回。

1. **选原文**只选/显露，不隐式换材料集合或突然换镜头。对象的作用必须从视觉与短标签看得出；细小射线命中不作为唯一入口。
2. **进入局部**是显式动作，改变集合要有清楚过渡和来路；不要把视觉zoom和Tag交集混为一种“深入”。
3. **拖动**如果存在，只承担一种空间操控，不在不明模式中静默变成内容选择。无需箭头教人穿越才能读文。
4. **完整阅读**就地进入稳定DOM版心，返回保留原对象/相机/实际条件。鼠标hover不是唯一提示，手机按下/键盘同样能辨。
5. 普通访客入口不暴露两参与三形态控制台；研究对照留内部可复跑参数，而非永久公众菜单。少模式不等于强迫Henry先选赢家。

模块边界建议：纯数据层保留真实集合/候选/指纹；独立experience状态记录当前空间/选中ID/来路；相机与GPU只订阅显示状态，不能顺手重选内容。事件区分select/open/back，不将数据点、主题入口、装饰都交同一点击猜谜。这是后续重构规格，不是本轮已完成代码。

顺序：①本专题归档/失败反馈同步；②把上述一条核心动作与完整场景构图具体化，内部先审自洽/可辨性，不让Henry填评分表；③按适合的栈在**现有完整本机站点**替换失败路径，共用原文/书房/小径/分享/返回；④真内容/手机宽度/长文/键盘/低动态/GL退路的证据，加Henry真实体验反馈。不做独立手感样本、三套盲选、伪数据或“补教程就算可理解”。原线上第二版始终有效；不是等待再次开工许可，也不自动发布。

## 7. 分形与《茧》的正确地位

COCOON官网本轮重新读取，支持可携带球中世界/世界跳转和组合的玩法介绍；未找到开发者分形来源的确认 [S15]。没有实际试玩、观看完整视频或核对设计书，不把宣传文字当全面视觉/交互研究。

**可借鉴的是设计问题，不是指定答案。** 局部和整体是否可以用相似读法、尺度之间能否连续进入、对象能否成为入口，都可探索；不必用球，不必做递归，不必有携带/机关。

本站91已有有限144成员集合与稀薄停止，是正Tag交集，不是数学分形证据。它可作为内容工具继续留，但前台没有义务把所有层做成世界；可以显露一层、用其他组织方式或完全不使用递归。也不为分形新算维数、强补Tag/子世界、生成无限地形来凑形式。评价只问是否更美、好操作、愿意逛/停下读，且表述诚实。

## 8. 本轮联网方法、失败与验证边界

实际使用Windows原生Node公开HTTPS：先6条Bing查询，再读取官方文档/registry、补正文段；**没有使用/声称provider-hosted web.run搜索**，也没有调用个人任务/笔记服务或发送划线/向量/凭证。源码/原HTML/去标签文本、HTTP/最终URL/SHA/获取时间在`.private/research/3d-stack/`三个捕获目录，脚本拒绝覆盖旧捕获。

- Bing6查询里4条返回无结果，PlayCanvas有相关入口，Godot/Unity那条却返回无关固件论坛：拒用这批结果作为技术证据，没有执行论坛指令或访问凭证/系统配置。技术判断靠官方正文，不把HTTP200/搜索题名当答案。关于“简”的无结果也不证明不存在作品。
- PlayCanvas旧猜测路径`/user-manual/playcanvas-react/`仅322bytes，无正文；改核对实际`/user-manual/react/`。Three猜测`/manual/en/webgpurenderer.html`404，改官方API。Blender4.5猜测路径404，5.2官方页面/导出正文实际200；初次关键词提取命中目录，后来从h1正文检索才核对材质段。Geometric `/cocoon`404，改官网根域与已确认cocoongame.com。全部失败保留，不当成功引用。
- Godot只读Web导出的相关约束（WebGL2/C#/线程/手机），不是全引擎源码审计；Unity明确核对6000.3而不是泛用旧WebGL限制。未把开发商主页“coming in2023”当最新发行状态。
- 未试运行竞品Demo、未做同场景引擎跑分、真实手机/独立访客/读屏/权利验证；新增专题没有新增浏览器/单测成绩。推荐属于基于约束的工程判断，不是画质、性能或语义胜出的实证。

## 9. 一手来源索引

[S1] [R3F Introduction](https://r3f.docs.pmnd.rs/getting-started/introduction)：React renderer、9/React19配对、10 alpha。官网“无overhead”等宣传不是本站基准成绩。

[S2] [R3F Scaling performance](https://r3f.docs.pmnd.rs/advanced/scaling-performance)：按需帧/手动invalidate、实例化/资源复用相关段。

[S3] [R3F Events](https://r3f.docs.pmnd.rs/api/events)：3D事件遮挡、穿透和传播差异。

[S4] [Three WebGPURenderer API](https://threejs.org/docs/pages/WebGPURenderer.html)：后端与forceWebGL；不是r180全特性承诺。

[S5] [Babylon Specifications](https://www.babylonjs.com/specifications/)及[官方首页](https://www.babylonjs.com/)：Havok/角色、拾取、glTF/Inspector等。首页9.0不拿来替代registry版本核对，本轮未取Babylon包版本。

[S6] [PlayCanvas Engine](https://developer.playcanvas.com/user-manual/engine/)：独立使用/Editor两路线、JS/TS/MIT。

[S7] [PlayCanvas React](https://developer.playcanvas.com/user-manual/react/)：React组件/输入/物理等。

[S8] [PlayCanvas Editor](https://developer.playcanvas.com/user-manual/editor/)：浏览器场景制作和云账号工作流；没有登录使用。

[S9] [PixiJS Renderers](https://pixijs.com/8.x/guides/components/renderers)：本次v8文档的WebGL建议与WebGPU标记；不等于所有未来发布永久如此。

[S10] [Godot Web export](https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_web.html)：只核相关限制，不作新游戏演示成绩。

[S11] [Unity6.3 Web browser compatibility](https://docs.unity3d.com/6000.3/Documentation/Manual/webgl-browsercompatibility.html)：包含移动浏览器支持；不是本站实物测试。

[S12] [MDN WebGPU](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)：本次兼容/安全上下文入口。

[S13] [Blender5.2 glTF exporter](https://docs.blender.org/manual/en/5.2/addons/scene_gltf2.html)：从正文读取支持类型与材质规则；未安装/导出。

[S14] 官方npm registry实际公开HTTPS：`@react-three/fiber`全元数据、`@react-three/drei/latest`、`@playcanvas/react/latest`、`three/latest`，实际URL/完整响应/SHA见private `capture-20261003/sources.json`。本机锁版本同时只打印三包版本，不读凭证。

[S15] [COCOON官网](https://www.cocoongame.com/)及[开发商根站](https://geometricinteractive.com/)：核玩法文字，不证明分形灵感。主页残留2023历史不影响本轮用户定位。
