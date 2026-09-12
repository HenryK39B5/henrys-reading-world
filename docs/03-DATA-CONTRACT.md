# 03 — 真实数据契约

## 1. 硬边界

页面只使用 Henry 真实划线原文。来源为获授权的微信读书 `/book/bookmarklist`；不使用热门划线、他人点评、个人想法或生成文本替代。

不存在 `demo` 模式。数据缺失时空状态；内容不足不凑数。用户已给予全部书籍（含私密阅读）的数据读取和开发使用许可，直接获取并建立 local-only 快照，无需逐条确认本机使用。公开清单与发布检查留到发布前，不阻塞当前开发。

## 2. 前端快照类型

以下是待实现类型，不是已存在的代码。字段白名单必须运行时严格校验，拒绝额外字段。

```ts
type Snapshot = {
  schemaVersion: 1;
  visibility: 'public' | 'local-only';
  owner: { displayName: 'Henry'; siteTitle: "Henry's Reading World"; about?: string };
  books: Book[];
  topics: Topic[];
  highlights: Highlight[];
};

type Book = {
  id: string;                 // 本项目稳定 ID，不使用账号 ID
  title: string;              // API 原始书名
  author: string;             // API 原始作者；缺失显示“作者信息暂缺”，不猜测
  description?: string;       // 已核对来源的简介摘录，或经审核的编辑说明
  coverPath?: string;         // 仅本地公开素材路径；不复制带参数的原始 URL
};

type Topic = {
  id: string;
  title: string;              // 根据真实划线策展，不是人格标签
  description?: string;
};

type Highlight = {
  id: string;
  bookId: string;
  text: string;              // 保留原始段落和标点，不改写或补全
  year?: number;             // 来自 createTime；缺失就缺失
  topicIds: string[];
  qualityScore: 1 | 2 | 3 | 4 | 5;
  standaloneReadable: boolean;
  pinned: boolean;
  openingCandidate: boolean;
  surpriseCandidate: boolean;
};
```

这是对 Brief 扁平 `Highlight` 的规范化：书名、作者、封面移到 Book；topics 改为引用；精确日期转为已审核年份。组件通过索引取得出处，不复制多个可漂移版本。

`privacyRisk / hidden / reviewState / sourceBookmarkId / userVid / rawResponse` 不属于前端契约；它们只在私有审核记录里使用。公共快照不是“全部数据 + hidden 标志”。

## 3. 原始到快照的映射

| 原始字段 | 处理 |
| --- | --- |
| `updated[].markText` | text；只允许规范 CRLF 为 LF；不截取拼接不同划线 |
| `updated[].bookmarkId` | 留在私有映射表，分配一个永久本地 ID |
| `updated[].bookId` | 对照真实 Book，使用稳定本地 bookId |
| `createTime` | 按文档 Unix 秒转换，以 `Asia/Shanghai` 取年；无效 / 未来值标记待核对，不猜测 |
| `book.title / author` | 使用返回原文；不同版本书籍不能只凭同名合并 |
| `cover / deepLink / range / chapterUid` | 默认不进入快照；位置仅用于本地核对 |
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

- schemaVersion 不支持、额外字段、必填字段不合法。
- 重复 ID、空白 text / title、bookId 或 topicId 悬空。
- score 非 1–5 整数、布尔字段非布尔、year 非合理整数或未来年份。
- coverPath 不是获准本地 `covers/` 路径、含 `..`、URL 或查询参数。
- public 构建读到 local-only、未授权数据或原始字段。
- public 快照对应审核清单没有全部 public 授权（私有审核检查在本机执行，正常公开部署不依赖私有文件）。

**不阻止真实数据浏览，但阻止完整体验验收或产生警告：**

- 总数少于 30 或大于 50：本轮样本目标未满足。
- 主题少于 3；某主题未连接至少 2 本书、至少 2 条划线。
- Opening 候选少于 3、没有满足条件的 Surprise。
- 缺少短 / 中 / 长 / 原始换行样本、跨年样本。

开发者不能通过放宽校验或造内容“消除”警告；记录真实覆盖缺口，向用户请求补充真实材料。

## 6. 策展目标

在真实材料允许时，选 30–50 条、约 6–10 本书、3–5 个主题；这是目标而非伪造配额。至少有一条 1–40 字、一条 41–120 字、一条 121 字以上以及原有换行的真实文本。缺哪档就报告哪档。

质量 1–5 是编辑评分，不是事实声称；默认 3，Agent 可基于真实内容初选供本机测试，人工 review 后调整。openingCandidate 应独立可读、20–120 个非空白字符、低隐私风险。平台 secret=1 不自动等于文本高风险，不阻止本机使用。长句可留在探索，不要每条都截成“金句”。

主题从内容出发，先给出 3–5 个待审建议和所对应的真实记录 ID，不预先套“不确定性”等模板。至少 2–4 条主题展示来自不同书籍；年份不同则自然呈现，没有则不制造时间纵深。

## 7. 统计与真实性

默认只显示：`这里收录 N 条划线，来自 M 本书`，以及快照中真实年份范围；不能称“累计读过 M 本”。某本书的数量写 `这里收录了 N 处划线`，避免把精选数量说成平台全部数量。

总体阅读时长、读过书籍数默认先省略，避免扩范围。若 About 确有需要，现有开发授权允许读取必要真实统计并用于本机页面；使用 `/readdata/detail` 前读对应 skill 文档并记录来源、统计口径，公开前确认展示范围。秒不当分钟，笔记不当划线。

## 8. 测试数据政策

业务内容测试复用获授权的真实快照子集，不新增编造文本 / 出处。可以取空集合、一条或若干条真实记录测试边界；数据校验测试可从真实记录删除字段、改变结构类型来构造错误输入，但不得进入 UI / 截图 / 正常快照。

只有本机许可时，测试 fixture 同样留在 `.private` 并禁止公开测试 artifacts。尚无真实划线时相关测试明确 blocked，不写假的 passage 让测试通过。
