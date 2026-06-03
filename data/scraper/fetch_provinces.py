"""Fetch the 36-province summary from birdreport.cn (cleartext endpoint, no signing).

The endpoint is unsigned, but birdreport's front gate rejects requests
that don't look browser-issued ("Bad request, the server has rejected it!"
returned for bare Content-Type-only POSTs). Sending the same headers the
real frontend sends gets through.
"""
from __future__ import annotations

import json
from pathlib import Path

import requests

API_URL = "https://api.birdreport.cn/front/province/summary/chart"
OUT_PATH = Path(__file__).resolve().parents[1] / "raw" / "provinces_summary.json"

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


def fetch() -> list[dict]:
    resp = requests.post(
        API_URL, json={"version": "CH4"}, headers=HEADERS, timeout=15
    )
    resp.raise_for_status()
    data = resp.json()
    if not isinstance(data, list):
        raise RuntimeError(f"unexpected response shape: {type(data).__name__}: {data!r}")
    return data


def main() -> None:
    data = fetch()
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {len(data)} provinces -> {OUT_PATH}")


if __name__ == "__main__":
    main()
