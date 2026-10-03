# 93 — GitHub Pages约束下的新阅读场景重构

日期：2026-10-03（UTC+8）。接92，Henry明确把技术栈选择交给Agent，硬约束为最终GitHub Pages静态部署，并要求继续推进；不是新一次push/deploy许可。

## 1. 已选技术与实现动作

Agent选择现有React/TypeScript/Vite + Three0.180.0 + R3F9.8.1 + 按需Drei10.7.9。不再让Henry盲选栈或先选赢家，不上alpha、不升级其他工具。静态资产/DOM正文/原路由、项目base路径；不需后台、SSR、登录、模型服务或远程统计。R3F管理场景/资源/事件，Three渲染，Drei只取圆角几何/本地生成环境/DOM锚点等实际需要的组件；不取远程HDR/字体预设、物理或游戏框架。

本轮Agent实施方向：**书页之间**——可辨识的真书/真划线对象，受控镜头，一次选择就看到真实原文；明确“从这页继续”才重组这片书页，明确主题进入/返回。不是已被Henry认可的最终美术/产品核心。球、分形、人物与自由镜头不作前置；不再公开两参与×三形态控制台/方向器。

数据与布局分开：真实anchor与最多6个其他页面，模型已有候选与按书偶遇分别标注，不把补齐偶遇当相似；场景摆放只是构图，不使用生产坐标/地形、不声称语义距离。条件Tag工具保留真实交集/实际来路/未知/稀薄停止，但前台不制造无限世界。全库可由按书偶遇、书房/小径进入，不为画面数量丢原文。

## 2. 内部阶段一：静态架构与纯内容动作（完成）

- 实际精确安装R3F9.8.1、Drei10.7.9：新增47包，既有Three/React/Vite不升级；npm仍1 high，未运行audit fix或宣称干净，后续核对归属。新增`src/domain/playExperience.ts`与`tests/play-experience.test.ts`。
- `readingPages`绑定真实anchor/原文/ID，依次真实模型候选与明确偶遇，按书优先、去重、有限稀薄；固定anchor时选择不改变页面布局/候选。`readingFrame`校验局部身份，`readingAddress`分开h与anchor，参数而非数组位置适合静态目录URL；只显示采样RNG可注入/复跑，不造文本。
- `npx vitest run tests/play-experience.test.ts tests/play-world.test.ts`14/14；`npm run typecheck`修复后通过。首次场景TS发现nullable纹理与class override四错，实际修复；未关strict/lint规则。pure测试用现有公开真实材料，坐标/邻接仅明示数值夹具，不fake书。
- 整站草稿已用新Scene替代旧Map实验分支，旧PlayScene保留Git/源码对照；第一轮Chromium/WebKit×1440/390真实截图4例均一canvas、无pageerror/横溢出，5.034/3.256/21.863/16.871s仅本机不受控开发样本，未称真机/性能胜出。
- Agent已读取1440/390首图：封面太小、底座空大、标签仍显杂，不能以4例可运行称视觉收口；保留首图继续重做比例/展开动作。本阶段不新称美术/可理解Gate通过。

## 3. 内部阶段二：原整站场景/阅读/Pages静态证明（进行中）

`PlayWorldRoom.tsx` / `ReadingScene.tsx` / CSS在原完整网站共用书房、小径、分享与返回；选择不改相机、不改anchor，“从这页继续”才打开下一片。“换一片书页”是全局按书偶遇；主题入口与原文对象分开。完整中文正文继续DOM，不贴旋转物体取代阅读。缺封面/GL/数据失败仍真实阅读，live reduced-motion需验。

新增显式`play-static-check`构建模式：**只读既有批准公开snapshot/covers，不含private向量/新内容**，产物仅`.private/play-static-check`，常规public/local原第二版不动；尚需实际build/静态服务器/浏览器证据。没有图数据时走明确偶遇，不称模型候选；本机有图时仍fixed只读端点。最终若要公开模型派生关系须单独审其批准范围和静态导出；本轮不自动导出新snapshot/Tag/生产地形或发布。

Pages兼容需验证子路径`/henrys-reading-world/`、真实map/h/anchor/主题URL刷新与Back、书房/分享、所有资源同源、离线/GL退路，不用运行时API/自定义服务器/COOP/COEP要求。静态试验不能偷用localhost私有端点来冒充Pages成功。

待验：新交互/触屏/长文/320/200%/GL损失恢复/资源清理、静态Pages、性能计数与Henry新视觉/自然性反馈；原20/419不是本轮新成绩。独立首访/实物Safari/iOS/读屏/权利仍另行未知。无push/deploy/新模型/WeRead/公开数据或生产点位地形修改。
