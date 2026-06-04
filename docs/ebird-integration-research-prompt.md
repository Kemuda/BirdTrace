# eBird 接入调研 prompt（给 Amber 用）

> 背景：BirdTrace 是一个**纯静态前端**（React，无后端/无登录），数据来自中国观鸟记录中心
> birdreport.cn，导出为静态 JSON。物种**以中文名为主键**。现已 vendored 两份映射：
> `ebird_sci_to_code.json`（eBird 学名 → [speciesCode, 中文名]）、`dongniao_name_to_nd.json`
> （中文名 → {懂鸟编号, 英文名}）。目标是把 eBird 接进来，服务 2026-06 云南+西藏行程。
>
> 把下面这段交给一个有联网搜索能力的研究助手（如 Claude 的 deep-research）。

---

## 调研目标

回答「BirdTrace 该怎么接 eBird」，给出**可执行方案 + 取舍**，覆盖两条独立路线：

### 路线 A：导入我的 eBird Life List → 标记「已见过」/ archive
我能从 eBird 账户导出个人数据。希望上传后，BirdTrace 自动把我已记录的鸟种标成「已见过」。
请查清并给出结论：
1. **导出格式**：eBird「Download My Data」(MyEBirdData.csv) 的确切列名、是否含 Scientific name /
   Common name / Taxonomic order / 中文名。给一份真实表头样例。
2. **Life List 专用导出**：My eBird → Life List 页是否能单独导出？格式与上面有何差异？
3. **名称匹配**：eBird 用英文名 + 学名，BirdTrace 主键是中文名。用现有两份映射
   （学名→中文、中文→英文）能覆盖多少？哪些类群最容易对不上（分类 split/lump、
   亚种、eBird 的 "sp."/"slash"/"hybrid" 形式）？给出匹配算法与兜底策略。
4. **隐私/落地**：纯前端方案下，CSV 只在浏览器本地解析、存 localStorage，不上传任何服务器——
   确认这条路线**不需要** API key，也不触发 eBird 的任何使用条款限制。

### 路线 B：用 eBird 的频率/物种数据补 birdreport 的薄样本
很多停留点 birdreport 6 月样本很薄（<15 份报告）。想用 eBird 同地区同期数据补充对照。
请查清：
1. **API key 与条款**：ebird.org/api/keygen 怎么申请；eBird API Terms of Use 对**缓存/再分发**
   数据到一个公开静态站点的限制（能不能把抓到的频率落地成仓库里的 JSON 并部署）。
2. **能拿到「频率(frequency)」吗**：eBird API（API 2.0, `api.ebird.org/v2/...`）是否直接提供
   bar-chart 式的周/月频率？据我所知 API 主要给 recent/historic observations、hotspot 列表、
   region 物种清单，**bar chart frequency 不在公开 API 里**（在网站 `barchartData` 端点，非官方）。
   请核实现状，并说明若要算频率，是否得自己按 `data/obs/{regionCode}/historic/{y}/{m}/{d}` 累计。
3. **地理对齐**：trip 各停留点（丽江/香格里拉/德钦/拉萨/日喀则/普兰-冈仁波齐/札达）对应的
   eBird **regionCode 或 hotspot locId**怎么查（`ref/region/list`、`ref/hotspot/geo`）。
   阿里这些偏远点 eBird 有没有数据。
4. **分类口径**：eBird/Clements 分类版本与 birdreport（IOC/CBR）的差异，对跨库比对的影响。

## 期望产出
- 两条路线各给：**可行性结论 + 最小实现步骤 + 工作量估计 + 风险/条款红线**。
- 一个**推荐落地顺序**（哪条先做、纯前端能走多远、哪步必须引入抓取脚本）。
- 路线 A 的**名称匹配覆盖率**实测建议（拿我现有两份映射跑一遍 Life List）。
- 所有结论附**一手来源链接**（eBird API 文档、Terms、Download Data 帮助页）。

## 约束（务必带入）
- BirdTrace 是静态站点，**优先纯前端、localStorage、无后端**。
- 物种主键是**中文名**；任何 eBird 数据都要能映射回中文名才有用。
- 行程在即（2026-06-09 出发），**路线 A（Life List → 已见过）优先级更高**、且最可能纯前端落地。
