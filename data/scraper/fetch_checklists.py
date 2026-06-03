"""Fetch checklists (and their per-report observations) directly via HTTPS.

Replaces the earlier Playwright stub. The crypto layer is in
`birdreport_client.py`; this script is just the orchestration around it.

  checklists     Page through /front/record/activity/search for a province.
                 Writes data/raw/checklists/<province>/<page>.json (each file
                 is the decrypted list of checklist records for that page).

  observations   Walk every saved checklist file, dedupe report IDs, fetch
                 each one's per-report species list via /front/activity/taxon.
                 Writes data/raw/observations/<report_id>.json.

Rate-limited at ~1 req/s by default to stay friendly. Re-runs are idempotent:
each page or report rewrites its own file.

Examples:
    python data/scraper/fetch_checklists.py checklists --province 云南 --max-pages 5
    python data/scraper/fetch_checklists.py observations
"""
from __future__ import annotations

import argparse
import asyncio
import json
from pathlib import Path
from typing import Any, Iterable

from birdreport_client import BirdReportClient, BirdReportError

ROOT = Path(__file__).resolve().parents[1]
CHECKLISTS_DIR = ROOT / "raw" / "checklists"
OBSERVATIONS_DIR = ROOT / "raw" / "observations"


def _records_of(payload: Any) -> list[dict]:
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        inner = payload.get("data")
        if isinstance(inner, list):
            return inner
    return []


def _write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


async def cmd_checklists(
    province: str, start: str, end: str, max_pages: int, limit: int, sleep_s: float
) -> None:
    out_dir = CHECKLISTS_DIR / province
    total = 0
    async with BirdReportClient() as client:
        for page in range(1, max_pages + 1):
            print(f"  {province} page {page}...")
            try:
                data = await client.search_checklists(
                    province=province, start=start, end=end, page=page, limit=limit
                )
            except BirdReportError as e:
                print(f"  stop: {e}")
                return
            records = _records_of(data)
            if not records:
                print(f"  done at page {page} (empty)")
                return
            _write_json(out_dir / f"{page:04d}.json", data)
            total += len(records)
            print(f"    saved {len(records)} checklists (running total: {total})")
            if len(records) < limit:
                print(f"  done at page {page} (short page)")
                return
            await asyncio.sleep(sleep_s)


def _iter_report_ids() -> Iterable[str]:
    seen: set[str] = set()
    for path in sorted(CHECKLISTS_DIR.rglob("*.json")):
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except Exception as e:
            print(f"  skip {path}: {e}")
            continue
        for rec in _records_of(payload):
            rid = rec.get("reportId") or rec.get("report_id")
            if rid and rid not in seen:
                seen.add(rid)
                yield rid


async def cmd_observations(skip_existing: bool, sleep_s: float) -> None:
    OBSERVATIONS_DIR.mkdir(parents=True, exist_ok=True)
    fetched = 0
    skipped = 0
    failed = 0
    async with BirdReportClient() as client:
        for rid in _iter_report_ids():
            out_path = OBSERVATIONS_DIR / f"{rid}.json"
            if skip_existing and out_path.exists():
                skipped += 1
                continue
            try:
                data = await client.get_observations(rid)
            except BirdReportError as e:
                # 505/405 = anti-bot captcha gate. The page JS bails out
                # the same way; we stop and let the user resume later.
                # Re-running with skip_existing=True picks up where we left off.
                if e.code in (505, 405):
                    print(
                        f"  hit captcha gate at {rid} (code={e.code}). Stopping. "
                        f"Wait a bit, then re-run — already-fetched files are skipped."
                    )
                    break
                print(f"  fail {rid}: {e}")
                failed += 1
                continue
            _write_json(out_path, data)
            fetched += 1
            n_species = len(_records_of(data))
            print(f"  ok  {rid} ({n_species} taxa, total fetched={fetched})")
            await asyncio.sleep(sleep_s)
    print(f"observations: fetched={fetched} skipped={skipped} failed={failed}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    sub = parser.add_subparsers(dest="cmd", required=True)

    chk = sub.add_parser("checklists", help="fetch checklist pages for one province")
    chk.add_argument("--province", required=True)
    chk.add_argument("--start", default="")
    chk.add_argument("--end", default="")
    chk.add_argument("--max-pages", type=int, default=200)
    chk.add_argument("--limit", type=int, default=50)
    chk.add_argument("--sleep", type=float, default=1.5)

    obs = sub.add_parser(
        "observations", help="fetch per-report species lists for every saved checklist"
    )
    obs.add_argument(
        "--refresh", action="store_true",
        help="re-fetch observations even when a file already exists",
    )
    obs.add_argument("--sleep", type=float, default=2.5,
                     help="seconds between requests (raise if you keep tripping the "
                          "captcha gate; default 2.5s gives ~24 req/min)")

    args = parser.parse_args()
    if args.cmd == "checklists":
        asyncio.run(cmd_checklists(
            args.province, args.start, args.end, args.max_pages, args.limit, args.sleep
        ))
    elif args.cmd == "observations":
        asyncio.run(cmd_observations(
            skip_existing=not args.refresh, sleep_s=args.sleep
        ))


if __name__ == "__main__":
    main()
