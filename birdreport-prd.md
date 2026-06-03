# PRD：中国观鸟记录中心前端重建

**项目代号：** birdreport-explorer  
**作者：** AK  
**状态：** Passion project / 个人实验  
**最后更新：** 2026-06-03（v2: 数据层完成逆向）

---

## 背景

中国观鸟记录中心（birdreport.cn）是目前中国最完整的民间鸟类公民科学数据库，由昆明朱雀会运营，数据覆盖94%的全国鸟种。但它是一个**存档平台**，不是探索工具——数据有，可视化能力严重不足。

eBird（Cornell Lab）是对标对象。它的核心价值不只是数据采集，而是一整套探索工具，让观鸟者在出行前就能做决策。其中最关键的功能叫 **Bar Chart**：选一个地区 + 一个物种，看12个月的出现频率柱状图。这一个功能，观鸟记录中心完全没有。

本项目目标：**为观鸟记录中心的数据做一个更好的前端**，重点实现 Bar Chart 和物种分布时间轴，让中国观鸟者在出行前能回答"这个地方这个季节能看到什么鸟"。

---

## 项目范围

**做：**
- 数据采集 pipeline（Python）
- 本地数据库（SQLite）
- Bar Chart 可视化（核心功能）
- 物种分布地图 + 时间轴
- 静态前端部署

**不做（当前阶段）：**
- 用户登录 / 个人清单
- 实时数据同步
- 移动端 App
- 与懂鸟或其他平台深度整合

---

## 数据层

### API 信息

**Base URL：** `https://api.birdreport.cn/front/`

**认证机制（已完全逆向）：**  
所有 `/front/*` 加密接口需注入三个 Header：
- `timestamp`：Unix 毫秒时间戳（`str(int(time.time())) + "000"`）
- `requestId`：随机 UUID hex（32 字符无连字符）
- `sign`：`md5(plaintext + requestId + timestamp)`

**X-Auth-Token 不要传**——`/front/*` 接口不需要也不接受用户态 token；带上反而可能被业务层挡。token 只在 `/member/*` 接口路径上用，那条路径走的是登录用户自己的数据。

**前置 WAF：** 无签名的明文接口（`/front/province/summary/chart`、`/front/taxon/get`、`/front/taxon/search`）也会校验 `Origin`/`Referer`/`User-Agent` 看是否像浏览器；不像就返回 403 "Bad request, the server has rejected it!"。

**响应格式两种：**
- **明文 JSON**：cleartext 接口直接返回 `{code, count, data: [...] | {...}, msg}`
- **加密 JSON**：`{"code":0, "count":N, "data":"BASE64_AES_CIPHERTEXT"}`——`data` 是 AES-256-CBC base64，密钥/IV 嵌在前端 JS 里（见下）

### 密码学细节

**请求体加密：** RSA-1024 PKCS1_v1_5，对**明文按 117 字节切块**逐块加密、密文拼接后 base64。公钥见 `data/scraper/public_key.pem`。

**明文格式：** **sorted-key JSON，原生 UTF-8（不要 `\uXXXX` 转义），无空格。** 等价 Python：
```python
json.dumps(params, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
```
前端 JS 实际链路是 `JSON.stringify(sort_ASCII(dataTojson(querystring)))`——把 urlencoded 字符串 split 成对象、按 key ASCII 排序、再 stringify。我们直接给 dict 起 sorted JSON 等价。

**响应解密：** AES-256-CBC + PKCS7 padding。密钥和 IV 是 ASCII hex 字符串，**当 UTF-8 字节用**：
- 现役：key `3583ec0257e2f4c8195eec7410ff1619`，iv `d93c0d5ec6352f20`（来自 SpiderChaser 抓的 `jQuertAjax.js`，2026-06 实测仍有效）
- 备用：key `C8EB5514AF5ADDB94B2207B08C66601C`，iv `55DD79C6F04E1A67`（commonBird 那一版，可能是不同生代留下的）
- 客户端 `birdreport_client.py` 两套都试，谁能 PKCS7 unpad 成功就用谁

### 关键接口（schema 全部以 2026-06 现役为准）

#### 明文接口（无需签名，但仍要带浏览器 Header）

```
POST /front/province/summary/chart
Body: {"version": "CH4"}
返回: [{name, value(鸟种数), report(报告数), record(记录条数), ...}] × 36 省
```

```
POST /front/taxon/get
Body: {"id": 4001}
返回: {code, data: {id, name, latinname, englishname, ...}}
```

```
POST /front/taxon/search
Body: (空 body)
返回: {code, count, data: [{id, name, szm, pinyin, ...}, ...]}
说明: 一次性返回完整鸟种名录（~4000+ 条），用于 autocomplete
```

#### 加密接口（需签名 + 解密）

```
POST /front/record/activity/search
Body 字段（**只有 6 个，多余字段会让业务层 NPE**）:
  province    省名（如 "云南"，**不带 省/市 后缀**）
  startTime   "" 或 "YYYY-MM-DD"
  endTime     "" 或 "YYYY-MM-DD"
  version     "CH4"   ← 关键字段，漏传 = 业务层"系统出错"
  page        页码（从 1 开始）
  limit       每页数量（前端 UI 提供 20 / 50；100 未验证）
返回: 解密后为 Checklist 列表（list of dict）
```

```
POST /front/activity/taxon
Body: {"reportId": "UUID", "version": "CH4", "page": 1, "limit": 1500}
返回: 解密后为该报告的物种观测列表
（注：schema 推断自 qBird + 新版 version 字段，尚需第一次运行验证）
```

### 历史踩坑（避免后人重复）

旧资料（qBird 2023、commonBird 2025、SpiderChaser ~2023）里 `/front/record/activity/search` 的请求体都是 16 个字段（`page, limit, taxonid, startTime, endTime, province, city, district, pointname, username, serial_id, ctime, taxonname, state, mode, outside_type`）。**这个 schema 在 2026-06 已过期**：
- 服务端会拒绝（业务层"系统出错"，不会告诉你为什么）
- 关键变化是新增 `version` 字段、删除大部分过滤字段
- commonBird 里的 `/front/*` codepath 因 async/sync 误用是 dead code，CKRainbow 自己也没跑过，不能当 ground truth
- qBird 的实际加密逻辑在外部 JS 文件（`jQuertAjax.js`），仓库本身没有

正确 schema 是从 https://www.birdreport.cn/home/search/report.html?search=... 的页面源码 + URL base64 参数反推出来的（layui table 的 `where`）。任何时候 schema 又变，回去看这个页面的 HTML 是最快的路径。

### 数据结构

**Checklist（报告）关键字段：**
```
serial_id, reportId, start_time, end_time,
username, userid, point_name,
province_name, city_name, district_name,
taxoncount, state
```

**Observation（物种记录）关键字段：**
```
taxon_id, taxon_name, latinname, englishname,
taxonordername, taxonfamilyname,
taxon_count, record_image_num
```

### 采集策略

**阶段一（MVP）：明文接口** ✅ 已实现
- `province/summary/chart` 给 36 省概览
- `taxon/search` 给完整鸟种名录（autocomplete 用）

**阶段二（完整数据）：直连加密接口** ✅ 已实现（替代了 PRD v1 的 Playwright 方案）
- `birdreport_client.BirdReportClient`：纯 Python httpx + pycryptodome，无浏览器依赖
- `data/scraper/fetch_checklists.py checklists --province 云南` 跑通后端到端
- 每页一个 JSON 文件存到 `data/raw/checklists/<province>/<page>.json`
- 默认 1.5 秒/页节流，可配

**阶段三（可选）：性能优化**
- 当前实现是 sequential async，单进程；如果要全量抓 36 省 × N 万 checklist 可以加并发
- 但要小心 birdreport 那边的 rate limit / WAF

**采集频率控制：** 默认 1.5 秒/页（checklist 翻页）、1.0 秒/份报告（observation）。修改 `--sleep` 调整。

---

## 数据库结构

SQLite，三张表：

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

**Bar Chart 核心查询：**
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

---

## 功能优先级

### P1：Bar Chart（核心，MVP 目标）

**用户故事：** 我要去香格里拉，想知道6月和7月分别能看到哪些鸟，以及哪些候鸟这时候在、哪些已经走了。

**交互流程：**
1. 选省份（下拉）→ 可进一步选市/县
2. 选物种（搜索框，支持中文名/拼音首字母）
3. 展示12个月频率柱状图（x轴=月份，y轴=出现频率%）
4. 可叠加多个物种对比

**数据来源：** 本地 SQLite，聚合查询后输出静态 JSON

### P2：物种分布地图 + 时间轴

**用户故事：** 我想看某种鸟在全国的分布，以及随季节如何迁徙移动。

**交互流程：**
1. 搜索物种
2. 地图显示所有观测点位（高德地图）
3. 月份滑块（1-12月），拖动时点位动态更新
4. 可选：热力图模式 vs 散点模式

### P3：区域 × 季节推荐

**用户故事：** 我下个月去广东，哪10种鸟最值得看？

**逻辑：** 按`出现频率 × 稀有程度`加权排序，输出当月该区域的推荐物种列表

### P4（后期）：Hotspot 系统

从报告经纬度聚类（DBSCAN）提取实际观鸟地点，给每个热点做独立页面，显示历史最佳时间 + 代表物种。

---

## 技术栈

```
数据采集:   Python 3.x
            requests（明文接口）
            playwright（加密接口 + 登录态）
            pycryptodome（AES 解密，方案C备用）

数据存储:   SQLite（本地）
            pandas（聚合处理）

前端:       React + recharts（Bar Chart）
            高德地图 JS API（分布地图）
            Tailwind CSS（样式）

部署:       静态 JSON 文件 → Vercel 或 GitHub Pages
            无需后端服务器
```

---

## 目录结构

```
birdreport-explorer/
├── data/
│   ├── scraper/
│   │   ├── fetch_provinces.py      # 明文接口，阶段一
│   │   ├── fetch_checklists.py     # Playwright，阶段二
│   │   └── decrypt.py              # AES 解密工具
│   ├── process/
│   │   ├── build_db.py             # 建库 + 导入
│   │   └── export_json.py          # 聚合 → 静态 JSON
│   └── db/
│       └── birdreport.sqlite
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── BarChart.jsx        # 核心组件
│   │   │   ├── SpeciesMap.jsx
│   │   │   └── RegionPicker.jsx
│   │   └── App.jsx
│   └── public/
│       └── data/                   # 静态 JSON 输出目录
├── README.md
└── CLAUDE.md                       # Claude Code 配置
```

---

## 第一步：验证数据通路

在写任何架构之前，先跑这10行代码确认接口可用：

```python
import requests, json

resp = requests.post(
    "https://api.birdreport.cn/front/province/summary/chart",
    json={"version": "CH4"},
    headers={"Content-Type": "application/json"}
)
data = resp.json()
print(json.dumps(data[:3], ensure_ascii=False, indent=2))
```

如果返回36条省级数据，阶段一的 Bar Chart 原型当天可以出来。

---

## 已知问题 / 待解决

| 问题 | 状态 | 解决方向 |
|------|------|---------|
| `sign` header 逆向 | ✅ 完成 | `md5(plaintext + requestId + timestamp)` |
| `/front/record/activity/search` schema | ✅ 完成 | 6 字段含 `version: "CH4"` |
| AES key/iv | ✅ 完成 | 见 `birdreport_client.AES_KEYS` |
| `/front/activity/taxon` schema | ⚠️ 推断 | 第一次跑 observations 命令时验证 |
| 经纬度字段 | ⚠️ 部分 | checklist 列表里只有 point_name；lat/lng 可能要从单报告详情接口拿 |
| 数据量估算 | 部分 | 云南实测 69852 份历史 checklist；按 50/页 = 1397 页，2s/页 ≈ 47 分钟全量 |
| Hotspot 系统 | ✅ 走 eBird 数据 | 复用 `database/ebird_cn_hotspots.json`（6217 个中国热点带经纬度） |

---

## 参考资料

- eBird Bar Chart 参考：https://ebird.org/barchart
- 高德地图 JS API：https://lbs.amap.com/api/javascript-api/summary
- recharts 文档：https://recharts.org
- pycryptodome：https://pycryptodome.readthedocs.io

## 致谢 / 上游

数据层的逆向工作是在以下几个开源项目的基础上完成的，详情见 `THIRD_PARTY_NOTICES.md`：

- **qBird** (https://github.com/TaQini/qBird, MIT, 2023, TaQini)
  原 sign 算法、请求流程、参数 shape。
- **commonBird** (https://github.com/CKRainbow/commonBird, MIT, 2025, CKRainbow)
  纯 Python RSA chunked 加密实现、备用 AES key/iv、eBird CN Hotspot 数据库（6217 点）、跨平台分类映射表。
- **SpiderChaser** (https://github.com/Achernar0208/SpiderChaser, GPL-3.0)
  含 birdreport.cn 前端 JS 原文（`jQuertAjax.js`）——是恢复**当前** wire format 和现役 AES key/iv 的关键资料。
- **birdreportcn-to-ebird** (https://github.com/sun-jiao/birdreportcn-to-ebird)
  commonBird 的二级灵感来源。
