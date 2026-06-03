"""Fetch the full taxon list in one shot from /front/taxon/search.

The site's autocomplete uses this to populate its species dropdown.
Used to be cleartext; as of 2026-06 it requires signing — we route
through BirdReportClient so the request is signed and the response
(whether cleartext or encrypted) is parsed correctly.
"""
from __future__ import annotations

import asyncio
import json
from pathlib import Path

from birdreport_client import BirdReportClient

OUT_PATH = Path(__file__).resolve().parents[1] / "raw" / "taxon_list.json"


def _records_of(payload):
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict) and isinstance(payload.get("data"), list):
        return payload["data"]
    return None


async def main() -> None:
    async with BirdReportClient() as client:
        data = await client.get_taxon_list()
    records = _records_of(data)
    if records is None:
        raise RuntimeError(f"unexpected response shape: {type(data).__name__}: {str(data)[:300]!r}")
    if records:
        print(f"sample: {json.dumps(records[0], ensure_ascii=False)}")
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {len(records)} taxa -> {OUT_PATH}")


if __name__ == "__main__":
    asyncio.run(main())
