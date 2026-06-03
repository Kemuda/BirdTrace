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


def export_provinces_summary() -> Path:
    src = RAW_DIR / "provinces_summary.json"
    if not src.exists():
        raise FileNotFoundError(
            f"{src} missing — run data/scraper/fetch_provinces.py first"
        )
    dst = OUT_DIR / "provinces_summary.json"
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


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bar-chart", nargs=2, metavar=("PROVINCE", "TAXON"),
                        help="export bar chart JSON for one (province, taxon) pair")
    args = parser.parse_args()

    out = export_provinces_summary()
    print(f"wrote {out}")

    if args.bar_chart:
        province, taxon = args.bar_chart
        if not DB_PATH.exists():
            print(f"skipping bar chart: {DB_PATH} not built yet")
            return
        out = export_bar_chart(province, taxon)
        print(f"wrote {out}")


if __name__ == "__main__":
    main()
