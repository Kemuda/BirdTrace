"""Probe /front/activity/get and /front/record/activity/summary.

Looking for coordinate fields (lat/lng/point_x/point_y/baidu etc.)
that are absent from the checklist list endpoint.

Usage:
    cd tests
    python3 probe_activity.py
"""
import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "data" / "scraper"))
from birdreport_client import BirdReportClient

# From probe_yunnan.py output — a real report we know exists
REPORT_ID = "06645e63-c16c-4173-b7d2-e6c9c81f2467"
SERIAL_ID = "2026060400450"


async def probe(client, path, params, label):
    print(f"\n{'='*60}")
    print(f"  {label}")
    print(f"  {path}  params={params}")
    print("=" * 60)
    try:
        r = await client.post(path, params)
        if isinstance(r, dict):
            print(f"keys: {sorted(r.keys())}")
            # Highlight anything that looks like a coordinate
            coord_hints = [k for k in r if any(
                hint in k.lower() for hint in
                ["lat", "lng", "lon", "point", "x", "y", "coord", "map", "geo", "location", "baidu", "bd", "gcj"]
            )]
            if coord_hints:
                print(f"*** COORD-LIKE KEYS: {coord_hints} ***")
            print(json.dumps(r, ensure_ascii=False, indent=2)[:2000])
        elif isinstance(r, list):
            print(f"list of {len(r)} items")
            if r:
                sample = r[0]
                print(f"first item keys: {sorted(sample.keys()) if isinstance(sample, dict) else type(sample)}")
                if isinstance(sample, dict):
                    coord_hints = [k for k in sample if any(
                        hint in k.lower() for hint in
                        ["lat", "lng", "lon", "point", "x", "y", "coord", "map", "geo", "location", "baidu", "bd", "gcj"]
                    )]
                    if coord_hints:
                        print(f"*** COORD-LIKE KEYS: {coord_hints} ***")
                print(json.dumps(r[0], ensure_ascii=False, indent=2)[:2000])
        else:
            print(f"response type: {type(r)}")
            print(str(r)[:2000])
    except Exception as e:
        print(f"FAIL: {e}")


async def main():
    async with BirdReportClient() as client:
        await probe(client, "/front/activity/get",
                    {"reportId": REPORT_ID, "version": "CH4"},
                    "activity/get — single report detail (by reportId)")

        await probe(client, "/front/activity/get",
                    {"id": SERIAL_ID, "version": "CH4"},
                    "activity/get — single report detail (by serial id)")

        await probe(client, "/front/record/activity/summary",
                    {"reportId": REPORT_ID, "version": "CH4"},
                    "record/activity/summary (by reportId)")

        await probe(client, "/front/activity/visits",
                    {"reportId": REPORT_ID, "version": "CH4"},
                    "activity/visits")


asyncio.run(main())
