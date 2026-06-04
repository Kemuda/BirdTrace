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

from build_db import DB_PATH, connect

ROOT = Path(__file__).resolve().parents[2]
RAW_DIR = ROOT / "data" / "raw"
OUT_DIR = ROOT / "frontend" / "public" / "data"

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


def _bundle(conn: sqlite3.Connection, province: str,
            districts: tuple[str, ...] = (), city: str | None = None) -> dict:
    """Month-by-month report count per species for a location.

    Filter grain (most to least specific): `districts` (a set of 区县) >
    `city` (a whole 市/地区) > province only (the legacy province bundle).
    Same LEFT-JOIN frequency口径 as the Bar Chart: `total_reports[m]` is the
    sampling effort (denominator), `species[i].monthly[m]` the numerator, so a
    month with checklists but no detail still reports `0 / total` honestly.
    The frontend computes `frequency_pct = monthly[m] / total_reports[m] * 100`.
    """
    months = [f"{m:02d}" for m in range(1, 13)]
    params: dict = {"province": province}
    where = ""
    if districts:
        placeholders = ",".join(f":d{i}" for i in range(len(districts)))
        where = f" AND district IN ({placeholders})"
        params.update({f"d{i}": d for i, d in enumerate(districts)})
    elif city:
        where = " AND city = :city"
        params["city"] = city

    totals_by_month = {
        m: cnt for m, cnt in conn.execute(
            "SELECT strftime('%m', start_time) AS m, COUNT(*) AS cnt "
            "FROM checklists WHERE province = :province" + where + " GROUP BY m",
            params,
        )
    }
    species_acc: dict[str, dict] = {}
    for taxon, latin, m, cnt in conn.execute(
        "SELECT o.taxon_name, o.latin_name, strftime('%m', c.start_time) AS m, "
        "COUNT(DISTINCT c.report_id) AS cnt "
        "FROM checklists c JOIN observations o ON c.report_id = o.report_id "
        "WHERE c.province = :province AND o.taxon_name IS NOT NULL"
        + where.replace(" AND district", " AND c.district").replace(" AND city", " AND c.city")
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

# Each stop filters by `districts` (区县 set) when we can resolve that grain,
# else by `city` (市/地区). 西藏 grain chosen from real coverage (2026-06-04 load):
# 拉萨/日喀则 broad route -> city-level; 阿里 转山/扎达 -> the single 区县.
TRIP_STOPS = [
    {"id": "lijiang-yulong", "label": "丽江 · 玉龙雪山/古城", "dates": "6/9–11",
     "province": "云南", "city": "丽江市", "districts": ("古城区", "玉龙纳西族自治县")},
    {"id": "shangri-la", "label": "香格里拉 · 独克宗/普达措", "dates": "6/11–12, 14",
     "province": "云南", "city": "迪庆藏族自治州", "districts": ("香格里拉市",)},
    {"id": "deqin-meili", "label": "德钦 · 梅里/雾浓顶", "dates": "6/12–13",
     "province": "云南", "city": "迪庆藏族自治州", "districts": ("德钦县",)},
    {"id": "lhasa", "label": "拉萨 · 拉萨河谷", "dates": "6/14–15",
     "province": "西藏", "city": "拉萨市", "districts": ()},
    {"id": "shigatse", "label": "日喀则 · 江孜/萨嘎/仲巴", "dates": "6/15–16",
     "province": "西藏", "city": "日喀则市", "districts": ()},
    {"id": "manasarovar", "label": "玛旁雍错/冈仁波齐转山", "dates": "6/17–19",
     "province": "西藏", "city": "阿里地区", "districts": ("普兰县",)},
    {"id": "zanda", "label": "扎达土林 · 古格", "dates": "6/20–21",
     "province": "西藏", "city": "阿里地区", "districts": ("札达县",)},
]


def trip_stop_bundle(conn: sqlite3.Connection, stop: dict) -> dict:
    """Build one stop's bundle + honesty metadata for the trip month."""
    bundle = _bundle(conn, stop["province"], stop["districts"], stop.get("city"))
    mi = int(TRIP_MONTH) - 1
    total = bundle["total_reports"][mi]
    # Species reported in the trip month, ranked by report count desc.
    month_species = [
        {
            "name": s["name"],
            "latin_name": s["latin_name"],
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
        "districts": list(stop["districts"]),
        "grain": "district" if stop["districts"] else ("city" if stop.get("city") else "province"),
        "trip_month": TRIP_MONTH,
        "total_reports_month": total,
        "species_count_month": len(month_species),
        "data_status": status,          # none | thin | ok
        "month_species": month_species,  # ranked, trip-month only
        "total_reports": bundle["total_reports"],  # 12-mo, for Bar Chart reuse
        "species": bundle["species"],              # 12-mo, full detail
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
                "districts": b["districts"], "grain": b["grain"],
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
