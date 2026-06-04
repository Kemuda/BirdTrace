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
import json
import sqlite3
import time
from pathlib import Path

import httpx
from birdreport_client import BirdReportClient, BirdReportError

BASE = Path(__file__).resolve().parents[1]
DB_PATH = BASE / "db" / "birdreport.sqlite"
STATUS_OUT = BASE.parent / "frontend" / "public" / "data" / "coords_status.json"
COOLDOWN = 8
MAX_COOLDOWNS = 40
NET_RETRIES = 4        # 网络抖动(超时/连接错)重试几次再跳过，别整个崩


def log(m: str) -> None:
    print(f"[{time.strftime('%H:%M:%S')}] {m}", flush=True)


def write_status(*, fetched, total, captcha, consec, last_progress, done) -> None:
    """写 frontend/public/data/coords_status.json，schema 与 scrape_status.json
    一致，让前端同一个进度条组件直接复用。卡住(stalled)= 连撞验证码或久无进展。"""
    now = time.time()
    idle = int(now - last_progress)
    stalled = (not done) and (consec >= 25 or idle > 90)
    STATUS_OUT.parent.mkdir(parents=True, exist_ok=True)
    STATUS_OUT.write_text(json.dumps({
        "updated_at": time.strftime("%H:%M:%S"),
        "running": not done,
        "done": done,
        "session_fetched": fetched,
        "session_todo": total,
        "have_total": fetched,
        "target_total": total,
        "captcha_events": captcha,
        "consecutive_captcha": consec,
        "stalled": stalled,
        "idle_seconds": idle,
    }, ensure_ascii=False, indent=2), encoding="utf-8")


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
    """Return (data|None, captcha_hits_this_call). Handles captcha (reset+retry)
    AND network blips (timeout/transport — retry then skip, never crash the run)."""
    cd = net = captcha = 0
    while True:
        try:
            d = await client.post("/front/activity/get", {"reportId": rid, "version": "CH4"})
            return d, captcha
        except BirdReportError as e:
            if e.code in (505, 405) and cd < MAX_COOLDOWNS:
                cd += 1
                captcha += 1
                log(f"  captcha {rid[:8]} → 重置会话+冷却 ({cd}/{MAX_COOLDOWNS})")
                await client.reset()
                await asyncio.sleep(COOLDOWN)
                continue
            log(f"  give up {rid[:8]}: {e}")
            return None, captcha
        except (httpx.TimeoutException, httpx.TransportError) as e:
            if net < NET_RETRIES:
                net += 1
                log(f"  网络抖动 {rid[:8]} ({type(e).__name__})，重试 {net}/{NET_RETRIES}")
                await client.reset()
                await asyncio.sleep(3)
                continue
            log(f"  网络放弃 {rid[:8]}: {type(e).__name__}")
            return None, captcha
        except Exception as e:  # 任何其它异常都跳过这一条，不整个崩
            log(f"  跳过 {rid[:8]}: {type(e).__name__}: {e}")
            return None, captcha


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

    ok = miss = captcha_total = consec = 0
    last_progress = time.time()
    total = len(targets)
    write_status(fetched=0, total=total, captcha=0, consec=0, last_progress=last_progress, done=(total == 0))
    async with BirdReportClient() as c:
        for i, rid in enumerate(targets, 1):
            d, cap = await _get(c, rid)
            captcha_total += cap
            consec = consec + cap if cap else (0 if isinstance(d, dict) else consec)
            if not isinstance(d, dict):
                miss += 1
            else:
                consec = 0
                last_progress = time.time()
                lat, lng = _parse_loc(d.get("location"))
                pid = d.get("pointId")
                conn.execute(
                    "UPDATE checklists SET lat=?, lng=?, point_id=?, address=? WHERE report_id=?",
                    (lat, lng, str(pid) if pid is not None else None, d.get("address"), rid),
                )
                ok += 1
            if i % 10 == 0:
                conn.commit()
                log(f"  {i}/{total}  ok={ok} miss={miss} captcha={captcha_total}")
            write_status(fetched=ok, total=total, captcha=captcha_total, consec=consec,
                         last_progress=last_progress, done=False)
            await asyncio.sleep(2.0)
    conn.commit()
    conn.close()
    write_status(fetched=ok, total=total, captcha=captcha_total, consec=consec,
                 last_progress=last_progress, done=True)
    log(f"完成：更新 {ok} 份坐标/pointId，失败 {miss} 份，验证码 {captcha_total} 次")


if __name__ == "__main__":
    asyncio.run(main())
