"""Load data/raw/taxa.json into the `taxa` table."""
from __future__ import annotations

import json
from pathlib import Path

from build_db import connect

SRC = Path(__file__).resolve().parents[1] / "raw" / "taxa.json"

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
    if not SRC.exists():
        raise FileNotFoundError(f"{SRC} missing — run data/scraper/fetch_taxa.py first")
    rows = json.loads(SRC.read_text(encoding="utf-8"))
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
