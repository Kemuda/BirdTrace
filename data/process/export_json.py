"""Aggregate the SQLite DB into static JSON for the frontend.

Currently exports:
- provinces_summary.json: pass-through of the cleartext provinces summary.
- bar_chart/<province>__<taxon>.json: 12-month frequency for a (province, taxon)
  pair. Returns empty buckets when checklist data hasn't been ingested yet.
"""
from __future__ import annotations

import argparse
import json
import shutil
import sqlite3
from pathlib import Path
from urllib.parse import quote, quote_plus

from build_db import DB_PATH, connect

ROOT = Path(__file__).resolve().parents[2]
RAW_DIR = ROOT / "data" / "raw"
OUT_DIR = ROOT / "frontend" / "public" / "data"
REFS_DIR = RAW_DIR / "refs"


# --- eBird link map (vendored from github.com/CKRainbow/commonBird) ----------
# sciName -> [speciesCode, comName]; plus ch4_to_eb fixes the ~98 names where
# birdreport's 学名 differs from eBird's. Lets us link each species to its
# ebird.org/species/<code> page. Loaded once, lazily.
_EBIRD_SCI: dict | None = None
_CH4_FIX: dict | None = None


def _ebird_refs() -> tuple[dict, dict]:
    global _EBIRD_SCI, _CH4_FIX
    if _EBIRD_SCI is None:
        sci_path = REFS_DIR / "ebird_sci_to_code.json"
        ch4_path = REFS_DIR / "ch4_to_eb_taxon_map.json"
        _EBIRD_SCI = json.loads(sci_path.read_text(encoding="utf-8")) if sci_path.exists() else {}
        _CH4_FIX = json.loads(ch4_path.read_text(encoding="utf-8")) if ch4_path.exists() else {}
    return _EBIRD_SCI, _CH4_FIX


def ebird_code(latin: str | None) -> str | None:
    """birdreport 学名 -> eBird speciesCode (None if no match)."""
    if not latin:
        return None
    sci, fix = _ebird_refs()
    name = fix.get(latin, latin)
    if isinstance(name, list):  # taxonomic split -> take first eBird name
        first = name[0]
        name = (first.get("name", "") if isinstance(first, dict) else first).split("/")[0]
    hit = sci.get(name) or sci.get(latin)
    return hit[0] if hit else None


# --- 懂鸟 link map (vendored: parsed from dongniao.net/taxonomy.html) ---------
# 中文名 -> {nd: 分类编号, en: 英文名}。懂鸟物种页 = /nd/{nd}/{中文名}/{en}/{en}，
# 编号是必须的（光中文名拼不出，已实测）。
_DONGNIAO: dict | None = None


def _dongniao_map() -> dict:
    global _DONGNIAO
    if _DONGNIAO is None:
        p = REFS_DIR / "dongniao_name_to_nd.json"
        _DONGNIAO = json.loads(p.read_text(encoding="utf-8")) if p.exists() else {}
    return _DONGNIAO


def species_links(name: str, latin: str | None, code: str | None) -> dict:
    """Outbound reference links per species: eBird / 懂鸟 / Xeno-canto(鸣声)."""
    links: dict = {}
    if code:
        links["ebird"] = f"https://ebird.org/species/{code}"
    dn = _dongniao_map().get(name)
    if dn:
        en = quote_plus(dn["en"])
        links["dongniao"] = f"https://dongniao.net/nd/{dn['nd']}/{quote(name)}/{en}/{en}"
    if latin:
        links["xenocanto"] = f"https://xeno-canto.org/species/{latin.replace(' ', '-')}"
    return links


# --- 居留型推断（留鸟/夏候鸟/冬候鸟/旅鸟/不确定）-----------------------------
# ⚠️ DORMANT / 待解决问题（2026-06-04，Amber 决定先不展示）：
#   目前没有权威的居留型数据源（commonBird / eBird 都没有该字段）。下面这个
#   `classify_seasonal` 是从**省级 12 个月出现模式**做的**推断**，不是权威数据，
#   样本稀疏时很不可靠（西藏只有 6 月 → 几乎全是「不确定」）。因此暂不接入导出/前端。
#   留作 dormant，等接入权威居留型表（如各省鸟类名录的居留型字段）或 eBird Status &
#   Trends 的季节定义后再启用。详见 TODO.md「待解决：居留型数据源」。
#   —— 改动前请先解决数据源问题，不要直接拿这个推断结果当权威展示。
_BREED = {3, 4, 5, 6}   # idx → 4–7 月，繁殖季
_WINTER = {11, 0, 1}    # 12,1,2 月，越冬季
_PASSAGE = {2, 7, 8, 9}  # 3,8,9,10 月，过境季（近似）


def classify_seasonal(monthly: list[int], total_reports: list[int]) -> str:
    sampled = {i for i in range(12) if total_reports[i] > 0}
    present = {i for i in sampled if monthly[i] > 0}
    if not present:
        return "不确定"
    in_breed, in_winter = bool(_BREED & present), bool(_WINTER & present)
    breed_sampled, winter_sampled = _BREED & sampled, _WINTER & sampled
    if breed_sampled and winter_sampled:
        if in_breed and in_winter:
            return "留鸟"
        if in_breed:
            return "夏候鸟"
        if in_winter:
            return "冬候鸟"
    if present and present <= _PASSAGE:   # 只在过境季出现
        return "旅鸟"
    return "不确定"

# LEFT JOIN from the monthly checklist totals so months with sampling effort
# but zero observations of the target species still report `0 / total_reports`
# instead of being dropped to `0/0` by the species join.
BAR_CHART_SQL = """
WITH total AS (
    SELECT strftime('%m', start_time) AS m, COUNT(*) AS cnt
    FROM checklists
    WHERE province = :province
    GROUP BY m
),
species AS (
    SELECT strftime('%m', c.start_time) AS m,
           COUNT(DISTINCT c.report_id)  AS cnt
    FROM checklists c
    JOIN observations o ON c.report_id = o.report_id
    WHERE c.province = :province
      AND o.taxon_name = :taxon
    GROUP BY m
)
SELECT
    total.m                                                   AS month,
    COALESCE(species.cnt, 0)                                  AS reports_with_species,
    total.cnt                                                 AS total_reports,
    ROUND(100.0 * COALESCE(species.cnt, 0) / total.cnt, 1)    AS frequency_pct
FROM total
LEFT JOIN species ON species.m = total.m
ORDER BY total.m;
"""


def export_provinces_summary() -> Path | None:
    """Pass through the cleartext provinces summary.

    Optional — returns None if no source exists (e.g. fetch_provinces.py
    hasn't run / can't reach the API), so the offline DB-backed exports
    (--province, --bar-chart) still work.
    """
    src = RAW_DIR / "provinces_summary.json"
    if not src.exists():
        return None
    dst = OUT_DIR / "provinces_summary.json"
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(src, dst)
    return dst


def export_taxon_list() -> Path | None:
    """Pass through the species catalog for the frontend autocomplete.

    Optional — returns None if no source exists, so a partially-set-up
    repo can still produce the provinces export.
    """
    src = RAW_DIR / "taxon_list.json"
    if not src.exists():
        return None
    dst = OUT_DIR / "taxon_list.json"
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(src, dst)
    return dst


def bar_chart(conn: sqlite3.Connection, province: str, taxon: str) -> list[dict]:
    rows = conn.execute(
        BAR_CHART_SQL, {"province": province, "taxon": taxon}
    ).fetchall()
    by_month = {r[0]: dict(zip(["month", "reports_with_species", "total_reports", "frequency_pct"], r)) for r in rows}
    out = []
    for m in range(1, 13):
        key = f"{m:02d}"
        out.append(by_month.get(key, {
            "month": key,
            "reports_with_species": 0,
            "total_reports": 0,
            "frequency_pct": 0.0,
        }))
    return out


def export_bar_chart(province: str, taxon: str) -> Path:
    with connect() as conn:
        data = bar_chart(conn, province, taxon)
    dst = OUT_DIR / "bar_chart" / f"{province}__{taxon}.json"
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    return dst


def _filters(prefix: str, districts: tuple[str, ...], city: str | None,
             points: tuple[str, ...]) -> str:
    """Build the location WHERE fragment for a given column prefix ("" or "c.").

    Composable grain: districts (区县集) and/or city (市/地区) and/or points
    (point_name 模糊匹配，折叠各种写法). point_name 字段写法很乱，所以景点用
    LIKE %关键词% 归并。Params are shared across both query shapes (no prefix on
    the bind names), so only the column prefix differs between the two SQLs.
    """
    parts = []
    if districts:
        ph = ",".join(f":d{i}" for i in range(len(districts)))
        parts.append(f" AND {prefix}district IN ({ph})")
    elif city:
        parts.append(f" AND {prefix}city = :city")
    if points:
        ors = " OR ".join(f"{prefix}point_name LIKE :p{i}" for i in range(len(points)))
        parts.append(f" AND ({ors})")
    return "".join(parts)


def _bundle(conn: sqlite3.Connection, province: str,
            districts: tuple[str, ...] = (), city: str | None = None,
            points: tuple[str, ...] = ()) -> dict:
    """Month-by-month report count per species for a location.

    Grain (composable): `points` (景点，point_name 模糊匹配) within `districts`
    (区县集) or `city` (市/地区), within `province`. Empty -> whole province
    (legacy bundle). Same LEFT-JOIN frequency口径 as the Bar Chart:
    `total_reports[m]` is sampling effort (denominator), `species[i].monthly[m]`
    the numerator, so a month with checklists but no detail still reports
    `0 / total` honestly. Frontend computes `monthly[m] / total_reports[m] * 100`.
    """
    months = [f"{m:02d}" for m in range(1, 13)]
    params: dict = {"province": province}
    params.update({f"d{i}": d for i, d in enumerate(districts)})
    if city and not districts:
        params["city"] = city
    params.update({f"p{i}": f"%{p}%" for i, p in enumerate(points)})

    totals_by_month = {
        m: cnt for m, cnt in conn.execute(
            "SELECT strftime('%m', start_time) AS m, COUNT(*) AS cnt "
            "FROM checklists WHERE province = :province"
            + _filters("", districts, city, points) + " GROUP BY m",
            params,
        )
    }
    species_acc: dict[str, dict] = {}
    for taxon, latin, m, cnt in conn.execute(
        "SELECT o.taxon_name, o.latin_name, strftime('%m', c.start_time) AS m, "
        "COUNT(DISTINCT c.report_id) AS cnt "
        "FROM checklists c JOIN observations o ON c.report_id = o.report_id "
        "WHERE c.province = :province AND o.taxon_name IS NOT NULL"
        + _filters("c.", districts, city, points)
        + " GROUP BY o.taxon_name, m",
        params,
    ):
        entry = species_acc.setdefault(
            taxon, {"name": taxon, "latin_name": latin, "monthly": {x: 0 for x in months}}
        )
        entry["monthly"][m] = cnt

    return {
        "province": province,
        "total_reports": [totals_by_month.get(m, 0) for m in months],
        "species": [
            {
                "name": e["name"],
                "latin_name": e["latin_name"],
                "ebird_code": ebird_code(e["latin_name"]),
                "monthly": [e["monthly"][m] for m in months],
            }
            for e in sorted(species_acc.values(), key=lambda x: x["name"])
        ],
    }


def province_bundle(conn: sqlite3.Connection, province: str) -> dict:
    """Whole-province species bundle (one file per province)."""
    return _bundle(conn, province)


def export_province_bundle(province: str) -> Path:
    with connect() as conn:
        bundle = province_bundle(conn, province)
    dst = OUT_DIR / "province" / f"{province}.json"
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_text(json.dumps(bundle, ensure_ascii=False, indent=2), encoding="utf-8")
    return dst


# --- Trip bundle (MVP: 行程驱动「时间+地点→鸟种」) --------------------------
# Itinerary stops in chronological order, mapped to birdreport 省/区县.
# See docs/itinerary-june.md. `districts` empty -> whole province (used where we
# can't resolve finer, e.g. 西藏 which is 0-coverage). `month` = trip month, used
# to rank the species list and judge sample honesty.
TRIP_MONTH = "06"
THIN_SAMPLE = 15  # N < THIN_SAMPLE -> flag as 样本薄 (PRD 数据诚实性)

# 地点粒度（Amber 2026-06-04 定）：**有具体景点的（云南）拆到景点**，用 `points`
# 模糊匹配折叠 point_name 的各种写法；**没有具体景点的（西藏拉萨/日喀则）用市级**，
# 阿里玛旁雍错/扎达本就是独立地点用区县级。点位字段很乱，所以 6 月真实数据常落在
# 不出名的点上（玉龙 6 月物种其实在玉峰寺/玉水寨，不在玉龙雪山）—— 故招牌景点会
# 诚实显示空/薄，同时给真正有数据的点也单列，免得数据消失。
TRIP_STOPS = [
    # —— 云南 · 丽江段（6/9–11）——
    {"id": "yulong-snow", "label": "玉龙雪山 · 云杉坪", "dates": "6/9–10",
     "province": "云南", "districts": ("玉龙纳西族自治县",), "points": ("玉龙雪山", "云杉坪")},
    {"id": "blue-moon", "label": "蓝月谷", "dates": "6/9–10",
     "province": "云南", "districts": ("玉龙纳西族自治县",), "points": ("蓝月谷",)},
    {"id": "yufeng", "label": "玉峰寺 · 玉水寨 · 白沙", "dates": "6/10",
     "province": "云南", "districts": ("玉龙纳西族自治县",), "points": ("玉峰寺", "玉水寨", "白沙")},
    {"id": "shuhe", "label": "束河古镇", "dates": "6/10",
     "province": "云南", "points": ("束河",)},
    {"id": "lijiang-old", "label": "丽江古城 · 黑龙潭", "dates": "6/9",
     "province": "云南", "districts": ("古城区",),
     "points": ("古城", "黑龙潭", "狮子山", "四方街", "木府", "九鼎", "博物")},
    {"id": "tiger-leap", "label": "虎跳峡", "dates": "6/11",
     "province": "云南", "points": ("虎跳峡",)},
    # —— 云南 · 迪庆/香格里拉段（6/11–12, 14）——
    {"id": "dukezong", "label": "独克宗古城", "dates": "6/11",
     "province": "云南", "districts": ("香格里拉市",), "points": ("独克宗", "月光", "龟山")},
    {"id": "songzanlin", "label": "松赞林寺", "dates": "6/12",
     "province": "云南", "districts": ("香格里拉市",), "points": ("松赞林", "噶丹")},
    {"id": "pudacuo", "label": "普达措国家公园", "dates": "6/11–12",
     "province": "云南", "districts": ("香格里拉市",), "points": ("普达措", "属都", "碧塔海")},
    {"id": "napahai", "label": "纳帕海", "dates": "6/11–12",
     "province": "云南", "districts": ("香格里拉市",), "points": ("纳帕海", "依拉")},
    # —— 云南 · 德钦段（6/12–13）——
    {"id": "meili", "label": "飞来寺 · 梅里 · 雾浓顶", "dates": "6/12–13",
     "province": "云南", "districts": ("德钦县",), "points": ("飞来寺", "梅里", "雾浓顶")},
    {"id": "baima", "label": "白马雪山", "dates": "6/12–13",
     "province": "云南", "districts": ("德钦县",), "points": ("白马雪山",)},
    # —— 西藏（无具体景点用市级；阿里独立地点用区县级）——
    {"id": "lhasa", "label": "拉萨（市级）", "dates": "6/14–15",
     "province": "西藏", "city": "拉萨市"},
    {"id": "shigatse", "label": "日喀则（市级）", "dates": "6/15–16",
     "province": "西藏", "city": "日喀则市"},
    {"id": "manasarovar", "label": "玛旁雍错 · 普兰", "dates": "6/17–19",
     "province": "西藏", "districts": ("普兰县",)},
    {"id": "zanda", "label": "扎达土林 · 古格", "dates": "6/20–21",
     "province": "西藏", "districts": ("札达县",)},
]


def _stop_grain(stop: dict) -> str:
    if stop.get("points"):
        return "point"
    if stop.get("districts"):
        return "district"
    if stop.get("city"):
        return "city"
    return "province"


def trip_stop_bundle(conn: sqlite3.Connection, stop: dict) -> dict:
    """Build one stop's bundle + honesty metadata for the trip month.

    NB: 居留型(seasonal) 暂不输出 —— 没有权威数据源，只能从出现模式推断，Amber
    决定先不展示（`classify_seasonal` 保留备用）。
    """
    bundle = _bundle(conn, stop["province"], stop.get("districts", ()),
                     stop.get("city"), stop.get("points", ()))
    mi = int(TRIP_MONTH) - 1
    total = bundle["total_reports"][mi]
    # Species reported in the trip month, ranked by report count desc.
    month_species = [
        {
            "name": s["name"],
            "latin_name": s["latin_name"],
            "links": species_links(s["name"], s["latin_name"], s.get("ebird_code")),
            "reports": s["monthly"][mi],
            "frequency_pct": round(100.0 * s["monthly"][mi] / total, 1) if total else 0.0,
        }
        for s in bundle["species"] if s["monthly"][mi] > 0
    ]
    month_species.sort(key=lambda x: (-x["reports"], x["name"]))
    status = "none" if total == 0 else ("thin" if total < THIN_SAMPLE else "ok")
    return {
        **{k: stop[k] for k in ("id", "label", "dates", "province")},
        "city": stop.get("city"),
        "districts": list(stop.get("districts", ())),
        "points": list(stop.get("points", ())),
        "grain": _stop_grain(stop),
        "trip_month": TRIP_MONTH,
        "total_reports_month": total,
        "species_count_month": len(month_species),
        "data_status": status,          # none | thin | ok
        "month_species": month_species,  # ranked, trip-month only —— 前端唯一用到的
        # NB: 不再输出 12 月 `species`/`total_reports` 数组 —— 名录页只用
        # month_species，那两个大数组（每点全物种×12月）纯属冗余。「何时去」页用的是
        # 省级 bundle（province/<省>.json），不是 trip bundle。需要按景点画 12 月柱图时
        # 再加回（用 _bundle(...) 的结果），别默认带着。
    }


def export_trip() -> list[Path]:
    """Write one bundle per trip stop + an ordered manifest."""
    out: list[Path] = []
    trip_dir = OUT_DIR / "trip"
    trip_dir.mkdir(parents=True, exist_ok=True)
    manifest = []
    with connect() as conn:
        for stop in TRIP_STOPS:
            b = trip_stop_bundle(conn, stop)
            dst = trip_dir / f"{b['id']}.json"
            dst.write_text(json.dumps(b, ensure_ascii=False, indent=2), encoding="utf-8")
            out.append(dst)
            manifest.append({
                "id": b["id"], "label": b["label"], "dates": b["dates"],
                "province": b["province"], "city": b["city"],
                "districts": b["districts"], "points": b["points"], "grain": b["grain"],
                "total_reports_month": b["total_reports_month"],
                "species_count_month": b["species_count_month"],
                "data_status": b["data_status"],
            })
    man_dst = trip_dir / "manifest.json"
    man_dst.write_text(
        json.dumps({"trip_month": TRIP_MONTH, "stops": manifest},
                   ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    out.append(man_dst)
    return out


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bar-chart", nargs=2, metavar=("PROVINCE", "TAXON"),
                        help="export single-pair bar chart JSON (legacy shape)")
    parser.add_argument("--province", metavar="PROVINCE",
                        help="export the whole-province species bundle (preferred — "
                             "lets the frontend chart any species without re-export)")
    parser.add_argument("--trip", action="store_true",
                        help="export per-stop trip bundles + manifest (MVP 名录页: "
                             "地点+时间→鸟种, see docs/mvp-trip.md)")
    args = parser.parse_args()

    out = export_provinces_summary()
    if out:
        print(f"wrote {out}")
    else:
        print("skipping provinces_summary.json (run fetch_provinces.py to add it)")

    taxon_out = export_taxon_list()
    if taxon_out:
        print(f"wrote {taxon_out}")

    if args.bar_chart:
        province, taxon = args.bar_chart
        if not DB_PATH.exists():
            print(f"skipping bar chart: {DB_PATH} not built yet")
            return
        out = export_bar_chart(province, taxon)
        print(f"wrote {out}")

    if args.province:
        if not DB_PATH.exists():
            print(f"skipping province bundle: {DB_PATH} not built yet")
            return
        out = export_province_bundle(args.province)
        print(f"wrote {out}")

    if args.trip:
        if not DB_PATH.exists():
            print(f"skipping trip export: {DB_PATH} not built yet")
            return
        for p in export_trip():
            print(f"wrote {p}")


if __name__ == "__main__":
    main()
