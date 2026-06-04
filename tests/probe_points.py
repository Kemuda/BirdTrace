"""Probe birdreport point/hotspot APIs.

pointId=5651 appeared in /front/activity/get — suggests birdreport has
an internal structured hotspot database. This script tries to find bulk
point listing or search endpoints so we can get coordinates without
fetching every individual report.

Usage:
    cd tests
    python3 probe_points.py
"""
import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "data" / "scraper"))
from birdreport_client import BirdReportClient

KNOWN_POINT_ID = 5651  # 野象谷热带雨林景区, 云南
KNOWN_REPORT_ID = "06645e63-c16c-4173-b7d2-e6c9c81f2467"


async def probe(client, path, params, label):
    print(f"\n{'='*60}")
    print(f"  {label}")
    print(f"  POST {path}")
    print("=" * 60)
    try:
        r = await client.post(path, params)
        if isinstance(r, dict):
            print(f"keys: {sorted(r.keys())}")
            print(json.dumps(r, ensure_ascii=False, indent=2)[:2000])
        elif isinstance(r, list):
            print(f"list of {len(r)} items")
            if r and isinstance(r[0], dict):
                print(f"first item keys: {sorted(r[0].keys())}")
                print(json.dumps(r[0], ensure_ascii=False, indent=2)[:1000])
        else:
            print(repr(r)[:500])
    except Exception as e:
        print(f"FAIL: {e}")


async def main():
    async with BirdReportClient() as client:
        # Try to get a single point's details by pointId
        await probe(client, "/front/point/get",
                    {"pointId": KNOWN_POINT_ID, "version": "CH4"},
                    "point/get — single point by id")

        # Try point search by province
        await probe(client, "/front/point/search",
                    {"province": "西藏", "version": "CH4", "page": 1, "limit": 20},
                    "point/search — list points in 西藏")

        # Try point search by province (alt name)
        await probe(client, "/front/point/list",
                    {"province": "西藏", "version": "CH4", "page": 1, "limit": 20},
                    "point/list — list points in 西藏")

        # Try record/point variants
        await probe(client, "/front/record/point/search",
                    {"province": "西藏", "version": "CH4", "page": 1, "limit": 20},
                    "record/point/search")

        # Maybe points are called 'location' or 'spot'
        await probe(client, "/front/location/search",
                    {"province": "西藏", "version": "CH4", "page": 1, "limit": 20},
                    "location/search")

        await probe(client, "/front/spot/search",
                    {"province": "西藏", "version": "CH4", "page": 1, "limit": 20},
                    "spot/search")

        # Try getting point info from the known point id range (probe neighbors)
        await probe(client, "/front/point/get",
                    {"pointId": 1, "version": "CH4"},
                    "point/get — pointId=1 (probe low end of id range)")


asyncio.run(main())
