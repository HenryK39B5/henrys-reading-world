# 106 — 世界地图坐标与地名依据打磨

2026-10-26，本机UTC+8。本轮历史状态：本机候选完成，当时等待实看且不发布。后续Henry已实际肯定主题邻域阅读并授权替换公开版本；正式公开专用地图迁移与发布见[108](108-PUBLIC-WATER-AND-MAP-RELEASE.md)。本文件保留106原实验过程与边界。

## 授权与保留

Henry实际看105后评价效果非常好、认为可以准备上线；提出最后一项坐标与主题分布优化，希望之后阶段性停止。讨论后认可Agent提出的减少预处理损失、兼顾邻域尺度、弱Tag对照、地名局部依据，并明确要求本轮实施及继续。保留现有悬停点/等高线、缩放、中心句/周围句、书籍比较、返回与全站三种偶遇。不重开产品形式研究，不让用户选引擎或批量标注。

本轮授权本机候选坐标和派生地形，不直接改公开快照/生产地形/旧local快照、Tag、向量、原文或公开范围。无WeRead抓取、远程模型、新素材、推送部署。已完整重读09、项目skill及PROJECT-ADAPTATION；不调用取数能力。

## 数值实验预先固定

1. 先在已批准公开3462条上比较；逐ID核对既有本机1024维缓存textHash，原向量归一化后精确cosine。所有查询与候选同范围。现行发布坐标作为访客基线（其历史父布局在4663条拟合，不能把差异全归因算法）；另保留同范围旧管线复跑对照。
2. A：原1024维精确近邻，UMAP-js已安装1.4.0，48邻居（包括self），minDist .14、spread1.25、350epochs。相比原24扩大局部范围，不宣称实现新的多尺度算法。直接传入精确KNN，避免96维投影及近似近邻误差。
3. B：同一原空间前96非自身候选内，只对双方可用、共享的已审核Tag将距离乘以1−0.08×Jaccard；重新排序取47邻居加self。不拉近原空间候选外同Tag，不把缺标/异Tag当确认负例，不采用互斥类别监督。
4. 按书ID的SHA256固定排序，每五本取一本，整本书的Tag不参与B拟合；其原文和向量仍参与，所以是transductive标签留书，不是全表示的归纳留出。保留训练/留书/未知的计数和标签邻域支持，禁止只报训练Tag团聚。
5. seeds固定1296126005/6006/6007，不挑最好seed，拟合参考seed始终6005。A/B各三轮，报告跨seed二维邻域交集；全局布局距离秩相关与局部top15/30/60保留分开。只比较少数明示候选，不展开库或参数网格。本轮不新增PaCMAP依赖；先修已有管线最直接的损失，不能把它写成已经比较PaCMAP。
6. 地图坐标统一缩放+平移到0–10000内并保留边距，不逐轴变形、不裁离群点；有限精度取整单独保留限制。地名从真实Tag成员里选择固定600单位半径内其他成员高斯支持最大的点（sigma300；同分稳定ID），不按书硬抹平、不制造唯一主题领土。无其他支持时仍保留真实成员锚点，但不冒充局部聚集；总览沿既有局部支撑显示规则。
7. 几何诊断按书固定查询+旧五例，报告原空间邻域保留/高维假近邻rank/同书占比、原空间与二维距离秩相关；训练和留书已标注查询的同Tag邻域支持另报，未标注不算负例。地名支持属于样本内选点结果，不能当独立语义成功。固定旧案例和自动抽取最差/最好几何变化案例审原文，保留反例，不要求Henry标注。
8. 优先A；B只有留书支持有稳定增益且几何无明显代价才考虑。数值改善不自动过艺术Gate；选定方法之后同参数在完整local4663条拟合/评测，并接现有完整5216站，不改地图交互或给用户增加算法菜单。公开候选仍留private，仅为后续发布准备，不提前export。
9. 每个输出目录拒覆盖，记录输入与源码指纹、参数、实际命令/耗时/失败；至少参考seed独立复跑数值比对。现有public/local snapshot、terrain、向量原件保持hash不变。

## 核对的实现与资料

实际阅读本机node_modules/umap-js/dist/umap.d.ts和umap.js，确认setPrecomputedKNN与initializeFit；在线核对PAIR-code/umap-js官方仓库、UMAP官方precomputed_k-nn与supervised文档。Python说明不冒充JS API，B是本站自定义正标签微调，不是官方categorical监督算法。

- https://github.com/PAIR-code/umap-js
- https://umap-learn.readthedocs.io/en/latest/precomputed_k-nn.html
- https://umap-learn.readthedocs.io/en/latest/supervised.html

## 实际数值与选择

起点b49b1fb，原5216/PID24888不另建样板。public-first完成旧同范围管线/A/B各三seed共9次拟合；public-repro独立重跑A参考seed，map与terrain摘要完全相同。local-first按同参数完成A三seed；未新训模型/调参网格。原文textHash逐条匹配既有1024维缓存。

固定按书查询：公开113（108本各1+旧5例）；local135（130本各1+5例）。以下主值是预先固定参考seed，不挑seed；原空间是模型诊断参照而非语义真值。

| 诊断 | 现行公开地图 | 同范围旧管线参考seed | A公开参考seed | A本机参考seed（旧本机） |
| --- | --- | --- | --- | --- |
| top30保留中位 | 6.67% | 10.00% | 16.67% | 16.67%（6.67%） |
| 仅跨书top30保留均值 | 9.00% | 8.85% | 13.48% | 14.52%（8.96%） |
| 3000固定随机点对距离秩相关 | .3242 | .3396 | .3639 | .2382（.2124） |

A公开三seed top30中位16.67/13.33/13.33%，local16.67/16.67/13.33%；跨seed二维top30交集中位，公开36.67/43.33%，local53.33/53.33%。这仍是明显有损且seed敏感的二维图；上线会冻结单一坐标，不是访客每次重算。跨书诊断在第一轮后补充，算法/查询/参数不变；源码verify-map-coordinate-polish.ts与cross-book-verification.json明确其post-first-run性质。原空间本身同书占比公开13.57%，不能把所有同书邻近都判偏差。

B确有正面数值：按书等权的留出标签支持，三seed为38.43/36.77/36.81%，高于A的34.20/35.31/36.38%；但整体距离秩相关B为.3346/.3254/.3189，A为.3639/.3246/.3484。B并非数值完全失败。结合下述实际原文不一致、未知标签覆盖和更复杂的标签依赖，按预设优先A，**本机选择A，不采用B，不重新用全部标签训练B**。这属于本轮产品取舍，不是A语义最优的统计结论，也未比较PaCMAP/PCA新候选。

## 原文检查与地名

Agent实际阅读public-first/review-packet.md的旧5例，每例原空间/现行/A/B各前2原文；local-first/review-packet.md包含同5例和自动选出的几何最差/最好各2例的现行/A前2原文。完整前5保留在各*-review.json。不是独立盲审，不把已用过的开发案例称新验证集。

- local h-4648的亲密关系/自尊邻域从明显错位的片段转到《亲密关系》的联系、幸福与归属，跨书关系更贴近。
- h-898邻近乐观面对失败/是否继续争取，有可读的关联，但另一个邻句仍偏勇气/他人恐惧，不能称统一主题。
- h-4504邻近大学精神发展是相关的，但同时邻近科幻的智慧边界；h-1754社会阶层仍混有压迫/牵连语境；h-4549文学情境也不因几何改善就变准确。
- 几何退步例h-3692的新旧邻句都在同书的心智/时间语境，说明精确topK名单不是全部阅读价值。
- B的h-898、h-2288等邻近原文未显示稳定胜过A；保留正负案例，不据局部阅读宣布全库语义通过。

地名锚点改为真实成员中局部高斯支持最大的点，不是全体成员X/Y中位数。公开900半径内至少3个成员的锚点由46→54/56，local51→56/56；公开tag-048/052仍只有2/1，保持总览不强贴名。阶层tag-050公开旧锚点900内0成员，新锚点5成员（600内4、3本）；local新600内9成员/5本，900内12。**这是样本内选点/显示资格的改善，不是独立语义评测或一次把54个地名都画在屏幕上**。既有碰撞、分级、局部显示规则未改；同Tag仍可在多个地带出现，不制造互斥领土。

## 接回完整网站与保护边界

新增mapCoordinatePolish.ts、study/verify脚本、mapCoordinateCandidate.ts和mapCoordinatePlugin.ts。Vite只在play-private、原两个固定local只读端点替换map及匹配terrain；正式public、普通local、play-static-check均不读取此候选。没有新的UI算法菜单、后端、依赖或运行时向量计算。

selected-local.json只含候选地图/地形及指纹；原文/Tag/来源仍从原local快照读取。校验完整源快照SHA、严格字段/模型派生元信息、完整点集/坐标/map摘要，并重算地形核对；源数据变动或候选损坏返回503，不默默送陈旧地图；候选文件不存在时沿原地图。GET/HEAD只读，写入405，直接private文件403。派生缓存按源和候选摘要缓存，不改变既有play geometry内容身份。

全部候选/向量/原文检查只在.private/research/map/coordinate-polish。现行public snapshot/terrain、local snapshot/terrain/local-layout、既有1024维缓存原件未替换；6项SHA见protected-hashes.json。公开3462拟合和local4663拟合是两张不同地图；下一轮正式发布准备仍须在已批准public范围接入并检视新公开候选，不能把local实看替代public地图验收或直接复制private快照。

## 工程验证与失败

- npm run check：70文件475单测，type/lint/public数据、现行terrain验证、正常public build通过。正常产物仍是第二版，不是新版本已发布。
- 新纯测11项覆盖精确距离/self近邻、等比无裁切、未知标签不作负例、整书留出、真实成员锚点、tied-rank、候选源指纹/完整点集/附带vectors拒绝/地形篡改。
- 第一次新11测为10过1红：测试预计多余vectors被二次净化层拒绝，实际已有snapshot validator更早以Invalid candidate map拒绝。仅将预期错误文本校正为真实第一道拒绝，未削弱拒绝输入；修后11/11，全check475/475。
- 新地图专项一次14/14（Chrome7+WebKit7）：1440/390/320缩放进入阅读、全原文与跨书①②对读、详情返回/刷新、实际点和等高线hover、深链定位新坐标/完整Tag/reduced、只读端点及私有文件隔离。
- 新全站整合一次10/10：三种偶遇原文/范围/下一句周期、书房返回、真地图入口、潮汐宽窄拾取归还不移旁文。未重跑完整38文字流长时套件，不挪用105的38作为本轮新成绩。
- isolation:public、publication:verify、validate:data:local通过；这些验证原公开/普通local快照，不是新地图自动获公开审核。
- 最终静态Pages三方式4/4（43.3秒）：只用旧批准公开输入、private静态构建，无private API/外部请求。证明本轮Vite接线未破坏静态隔离，不是新公开地图的浏览器验收。最终6项保护SHA均一致；dependency-provenance.json补记Node、UMAP-js1.4.0、锁文件和既有依赖源码指纹。
- 新图独立.private/review/map-coordinate-polish/first和integration，实读Chrome1440总览、WebKit390总览/详情、Chrome320对读。布局、长正文和真实Tags保留，没有用图像生成模型美化证据。

命令（输出目录均拒覆盖，复跑须用新名字）：
```powershell
node scripts/research/study-map-coordinate-polish.ts --scope=public --out=.private/research/map/coordinate-polish/public-first
node scripts/research/study-map-coordinate-polish.ts --scope=public --methods=exact --seeds=1296126005 --out=.private/research/map/coordinate-polish/public-repro
node scripts/research/study-map-coordinate-polish.ts --scope=local --methods=exact --out=.private/research/map/coordinate-polish/local-first
node scripts/research/verify-map-coordinate-polish.ts
npm run check
npm run isolation:public
npm run publication:verify
npm run validate:data:local
npx playwright test --config e2e/config/playwright.map-coordinate-polish.config.ts
# 全站整合另设TEXT_FLOW_EVIDENCE和--output，保护105历史截图
npx playwright test --config e2e/config/playwright.browse-water.config.ts
```

新地图入口仍为http://127.0.0.1:5216/map，当前版本exact-cosine-48-v1-local-exact-1296126005-9b12a91dee。老session若停在旧局部，可用既有复位按钮回总览；未改变已有相机记忆协议。无需再选算法、隔离样本或评分表。本批停止扩展算法，等待Henry实看；随后才做全站公开模式接线/静态新公开地图验收与发布收口。新地图艺术/实际体验、物理设备、读屏、独立首访、实200%和低端长时仍未通过；105已获肯定不自动覆盖本轮新地理。
