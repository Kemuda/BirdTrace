"""Build a 'seen' seed from an eBird CSV so BirdTrace auto-marks 已见过 on load.

The in-app「导入 eBird CSV」does the same thing in the browser, but the marks live
in YOUR browser's localStorage — handing the CSV to the agent doesn't populate it.
This writes frontend/public/data/marks_seed.json = {中文名: {seen: true}}, which the
frontend merges once on first load (per-browser flag), so the list shows without
clicking import. Re-run with a fuller Life List CSV anytime to refresh the seed.

Matching = eBird Common Name (中文) with Scientific Name bridged to birdreport 中文名
(data/raw → frontend/public/data/ebird_sci_to_cn.json) as fallback.

Usage:
    python3 data/process/build_marks_seed.py [path/to/ebird.csv]
    (default: ~/Downloads/ebird_world_year_list.csv)
"""
from __future__ import annotations

import csv
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = ROOT / "frontend" / "public" / "data"
BRIDGE = OUT_DIR / "ebird_sci_to_cn.json"
DEFAULT_CSV = Path.home() / "Downloads" / "ebird_world_year_list.csv"


def main() -> None:
    csv_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_CSV
    if not csv_path.exists():
        print(f"CSV not found: {csv_path}")
        return
    bridge = json.loads(BRIDGE.read_text(encoding="utf-8")) if BRIDGE.exists() else {}

    seed: dict[str, dict] = {}
    rows = 0
    with csv_path.open(encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            rows += 1
            common = (row.get("Common Name") or "").strip()
            sci = (row.get("Scientific Name") or "").strip()
            name = bridge.get(sci) or common  # 学名兜底对齐 birdreport 中文名
            if name:
                seed[name] = {"seen": True}

    dst = OUT_DIR / "marks_seed.json"
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_text(json.dumps(seed, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {dst}: {len(seed)} 种 seen（CSV {rows} 行）来源 {csv_path.name}")


if __name__ == "__main__":
    main()
