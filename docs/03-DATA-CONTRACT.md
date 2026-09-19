# 03 — 真实数据契约

> **当前实现：schemaVersion 3（V3 Batch 4）。** Book Theme 引用仍在 Book（`themeIds`）；Highlight 新增 0–3 个 `tagIds`，其中 0 表示当前试点尚未 reviewed，不表示“没有主题”。快照包含 56 个公共安全 TopicTag 定义、294 条 reviewed 试标投影，以及只为这些 reviewed 条目导出的 16 维量化 `pathVector`。全量 4,663 条仍在 local-only 快照；其余 4,369 条不造标签。私有 `PublicationPolicy`、高维 embedding、候选标签、confidence、rationale、family、审核备注都不属于消费者 Snapshot。

## 1. 硬边界

页面只使用 Henry 真实划线原文。来源为获授权的微信读书 `/book/bookmarklist`；不使用热门划线、他人点评、个人想法或生成文本替代。

不存在 `demo` 模式。数据缺失时空状态；内容不足不凑数。用户已给予全部书籍（含私密阅读）的数据读取和开发使用许可，直接获取并建立 local-only 快照，无需逐条确认本机使用。公开清单与发布检查留到发布前，不阻塞当前开发。

## 2. 前端快照类型

当前 schema 3 字段白名单如下；运行时严格校验，拒绝额外字段：

```ts
type Snapshot = {
  schemaVersion: 3;
  visibility: 'public' | 'local-only';
  owner: { displayName: string; siteTitle: string; about?: string };
  themes: Theme[];           // Book Theme
  tags: TopicTag[];          // Highlight Topic Tag，公开层保持扁平
  books: Book[];
  highlights: Highlight[];
};

type Theme = {
  id: string;
  title: string;
  description?: string;      // Book Theme / 书架说明，不描述人格
};

type TopicTag = {
  id: string;                // tag-NNN，改名不换 ID
  title: string;             // 2–4 字
  description?: string;      // 公共安全定义，不含私有边界 note
};

type Book = {
  id: string;                // 本项目稳定 ID，不使用账号 ID
  title: string;
  author: string;            // 缺失显示“作者信息暂缺”，不猜测
  description?: string;
  coverPath?: string;        // covers/… = 公开素材；local-covers/… = 仅本机服务
  themeIds: string[];        // 1 个主书架 + 0–2 个次书架
};

type Highlight = {
  id: string;
  bookId: string;
  text: string;              // 保留原始段落和标点，不改写或补全
  year?: number;             // 来自 createTime；缺失就缺失
  tagIds: string[];          // 0–3 个，按快照 editorial order；正式全量阶段要求 1–3
  pathVector?: number[];     // 16 维 -127..127 整数；只为 reviewed 试点导出
};
```

组件通过稳定 ID 索引取得出处与标签，不复制多个可漂移版本。`pathVector` 是固定算法从本机 1024 维向量派生的低维量化导航数据，只能在公平选书之后调节书内近 / 中 / 远节奏；它不是原始 embedding、标签置信度、地图坐标或候选资格。未来 `map` 仍由 Batch 5 独立加入。

`privacyRisk / hidden / reviewState / sourceBookmarkId / userVid / rawResponse` 不属于前端契约；它们只在私有审核记录里使用。公共快照不是“全部数据 + hidden 标志”。

## 3. 原始到快照的映射

| 原始字段 | 处理 |
| --- | --- |
| `updated[].markText` | text；只允许规范 CRLF 为 LF；不截取拼接不同划线 |
| `updated[].bookmarkId` | 留在私有映射表，分配一个永久本地 ID |
| `updated[].bookId` | 对照真实 Book，使用稳定本地 bookId |
| `createTime` | 按文档 Unix 秒转换，以 `Asia/Shanghai` 取年；无效 / 未来值标记待核对，不猜测 |
| `book.title / author` | 使用返回原文；不同版本书籍不能只凭同名合并 |
| `cover / deepLink / range / chapterUid` | 默认不进入快照；位置仅用于本地核对。封面经 `npm run covers:fetch` 下载到 `.private/covers/`，以 `local-covers/<file>` 写入快照 |
| `reviewCount / bookmarkCount` | 不当划线数，不用于“精选数” |
| `noteCount` | 平台划线数，仅可本地比对；不作为当前站点公开数量 |

公开 ID 使用 `h-0001`、`b-0001` 等持久分配即可，**示意格式不是预置业务记录**。ID 映射放在 `.private/curation/`；撤回 ID 保留不复用。无需以账号或原始 ID 拼接 URL。

## 4. 私有审核账本

建议 `.private/curation/review.json` 保存：

- 源文件、源 bookId / bookmarkId、公开 ID 映射。
- 用户授权的获取范围及对话确认摘要（不抄密钥）。
- `usePermission: pending | local-only | public | rejected`。
- 书籍 `secret` 状态（含 unknown），原始日期，文本校对结果。
- `privacyRisk: low | medium | high`、`hidden`、审核备注。
- 质量、Opening / Surprise、主题建议以及是否获用户确认。

Agent 可依据已明确的全书开发授权把所选真实记录记为 `local-only`，不需逐条向用户申请；可将主题建议用于本机快照并记待复核。不能代签公开审核。公开导出仅接受 `public + low + hidden=false`，中 / 高风险先排除或由用户重新审阅；不靠运行时降权处理。

对于模糊化日期，只导出 year。对文本有隐私顾虑时排除整条；不要为了可公开擅自改写原文。

## 5. 运行时校验要求

错误需指出记录 ID 和字段，不把整段私密文本写入日志。

**阻止加载 / 构建：**

- schemaVersion 不是 3、额外字段、必填字段不合法。
- 重复 ID、空白 text / title、bookId、themeId 或 tagId 悬空。
- TopicTag ID 不是 `tag-NNN`、标题不是 2–4 字、同名 / 同 ID 重复；Highlight 标签重复、超过 3 个或不按快照顺序。
- `pathVector` 不是恰好 16 个 -127..127 整数。
- year 非合理整数或未来年份。
- 单本书超过 3 个主题标签（1 主 + 2 次）。
- coverPath 不是获准本地 `covers/` 或 `local-covers/` 路径、含 `..`、URL 或查询参数。
- public 快照里出现 `local-covers/`、local-only 数据或原始字段。
- public 构建读到 local-only / 未授权数据。

**不阻止真实数据浏览，但阻止完整体验验收或产生警告：**

- 主题书架少于 8 或多于 15 个；某书架不足 2 本书或没有书。
- 有书没有主题书架，或有书没有任何划线。
- Topic Tag 暂无 reviewed 划线，或试点中尚未达到未来公开小径建议的 3 本 / 5 条；未标注划线数量会明确报告。
- 缺少短 / 中 / 长 / 原始换行样本、跨年样本。

开发者不能通过放宽校验或造内容“消除”警告；记录真实覆盖缺口，向用户请求补充真实材料。

## 6. 策展目标

v2 不再把库局限在 30–50 条。全量结构有效、去重后的真实候选都进入 local-only 快照（当前 4,663 条 / 130 本 / 14 个主题书架），页面密度由 UI 控制（docs/10 §7）。

仍然成立的覆盖目标：至少有一条 1–40 字、一条 41–120 字、一条 121 字以上以及有原换行的真实文本。缺哪档就报告哪档。

Book Theme 是书籍的书架标签（每本 1 主 + 0–2 次），不是对句子的语义判断。V3 另增属于 Highlight 的 Topic Tag（每条 1–3 个平等标签），用于主题小径与地图；它必须依据完整原文和受控词表，不得编造人格、立场或质量判断。

v1 的逐句 `qualityScore`、`openingCandidate`、`surpriseCandidate` 已从前端契约移除；它们只作为历史审核信息留在私有文件里，不再影响展示。

## 7. 统计与真实性

默认只显示：`这里收录 N 条划线，来自 M 本书`，以及快照中真实年份范围；不能称“累计读过 M 本”。某本书的数量写 `这里收录了 N 处划线`，避免把精选数量说成平台全部数量。

总体阅读时长、读过书籍数默认先省略，避免扩范围。若 About 确有需要，现有开发授权允许读取必要真实统计并用于本机页面；使用 `/readdata/detail` 前读对应 skill 文档并记录来源、统计口径，公开前确认展示范围。秒不当分钟，笔记不当划线。

## 8. 测试数据政策

业务内容测试复用获授权的真实快照子集，不新增编造文本 / 出处。可以取空集合、一条或若干条真实记录测试边界；数据校验测试可从真实记录删除字段、改变结构类型来构造错误输入，但不得进入 UI / 截图 / 正常快照。

只有本机许可时，测试 fixture 同样留在 `.private` 并禁止公开测试 artifacts。尚无真实划线时相关测试明确 blocked，不写假的 passage 让测试通过。
