# 103 — 水岸的连续阅读与细部打磨

2026-10-25，本机UTC+8。

## 反馈与授权

Henry已实看102，明确说比此前效果好很多、开始有意境，认可设计方向，同时强调不完美、继续打磨画面与体验。不是仍待102首次反馈，也不是所有艺术/访客/真机Gate通过。Agent建议保持水与字的一体方向，优先拾取/放回连续性与手机长文，再细磨水质地；用户本轮明确授权开始调整。不重开范式、不加模式/声音/收藏任务，不将建议全项宣称已完成。

## 施工

干净`f6dfa5e`开始，现有完整本机5216/PID26520继续运行。

- 移除整个article凭夹紧位移滑入的CSS动画。DOM全文立即固定在阅读位置，从实际点击的真实预览位置向首行绘制460ms渐隐过渡；不是逐字全篇物理变形。键盘/目录/深链没有可见来源时不伪造飞入位置，reduced取消过渡。选择仍只改h，不暗改anchor/真实范围。
- 新纯函数readingTransfer让潮汐横向靠/离岸与河流弯曲回流有所区别，保留1100ms主动归还，少文字时不造补位。归还期间阻止同slot或整批更新抢走该ID，reduced即时返回。手机从目录选中第5–7条后放回，会移入实际四个可见slot且去重；仍只原有真实句。
- 原文body单独原生滚动，顶部放回/底部继续阅读提示不跟正文卷走。按真实scrollHeight/clientHeight判断还未结束，短文/读到底显示“原文至此”，不是计时/阅读完成评分。可点向下读或原生滚轮/touch/键盘；文章获得焦点时Arrow/Page/Home/End驱动正文，子控件默认键盘不拦截。换句/重新打开从头，切换潮汐河流保留scrollTop。
- 手机原文与漂流预览保持边界和可见水面，不用扩大卡片/倒计时；完整文字/来源/全部Tag/分享/书房/真实范围/返回仍在原DOM。滚动区ResizeObserver检测换行和尺寸变化，避免每帧React更新。
- 原创水画面增加细微岸线起伏、三层湿岸、静止细砂纹/局部浅水亮色/非整条高亮浪线。保持640px离屏水层80ms刷新与清晰文字分层，不加外部图/新库/模型，减少反光短线64→40抵消新增装饰绘制。整体来去/36秒浪潮与44秒河道规则不改；节奏差异暂不扩大，以免打乱已获肯定的流动。

## 第一阶段实际证据

- `npm run typecheck`首报pickup闭包nullable，局部const保留窄化修，未放宽strict；随后typecheck/lint通过。
- `npx vitest run tests/reading-motion.test.ts tests/water-world.test.ts` 2文件12测过（6新：路径端点/区分/有界/非法输入/短文无假提示/长文头中尾）。
- 首完整Chrome17/17，旧14例不降断言，新增320/390最长原文边界/键盘End/换句复位，以及目录第七条在手机可见归还/去重。随后长文测试补切换模式保持阅读位置，将一起全量复测。
- `private/research/water-polish/capture.mjs`在原完整站双引擎×1440/390×两形态/held/return，first独立证据，无pageerror；实际readWebKit390tide-held、Chrome1440river。另`long-reading.mjs`用实际最长原文，两个引擎390原生wheel只滚正文不滚document、End/真实末尾通过2/2；新beginning/middle/end图，实际readWebKit长文beginning。均非物理手机或读屏证据，不用旧102图充本轮。

## 第二阶段收口

- 完整接入原站，不改变选择/范围分工。第一次整套双引擎34/34、static4/4后，实际读新WebKit390river-held发现阅读区下缘还会露出被clip的半行漂流文字。修为整段进入阅读区时不画，不留下碎行；仍在后台沿原水路走，不停止全流。手机长文时可没有其他可读预览，水面仍在，优先安定全文，不强塞片段。
- 上述实图问题修正后，**重新一次完整双引擎34/34（各17，9.5分钟）**；原14例全保留，新320/390长文滚动边界/底部提示/End/切模式留位置/换句复位、手机第七目录句归还可见/ID去重均通过。没有放宽旧断言/timeout。完整check **67文件458测试**，typecheck/lint/data/terrain/normalbuild通过；隔离/publication投影/local校验通过。static新4/4（约1分钟），不是102结果移用。
- 再看桌面长文图，发现正文已结束但下方还有出处/操作时，“原文还未结束”不准确；仅将提示改为中性**“继续向下阅读”**，不把滚动区长度冒充正文长度。这最后文案调整后type/lint、320/390×两引擎定点4/4及新静态4/4通过；不称此后又跑了一次完整34。最末真实最长原文wheel/End探针2/2也重跑，有`long-copy-final`图。
- `long-final`/`long-copy-final`使用实际最长h-231，双引擎原生wheel只滚正文不滚document、键盘End到真实末尾；新hasTouch390tap/归还2/2，非真机。纯测试先12/12，新6已并入458；初TS失败与截图发现的问题均如实保留，无新的浏览器红灯/超时被隐藏。
- 新`first`/`final`/`finished`/`long-reading`/`long-final`/`long-copy-final`/`regression-final`/`static-copy-final`相互独立。实际read最终Chrome1440river-held、WebKit390长文beginning，以及前一轮Chrome1440tide/首两图；不拿截图当动画实测，交互由原生点击/hover/键盘/虚拟44秒续流/归还状态验证。旧102证据不覆盖。
- 正常public仍同名旧JS/CSS/JSON；三个protectedSHA与102完全一致（snapshot ccef39…c53a7c、terrain a94db8…b1f7、vector49dbdb…14431e），local仍4663/130。仅静态检查私有懒块`PlayWorldRoom-C5EDGIY8.js`73,091B/gzip26,450B、CSS`PlayWorldRoom-fKe0gBr4.css`13,150B/gzip3,060B，非全站/帧率/生产成本。无新依赖或素材/远程请求。
- 命令与日志在`.private/review/water-polish`，完整e2e-final/check-final/isolation-final/publication-final/local-final/pages-final，文案定点copy-final/pages-copy，截图脚本和touch/long-reading在private/research/water-polish。基础本地commit `1bc8d33` 接整站本地commit；原PID26520/127.0.0.1:5216继续，文档103/102/08/48/AGENTS/README同步。

## 未验证与下一步

本轮工程交付，待Henry在同完整站实看，102正面反馈不转移为103美感/自然性已过。独立首访/物理手机Safari/读屏/实际200%/低端长时与WebKit偶发首帧慢仍待，本轮没有声称其根因已定位。周期节奏仍用102稳定基础，未增加变化/新模式/收藏声音等功能。主入口随机一句/线上第二版、公开范围/Tag/向量/生产点位地形不动，无模型/WeRead/新依赖/外部素材/push/deploy。
