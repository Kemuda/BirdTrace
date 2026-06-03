# BirdTrace

为[中国观鸟记录中心](https://birdreport.cn) 的数据构建更好的探索界面，对标 eBird Explorer。第一阶段重点：12 个月出现频率柱状图（Bar Chart）。

设计文档：`birdreport-prd.md`。  
第三方代码 / 数据来源的鸣谢与 License：`THIRD_PARTY_NOTICES.md`。

## 架构

```
data/scraper/         直连 birdreport.cn 抓数据
  birdreport_client.py     签名 + RSA-encrypt + AES-decrypt 的 async 客户端
  fetch_provinces.py       明文 36 省概览
  fetch_taxon_list.py      明文 一次性鸟种名录
  fetch_taxa.py            （备用）按 ID 扫鸟种详情
  fetch_checklists.py      加密 抓 checklist + observation
  public_key.pem           前端 RSA 公钥

data/process/         JSON → SQLite → 静态 JSON
  build_db.py              建表
  load_taxa.py             导入鸟种
  load_checklists.py       导入 checklist + observation
  export_json.py           聚合输出到 frontend/public/data/

frontend/             React + Vite + Tailwind + recharts
  src/App.jsx              主界面（省份选择 + 物种 autocomplete）
  src/components/BarChart.jsx
  public/data/             静态数据（由 export_json.py 写入）
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
python3 data/process/export_json.py --bar-chart 云南 黑颈鹤

# 5. 起前端
cd frontend && npm run dev
# 浏览器开 http://localhost:5173，省份选云南、物种填黑颈鹤，点查看
```

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
