# 105 — 随便看看的三种方式，与不跳位的潮汐

2026-10-26，本机 UTC+8。原完整站 5216，未上线。

## 反馈、授权与范围

Henry实看104后认为整体很好，河流基本满意，潮汐沙滩与水面也获肯定；仍指出选中后其他文字左右重排、放回又复位破坏空间连续性，文字与水的关系还不够自然。他提出近岸露出更多、远处部分沉没的启发，并要求重新讨论全站入口分工。

Agent提出取消选择驱动的重排、按实际岸线深浅显字，以及“随便看看：一句一句／河流／潮汐”和独立真实地图、五项主导航。用户明确认可并要求开始，随后要求继续；本轮是实施授权，不再停留在讨论。没有授权上线、新公开内容、远程模型或重新计算地图。

## 本机实现

- 潮汐保留获肯定的水岸、颜色和同rAF绘制。tidePlacement不再根据held修改x/y/宽度/字号；正文遮住的整条预览暂不绘制，其他字继续原水路，不为了保持旁文可见而重排。
- tideClarity根据该帧shoreline(y,surge)到文字位置的相对距离计算浅深，而非仅按屏幕左右变透明。浅处偏暖、较完整；深处偏冷、显示较短的连续原文前缀。布局与字符数组缓存，不逐帧重新测量，不挖随机字洞、不编提要。hover/focus可读完整预览，随时直接打开全文；reduced显示完整预览。
- 手机目录第5–7条归还时，不再把它插到第一位、推挤原有四条。它在600ms内作为额外归还预览沿原水路返回画面外，原七条ID/四个常驻槽位不换序，目录仍可再次阅读；减少动态时直接归还，不强制表演。
- 根路径随便看看容纳三种方式。首次默认一句一句，不先弹三卡选择；sessionStorage记住主动选择的方式。形式写入view=single/river/tide，h/真实Tag范围world/模型候选anchor均保留，query在现有根静态页面工作，不新增静态路由目录。
- 一句一句直接复用既有StageRoom、useStageSessions和selectNext公平抽取、长度偏好、出处、分享、下一句／同书再看动作。新增可选sessionStore，普通消费者不提供时保持原行为；本机按snapshot和实际范围记住单句周期，形式切换、离开书房再回到同一句都不丢原周期。范围内“下一句”不扩大到全库；原有同书再看仍是明确的临时同书动作。
- 切换不强制各形式使用同一候选顺序。已经留读的原文跨三种方式保留；未留读时切河/潮不自动选句，也不把未显示的随机ID写成h。水的时钟在形式/房间往返中留存，河流排布与绘水未重设计。
- /map不再被PlayWorldRoom截获，恢复真正的MapRoom和既有可阅读地图功能。旧正式地图h/tag/book地址继续有效，未重算点位、地形或语义关系；旧实验/map入口如今是地图，水岸请用根路径view参数。
- 本机主导航为随便看看／主题小径／世界地图／书架／关于；书架下“全部书籍／按书籍主题”均保留原URLs，不混淆书籍Theme与划线Topic Tag。普通public/local仍使用原六项导航及原单句入口；本轮整合只在显式play-private/play-static-check生效。
- 单句第一轮截图捕到整块room-enter淡入中的灰字。计算样式确认正文实际颜色为#f0eee5，而外层stage处在入场动画；取消本机单句形式切换时的整块入场动画，保留下一句自身的原过渡，并重新实读明亮正文截图。不是修改原文颜色来掩盖问题。

## 命令、结果与失败留存

起点60b5d22、干净工作区；沿用PID24888。没有新增依赖或外部素材。

- 首typecheck因exactOptionalPropertyTypes拒绝显式undefined的form、lint因旧held参数未使用失败；显式允许可选undefined、标明兼容参数不参与布局后通过，不放宽strict/lint。
- 首4项Chrome文字流回归1过3红：未留读时切模式误把内部随机ID打开，造成7/4入口被正文遮挡。修复形式切换仅保留真实阅读状态；原三个入口数量/分离断言不变，3/3重过。
- 新整合首2过2红：测试误写.map-room，实际类为.room-map；核对DOM后改为data-room=map，后续还要求map-canvas可见，不改应用来迎合错误选择器。
- 完整文字流Chromium/WebKit各19，**一次38/38（13.0分钟）**。含44秒更新、同帧水字/纹理缓存、正文与全部Tag/分享/书房、范围返回、320/390长文、减少动态、Canvas退路与端点隔离。仍沿用104的每模式独立150s预算，不据此声称WebKit运行成本已解决。
- 之后补单句周期缓存与取消单句整块入场动画；针对最终代码完整整合**10/10**，覆盖两引擎×宽窄三方式原文/下一句、书房往返后commitCount仍为1、真实地图/书架分组、真实Tag内抽取与刷新，以及宽屏常规拾取、窄屏目录第七条归还时其他位置不变。没有把此前38称为这些后补代码之后又重跑38。
- 最终静态Pages**4/4**：两引擎×宽窄，只用旧批准公开输入→private静态目录，三种方式保留真原文、根子路径刷新、分享/书房返回、无private API或外部资源请求。原地图静态文件也仍可访问。
- npm run check：**68文件464单测**、typecheck、lint、真实public数据/terrain验证和正常build全部通过；isolation:public、publication:verify、validate:data:local通过。local仍4663条/130本，未标Tag状态不改。
- 新模拟touch390拾取/放回2/2；真实最长h-231原生wheel只滚正文与End边界2/2，均非物理手机。
- public snapshot、public terrain、1024维缓存向量的SHA256与104逐字一致（ccef39…c53a7c／a94db8…b1f7／49dbdb…14431e）；未改public内容范围、Tag或坐标。常规build用于检查，不是发布。

主要回归命令：
```powershell
npm run check
npm run isolation:public
npm run publication:verify
npm run validate:data:local
npx playwright test --config e2e/config/playwright.text-flow.config.ts
npx playwright test --config e2e/config/playwright.browse-water.config.ts
npx playwright test --config e2e/config/playwright.text-flow-pages.config.ts
```

证据独立在.private/review/browse-water：unit-first、e2e-first失败、e2e-fixed、e2e-complete，integration-first/final/finished/closeout，static/static-finished，check/isolation/publication/local，protected-hashes；final双引擎宽窄两种水景/held/return/整站，long-final，touch-final。辅助脚本在.private/research/browse-water，未覆盖104脚本或图片。实际读取最终Chrome1440潮汐、WebKit390潮汐留读、Chrome390单句，以及恢复的手机地图；首暗字及失败图保留。

## 本机入口与未验证项

- 根路径 http://127.0.0.1:5216/ ：随便看看，初访一句一句。
- /?view=tide 与 /?view=river ：直接水岸/河湾；/map ：真正世界地图。
- 原完整站PID24888继续监听，不新建隔离样板、不push/deploy。

2026-10-26后续：Henry已实看105，明确评价效果非常好，认为可准备上线，但希望先完成最后一轮地图坐标优化；讨论后已授权实施，见106。105不再是待首次体验状态，但本次肯定不自动覆盖106新地图或未来发布授权。真实手机/Safari、读屏、独立首访、实际200%缩放、低端长期与字体矩阵仍待。未重复104固定时长性能观测，不能把其数值当105新测；WebKit成本原因仍未全定位。深浅是原创光学呈现，不是流体仿真或语义坐标。无新模型/WeRead抓取、公开导出、账号后台、遥测或部署。
