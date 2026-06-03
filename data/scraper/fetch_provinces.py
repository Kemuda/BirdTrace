"""Fetch the 36-province summary from birdreport.cn.

As of 2026-06 this used to be cleartext but now requires signing too —
the server's rejection is "无效请求，验证签名信息错误！". We route through
the same signed client as the encrypted endpoints.
"""
from __future__ import annotations

import asyncio
import json
from pathlib import Path

from birdreport_client import BirdReportClient

OUT_PATH = Path(__file__).resolve().parents[1] / "raw" / "provinces_summary.json"


async def main() -> None:
    async with BirdReportClient() as client:
        data = await client.get_provinces_summary()
    if not isinstance(data, list):
        raise RuntimeError(f"unexpected response shape: {type(data).__name__}: {data!r}")
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {len(data)} provinces -> {OUT_PATH}")


if __name__ == "__main__":
    asyncio.run(main())
