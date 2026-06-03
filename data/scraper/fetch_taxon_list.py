"""Fetch the full taxon list in one shot from /front/taxon/search.

The site's report-list page uses this endpoint to populate its species
autocomplete; it returns the whole bird species catalog in a single
cleartext response. Much faster than iterating IDs through
/front/taxon/get (which fetch_taxa.py does).

If this works, prefer it. If for some reason it requires signing or
returns empty, fall back to fetch_taxa.py.
"""
from __future__ import annotations

import json
from pathlib import Path

import requests

API_URL = "https://api.birdreport.cn/front/taxon/search"
OUT_PATH = Path(__file__).resolve().parents[1] / "raw" / "taxon_list.json"

HEADERS = {
    "Accept": "*/*",
    "Accept-Language": "zh-CN,zh;q=0.9",
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    "Origin": "https://www.birdreport.cn",
    "Referer": "https://www.birdreport.cn/",
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    ),
}


def main() -> None:
    resp = requests.post(API_URL, headers=HEADERS, timeout=30)
    print(f"status: {resp.status_code}")
    body = resp.json()
    count = body.get("count", 0)
    data = body.get("data", [])
    print(f"count: {count}, len(data): {len(data) if hasattr(data, '__len__') else '?'}")
    if isinstance(data, list) and data:
        print(f"sample: {json.dumps(data[0], ensure_ascii=False)}")
        OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
        OUT_PATH.write_text(
            json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        print(f"wrote {len(data)} taxa -> {OUT_PATH}")
    else:
        print(f"unexpected body: {json.dumps(body, ensure_ascii=False)[:400]}")


if __name__ == "__main__":
    main()
