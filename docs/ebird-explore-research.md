# eBird Explore 功能全景研究

> 目的：把 eBird「探索（Explore）」体系的功能、设计、产品思路系统盘清，作为 BirdTrace 的对标基线与借鉴清单。
> 最后更新：2026-07-05
>
> **本文只做「eBird 是什么样」的客观盘点 + 少量「对我们的启示」旁注。**产品决策（做小程序、走后端预烘焙、成本约束）见文末 §12 与 `birdreport-prd.md` / `mvp-trip.md`。

---

## 0. 方法论与可信度

- **抓取限制**：ebird.org 及其帮助中心对无头抓取一律 403，Wayback 也封。本文内容来自 eBird 官方帮助中心 / 新闻页的**公开搜索摘要** + 第三方教程（mocosocoBirds、Augusta Bird Club、Vermont Atlas of Life、Nemesis Bird 等）+ 官方 API 封装库（ProjectBabbler/ebird-api、rebird）的文档。
- **可信度分级**：
  - 🟢 **多源确认**：官方帮助文档 + 第三方教程一致。
  - 🟡 **单源可见**：仅一处摘要提到，措辞已核对但未交叉验证。
  - 🔵 **合理推断**：从 URL 参数 / 通用产品惯例推出，未见明确文档。
- 所有一手来源链接见文末 §13。

---

## 1. Explore 全景地图（一句话索引）

eBird 的探索体系不是一个页面，是**三大入口 + 一批共享的原子工具**。全部工具一览：

| 类别 | 工具 | 一句话 |
|---|---|---|
| **三大入口** | 探索地区 / 探索热点 / 探索物种 | 地理 / 地点 / 物种三种切入 |
| **可视化** | 频率柱图 · 折线图 · 直方图 · 图文名录 · 打印名录 · 物种分布图 · 现状与趋势 | 同一份频率数据的多种画法 |
| **决策辅助** | 目标鸟 · GuideMe · 提醒（罕见鸟/缺鸟）· Iconic Birds | 「我该去哪 / 看什么 / 何时」 |
| **社交协作** | 行程报告 · 百人榜 · Hotspot About 页/分组 · 媒体库搜索 | 社区证据与知识沉淀 |
| **个人态** | 生涯/年/月/日清单 · Patch/Yard · 外来种分类 | 我看过什么 |
| **数据基座** | 完整清单口径 · 数据审核 · 公开 API 2.0 | 频率语义 + 数据可信度 + 程序化取数 |

**贯穿一切的一条主线**：所有页面、所有过滤都落在**稳定可分享 URL** 上（§11），几乎所有可视化都建立在**同一个「完整清单频率」口径**上（§8.1）。

---

## 2. 三大入口

### 2.1 探索地区（Explore Regions）
- **层级**：世界 → 国家 → 州/省 → 县/等价区 → 热点；每级独立 URL（`/region/{code}`，如 `CN-53` 云南）。🟢
- **顶部快捷 icon**：物种名录 / 最近访问 / 百人榜 / 顶级热点。🟢
- **概览 tab（默认）**包含：
  - 最近物种报告（滚动流：物种·距今·报告人·位点）
  - 动态媒体流（该区最近上传的照片/音频/视频）
  - **本月/本年 eBirding 面板** + **社区目标鸟**（见 §5.4）
  - 该区最近 **10 份公开行程报告**
  - 「了解更多」侧栏：柱图/图文名录/打印名录/生涯清单/目标鸟/我的活动 快捷链
  - 区域伙伴定制内容
- **最近访问 tab**：位点·报告人·物种数·时间；排序=分类序/计数/日期；可切「首次记录 / 单次最高计数」。🟢

### 2.2 探索热点（Explore Hotspots）
- **热点浏览器地图**（`/hotspots`）：
  - 缩放语义：缩小=网格聚合（格内热点物种数），放大=单个热点标记。🟢
  - 标记：🔴 火焰=共享热点，🔴+ =缩放后有更多，🔵=你的个人位点。🟢
  - 右侧栏：当前视野热点列表；排序=物种数/最近访问/距离；「按最近活动过滤」=1 周/1 月/全部。🟢
- **单热点档案页**：与地区页共用大部分 tab，额外有：
  - 小型定位地图、**单次最高计数**视图、「加入我的位点」、热点所有权/编辑、附近热点列表
  - **Iconic Birds**（§5.5）、**About 页 & 分组**（§6.3）

### 2.3 探索物种（Explore Species）
- 每种一张统一档案页 `/species/<code>`：
  - 顶部：中/英/拉名 + 一句简介（Birds of the World 缩编）
  - **分布范围图**（现状与趋势生成）：紫=留鸟/红=繁殖/蓝=非繁殖/黄=过境；浅灰=缺席/深灰=数据不足
  - **每周频率柱图**：52 周（比地区版的 48 格更细）
  - **顶级媒体流**（Macaulay 最高评级）
  - **统计区**（大数字可点进 media / sightings）：全球观测/清单/观鸟人数 + 你个人「已见」次数
  - **区域过滤器**：切地区后地图+柱图+媒体流**同步收窄**
  - 相似种、亚种列表、该物种的热点榜、最近观测、最佳观察地推荐

---

## 3. 可视化工具族（同源不同画法）

**核心洞察**：柱图、折线图、直方图、图文名录、打印名录**共用同一份数据**——「某区某周报告了该种的完整清单占比」，只是呈现不同。🟢

### 3.1 频率柱图（Bar Chart）
详见 §9 深拆。要点：4×12=48 格；绿条高度=检出频率；空灰格=无报告；红竖线=当前日期；底部可下载直方图 CSV。

### 3.2 折线图（Line Graph）& 直方图（Histogram）
- 通过柱图页的**图表 icon** 切换。🟡
- 用途：**跨物种、跨日期比较报告率**（柱图擅长单种年内节律，折线擅长多种叠加对比）。🟡
- 数据口径与柱图一致，可下载同一份 histogram 数据。

### 3.3 图文名录（Illustrated Checklist）
- 每种一行：48 格频率条 + Macaulay 该区最高评级的一图一音 + 中英拉名。🟢
- 稀有种蓝底、常见白底；点媒体进媒体搜索（限该区）。

### 3.4 打印名录（Printable Checklist）
- A4 单栏、勾选框、按留/夏候/冬候/迁徙/稀有分组；**不含柱图**，纯清单。🟢
- （柱图本身要打印靠浏览器打印+「打印背景图片」，否则绿条印不出。🟢）

### 3.5 物种分布图（Species Maps）
- 缩小=矩形网格（颜色=报告数），放大=单个观察点大头针。🟢
- 点大头针=该次观察的清单/日期/报告人/照片。
- 顶部日期过滤：年份区间 / 「某月全部年份」/ 季节预设；可叠加现状与趋势丰度层。

### 3.6 现状与趋势（Status & Trends）
覆盖 2000+ 种，每种统一档案，属 Cornell 科学产品线（**不是纯用户数据可视化，是建模产物**）：🟢
- **每周丰度图**：52 帧动画，色阶黄→紫，可播放。
- **季节丰度图**：繁殖/非繁殖/迁徙前后 四季静态。
- **分布范围图**：季节色 + 边界多边形。
- **趋势变化图**：27 km×27 km 网格，颜色=近 7-11 年丰度增减（红=降/蓝=升，深浅=强度，白圈=不显著）。
- **栖息地关联**、**迁徙时序**、**地区统计表**（平均丰度/占种群比/占范围比/出现天数）。
- **自定义画图工具**：地图画多边形→算圈内占种群比。
- **下载**：丰度栅格(GeoTIFF)/分布趋势矢量/地区统计 CSV/带不确定性趋势；另有 R 包 `ebirdst`。

---

## 4. 频率与努力的语义（诚实性基座）

### 4.1 完整清单（Complete Checklist）
- 定义：**观鸟为主要目的**，且**尽力报全所有能识别的种**（视觉+听觉）。🟢
- 门槛：一般 ≥5 分钟（BBS 每站 3 分钟例外）。
- 记录努力字段：位点、日期、开始时间、**时长、距离、面积**、物种清单、个体计数。
- 意义：**只有完整清单进入频率计算和现状与趋势**——因为完整清单能提供「未记录=大概率不在」的缺席证据。不完整清单不能当分母。🟢

### 4.2 柱图频率口径
- `频率 0.4 = 该区该周 40% 的完整清单报告了该种`。🟢
- 分母 = 当周完整清单总数（页面底部有 total 行；CSV 里有 `sample_sizes`）。
- **eBird 的诚实性缺口**：样本极薄的周页面**不灰化**，用户需自己去看分母——BirdTrace 在这点上更进一步（N<15 主动灰化）。

---

## 5. 决策辅助工具

### 5.1 目标鸟（Target Species）
- 输入：地区 + 月份区间 + 对比清单类型（生涯/年/国/州/县/**图片目标/音频目标**）。🟢
- 输出：你**还没记过**的种，按当区当期检出频率降序；每行=物种·频率%·最佳图·分布图链·最近报告清单链。
- **图片/音频目标**：种已见但没上传对应媒体，用于补媒体收集。

### 5.2 GuideMe（选地点向导）
- `/GuideMe`：选一个地点 → 自动生成该地物种出现柱图。🟡
- 本质是「柱图 + 地点选择器」的引导式包装，帮新手不用手拼 URL。

### 5.3 提醒（Alerts）
- **罕见鸟提醒**：邮件（每小时/每日），一次上限 500 条；「已确认」标记=本地审核员已过（见 §8.2）。🟢
- **缺鸟提醒**：你还没在该区报过的种的最新报告；与罕见鸟组合=既看罕见又看你个人缺的。

### 5.4 社区目标鸟（Community Targets）
- 在地区概览页：**本月还没人报、但历年同期常见**的种，按历年同周频率排序。🟢
- 上榜规则：多年出现 + 近两年至少一次；一旦被报即移出、补新的。
- **这是 eBird 把「集体缺口」游戏化的巧思**——不针对个人清单，针对整个区域这个月还差什么。

### 5.5 Iconic Birds（热点招牌种）⭐
> **本轮研究最值得抄的一个概念。**

- 定义：某热点**相对其父区域（县/州级）最有代表性**的种，基于频率。🟢
- 算法：
  - 用**近 10 年完整清单**算该种在此热点的频率；
  - 对比该种在**整个父区域**的平均频率；
  - 只显示**热点频率 > 1× 区域平均**的种，倍数越高越独特。
  - 门槛：近 10 年有数据的年份里**至少 30% 报告过**（如 10 年全有数据则需 ≥3 年）。
- 例：House Bunting 在某热点的出现频率是该省平均的 **744 倍** → 强招牌种。
- **为什么关键**：它把「这个点有什么」升级成「**这个点相对周边强在哪**」——回答观鸟人真正的问题「值不值得专程」。纯频率榜答不了这个，需要「本地频率 ÷ 区域基线」这个相对量。BirdTrace 完全可以用现有 `(点位, 种)` 频率 ÷ `(区域, 种)` 频率算出来。

---

## 6. 社交 / 协作 / 知识沉淀

### 6.1 行程报告（Trip Reports）
- 创建：`/mytripreports` → 起止日期 + 名字；可选地区过滤、「个人日期」限定自己哪些清单计入。🟢
- 参与者：邀请→接受→「分享全部清单」；**团队合并视图 / 个人视图** 切换。
- 顶部大数字：物种/清单/新增生涯种/参与者/天数/热点数。
- 汇总表：物种 × 每份清单个体数矩阵（X 未计数项不入总）。
- 地图面板 + 媒体瀑布流；**实时更新**（新清单落入窗口自动进）。
- 可见性：所有者/编辑者/查看者/仅链接可见；稳定深链 `/tripreport/{id}`。
- **地区页反向暴露**：该区最近 10 份公开行程报告出现在概览——把私人总结变成公共资源。

### 6.2 百人榜（Top 100）
- `/top100`：切**物种数 vs 完整清单数**、**年度 vs 生涯**；区域下拉可到县；含未来年（即时榜）。🟢

### 6.3 Hotspot About 页 & 分组（2024→2026 新）
- **About 页**：每个热点一块 wiki 式实地知识，三段——**Plan Your Visit**（时间/门票/设施/无障碍）/ **How to Bird Here**（步道/生境/目标种）/ **About This Place**（历史/保育）。🟢
  - 多语言贡献；「Hotspot Features」小标签（有无厕所、是否适合新手、是否需许可）。
- **Hotspot Groups**：把一个大区的多个热点收进一张总览页（复杂目的地的「目录」）。
- **wiki 式**：任何 eBird 账号可提交/修改。

### 6.4 Macaulay 媒体库搜索
- 主筛选：位置/日期/贡献者；**更多筛选**数十项（年龄/性别/行为/声音类型/评分/清单 ID/特殊收藏）。🟢
- 排序：最近上传/最佳质量/评价最少/日期新旧。
- 视图：画廊/网格/列表 三态；类型 icon 切图/声/视频。

---

## 7. 个人态清单体系

- **自动追踪**：生涯 / 年 / 月 / 日 + 地理（国/州/县）+ **Patch（自定义样点）** + **Yard（院落）**。🟢
- My eBird 首页：当年/当月/当日活动摘要，蓝数字点开=该时段全部种清单。
- **观测记录（Sightings）**：按日/月/年 × 地点 × 物种 三维过滤。
- **外来种分类**（影响所有清单/榜单）：Native/Naturalized、Provisional、**Escapee**（逃逸种不计生涯清单和 Top100）。🟢
- 所有个人态数据可**叠加到 Explore 页**（柱图 `personal=true`、地区页生涯清单徽章、图文名录「已见 √」）。

---

## 8. 数据可信度与程序化取数

### 8.1 数据审核网络（Data Quality）
- **两层机制**：① 自动过滤器（时空+用户维度标记异常）②2000+ 志愿审核员人工复核。🟢
- **流程**：被标记记录**不公开显示**，直到审核员依据文字/照片/录音评估；文档齐全几秒过，欠文档等审核员有空发邮件问。
- **结果态**：**Accepted**（进公共库）/ **Unconfirmed**（仅报告人自己可见）。
- 提醒页面/邮件里：「CONFIRMED」=已过审，橙色「Unconfirmed」=待审。
- **对我们的映射**：birdreport.cn 也有「疑问/无疑问」审核层（见 `birdreport-backend-analysis.md`），语义高度对应——可直接借用这套「置信度徽章」表达。

### 8.2 敏感种处理
- 敏感/濒危种的精确位点会被**隐藏或模糊**，防盗猎/干扰。🟡（BirdTrace 若接坐标需同等处理，尤其国内一级保护种。）

### 8.3 公开 API 2.0（程序化取数）
> **对成本/架构判断最关键的一节**——eBird 怎么把数据开放给第三方，是我们该学的模式。

- **鉴权**：绑账号的 API key，放 header `x-ebirdapitoken` 或参数 `key`；1.1 已退役。🟢
- **时间窗**：观测类默认回溯 14 天，最多 30 天。🟢
- **限流**：官方不公布硬数字，文档要求「**使用需克制（with some restraint）**，过量可能封号」。🟢 → **即 eBird 也不做「无限 live 查询」，鼓励缓存/批量下载。**
- **端点目录**（第三方封装库确认）：🟢
  - **观测**：RecentObservationsInRegion、RecentNearbyObservations、RecentNotableObservationsInRegion、RecentNearbyNotable、RecentObservationsOfSpeciesInRegion、NearestObservationsOfSpecies、HistoricObservationsOnDate
  - **清单**：RecentChecklistsFeed、ChecklistFeedOnDate、ViewChecklist
  - **热点**：HotspotsInRegion、NearbyHotspots、HotspotInfo
  - **地区/参考**：AdjacentRegions、RegionInfo、SubRegionList
  - **分类**：EbirdTaxonomy（支持 CSV）、TaxonomicForms、TaxonomicGroups、TaxaLocaleCodes、TaxonomyVersions
  - **产品/统计**：Top100、RegionalStatisticsOnDate、SpeciesListForRegion
- **深度下载**：批量分析走 **EBD（eBird Basic Dataset）**，每月 15 号更新，登录+填申请表后下载——**重活不走 API，走月度数据集**。🟢

---

## 9. 频率柱图深拆（以 `barchart?byr=1900&eyr=2026&bmo=3&emo=5&r=L2401562` 为例）

含义：热点 `L2401562` · 全年份 · 只看 3–5 月（春季迁徙窗口）。

### 9.1 URL 参数（这一层最值得抄）
| 参数 | 含义 |
|---|---|
| `r` | 区域码：热点 `Lxxxxxxx` 或行政区码 `CN-53` |
| `byr`/`eyr` | 起止年（`1900`=不设下限） |
| `bmo`/`emo` | 起止月 1–12 |
| `spp` | 只显示指定物种码，空=全部 |
| `personal` | `true` 叠加「你是否见过 √」 |

派生：加 `/data` 即 CSV 下载端点（「Download Histogram Data」指向它）。

### 9.2 页面结构
- 顶部三大可改按钮：**Change Date / Change Location / Change Species**；辅助链：图文名录 / 打印名录 / 折线图 / 直方图。
- 顶部大数字：当前过滤下物种数 / 完整清单数（分母）/ 总清单数。
- 主体：左列物种（按分类学序，**大分类分组标题** Waterfowl / Grebes / Shorebirds / …），右侧 48 格网格。
  - 稀有种名前红点；亚种/hybrid/spuh/slash **缩进灰显**；`personal=true` 时名前 √。
  - 单元格：绿条=频率，空灰=无报告，hover=`X% (Y/Z)`，红竖线=当前日期。
  - 底部分类组 subtotal + 全局 total（分月×4 周采样量=分母行）。
- 你这条 URL 的效果：48 格里只有 3–5 月对应的 12 格有数据，其余灰空——视觉聚焦春季过境窗口；稀有种大概率就是过境种。

### 9.3 值得直接抄给 BirdTrace 的
1. **URL 参数结构** `?r=&byr=&eyr=&bmo=&emo=&spp=&personal=` — 我们现在 `?p=list|chart|map` 太贫，扩成可深链分享。
2. **48 格（或 36 旬）布局** — 12 格月分辨不出迁徙种过境周次。
3. **按科分组标题** — `taxa` 表已有 `family_name`/`order_name`，现成。
4. **底部分母行摆明面** — eBird 把分母藏在 CSV 里，我们可以直接显示，做成诚实性亮点。
5. **单色柱 + hover `X%(Y/Z)`** — 我们 PageChart 已做对，保持。
6. **`personal=true` 叠加** — 对应我们「★ 我的鸟种」，把柱图从查询升级为决策工具。

---

## 10. 产品思路提炼（first-principles）

1. **档案页心智**：每个地区/物种/热点都是一个**稳定 URL 的档案**（有 tab 但主体一屏可读），查询是入口、档案是终点。
2. **一份数据多种画法**：48 格频率是原子，柱图/折线/图文/打印/物种页只是同一数据的不同呈现——**减少数据管线，最大化复用**。
3. **相对量 > 绝对量**：Iconic Birds、社区目标鸟都在算「相对基线的偏离」，比纯排行更能回答「值不值得」。
4. **诚实性是产品的一部分**：完整清单口径、CONFIRMED/Unconfirmed、敏感种模糊、样本量透明——数据平台的信任靠这些明面机制建立。
5. **物种优先 vs 地点/时间优先**：eBird 全站默认 species-first（最后都要选一只鸟）。**BirdTrace 的差异化是反过来从「去哪、何时」出发**——别被 eBird 的 UI 带回 species-first。
6. **社区证据活性**：recent visits / latest media / live trip report / wiki About 页——让静态数据看起来在动、可累积。
7. **取数分层**：live API（克制、14–30 天窗）用于「最近」，月度 EBD 用于「全量分析」——**没有『无限实时查询』这回事**，这直接印证我们必须后端预烘焙。

---

## 11. 附录 A：URL 规范

| 视图 | URL |
|---|---|
| 地区 | `/region/{code}` |
| 热点 | `/hotspot/{Lxxxx}` |
| 物种 | `/species/{code}` |
| 频率柱图 | `/barchart?r=&spp=&bmo=&emo=&byr=&eyr=&personal=true` |
| 目标鸟 | `/targets?region1=&t2=life&m1=&m2=` |
| GuideMe | `/GuideMe?cmd=changeLocation` |
| 罕见鸟提醒 | `/alert/rba/{Lxxxx}` |
| 物种分布图 | `/map/{spp}` |
| 行程报告 | `/tripreport/{id}` |
| 百人榜 | `/top100?locInfo.regionCode=` |
| 媒体 | `ML{目录号}` |

**通则**：视图 = 稳定路径，过滤 = query string。全部可深链、可分享。

---

## 12. 附录 B：可重用组件原子清单

| 组件 | 用在哪 |
|---|---|
| 48 列 / 52 列频率柱 | 柱图/图文/物种/热点 |
| 稀有种红点 · 生涯「已见 √」 | 全站 |
| Macaulay 缩略图卡（图+音+视频 icon） | 物种/图文/媒体搜索 |
| 分布范围图（4 色季节） | 物种/物种分布图 |
| 观察点地图（缩放切网格↔点） | 物种分布图/热点小图 |
| 最近活动滚动流 | 地区/热点/移动端 |
| Top-N 排行榜 | 百人榜/顶级热点/Iconic |
| **相对基线偏离**（本地÷区域） | Iconic Birds/社区目标鸟 |
| 社区目标鸟面板 | 地区概览 |
| 行程报告汇总表 | 行程报告 |
| wiki About 页（三段式） | 热点 |
| 次级地区下钻面包屑 | 全站 |
| 分母行 / CSV 下载 | 柱图底部 |
| 置信度徽章（CONFIRMED/Unconfirmed） | 提醒/审核 |
| 三视图切换（画廊/网格/列表） | 媒体搜索 |

---

## 13. 对 BirdTrace 的启示（择要，详见 PRD）

**可低成本借鉴（数据侧已有支撑）**：
- **Iconic Birds 式「招牌种」**：`(点位,种)频率 ÷ (区域,种)频率`，现成数据可算，回答「值不值得专程」。
- **社区目标鸟**：某地某月「历史常见但今年还没人报」的种——把区域集体缺口做成话题。
- **按科分组名录 + 48/36 格柱图**：`taxa` 表字段现成。
- **分母摆明面 + 置信度徽章**：对齐 birdreport「疑问/无疑问」审核层，把诚实性做成品牌。
- **URL 深链规范**：视图=路径、过滤=query，可分享（小程序里=小程序码卡片）。

**明确不抄（成本/场景不匹配）**：
- 现状与趋势级建模（数据量差 2 个数量级）、邮件 Alerts、账号态生涯清单全套、Macaulay 媒体库、实时散点地图。

**取数模式的硬约束**（本文 §8.3 印证）：
- eBird 自己都不做无限 live 查询（14–30 天窗 + 克制 + 月度 EBD 兜底）。BirdTrace 面对 birdreport captcha/加密/WAF，更**必须**走「离线抓取 → 后端预烘焙 → 静态/KV → 前端读」。任何「用户点一下打 birdreport」的架构会撞限流墙。详见 `birdreport-backend-analysis.md`。

---

## 14. 来源

- [Explore Regions and Hotspots — eBird Help](https://support.ebird.org/en/support/solutions/articles/48001255129-explore-regions-in-ebird)
- [Explore eBird Hotspots — eBird Help](https://support.ebird.org/en/support/solutions/articles/48001280356-explore-ebird-hotspots)
- [Announcing Explore Species](https://ebird.org/news/announcing-explore-species)
- [Introducing Iconic Birds for eBird Hotspots](https://ebird.org/news/introducing-iconic-birds)
- [Community-sourced Hotspot Descriptions and Hotspot Groups](https://ebird.org/news/new-hotspot-about-pages-and-groups)
- [Updates to Region Pages: eBirding This Month, Community Targets, Trip Reports](https://ebird.org/news/updates-to-region-pages-ebirding-this-month-community-targets-and-trip-reports)
- [eBird Bar Charts, Line Graphs, and Histograms — eBird Help](https://support.ebird.org/en/support/solutions/articles/48001255130-ebird-bar-charts-and-graphs)
- [Complete Checklists and Birding as Your Primary Purpose — eBird Help](https://support.ebird.org/en/support/solutions/articles/48000967748-birding-as-your-primary-purpose-and-complete-checklists)
- [eBird Data Quality (Review Process) — eBird Help](https://support.ebird.org/en/support/solutions/articles/48000795278-the-ebird-review-process)
- [Introducing eBird Targets](https://ebird.org/news/targets/)
- [eBird Alerts and Targets — eBird Help](https://support.ebird.org/en/support/solutions/articles/48000960317-ebird-alerts-and-targets-faqs)
- [Introducing eBird Trip Reports](https://ebird.org/news/introducing-ebird-trip-reports)
- [eBird Trip Reports — eBird Help](https://support.ebird.org/en/support/solutions/articles/48001201565-ebird-trip-reports)
- [Introducing the eBird Hotspot Explorer](https://ebird.org/news/hotspot-explorer/)
- [Patch and Yard Lists in eBird — eBird Help](https://support.ebird.org/en/support/solutions/articles/48001049078-patch-and-yard-lists-in-ebird)
- [Exotic and Introduced Species in eBird — eBird Help](https://support.ebird.org/en/support/solutions/articles/48001218430-exotic-and-introduced-species-in-ebird)
- [eBird Status and Trends](https://science.ebird.org/en/status-and-trends)
- [Trends Maps](https://science.ebird.org/en/status-and-trends/trends-maps)
- [eBird API 2.0（Postman 文档）](https://documenter.getpostman.com/view/664302/S1ENwy59)
- [ProjectBabbler/ebird-api（API 封装库，端点目录）](https://github.com/ProjectBabbler/ebird-api)
- [rebird（R API 封装）](https://cran.r-project.org/web/packages/rebird/readme/README.html)
- [eBird Hotspot Primer — mocosocoBirds](https://mocosocobirds.com/checklists/ebird-hotspot-primer/)
- [Bar Charts — Augusta Bird Club](https://augustabirdclub.org/bar-charts/)
- [Bird Bar Chart — Vermont Atlas of Life](https://val.vtecostudies.org/explore/bird-bar-chart/)
