"""Fetch per-report DETAIL (/front/activity/get): coordinates + pointId + address.

The list/search endpoint has none of these; only this single-report endpoint does.
`location` is "lng,lat" (GCJ-02). Captcha-walled like the taxon endpoint, so we
reset-the-session + retry on 505/405, and CAP the run (--limit) — this is meant
for sampling first, not blind full pulls.

Idempotent: updates checklists.{lat,lng,point_id,address} and skips reports that
already have a point_id. Run from the repo root.

    python3 data/scraper/fetch_report_detail.py --limit 200            # any 200 missing
    python3 data/scraper/fetch_report_detail.py --city 日喀则市 --limit 150
"""
from __future__ import annotations

import argparse
import asyncio
import sqlite3
import time
from pathlib import Path

from birdreport_client import BirdReportClient, BirdReportError

BASE = Path(__file__).resolve().parents[1]
DB_PATH = BASE / "db" / "birdreport.sqlite"
COOLDOWN = 8
MAX_COOLDOWNS = 40


def log(m: str) -> None:
    print(f"[{time.strftime('%H:%M:%S')}] {m}", flush=True)


def _targets(conn, province, cities, limit):
    q = "SELECT report_id FROM checklists WHERE point_id IS NULL"
    params: list = []
    if province:
        q += " AND province = ?"; params.append(province)
    if cities:  # 逗号分隔的城市/地区列表（行程沿线），city IN (...)
        ph = ",".join("?" * len(cities))
        q += f" AND city IN ({ph})"; params.extend(cities)
    q += " ORDER BY start_time DESC LIMIT ?"; params.append(limit)
    return [r[0] for r in conn.execute(q, params)]


def _parse_loc(location: str | None):
    """'lng,lat' (GCJ-02) -> (lat, lng) floats, or (None, None)."""
    if not location or "," not in location:
        return None, None
    try:
        lng, lat = (float(x) for x in location.split(",", 1))
        return lat, lng
    except ValueError:
        return None, None


async def _get(client, rid):
    cd = 0
    while True:
        try:
            return await client.post("/front/activity/get", {"reportId": rid, "version": "CH4"})
        except BirdReportError as e:
            if e.code in (505, 405) and cd < MAX_COOLDOWNS:
                cd += 1
                await client.reset()
                await asyncio.sleep(COOLDOWN)
                continue
            log(f"  give up {rid[:8]}: {e}")
            return None


async def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--province")
    ap.add_argument("--city", help="城市/地区，可逗号分隔多个（如 拉萨市,日喀则市,阿里地区）")
    ap.add_argument("--limit", type=int, default=200)
    args = ap.parse_args()

    cities = [c.strip() for c in args.city.split(",")] if args.city else []
    conn = sqlite3.connect(DB_PATH)
    targets = _targets(conn, args.province, cities, args.limit)
    log(f"待抓详情 {len(targets)} 份（province={args.province} cities={cities} limit={args.limit}）")

    ok = miss = 0
    async with BirdReportClient() as c:
        for i, rid in enumerate(targets, 1):
            d = await _get(c, rid)
            if not isinstance(d, dict):
                miss += 1
                continue
            lat, lng = _parse_loc(d.get("location"))
            pid = d.get("pointId")
            conn.execute(
                "UPDATE checklists SET lat=?, lng=?, point_id=?, address=? WHERE report_id=?",
                (lat, lng, str(pid) if pid is not None else None, d.get("address"), rid),
            )
            ok += 1
            if i % 20 == 0:
                conn.commit()
                log(f"  {i}/{len(targets)}  ok={ok} miss={miss}")
            await asyncio.sleep(2.0)
    conn.commit()
    conn.close()
    log(f"完成：更新 {ok} 份坐标/pointId，失败 {miss} 份")


if __name__ == "__main__":
    asyncio.run(main())
