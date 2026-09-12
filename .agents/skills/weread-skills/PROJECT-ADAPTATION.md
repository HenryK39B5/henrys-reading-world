# 项目移植说明

## 来源与加载

从本机 Codex `~/.codex/skills/weread-skills/` 复制 9 个 Markdown 文件到当前目录，原目录保持不变。上游没有脚本或依赖文件，无需复制 Codex 配置、会话、缓存或凭证。

首次真实调用返回 `upgrade_info`，提示升级到 `1.0.4`。已从 `https://cdn.weread.qq.com/skills/weread-skills.zip` 下载官方包到 `.private/skill-upgrade/`，校验条目范围、审查新增文本后，只更新项目副本并增加上游 `SERVICE_PROFILE.md`。未执行压缩包内容，未修改 Codex 原安装。

本目录是项目本地 skill。实现 Agent 应按 `AGENTS.md` 显式读取 `SKILL.md` 和对应能力说明；不依赖某个客户端自动发现 `.agents/skills/`，也不需要修改全局 Agent 设置。

移植修改：

- 增加项目内的数据与隐私边界。
- Windows 使用 PowerShell，不要求 Bash。
- 当前上游版本及示例均为 `1.0.4`；执行时从 `SKILL.md` 顶部读取版本，不硬编码。
- `1.0.4` 改用回包自带 `deepLink`，不再手动拼接微信读书链接；公共快照默认不收录此字段，避免包含身份或追踪参数。
- 服务端升级信息触发暂停审查，而非自动执行远程指令。
- 可选请求辅助脚本：根目录 `scripts/weread-request.ps1`，只允许当前任务需要的只读接口。

## 项目调用范围

优先 `/user/notebooks`、`/book/bookmarklist`，必要时 `/book/info`。用户已明确授权读取全部书籍（包括私密阅读）的相关真实数据用于产品开发；不再按 secret 排除取数，不限 6 本，不需逐书逐批再确认。允许完整概览分页及分批读取全部有划线书籍，直接建立 local-only 开发快照。正式公开清单与发布仍另行确认，原始回包不进入公开包。

`/readdata/detail` 只在确实要使用真实总体统计时调用；不为“丰富页面”收集偏好时段、好友或账号资料。本轮页面优先使用公开精选集的派生计数。

不使用 `/review/list/mine`、公开他人书评、热门划线或推荐结果充当 Henry 的阅读痕迹。上游“所有笔记”合并导出流程不适用于本项目只取原文划线的任务。

## 已知边界

- 环境变量存在不等于鉴权有效，必须以实际只读调用判断。
- 原始 API 数据真实不等于已获公开许可。
- `.gitignore` 不是访问控制；Vite 开发服务器必须拒绝访问 `.private` 与 skill / scripts 目录，并在浏览器测试中验证。
- 只使用回包实际具有的字段。遇到未知 envelope / 参数变更先局部检查结构，不打印整个原始返回或错误响应。
- 原始 ID 与公开 ID 的映射保留在 `.private`；前端不需要账号标识。

详细数据流程见项目 `docs/09-WEREAD-DATA-WORKFLOW.md`。
