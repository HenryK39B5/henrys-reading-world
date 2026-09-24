# 站内产品说明：这个网站怎么运作

日期：2026-09-24
状态：本机实现与验收完成；未创建 repo、push、配置 workflow 或部署。

## 范围

- `/design` 为访客可直接访问、刷新与返回的独立页面；不增加主导航项。门厅底部与 `/about` 有入口，`/design` 从正文链接书架、小径、地图和来源说明。
- 内容以访客先读一句、查看出处、理解两种主题、沿小径跨书、探索地图、判断公开范围的顺序组织。使用少量必要技术词（两阶段选句、embedding、语义向量与二维投影），不用开发过程、模型跑分或人格分析叙事。
- 页面说明 Agent 辅助发现标签候选，低信心划线不强贴标签；全部当前范围划线参与地图，只有可靠标签使部分区域获得名称；模型在本机准备内容，不在访客浏览时调用。
- 说明已公开的原文随快照进入访客浏览器，单句呈现不构成访问控制；来源与上下文仍由 `/about` 说明。
- 保持当前本机 embedding、标签和地图原布局不变。只修改静态说明、链接、路由与样式；没有触碰划线内容或出版清单。

## 实际检查

- `npm run check:local`：typecheck、lint、304/304 单测、local schema 3 校验通过。
- `npm run build`：通过，公开数据校验保留 2 项已有覆盖提示；`npm run isolation:public`：通过。
- `npm run test:public`：7/7，包含从关于进入说明页的公开版检查。
- `npx playwright test --config playwright.pages.config.ts`：5/5，验证真实生产包 `/design` 深链、跨视口内容与链接、键盘进入小径。Pages 式回退仍以 HTTP 404 响应，这是已有静态托管边界。
- Local Chromium 全套 129/129；针对 720×450 的 200% 等价视口与 320/360/390/768/1440 响应式矩阵均通过，新增说明页纳入范围。
- Chromium reduced-motion 全页截图已人工查看：`.private/review/site-design/design-1440.png`、`design-390.png`、`design-320.png`。三种尺寸可读，没有横向溢出；真实 Safari、读屏、浏览器菜单缩放和外部首次访客评价仍未验证。
- `scripts/check-public-isolation.ts` 的旧探针会对访客文案中的普通“flomo”字样误报。仅将这一条缩到私有参考文件名 `flomo-starmap`、`flomo_178`；`share-cards`、敏感字段和凭证探针保持原样。

## 留给主人确认

页面已工程验收，但正式面对访客前，请 Henry 核对语气与第一人称措辞，尤其是 flomo 的描述、技术细节深度，以及“公开范围”段落是否符合他希望表达的设计主张。博客长文另行撰写，不与页面混成开发回顾。
