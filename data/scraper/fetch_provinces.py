"""Fetch the 36-province summary from birdreport.cn (cleartext endpoint, no signing)."""
from __future__ import annotations

import json
from pathlib import Path

import requests

API_URL = "https://api.birdreport.cn/front/province/summary/chart"
OUT_PATH = Path(__file__).resolve().parents[1] / "raw" / "provinces_summary.json"


def fetch() -> list[dict]:
    resp = requests.post(
        API_URL,
        json={"version": "CH4"},
        headers={"Content-Type": "application/json"},
        timeout=15,
    )
    resp.raise_for_status()
    data = resp.json()
    if not isinstance(data, list):
        raise RuntimeError(f"unexpected response shape: {type(data).__name__}")
    return data


def main() -> None:
    data = fetch()
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {len(data)} provinces -> {OUT_PATH}")


if __name__ == "__main__":
    main()
