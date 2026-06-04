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

BASE = Path(__file__).resolve().parents[1]   # data/scraper/ -> data/
DB_PATH = BASE / "db" / "birdreport.sqlite"
CHK_DIR = BASE / "raw" / "checklists"
OBS_DIR = BASE / "raw" / "observations"

COOLDOWN = 8            # 505 flags the session, not the IP — we reset the client
                        # (fresh session) and retry quickly, no long sleep needed.
MAX_COOLDOWNS = 40      # give up a single request after this many resets
DEADLINE = time.time() + 3 * 3600   # hard wall-clock stop (3h)
PAGE_LIMIT = 50         # records/page; a page shorter than this is the sweep's end

# 云南 trip stops -> (city, districts). Sorted so June reports here get obs first.
YN_TRIP = [
    ("丽江市", ("玉龙纳西族自治县", "古城区")),                 # 玉龙雪山/云杉坪/束河/蓝月谷/古城
    ("迪庆藏族自治州", ("香格里拉市", "德钦县", "维西傈僳族自治县")),  # 独克宗/松赞林寺/普达措/虎跳峡/梅里/雾浓顶
]

# 行程区 district_name 集合，用来从「全云南 6 月」里筛出行程停留点的报告。
TRIP_DISTRICTS = {"玉龙纳西族自治县", "古城区", "香格里拉市", "德钦县", "维西傈僳族自治县"}

# 关键修正（Amber 2026-06-04）：之前云南「6 月」其实是 2026 年 6 月头几天（今天才
# 6/4），样本太薄、不能代表整个 6 月。改抓**历史同期**整月 June，和西藏口径对齐。
# search API 只能按省+日期筛（无区县），所以抓全云南 6 月、再按 TRIP_DISTRICTS 筛。
YN_JUNE_SWEEPS = [
    ("2025-06-01", "2025-06-30", "2025-06"),
    ("2024-06-01", "2024-06-30", "2024-06"),
]


def log(msg: str) -> None:
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def _records(payload):
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict) and isinstance(payload.get("data"), list):
        return payload["data"]
    return []


async def req_with_retry(client, make_coro, label: str):
    """Run one request; on captcha 505/405 RESET the client (fresh session —
    the block is per-session, not per-IP) then retry. Returns None if we exhaust
    resets or pass the deadline."""
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
                log(f"  captcha on {label} → 重置会话 + 冷却 {COOLDOWN}s ({cd}/{MAX_COOLDOWNS})")
                await client.reset()
                await asyncio.sleep(COOLDOWN)
                continue
            log(f"  give up {label}: {e}")
            return None


def _resume_point(pages: list[tuple[int, int]], max_pages: int) -> int | None:
    """Decide where a checklist sweep should (re)start from, given the already-
    saved pages as [(page_number, record_count), …] (any order).

    Returns the next page number to fetch, or None if the sweep is already
    complete. A sweep is complete only when its highest saved page is "short"
    (< PAGE_LIMIT → the natural terminal) or it reached `max_pages`. Otherwise
    resume just past the highest saved page — so an interrupted sweep (pages
    1..N then a captcha at N+1) continues at N+1 instead of being skipped."""
    if not pages:
        return 1
    last_page, last_count = max(pages)
    if last_count < PAGE_LIMIT or last_page >= max_pages:
        return None
    return last_page + 1


async def _sweep_checklists(client, province: str, sweeps, out_dir: Path,
                            max_pages: int, district_filter: set | None = None) -> list[str]:
    """Page a province's checklists over date `sweeps`, save raw, return report_ids.

    If `district_filter` is given, only collect ids whose `district_name` is in it
    (used to keep just the trip stops out of a whole-province sweep)."""
    out_dir.mkdir(parents=True, exist_ok=True)
    ids: list[str] = []

    def collect(recs) -> int:
        n = 0
        for rec in recs:
            rid = rec.get("reportId") or rec.get("report_id")
            if not rid:
                continue
            if district_filter is not None:
                dn = rec.get("district_name") or rec.get("district")
                if dn not in district_filter:
                    continue
            ids.append(rid)
            n += 1
        return n

    for start, end, tag in sweeps:
        # Resume, don't blindly skip: reuse already-saved pages, then continue
        # from the first MISSING page. A sweep interrupted at page N+1 (captcha /
        # deadline) left pages 1..N — we must still fetch >N, not skip the sweep
        # just because some pages exist. Only treat it as already-complete when
        # the last saved page is "short" (the natural terminal) or hit the cap.
        existing = sorted(out_dir.glob(f"{tag}_*.json"),
                          key=lambda p: int(p.stem.rsplit("_", 1)[-1]))
        kept = 0
        pages: list[tuple[int, int]] = []
        for f in existing:
            recs = _records(json.loads(f.read_text(encoding="utf-8")))
            kept += collect(recs)
            pages.append((int(f.stem.rsplit("_", 1)[-1]), len(recs)))
        start_page = _resume_point(pages, max_pages)
        if start_page is None:
            log(f"Phase1 {province} {tag}: 已抓全 {pages[-1][0]} 页，跳过（{kept} 个 id）")
            continue
        if existing:
            log(f"Phase1 {province} {tag}: 已有 {pages[-1][0]} 页，从 p{start_page} 续抓（已 {kept} id）")
        else:
            log(f"Phase1 {province} {tag}: 抓 checklist")
        for page in range(start_page, max_pages + 1):
            r = await req_with_retry(
                client,
                lambda p=page: client.search_checklists(province, start=start, end=end, page=p, limit=PAGE_LIMIT),
                f"{province} {tag} p{page}",
            )
            if r is None:   # captcha exhausted / deadline — leave the rest for next run
                log(f"  {tag} p{page} 抓不到，留待下次续抓")
                break
            recs = _records(r)
            if not recs:
                # Save the empty terminal page as a completion marker. Without this,
                # a sweep whose record count is an exact multiple of PAGE_LIMIT leaves
                # its highest *saved* page "full", so _resume_point keeps resuming at
                # this same empty page every later run — an avoidable request (and
                # possible retry/captcha spend) before Phase2 on an already-done sweep.
                (out_dir / f"{tag}_{page:04d}.json").write_text(
                    json.dumps(r, ensure_ascii=False, indent=2), encoding="utf-8"
                )
                log(f"  {tag} 到 page{page} 空，停（记空页标记）")
                break
            (out_dir / f"{tag}_{page:04d}.json").write_text(
                json.dumps(r, ensure_ascii=False, indent=2), encoding="utf-8"
            )
            kept += collect(recs)
            extra = f"（行程区累计 {kept}）" if district_filter is not None else ""
            log(f"  {tag} page{page}: {len(recs)} 条{extra}")
            if len(recs) < PAGE_LIMIT:
                break
            await asyncio.sleep(1.5)
        else:
            log(f"  {tag} 抓满 {max_pages} 页上限（可能还有更老的没抓）")
    # dedupe, keep order
    seen, uniq = set(), []
    for rid in ids:
        if rid not in seen:
            seen.add(rid); uniq.append(rid)
    return uniq


async def phase1_tibet_checklists(client) -> list[str]:
    """Fetch 西藏 checklists (June 2025 first, then recent sweep)."""
    sweeps = [("2025-06-01", "2025-06-30", "2025-06"), ("", "", "recent")]
    uniq = await _sweep_checklists(client, "西藏", sweeps, CHK_DIR / "西藏", max_pages=12)
    log(f"Phase1 done: 西藏 {len(uniq)} 个唯一报告")
    return uniq


async def phase1_yunnan_june(client) -> list[str]:
    """Fetch 云南 historical June (2025+2024), keep only trip-district reports."""
    uniq = await _sweep_checklists(
        client, "云南", YN_JUNE_SWEEPS, CHK_DIR / "云南",
        max_pages=80, district_filter=TRIP_DISTRICTS,
    )
    log(f"Phase1 done: 云南行程区历史 6 月 {len(uniq)} 个唯一报告")
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


async def phase2_observations(client, yn_june_ids: list[str], tibet_ids: list[str]) -> None:
    OBS_DIR.mkdir(parents=True, exist_ok=True)
    # 顺序：云南行程区历史 6 月（本轮新抓，尚未入库）→ DB 里已有的云南行程区 →
    # 全西藏。先 6 月历史，把招牌景点的清单优先补上。
    targets = yn_june_ids + yn_trip_report_ids() + tibet_ids
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
        data = await req_with_retry(client, lambda r=rid: client.get_observations(r), f"obs {rid[:8]}")
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
        yn_june_ids = await phase1_yunnan_june(client)
        tibet_ids = await phase1_tibet_checklists(client)
        await phase2_observations(client, yn_june_ids, tibet_ids)
    log("=== 全部完成 ===")


if __name__ == "__main__":
    asyncio.run(main())
