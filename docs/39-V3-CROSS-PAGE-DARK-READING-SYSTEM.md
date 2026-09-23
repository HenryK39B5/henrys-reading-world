# 39 — Batch 7F: 跨页深色阅读系统第一版

> 日期：2026-09-23
>
> 状态：用户认可 7E 地形开场，同时指出整站尚有兴趣项目感，授权先做跨页艺术指导与真实产品样板。本轮完成第一版工程与同内容对照；**商业级视觉 Gate 尚未通过**，原 7B/7C 不自动恢复。

## 判断与设计

问题不只是浅色页面与深色地图的突兀切换：门厅、书房、目录、小径之间此前共享同一套浅底横线，缺少空间区分。地图作为锚点继续是深墨绿；文字房间统一到中性的暖深灰和高对比文字，而不是整站同一块绿。书房让真实封面和当前书的低浓度 Aura 承担色彩；小径保留当前位置的短线与原文；主题书架、所有书、主题小径在宽屏成为无框双列平面索引，手机保持单列和自然增高。品牌、导航、筛选、线条与深色弹层共享一套基线；真实封面即使采样很暗，出处细线也与正文色混合以保持可辨。没有新增装饰背景、内容分组、AI 或筛选功能。

`src/app/ReadingWorld.tsx` 给所有消费页面加 `shell--night`，地图额外使用 `shell--dark-map`。视觉规则位于 `src/app/page.css`、`src/features/rooms/rooms.css`、`src/features/paths/paths.css` 与 `src/features/encounter/stage.css`，不是改动 public/local 数据契约。分享卡维持原有出版物配色，外围对话框和手工复制输入框采用当前房间材质。地图页专门收紧新页眉下的间距，避免统一设计挤掉地形首屏。

## 真实内容对照

统一捕获：`npx playwright test --config playwright.capture-cross-page.config.ts --workers=1`；旧版先以 `CAPTURE_PHASE=before` 拍摄。证据只在 `.private/review/v3-private-atlas/cross-page-dark/{before,after}/`，不提交原文图。1440×900、390×844、320×720，各 7 个固定房间：`/?h=h-013`、`/books/b-013`、`/paths/tag-040`、`/paths`、`/books`、`/themes`、`/map`。可重复随机源只用于截图，书籍和小径正文均在两次捕获中完全一致；截图脚本还以真实 snapshot 验证正文。额外保存 390px 三标签分享与 320px 最长划线完整元素截图。

21/21 场景无横向溢出。地图 hash 保持 `567534bf71bfc5f6266ceb8ecd26267c4399888d87a1d606fed784a03d9fcd9e`，4,663 点未重排。390px 地图首屏起点从旧版约 y=359 到新版约 y=367；新页眉只增加约 8px，不是初稿的 30px。截图能证明字体、密度与页面关系，不能证明长时阅读舒适度或真机触控。

## 回归和下一步

- 新增 `e2e/cross-page-dark.spec.ts`：不同页面的深色材料、真实小径索引与书房、320px 长文和分享、reduced-motion、Escape 焦点、200% 等价视口和地图回访。
- 修正旧 `e2e/map.spec.ts` 的浅色返回断言；Aura 对比度测试改读当前房间的纸面变量，保留正文 >7 与次要文字 >4.5 的门槛。实测正文约 12:1、次要文字约 8:1。
- `npm run check:local` 为 300/300；完整 Chromium E2E 最终 127/127；最终微调页眉间距与根级 color-scheme 后，地图/Aura/跨页专项 24/24 通过，截图任务1/1，`npm run check:local` 再次300/300，`npm run build`、`npm run isolation:public`、`npm run test:public` 再次通过。首次完整套件因旧测试以浅色纸计算深色正文而 126/127，修正计算口径后全绿；未改门槛。
- Safari、实际手机、读屏、真实浏览器 200%、低亮度长时阅读、其他书封明暗色域、首次访客与使用授权均未验证。

这是**跨页系统的第一版**，不是“已经商业成熟”的宣告。下一轮应对同一真实样本做精细艺术指导：检查 130 本书标题/封面在目录中的异常换行、书房与小径的阅读节奏、焦点与弹层动线，以及跨页面色彩切换的实际舒适度；再交用户做独立视觉 Gate。正式 public export、public covers、repo、push、部署仍需单独授权。
