# TODO

按 PR #2 / claude/upbeat-euler-2bS9j 分支推进。完成后划掉。

---

## 当前 MVP：用 6 月行程驱动「时间 + 地点 → 鸟种」

**驱动用例**：Amber 2026-06-09～22 的 14 天行程（云南西北 + 西藏），回答「我这几天去这些地方，能看到什么鸟」。完整行程见对话 / 记忆 `birdtrace-june-trip`。设计细节见 `docs/mvp-trip.md`。

**关键判断（2026-06-04）：这个 MVP 不需要经纬度。** 「地名 → 鸟种清单 / 柱状图」按 `point_name`/区县 分组即可；坐标只在地图页（PRD 组合 3）才需要。所以昨天那条「提优先级抓经纬度」的反馈，**不在本 MVP 关键路径上**，挪到地图页阶段。

### 数据层（关键路径）

行程对应 DB 覆盖（2026-06-04 查）：

| 行程段 | 地点 | DB 现状 |
|---|---|---|
| 云南 6/9-10 | 丽江/玉龙（玉龙雪山·云杉坪/束河/蓝月谷） | 6 月 64 份 checklist，**仅 2 份有物种明细** |
| 云南 6/11-12 | 香格里拉（独克宗/松赞林寺/普达措/虎跳峡） | 6 月 17 份，**1 份有物种** |
| 云南 6/12-13 | 德钦（梅里/雾浓顶/飞来寺） | 6 月 3 份，**1 份有物种** |
| 西藏 6/14-22 | 拉萨/日喀则/玛旁雍错/冈仁波齐/扎达 | ✅ 已抓 660 份入库（拉萨 6 月 17、日喀则 7、普兰 1、札达 4-5 月有 6 月 0）；物种明细后台抓中 |

- [x] **西藏其实有数据 —— 之前抓空是 `fetch_trip.py` 的 bug，不是源站没数据**（2026-06-04，Amber 给了西藏报告列表 URL 才发现）：
  - 真相：Phase1 能抓到 660 份西藏 checklist；但 Phase2 的 `yn_trip_report_ids()` SQL 用 `%` 拼 IN 子句，同串里有 `strftime('%m',…)`，Python 把 `%m` 当格式符 **崩溃**，导致 observation 从来没抓成、且进程整个挂掉（第一次 task 看到的「空目录」是另一次赶上 captcha 窗口）。**已修**（改成字符串拼接）。
  - [x] 西藏 660 份 checklist 已 `load_checklists.py` 入库（自动归一化「西藏自治区」→「西藏」）
  - [~] **物种明细后台抓中**（task bc6sraa4c，690 个待抓，~3s/个 + captcha 冷却）：云南行程区 + 全西藏报告的 observation。抓完再 load + 重导出
- [x] **export 支持地点粒度**（2026-06-04）：`export_json.py` 加 `--trip`。把旧 `province_bundle` 泛化成 `_bundle(province, districts, city)`：区县 > 市/地区 > 整省 三级过滤（省级旧导出零回归，已验证 312 种/月度计数不变）。按 `docs/itinerary-june.md` 把 7 个行程停留点映射到省/市/区县（西藏粒度按真实覆盖定：拉萨/日喀则用市级，阿里转山/扎达用区县），每点导出 `trip/<id>.json`（行程月 ranked 物种 + 12 月明细复用 Bar Chart 口径）+ `trip/manifest.json`。**自带数据诚实性 `data_status` = none/thin(N<15)/ok + `grain`**。当前实测（物种待 observation 抓完）：拉萨 6 月 17 报告 ok、日喀则 7 thin、玉龙 thin(2/42)、香格里拉 thin(1/17)、德钦 thin(1/3)、普兰 1、札达 0(none)
- [x] 多省支持：export 已能导任意省（`--province 西藏` 已跑）；前端「何时去」页省份下拉切云南↔西藏

### 前端 / 产品（线框图已到，2026-06-04 搭完三页骨架）

按 Amber「Explore 线框」重写前端（纸感风格 + 统一三槽查询条，commit c491521）：
- [x] **统一三槽查询条**（地点/时间/鸟种，留空那槽＝本页答案）
- [x] **组合 1 名录页**（MVP 核心，地+时→鸟）：完整接 `trip/<id>.json` 的 `month_species`，频率三档分层 + 导出鸟单
- [x] **地点拆到景点级**（云南）+ 西藏市/区县级（commit 11d9d55）
- [x] **居留型标签替换火花线**（commit 7ecc8ee）：留鸟/夏候鸟/冬候鸟/旅鸟/不确定，从省级 12 月模式推断（`classify_seasonal`）。无现成数据源，是推断；西藏仅 6 月数据→多为不确定（诚实）
- [x] **鸟名链接 eBird**：vendored commonBird 的 `ebird_sci_to_code.json`+ch4 修正到 `data/raw/refs/`，覆盖 99%
- [x] **组合 2 何时去**（地+鸟→时）：纸感柱图 + 最佳窗口高亮 + 样本<15 斜纹柱，接 province bundle
- [x] **数据诚实性**：名录页 `data_status`（none 空态 / thin 黄条 / ok）；柱图斜纹标 N<15
- [ ] **懂鸟链接**：需爬懂鸟分类表拿「中文名→编号」（commonBird 没有该编号），待 Amber 确认要不要做
- [ ] **行程视图**（7+ 停留点排成时间线，每点迷你卡）：当前是单点下拉切换 —— 下一步
- [ ] 季节速读现在是事实模板，**AI 自然语言摘要**仍在 Backlog
- [ ] slider「晚两周/早两周」微调：线框有，未实现
- [ ] 居留型推断精度受采样月份限制（云南有冬夏采样还行，西藏只有 6 月→不确定多）；以后可换 eBird Status & Trends 或权威居留型表

---

## 已完成（数据层打通，2026-06-04）

- [x] 换网络后 API 恢复可达；`fetch_provinces.py` ✅ 36 省。`fetch_taxon_list.py` 服务端接口已废弃（返回空，不影响 Bar Chart）
- [x] checklist 抓取：发现 API 按时间倒序，跨全年只返回最新月 → 改按月分段抓。已抓云南 1/2/3 月 + 12 月 1489 + 5/6 月（共 2134 条入库）
- [x] observation 已抓 79 份（5/6/12 月）
- [x] `load_checklists.py` + `export_json.py --province 云南` 跑通，Bar Chart 物种柱覆盖 5/6/12 月
- [x] 修两个坑：export 缺 `provinces_summary.json` 即跳过（不再崩）；load 时归一化省名（去 省/自治区/市 后缀），解决「云南省」vs 前端短名「云南」对不上
- [~] 浏览器截图验证 —— Amber 说先不做

---

## Backlog（MVP 之后）

### 数据层
- [ ] **captcha 反爬策略决定**：A. 慢速 10s/req（无代码改动）B. 浏览器登录态 cookie（Amber 可手动登录提供，1-2h 代码）C. Playwright 自动解（1-2 天，最稳）
- [ ] **经纬度接口**（仅地图页需要）：试 `/front/activity/get?reportId=` 单报告详情；或 commonBird `ebird_cn_hotspots.json`(~6217 点) 反向匹配 `point_name`。注意坐标系（百度 BD-09 / 高德 GCJ-02 / WGS-84）转换

### 前端 / 产品（PRD v2.2 P1-P5）
- [ ] 组合 3 地图页（需经纬度先就位）
- [ ] 迁徙状态层（留鸟 / 夏候 / 冬候 / 旅鸟）
- [ ] AI 自然语言摘要（"夏候鸟已到齐…"一句）
- [ ] 多物种叠加 Bar Chart（行程优化交集，bundle 数据已支持）
- [ ] 移动端响应式（出行前手机查询）

### 工程
- [ ] PR #2 review / merge 到 main 的时机
- [ ] 目录名 `birdtrace` vs `BirdTrace`（PRD 用小写）
