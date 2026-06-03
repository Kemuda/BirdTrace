"""Load scraped taxonomy into the `taxa` table.

Prefers data/raw/taxon_list.json (one-shot dump from
fetch_taxon_list.py), falls back to data/raw/taxa.json (the slower
per-ID iterator from fetch_taxa.py). Both come from the same backend
and share at least the id/name/latinname fields.
"""
from __future__ import annotations

import json
from pathlib import Path

from build_db import connect

RAW_DIR = Path(__file__).resolve().parents[1] / "raw"
SRC_CANDIDATES = [RAW_DIR / "taxon_list.json", RAW_DIR / "taxa.json"]

# Map birdreport field names to our schema columns.
COLUMN_MAP = {
    "taxon_id": ("id", int),
    "name": ("name", str),
    "latin_name": ("latinname", str),
    "english_name": ("englishname", str),
    "order_name": ("taxonordername", str),
    "family_name": ("taxonfamilyname", str),
}


def main() -> None:
    src = next((p for p in SRC_CANDIDATES if p.exists()), None)
    if src is None:
        raise FileNotFoundError(
            f"None of {[str(p) for p in SRC_CANDIDATES]} exist — "
            "run data/scraper/fetch_taxon_list.py (preferred) or fetch_taxa.py first"
        )
    rows = json.loads(src.read_text(encoding="utf-8"))
    print(f"loading taxa from {src}")
    cols = list(COLUMN_MAP.keys())
    placeholders = ",".join(["?"] * len(cols))
    insert_sql = f"INSERT OR REPLACE INTO taxa ({','.join(cols)}) VALUES ({placeholders})"

    with connect() as conn:
        for row in rows:
            values = []
            for src_field, caster in COLUMN_MAP.values():
                val = row.get(src_field)
                values.append(caster(val) if val is not None else None)
            conn.execute(insert_sql, values)
        conn.commit()
        count = conn.execute("SELECT COUNT(*) FROM taxa").fetchone()[0]
    print(f"loaded {len(rows)} taxa, table now has {count} rows")


if __name__ == "__main__":
    main()
