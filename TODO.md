# TODO

按 PR #2 / claude/upbeat-euler-2bS9j 分支的当前推进顺序排。完成后划掉。

## 当前任务：用 6 月云南行程驱动 Demo 验证

### 阶段 1 — 用现有数据点亮屏幕（~5 分钟）

预期产出：浏览器看到云南 Bar Chart 有真实数字（大概率只有 6 月一根柱子，因为数据集中在最近几天）。验证 pipeline 端到端通。

> ⚠️ **2026-06-04 进展**：`api.birdreport.cn`（121.40.76.251）从当前网络 **TCP 超时不可达**（DNS 正常，Google 正常）——疑似 VPN 走墙外、API 封外网 IP。两个联网抓取步骤现在过不去，**改用 repo 里已有的现成数据**跑通了离线 pipeline。
>
> ✅ **2026-06-04 晚（换网络后）**：API **恢复可达**（443 succeeded，HTTPS 200/403 正常）。昨天阻塞的联网步骤今天全跑通。

- [x] `python3 data/scraper/fetch_provinces.py` — ✅ 36 个省份摘要写入
- [~] `python3 data/scraper/fetch_taxon_list.py` — 请求通了（签名 OK），但 `/front/taxon/search` 现在**不管传什么参数都返回空 list**（试过 name/keyword/taxonName/searchKey/page+limit 全空）→ **服务端这个 autocomplete 接口已废弃/改造**，非我方网络问题。taxa 表保持空，不影响 Bar Chart
- [~] `python3 data/process/load_taxa.py` — 依赖上一步的名录，名录为空故跳过
- [x] `python3 data/process/load_checklists.py` — 用已有 raw 重导成功（249 checklist / 467 obs）。top-10：黄臀鹎15 鹊鸲12 家燕9 麻雀9 栗臀䴓8 黑头金翅雀8 大杜鹃7 小䴙䴘7 珠颈斑鸠7 白喉红臀鹎7
- [x] `python3 data/process/export_json.py --province 云南` — 导出成功。**踩到两个坑已修**：
  - export_json 在缺 `provinces_summary.json` 时直接抛异常崩溃 → 改成缺失即跳过（warn）
  - DB 存的是「云南省」、前端用短名「云南」，对不上导致全空 → 在 load 时归一化省名（去 省/自治区/市 后缀）
  - 导出结果：5 月 215 份 / 6 月 34 份，203 个物种，每个物种都能画柱
- [x] 数据已点亮：物种柱覆盖 **5/6/12 月**（39/196/209 个物种有柱），total_reports 覆盖 1/2/3/5/6/12 共 6 个月
- [ ] 浏览器刷新，省份选云南，物种填打印里的某个名字 → 看到 Bar Chart 有数字（**待人工**：起 dev server 截图）
- [ ] 把渲染出的截图 / 数字感受贴回来

### 阶段 2 — 按行程扩抓真实样本（~45 分钟）

预期产出：跨完整 12 个月的云南 checklist，足够画有意义的 Bar Chart（包括 PRD 示例「黑颈鹤」该是 11月-2月高 / 6月几乎 0）。

- [x] 抓 checklist：发现 `--start/--end` 跨全年时 API **按时间倒序**只返回最新的（光 12 月就 >1500 条，30 页全落在 12 月）。**改为按月分段抓**（API 确认认 start/end：查 3 月全 3 月、查 1 月全 1 月）
  - [x] 已抓：1 月 150 / 2 月 147 / 3 月 99 + 12 月 1489（首轮全年倒序那批）+ 5 月 215 / 6 月 34（阶段1旧数据）
  - [ ] **待冷却续抓 4–11 月**：captcha 门（505）对 checklist 搜索接口也生效，~8 个请求/突发即限流。月度脚本逐月 3 页，等 8-10 分钟再跑剩余月份
- [ ] `observations` — 已抓 79 份（5/6/12 月）。captcha 门 ~40 份/轮，需多轮
  - [ ] 续抓 4-11 月的 observation（尤其 1/2 月冬季，验黑颈鹤）→ 跑 4-5 轮
- [x] 重新 `load_checklists.py` + `export_json.py --province 云南`（已跑，随数据增量再跑）
- [ ] 浏览器看一眼黑颈鹤：理论上是冬鸟（11-2 月）——需要 1/2 月 observation 到位

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
