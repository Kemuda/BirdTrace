# PRD：中国观鸟记录中心前端重建

**项目代号：** birdreport-explorer  
**作者：** AK  
**状态：** Passion project / 个人实验  
**最后更新：** 2026-06-03

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

**认证机制：**  
所有请求需注入三个 Header：
- `timestamp`：Unix 毫秒时间戳
- `requestId`：随机 UUID
- `sign`：动态签名（与页面 JS 中 AES key/iv 相关，尚未完全逆向）

**响应格式两种：**
- 明文 JSON（统计类接口，直接用）
- 加密 JSON：`{"code":0, "count":N, "data":"BASE64_AES_ENCRYPTED"}` — 用页面 JS 全局变量 `BIRDREPORT_APIJS` 中的 key/iv 解密（AES-CBC）

### 关键接口

#### 明文接口（无需签名，直接调）

```
POST /front/province/summary/chart
Body: {"version": "CH4"}
返回: [{name, value(鸟种数), report(报告数), record(记录条数), ...}] × 36省
```

```
POST /front/system/adcode/province    # 省级列表
POST /front/system/adcode/city        # 城市列表，参数: province_code
POST /front/system/adcode/district    # 区县列表，参数: city_code
```

```
POST /front/taxon/get
Body: {"id": 4001}
返回: 物种详情（明文，无需签名）
```

#### 加密接口（需签名 + 解密）

```
POST /front/record/activity/search
关键参数:
  province    省名（如"云南"）
  taxon_id    物种ID（过滤含特定物种的报告）
  startTime   "2024-01-01"
  endTime     "2024-12-31"
  page        页码（从1开始）
  limit       每页数量（最大100）
返回: 加密，解密后为 Checklist 列表
```

```
POST /front/activity/taxon
Body: {"reportId": "UUID"}
返回: 加密，解密后为该报告的物种观测列表
```

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

**阶段一（MVP）：只用明文接口**
- `province/summary/chart` → 36省基础统计，直接调，无障碍
- 足够做省级概览 + 初步 Bar Chart 原型

**阶段二（完整数据）：Playwright 方案**
- 用 Playwright 登录，在浏览器上下文中调 API
- 拦截 XHR 响应，数据抵达时已由页面 JS 解密，直接拿明文
- 签名和解密都交给页面自己处理，无需逆向

**阶段三（可选）：纯 Python 复现**
- 完全逆向签名算法 + 自己做 AES 解密
- 性能更好，适合大规模批量采集
- 当前优先级低

**采集频率控制：** 每次请求间隔 1-2s，按省份分批，避免对服务器造成压力。

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
| `sign` header 未完全逆向 | 待解决 | Playwright 绕过，或继续逆向 JS |
| `taxon/search` 依赖 session | 待验证 | 带登录态的 Playwright 再测 |
| 物种分布地图接口未找到 | 待解决 | Playwright 点击触发后拦截 XHR |
| 经纬度字段在 Checklist 中不确定 | 待确认 | 抓几条详情数据后检查 |
| 数据量估算 | 未知 | 先抓云南一省，看报告总量再决定全量策略 |

---

## 参考资料

- eBird Bar Chart 参考：https://ebird.org/barchart
- 高德地图 JS API：https://lbs.amap.com/api/javascript-api/summary
- recharts 文档：https://recharts.org
- pycryptodome：https://pycryptodome.readthedocs.io
- Playwright Python：https://playwright.dev/python
