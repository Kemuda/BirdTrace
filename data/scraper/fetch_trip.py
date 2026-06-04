"""Trip-targeted scraper for the 2026-06 云南+西藏 itinerary MVP.

Unlike fetch_checklists.py (which sweeps a whole province blindly), this
targets exactly the places the June trip visits, prioritising June data:

  Phase 1  西藏 checklists — the province is 0-coverage in our DB. Fetch
           June 2025 first (trip month), then a recent all-time sweep so
           remote Ngari (玛旁雍错/扎达/仲巴) gets whatever the source has.
  Phase 2  Targeted observations — the captcha-heavy part. Fetch per-report
           species lists for: (a) 云南 trip-district reports in May–July
           (June first), (b) every 西藏 report just pulled in Phase 1.

The captcha gate (code 505/405) is handled by sleeping ~10 min and RETRYING
the same request, so a single background run grinds through everything across
many cooldown cycles. Idempotent: existing obs files are skipped, so re-runs
resume. Bounded by a wall-clock deadline so it can't run forever.
"""
from __future__ import annotations

import asyncio
import json
import sqlite3
import time
from pathlib import Path

from birdreport_client import BirdReportClient, BirdReportError

BASE = Path("/Users/amberdrolma/Documents/Claude_Code/BirdTrace/data")
DB_PATH = BASE / "db" / "birdreport.sqlite"
CHK_DIR = BASE / "raw" / "checklists"
OBS_DIR = BASE / "raw" / "observations"

COOLDOWN = 600          # seconds to wait after a captcha 505 before retrying
MAX_COOLDOWNS = 14      # give up a single request after this many cooldowns
DEADLINE = time.time() + 3 * 3600   # hard wall-clock stop (3h)

# 云南 trip stops -> (city, districts). Sorted so June reports here get obs first.
YN_TRIP = [
    ("丽江市", ("玉龙纳西族自治县", "古城区")),                 # 玉龙雪山/云杉坪/束河/蓝月谷/古城
    ("迪庆藏族自治州", ("香格里拉市", "德钦县", "维西傈僳族自治县")),  # 独克宗/松赞林寺/普达措/虎跳峡/梅里/雾浓顶
]


def log(msg: str) -> None:
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def _records(payload):
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict) and isinstance(payload.get("data"), list):
        return payload["data"]
    return []


async def req_with_retry(make_coro, label: str):
    """Run one request; on captcha 505/405 sleep COOLDOWN and retry the SAME
    request. Returns None if we exhaust cooldowns or pass the deadline."""
    cd = 0
    while True:
        if time.time() > DEADLINE:
            log(f"  deadline reached, skipping {label}")
            return None
        try:
            return await make_coro()
        except BirdReportError as e:
            if e.code in (505, 405) and cd < MAX_COOLDOWNS:
                cd += 1
                log(f"  captcha on {label} → 冷却 {COOLDOWN}s ({cd}/{MAX_COOLDOWNS})")
                await asyncio.sleep(COOLDOWN)
                continue
            log(f"  give up {label}: {e}")
            return None


async def phase1_tibet_checklists(client) -> list[str]:
    """Fetch 西藏 checklists (June first, then recent sweep). Returns report_ids."""
    out_dir = CHK_DIR / "西藏"
    out_dir.mkdir(parents=True, exist_ok=True)
    report_ids: list[str] = []
    sweeps = [("2025-06-01", "2025-06-30", "2025-06"), ("", "", "recent")]
    for start, end, tag in sweeps:
        log(f"Phase1 西藏 {tag}: 抓 checklist")
        for page in range(1, 13):
            r = await req_with_retry(
                lambda p=page: client.search_checklists("西藏", start=start, end=end, page=p, limit=50),
                f"西藏 {tag} p{page}",
            )
            if r is None:
                break
            recs = _records(r)
            if not recs:
                log(f"  {tag} 到 page{page} 空，停")
                break
            (out_dir / f"{tag}_{page:04d}.json").write_text(
                json.dumps(r, ensure_ascii=False, indent=2), encoding="utf-8"
            )
            for rec in recs:
                rid = rec.get("reportId") or rec.get("report_id")
                if rid:
                    report_ids.append(rid)
            log(f"  {tag} page{page}: {len(recs)} 条")
            if len(recs) < 50:
                break
            await asyncio.sleep(1.5)
    # dedupe, keep order
    seen, uniq = set(), []
    for rid in report_ids:
        if rid not in seen:
            seen.add(rid); uniq.append(rid)
    log(f"Phase1 done: 西藏 {len(uniq)} 个唯一报告")
    return uniq


def yn_trip_report_ids() -> list[str]:
    """云南 trip-district report_ids in May–July, June first."""
    if not DB_PATH.exists():
        return []
    conn = sqlite3.connect(DB_PATH)
    ids: list[str] = []
    for city, districts in YN_TRIP:
        # NB: build the IN-clause by concatenation, NOT %-formatting — the SQL
        # contains strftime('%m', …) and `% (...)` would choke on '%m'.
        placeholders = ",".join("?" * len(districts))
        q = (
            "SELECT report_id, strftime('%m', start_time) AS m FROM checklists "
            "WHERE province='云南' AND city=? AND district IN (" + placeholders + ") "
            "AND strftime('%m', start_time) IN ('05','06','07') "
            "ORDER BY (m='06') DESC, m"
        )
        for row in conn.execute(q, (city, *districts)):
            ids.append(row[0])
    conn.close()
    return ids


async def phase2_observations(client, tibet_ids: list[str]) -> None:
    OBS_DIR.mkdir(parents=True, exist_ok=True)
    # 云南 trip June-first, then all 西藏
    targets = yn_trip_report_ids() + tibet_ids
    seen, ordered = set(), []
    for rid in targets:
        if rid not in seen:
            seen.add(rid); ordered.append(rid)
    todo = [r for r in ordered if not (OBS_DIR / f"{r}.json").exists()]
    log(f"Phase2 observations: {len(ordered)} 目标，其中 {len(todo)} 个待抓")
    fetched = 0
    for rid in todo:
        if time.time() > DEADLINE:
            log("Phase2 deadline reached, stopping")
            break
        data = await req_with_retry(lambda r=rid: client.get_observations(r), f"obs {rid[:8]}")
        if data is None:
            continue
        (OBS_DIR / f"{rid}.json").write_text(
            json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        fetched += 1
        if fetched % 10 == 0:
            log(f"  obs fetched={fetched}/{len(todo)}")
        await asyncio.sleep(3.0)
    log(f"Phase2 done: 本轮抓 {fetched} 份 observation")


async def main() -> None:
    log("=== trip-targeted fetch 开始 ===")
    async with BirdReportClient() as client:
        tibet_ids = await phase1_tibet_checklists(client)
        await phase2_observations(client, tibet_ids)
    log("=== 全部完成 ===")


if __name__ == "__main__":
    asyncio.run(main())
