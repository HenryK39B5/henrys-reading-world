# Batch 7I - V3 公开投影导出前审计

日期：2026-09-23
状态：本机只读投影审计通过；正式 public export 未执行，发布 Gate 未通过。

## 范围与方法

沿用已完成的两轮逐书公开审核，不重复选择 130 本书。`npm run publication:audit:v3` 读取 `.private/local-snapshot.json`、现有 publication policy 和私有标签 assignments；用审核器同一 `projectPublicationPreview()` 生成**仅内存中的 local-only 投影**。报告仅写入被 Git 忽略的 `.private/publication-v3-projection-audit.json`，不包含划线原文、书名、作者、私有备注、置信度或理由。没有生成 public snapshot、public covers 或地图文件。

固定地图点从现有 local layout 按获准的 highlight ID 过滤；不重跑 UMAP，不移动、重归一化或补点。只根据保留的点和标签重新计算地形密度、等高线和标签中心，在内存中与 schema 3 一起校验。`projectFilteredMapLayout()` 是可供未来导出器复用的纯函数；本轮没有接入正式导出器。

## 实测结果

| 项目 | 本次结果 |
| --- | ---: |
| policy 已审核 / 拟公开 / 排除的书 | 130 / 108 / 22 |
| 拟公开划线 / 单独排除 | 3,462 / 6 |
| 拟公开划线中 reviewed / draft | 1,432 / 2,030 |
| 公开安全 Topic Tag / 保留的书籍主题 | 56 / 13 |
| 仅 reviewed 划线上的 16 维路径投影 | 1,432 |
| 策略允许的封面 / 预览中的 local coverPath | 108 / 108 |
| 过滤地图点 / 派生标签中心 | 3,462 / 56 |
| 过滤地图布局哈希 | `be60c7492408bdcbcf9de2424859bfb92d45e1df6657d734528c1b2f28c2e2da` |
| 仍在 public snapshot 内的书 / 划线 | 0 / 0 |

审计断言：排除书与排除划线均不进入投影；划线仅引用保留的书和标签；draft 无 Topic Tag 或路径投影；reviewed 的标签 ID 与私有审核结果逐条一致；原文、来源书、年份、书名与作者在投影中未改写；私有生产字段未进入 schema；地图点 ID 与拟公开划线一一对应，坐标与 local 原点完全一致，标签中心仅引用保留的标签。投影及过滤地图通过 `validateSnapshot(..., expectedVisibility: 'local-only')`。

## 命令与浏览器证据

- `npm run publication:audit:v3`：通过；仅写私有元数据报告。
- `npm run check:local`：typecheck、lint、301/301 单测及 4,663 条 local 快照校验通过；coverage warning 为 2,969 条未贴 reviewed 标签和真实原文无换行。
- `npm run build`、`npm run isolation:public`：空 public 构建通过，真实书名、原文和封面路径均为 0，私有字段探针 absent。
- `npm run test:public`：Chromium 1/1，所有公开空态房间诚实可访问。
- 本阶段没有消费者视觉变动，也没有新的 local 页面截图；没有重跑完整 128 项 local E2E、Studio 或 Safari/真机/读屏验证。

## 剩余 Gate

1. 未来正式导出器必须使用相同的 policy 投影、固定坐标过滤和派生地形，并对生成后的 **public** schema 3 快照、封面文件、构建产物与跨页路径重新审计。本次内存校验不等于完成正式导出。
2. 现有 `map:layout:public` 脚本会重新跑 UMAP，不能直接用于当前“坐标不移动”的发布路径；应改用上述过滤函数。当前未运行该脚本。
3. 公开内容引用与封面的权利判断不是工程审计的结论；About 页已补来源说明，但声明不能替代具体授权或个案判断。
4. public snapshot 导出、public covers、repo、push、workflow 和部署继续等待用户各自的明确授权。
