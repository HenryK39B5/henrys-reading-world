# 04 — Serendipity Engine v0 实现规格

目标：可解释、可测试的策展式偶然。纯函数，不联网，不使用模型或持久化追踪。本文件把 Brief 权重思路落成原型默认值，不代表正式推荐架构。

## 1. 输入与输出

```ts
type SelectionResult =
  | { kind: 'selected'; id: string; reason: 'opening' | 'contrast' | 'surprise' | 'explore' | 'book' | 'fallback'; cycleReset: boolean }
  | { kind: 'empty' | 'exhausted-book' | 'only-current' };

// 具体类型按项目实现，语义保持一致
selectNext({ highlights, historyIds, seenInCycle, currentId,
  globalDrawCount, scope, nowYear, rng }): SelectionResult
```

`rng(): number` 返回 [0,1)，测试注入固定序列；排序之前按稳定 ID 排列，保证同输入、同 RNG、同 nowYear 同输出。函数不修改输入 Set / 数组，不更新 React 状态。

隐私与许可已在快照入口处理；算法不接收“隐藏但不可公开”的条目。`standaloneReadable=false` 可出现在书 / 主题列表，但不进入全局舞台随机候选；通过明确深链 / 用户选择仍可展示获准的记录及出处。

## 2. 会话与阶段

- 新页面生命周期为新会话；刷新重新开始，无 localStorage / cookie。
- 无深链：Opening 提交后 `globalDrawCount=1`，下一次是 Contrast，再下一次 Surprise。
- 有有效深链：显示深链记录并记曝光，计数同样从 1 开始，下一次 Contrast；不强行用 Opening 替换分享内容。
- 书内换句、手动点书 / 主题记录只记曝光，不增加 `globalDrawCount`。
- 前三阶段按实际被接受并提交的全局展示计数，不按点击次数、定时器次数或 React render 次数。
- 普通阶段定义：0 → Opening，1 → Contrast，2 → Surprise，>=3 → Exploration。

## 3. 去重先于评分

1. 根据 scope 建候选：全局需独立可读，书内仅同 bookId。
2. 排除 currentId。
3. 排除当前 cycle 已看过的 ID。
4. 候选不空才进入阶段规则；“好句”不能跳过去重。
5. 全局没有未看候选且至少有另一个可选 ID：开始新 cycle；候选仍排除 currentId；优先排除历史最后 3 个 ID，若因此为空，逐步把最早者放回，直至可选。
6. 全局只有当前一条：返回 only-current，UI 禁止空转；全局零条：empty。
7. 书内没有未看候选：返回 exhausted-book，不隐式重置全局 cycle，不从其他书补位。可给明确 `重看本书` 操作，只从这本书中排除当前后再选，不改变全局阶段计数。

`seenInCycle` 在全局 cycleReset 时重建；`historyIds` 保留用于曝光计数与近邻惩罚。不存在永久的“全会话零重复”承诺：池耗尽时明确进入新一轮，保证不相邻重复。

## 4. 阶段规则（按顺序降级）

### Opening

未看全局候选 → `openingCandidate=true` 且 20–120 个非空白 Unicode 字符 → 若空，所有 20–120 字的独立可读候选 → 若仍空，全部全局候选。取评分最高的前 5 条进行加权抽样。

### Contrast

对比当前舞台记录：

1. 不同书且有主题的双方主题不相交；
2. 不同书；
3. 任意未看候选。

空主题表示未知，不当作成功的主题反差。若只有一本书，稳定进入第 3 级，不报错。

### Surprise

先保证未看，再按：

1. 不同书且 `surpriseCandidate=true` 或距 nowYear 至少 3 年；
2. 任何满足上述 surprise 条件的候选；
3. Contrast 规则。

括号语义为 `differentBook && (curatedSurprise || oldYear)`。年份缺失不当旧记录；当前不足 3 年不写“来自 4 年前”。第三次只能尽力触发真实 surprise，不能强制伪造时间标签。

### Exploration

全部全局候选评分、取前 8 条加权抽样。后续不再强制每三句 Surprise；时间跨度奖励自然带入旧记录即可，避免每次都“刻意惊喜”。

### Book

同书未看候选，质量评分 + 轻微主题差异；可以含非独立可读原文，因为出处层保持展开。不得调用全局 Contrast / Surprise 覆盖用户指定书籍。

## 5. 原型评分

使用候选在当前 session 的值，不需要额外存储曝光记录：

```text
score = 2 * qualityScore
      + (pinned ? 2 : 0)
      + (不同于上一条书籍 ? 3 : 0)
      + (双方主题非空且不相交 ? 2 : 0)
      + (双方年份存在且相差至少 3 年 ? 1 : 0)
      + (年份存在且 nowYear - year <= 1 ? 1 : 0)
      - (出现在最近 3 条的同书 ? 2 : 0)
      - min(当前 session 该 ID 既往曝光数, 3)
```

全局始终只接受 year <= nowYear 的合法数据；年份新鲜度缺失则为 0。随机加权 `weight=max(1, score)`，轮盘抽样；累计误差落到最后一个候选。pin 是轻偏好，不可突破去重或隐私约束。

不需要在界面显示 score / reason，测试和开发诊断可以显示 ID 与 reason，不打印私有文本。

## 6. 最小测试集

使用真实获批记录及子集；覆盖不足注明阻塞。

- 固定输入、RNG、时间得到可复现结果；输入未被修改。
- Opening 优先指定池，缺池降级。
- Contrast 有不同书时不选同书；能避主题时避开，未知主题不伪算反差。
- Surprise 有旧年 / 策展候选时选中；没有时正常降级。
- 有未看内容时不重复；耗尽后不会相邻重复；单条不死循环。
- 空集合、同书集合、缺年份 / 主题时不崩溃。
- pin 不突破去重，非独立文本不进随机池。
- 书内选择绝不跨书，不耗费全局前三阶段；耗尽明确返回。
- 深链开场后进入 Contrast，20 次快速点击不会让阶段计数超出实际提交数。
- 不依赖概率型断言如“随机跑 10 次应覆盖每本书”；验证候选约束和固定种子行为。
