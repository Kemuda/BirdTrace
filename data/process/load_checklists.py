"""Load scraped checklists and observations into SQLite.

Reads:
    data/raw/checklists/<province>/<page>.json   -> table `checklists`
    data/raw/observations/<report_id>.json       -> table `observations`

Both raw shapes are tolerated:
    payload as a list, or {"data": [...]}.

Field mapping follows PRD §数据结构. lat/lng are TBD per PRD §已知问题; we
probe a few likely field names and fall back to NULL.
"""
from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from typing import Any, Iterable

from build_db import connect

ROOT = Path(__file__).resolve().parents[1]
CHECKLISTS_DIR = ROOT / "raw" / "checklists"
OBSERVATIONS_DIR = ROOT / "raw" / "observations"

# Upsert only the list-derived columns. lat/lng/point_id/address come from a
# DIFFERENT endpoint (/front/activity/get, via fetch_report_detail.py) and the
# list payload has none of them — so we must NOT touch those columns on reload,
# or every re-import would wipe the scraped coordinates. (ON CONFLICT preserves
# any column we don't name.)
CHECKLIST_INSERT = """
INSERT INTO checklists
    (report_id, serial_id, start_time, province, city, district, point_name,
     taxon_count, username)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(report_id) DO UPDATE SET
    serial_id   = excluded.serial_id,
    start_time  = excluded.start_time,
    province    = excluded.province,
    city        = excluded.city,
    district    = excluded.district,
    point_name  = excluded.point_name,
    taxon_count = excluded.taxon_count,
    username    = excluded.username
"""

OBSERVATION_INSERT = """
INSERT INTO observations
    (report_id, taxon_id, taxon_name, latin_name, english_name, taxon_count)
VALUES (?, ?, ?, ?, ?, ?)
"""


def _records_of(payload: Any) -> list[dict]:
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        inner = payload.get("data")
        if isinstance(inner, list):
            return inner
    return []


def _first(d: dict, *keys: str) -> Any:
    for k in keys:
        v = d.get(k)
        if v is not None and v != "":
            return v
    return None


# The backend returns full administrative names ("云南省", "西藏自治区"), but the
# frontend dropdown + provinces_summary use short names ("云南", "西藏"). Normalize
# at load time so DB province values join cleanly across both.
_PROVINCE_SUFFIXES = ("省", "自治区", "壮族自治区", "回族自治区", "维吾尔自治区", "市")


def _normalize_province(name: Any) -> Any:
    if not isinstance(name, str):
        return name
    s = name.strip()
    # 内蒙古自治区 -> 内蒙古, 广西壮族自治区 -> 广西, etc. Strip the longest matching suffix.
    for suffix in sorted(_PROVINCE_SUFFIXES, key=len, reverse=True):
        if s.endswith(suffix) and len(s) > len(suffix):
            return s[: -len(suffix)]
    return s


def _iter_json(root: Path) -> Iterable[tuple[Path, Any]]:
    if not root.exists():
        return
    for path in sorted(root.rglob("*.json")):
        try:
            yield path, json.loads(path.read_text(encoding="utf-8"))
        except Exception as e:
            print(f"  skip {path}: {e}")


def load_checklists(conn: sqlite3.Connection) -> int:
    rows = 0
    for _path, payload in _iter_json(CHECKLISTS_DIR):
        for rec in _records_of(payload):
            report_id = _first(rec, "reportId", "report_id")
            if not report_id:
                continue
            conn.execute(CHECKLIST_INSERT, (
                report_id,
                _first(rec, "serial_id", "serialId"),
                _first(rec, "start_time", "startTime"),
                _normalize_province(_first(rec, "province_name", "province")),
                _first(rec, "city_name", "city"),
                _first(rec, "district_name", "district"),
                _first(rec, "point_name", "pointName"),
                _first(rec, "taxoncount", "taxon_count"),
                _first(rec, "username"),
            ))
            rows += 1
    conn.commit()
    return rows


def load_observations(conn: sqlite3.Connection) -> int:
    rows = 0
    # Replace observations on a per-report basis so re-runs stay idempotent.
    for path, payload in _iter_json(OBSERVATIONS_DIR):
        report_id = path.stem
        conn.execute("DELETE FROM observations WHERE report_id = ?", (report_id,))
        for rec in _records_of(payload):
            conn.execute(OBSERVATION_INSERT, (
                report_id,
                _first(rec, "taxon_id", "taxonId"),
                _first(rec, "taxon_name", "taxonName"),
                _first(rec, "latinname", "latin_name", "latinName"),
                _first(rec, "englishname", "english_name", "englishName"),
                _first(rec, "taxon_count", "taxonCount"),
            ))
            rows += 1
    conn.commit()
    return rows


def main() -> None:
    with connect() as conn:
        c = load_checklists(conn)
        o = load_observations(conn)
        total_c = conn.execute("SELECT COUNT(*) FROM checklists").fetchone()[0]
        total_o = conn.execute("SELECT COUNT(*) FROM observations").fetchone()[0]
        # Surface what's actually in the DB so the user knows what species
        # to chart without guessing. Most-reported first; report_count is
        # the distinct-checklist count (= numerator of frequency_pct).
        top_species = conn.execute("""
            SELECT taxon_name, COUNT(DISTINCT report_id) AS report_count
            FROM observations
            WHERE taxon_name IS NOT NULL
            GROUP BY taxon_name
            ORDER BY report_count DESC
            LIMIT 10
        """).fetchall()
    print(f"loaded {c} checklist rows (table now has {total_c})")
    print(f"loaded {o} observation rows (table now has {total_o})")
    if top_species:
        print("\nTop 10 species by report count (try these in the frontend):")
        for name, cnt in top_species:
            print(f"  {cnt:>4}  {name}")


if __name__ == "__main__":
    main()
