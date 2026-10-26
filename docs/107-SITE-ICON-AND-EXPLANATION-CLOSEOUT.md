# 107 — 页签图标与介绍页收尾

2026-10-26，本机UTC+8。起点b2f1ff1，干净工作区；本轮完成本机打磨与公开构建检查，当时未push/deploy。随后Henry明确认可地图并授权公开替换，[108](108-PUBLIC-WATER-AND-MAP-RELEASE.md)接续完成正式public迁移与发布；下方为107历史过程。

## 用户要求与范围

Henry确认106是本轮地图算法优化的收口，要求整体整理准备上线，并特别强调：迁移网站结构，不把完整本机内容带上线；线上使用单独审核的一套内容。本轮具体要求先优化SVG页签图标，以及网站设计/技术实现等介绍页面。

本轮不继续算法探索，不抓取WeRead、不改Tag/原文/向量、坐标或数据范围。不把“准备上线”当作立即push的指令。图标和文章代码可以进入正常公开构建，但上线仍保留现有线上版本，正式新结构迁移见下方清单。

## 图标

- public/favicon.svg从较具体的书本轮廓，改为深绿圆角底、两道暖白书页/水纹线、一点暖色；保留阅读识别，也呼应河流/潮汐。不添加地图细线、字符或复杂渐变；完全原创SVG，无新素材/模型/依赖。
- 现有icons:generate从唯一SVG源重新生成32px PNG和180px touch图标；重复生成字节相同。没有新增PWA/安装能力。
- index.html三个资源保留BASE_URL，附同一版本参数v=water-1以区分此次资源。深层书房及技术页都校验实际SVG/PNG地址、内容和200响应；不改站点子路径协议。
- .private/review/site-finish/icon-sizes.png保留新旧在浅/深背景16/20/32/48/64px对照，另有独立16/32/64图。已实际读取对照，线条在小图上有区别；这是浏览器光栅效果检查，不是声称在所有实体浏览器页签栏已验收。Henry新图标审美仍待实看。

## 关于、阅读方式与实现细节

三页保留原URL与主导航归属，不加一级导航。ExplanationNav提供安静的三项二级链接，原生a/aria-current和44px高目标；主导航与实际房间返回不变。

- /about保留真实快照里的个人介绍和动态数量/年份，不改owner数据；正文更简洁地说明真实划线、摘录上下文、内容来源及更正。根据snapshot.visibility说明当前公开或本机范围，不再在本机页面误称全部内容已经公开。
- /design从访客动作组织：一句一句、可用版本的河流/潮汐、按书找、两层主题、跨书小径、地图与完整出处。保留不强迫任务/选择的定位；说清留读不会超时收走、目录/暂停、空间位置不是水面里的语义距离。水景段落跟随实际功能开关，不把尚未启用的功能写成普通公开版现状。
- /design/technical说明离线准备→审核快照→静态交付，补充Canvas2D/Pretext/DOM全文、缓存和减少动态，保留两层主题/公平选择/小径/地图的区别。根据实际加载map.version描述106精确原空间布局或旧固定基线；既有公开版仍准确写不重新运行UMAP发布，但明确这是当前数据版本，不是永久限制。local不再误称使用同步公开地形；public仍说明首帧直接使用已校验地形。没有声称所有读屏/真机已通过。
- 长文仍是文章版心，不堆宣传卡片。正文从15调至16px，1.95行高；短引言使用阅读字体，二级导航与段落分隔维持现有全深色系统。无新动效/外部字体/远程请求。

## 验证与失败保留

- npm run icons:generate两次、同一SVG生成PNG字节一致。
- npm run check最终：71文件479单测，type/lint/原public数据/原terrain/build通过；新增4测核对说明页的公开/本机范围及地图版本分支，不需要private语料，测试仅用真实公开原文并改变说明契约元信息。
- 新专项首23/24：local-WebKit的键盘测试执行Enter后仍在关于页，原测试未断言焦点在链接。保留失败图/trace，未独立确证其所有时序原因。改为明确断言链接聚焦，再向该原生链接发Enter，未force click、加sleep或放宽timeout；随后24/24。
- 加图标版本参数后最终完整24/24：local/private全站与普通public静态子路径，Chrome/WebKit，1440/390/320及720×450等效窄视窗；三页原生导航/刷新/正确介绍当前功能与坐标、字号/行高/无横向溢出、真实图标字节。720视窗不是系统或浏览器实200%缩放。
- 原公开冒烟9/9；深层书房图标专项两引擎2/2；三方式静态Pages4/4，旧审核public输入→private构建，无本机API/外部请求。未重跑全部地图14/全站10/长时水景38，106/105成绩不作本轮新测。
- isolation:public、publication:verify通过。public snapshot/terrain、local snapshot/terrain/local-layout、既有1024维向量6项SHA和106相同，见protected-hashes.json。无新增依赖，package-lock未改。
- 独立证据.private/review/site-finish：before原图标及三页宽窄图、icon-sizes、after/final/complete、check-first/final、e2e-first/final/complete、public-smoke、deep-icons、static-flow、isolation/publication。实际读取图标对照、桌面阅读方式、手机阅读方式/技术页、公开关于页。保留首次失败，不覆盖106及旧m05图。

主要命令：
```powershell
npm run icons:generate
npm run check
npx playwright test --config e2e/config/playwright.site-finish.config.ts
npm run test:public
npm run isolation:public
npm run publication:verify
npx playwright test --config playwright.pages.config.ts --grep 'tab and touch'
npx playwright test --config e2e/config/playwright.text-flow-pages.config.ts
```
专项运行均设置独立evidence/output，复跑应另用目录以保护证据。

## 整体检查：正式推送前还有什么

1. **数据边界已确认**：网站结构/交互与数据范围分开；现行已审核公开108本/3462句/108封面可以作为公开接线输入，不复制完整local130本/4663句。若另有更新的审核版本，应验证它及配套地形，而不是混用本机资料。
2. **正式公开入口接线尚未做**：新五项导航、三种偶遇仍由PLAY_WORLD开关在play-private/play-static-check启用。普通public依然旧六导航/单句；本轮只是让介绍按真实功能呈现。下一步将已认可结构迁移到正式public，移除仅本机试行的现场文案，明确不可用的本机联想动作，不开启private API。
3. **地图与内容匹配**：106算法本轮冻结；当前已审核public点位未被替换。若发布106新算法的公开地图，必须只用获准输入生成并验证对应坐标/地形，检查真实公开范围的版面；不能复制local候选或将其体验结论直接迁移。
4. **最终公开候选复验**：结构接线后重新跑真实public三方式/地图/链接/分享/Pages子路径/隔离，检查bundle及首次加载，再由Henry看公开范围候选。当前24/4不能替未来接线后的验证。
5. **实际发布仍单独执行**：未push，master推送会触发Pages。正式提交/推送前核对上述候选；物理手机/Safari、读屏、首访、真实200%及低端长时仍未全验证。

本机入口仍是5216：/about、/design、/design/technical，原地图与水景继续可用。此次停止在图标和介绍页完成的状态，不宣称整个第三次发布已经收口或自动上线。
