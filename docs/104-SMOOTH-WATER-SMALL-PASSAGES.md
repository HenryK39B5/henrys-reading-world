# 104 — 连续水面、小巧文字与干净交接

2026-10-25，本机UTC+8。

## 用户反馈与本轮授权

Henry已实看103，认为更精致、喜欢，同时指出潮水进退有卡顿、潮汐选中后正文先出而背后残影迟到，漂流大句尤其大字突兀。漂流瓶仅启发“小巧的相遇再展开”，明确不需把文字放入瓶子。Agent先提出连续运动/干净交接/小巧两行预览与整站元素收敛，用户本轮明确授权实施。沿既有水岸方向，不加瓶子/贝壳/纸片卡片/玩法、声音或发布。

## 本机实现

干净a2792e9开始，原完整站5216/PID26520不另起环境。

- 移除每32ms才画文字/每80ms更新整张水面的双频节流。水与字同一requestAnimationFrame、同一elapsed；低分辨水层仍640px，但现在每帧重画移动岸线、湿岸/浪头，与文字同帧合成，正文/预览仍高分辨清楚。
- 静态岸纹/水色/细纹缓存成3张有界画布，路径缓存Path2D，仅实际尺寸/模式变化重建；实际移动边界不缓存时间帧。减装饰线/反光，替代每帧生成整套纹理；缓存不受字体ready无谓重建。离屏/暂停/reduced仍停止，失去Canvas仍原生目录/完整原文退路。没有引入WebGL/新库或远程图片。
- 可点目标用transform移动，width/height/visibility只在改变时写；先读几何、后写目标，缓存7个原生按钮引用，不每帧隐藏再显示/全量查询。诊断计数记录同帧waterFrames、textureBuilds和JS绘制提交耗时；不是GPU/显示器帧率。
- 去掉460ms重复预览飞向已出现正文的ghost。选择在layout effect中立即重绘清除旧预览，DOM全文即刻稳定，没有两份文字互追。原生hover/focus保留提示。归还仍分河/潮路径，1100ms收短至600ms，不改h/anchor/实际内容范围，归还期间保留ID。
- 潮汐宽屏预览18–21px、手机17–19px，全部最多两行，7宽/4窄真实可辨入口仍在，缩预览不截全文。保留按书偶遇与全部Tag，不编造提要。河流同样两行18–20px、稍窄，列间轻微错相，不挤成一排。取消每条下方弧线托底，不做小卡片/容器。标题桌面40→32、窄35.2→28px，桌面正文稍收至约21px、手机全文仍约18.7px和原生长文滚动，不缩触摸44px目标。

## 性能观测与未采用试验

使用同一台Windows、同一5216完整站、同一脚本，每引擎×1440/390各一轮真实31秒rAF观测（不启虚拟时钟/trace），覆盖停留/退水/下一次来水；真实句随机不同，非严格内容固定A/B，不能泛化到真实Safari/手机/低端、生产冷启动或GPU帧率。旧版本before在修改前实际采集。

| 引擎/宽度 | 旧绘制间隔中位/p95 ms | 最终采用分层方案中位/p95 ms | >50ms间隔次数旧→新 |
|---|---:|---:|---:|
| Chromium 1440 | 33.2 / 50.6 | 16.7 / 19.2 | 50 → 1 |
| Chromium 390 | 33.4 / 44.6 | 16.6 / 18.5 | 6 → 1 |
| WebKit 1440 | 41 / 68 | 29 / 40 | 260 → 1 |
| WebKit 390 | 38 / 63 | 27 / 39 | 225 → 1 |

每种新条件纹理构建计数为1，不是每帧新建；WebKit依然不是稳定60fps，性能仍需继续真实设备验证。旧WebKit390一处1058ms停顿保留，原因未独立定位，不一概归因水面。新JS提交p95约Chrome7.1/6.4ms、WebKit14/13ms，不含GPU最终显示成本。

曾试全分辨率主Canvas直接画水（after-first），Chrome改善明显但WebKit桌面36/50ms；改为640实时水层+高分辨文字（after-layered）后桌面29/40ms。随后尝试文字位图sprite缓存（after-sprites），WebKit29/39、27/39，与分层方案没有明确额外收益；撤回该缓存代码，不增加内存与复杂度、不称其优化成功。三份观测与before均保留private，最终选after-layered实现。

## 第一阶段证据

- typecheck/lint通过；3文件19纯测过（原17加两个两行/小巧字号契约，另600ms归还边界补断言）。一次edit因lines3非唯一匹配被拒后改具体上下文，没有部分覆盖。
- 新首Chrome18/18（2.9分钟），旧17个行为检查保留，新增同rAF水/字帧计数与纹理不重建、小巧预览hit高度/44px、无pickup ghost与正文不动画检查；旧实际水/字同步1px误差仍保留，不降断言/timeout。
- 新双引擎宽窄两形态/held/return首图完成，实际readChrome1440tide（主Canvas绘水阶段）；最终分层方案新图/完整双引擎/静态/check隔离与SHA待收口，旧103图不覆盖。

## 第二阶段验收与交付

- 初完整双引擎35/36。WebKit原单例顺序推进河流44秒+潮汐44秒，逐帧绘制增加回调量后耗尽150秒测试时限，错误快照的article及原文仍在；不能把expect后续未执行误读为正文被带走。日志/trace/原失败保留。重组为按模式两例：各自仍44秒、全部原文/候选更新/去重断言与单例150秒不变，另验证切换模式后原文保持。总允许测试预算增加，属于测试组织调整，不称修复原单例性能或真实WebKit卡顿。
- 新38项完整运行被外层中断，不是测试红灯：中断时33项已过（Chrome19、WebKit14），含两个WebKit44秒单例及切模式；用户要求继续后核对进程/日志，再补WebKit6项（含重复320长文1项），6/6。**最终38项逐项覆盖，不称一次38/38完整运行**。新同rAF/纹理缓存/小巧两行/44px/无ghost，以及所有先前真实原文/ID/全Tag/书房分享/范围来路/长文/reduced/Canvas退路断言保留。
- `npm run check` **67文件460单测**、typecheck/lint/真实public数据/terrain/build通过；isolation:public、publication:verify、validate:data:local通过。public snapshot/terrain/1024向量三个SHA与103一致：ccef39…c53a7c、a94db8…b1f7、49dbdb…14431e。普通public产物仍第二版，local4663/130、2969未知Tag警告仍诚实。
- 新static Pages双引擎×宽窄 **4/4（52.9秒）**；仅旧批准公开输入→private静态产物、无private API/外部资源、子路径/分享/刷新/真实原文均验证，非发布。新hasTouch390双引擎tap/放回2/2、真实最长h-231原生wheel只滚正文及End探针2/2，非物理设备/读屏证明。
- 最终分层版专用`final`双引擎1440/390×tide/river含held/return/整站，实际readChrome1440tide和WebKit390tide-held；新long-final/静态图独立，不覆盖103或本轮first。最终capture第一次ERR_CONNECTION_REFUSED：中断及测试后已无5216 listener，检查确认后只重启本workspace Vite，截图时PID11060，重新capture/长文/touch正常；收口再次检查发现该listener已退出，原因未独立定位，以Windows Win32_Process仅启动本workspace Vite、无配置/安全控制改动，**当前PID24888/127.0.0.1:5216**，跨工具复核监听及/map HTTP200；不把进程不存在说成应用绘图失败，原失败log不删。
- 私有懒块`PlayWorldRoom-CGrwPFvB.js`73,254B/gzip26,564B，CSS`PlayWorldRoom-DwjtKIMZ.css`13,163B/gzip3,056B，非全站总量。没有新依赖素材/模型调用或安全审计结论。
- 证据在`.private/review/water-finesse`：before/after-first/after-layered/after-sprites性能实测、first/final/long-final图、e2e-complete初35/36、e2e-final中断33过、e2e-resume6过、check/isolation/publication/local/pages/touch日志，必要UTF16日志另转UTF8。脚本在`.private/research/water-finesse`。基础commit e6b91c2，续以验收/测试拆分/文档小步本地commit。

## 未验证

不将103正面反馈当104通过，本轮新实际美感/顺滑体验待Henry同站看。真实手机Safari/读屏/独立首访/实际200%/低端长时仍待，WebKit首帧/运行成本未全定位，实测仍不如Chrome稳定。性能为同机单轮、随机不同真句条件观察，不是固定语料A/B或GPU/生产指标；无声称所有卡顿已消失。无新依赖/素材/WeRead/模型/Tag/向量/生产点位地形/公开范围/push/deploy，随机一句/普通local/线上第二版不变。
