# 79 — 第二次上线准备：站点识别与地图首帧

日期：2026-09-28。状态：**本机准备完成，待 Henry 验收与另行授权推送**。`master` push 会触发公开部署；本文不是部署许可。第一次线上站点仍作对照，原有公开范围（108 本／3,462 句／56 标签／108 封面）与已审核地图点位、地形数据不变。本轮公开的是此前仅本机完整网站已体验过的可阅读地图／跨书真句对读（见 `docs/77–78`）和本轮较小的包装及首帧修正，不新增内容审核决定。

## 1. 站点图标和页面外观

- 用户指向 Blogverse skill；按其 `SKILL.md` 只读 `F:\Working\Blogverse\_config.yml`、`_config.volantis.yml` 与 `img/Blogverse/img/wood-cabin.png`。博客使用彩色木屋 favicon 与导航 logo；**本站未复制博客图标、文章或配置**，而是独立设计夜色方角内「打开的书＋一点暖光」：书对应原文、点对应真实地图位置，16/32px 仍可辨。不把徽章/地图标记当站内主导航图标。
- `public/favicon.svg` 是唯一设计源；`scripts/generate-site-icon.mjs`（`npm run icons:generate`）生成 `public/favicon-32.png` 和 `public/apple-touch-icon.png`；二次生成PNG字节一致。两张PNG是SVG不适用环境的标签页备用和主屏快捷方式图标，**不是PWA或应用安装功能**。独立16/32/64像素浏览器截图在 `.private/review/release-b/favicon-{16,32,64}.png`，180px 原件已目视检查。生成脚本复用现有 Playwright，无新依赖。
- `index.html` 使用 Vite `%BASE_URL%` 指向 SVG、PNG备用和touch图标，兼容 Pages 项目子路径与书房等深层静态入口；追加深色浏览器主题色，简化文档描述为「从真实划线出发……」。Pages式 Chromium/WebKit 在 `/books/<id>/` 校验图标绝对地址、资源200、SVG/PNG MIME 与PNG签名，没把 `favicon.ico` 当作已实现；图标最终是否合Henry审美仍待其看本机真站。
- `README.md` 加入低对比四枚技术栈徽章（React / TypeScript / Vite / Playwright，徽章图片由第三方服务提供，仅 README 展示，不进产品运行时），区分当前已上线版本与**尚未发布的第二版**；图标源与生成方式可由维护者复现。未增加站内统计、营销文案或伪造版本/发布状态。

## 2. 「先旧图后新图」的真实原因及修复

**不是已经证实的浏览器缓存问题**。现行 `MapCanvas.tsx` 在地图 snapshot 随应用加载时先用其中旧密度网格和旧等高线绘制Canvas；`useEffect` 随后异步 `fetch` `src/data/public-map-terrain.json?url` 的新地形，得到后才切换 `data-map-study=ready`、WebGL/Canvas2D地形与新等高线。同一新浏览器上下文延迟地形请求1.2秒，实测 `first:null → ready`，旧轮廓短暂可见；不是需要让访客清理浏览器缓存。无关的页面入场渐显也可能在该瞬间叠加视觉变化。

- 仅对**公开消费者模式**：改从已经过 `map:terrain:verify` 的项目内 `public-map-terrain.json` 直接同步导入，并作为首帧地形状态；首次画地图就是现行地形，不再先画旧快照轮廓、再切。Vite标准开发预览中同一延迟请求探针变为 `first:ready → ready`、单独地形请求0次。生产 Pages 子路径新冷启动在 Chromium/WebKit 均首见`data-map-study=ready`；浏览器测试故意中断旧地形文件网络请求仍能画完真地图。
- **隔离研究模式**继续从`/__map_study`取研究地形，**本机私有范围**继续从`/__local_map_terrain`取本机地形；保持它们现有异步加载与请求失败时的旧Canvas保底，不把私有地形、向量或研究数据打入公开JS。针对研究模式/本机地图另有回归，不声称它们也获得零切换首帧。
- 工程取舍明确：原公开JS约353.24KB（gzip108.62KB）加按需单独地形JSON约117.40KB（gzip32.08KB）；现在JS约470.17KB（gzip142.92KB），地图少一次异步地形请求，但**所有页面的JS首次传输约多34.3KB gzip**。不能说全站加载更快；需Henry查看实际冷启动观感，未来若确有性能瓶颈再考虑地图独立chunk/按路由预取，而不是通过重新引入旧图快闪来省体积。没有测低端设备首屏耗时。

## 3. 本机证据与失败记录

- `npm run icons:generate`二次一致；`npm run check`：57个文件／388个单测、类型、lint、公开数据与地形校验、构建通过；`npm run isolation:public`干净；`npm run publication:verify`核对108本／3462句／108张封面、固定地图、生产快照与184个静态房间通过（权利审阅非该命令所能推断）。快照/地形SHA256沿用：`ccef39e7410ba7dd1618a8038762933464dd35c45a98f5fa48fb5e8c02c53a7c` / `a94db8433431677be758f4ae4926df9a44bbda762bd75a20698a4f0c4c58b1f7`。
- Pages式生产构建 Chromium10/10、Playwright WebKit10/10（含1440/390/320地图、图标、冷启、深层静态路由）。地图消费者专项 Chromium18/18、Playwright WebKit18/18，保留完整真图路线；现有本机私有地图 Chromium14/14；隔离地图 Chromium14/14、WebKit地图稳定性1/1并有WebKit context-loss测试按设计跳过。最终地图各宽度的两引擎截图复制到 `.private/review/release-b/world-{1440,390,320}-{chromium,webkit}.png`；`favicon-{16,32,64}.png`供低分辨率目检。WebKit自动化不等于物理Safari/iOS。
- 第一条PNG生成命令受PowerShell引号影响失败，改为跟踪可重跑脚本；脚本第一轮误用 `.mjs` 不支持的TypeScript `as const` 导致语法错误，去掉后重跑成功。首次全量Pages WebKit地图测试在5秒内尚处于「正在读取真实划线数据」而超时，其余19/20已过；独立WebKit复跑通过，随后将**仅该地图三次冷启动**测试的等待设为20秒／用例90秒，再完整重跑20/20通过。没有将快照加载慢归咎缓存、也没以扩大测试超时证明性能已经优化。最早的旧首帧/新首帧截图在一次探针复跑时被覆盖，仅首尾状态与当时已查阅的画面在执行记录中保留；不能说有持久配对原图。图标/地图在本机真浏览器截图和测试通过不等于Henry的最终视觉选择。

## 4. 2026-09-29 全站发布回归补充

- `npm run test:e2e` 本机完整真实数据站点 Chromium **130/130**（跨房间导航、键盘、地图、分享、320～1440px、200%等效视窗以及部分Chromium真放大）；`npm run check:local` 57文件/388单测与130本/4,663句本机快照校验通过，本机草稿主题继续诚实保留。公开 `npm run test:public` 最终 Chromium **9/9**；`npm run check` 57文件/388单测、类型/lint/公开快照与地形校验、构建通过，`npm run isolation:public` 与 `npm run publication:verify` 再次通过（108本/3,462句、108封面、184静态房间）。改动后的最终生产 Pages 子路径专项 Chromium10/10＋Playwright WebKit10/10，包含真图首帧和深层书房图标。
- **失败保留**：第一次 `npm run test:public` 为 **8/9**，并非地图或favicon回归：`e2e/public-release.spec.ts` 仍断言旧技术文章文案「不重新运行 UMAP 或移动剩余点」，实际页面早已写为「不重新运行 UMAP，也不为发布移动点位」。改测试为精确当前边界；另将`TechnicalRoom.tsx`中「公开地形是JSON资源」改为准确描述当前**构建时预备、首次地图绘制即用**，并增加相应断言。随后完整公开9/9及上述全套检查通过；不把首轮失败抹去，不改变地图坐标/原文/范围或分享契约。
- 当前本机预览`http://127.0.0.1:5212/`仍在响应且提供最新源码，可供 Henry 看完整站点（预览端口是临时进程，失效时依 README 本机命令重启）。自动化WebKit仍不是实体Safari，全部测试通过仍不构成内容权利/访客审美或部署许可。

## 5. 还值得完善什么，以及正式发布前的决定

这轮已做的是**跨页面识别的一致性**（Tab／主屏／文档描述／README），而不是在视觉上继续添加装饰。建议的下一优先级：

1. **Henry本人看全站**：浏览器Tab的16px书/点图标、地图从首页进出的首帧与窄屏；若图标不像这个世界，宁可微调一枚图标，不堆多枚装饰。读第二段长划线时地图可能离开手机视口，本轮没解决，列为明示取舍。
2. **访客不需解释也能懂的出处**：首访在站内能区分「文字来源于Henry的真实微信读书记录」与「项目中的微信读书skill只是离线取数工具」，而不是把工具包装成用户功能；相关M-06在`docs/48`待做，不擅自写未经Henry确认的权利/合作说明。
3. **分享预览只在有明确真句/书信息契约后再做**：当前静态HTML复制到所有房间，不能给每个highlight凭空生成独有社交封面；如果追求分享品牌辨识度，先定稳妥的通用封面或逐房间meta/高亮ID预览策略，再真实核对第三方抓取，不把同一假封面归给不同原文。这不是本轮上线必需项。
4. **设备与权利**：实际手机/物理Safari、读屏、浏览器真实200%、低端设备、首次访客与划线/封面权利判断仍依`docs/47/48`单独决策。公开范围未变≠出版许可已被技术测试证明。

下一个Gate：Henry看本机完整网站并确认视觉/首帧/移动长②可接受，选择是否允许推送当前公开仓库`master`（自动触发Pages部署）；在确认前不push、不部署、不改公开内容范围、坐标或地形。
