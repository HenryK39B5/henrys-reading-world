# 108 — 公开水景阅读与新地图发布

日期：2026-10-26（本机UTC+8）
状态：正式公开版已于2026-10-26替换旧版；构建、部署成功，线上复核见文末。

## 用户判断与本次授权

Henry实际体验106地图后明确表示“效果真的很好”，认为主题附近能读到非常相关的划线，要求没有其他问题就准备公开发布并替换当前版本，随后明确“请继续”。这是对实际地图阅读的单人定性认可，也是本次公开替换授权，不是未来永久push／部署权限或独立语义准确率证明。

107先完成图标及介绍页，其“尚未公开接线／未push”的描述是当时状态。本轮接续迁移，不再以此前阶段的本机边界阻止已经授权的发布。

## 范围与实现

- 普通公开构建及普通local均启用五项导航、根入口三种偶遇方式；书籍主题保留在书架子入口。审核／Tag Studio／map-study继续独立，private服务开关与产品功能开关分离。
- 公开版没有“沿这处流一会儿”按钮，不加载本机模型候选。公开地址忽略旧anchor参数，仍保留真实h、world、book及阅读方式；说明准确描述已审核公开范围。
- 正式公开地图仅从106的public-first／exact参考seed提升。输入是原已审核公开快照，不是4,663条local地图的裁剪。算法冻结为A：原1024维精确Float64余弦48邻居（含自身），UMAP-js1.4.0，minDist0.14／spread1.25／350epochs／seed1296126005，等比放入350–9650，无Tag坐标力。地名采用实际成员局部支持锚。
- 原公开快照和地形备份在`.private/review/release-c/before/`。promote脚本在写入前验证源SHA、完整快照契约、候选map摘要、地形可重建及地名真实成员身份；备份／清单用wx拒覆盖。
- `scripts/public-map-release.json`锁定公开内容、地图、地形的规范化SHA256、来源快照SHA、实现SHA与参数。普通构建验证此清单，无需private输入或在线模型。
- `publication:verify`继续逐字段比较审核政策投影和公开owner／书籍／主题／Tag／原文／pathVector、封面派生字节与静态房间；地图另由冻结清单及地形契约验证，不再强迫从旧local地图过滤。
- `publication:export`只有在内容完全匹配当前地图清单时保留地图；新的审核内容不匹配则在写入前拒绝，要求准备匹配地图，不静默沿用旧地理。

本次公开内容保持 **108本／3,462条／56Tags／108封面**，原文、ID、出处、全部Tag及元数据不增加或修改。1,432条有审核Tag，2,030条未标注，均可被阅读；无标签不当作负例。内容摘要（不含地图）为`2348a6fddee667584cf8f09dd28f103e69c625b817951838eeb1704517a7bcb4`。新地图版本`exact-cosine-48-v1-public-exact-1296126005-ccef39e741`；公开专用拟合地理不同于Henry体验的完整local范围，不能冒称同一张图。

## 本轮发现与修正

1. 首check类型过、lint因移除旧投影后留下无用赋值失败；删除无用赋值后继续。
2. 第二check有两个失败：新根地址把空格编码为`+`而旧稳定地址契约要求`%20`，修复编码；旧真实标签测试硬编码的旧坐标／tag-006不再是新地图中被安排的名字，改为从当前真实布局选内部目标并扫160个视窗，要求所有仍在内部的名字保留且确有新名字从边缘进入。tag-050原来无局部支持的注释已过时，现要求真实局部≥3支持，不删稳定性断言。
3. 发布专项第一轮12／18通过。背景位置断言误把尚在600ms归还中的原文当作已静止背景，还混用了可见4项与全7项；改为等实际returning状态完成、明确暂停并比较相同槽位。地图直达测试沿用“任何h都重置镜头”假设；按既有产品契约清除记忆再验证真正的新抵达，内部可见点和返回仍保留镜头。
4. 第一轮同时发现实际桌面横向溢出：不可见的`map-scale-reference`从窄地图容器向右延伸至1524px。诊断保存overflow-probe，测量元素改为视口fixed原点，保持原宽高和scaleBasis计算，不裁掉问题或缩小字体。
5. WebKit首轮有一次切方式原文不同；SinglePassage对父层选中ID的同步移至layout effect，在绘制前同步，两个引擎对应切换用例随后通过。尚未证明所有时序或慢设备条件，不把此修正称为新性能成绩。

首失败日志、截图及trace全部保留；测试未使用force点击、降低正文／空间断言或放宽超时。

## 验证与证据

所有新日志、截图和失败trace在`.private/review/release-c/`，不覆盖106／107证据。

- `node scripts/promote-public-map.ts`：源、map、真实成员锚及匹配地形验证通过后提升；原审核内容摘要完全相等。
- `npm run check`：先71文件479（含旧地理失败），加入发布负面契约后72文件484通过；加强清单负面用例后最终72文件485通过（check-final.log）。type／lint／真实public数据／terrain／build均通过。
- 新真实public静态专项：Chromium9／9、WebKit9／9分开跑过，覆盖三方式、宽窄、实际全部Tag、分享／书房／书架主题返回、范围内抽取、去anchor、未知h、map深链／①②对读／详情返回、contour、公开资产逐字段相等、长文End、Canvas不可用与reduced-motion。地图含1440／390／320；无应用错误、资源404、外部请求或private API。
- 最后将悬停用例补成等高线与真实点两者均实际hover，Chromium／WebKit定点2／2通过；未声称补完后又全跑18。
- `npx playwright test --config playwright.pages.config.ts`：22／22，真实184个静态房间入口／深书房直接访问和刷新／扩展名旧书签／404／base地址复制／封面／图标／冷地图／介绍宽窄及手机导航；仅更新新导航locator，新证据用PAGES_EVIDENCE单独保存。
- `npm run test:public`：9／9。
- `npm run isolation:public`、`npm run publication:verify`及`npm run validate:data:local`通过；新增禁止模型geometry端点、私有候选文件及sourceVectorHash进入dist。继续禁止账号字段、凭证、审核／Studio素材和private研究内容。
- 已实际读取新的公开1440地图、WebKit390地图、320对读、1440潮汐全文、WebKit390河流全文截图。地图是真实公开地理，新水景没有改用local语料。
- 四项local输入（snapshot／terrain／layout／向量）的原SHA均不变，公开内容不含map的摘要与发布前完全相等，见protected-input-verification.json。
- 正常生产构建约518kB主JS（gzip157kB），三方式懒块约75kB（gzip28kB），公开JSON约2.01MB（gzip519kB）；主块500kB警告仍在。不是受控真机冷启动或固定帧率结论。

## 发布与剩余边界

发布候选为`b2a940148116d1dadfbe92d7615e6760e6d2f569`，已正常push master；Actions run `40290865575`的build与deploy均success，CI独立npm ci安装298个package并正常通过公开数据、地图清单、terrain、type和build。推送包含此前本机小步源码提交，所有private输入仍不受Git跟踪。

发布前用`git archive`导出此提交至private独立目录，不含`.private`，复用已安装node_modules（没有另跑npm ci），独立`npm run build`通过；Chromium四个入口（single／tide／river／map真h）通过，原文及全108封面验证一致。初尝试逐字节比较产物发现不同：本工作区public JSON为LF，Git导出为79,926处CRLF，资产名因此变化；记录为失败的字节相等假设，不宣称跨环境bit-identical。规范化内容摘要完全相等，source-export-verification.json与原失败comparison均保留。随后CI独立npm ci亦已通过。

本次已通过现有master→GitHub Actions→Pages工作流替换线上版本，只上传dist；未新增后台、遥测、账号、素材／模型依赖或扩大公开内容。网站仍为`https://henryk39b5.github.io/henrys-reading-world/`。

线上真实浏览器首轮16／18通过；Chromium1440的交互正文断言已通过，但afterEach记录一次封面p020.jpg的HTTP503；WebKit最长原文例在goto时SSL connect error，还未进入应用。保留原日志、截图和trace，未改代码、未豁免503／SSL、未放宽断言／时间；原Chromium1440例和WebKit最长例分别再次1／1通过。最终18项逐项覆盖，**不是一次18／18全绿**。网络失败根因未定位，不把复核通过称为永久网络稳定。过程中曾按运行列表中的临时通过标记汇报Chromium9过，最终afterEach结果应以本段16＋2为准。

独立线上校验117份文件（入口、全部构建资源、108封面）字节与验收dist完全一致，线上快照SHA256为`df21d4c5c5146acd3411e9a5179e33134f891e6b0c9c940672e71e9295ae7daa`，map版本／完整原文／公开数量一致；见live-byte-verification.json。实际读取线上WebKit390地图／潮汐完整原文及Chromium1440对读截图。

随后只将README／本记录／AGENTS／08／48改为已发布状态并提交推送，运行时代码和公开数据与b2a9401完全一致；文档提交触发的工作流及最终线上字节会再确认，不需要将原18项重跑写成新成绩。

真机手机／Safari、读屏、独立首次访客、真实200%浏览器缩放、低端长期性能／字体矩阵及权利判断仍各自独立；自动化、Henry定性认可和用户本次发布授权不会把它们自动记为通过。106的种子敏感性和二维投影信息损失保留，不重新扩展算法研究。
