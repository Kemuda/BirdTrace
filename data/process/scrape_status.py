"""Emit a live scrape-progress file the frontend can poll.

Parses the fetch_trip.py log (default /tmp/birdtrace_scrape.log) + counts the
observation files on disk, and writes frontend/public/data/scrape_status.json:
how many species-detail reports have been backfilled, whether the scraper is
still alive, and whether it's *stalled* (stuck repeatedly on the captcha gate /
no progress for a while) so Amber knows when to look.

NB: the 505/captcha gate is auto-recovered by switching sessions (per-session,
not per-IP) — a human solving it does NOT help. So we surface "stalled", not
"please solve a captcha". Run once, or loop:  while :; do python3 scrape_status.py; sleep 15; done
"""
from __future__ import annotations

import json
import re
import subprocess
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LOG = Path("/tmp/birdtrace_scrape.log")
OBS_DIR = ROOT / "data" / "raw" / "observations"
OUT = ROOT / "frontend" / "public" / "data" / "scrape_status.json"

TS = re.compile(r"^\[(\d{2}):(\d{2}):(\d{2})\]")
STALL_SECONDS = 360   # no new log line for this long (and not done) -> stalled


def _secs(h: int, m: int, s: int) -> int:
    return h * 3600 + m * 60 + s


def main() -> None:
    lines = LOG.read_text(encoding="utf-8").splitlines() if LOG.exists() else []

    target_total = session_todo = session_fetched = 0
    captcha_events = 0
    consecutive_captcha = 0   # trailing run stuck on the gate without a success
    last_ts = None
    done = False

    for ln in lines:
        m = TS.match(ln)
        if m:
            last_ts = _secs(int(m[1]), int(m[2]), int(m[3]))
        mt = re.search(r"Phase2 observations:\s*(\d+)\s*目标.*?(\d+)\s*个待抓", ln)
        if mt:
            target_total, session_todo = int(mt[1]), int(mt[2])
        mf = re.search(r"obs fetched=(\d+)/(\d+)", ln)
        if mf:
            session_fetched = int(mf[1])
            consecutive_captcha = 0
        md = re.search(r"Phase2 done:.*?(\d+)\s*份", ln)
        if md:
            session_fetched = max(session_fetched, int(md[1]))
        if "captcha on" in ln:
            captcha_events += 1
            consecutive_captcha += 1
        elif "obs " in ln or "fetched=" in ln:
            consecutive_captcha = 0
        if "=== 全部完成 ===" in ln or "deadline reached" in ln:
            done = True

    obs_files = len(list(OBS_DIR.glob("*.json"))) if OBS_DIR.exists() else 0
    baseline = max(target_total - session_todo, 0)      # detail we already had
    have_total = baseline + session_fetched

    # process still alive?
    try:
        running = bool(subprocess.run(
            ["pgrep", "-f", "fetch_trip.py"], capture_output=True
        ).stdout.strip())
    except Exception:
        running = False

    # stalled: alive but no log movement for a while, or stuck on the gate
    now = time.localtime()
    now_s = _secs(now.tm_hour, now.tm_min, now.tm_sec)
    idle = (now_s - last_ts) if (last_ts is not None and now_s >= last_ts) else 0
    stalled = running and not done and (idle > STALL_SECONDS or consecutive_captcha >= 25)

    status = {
        "updated_at": time.strftime("%H:%M:%S"),
        "running": running,
        "done": done,
        "session_fetched": session_fetched,
        "session_todo": session_todo,
        "have_total": have_total,
        "target_total": target_total,
        "obs_files": obs_files,
        "captcha_events": captcha_events,
        "consecutive_captcha": consecutive_captcha,
        "stalled": stalled,
        "idle_seconds": idle,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(status, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(status, ensure_ascii=False))


if __name__ == "__main__":
    main()
