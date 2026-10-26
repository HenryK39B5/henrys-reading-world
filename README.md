# Henry's Reading World

一个由真实微信读书划线组成的个人阅读空间。可以一句一句偶遇，也可以坐在河边或潮水旁留住一处文字，再沿主题、书房或世界地图继续阅读。

- 网站：https://henryk39b5.github.io/henrys-reading-world/
- 阅读方式：https://henryk39b5.github.io/henrys-reading-world/design/
- [本次公开版准备与发布记录](docs/108-PUBLIC-WATER-AND-MAP-RELEASE.md) · [维护清单](docs/48-MAINTENANCE-ROADMAP.md)

## 当前版本

第三次公开版已完成本机准备，等待本次授权发布：五项主导航“随便看看／主题小径／世界地图／书架／关于”，根入口提供“一句一句／河流／潮汐”。文字可以留住、完整阅读、主动放回、分享，或前往书房。书籍主题保留在书架内。

地图使用已冻结的原1024维精确余弦近邻与UMAP48管线，仅对已批准的公开划线拟合。坐标等比放入世界，地名锚在有局部支持的真实标签成员上；缩放、悬停、停驻、跨书对读和返回保持连贯。二维距离有损，不能当作语义真值或作者之间的引用关系。方法和正反例见[地图打磨记录](docs/106-MAP-COORDINATE-POLISH.md)。

## 公开范围

公开内容为独立审核的 **108本书、3,462条划线、56个主题标签和108张封面**。本次仅迁移结构并更新公开专用地图、地形；书籍、原文、稳定ID、标签、出处和封面与原审核内容相同。本机130本／4,663条完整范围及模型联想资料不随公开构建交付。

Book Theme用于书籍分类，Topic Tag用于逐条划线，多个Tag地位平等。缺标签表示尚未可靠标注；这些原文仍参与偶遇与地图。小径先兼顾书籍机会，再用离线投影辅助阅读节奏。全部已批准文字随公开快照交给浏览器；单句呈现不构成访问限制。

访客运行时不调用模型或后台。水面与字景是原创构图，不表示内容之间的语义距离。完整原文使用DOM和原生滚动，动态预览使用Canvas2D及Pretext测量；支持暂停、文字目录、键盘与减少动态。真实设备、独立首次访客、读屏、实际200%缩放和低端长期性能仍有待进一步验证，Playwright WebKit不等同真机Safari。

## 运行公开版

使用Windows原生Node.js 24与npm，不需要微信读书账号或API key：

```powershell
npm ci
npm run dev
# http://127.0.0.1:5173/
```

```powershell
npm run check
npm run build
npm run test:public
npx playwright test --config playwright.pages.config.ts
npx playwright test --config e2e/config/playwright.release-c.config.ts
```

`npm run build`仅读取已提交的公开快照、封面与地形，输出到`dist/`，无需private材料。地图发布清单`scripts/public-map-release.json`锁定内容、地图、地形摘要及离线参数；构建会拒绝不匹配的产物。克隆可验证和构建冻结产物；重新计算坐标另需本机离线向量缓存，不属于普通构建。

## 本机维护

`.private/`保存完整快照、发布决定、封面原件和离线产物，已被Git忽略。只有拥有本机材料的维护环境可运行：

```powershell
npm run dev:local          # 完整本机内容
npm run dev:play           # 完整本机内容、新地图候选及本机联想
npm run publication:review # 本机发布审核器
npm run tags:studio        # 本机主题标签Studio
npm run validate:data:local
npm run isolation:public
npm run publication:verify
```

最后两项需要已构建的公开产物及本机发布政策。验证会逐项核对已审核内容、封面派生字节、冻结公开地图／地形和静态房间入口。`publication:export`只在审核内容与冻结地图输入一致时保留该地图；内容改变时会拒绝写入，须明确准备匹配的新地图发布。不要直接改公开快照绕过审核，也不要把完整本机快照当作公开输入。

新书籍取数遵循[数据流程](docs/09-WEREAD-DATA-WORKFLOW.md)，公开内容变化仍需单独确认。远程模型调用、未来push和部署不会因本次发布获得永久授权。

## 文件与部署

- `src/`：阅读体验、领域逻辑与已批准的公开快照；`public/covers/`：公开封面。
- `public/favicon.svg`：原创图标单一源。`npm run icons:generate`生成32px PNG及180px触屏图标。
- `scripts/`：数据校验、离线生产、公开投影和发布验证；`e2e/`及`tests/`：浏览器、领域和构建契约回归。
- `.github/workflows/deploy-pages.yml`：`master`推送后执行`npm ci`和`npm run build`，仅上传`dist/`，部署到`/henrys-reading-world/`。

历史探索和被否决稿件保留在[执行记录](docs/08-REVIEW-CHECKLIST.md)与docs/91–107；第二次发布见[85](docs/85-SECOND-RELEASE-CLOSEOUT.md)，本次交付见[108](docs/108-PUBLIC-WATER-AND-MAP-RELEASE.md)。工程通过不替代真实设备、美感、权利或独立访客判断。
