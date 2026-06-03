"""Fetch taxon detail records from birdreport.cn /front/taxon/get (cleartext).

Walks a range of integer taxon IDs, requests each, and saves successful
responses as a single JSON array. Per PRD §采集策略 this is rate-limited
(1-2s between requests) to be polite to the upstream.

The endpoint is unsigned but the front gate WAFs requests without
browser-shaped headers; we send the same headers the real frontend uses.

Usage:
    python data/scraper/fetch_taxa.py --start 4000 --end 4200
"""
from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

import requests

API_URL = "https://api.birdreport.cn/front/taxon/get"
OUT_PATH = Path(__file__).resolve().parents[1] / "raw" / "taxa.json"

HEADERS = {
    "Accept": "*/*",
    "Accept-Language": "zh-CN,zh;q=0.9",
    "Content-Type": "application/json",
    "Origin": "https://www.birdreport.cn",
    "Referer": "https://www.birdreport.cn/",
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    ),
}


def fetch_one(taxon_id: int, session: requests.Session) -> dict | None:
    resp = session.post(
        API_URL, json={"id": taxon_id}, headers=HEADERS, timeout=15
    )
    resp.raise_for_status()
    body = resp.json()
    # API uses {code: 0, data: {...}} for success and {code: !=0, ...} for misses.
    if not isinstance(body, dict) or body.get("code") != 0:
        return None
    return body.get("data")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--start", type=int, default=4000)
    parser.add_argument("--end", type=int, default=5500,
                        help="inclusive upper bound for taxon id")
    parser.add_argument("--sleep", type=float, default=1.0,
                        help="seconds to wait between requests")
    args = parser.parse_args()

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    existing: dict[int, dict] = {}
    if OUT_PATH.exists():
        for row in json.loads(OUT_PATH.read_text(encoding="utf-8")):
            existing[row["id"]] = row

    session = requests.Session()
    new_count = 0
    for tid in range(args.start, args.end + 1):
        if tid in existing:
            continue
        try:
            data = fetch_one(tid, session)
        except Exception as e:
            print(f"  id={tid} error: {e}")
            time.sleep(args.sleep)
            continue
        if data:
            data.setdefault("id", tid)
            existing[tid] = data
            new_count += 1
            print(f"  id={tid} -> {data.get('name') or data.get('latinname')}")
        time.sleep(args.sleep)

    sorted_rows = [existing[k] for k in sorted(existing)]
    OUT_PATH.write_text(
        json.dumps(sorted_rows, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"saved {len(sorted_rows)} taxa (+{new_count} new) -> {OUT_PATH}")


if __name__ == "__main__":
    main()
