# PRD v2.2：中国观鸟记录中心前端重建（birdtrace）

**产品名：** birdtrace　**项目代号：** birdreport-explorer
**作者：** AK ＆ 设计协作
**状态：** Passion project / 个人实验
**最后更新：** 2026-06-03

**变更记录**
- **v2.2（本次）：** 数据层全部以"已实测、已跑通"为准——sign 算法、AES key/iv、新版请求 schema、captcha 反爬现象。明确**阶段二 Playwright 方案在我们这边已被直连 Python 客户端替代**；阶段二的新瓶颈不是签名/解密，而是 captcha 反爬阈值。修订采集策略与"已知问题"。其他章节沿用 v2.1。
- **v2.1：** 全文统一运行案例为「香格里拉 · 黑颈鹤」；把原先散在三处的 Bar Chart 论述整合进「Explore 页设计原则」一处；澄清**数据依赖**（明文接口只够省级概览，三种组合 Explore 必须依赖加密接口逐报告采集）；全文统一编号；样本量阈值落为具体值（N<15 灰化）；修正笔误。
- **v2：** 在 v1 基础上提出「数据立方体 · 三种问法」模型，重构产品模型与功能优先级，新增数据诚实性与 Explore 设计原则。
- **v1：** 初版，以 eBird Bar Chart 为单一核心功能。

---

## 背景

中国观鸟记录中心（birdreport.cn）是目前中国最完整的民间鸟类公民科学数据库，由昆明朱雀会运营，数据覆盖 94% 的全国鸟种。但它是一个**存档平台**，不是探索工具——数据有，可视化能力严重不足。

eBird（Cornell Lab）是对标对象，但它有一个**自身没说破的局限**：它的探索是**物种优先**的（先选一只鸟，再看它的 Bar Chart）。而真实的出行决策往往不是从一只鸟开始的，而是从"我要去哪、哪天去"开始的。

本项目目标：**为观鸟记录中心的数据做一个更好的前端**，核心不是复刻 eBird，而是回答观鸟者出行前真正在问的那句话——

> **"我这个时间、去这个地方，能看到什么鸟？"** ——以及它的另外两种问法。

---

## 一、核心洞察：一个数据立方体，三种问法

所有功能其实都在操作同一个三维数据立方体——**地点（A）× 时间（B）× 鸟种（C）**：

```
            鸟种 C (What)
              │
              │
              └──────── 地点 A (Where)
             ╱
        时间 B (When)
```

观鸟者出行决策，本质是**手里攥着两个变量、想求第三个**。锁定其中两个、留空一个当"答案"，正好三种组合——这三种组合不是三个独立功能，而是**同一套查询的三个切面**：

| 已知 | 求解（留空） | 结果形态 | 使用人群 / 心态 |
|---|---|---|---|
| 地点 ＋ 时间（A+B） | → **鸟种 C** | 出鸟**名录** | 休闲野观（逛） |
| 地点 ＋ 鸟种（A+C） | → **时间 B** | **Bar Chart**（频率条） | 刷目标鸟（狙击） |
| 时间 ＋ 鸟种（B+C） | → **地点 A** | 分布**地图**（点位排序） | 追迁徙 / 稀有（远征） |

**页面命名（对用户）：** 三页分别叫 **看什么 / 何时去 / 去哪看**，对应三种问法；收敛叶子页叫 **鸟点档案**。不用「Bar Chart / 组合 N」这类内部黑话。

### 组合 1：已知【地点 ＋ 时间】，求鸟种
- **筛选逻辑：** 选定区县 / 点位 ＋ 锁定往年同月同旬区间，清空鸟种栏，全量导出该区域同期历史鸟名录。
- **场景：** 已定好去哪、哪天出门，不知道能碰到什么鸟。
- **体验：** 优点——无脑出行，依据历史记录生成当日预期鸟单，现场随缘加新；缺点——无靶向，稀有鸟随缘碰。
- **频率：** 日常休闲野观**最常用**，应作为默认入口。

### 组合 2：已知【地点 ＋ 鸟种】，求时间
- **筛选逻辑：** 固定地点、固定鸟名，放开日期，查询历年该鸟在此地的出没月份 / 旬度，筛选高发窗口期。
- **场景：** 固定一片山头 / 湿地，专门想找某一种鸟，不确定几月去最合适。
- **体验：** 优点——精准锁定最佳月份，大幅提高目标鸟遇见率；缺点——受季节约束大，错过高发期大概率扑空。
- **频率：** 针对性刷目标鸟、特种鸟常用。**这就是 eBird Bar Chart 对应的问法。**

### 组合 3：已知【时间 ＋ 鸟种】，求地点
- **筛选逻辑：** 固定出行月份、固定目标鸟，清空地点，查询全市 / 全省范围内往年同期该鸟出现过的全部点位，按出现频率排序高频点位。
- **场景：** 确定某段假期出门、指定要找某类鸟，目的地未定，择优选址。
- **体验：** 优点——围绕鸟选场地，目的性最强；缺点——需跨多地筛选，部分野点偏远，出行成本高。
- **频率：** 鸟友专程追迁徙鸟、稀有鸟的主流思路。

### 收敛点：三要素全确定（A+B+C）
三个全部敲定 ＝ 单点、单期、单鸟的极致精准查询。它**不是第四种模式**，而是上述任意一条路径走到底的**叶子节点**——名录里点一只鸟、Bar Chart 里点一个月、地图上点一个点位，都收敛到同一个「**点位详情**」页（历史记录、报告人、出片数、最佳日期）。三种模式是通往同一个房间的三扇门。

---

## 二、产品模型：统一查询 ＋ 变形结果区

由于三种组合的输入是**同一套三个槽** `[地点] [时间] [鸟种]`，区别只在"留空哪一格"，因此界面不做三个割裂的工具，而是：

```
┌─────────────────────────────────────────────┐
│  [📍 地点 ▾]   [📅 时间 ▾]   [🐦 鸟种 ▾]        │  ← 统一查询条
│   填两个，空出的一格即"我要找的答案"             │
└─────────────────────────────────────────────┘
            │
            ▼  结果区按"留空项"自动变形
   ┌──────────────┬──────────────┬──────────────┐
   │ 空鸟种 → 名录 │ 空时间 → 图表 │ 空地点 → 地图 │
   └──────────────┴──────────────┴──────────────┘
```

**心智模型：** "我填我知道的，空出我想问的。" 一致、好维护，用户只需学一次。

**两个输入槽都是分级的，用户可停在任意一级：**
- **地点：** 省 / 市 / 区县 / **点位（hotspot）**。决定了城市但还没定具体鸟点，就停在市级看区域概览；也有人上来直接钻到点位。结果区随颗粒度自适应——粗粒度看区域趋势，细到点位看该点鸟况。
- **时间：** 年份区间 / 月 / 旬。粗看节律，细看过境窗口。

**待定设计决策（线框阶段拍板）：**
1. **「留空 ＝ 提问」如何表达** —— 真留空，还是给该格做成发光的"求解此项"状态？（当前线框用虚线 ＋ 高亮黄标「＝本页答案」。）
2. **默认落点** —— 建议进站默认落在组合 1（名录），首屏同时亮出另两个入口。

---

## 三、数据诚实性（设计约束）

民间数据不均匀，可视化必须正面处理，否则误导用户：

1. **样本量 N 摆在明面上。** 频率 % ＝"出现在百分之几的报告里"。低样本（**默认阈值 N<15 份**）灰化 / 标注"仅供参考"，避免某偏远县某月仅 3 份报告算出 100% 的误导。
2. **年份范围可调。** 默认聚合近若干年同期；用户可收窄到"仅过去 1 年"看近况，或放宽到 5 年看稳定规律——样本量 N 随之变化并透明显示。
3. **频率 ≠ 数量。** Bar Chart 表达"多容易遇到"，不是"有多少只"。图例与文案需说清。
4. **候鸟「在 / 走」是情感钩子。** "哪些候鸟还在、哪些已经走了"是本工具最打动人的维度——应作为独立状态层（留鸟 / 夏候 / 冬候 / 旅鸟 × 当月在不在）叠加在结果上。

---

## 四、Explore 页设计原则（核心差异化）

**"列表 / 图表 / 地图"只是数据的形状，不等于满足了需求。** Explore 的核心不是"展示数据"，是**帮用户从模糊走到笃定地做一个决定，并带走一个能用的产出**。这是区别于 birdreport.cn（存档）和 eBird（查询）的关键。

### 组合 1 · 名录页（地+时→鸟）
用户要的是**为这趟出行建立预期、攒一份目标单**，不是一个平铺 200 种的表。
- **分层，不是平铺。** 「几乎必见 / 有机会 / 撞大运稀有」三档。背景板鸟和值得专门蹲的鸟，心理准备不同。
- **季节会讲故事。** 一句人话说清"夏候鸟已到齐、X 刚进繁殖、Y 的过境窗口刚关"——把在/走写成人话。**（由 AI 按当期聚合数据生成自然语言摘要，需单列一个 AI 能力项。）**
- **能带走。** 终点是导出一张"当日目标鸟单"，现场对照打勾。
- **相邻可比（后期，优先级低）。** 日期可微调，"晚两周会多/少看到什么"实时变。

### 组合 2 · Bar Chart 页（地+鸟→时）
用户要的是**选一个出行窗口**，不是欣赏柱子。
- **直接给结论。** 高亮"最佳窗口"（如黑颈鹤在香格里拉：11 月中–2 月初），图表要**回答**而不只呈现。
- **时间粒度分场景。** 默认**月级**（12 格，轻、易扫，适合留鸟 / 常见种，只需知道"大概几月有"）；迁徙鸟 / 窄窗口种**一键下钻旬级**（36 格，每月 3 旬）——旅鸟可能只过境十天，按月会被抹平。具体呈现（纯柱状 / eBird 原味色块条 / 月＋迁徙状态带）线框阶段对比后定。
- **多鸟叠加 ＝ 行程优化。** 同时想看 A/B/C 三种，窗口**交集**在哪——一张图帮你定行程日期（eBird 做得很弱）。
- **反向对齐我的假期。** 只能某月去 → 告诉他此时遇见率很低，要么改期、要么改看替代种。

### 组合 3 · 地图页（时+鸟→地）
用户要的是**挑一个能去、值得去的点**（出行成本是最大痛点）。
- **排序的候选地，不是一片麻点。** 报告经纬度先**聚类成点位**（非散点），出高频点位榜 + 每点命中率 / 最近记录 / 最佳旬。
- **权衡近 vs 稳。** "近但概率低"还是"远但稳"——让人能权衡距离 × 命中率。
- **连带收益。** 点进一个热点：除目标鸟，还能顺手看到什么别的好货。

### 横切三页的元层
不管哪一页，都该有这四层——这是把"查询工具"做成"探索工具"的关键：
1. **一个直给的结论 / 建议**（不让用户自己算）
2. **一层可信度**（基于 3 份还是 300 份报告，N 透明）
3. **一层季节流动**（在/走，贯穿三页）
4. **一个可微调的变量 + 可带走的产出**（explore = 能推演、能带走，不是查一次给张静态答案）

---

## 五、项目范围

**做：**
- 数据采集 pipeline（Python，直连加密 API；无浏览器依赖）
- 本地数据库（SQLite）
- 统一三槽查询 ＋ 三种变形结果区（名录 / Bar Chart / 地图）
- 收敛叶子节点：点位详情
- 数据诚实性处理（样本量 / 频率语义 / 迁徙状态）
- 静态前端部署

**不做（当前阶段）：**
- 用户登录 / 个人清单
- 实时数据同步
- 移动端 App（但前端需响应式，照顾出行前手机查询）
- 与懂鸟或其他平台深度整合

---

## 六、功能优先级

> **数据前提：** 三种组合都依赖**逐物种 × 逐报告**的明细数据（checklist + observation）。这必须由**阶段二**——`/front/record/activity/search` ＋ `/front/activity/taxon` 加密接口——逐报告抓取。明文统计接口只够省级概览，不能驱动 Explore。详见「七 · 数据层 / 采集策略」。

### P1 · 组合 1 名录（默认入口，MVP 核心）
**用户故事：** 我要去香格里拉，想知道 6 月、7 月分别能看到哪些鸟，哪些候鸟在、哪些已经走了。
**交互：** 选省 →（可下钻市/县/点位）＋ 选月份（可下钻旬）→ 清空鸟种 → 输出按 `频率 × 稀有度` 排序的鸟名录，每行带迷你频率火花线 ＋ 当月频率% ＋ 稀有度标 ＋ 迁徙状态。
**数据来源：** 本地 SQLite 聚合后输出静态 JSON。

### P2 · 组合 2 Bar Chart（求最佳时间）
**用户故事：** 固定纳帕海，想拍黑颈鹤，几月去最合适？
**交互：** 固定地点 ＋ 鸟种 → 放开时间 → 12 月频率条，迁徙种可下钻旬级；可叠加多物种对比；高发窗口高亮。

### P3 · 组合 3 分布地图（求地点）
**用户故事：** 12 月想拍黑颈鹤，去云南哪个点最稳？
**交互：** 固定月份 ＋ 鸟种 → 清空地点 → 地图显示往年同期所有点位（高德地图，报告经纬度聚类成点位）；侧栏高频点位榜排序；月份滑块拖动时点位动态更新；可选点位聚合 / 热力两种模式。

### P4 · 区域 × 季节推荐
**用户故事：** 我下个月去广东，哪 10 种鸟最值得看？
**逻辑：** 按 `出现频率 × 稀有程度` 加权排序，输出当月该区域推荐物种列表。（本质是组合 1 的"精选"视图。）

### P5（后期）· Hotspot 系统
两条路并行：(a) 复用 commonBird 已整理的 **eBird CN Hotspot 数据库（6217 点带经纬度）** 作为权威热点 ID；(b) 从 birdreport 报告 `point_name` 做模糊匹配 / 经纬度聚类（DBSCAN）补足。每个热点独立页面，显示历史最佳时间 ＋ 代表物种。

---

## 七、数据层（v2.2：已实测）

### API 信息

**Base URL：** `https://api.birdreport.cn/front/`

**认证机制（已完全逆向）：**
所有签名接口需注入三个 Header：
- `timestamp`：Unix 毫秒时间戳（`str(int(time.time())) + "000"`）
- `requestId`：随机 UUID hex（32 字符无连字符）
- `sign`：`md5(plaintext + requestId + timestamp)`

**`X-Auth-Token` 不要传**——`/front/*` 接口不接受用户态 token；带上反而可能被业务层挡。token 只在 `/member/*` 接口路径上用（那条路径走登录用户自己的数据，是 commonBird 项目的工作面）。

**前置 WAF：** 所有 `/front/*` 接口都会校验 `Origin`/`Referer`/`User-Agent` 看是否像浏览器；不像就 403 "Bad request, the server has rejected it!"。**仓库里 `data/scraper/birdreport_client.py` 的默认 headers 已经过实测可用。**

**反爬 captcha 闸门：** 在抓 `/front/activity/taxon`（逐报告物种列表）时，服务端会在某个未公开阈值（实测约 ~40 req/min 量级）后返回 `code=505 / 405`，意味着触发了页面 JS 里 `BIRDREPORT_VISIT.codeHtml()` 的人机验证。**这是 Explore 全量数据采集当前真正的瓶颈，详见「采集策略」。**

**响应格式两种：**
- **明文 JSON**：cleartext 接口直接返回（envelope 含 `{count, data}` 或顶层裸 list）
- **加密 JSON**：`{"code":0, "count":N, "data":"<base64 AES 密文>", "msg":...}`——`data` 是 AES-256-CBC base64

### 密码学细节

**请求体加密：** RSA-1024 PKCS1_v1_5，对**明文按 117 字节切块**逐块加密、密文拼接后 base64。公钥见 `data/scraper/public_key.pem`。

**明文格式：** **sorted-key JSON，原生 UTF-8（不要 `\uXXXX` 转义），无空格。** 等价 Python：
```python
json.dumps(params, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
```
前端 JS 实际链路是 `JSON.stringify(sort_ASCII(dataTojson(querystring)))`，等价于直接 sorted JSON。

**响应解密：** AES-256-CBC + PKCS7 padding。密钥和 IV 是 ASCII hex 字符串，**当 UTF-8 字节用**：
- 现役：key `3583ec0257e2f4c8195eec7410ff1619`，iv `d93c0d5ec6352f20`（2026-06 实测有效）
- 备用：key `C8EB5514AF5ADDB94B2207B08C66601C`，iv `55DD79C6F04E1A67`（commonBird 那版，可能是历史生代）
- 客户端两套都试，谁能 PKCS7 unpad 成功就用谁

### 关键接口（schema 全部以 2026-06 实测为准）

#### 概览类（请求体小、需签名、响应通常 cleartext）

```
POST /front/province/summary/chart
Body: {"version": "CH4"}
返回: [{name, value(鸟种数), report(报告数), record(记录条数), ...}] × 36 省
注: 历史上是纯明文，2026-06 改为需签名。响应是顶层 list。
```

```
POST /front/taxon/search
Body: {"version": "CH4"}
返回: {count, data: [{id, name, szm, pinyin, ...}, ...]}
注: 一次性返回完整鸟种名录（~4000+ 条），用于 autocomplete。
```

```
POST /front/taxon/get
Body: {"id": 4001, "version": "CH4"}
返回: 单物种详情
```

#### Explore 核心：加密接口（需签名 ＋ 解密）

```
POST /front/record/activity/search
Body 字段（**只有 6 个，多余字段会让业务层 NPE 报"系统出错"**）:
  province    省名（如 "云南"，**不带 省/市 后缀**）
  startTime   "" 或 "YYYY-MM-DD"
  endTime     "" 或 "YYYY-MM-DD"
  version     "CH4"     ← 关键字段，漏传 = 业务层 NPE
  page        页码（从 1 开始）
  limit       每页数量（前端 UI 提供 20 / 50）
返回: 解密后为 Checklist 列表（list[dict]）
```

```
POST /front/activity/taxon
Body: {"reportId": "UUID", "version": "CH4", "page": 1, "limit": 1500}
返回: 解密后为该报告的物种观测列表
注: 实测受 captcha 闸门约束（~40 次后 code=505），是当前批采瓶颈。
```

### 数据结构

**Checklist 字段（实测，云南 2026-06 样本）：**
`reportId / serial_id / start_time / end_time / state / province_name / city_name / district_name / point_name / taxoncount / userid / username / outside_count / request_id`
注：**checklist 列表本身不含 lat/lng**，经纬度只在单报告详情接口（待找）或 point 系统里。

**Observation 字段（待验，按 commonBird 历史样本推测）：**
`taxon_id / taxon_name / latinname / englishname / taxonordername / taxonfamilyname / taxon_count / record_image_num`

### 采集策略

**阶段一（已实现）：明文 + 签名概览接口**
- `provinces` + `taxon_list` 给省份和鸟种名录，做下拉 / autocomplete
- 工具：`data/scraper/fetch_provinces.py`、`fetch_taxon_list.py`

**阶段二（已实现）：直连加密接口** —— 替代了 PRD v2.1 的 Playwright 方案
- `data/scraper/birdreport_client.py`：纯 Python httpx + pycryptodome，**无浏览器依赖**
- 抓 `/front/record/activity/search` 翻页拿 checklist 列表
- 抓 `/front/activity/taxon` 逐报告拿物种观测列表
- 工具：`data/scraper/fetch_checklists.py {checklists, observations}`
- 默认节流：checklist 翻页 1.5s/页，observations 2.5s/req

**阶段二瓶颈 ＝ captcha 反爬**
- 实测：observations 接口在 ~40 次 / 分钟左右触发 `code=505`，需要人机验证
- 当前命中后客户端会**主动停下**并提示重跑（已抓的会跳过）
- 三条已识别绕过路径（按代价）：
  - 慢速率（10+ s/req）—— 改代码量小，但全量耗时不可接受
  - 带浏览器登录态 cookie —— 改代码 1-2h，效果未验证
  - Playwright 自动解 captcha —— 改代码 1-2 天，能持续跑
- **MVP 阶段不全量抓**，只覆盖 user scenario 涉及的 (省, 时段)，演示功能先跑通

**阶段三（可选）：性能优化**
- 当前 sequential async 单进程；要做全国全量再考虑并发 + captcha 自动化

---

## 八、数据库结构（SQLite，三表）

```sql
CREATE TABLE checklists (
    report_id    TEXT PRIMARY KEY,
    serial_id    TEXT,
    start_time   TEXT,          -- "2024-06-15 08:30"
    province     TEXT,
    city         TEXT,
    district     TEXT,
    point_name   TEXT,
    lat          REAL,
    lng          REAL,
    taxon_count  INTEGER,
    username     TEXT
);

CREATE TABLE observations (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    report_id    TEXT REFERENCES checklists(report_id),
    taxon_id     INTEGER,
    taxon_name   TEXT,
    latin_name   TEXT,
    taxon_count  INTEGER
);

CREATE TABLE taxa (
    taxon_id     INTEGER PRIMARY KEY,
    name         TEXT,
    latin_name   TEXT,
    english_name TEXT,
    order_name   TEXT,
    family_name  TEXT
);
```

**核心聚合查询（频率，可按月 / 旬切换粒度）：**
```sql
SELECT
    strftime('%m', c.start_time) AS month,
    COUNT(DISTINCT c.report_id)  AS reports_with_species,
    total.cnt                    AS total_reports,
    ROUND(100.0 * COUNT(DISTINCT c.report_id) / total.cnt, 1) AS frequency_pct
FROM checklists c
JOIN observations o ON c.report_id = o.report_id
JOIN (
    SELECT strftime('%m', start_time) AS m, COUNT(*) AS cnt
    FROM checklists WHERE province = ?
    GROUP BY m
) total ON total.m = strftime('%m', c.start_time)
WHERE c.province = ? AND o.taxon_name = ?
GROUP BY month
ORDER BY month;
```
> 旬级粒度：把 `strftime('%m', ...)` 替换为按日期推导旬序号（1–36）的表达式即可，前端默认聚合到月、对迁徙种下钻到旬。
> 诚实性：聚合输出需同时带 `total_reports`，前端据此对 N<15 的格子灰化。

---

## 九、技术栈

```
数据采集:   Python 3.9+ · httpx（异步）· pycryptodome（RSA + AES）· requests（备用）
数据存储:   SQLite（本地）· pandas（聚合）
前端:       React + Vite · recharts / d3（Bar Chart 与火花线）· 高德地图 JS API · Tailwind CSS
部署:       静态 JSON → Vercel 或 GitHub Pages（无后端）
```

---

## 十、第一步：验证数据通路

`data/scraper/birdreport_client.py` 已实现完整链路。最小验证：

```bash
# 加密链路 smoke test（云南第 1 页 20 条 checklist）
python3 tests/test_birdreport_yunnan.py
# 预期: Got 20 checklists. 样本字段 province_name=云南省 等
```

云南实测：全省历史 **69852 份** checklist。前 5 页 50/页 = 250 条用作 MVP 演示。

---

## 十一、已知问题 / 待解决

| 问题 | 状态 | 解决方向 |
|------|------|---------|
| `sign` header 逆向 | ✅ 完成 | `md5(plaintext + requestId + timestamp)` |
| AES key/iv | ✅ 完成 | 双 key 候选已 hard-code 在 client |
| `/front/record/activity/search` schema | ✅ 完成 | 6 字段含 `version: "CH4"` |
| `/front/activity/taxon` schema | ✅ 完成 | `{reportId, version, page, limit}` |
| **observation 接口 captcha 闸门** | ⚠️ **未解** | **当前瓶颈**；MVP 用部分数据，全量留待 cookie / Playwright 方案 |
| 经纬度字段 | ⚠️ 部分 | checklist 列表无 lat/lng；要找单报告详情接口或 point 接口 |
| 物种分布地图接口 | 待找 | 可能复用 commonBird 的 eBird CN Hotspot 数据 + 模糊匹配 |
| 稀有度数据来源 | 待定 | 暂以全国记录数倒数自算，后续接红色名录 |
| 数据量估算 | ✅ 部分 | 云南 69852 条；全国未实测 |

---

## 十二、参考资料 / 致谢

- eBird Bar Chart：https://ebird.org/barchart
- 高德地图 JS API：https://lbs.amap.com/api/javascript-api/summary
- recharts：https://recharts.org
- pycryptodome：https://pycryptodome.readthedocs.io

数据层的逆向工作建立在以下几个开源项目之上，详情见 `THIRD_PARTY_NOTICES.md`：
- **qBird** (TaQini, MIT) — 原 sign 算法、请求流程、参数 shape
- **commonBird** (CKRainbow, MIT) — 纯 Python RSA chunked 加密、备用 AES key/iv、eBird CN Hotspot 6217 点数据库、跨平台分类映射表
- **SpiderChaser** (Achernar0208, GPL-3.0) — 含 birdreport.cn 前端 JS 原文，恢复**当前** wire format 和现役 AES key/iv 的关键
- **birdreportcn-to-ebird** (sun-jiao) — commonBird 的二级灵感来源
