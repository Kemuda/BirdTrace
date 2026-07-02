# v0.8 数据覆盖审计

> 与 `docs/itinerary-june.md` 声明的 14 天行程停留点、`data/scraper/fetch_trip.py`
> 配置、以及 `TODO.md` 记录的现状交叉比对，逐段列**已覆盖 / 有缺口 / 未抓**。
>
> ⚠️ **数据库和 `frontend/public/data/` 都不入库**（前者 `.gitignore`，后者靠
> `.vercelignore` 单独上传到 Vercel），本审计只能凭代码 + docs 推断；**实际份
> 数与坐标覆盖以生产 DB / Vercel 部署为准**。据 Amber 反馈，Vercel 版里丽江
> 已有坐标，说明 TODO 里"仅日喀则"是过时口径。

## 云南段（6/9–14）

| 行程地点 | 归属区县 | 抓取配置 | DB 现状（据 TODO） | 判定 |
|---|---|---|---|---|
| 丽江古城 / 玉龙雪山 / 云杉坪 / 束河 / 蓝月谷 | 玉龙县 / 古城区 | ✅ TRIP_DISTRICTS | 6 月 42 份 checklist，物种明细基本抓全 | ⚠️ 样本薄（thin） |
| 虎跳峡 | 玉龙县 / 香格里拉方向 | ⚠️ 配了区县，但 birdreport 侧 6 月为 0 | 已用 `pointname` 服务端过滤确认全年 58 份、6 月真为 0 | ⚠️ **邻月兜底待办**（TODO 已列）|
| 独克宗 / 香格里拉 | 香格里拉市 | ✅ TRIP_DISTRICTS | 独克宗 83.3% 物种明细已抓 | ✅ |
| 松赞林寺 / 普达措 / 雾浓顶 / 梅里 | 德钦县 | ✅ TRIP_DISTRICTS | 6 月仅 3 份（thin） | ⚠️ 样本薄 |
| 白马雪山 | 德钦 / 维西 | ✅ 维西在 TRIP_DISTRICTS | 0→34 种，物种明细已补齐 | ✅ |
| 维西 | 维西傈僳族自治县 | ✅ TRIP_DISTRICTS | — | ✅ 目录已覆盖（备用） |

## 西藏段（6/14–22）

西藏抓取用**整省 sweep**（`phase1_tibet_checklists`），不按市/县限制，靠 checklist 自
带 `city / district` 字段分流。

| 行程地点 | 归属市/县 | 现状（据 TODO） | 判定 |
|---|---|---|---|
| 拉萨 | 拉萨市 | 6 月 17 份 ok，物种明细基本抓全 | ✅ |
| 江孜 / 日喀则 | 日喀则市 | 7 份 thin，98 份物种明细，坐标 74 点 100% | ⚠️ 样本薄 |
| 萨噶 / 仲巴 | 日喀则市（同 city） | 归到日喀则里，未独立统计 | ⚠️ 未按点位单独审计 |
| **玛旁雍错 / 拉昂错** | 阿里 / 普兰县 | 1 份 checklist（TODO 明确记 "普兰 1"）| ⚠️ **重点热点样本极薄** |
| 塔钦 / 转山 D1-D2 | 阿里 / 普兰县 | 同上，样本仅 1 | ⚠️ |
| 扎达土林 / 古格 / 托林寺 | 阿里 / 札达县 | 4-5 月 4-6 份、**6 月 0 份** | ⚠️ 需要**邻月兜底**（同虎跳峡） |
| 提尔塔普利（温泉） | 途中 point | 抓取配置无该点名，取决于源站是否有独立 point_name | ❓ 未审计 |

## 未做 / 已知缺口

1. **邻月兜底**：虎跳峡（6 月为 0）、札达（6 月为 0）需并入 5–7 月才有样本。
   `TODO.md` 已列，v0.8 未实现。前端会显示"暂无该段报告"。
2. **云南坐标 — 丽江 ✅ 已抓**（Amber 确认 Vercel 版已在）；**迪庆（香格里拉 /
   德钦）待用户在生产 DB 或 Vercel 上核对**。之前审计写"云南三市都没抓"是我看
   TODO 时把"日喀则收尾"读成了"仅日喀则"，误判。
   `region_bundle` 的 `with_coords` 是运行时统计（`spots.lat != null`），最终
   是否显示地图完全看导出时 DB 里有没有该 city 的 `point_id` + `lat/lng`。
3. **日喀则坐标是否已 reload + 重导出**：TODO 未打钩，但 Amber 反馈丽江在
   Vercel 已可见 → 说明 `export_json.py` 至少跑过一轮把坐标带出去了。日喀则
   的最新一批是否已并进 Vercel 版本，仍需实际核对；核对方法：
   ```
   # 生产端看 with_coords / 首份清单：
   curl https://<vercel>.app/data/regions/manifest.json
   curl https://<vercel>.app/data/regions/rizhaze-city.json | jq '.overview.with_coords'
   ```
   若为 0 或明显偏少，需要重跑：
   ```
   python data/process/load_checklists.py   # upsert 不覆盖已存坐标
   python data/process/export_json.py --trip
   ```
4. **玛旁雍错 / 转山段样本极薄**：源站真的稀（1 份 checklist），非工程 bug。
   前端已用 `data_status=thin` 灰化警示，用户读得到。
5. **提尔塔普利**未做点位映射：itinerary 提到但不在 `fetch_trip.py` 里独立追
   踪；源站若有独立 point_name 就会被"整省 sweep + 按点位聚合"顺带收到，否则
   看不见。低优。
6. **物种明细覆盖 865/865 已完成**（TODO 记录），无缺口。
7. **鸟种外链**（eBird / 懂鸟 / 鸣声）：eBird 覆盖 99%、懂鸟 96%、鸣声 100%
   （拉丁名直拼）。剩余 ~4% 中文名找不到懂鸟编号的鸟种，页面不显示懂鸟链接
   （降级正常，无空链）。

## 结论

- **拉萨 / 香格里拉 / 玉龙** 三段是 MVP 的"能看的段"，物种数据基本足够，可以作
  对外展示的主推样本。
- **德钦 / 日喀则 / 普兰 / 札达** 四段做**诚实薄样本**展示（`data_status=thin`
  / `none`），点开会看到黄条提示、频率仅供参考。
- **地图待核对**：丽江 ✅ 已确认；日喀则 / 香格里拉 / 德钦 建议逐个 curl 生产
  端的 `regions/<id>.json` 看 `overview.with_coords`。任何一个 = 0 就补跑
  `load_checklists.py` + `export_json.py --trip`。对外版 IS_PUBLIC=1 时该
  "坐标抓取中" callout 已隐藏，用户看不到解释，所以最好上线前地图都能画出来。
