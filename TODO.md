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
| 西藏 6/14-22 | 拉萨/日喀则/玛旁雍错/冈仁波齐/扎达 | **DB 完全没有，从零抓** |

- [~] **`fetch_trip.py` 定向抓取（后台跑中，task bljs4ffhz）**：① 西藏 checklist（6 月优先 + recent sweep）② 云南行程区 5-7 月 observation（6 月优先）。带 captcha 冷却自动重试，3h deadline 兜底
  - [ ] 确认西藏源站可行性（尤其偏远阿里：玛旁雍错/扎达/仲巴源站可能也稀疏）
  - [ ] 抓完 `load_checklists.py`（西藏会自动归一化省名）
- [ ] **export 支持地点粒度**：现在 `export_json.py` 只按省聚合（`WHERE province=`）。需加按 `city/district/point_name` 过滤的导出（数据本就在表里，SQL 加 WHERE 即可），前端才能查「玉龙雪山 6 月有什么鸟」
- [ ] 多省支持：export / 前端能切云南↔西藏

### 前端 / 产品（等线框图）

- [ ] **行程视图**：按行程把停留点排成时间线，每点给该月物种清单 —— 等 Amber 的线框图再定交互
- [ ] 组合 1 名录页（地点+时间→物种清单，MVP 核心；当前只有组合 2 Bar Chart）
- [ ] 统一三槽查询条（地点 / 时间 / 物种，留空即提问）
- [ ] 数据诚实性：N<15 灰化、显示 total_reports（行程区样本薄，这条尤其重要）

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
