# 100 — 河流与潮汐：多处真实文字的整站两稿

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

## 未验证与下一步

补齐两形态多个文本/实际点击与原文/留住不被自动替换/续流/放回/来源分享与来路/主题及真实模型范围/失败降级/暂停与减少动态/手机与长文/子路径静态浏览器；串行完整check/隔离/投影/local校验及新图证。独立首访、物理设备Safari/读屏、长时/低端、字体矩阵与最终美感/自然性仍未过。不能仅以这些工程数量证明文字模式胜出。无push/deploy/远程模型/新数据或公开范围许可。
