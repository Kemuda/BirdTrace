"""End-to-end smoke test: fetch the first page of Yunnan checklists.

Exercises the full RSA-sign + AES-decrypt path via the shared client in
data/scraper/birdreport_client.py. The script doubles as a regression
test — if birdreport.cn rotates AES keys or moves the endpoint, this
fails before the bulk scraper does.
"""
from __future__ import annotations

import asyncio
import json
import os
import sys
import time
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "data" / "scraper"))

from birdreport_client import BirdReportClient, BirdReportError  # noqa: E402


async def main() -> int:
    province = os.environ.get("BR_PROVINCE", "云南")
    if os.environ.get("BR_USE_DATES", "0") == "1":
        end = time.strftime("%Y-%m-%d")
        start = time.strftime("%Y-%m-%d", time.localtime(time.time() - 30 * 86400))
    else:
        start = end = ""

    print(f"Fetching {province} checklists, start={start!r} end={end!r}, page=1, limit=20")
    async with BirdReportClient() as client:
        try:
            records = await client.search_checklists(
                province=province, page=1, limit=20, start=start, end=end
            )
        except BirdReportError as e:
            print(f"FAIL: {e}")
            return 1

    print(f"Got {len(records)} checklists.")
    if records:
        sample = records[0]
        print(f"Sample keys: {sorted(sample.keys())}")
        print(f"First record: {json.dumps(sample, ensure_ascii=False, indent=2)[:1200]}")

    out = REPO_ROOT / "data" / "scraper" / f"{province}_sample.json"
    out.write_text(json.dumps(records, ensure_ascii=False, indent=2))
    print(f"Saved -> {out.relative_to(REPO_ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
