# PRD（v0.1 设计稿 · 已归档）：中国观鸟记录中心前端重建（birdtrace）

> **已归档（2026-07-07）**：本 PRD 是 `birdtrace_workspace/product_spec.md` 之前的原始设计稿。现行规格以 product_spec（v0.2 工作稿）+ design_spec 为准；下方 v2.x 变更记录为历史留档，不再更新。

**产品名：** birdtrace　**项目代号：** birdreport-explorer
**作者：** AK ＆ 设计协作
**状态：** Passion project / 个人实验
**最后更新：** 2026-06-04

**变更记录**
- **v2.4（本次）：** 修订用户画像措辞——"三种心态"改为"三种起始状态"，"休闲野观（逛）"改为"探索收敛（从面到点）"并补充收敛过程说明；时间表达改为"不一定精确"；设计含义从"系统给倾向判断"改为"提供数据让用户自行判断"；点位详情页明确标注为规划中功能（P5）。
- **v2.3：** 按「用户视角 / 功能转化视角 / 工程视角」三个维度重组全文结构；将用户画像从功能描述中剥离单列；数据层拆分为「数据定义」与「数据应用」两节；其余数据内容与 v2.2 一致。
- **v2.2：** 数据层全部以"已实测、已跑通"为准——sign 算法、AES key/iv、新版请求 schema、captcha 反爬现象。明确阶段二 Playwright 方案已被直连 Python 客户端替代；阶段二新瓶颈为 captcha 反爬阈值。
- **v2.1：** 全文统一运行案例为「香格里拉 · 黑颈鹤」；整合 Bar Chart 论述；澄清数据依赖；样本量阈值落为具体值（N<15 灰化）。
- **v2：** 提出「数据立方体 · 三种问法」模型，重构产品模型与功能优先级，新增数据诚实性与 Explore 设计原则。
- **v1：** 初版，以 eBird Bar Chart 为单一核心功能。

---

## 背景

中国观鸟记录中心（birdreport.cn）是目前中国最完整的民间鸟类公民科学数据库，由昆明朱雀会运营，数据覆盖 94% 的全国鸟种。但它是一个**存档平台**，不是探索工具——数据有，可视化能力严重不足。

eBird（Cornell Lab）是对标对象，但它有一个自身没说破的局限：它的探索是**物种优先**的（先选一只鸟，再看它的 Bar Chart）。而真实的出行决策往往不是从一只鸟开始的，而是从"我要去哪、哪天去"开始的。

本项目目标：**为观鸟记录中心的数据做一个更好的前端**，核心不是复刻 eBird，而是回答观鸟者出行前真正在问的那句话——

> **"我这个时间、去这个地方，能看到什么鸟？"** ——以及它的另外两种问法。

---

## 一、用户视角

### 1.1 用户画像——三种起始状态

观鸟者出行决策的起点，本质上只有三种——手里已经确定了两个变量，第三个还是空的：

| 起始状态 | 已知 | 想求 | 典型说法 |
|---|---|---|---|
| **探索收敛**（从面到点） | 地点 ＋ 时间 | 能看到什么鸟 | "我下周去香格里拉，有什么可以看？" |
| **狙击目标鸟** | 地点 ＋ 目标鸟种 | 几月去最合适 | "我要拍黑颈鹤，纳帕海几月去概率最高？" |
| **按鸟选目的地** | 出行时段 ＋ 目标鸟种 | 去哪个点最稳 | "12 月想拍黑颈鹤，云南哪个点最值得去？" |

这三种起始状态**不是三类人群**，同一个鸟友在不同行程里会切换；页面命名也沿用这个语气——**看什么 / 何时去 / 去哪看**，而不是「Bar Chart / 组合 N」之类的内部术语。

其中"探索收敛"是使用频率最高的起始状态：用户一开始没有具体目标鸟种，使用产品本身就是一个从区域名录逐步缩小到具体鸟点 ＋ 目标鸟种的过程——最终可能转入另外两种路径做精确核实。

### 1.2 用户表达时（As I'm Saying）

用户在语言层面的特征：

- 说**地名而不是经纬度**："香格里拉""纳帕海"，而不是坐标或行政代码。
- 说**鸟的俗名**："黑颈鹤""红腹锦鸡"，偶尔夹杂英文或拉丁名。
- 时间表达**不一定精确**："下个月""11 月底""冬天"——不需要锁定到某一天。
- 隐含的问题往往是**"值不值得去"**，而不仅是"有没有"。

**设计含义：** 地点搜索需支持点位俗名模糊匹配；时间槽需以月 / 旬为粒度而非日历选择器；结果需展示频率、稀有度、样本量、最近记录等，让用户能自行判断"值得专程"还是"顺路碰运气"，而不是由系统直接下结论。

### 1.3 用户使用时（As I'm Using）

根据三种心态，用户在页面上的操作路径不同：

**探索收敛路径（组合 1 · 看什么）**
1. 落地首页，默认进入此模式
2. 选省 → 下钻到市 / 区县 / 点位（可停在任意级）
3. 选月份（可精细到旬）
4. 鸟种栏留空 → 按"几乎必见 / 有机会 / 撞大运"分层展示名录
5. 对某一种鸟感兴趣 → 可转入"何时去 / 去哪看"进一步精确核实
6. 收敛后跳转点位详情页（规划中，见 P5）
7. 导出"当日目标鸟单"打印 / 截屏

**狙击目标鸟路径（组合 2 · 何时去）**
1. 进入后选地点 ＋ 填入目标鸟种，时间槽留空
2. 展示全年 12 个月频率条，高亮最佳窗口
3. 若是迁徙种，一键下钻旬级（36 格）精确看过境窗口
4. 叠加多种鸟 → 自动显示窗口交集，辅助定行程日期

**按鸟选目的地路径（组合 3 · 去哪看）**
1. 选定出行月份 ＋ 目标鸟种，地点槽留空
2. 地图展示历年同期所有点位（经纬度聚类后）
3. 侧栏显示高频点位榜，带命中率 / 最近记录 / 最佳旬
4. 权衡"近但概率低" vs "远但稳"，选定后跳转点位详情

**三路径共同收敛目标：点位详情页（规划中，对应 P5 Hotspot 系统）**
设计目标是三条路径最终都能落到同一个页面：历史记录列表、报告人、出片数、最佳出行日期。目前代码中尚未实现，待 Hotspot 系统建立后补全。

### 1.4 用户给反馈时（As I'm Giving Feedback）

产品在以下几个节点最容易触发用户反馈：

| 触发场景 | 预期反馈类型 | 如何处置 |
|---|---|---|
| 某地某月 N<15 份报告，数据灰化 | "为什么这里没数据？" | 灰化说明文案要解释原因，而不只是视觉提示 |
| 频率 % 与实地感受不符 | "这只鸟我每次都能看到，为什么只有 30%？" | 图例说清楚"频率 = 报告出现率，不是数量" |
| 迁徙状态标注有误 | "黑颈鹤在这里是冬候鸟，你标成留鸟了" | 预留数据修正入口 / issue 反馈链接 |
| 点位名称与本地叫法不符 | "这个地方我们叫XXX，不叫YYY" | hotspot 系统支持别名 |

### 1.5 反馈收集（持续更新）

> 本节预留给后续真实用户测试和使用过程中的反馈记录，统一汇总在此。

*（尚无条目，等待首批用户反馈后补充。）*

---

## 二、功能转化视角

### 2.1 核心模型：一个数据立方体，三种问法

所有功能都在操作同一个三维数据立方体——**地点（A）× 时间（B）× 鸟种（C）**：

```
            鸟种 C (What)
              │
              │
              └──────── 地点 A (Where)
             ╱
        时间 B (When)
```

锁定其中两个、留空一个当"答案"，正好三种组合——这三种组合不是三个独立功能，而是**同一套查询的三个切面**：

| 已知 | 求解（留空） | 结果形态 | 页面名称 |
|---|---|---|---|
| 地点 ＋ 时间（A+B） | → 鸟种 C | 出鸟**名录** | **看什么** |
| 地点 ＋ 鸟种（A+C） | → 时间 B | **Bar Chart**（频率条） | **何时去** |
| 时间 ＋ 鸟种（B+C） | → 地点 A | 分布**地图** | **去哪看** |

三路全部收敛到同一个**鸟点档案**叶子页（单点 × 单期 × 单鸟的极致精准查询）。

### 2.2 产品模型：统一查询 ＋ 变形结果区

由于三种组合的输入是同一套三个槽，区别只在"留空哪一格"，界面不做三个割裂的工具：

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
- **地点：** 省 / 市 / 区县 / 点位（hotspot）——粗粒度看区域趋势，细到点位看该点鸟况。
- **时间：** 年份区间 / 月 / 旬——粗看节律，细看过境窗口。

**待定设计决策（线框阶段拍板）：**
1. **「留空 ＝ 提问」如何表达** —— 真留空，还是给该格做成发光的"求解此项"状态？（当前线框用虚线 ＋ 高亮黄标「＝本页答案」。）
2. **默认落点** —— 建议进站默认落在组合 1（名录），首屏同时亮出另两个入口。

### 2.3 需求 → 功能模块转化

#### 需求一：知道去哪和什么时候，不知道能看到什么
**转化为：P1 · 组合 1 名录页（默认入口，MVP 核心）**

用户的真实需求不是"平铺 200 种鸟的表"，而是**为这趟出行建立预期、攒一份目标单**。

功能模块：
- **分层名录**：「几乎必见 / 有机会 / 撞大运稀有」三档，背景板鸟和值得专门蹲的鸟分开
- **季节叙事摘要**：一句人话说清"夏候鸟已到齐、X 刚进繁殖、Y 的过境窗口刚关"（AI 按当期聚合数据生成）
- **可带走的产出**：导出"当日目标鸟单"，现场对照打勾
- **相邻可比（后期）**：日期微调后"晚两周会多/少看到什么"实时刷新

数据前提：逐物种 × 逐报告明细数据（加密接口逐报告采集）。

#### 需求二：固定地点和目标鸟种，不知道几月去最合适
**转化为：P2 · 组合 2 Bar Chart 页（求最佳时间）**

用户的真实需求不是"欣赏柱子"，而是**选一个出行窗口**。

功能模块：
- **直给结论**：高亮"最佳窗口"（如黑颈鹤在香格里拉：11 月中–2 月初）
- **时间粒度分场景**：默认月级（12 格），迁徙鸟一键下钻旬级（36 格）
- **多鸟叠加 ＝ 行程优化**：窗口交集一张图，直接帮你定行程日期
- **反向对齐假期**：只能某月去 → 告知遇见率低，推荐改期或替代种

#### 需求三：固定出行时段和目标鸟种，不知道去哪最稳
**转化为：P3 · 组合 3 分布地图页（求地点）**

用户的真实需求不是"一片散点图"，而是**挑一个能去、值得去的点**（出行成本是最大痛点）。

功能模块：
- **排序候选地**：报告经纬度聚类成点位（非散点），出高频点位榜
- **权衡近 vs 稳**：每个点位展示命中率 / 最近记录 / 最佳旬，支持距离 × 命中率权衡
- **连带收益**：点进热点除目标鸟，还能看到哪些顺手好货

#### 横切三页的元层（把"查询工具"做成"探索工具"的关键）
不管哪一页，都必须有这四层：
1. **一个直给的结论 / 建议**（不让用户自己算）
2. **一层可信度**（基于 3 份还是 300 份报告，N 透明）
3. **一层季节流动**（留鸟 / 夏候 / 冬候 / 旅鸟 × 当月在不在，贯穿三页）
4. **一个可微调的变量 ＋ 可带走的产出**（explore = 能推演、能带走）

#### 需求四：数据误导风险
**转化为：数据诚实性约束（横切所有模块）**

民间数据不均匀，可视化必须正面处理：
- **样本量 N 摆在明面上**：频率 % ＝"出现在百分之几的报告里"，N<15 灰化标注"仅供参考"
- **年份范围可调**：默认近若干年同期，用户可收窄到 1 年看近况或放宽到 5 年看规律，N 随之透明变化
- **频率 ≠ 数量**：Bar Chart 表达"多容易遇到"，不是"有多少只"，图例与文案需说清

### 2.4 功能优先级

> **数据前提：** P1–P3 三种组合都依赖逐物种 × 逐报告明细数据（checklist + observation），必须由加密接口逐报告采集。明文统计接口只够省级概览，不能驱动 Explore。

| 优先级 | 功能 | 用户故事 |
|---|---|---|
| **P1** | 组合 1 名录（MVP 核心） | 我要去香格里拉，6/7 月分别能看到哪些鸟，哪些候鸟在、哪些走了？ |
| **P2** | 组合 2 Bar Chart | 固定纳帕海，想拍黑颈鹤，几月去最合适？ |
| **P3** | 组合 3 分布地图 | 12 月想拍黑颈鹤，去云南哪个点最稳？ |
| **P4** | 区域 × 季节推荐 | 我下个月去广东，哪 10 种鸟最值得看？（组合 1 的"精选"视图） |
| **P5** | Hotspot 系统（后期） | 每个热点独立页面，显示历史最佳时间 ＋ 代表物种 |

### 2.5 项目范围

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

## 三、工程视角

### 3.1 数据定义

#### 数据实体与来源

系统包含三类核心数据实体，分别来自不同的采集渠道：

**实体一：鸟种名录（Taxa）**
- 来源：`POST /front/taxon/search`（明文接口，一次性全量）
- 规模：~4000+ 种，涵盖中国所有记录鸟种
- 关键字段：`taxon_id, name（中文名）, latin_name, english_name, order_name, family_name`

**实体二：观鸟清单（Checklists）**
- 来源：`POST /front/record/activity/search`（加密接口，分页翻取）
- 含义：每一份观鸟报告的元信息，一次外出 = 一条 checklist
- 关键字段：`report_id, start_time, province, city, district, point_name, taxon_count, username`
- 注意：checklist 列表本身**不含 lat/lng**，经纬度需从单报告详情接口或 point 系统补充

**实体三：观测记录（Observations）**
- 来源：`POST /front/activity/taxon`（加密接口，逐 report_id 请求）
- 含义：某次外出记录的具体鸟种列表，一条 checklist 对应多条 observations
- 关键字段：`report_id（外键）, taxon_id, taxon_name, taxon_count, record_image_num`
- 瓶颈：受 captcha 闸门约束（~40 次/分钟后触发 code=505）

#### 数据库结构（SQLite，三表）

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

#### API 认证机制（已完全逆向）

所有签名接口需注入三个 Header：
- `timestamp`：Unix 毫秒时间戳（`str(int(time.time())) + "000"`）
- `requestId`：随机 UUID hex（32 字符无连字符）
- `sign`：`md5(plaintext + requestId + timestamp)`

**注意：** `X-Auth-Token` 不要传——`/front/*` 接口不接受用户态 token。

**前置 WAF：** 所有 `/front/*` 接口校验 `Origin`/`Referer`/`User-Agent`；仓库里 `data/scraper/birdreport_client.py` 的默认 headers 已经过实测可用。

#### 密码学细节

**请求体加密：** RSA-1024 PKCS1_v1_5，对明文按 117 字节切块逐块加密、密文拼接后 base64。公钥见 `data/scraper/public_key.pem`。

**明文格式：** sorted-key JSON，原生 UTF-8（不要 `\uXXXX` 转义），无空格：
```python
json.dumps(params, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
```

**响应解密：** AES-256-CBC + PKCS7 padding。密钥和 IV 是 ASCII hex 字符串，当 UTF-8 字节用：
- 现役：key `3583ec0257e2f4c8195eec7410ff1619`，iv `d93c0d5ec6352f20`（2026-06 实测有效）
- 备用：key `C8EB5514AF5ADDB94B2207B08C66601C`，iv `55DD79C6F04E1A67`（可能是历史版本）
- 客户端两套都试，谁能 PKCS7 unpad 成功就用谁

### 3.2 数据应用

#### 采集流程

**阶段一（已实现）：概览数据**
- `fetch_provinces.py`：拉取 36 省概览数据，供地点下拉
- `fetch_taxon_list.py`：一次性拉取全量鸟种名录，供 autocomplete

**阶段二（已实现）：明细数据采集**
- 工具：`data/scraper/birdreport_client.py`（纯 Python httpx + pycryptodome，无浏览器依赖）
- 步骤 1：`fetch_checklists.py checklists`——翻页拿 checklist 列表（节流 1.5s/页）
- 步骤 2：`fetch_checklists.py observations`——逐 report_id 拿物种观测列表（节流 2.5s/req）
- 云南全省历史：69852 份 checklist；MVP 用前 250 条演示

**阶段二瓶颈：captcha 反爬**
- 现象：observations 接口在 ~40 次/分钟后返回 `code=505`
- 当前处理：命中后客户端主动停下并提示重跑，已抓的会跳过
- 三条绕过路径（按代价排序）：
  1. 慢速率（10+ s/req）—— 改动量小，但全量耗时不可接受
  2. 带浏览器登录态 cookie —— 改代码约 1-2h，效果待验证
  3. Playwright 自动解 captcha —— 改代码约 1-2 天，可持续跑
- MVP 阶段不做全量，只覆盖 user scenario 涉及的（省, 时段）

**阶段三（可选）：性能优化**
- 当前 sequential async 单进程；全量采集再考虑并发 ＋ captcha 自动化

#### 核心聚合查询

**频率计算（可按月 / 旬切换粒度）：**
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

旬级粒度：把 `strftime('%m', ...)` 替换为按日期推导旬序号（1–36）的表达式；前端默认聚合到月、对迁徙种下钻到旬。聚合输出需同时带 `total_reports`，前端据此对 N<15 的格子灰化。

#### 数据到前端的处理流程

```
SQLite 聚合
    │
    ▼
pandas 后处理（加稀有度、迁徙状态标注）
    │
    ▼
静态 JSON 导出
    │
    ▼
React + Vite 前端读取
    ├─ 名录页：recharts 火花线 + 分层排序
    ├─ Bar Chart 页：recharts 柱状图，支持月 / 旬切换
    └─ 地图页：高德地图 JS API，点位聚类展示
```

#### 技术栈

```
数据采集:   Python 3.9+ · httpx（异步）· pycryptodome（RSA + AES）
数据存储:   SQLite（本地）· pandas（聚合）
前端:       React + Vite · recharts / d3（Bar Chart 与火花线）· 高德地图 JS API · Tailwind CSS
部署:       静态 JSON → Vercel 或 GitHub Pages（无后端）
```

#### 第一步：验证数据通路

```bash
# 加密链路 smoke test（云南第 1 页 20 条 checklist）
python3 tests/probe_yunnan.py
# 预期: Got 20 checklists. 样本字段 province_name=云南省 等
```

#### 已知问题 / 待解决

| 问题 | 状态 | 解决方向 |
|------|------|---------|
| `sign` header 逆向 | ✅ 完成 | `md5(plaintext + requestId + timestamp)` |
| AES key/iv | ✅ 完成 | 双 key 候选已 hard-code 在 client |
| `/front/record/activity/search` schema | ✅ 完成 | 6 字段含 `version: "CH4"` |
| `/front/activity/taxon` schema | ✅ 完成 | `{reportId, version, page, limit}` |
| **observation 接口 captcha 闸门** | ⚠️ **未解** | 当前瓶颈；MVP 用部分数据，全量留待 cookie / Playwright 方案 |
| 经纬度字段 | ⚠️ 部分 | checklist 列表无 lat/lng；要找单报告详情接口或 point 接口 |
| 物种分布地图接口 | 待找 | 可能复用 commonBird 的 eBird CN Hotspot 数据 + 模糊匹配 |
| 稀有度数据来源 | 待定 | 暂以全国记录数倒数自算，后续接红色名录 |
| 数据量估算 | ✅ 部分 | 云南 69852 条；全国未实测 |

---

## 四、参考资料 / 致谢

- eBird Bar Chart：https://ebird.org/barchart
- 高德地图 JS API：https://lbs.amap.com/api/javascript-api/summary
- recharts：https://recharts.org
- pycryptodome：https://pycryptodome.readthedocs.io

数据层的逆向工作建立在以下几个开源项目之上，详情见 `THIRD_PARTY_NOTICES.md`：
- **qBird** (TaQini, MIT) — 原 sign 算法、请求流程、参数 shape
- **commonBird** (CKRainbow, MIT) — 纯 Python RSA chunked 加密、备用 AES key/iv、eBird CN Hotspot 6217 点数据库、跨平台分类映射表
- **SpiderChaser** (Achernar0208, GPL-3.0) — 含 birdreport.cn 前端 JS 原文，恢复当前 wire format 和现役 AES key/iv 的关键
- **birdreportcn-to-ebird** (sun-jiao) — commonBird 的二级灵感来源
