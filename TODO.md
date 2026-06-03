# TODO

按 PR #2 / claude/upbeat-euler-2bS9j 分支的当前推进顺序排。完成后划掉。

## 当前任务：用 6 月云南行程驱动 Demo 验证

### 阶段 1 — 用现有数据点亮屏幕（~5 分钟）

预期产出：浏览器看到云南 Bar Chart 有真实数字（大概率只有 6 月一根柱子，因为数据集中在最近几天）。验证 pipeline 端到端通。

- [ ] `python3 data/scraper/fetch_provinces.py` — 拿 36 省统计（之前签名报错的那个，已修）
- [ ] `python3 data/scraper/fetch_taxon_list.py` — 拿完整鸟种名录（同上）
- [ ] `python3 data/process/load_taxa.py` — 把名录导进 DB
- [ ] `python3 data/process/load_checklists.py` — 重导 checklist，**注意打印的 top-10 鸟种**
- [ ] `python3 data/process/export_json.py --province 云南` — 导出前端 bundle
- [ ] 浏览器刷新，省份选云南，物种填打印里的某个名字 → 看到 Bar Chart 有数字
- [ ] 把渲染出的截图 / 数字感受贴回来

### 阶段 2 — 按行程扩抓真实样本（~45 分钟）

预期产出：跨完整 12 个月的云南 checklist，足够画有意义的 Bar Chart（包括 PRD 示例「黑颈鹤」该是 11月-2月高 / 6月几乎 0）。

- [ ] `python3 data/scraper/fetch_checklists.py checklists --province 云南 --start 2025-01-01 --end 2025-12-31 --max-pages 30 --limit 50` — 约 1500 条 checklist 覆盖整个 2025
- [ ] `python3 data/scraper/fetch_checklists.py observations` — 多 session 跑（每 session ~40 份触发 captcha 即停，等 5-10 分钟再起）
  - [ ] 跑 4-5 轮（共 ~150-200 份 observation）应该够初步展示
- [ ] 重新 `load_checklists.py` + `export_json.py --province 云南`
- [ ] 浏览器看一眼黑颈鹤：理论上是冬鸟（11-2 月）

---

## 已识别的后续工作（等阶段 1+2 通了再决策）

### 数据层
- [ ] **captcha 反爬绕过策略决定**（小型 demo 后再做）
  - A. 慢速率 10s/req（8 天跑全云南，无代码改动）
  - B. 浏览器登录态 cookie（1-2 小时代码，效果未验证）
  - C. Playwright 自动解 captcha（1-2 天代码，最稳）
- [ ] **找经纬度接口** — 当前 checklist 列表无 lat/lng，组合 3 地图需要
  - 可能在 `/front/activity/get?reportId=` 单报告详情
  - 或 commonBird `database/ebird_cn_hotspots.json` 反向匹配 `point_name`
- [ ] **西藏数据**（拉萨 / 玛旁雍错 / 冈仁波齐 / 扎达 6 月样本）— 验证多省切换

### 前端 / 产品（PRD v2.2 P1-P5）
- [ ] **组合 1 名录页**（默认入口，MVP 核心）—— 当前只有组合 2 Bar Chart
- [ ] **组合 3 地图页** —— 需经纬度先就位
- [ ] **统一三槽查询条** —— 当前是省+物种两 input，要变成"三个槽，留空即提问"
- [ ] **数据诚实性**：N<15 灰化、显示 total_reports、年份范围可调
- [ ] **迁徙状态层**（留鸟 / 夏候 / 冬候 / 旅鸟）
- [ ] **AI 自然语言摘要**（组合 1 名录页"夏候鸟已到齐..."一句）—— 单列能力项
- [ ] **多物种叠加 Bar Chart**（行程优化交集）—— 已经有 bundle 数据支持

### 工程
- [ ] PR #2 主线 review / merge 到 main 的时机
- [ ] 项目目录改名为 `birdtrace` 还是保持 `BirdTrace`？PRD 用小写
- [ ] 移动端响应式适配（PRD 明确要照顾出行前手机查询）
