# 实现 Agent 工作约定

## 目标与权威顺序

本轮实现 Henry's Reading World V3：在既有真实划线房间体验上加入逐条主题标签、主题小径、embedding 辅助内容生产、阅读世界地图与全局视觉重构；同时保留只在本机运行的 Studio / 发布审核工具。不建设公众登录、远程后台或运行时 AI 服务。

阅读顺序：`PRODUCT_BRIEF.md` → **`docs/19-PRODUCT-DIRECTION-V3.md` → `docs/20-TAGS-PATHS-MAP-SPEC.md` → `docs/21-V3-VISUAL-DIRECTION.md` → `docs/22-V3-IMPLEMENTATION-PLAN.md` → `docs/23-EMBEDDING-EVALUATION.md` → `docs/24-BATCH-2-TAG-DISCOVERY.md` → `docs/25-BATCH-3-TAG-STUDIO.md` → `docs/26-BATCH-4-PATHS-AND-VISUAL.md` → `docs/27-BATCH-5-WORLD-MAP.md` → `docs/28-BATCH-6-FULL-TAGGING.md` → `docs/29-GPT6-ASTRA-DESIGN-REVIEW-BRIEF.md` → `docs/29A-GPT6-ASTRA-TEXT-ONLY-DESIGN-REVIEW-PACKET.md` → `docs/30-GPT6-ASTRA-DESIGN-REVIEW.md` → `docs/31-V3-PRIVATE-ATLAS-VISUAL-OPTIMIZATION-PLAN.md` → `docs/32-BATCH-7A-PRIVATE-ATLAS-READING-SURFACES.md` → `docs/33-V3-READING-WORLD-RADICAL-DIRECTION-STUDY.md` → `docs/34-V3-CROSS-PAGE-PALETTE-STUDY.md` → `docs/35-V3-DARK-CROSS-PAGE-INTERACTIVE-PROTOTYPE.md` → `docs/36-V3-DARK-CROSS-PAGE-PROTOTYPE-RESULT.md` → `docs/37-V3-MAP-IMPACT-AND-DARK-SYSTEM-DIRECTION.md` → `docs/38-V3-TERRAIN-FIRST-WORLD-OPENING.md` → `docs/39-V3-CROSS-PAGE-DARK-READING-SYSTEM.md` → `docs/40-BATCH-7G-CONTENT-EDGE-AND-ROUTE-POLISH.md` → `docs/41-BATCH-7H-FIRST-VISITOR-ACCEPTANCE.md`** → `docs/17-PUBLICATION-DIRECTION-AND-RELEASE-A.md` → `docs/10-PRODUCT-DIRECTION-V2.md` → `docs/12-ROOMS-COLOR-MOTION-DIRECTION.md` → `docs/11-V2-IMPLEMENTATION-PLAN.md` → `docs/18-RELEASE-A-PUBLICATION-REVIEW-IMPLEMENTER-PROMPT.md` → `docs/01-SCOPE-AND-DECISIONS.md` → `docs/02-TECHNICAL-DESIGN.md` → `docs/03-DATA-CONTRACT.md` → `docs/04-SERENDIPITY-SPEC.md` → `docs/05-UX-SPEC.md` → `docs/06-IMPLEMENTATION-PLAN.md` → `docs/07-IMPLEMENTATION-HANDOFF.md`。`19–22` 是当前 V3 产品与施工权威，`23` 记录 Batch 1 实际评测，`24` 记录 Batch 2 标签发现，`25` 记录 Batch 3 稳定词表、试标与 Local Tag Studio，`26` 记录 Batch 4 schema 3、主题小径、岔路与视觉基础，`27` 记录 Batch 5 全量地图布局、Canvas 世界、主题区域与 Book Aura，`28` 记录 Batch 6 全量候选、双模型复核与质量审计实况，`29` 是交给高能力模型的产品审美与整体体验审阅任务书，`29A` 是模型无图片视觉能力时的文字化证据包，`30` 是已完成的产品与艺术指导审阅，`31` 是「可漫游的私人图集」三批视觉优化施工计划，`32` 记录 Batch 7A 阅读版心与界面减法，`33` 记录用户未通过视觉Gate后授权的同数据颠覆性方向探索，`34` 保留同版式配色实验的原始判断，用户对手机E断层的反对及现行全深方向见 `35`，`36` 记录已实现的7D交互样板与独立视觉Gate，`37` 记录用户认可全深地图但要求增强视觉冲击及已修复的亮书选书细节，`38` 记录7E真实地形开场试验，`39` 记录用户认可7E后授权的跨页深色阅读系统第一版与独立视觉Gate，`40` 记录用户认可7F后对130本/56小径的全量边界审计、真实长书名与缺封面收口，`41` 记录7H首次访客任务卡、本机对比度/键盘结果及真实浏览器缩放边界；`17/18` 保留已完成的公开审核与 Release-A 契约；`10–12` 保留 V2 公平、房间和 Book Aura 历史基线，冲突处由 V3 取代。

用户明确要求所有产品开发使用真实微信读书数据，不使用 fake data。Critique #1 后产品从“前三句策展并塑造印象”调整为全量真实划线的轻松漫游；V3 进一步确认：Book Theme 继续作为书架分类，Highlight 新增 1–3 个地位平等的 Topic Tag，形成主题小径与岔路；embedding 只用于本机标签发现、标注辅助、地图布局和小径软节奏，不做独立类似划线入口、AI 搜索、问答或人格分析。产品采用一个 Reading World、Public/Local 两个数据范围和一个 Local Studio。公开范围的既有决定继续有效，但 Release-B 暂停到 V3 Gate 之后。真正出现新冲突时再请用户决定。

开始数据工作前，额外完整阅读 `docs/09-WEREAD-DATA-WORKFLOW.md`、`.agents/skills/weread-skills/SKILL.md`、`PROJECT-ADAPTATION.md` 与所调用能力文件。不依赖客户端自动加载 skill。

## 2026-10-25：水岸方向获肯定，连续阅读与画面细部打磨（现行）

Henry实看102认为效果好很多/开始有意境，明确认可设计方向但非完美，授权本轮继续打磨画面与体验。见`docs/103-WATER-READING-POLISH.md`：同完整本机站，固定即时全文+真实预览拾取过渡、分水路归还/手机第七条可见归还去重，独立原生长文滚动/真实继续提示/换句复位与切换模式留位置；细化岸线湿岸/浅水亮色，非换范式或添功能。type/lint及2文件12纯测过、首Chrome17/17、新双引擎原生长文wheel/End2/2与宽窄图实读，最终回归待收口。无新依赖素材模型/数据Tag向量地形点位/公开范围/push部署，5216/PID26520续用；102肯定不替103新体验或真机读屏/首访/实200%/长时Gate。

## 2026-10-24：肯定流动基础，水把文字送来（历史；102方向获认可，103接续）

Henry实看101肯定流动/一波来去已接近想象，同时明确美感/自然性不足；不是全盘否定或艺术通过。他提出潮水推文字上岸再裹回、生命之河/思想流动/临流拾取，上一轮要求先设计，本轮明确进入开发。最新`docs/102-WATER-CARRIES-TEXT.md`：Agent在原完整本机站做可辨岸/浅深水与文字共用水路时间，tide推近停留退去、river弯曲持续经过/近岸读/归还，非背景水景+独立滚字，不加实体贝壳酒杯/角色任务。本轮已收口66文件452check/隔离投影local与protected3SHA不变；近岸前28/28，最终近岸27/28水/字同步测试跨帧2.796px失败，改原子采样不放宽1px后双引擎2/2，最终28逐项覆盖非重跑一次全过。静态首3/4 WebKit首帧30s失败未定位、不改断言复跑4/4；touch模拟2/2。首Chrome11/12虚拟44秒耗时反例，离屏640/80ms水层+清楚文字分层修；河流近岸读/归还1100ms有新双引擎宽窄实图，懒块69680/25337gzip非总量；不弱化断言/时间、不称真机性能或美感已过。无新依赖素材模型/WeRead/数据Tag向量生产坐标地形/公开范围/push部署，主入口与已发布第二版不动。5216/PID26520仅本机，不新设引擎盲选/隔离样板/评分。

## 2026-10-23：100实现效果未通过；集中重做潮汐（历史；101流动获肯定，美感自然性仍不足，102接续）

Henry实看认为此前设计不合适、不是idea必坏而是实现效果不理想，要求再设计并继续。最新`docs/101-TIDE-TYPOGRAPHIC-REDESIGN.md`：Agent选择集中潮汐第二稿、河流前稿留对照，不称Henry指定最终方向。纠正规则三列加动画，改错落不等字级/宽度、共同扫入退去和安定阅读、同场标题/版心层次；仍桌面7/手机4真实前缀、全文立即/不定时放走、选择与范围分离。本稿已收口65文件446check/隔离投影local、protected3SHA不变；新增非网格/标题避让/连续抓取后双引擎一次24/24（各12）、静态4/4、touch模拟2/2。新图first/second/final含真正潮汐held已实看；小屏两行前缀/held首排下移/源名像素适配修，旧断言不放宽、100证据不覆盖。懒块66506/24282gzip非全站，WebKit成本仍未知；新艺术/真机/首访/读屏/实200%/长时待Henry实看，数次继续非接受设计；100工程证据不能抵消此次反馈。无新依赖/素材/模型或数据Tag向量点位地形/公开范围/push/deploy，主入口与线上第二版不变。原整站本机PID26264/5216，不另要引擎/隔离样本/评分。

## 2026-10-05：多处同时可选，河流/潮汐整站两稿（历史；实现效果未过，101接续）

Henry要求河/瀑布同时多处可辨文段，否则等于随机一句；认可潮汐像海边捡贝壳，可由Agent选择方向或做两稿，网站做出后一起看。Agent已选择原完整站本机两稿，不推定用户已选最终美术；最新`docs/100-RIVER-AND-TIDE-TEXT-WORLD-TRIAL.md`：持续经过与成批到来/停留/退去，共用轻点留住DOM全文/其他续流/主动放回/可回看/真实范围探索。桌面7/窄屏4为初始真实单元，不造稀薄范围补位、不上正式公众双入口、不改现有随机一句。实际registry核对后新增精确dev依赖Pretext0.0.9/MIT，Canvas2D/DOM，不需新Three装饰或资源；第一版已完成64文件441check/隔离/公开投影/local与protected SHA一致，最终新浏览器一次22/22（两引擎各11）和静态4/4、模拟touch2/2；320重叠按实测行数截原前缀修，不改全文/字体或放宽断言；两次动态目标capture稳定等待失败留存、加局部稳住/真实靠近后正常native click。新图独立private/text-flow已实际read、Pretext测量缓存/30fps目标/离屏pause，懒块63876/23242gzip非总量，WebKit开发仍慢未定位。艺术/自然性/真机/首访/读屏/实200%/长时待验，Agent偏潮汐不作Henry通过。正文/来源/ID/全Tag/来路与静态Pages/公开隔离保留；原公开snapshot/terrain吻合，模型/Tag/向量/点位地形/push/deploy不动。99仅讨论的当轮边界由本轮本机两稿接续，不作永久开工阻塞；96仍废案，Agent偏潮汐不替Henry过Gate，不要求引擎/隔离样本/评分。

## 2026-10-05：保留随机一句，流过—留住—探索/放回（讨论沿革，100接续）

Henry认为随机漫步与现有随机一句核心重复且要选择接续会有心理负担，现有下一句体验已好、不必改；提出文字流像河流/瀑布，感兴趣抓出停留、其他继续流、可探索或放回，明确仍讨论非指定方案。最新见`docs/99-FLOWING-TEXT-CATCH-AND-RELEASE-DISCUSSION.md`：新模式默认不选也前进，以真实划线字行整体为流动单元，清楚稀疏、不拼字句/造水面物体。Agent提慢流/轻点留住直到主动归还、其他绕开低干扰、简单回看、探索可暂换真实范围不列强制候选；潮汐式/手势拨流仅替代节奏，倾向有节奏慢流尚未确认。主入口不动，不把自动下一句换皮当新世界、不读半被计时冲走、不靠追字符。98随机漫步/湖泊混合不是共识；目前仅模式讨论/文档，无Pretext安装/新UI/算法计算/模型/数据Tag点位地形向量/截图性能或push/deploy。正文来源/ID/全Tag/实际来路/静态Pages与public/普通local第二版仍真，96废案保留，不要求Henry选引擎/隔离样本/批量评分。

## 2026-10-05：先交互模式，再文字呈现（讨论沿革，99接续）

Henry认为97文字想法有潜力，继续要求讨论具体模式，提出随机句及相关句点击重定中心、较疏可辨文字湖泊中徜徉，强调交互更核心；不是选了两个模式或要求立即开发。最新见`docs/98-TEXT-WORLD-CORE-INTERACTION-MODES.md`：漫步改变阅读中心/接续，湖泊改变视野、保持持续空间与位置记忆；字风/绕排属于反馈，不决定模式。Agent展开首屏/主动作/候选/停驻/继续/回退/风险，并倾向湖泊主空间、停驻后可选一步真实关联，未获确认，不列并排控制台或默认两套。漫步“点候选=走一步”是可改变旧select/continue分工的新候选，本轮不改路由。湖不自动洗牌/流走、文字不混拼、来源ID/全文/全部Tag/实际来路仍真；邻域/算法/尺寸/版式未选，位置不冒充语义。先共同讨论模式，不安装Pretext/开发UI/算新算法/改数据或发布，不选引擎/隔离样板/批量评分。96废案/97技术核对与线上第二版保留，无模型/新Tag/原点位地形向量/push/deploy。

## 2026-10-05：庭院关系生硬，文字场景与Pretext先brainstorm（讨论沿革，98接续）

Henry认为庭院光照可以好看，但场景/物体与文字没有天然联系，强加绑定使体验生硬，建议作为废案；不是单纯否决美术。最新见`docs/97-TEXT-AS-SCENE-PRETEXT-BRAINSTORM.md`：96关系/自然性未过，保留源码/图证不继续装修；用户提出Pretext、文字飞舞/靠近闪开，明确先brainstorm再介绍，不越过此轮顺序开发/安装。Agent围绕真实文字本身可拨/分流/停驻、可推开排版、真实同字回声提出讨论，均未选；不把字粒子屏保当自然阅读，不强加象征/拼句/角色/任务/解锁。Pretext须核对作者资料，排版/渲染/物理/DOM语义分层，不靠库名许诺审美/性能。原正文/出处/ID/全部Tag/返回与静态Pages隔离保留，public/普通local第二版有效；无代码/新依赖/模型/数据Tag点位地形向量/push/deploy。本轮仅讨论/资料核对/反馈文档，不要求Henry选引擎/评分/隔离小样。

## 2026-10-03：自由发挥授权与暮光庭院整场景施工（历史；96作为废案，97接续）

Henry明确再次继续，给予Agent很大自由发挥空间，希望有较好的版本。最新见`docs/96-TWILIGHT-GARDEN-PLAYABLE-SCENE.md`：由Agent选择原创风格化暮色庭院，先完整空间/色材光，再直接拨光/浮桥与按需真实阅读；不是回到薄片/果盘/卡片矩阵，也不先要求用户选方案。7处装饰构图、有限光位/收敛响应/sky基础与4测+旧14测18/18过，原站场景已实际捕捉双引擎四图并于本机10-04收口。具体动作/几何不编码语料关系；普通map先空间，h深链即时完整原文，select/anchor/scope分工与静态Pages保留。Agent选型不是用户艺术认可；本稿check63/434、隔离/公开投影/local校验通过；最终Chrome13、WebKit11+2分段逐项覆盖、static4过，不称一次全套26过。首并行8unit超时/Pages3过1红/外层WebKit中断留存；geometry89→91反例以常量几何+scale复用修，未放宽断言。手机3处44px入口/全7目录/按需全文/直接拖光与浮桥/固定camera+anchor已实际测。新独立图证/静态897111/238856gzip仍大包警告、WebKit慢仍未定位，见96。新美术/好玩、实机/独立首访/读屏/长时尚未过，WebKit开发慢未定位。仅原完整站本机，public/普通local第二版/Tag/点位地形/向量不动，无模型/未核权利素材/新依赖/push/deploy。

## 2026-10-03：94被否决；游戏场景美术与独立体验价值优先（历史纠正，96接续）

Henry实看94明确评价诡异、没有美感，要求从游戏设计视角，必须足够好看，**即使不考虑内容本身也值得体验**。现行见`docs/95-GAME-ART-FIRST-EXPERIENCE-RESET.md`：94美术Gate未通过，不以22/430/Pages4抵消；93的小巧/有趣认可不移植到94。不继续对胶质薄片换色/加灯/粒子补丁，而从完整场景美术与动作一起重新组织；先主角/构图/空间层次/统一色材光与兴趣点，阅读真实内容自然显露，不把卡片矩阵/局部动效当游戏体验。Agent承担艺术取舍，不要求Henry选引擎/批量评分/隔离小样。具体新美术与核心未选，不预设回廊/岛/园或角色/任务/声音/积分；旧实现非强留骨架。原整站本机开工权限继续，现有栈/静态Pages约束保留，原文/出处/ID/全部Tag/实际返回与数据诚实保留；装饰非语义发现。95本轮只反馈归档/复看旧实图/目标纠正，没有新场景/资产/新测试，5216仍被否决94。public/local第二版有效；模型/新公开数据/Tag/原点位地形/向量/push/deploy不动。

## 2026-10-03：虚拟原生文字薄片一稿已授权（历史；94美术已被否决，95接续）

Henry实际看93称视觉挺好、交互小巧神奇有趣，以果盘概括；随后指出盘子/实体书过于现实化，不偏好拟真实物翻开，要求充分发挥虚拟网站介质，借游戏设计的交互与体验重心，明确按Agent最想做的悬浮文字薄片做一稿并继续。见`docs/94-VIRTUAL-TEXT-MEMBRANES.md`：在原完整站本机去掉底座/实体书/封面/书脊两叶/拟真翻页，单片微曲光膜承载真实摘录；选片舒展/显露，正文立即，不等动画、不改anchor/相机，明确继续/范围进入才换内容。色形/位置仅装饰不冒充标签/语义，字/来源/ID/全部Tag/书房/小径/分享/真实返回不变；不用无限分形/点粒子图/控制台/必学规则/人物/积分。已完成装饰helper4+旧14纯测18，首图小字/入口裁切反例修并留存。新check62文件430、隔离/投影/本机数据/原SHA通过；首并行trace输出冲突21/22与3/4专用private目录后22/22与static4/4，含直接曲面点/资源/idle/reduce/GL。新图实际读取，微字不替正文，WebKit开发慢未定位，旧成绩不挪用；一稿工程完成、待Henry新体验。未新获艺术/游戏自然性Gate，真机/首访/读屏/长时/权利未知。普通local/public第二版仍有效，静态测试只旧批准输入到private，模型/公开数据/Tag/原点位地形/向量/push/deploy不动；不再询问引擎/隔离样本/评分表。

## 2026-10-03：Agent自主选栈，GitHub Pages静态约束与整站重构（历史；虚拟呈现由94接续）

Henry明确技术栈由Agent专业选择，只须最终能GitHub Pages部署，要求继续工作，不再让其选引擎/预判赢家。现行见`docs/93-PAGES-READY-READING-SCENE-REBUILD.md`：已选React/Three0.180/R3F9.8.1/按需Drei10.7.9，静态资产+DOM阅读，无后台/模型/CDN字体/HDR或iframe。原整站本机实施“书页之间”：可辨真书页、受控相机，选择只读，“从这页继续”才重组anchor，主题进入/真实返回；模型候选和按书偶遇分别标注，物体摆放仅构图，球/分形/方向器/双参与三形态不强留。新增pure动作/地址14/14，场景首轮12/18的DOM清理/拖误选修后18/18，Pages cwd/JSON import两次失败修后静态4/4，check61文件426；隔离/投影/本机数据/原SHA不变。构图空区/重复封面/标签叠边与WebKit开发成本仍需打磨，首版及新反例留存，不称新视觉已获认可。显式play-static-check仅已批准旧公开输入、产物private，用无后台项目子路径证明；正常public/local第二版不变，private模式不正式build。新公开关系/snapshot/Tag/生产点位地形或push/deploy仍单独授权；旧失败代码/图保留，不造假数据/语义故事、调远程模型或让Henry批量评分。原开工权限继续有效，不以此条新设讨论阻塞。

## 2026-10-03：首轮视觉/交互未通过；3D专题与重新定向（历史；选栈已由93接续）

Henry实际体验91后明确反馈不好看、即便知道方向仍不知如何操作；两项Gate未通过，不再写成待首次体验，不以20浏览器/419单测抵消。要求联网做3D技术栈专题并继续；《茧》是开放例子，球中世界/分形/解谜均非指定答案，合适才借鉴，不适合放弃。最新见`docs/92-3D-STACK-AND-EXPERIENCE-RESET-STUDY.md`：实际公开Bing搜索/官方正文与registry核对，优先试行React+R3F9/Three/按需Drei+DOM原文，真走路/物理再对照Babylon/PlayCanvas，2.5D保留；推荐不等于已安装/跑分或最终选定。复盘对象角色不清、两参与三形态控制台、选择重置镜头、方向键双义、原文和场景分离、噪点/通用材质构图未成立，不靠教程/更多光效修补。下一轮先具体化可辨对象与select/open/back单一动作、构图/资产/照明/排版，再在原完整本机站点重构，不隔离小样/要求Henry盲选引擎或批量评分。原开工授权未撤回，但不沿91失败菜单继续加效；不强制球/分形、角色/携带、WebGPU、声音/关卡/账号。不改真实Tag/公开范围/生产点位地形、远程模型或push/deploy；原线上第二版有效，旧代码/图/数值与失败保留。本轮仅研究与文档，未安装新库或造新UI。

## 2026-10-03：fancy 可游玩阅读世界开工与首轮工程（历史；验收纠正见92）

Henry对拨动世界与在世界里旅行没有明显偏好，允许都尝试；要求视觉/体验更fancy，接受较长加载和较大资源，由Agent平衡效果与实际运行成本，并明确要求开始后续工作。最新见`docs/91-PLAYFUL-WORLD-LOCAL-EXPLORATION.md`：首轮整站两参与/三容器及真实交集/原文/来源/来路/Book Aura/分享、GL退路已实现，新浏览器20/20、check60文件419/隔离通过；本机127.0.0.1:5216，仍待Henry实际游玩/美术，最终形式未选，独立首访/实物Safari/读屏等不自动通过。在现有完整站点共用真实阅读/主题入口/返回探索两参与方式和三容器，不要求先选赢家、不隔离手感样本。4,663处/130本缓存输入已逐条核对，标签递归/全库数值候选/派生坐标已可复跑；数值通过不等于语义、美术、可玩或访客Gate。新Three开发依赖仅服务显式loopback探索mode，public/普通local保留有效第二版；不改Tag、公开快照、旧点位/地形、调用远程模型或push/deploy。装饰可fancy但不冒充数据发现；不强制关卡/积分/谜题或Henry批量策展。下方90讨论先行是已被本轮明确开工授权接续的历史，不再用它阻止开发。

## 2026-10-03：游戏式阅读体验讨论（上一轮历史，已由91接续）

Henry进一步明确产品偏娱乐，不是严肃知识发现/研究工具；有新的发现、新的感受就是好事。希望借游戏的精致视觉、风格与丰富交互，把单点网络/递归主题/球体/透镜/曲面融通；以《茧》球中世界作灵感，但没有确认作者来自分形。最新见`docs/90-PLAYFUL-READING-WORLD-GAME-INSPIRATION.md`、`docs/54 §4.13`。**当轮先讨论，讨论完再实际开发**：当轮不开算法/新UI/样板，只核对资料和记录；之后的明确开工许可及实况见91。审美、愿意逛、动作回应、惊喜/感受与阅读返回是核心，不再以每一步新增知识或胜过普通筛选为必需门槛；真实原文/出处/ID与关系表述诚实仍是底线。Agent提出可游玩的世界/探索轻机关、三风格、入口变世界/单点回应/可选携带与交汇等，均未选；不自动加入角色走路、解谜解锁、积分任务/签到、声音或排行榜，也不恢复逐案策展/生成作者发言。记录娱乐定位不授权改公开快照/Tag/生产点位地形、远程模型或push/deploy；后续共同核心文字明确后仍在现有完整站点本机推进，不隔离预评手感/批量评分。89先前探索计划保留，但不得越过本轮讨论先于开发的顺序。

## 2026-10-03：各候选探索授权与递归主题空间（前轮计划；最终核心未选）

Henry已表示阅读地球仪、焦点透镜、可展开曲面都可以尝试，不要求他先凭想象选赢家；要求Agent继续探索，并新增分形启发：进入一个主题的真实划线空间，再按同批材料涉及的其他主题进入局部空间。最新归档/工作提案见`docs/89-RECURSIVE-TOPIC-SPACES-EXPLORATION-PLAN.md`及`docs/54 §4.12`。递归内容组织可与三视觉容器组合，不是必须制作四套图；借自相似的阅读规则，不宣称真实语料是数学分形。已记录交叉标签表达条件局部，不把地位平等的Tag强立唯一父子树；未标未知、同成员去重、稀薄/无信息停止、保留原文/出处/ID与实际来路。先研究真实材料中是否有信息，再共享动作/输入探索容器；共同核心动作文字明确后在现有完整站点本机实现，不以新隔离小样/批量评分作门槛。此为探索授权和Agent计划，不是最终选型或逐项批准的UI规格；本轮没有实现递归算法/新UI。88的仅归档授权是前轮历史，不再拿来阻止本轮研究；仍不改公开数据/Tag/生产点位地形、调用远程模型或自动push/deploy。87数值工作保留，不强迫前台使用其双端点。

## 2026-10-03：场景与单点关联世界讨论（前轮记录；未选方案）

最新讨论归档见`docs/88-SINGLE-ANCHOR-READING-WORLD-DISCUSSION.md`、`docs/54 §4.11`。Henry认可随机过程等工具方向，但质疑双端点选择是否必须教学、是否自然且有增量；要求低压力探索与fancy审美共同成立。他提出类双向链接的单点关联网络，以及球面节点/相关点亮起/转动查看的地球仪灵感，并明确只是抛砖引玉。Agent此前“双侧并读→双端点展开”保留为历史/可选深入提案，不作默认主流程；阅读地球仪、焦点透镜、可展开曲面与单源扩散都只是候选，未选3D/布局/阈值/技术栈。关联、位置、视觉、交互分层；模型边不是作者引用/语义真值。审美从一开始与真实原文的显露、信息和可返回性一起设计，不以更多点线替阅读价值。88只记录会话，不授权实现或公开改动；87数值证据保留，不为前台必须用已试工具。先文字共同确定核心，再完整网站本机demo；不做隔离手感样板/重人工Gate，不推送部署或远程模型调用。

## 2026-10-02：可复跑挖掘，不做内容生产（现行R-02方法边界）

Henry明确要求主要挖掘已有划线，以可复制、标准化的算法/呈现自动发现内容，不由Agent逐案写问题、观点角色、故事/场景或手工关系。群论等是可选工具，必须交代输入/运算/输出/假设及读者动作。`docs/86`的四种假设和A+D偏好是已受纠正的历史探索，不作现行共识/施工方案。最新见`docs/87-REPRODUCIBLE-WORLD-MINING.md`及`docs/54 §4.10`：集合耦合与条件网络势/通量已在冻结真实输入完成数值试验与同机复跑；GW/SBM未实现，数值结果不是语义/阅读收益或新核心设计胜出。源码/数值测试版本化，向量/完整研究结果留private；不因此改消费者/public snapshot/Tag/点位/地形、调用远程模型或push。先文字共同确定核心动作，再做完整网站本机版本，不制作隔离手感样本或让Henry批量策展/评分。线上第二版保留有效基线。

## 2026-10-02：第二版手机反馈与阅读世界范式研究（首轮历史）

Henry已实际用手机访问第二次上线版本，认可整体体验，认为小屏地图基本操作比较顺畅、交互逻辑清晰。这是本人实际使用的定性反馈，机型/浏览器/网络/长时指标未知，不代替独立首访、物理Safari/读屏或权利Gate。随后授权更广泛的建模/产品形式研究：不再把优化embedding、二维投影或地名作为总目标，允许重新考虑基本对象、关系与阅读动作，甚至不采用二维点图。首轮四种假设、九处原文检查及文献/失败记录见`docs/86-READING-WORLD-REPRESENTATIONAL-PARADIGMS.md`，授权溯源补记在`docs/54 §4.9`，进度在`docs/48`。R-01旧研究阶段保留为对照，R-02范式研究进行中；尚未选择生产模型/新核心形式，也未实现新UI。先文字确定核心设计，再直接在完整真实网站本机推进，不用隔离小样预判手感，不让Henry批量标注成为研究硬Gate。现行已发布第二版仍是有效基线；新研究不自动更改public snapshot/Tag/坐标/地形、引入远程模型/运行时AI或授权未来push。模型名称不是研究质量依据，区分学科灵感、本站假设与实际验证。

## 地图研究更新（2026-09-27；2026-09-28产品首版更新）

第二轮产品顶层设计见`docs/74-READING-WORLD-TOP-LEVEL-REDESIGN-PROPOSAL.md`：Henry已认可**整体分工原则**——主入口偶遇、地图观察并直达真句、审核主题小径有目的地跨书、书架/书房按书阅读；统一出处/ID/返回，不在可视化重复本机前16模型自动漫步。他要求从**全站**考量，优先各模块功能/交互设计、不做独立体验审计；2026-09-28进一步明确：**先通过文字共同确定核心设计，Agent直接改现有完整站点，基于真实可运行demo与Henry优化，不制作隔离样本供其预判“手感”**。现行计划见`docs/75-WHOLE-WORLD-EXPERIENCE-PLAN.md`，核心模块交互文字讨论稿见`docs/76-MODULE-INTERACTION-DESIGN.md`（尚未实施）；Henry指出其地图部分与线上过于相似，「可阅读地貌」方向见`docs/77-READABLE-TERRAIN-MAP-DIRECTION.md`：Henry已授权Agent在现有完整网站本机推进；2026-09-28局部地图书/真句首版已由Henry在完整demo体验，认可手动漫游但指出“知道附近有哪些书，所以呢”信息意义不足；读者自选另一真实书并看两处真点/完整原文、跨房间真实句进出已在同站本机实现（见`docs/08/77`）；Henry已体验并认可其信息增量，注记视觉收口后又提出去掉阅读现场过量免责声明。跨学科启发与本机同书同圆择句对照的预登记/结果见`docs/78-LOCAL-ENCOUNTER-EVIDENCE-STUDY.md`：没有足以换算法的独立增量，现行本机全站可作下一次上线**候选**。图标、首帧和README的第二次上线准备见`docs/79-SECOND-RELEASE-PREPARATION.md`；Henry看后认可效果并要求放大时地名不再显小、空图有视觉主角，多尺度真Tag字形/候选池已在完整本机站点实施（`docs/80-MULTISCALE-MAP-PLACE-NAMES.md`）；Henry随后指出放大地图中画面内Tag闪烁，已按真实红灯与回归修复，见`docs/81-MAP-PLACE-NAME-PERSISTENCE-FIX.md`；Henry已明确认可该项修复，进一步授权调整「走近有名、最小比例尺整片无名」的总览，已在真实全站本机实现带局部证据和屏幕覆盖的真地名选取，见`docs/82-WORLD-MAP-SIGNPOST-COVERAGE.md`。Henry随后指出放大进入焦点句/漫游视图有明显割裂感，完整本机站点的过渡修复与未通过/已复核的浏览器证据见`docs/83-MAP-WORLD-TO-READING-TRANSITION.md`。2026-10-01 Henry授权Agent自行优化阅读稳定/手机进入地图的比例连续性及开发可处理的冷启动/跟手问题，不启动发布后的内容审核；总览比例参照、①②主动停驻/详情往返、真实外围点可达及单次公开JSON提前请求已在完整本机站点实现并收口，实况见`docs/84-READING-CONTINUITY-AND-COLD-START.md`。地图两引擎64/64、local全站130/130（1worker/60s单例）、Pages22/22、404单测通过；Windows受控冷启动约5.08→4.38s不是真机成绩，真机由Henry另行发布后体验反馈，长②图离屏仍未改。2026-10-02（本机UTC+8）Henry实看认可效果并明确要求push到GitHub Pages；候选`fcc495f`已正常推送，Actions `36890931998` build/deploy success，线上Chromium/WebKit×1440/390冒烟4/4，收口见`docs/85-SECOND-RELEASE-CLOSEOUT.md`。这是本次明确发布授权，**不等于独立首次访客、真机/读屏或权利Gate已过，也不是未来永久自动发布许可**。定点核对现行`src/app/Nav.tsx`已有六项一级导航，地图本就一级；此前`docs/74–75`把地图升格写成新提案是事实错误，已勘误。具体名称/地图形态/视觉/算法及线上实现未过Gate；不替换`docs/19–21`的已上线行为，不授权删小径、修改线上点位/数据或部署。

上线后维护/研究先读 `docs/48-MAINTENANCE-ROADMAP.md`；现行局部地图的条件对照、第二次上线准备与多尺度地图地名、闪烁修复及最新总览覆盖见`docs/78-LOCAL-ENCOUNTER-EVIDENCE-STUDY.md`、`docs/79-SECOND-RELEASE-PREPARATION.md`、`docs/80-MULTISCALE-MAP-PLACE-NAMES.md`、`docs/81-MAP-PLACE-NAME-PERSISTENCE-FIX.md`、`docs/82-WORLD-MAP-SIGNPOST-COVERAGE.md`、`docs/83-MAP-WORLD-TO-READING-TRANSITION.md`、`docs/84-READING-CONTINUITY-AND-COLD-START.md`、`docs/85-SECOND-RELEASE-CLOSEOUT.md`。最新研究授权、讨论溯源与文献索引见 `docs/54-MULTIVIEW-MAP-RESEARCH-CHARTER.md`，主题空间代表性真实基线见 `docs/55-SPATIAL-REPRESENTATIVENESS-BASELINE.md`，局部锚点/原文/配对图研究实况见 `docs/56-LOCAL-TOPIC-ANCHOR-STUDY.md`（R1完成，无赢家）；高维/可切换观察窗口实况见 `docs/57-HIGH-DIMENSIONAL-PROJECTION-WINDOW-STUDY.md`（R2-A完成）；完整流程与条件轴留书见 `docs/58-PROJECTION-PIPELINE-AND-BOOK-HOLDOUT-STUDY.md`（R2-B完成，观察器26窗只读5199）；对齐与seed稳定性见 `docs/59-ALIGNMENT-AND-VIEW-STABILITY-STUDY.md`（R3-A/R3-B完成）；R4-A～N 地图结构研究见 `docs/60-MAPPER-TOPOLOGICAL-BASELINE-STUDY.md`、`docs/61-MAPPER-LOCAL-CLUSTER-STUDY.md`、`docs/62-MAPPER-PARTITION-STUDY.md`、`docs/63-MAPPER-BOOK-CONTROLLED-REVIEW.md`、`docs/64-EMBEDDING-GRAPH-ISLANDS-PILOT.md`、`docs/65-LANDMARK-WITNESS-ATLAS-STUDY.md`、`docs/66-ROUTE-FIRST-READING-WORLD-STUDY.md`、`docs/67-LOCAL-ROUTE-CROSSROADS-OBSERVER.md`、`docs/68-ROUTE-AND-MAP-SPATIAL-TRACE.md`，Henry对同一路线三视图的知情反馈见`docs/69-LOCAL-THREE-VIEW-READING-TRIAL.md`，隔离的单步续读/可选岔路与图文共视工程和反例见`docs/70-ONE-STEP-READING-AND-CO-VISIBLE-MAP-PILOT.md`（Henry认可图文共视、质疑并列模式并要求固定地图；单人反馈已录），隔离星座图/书岛图形语法对照见`docs/71-LOCAL-STAR-AND-BOOK-ISLAND-ATLAS-TRIAL.md`（Henry单人反馈认为书岛/星座均缺有效信息或美感，未过设计Gate），三层有依据的图文信息小样见`docs/72-LOCAL-READING-STORY-INFORMATION-PILOT.md`（Henry认可部分信息增量但指出无背景访客须被教学、自然性未过Gate）；真实点直观入口/有依据局部团/受控3D的无讲解访客研究方向见`docs/73-FIRST-VISITOR-GROUPED-WORLD-RESEARCH-DIRECTION.md`（仅方向，未选算法/技术栈/生产方案）：从单点碎片到巨型节点、规模适中但跨尺度不稳的强制分组，R4-D已准备真实原文匿名对照，但Henry于2026-09-27指出题目歧义与标注成本，不再要求补完人工评分或以独立盲审作为继续研究的硬Gate；详见`docs/54 §4.1`与`docs/63`。可由Agent在特殊案例做注明非独立的原文判断，目标是更有依据的embedding相似建模、清楚区分原空间关系与二维导航，而非证明语义最优；R4-E互选近邻阈值岛屿得到单点海与巨型块；R4-F真实地标—见证图边有依据但离群地标/尺度不稳；R4-G按原空间有向近邻跨书游走；R4-H隔离本机只读观察器已在真实浏览器跑通；R4-I将交互岔路置于已发布地图点位作空间轨迹诊断，揭露原空间邻近与二维长跳的错位，但未选新地图/产品算法，也尚无访客/产品Gate；Henry认可“有意思但不准确”可作为本机阅读体验研究偏好，仍不能把模型图结构称为确定语义或自动替换线上地图。Henry 已授权在隔离实验中更换地图算法、本机 embedding 与流程；此前保持点位/3D 暂缓是历史实验边界，不是永久禁令。旧线上 `7ebf2a3` 保留为历史研究对照；第二次上线消费者代码基线为 `fcc495f`（2026-10-02本机日期），点位/地形/公开范围不变，实验仍不自动进入公开快照或部署；远程模型仍单独许可。无名区域暂不处理；地名需要真实局部支撑，标签缺失不是确认负例。每轮保存输入指纹、参数、命令、失败与未验证项，不宣称未经检验的首创或语义真值。

## 执行规则

- 先检查目录、现有实现及 Git 状态；保护既有工作，不因为本交接写着“无代码”就覆盖后续代码。
- 当前 Slice 0–4、V2-A～V2-E4D、**Release-A（A1～A4）与 V3 Batch 0–6** 均已完成；Batch 6 最终 assignments 为 1,694 reviewed / 2,969 draft，累计 688 条全文 override 已应用，自动 reviewed 高风险为 0。低信心内容诚实保留 draft，不为覆盖率强贴标签。local snapshot、1,694 条路径投影与 4,663 点最终地图已重建；最终地图精修已完成渐进展开、移动端重排、独立导航入口、滚轮隔离和 Book Aura 书籍选择器，产品与艺术指导审阅及 Batch 7A 阅读版心与界面减法的工程实现已完成；用户认为视觉尚不惊艳，7A视觉 Gate 未通过，用户选择跨页关系后认为`docs/34`的深图浅文在手机断层，转而授权全深交互样板；7D-0地图详情可见抵达与7D-1局部全深样板已实现，7D-3亮书选书弹层已精修，7E世界总览地形开场已作为局部构图试验实现；7G已完成130本/56小径全量布局边界审计与长书名/缺封面精修，7H已完成首次访客任务卡与本机可验证对比度/键盘审计，实况见`docs/39`、`docs/40`、`docs/41`；**首次访客、真机/Safari/读屏及最终视觉Gate仍待验证**；原Batch 7B–7C仍暂停。正式导出 public snapshot、复制 public covers、创建 repo、push 或部署仍需单独 Gate。
- 使用 Windows 原生 Node/npm/Git 与 PowerShell。不要混用 WSL 路径。
- 不在非空项目根目录直接运行可能覆盖文档的脚手架；优先逐文件建立 Vite 配置。
- 版本首次安装时选择彼此兼容的稳定版本并提交 npm 锁文件，不凭空声称某版本是最新。
- 不引入登录、数据库、远程后台、同步服务、AI 人格分析、社交、远程统计或 Window 嵌入。允许显式 Batch 中的本机 Studio 与离线 embedding API 调用；public/local 消费者运行时不得调用模型。
- 已授权移植并使用项目内微信读书 skill 获取相关真实数据；仅按 `09` 的取数边界操作。不访问 SiYuan、滴答清单、其他个人目录或凭证存储来补样本。
- 用户已明确授权读取全部书籍（包括私密阅读）的项目相关真实数据用于产品开发。取消少量 / 6 本限制，不因 secret=1 或未知状态停工，不再逐书逐批询问。可直接完成分页、读取真实划线、建立 local-only 快照并开发；正式公开发布仍单独确认，详见 `09 §1`。
- 仅已确认可公开的快照进入 `src/`、`public/` 和正常构建产物。开发中的真实数据走 `dev:local` 路径（见 `02` / `09`）。**注**：用户已确认开发阶段内容可自由传输使用，隔离的目的不是保密，而是“公开发布决定尚未做出”——不要把它当成保密要求，但也不要自行把内容改成已发布状态。
- 真正不能外发的只有凭证：`WEREAD_API_KEY`、账号标识、原始回包中的个人字段，不得出现在会话输出、代码、提交或外部请求中。
- 没有真实材料就保持空状态和数据阻塞，不写 demo / mock / fake 书摘、作者、阅读年份或统计；不能把生成文本归给真实作者。
- 不上传内容，不部署，不自动 push，不添加遥测。需要这些操作时先取得授权。
- 可进行任务相关安装、构建、测试；网络或工具不可用时明确报告，不把未执行写成通过。
- 可以做小步本地 Git 提交（若仓库存在或已在本目录初始化），不得改全局身份配置、重写历史或丢弃用户修改。

## 代码要求

- TypeScript strict；数据和算法独立于 React；选择算法接收可注入 RNG 与时间。
- Book Theme 与 Highlight Topic Tag 必须是不同类型与语义；Topic Tag 每条 1–3 个、地位平等，不恢复质量分、人格标签或 Opening/Contrast/Surprise。
- embedding provider、缓存、评测与向量只在 `.private` / scripts / Studio；public snapshot 不含原始高维向量、置信度、理由或私有 note。默认 provider 已改为本机 `Xenova/bge-large-zh-v1.5@a48549b-q8-cls`；SiliconFlow 结果只作历史对照，不再发送新的划线文本。若未来重新启用任何远程 provider，必须先获用户明确许可，API key 只来自非 `VITE_*` 环境变量。
- 小径算法先满足按书公平、首轮不重复与全量可达，再在选中书内部使用 embedding 调节近/中/远节奏；无 embedding 时必须稳定降级。
- 地图总览不得创建 4,663 个 DOM 按钮或同时渲染全文；使用 Canvas/预计算图层或等效低 DOM，并提供小径列表与区域列表作为无障碍替代。
- 不使用 `dangerouslySetInnerHTML` 展示内容；不引入不必要的状态、动画、UI 或推荐框架。视觉以 `docs/21` 为准；纯 CSS 能完成时不用动画库，reduced-motion 必须取消位移、缩放与长过渡。
- 原生语义优先；键盘、移动端、长文本、200% 缩放和 reduced-motion 是主路径要求。
- 分享必须绑定稳定 highlight ID，不能依赖数组下标或当前随机位置；V3 卡片与复制文本显示该条全部 Topic Tag，不截断为 `+N`。
- 每片补充必要测试与真实截图，不以“编译通过”替代交互和视觉验收。
- 新增依赖须说明用途；纯 CSS 能完成的过渡不用动画库。

## 每个内部阶段与连续批次完成后

每个内部阶段都更新 `docs/08-REVIEW-CHECKLIST.md` 的执行记录并做小步本地 commit，说明：完成范围、修改文件、实际命令和结果、浏览器证据、未验证项、偏差和下一步。只要阶段 Gate 通过且没有新的产品冲突，可连续进入同一批次的下一阶段；整个批次结束后再统一停止汇报。Batch 0 完成后按 `docs/22` 明确停止汇报，不自动启动 Batch 1。

缺浏览器时可以继续纯函数、静态检查和实现，但界面验收保持未验证；在对应视觉 Gate 前必须补齐。不要反复为已明确的常规实现事项提问；只有产品边界、隐私、真实材料和不可逆操作需要升级。全部书籍的开发取数授权已经解决，local-only 快照现有 4,663 条 / 130 本；V3 可直接进行私有 embedding、标签与地图开发。既有公开清单审核已完成，但新增标签与地图仍需在正式 export 前复核。
