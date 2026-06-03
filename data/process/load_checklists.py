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

CHECKLIST_INSERT = """
INSERT OR REPLACE INTO checklists
    (report_id, serial_id, start_time, province, city, district,
     point_name, lat, lng, taxon_count, username)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
"""

OBSERVATION_INSERT = """
INSERT INTO observations
    (report_id, taxon_id, taxon_name, latin_name, taxon_count)
VALUES (?, ?, ?, ?, ?)
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
                _first(rec, "province_name", "province"),
                _first(rec, "city_name", "city"),
                _first(rec, "district_name", "district"),
                _first(rec, "point_name", "pointName"),
                _first(rec, "lat", "latitude", "point_lat"),
                _first(rec, "lng", "lon", "longitude", "point_lng"),
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
    print(f"loaded {c} checklist rows (table now has {total_c})")
    print(f"loaded {o} observation rows (table now has {total_o})")


if __name__ == "__main__":
    main()
