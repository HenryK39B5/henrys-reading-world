# 85 · 第二次公开上线收口

日期：2026-10-02（本机 UTC+8）。状态：**Henry 已明确授权 push；GitHub Pages 发布成功，线上冒烟通过。** GitHub Actions 记录 UTC 完成时间为 2026-10-01T16:19:18Z；这是同一次部署，不是日期冲突。

## 用户确认与范围

Henry 亲自查看本机完整站点后反馈「效果挺棒的」，明确要求「push到github page」。本次执行该授权，将已通过工程回归的候选 `fcc495f` 及此前待推送的本地历史正常 fast-forward 至 `origin/master`，没有 force push 或重写历史。

第二次上线包含可阅读局部地图、读者选另一真实书的①②对读与稳定停驻、原真点详情往返、地图总览地名覆盖/多尺度防闪烁/比例连续、站点图标/新地形首帧及公开数据单次提前加载。沿用已批准的108本书、3462条划线、56个Topic Tag、108张封面、同一公开点位和地形；不启动发布后的内容审核、补标或新模型。

## 实际执行

- 推送前 `git fetch origin` 后为0 behind / 50 ahead，工作区干净；没有 `.private/`、`.env*`、`dist/`被跟踪。
- 再跑 `npm run build`、`npm run isolation:public`、`npm run publication:verify` 通过。404单测、全站local130/130、地图64/64、Pages22/22等本轮工程回归见`docs/84`，本次没有把它们说成重新跑了一遍。
- `git push origin master`：`7ebf2a3..fcc495f` 成功。
- Pages workflow **36890931998**，head `fcc495f6bebb1d6932fc7f67aa53b47032d754b6`，`build`30秒、`deploy`36秒、最终`completed / success`。通过GitHub CLI按本次head匹配、watch至结束，没用旧发布的success冒充。
- 发布地址：`https://henryk39b5.github.io/henrys-reading-world/`；地图：`https://henryk39b5.github.io/henrys-reading-world/map/`。
- Windows真实浏览器访问线上地址：Chromium和Playwright WebKit各1440/390px，**4/4**。首页/地图HTTP200；首页只有1次公开JSON请求；线上HTML指向正确的`/henrys-reading-world/assets/public-snapshot-oONKGPkN.json`；地理比例参照720/390正确。选真实① `h-1443` 与② `h-3600` 后方向键平移/放大保持两条全文，②详情/浏览器返回保持组合，「看地图当前位置」结束停驻，无横向溢出或pageerror。
- 本机证据 `.private/review/map-continuity/live-second-release.{mjs,json}`、`live-{chromium,webkit}-{1440,390}.png`；发布前复核日志 `release-build.log`、`release-isolation.log`、`release-parity.log`。全部留在Git忽略的本机目录，不进公开构建。
- 本次收口文档/README/维护状态以`b4280d7`正常推送；不变更消费者源码、数据或构建契约。按该head匹配Actions **36892162747**并watch至`completed / success`，build30秒/deploy9秒，没有手动重复dispatch。产品代码基线仍为`fcc495f`。

工作流有Pages actions的Node20运行时迁移提示，但未阻止构建/部署；本次不临时升级工作流或依赖。

## 2026-10-02 · Henry实际手机反馈

Henry随后实际在手机访问线上第二版，认为整体使用体验不错，虽然屏幕小，世界地图基本操作还是比较顺畅，交互逻辑比较清晰。记为**知情单人、真实手机使用的定性反馈**；未提供机型、浏览器、网络、操作时长或冷启动测量，不推定物理Safari、低端长时性能或独立首访验收。他同时提出新一轮根本建模/产品形式研究，见`docs/86`；这不是新的发布授权，也不启动blanket内容审核。

## 发布后的边界

Henry认可的是本人所见的完整站点及手机使用体验，不能写成独立首访、全设备或权利验收。手机冷启动和长期跟手感尚无定量证据；Windows限速中位5.08→4.38秒不是手机承诺。Playwright WebKit不是物理Safari/iOS；读屏、低端长期GPU表现、独立首次访客、引文/封面权利仍未被这些检查证明。

窄屏长②可使190px地图滚出视口的取舍仍在，本次没有偷偷改为强制sticky。发布后按证据做内容审核的范围和方法仍待讨论，不自动开始。未来新的内容范围、坐标、模型、功能或发布仍按对应授权与维护规则处理，不将本次push许可视为永久自动部署许可。
