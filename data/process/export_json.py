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


PROVINCE_BUNDLE_SQL_TOTALS = """
SELECT strftime('%m', start_time) AS m, COUNT(*) AS cnt
FROM checklists WHERE province = :province GROUP BY m
"""

PROVINCE_BUNDLE_SQL_SPECIES = """
SELECT o.taxon_name,
       o.latin_name,
       strftime('%m', c.start_time)      AS m,
       COUNT(DISTINCT c.report_id)        AS cnt
FROM checklists c
JOIN observations o ON c.report_id = o.report_id
WHERE c.province = :province AND o.taxon_name IS NOT NULL
GROUP BY o.taxon_name, m
"""


def province_bundle(conn: sqlite3.Connection, province: str) -> dict:
    """Return every species' month-by-month report count for a province.

    The frontend computes `frequency_pct = species[i].monthly[m] /
    total_reports[m] * 100` on the fly. One file per province scales much
    better than one per (province, species) pair, and lets the UI
    autocomplete + chart any species without re-fetching.
    """
    months = [f"{m:02d}" for m in range(1, 13)]
    totals_by_month = {
        m: cnt for m, cnt in
        conn.execute(PROVINCE_BUNDLE_SQL_TOTALS, {"province": province})
    }
    species_acc: dict[str, dict] = {}
    for taxon, latin, m, cnt in conn.execute(
        PROVINCE_BUNDLE_SQL_SPECIES, {"province": province}
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


def export_province_bundle(province: str) -> Path:
    with connect() as conn:
        bundle = province_bundle(conn, province)
    dst = OUT_DIR / "province" / f"{province}.json"
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_text(json.dumps(bundle, ensure_ascii=False, indent=2), encoding="utf-8")
    return dst


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bar-chart", nargs=2, metavar=("PROVINCE", "TAXON"),
                        help="export single-pair bar chart JSON (legacy shape)")
    parser.add_argument("--province", metavar="PROVINCE",
                        help="export the whole-province species bundle (preferred — "
                             "lets the frontend chart any species without re-export)")
    args = parser.parse_args()

    out = export_provinces_summary()
    print(f"wrote {out}")

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


if __name__ == "__main__":
    main()
