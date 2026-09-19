# 26 — V3 Batch 4：schema 3、主题小径与视觉基础

> 日期：2026-09-19
>
> 状态：**Batch 4 已完成，用户体验 Gate 已于 2026-09-19 通过。** 用户反馈主题小径“挺棒的”，已授权进入 Batch 5 世界地图。本阶段只把 Batch 3 的 294 条 reviewed 试点接入 Local World；没有把 6 条 draft 或其余 4,369 条强贴标签。public snapshot 仍为空，正式导出、push 与部署均未开始。

## 1. 交付范围

Batch 4 完成四层工作：

1. schema 2 → schema 3；
2. 按书公平、有限不重复的小径算法与可关闭的 embedding 软节奏；
3. `/paths`、`/paths/:tagId`、岔路、线索入口与全标签分享；
4. 门厅 / 小径列表 / 小径房间 / 岔路 / 分享卡片的 V3 纸、墨、光视觉基础。

## 2. schema 3 与真实试点

消费者快照新增：

```ts
type TopicTag = {
    id: string;
    title: string;
    description?: string;
};

type Highlight = {
    id: string;
    bookId: string;
    text: string;
    year?: number;
    tagIds: string[];
    pathVector?: number[];
};
```

实际 local snapshot：

```text
划线                    4,663
书籍                      130
Book Theme                 14
Topic Tag                  56
reviewed 标签投影           294
未标注                     4,369（含 6 条 draft）
pathVector            294 × 16
```

`pathVector` 是从本机锁定的 1024 维 BGE 缓存，经固定随机符号投影、L2 normalize 与 -127..127 量化生成的 16 维派生数据。它不是原始 embedding，不携带 confidence / rationale / candidate / family / note，也不决定一条划线是否进入小径。

strict validator 拒绝：未知 / 重复 / 乱序 tag、超过 3 个 tag、私有生产字段、非法 `pathVector`、原始 ID 与额外字段。public 空快照也同步为 schema 3，但仍为 0 本 / 0 条 / 0 标签。

## 3. 小径算法

硬约束顺序：

```text
当前 tag 的 reviewed 候选
→ 排除本轮已见划线
→ 按书公平 cycle
→ 多书时尽量避开当前书
→ 只在已选书内部选句
```

性质：

- 候选按 stable highlight ID 排序；
- RNG 可注入，固定输入可复现；
- 一轮内每条恰好一次，完成后停住；
- 只有点击“重新走一遍”才开启下一轮；
- 全部 56 条真实试点小径在 `uniform` 与 `semantic` 两种模式下均全量可达；
- 无投影、候选不足或向量异常时稳定退化为均匀随机。

“有呼吸”模式只在选中书内部，把候选分为近 / 中 / 远宽区间随机选择，并避开单一最近重复和最远离群。它不改变资格、书籍公平或公开范围。

## 4. 路由与岔路

新增稳定 URL：

```text
/paths
/paths/:tagId
```

`/paths` 显示 56 条真实小径的名称、定义、书数与划线数，不做标签云、排行或彩色卡片矩阵。

多标签划线的岔路行为：

1. 点击另一线索前，把该交叉句写为目标路径 session 的首点；
2. push 新路径 URL；
3. 新路径第一帧仍是当前句；
4. 下一次“继续沿着……”才离开；
5. Browser Back 恢复原路径、原句、进度与节奏模式。

门厅、主题房间与书籍房间只在当前划线已有 reviewed 标签时显示全部线索；未标注内容不显示“待标注”或模型候选。

## 5. 分享

页面、复制文字与 CSS 分享卡片都显示当前划线的全部 Topic Tag，按快照 editorial order：

```text
原文

#希望 #机会 #不确定性

——《书名》作者

来自 Henry's Reading World
```

不截断、不显示 `+N`、不改变 canonical `/?h=<stableHighlightId>`。local-only 边界不变：只允许复制本机链接，不调用 Web Share、不上传、不生成 PNG / QR。

## 6. 视觉基础

建立并应用：

- 暖纸、分层墨色、规则线、绿色主 accent 与暖色辅助 token；
- 五项文字主导航；
- 无卡片的小径长列表；
- 小径标题、定义、正文、出处、岔路与有限轮进度的明确层级；
- “纯公平 / 有呼吸”紧凑分段控制；
- 线索使用文字链接与细下划线，不做主题彩虹 pill；
- 短 / 中 / 长内容使用离散字号，不按 viewport 连续缩放；
- 分享卡片标签自然换行，长文继续自然增高；
- reduced-motion 取消路径位移与长过渡。

证据目录：`.private/review/v3-batch4/`，包括 `/paths` 1440 / 390 / 320、三岔路 1440 / 390 / 320、最长 reviewed 划线、全标签分享卡片和 reduced-motion 岔路。

## 7. 实际验证

```text
npm run check:local
  284 tests / 29 files
  typecheck / lint / schema 3 local validation passed

npm run test:e2e -- --workers=2
  109 / 109 local Chromium

npm run test:tags / test:publication / test:public
  10 / 10, 9 / 9, 1 / 1

npm run capture:v3-batch4
  3 / 3

npm run build / isolation:public
  public schema 3 empty build passed / isolation clean

npm run build -- --mode local-private
  expected protection failure confirmed
```

首次 4-worker 完整 E2E 为 108 / 109，唯一失败是 Chromium 真实 2× 放大的控件可达性时序；该用例随后隔离重复 5 / 5，并在 2-worker 全套中通过，因此未通过放宽断言掩盖。

## 8. 已知边界与下一步

- 只有 294 条 reviewed 试点进入小径；全量标注仍属于 Batch 6。
- 8 个试点标签尚未达到未来公开建议的 3 本 / 5 条；它们仍可用于真实原型，不冒充全量分布。
- 世界地图 `/map`、布局 manifest、Canvas、区域层与 Book Aura 点亮一本书属于 Batch 5。
- 真机移动端、Safari 与真实首次访客仍未验证。
- public snapshot 仍为空；Release-B～E、repo、push 和部署继续等待独立 Gate。

下一步已由用户于 2026-09-19 确认进入 Batch 5 世界地图；地图完成后仍需独立体验 Gate，才可进入 Batch 6 全量标注。
