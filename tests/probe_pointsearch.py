"""Probe: which filter fields does /front/record/activity/search accept?

The page's captured request is province + all-time only (count≈69864 云南 全量).
We want to pull 虎跳峡 cheaply. Test whether the `where` narrows on:
  - district / district_name  (虎跳峡 在 香格里拉市 & 玉龙县)
  - city / city_name
  - pointname / point_name    (direct point filter, ideal)
For each, report total `count` (server-side filtered total) + whether the
returned page is actually narrowed. count≈69864 ⇒ field ignored.

Usage:  cd tests && python3 probe_pointsearch.py
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "data" / "scraper"))
from birdreport_client import BirdReportClient, BirdReportError

BASE = {"province": "云南", "startTime": "", "endTime": "", "version": "CH4",
        "page": 1, "limit": 20}

TRIALS = [
    ("baseline 无过滤", {}),
    ("district=香格里拉市", {"district": "香格里拉市"}),
    ("district_name=香格里拉市", {"district_name": "香格里拉市"}),
    ("city=迪庆藏族自治州", {"city": "迪庆藏族自治州"}),
    ("pointname=虎跳峡", {"pointname": "虎跳峡"}),
    ("point_name=虎跳峡", {"point_name": "虎跳峡"}),
    ("keyword=虎跳峡", {"keyword": "虎跳峡"}),
]


async def call(client, extra):
    params = {**BASE, **extra}
    cd = 0
    while True:
        try:
            # use the raw envelope so we can read `count`
            return await client.post_raw("/front/record/activity/search", params)
        except BirdReportError as e:
            if e.code in (505, 405) and cd < 5:
                cd += 1
                await client.reset()
                await asyncio.sleep(6)
                continue
            return {"error": str(e)}


async def main():
    async with BirdReportClient() as client:
        for label, extra in TRIALS:
            r = await call(client, extra)
            if "error" in r:
                print(f"\n[{label}] 失败: {r['error']}")
                continue
            count = r.get("count")
            recs = r.get("_records", [])
            pts = [x.get("point_name", "") for x in recs]
            hit = sum(1 for p in pts if "虎跳峡" in p)
            print(f"\n[{label}] count={count}  本页{len(recs)}条 含虎跳峡{hit}")
            print("  样例:", pts[:5])
            await asyncio.sleep(2)


if __name__ == "__main__":
    asyncio.run(main())
