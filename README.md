# BirdTrace

为[中国观鸟记录中心](https://birdreport.cn) 的数据构建更好的探索界面，对标 eBird Explorer。

当前 **v0.2 · public demo + Explore 轮**：基于真实数据切片（云南 + 西藏行程期）的对外可演示 demo。界面按「地点 / 时间 / 鸟种」三维组织，留空哪一维＝本页答案：① **看什么**（名录 + 地区/鸟点 Explore 收敛，地+时→鸟，核心）② **何时去**（12 月柱状图，地+鸟→时）。**去哪看**（地图，时+鸟→地）是 dev-only 占位，待报告经纬度体系完善后开放，对外 demo 版隐藏。对外/dev 双版切换见 `frontend/src/lib/mode.js`（`IS_PUBLIC`）。详见 `docs/mvp-trip.md` 与现行规格 `birdtrace_workspace/product_spec.md`（v0.2）。

设计文档：`docs/birdreport-prd.md`。  
eBird Explore 对标研究：`docs/ebird-explore-research.md`（功能全景盘点 + 借鉴清单）。  
第三方代码 / 数据来源的鸣谢与 License：`THIRD_PARTY_NOTICES.md`。

## 架构

```
data/scraper/         直连 birdreport.cn 抓数据
  birdreport_client.py     签名 + RSA-encrypt + AES-decrypt 的 async 客户端
                           （505 反爬封会话，撞墙时 reset() 换新会话重试）
  fetch_provinces.py       明文 36 省概览
  fetch_taxon_list.py      明文 一次性鸟种名录
  fetch_taxa.py            （备用）按 ID 扫鸟种详情
  fetch_checklists.py      加密 抓 checklist + observation（按省）
  fetch_trip.py            行程定向抓取：按行程区+历史同期月抓 checklist+observation
  fetch_report_detail.py   加密 抓单份报告详情（坐标/pointId/address，供地图页「去哪看」）
  public_key.pem           前端 RSA 公钥

data/process/         JSON → SQLite → 静态 JSON
  build_db.py              建表
  load_taxa.py / load_checklists.py   导入
  export_json.py           聚合输出到 frontend/public/data/（--province / --trip）
  build_marks_seed.py      从 eBird CSV 生成"已见过"种子（前端加载即自动标记）
  scrape_status.py         输出前端可轮询的抓取进度文件

data/raw/refs/        vendored 参考映射（入库，非抓取产物，见 THIRD_PARTY_NOTICES）
  ebird_sci_to_code.json   eBird 学名→speciesCode（拼 eBird 物种页链接）
  ch4_to_eb_taxon_map.json birdreport→eBird 学名差异修正
  dongniao_name_to_nd.json 中文名→懂鸟分类编号（拼懂鸟物种页链接）

frontend/             React + Vite + Tailwind + Leaflet
  src/App.jsx              三页外壳（看什么 list / 何时去 chart / 去哪看 map，?p= 深链）
                           + 共享数据加载；对外/dev 双版切换见 lib/mode.js（IS_PUBLIC）
  src/pages/               PageList「看什么」名录 + 地区/鸟点 Explore（内嵌 PageRegion）
                           PageChart「何时去」12 月柱图 / PageMap「去哪看」地图占位（dev-only）
                           PageRegion 地区·鸟点 Explore / PageSpecies 鸟种 Explore
  src/components/          LocationPicker 地点两维选择 · SpeciesChecklist 名录行
                           · SpeciesLocations 鸟种反查地点 · TargetList 目标鸟 · ReportList 报告弹窗
                           · ScrapeStatus 抓取进度 · Info（ⓘ 长解释）
  src/lib/                 mode(IS_PUBLIC) · locations(城市白名单/两维地点) · spots(鸟点规范化合并) · exploreData
  src/hooks/               useMarks（本地观测标记）
  public/data/             静态数据（由 export_json.py 写入，gitignore）
```

## 端到端跑一遍

需要 Python 3.9+ 和 Node 18+。

```bash
# 安装依赖
python3 -m pip install -r requirements.txt
cd frontend && npm install && cd ..

# 1. 明文接口：拉省份统计 + 鸟种名录（10 秒内完成）
python3 data/scraper/fetch_provinces.py
python3 data/scraper/fetch_taxon_list.py

# 2. 加密接口：抓云南前 5 页 checklist（默认 50/页 + 1.5s/页节流 ≈ 1 分钟）
python3 data/scraper/fetch_checklists.py checklists --province 云南 --max-pages 5

# 3. 抓刚才那批 checklist 对应的物种观测列表
python3 data/scraper/fetch_checklists.py observations

# 4. 建 DB + 导入 + 导出
python3 data/process/build_db.py
python3 data/process/load_taxa.py
python3 data/process/load_checklists.py
# 导出整个省的所有物种月度计数（推荐 —— 一次导出，前端可查任何物种）
python3 data/process/export_json.py --province 云南
# 或：旧的 per-(省, 物种) 模式
# python3 data/process/export_json.py --bar-chart 云南 黑颈鹤

# 5. 起前端
cd frontend && npm run dev
# 浏览器开 http://localhost:5173，省份选云南、物种填黑颈鹤，点查看
```

### 行程 MVP（名录页数据）

```bash
# 按行程区 + 历史同期月定向抓（行程见 docs/itinerary-june.md）；
# 带 captcha 自动恢复（505 换会话重试）、3h 上限。抓完 load 再导出。
python3 data/scraper/fetch_trip.py
python3 data/process/load_checklists.py
python3 data/process/export_json.py --trip   # 写 frontend/public/data/trip/*
```

### 测试

```bash
python3 -m unittest discover -s tests   # 离线单元测试，无需联网/pytest
```
`tests/probe_*.py` 是**联网探针**（手动跑、验证线上接口），不是测试 —— 见 `tests/README.md`。

## 范围扩缩

- 不同省份：`--province 北京` / `--province 西藏`。省名**不带"省"/"市"后缀**。
- 不同日期范围：`--start 2024-01-01 --end 2024-12-31`。默认空 = 全部历史。
- 更大批量：`--max-pages 200` + 同步增大 `--sleep`。云南全量 ≈ 47 分钟（69852 份历史 checklist）。
- 导出其他 (省, 物种) 组合：再调一次 `export_json.py --bar-chart <省> <鸟名>`。
- 抓新一批数据后：`load_checklists.py`、`export_json.py` 都是幂等的，直接重跑即可。

## 注意

- `/front/*` 接口**不要**带 `X-Auth-Token`。
- 所有接口（包括明文的）都会被 birdreport 的前置 WAF 校验 `Origin`/`Referer`/`User-Agent`，要伪装成浏览器（仓库里的脚本默认就是这样）。
- 现役的 API schema 见 PRD「关键接口」一节，跟 qBird / commonBird / SpiderChaser 那几份历史代码里的 schema **都不一样**。任何时候服务器报"系统出错"，先回去看 https://www.birdreport.cn/home/search/report.html 的源码反推 `where` 字段。
