"""Create the SQLite schema for checklists/observations/taxa. Idempotent."""
from __future__ import annotations

import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parents[1] / "db" / "birdreport.sqlite"

SCHEMA = """
CREATE TABLE IF NOT EXISTS checklists (
    report_id    TEXT PRIMARY KEY,
    serial_id    TEXT,
    start_time   TEXT,
    province     TEXT,
    city         TEXT,
    district     TEXT,
    point_name   TEXT,
    lat          REAL,
    lng          REAL,
    taxon_count  INTEGER,
    username     TEXT
);

CREATE TABLE IF NOT EXISTS observations (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    report_id    TEXT REFERENCES checklists(report_id),
    taxon_id     INTEGER,
    taxon_name   TEXT,
    latin_name   TEXT,
    taxon_count  INTEGER
);

CREATE TABLE IF NOT EXISTS taxa (
    taxon_id     INTEGER PRIMARY KEY,
    name         TEXT,
    latin_name   TEXT,
    english_name TEXT,
    order_name   TEXT,
    family_name  TEXT
);

CREATE INDEX IF NOT EXISTS idx_checklists_province_time ON checklists(province, start_time);
CREATE INDEX IF NOT EXISTS idx_observations_report      ON observations(report_id);
CREATE INDEX IF NOT EXISTS idx_observations_taxon_name  ON observations(taxon_name);
"""


def connect(path: Path = DB_PATH) -> sqlite3.Connection:
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def main() -> None:
    with connect() as conn:
        conn.executescript(SCHEMA)
    print(f"schema ready -> {DB_PATH}")


if __name__ == "__main__":
    main()
