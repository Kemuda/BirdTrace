"""Stage-2 checklist scraper using Playwright.

Per PRD §阶段二, the cleanest way to bypass the encrypted-response problem
is to ride the page's own JS: navigate to birdreport.cn while logged in,
hit the API from the page context, and let the site's JS decrypt the
response before we read it back. The encryption keys never leave the
browser; we just observe the post-decryption data.

Three subcommands:

  login           Open a real browser, let the user sign in by hand, then
                  persist cookies/localStorage to AUTH_STATE so subsequent
                  runs can skip the login step.

  fetch           Headless run using the saved AUTH_STATE. Iterates over
                  checklist pages for a province and saves each decrypted
                  response to data/raw/checklists/<province>/<page>.json.

  observations    Walks the saved checklist pages, extracts every report_id,
                  and calls /front/activity/taxon for each one. Saves the
                  decrypted observation list to
                  data/raw/observations/<report_id>.json. This is the
                  per-report species list the bar chart query needs.

The exact in-page selector / function used to call the API is intentionally
left as a TODO — it depends on the live site structure and needs to be
verified interactively (open devtools, find the global the page uses to
issue signed requests, e.g. window.requestApi or similar, and call it via
page.evaluate). When the structure is confirmed, fill in CALL_API_JS.
"""
from __future__ import annotations

import argparse
import asyncio
import json
from pathlib import Path
from typing import Any, Iterable

try:
    from playwright.async_api import Page, async_playwright
except ImportError as e:  # pragma: no cover - import guard
    raise SystemExit(
        "playwright not installed. Run:\n"
        "    pip install playwright\n"
        "    playwright install chromium"
    ) from e

ROOT = Path(__file__).resolve().parents[1]
AUTH_STATE = ROOT / "raw" / "auth_state.json"
CHECKLISTS_DIR = ROOT / "raw" / "checklists"
OBSERVATIONS_DIR = ROOT / "raw" / "observations"
SITE_URL = "https://www.birdreport.cn/"

# TODO(verify-in-devtools): replace the stub below once the page's request
# helper is identified. Expected shape: returns the same plaintext payload
# the page UI consumes (i.e. already AES-decrypted).
CALL_API_JS = """
async ({ path, body }) => {
    const url = "https://api.birdreport.cn" + path;
    // Placeholder: the real implementation must reuse the page's own
    // signed-fetch helper so the response is decrypted by site JS.
    // Example, if window has a helper exposed:
    //   return await window.__signedPost(url, body);
    throw new Error("CALL_API_JS not yet wired to the page's signed-fetch helper");
}
"""


async def call_api(page: Page, path: str, body: dict[str, Any]) -> Any:
    return await page.evaluate(CALL_API_JS, {"path": path, "body": body})


async def cmd_login(headless: bool = False) -> None:
    AUTH_STATE.parent.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=headless)
        context = await browser.new_context()
        page = await context.new_page()
        await page.goto(SITE_URL)
        print("Sign in via the opened browser window, then press <Enter> here...")
        await asyncio.get_event_loop().run_in_executor(None, input)
        await context.storage_state(path=str(AUTH_STATE))
        print(f"saved auth state -> {AUTH_STATE}")
        await browser.close()


def _require_auth() -> None:
    if not AUTH_STATE.exists():
        raise SystemExit(f"{AUTH_STATE} missing — run with `login` first")


async def cmd_fetch(province: str, start: str, end: str, max_pages: int) -> None:
    _require_auth()
    out_dir = CHECKLISTS_DIR / province
    out_dir.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(storage_state=str(AUTH_STATE))
        page = await context.new_page()
        await page.goto(SITE_URL)
        try:
            for page_num in range(1, max_pages + 1):
                print(f"  {province} page {page_num}...")
                body = {
                    "province": province,
                    "startTime": start,
                    "endTime": end,
                    "page": page_num,
                    "limit": 100,
                }
                data = await call_api(page, "/front/record/activity/search", body)
                if not data or not _records_of(data):
                    print(f"  done at page {page_num} (empty response)")
                    break
                out_path = out_dir / f"{page_num:04d}.json"
                out_path.write_text(
                    json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
                )
                await asyncio.sleep(1.5)
        finally:
            await browser.close()


def _records_of(payload: Any) -> list[dict]:
    """Tolerate either `[...]` or `{"data": [...]}` shapes from the decrypted JSON."""
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        inner = payload.get("data")
        if isinstance(inner, list):
            return inner
    return []


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


async def cmd_observations(skip_existing: bool) -> None:
    _require_auth()
    OBSERVATIONS_DIR.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(storage_state=str(AUTH_STATE))
        page = await context.new_page()
        await page.goto(SITE_URL)
        try:
            for rid in _iter_report_ids():
                out_path = OBSERVATIONS_DIR / f"{rid}.json"
                if skip_existing and out_path.exists():
                    continue
                print(f"  {rid}...")
                data = await call_api(page, "/front/activity/taxon", {"reportId": rid})
                if not data:
                    print(f"  empty for {rid}, skipping")
                    continue
                out_path.write_text(
                    json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
                )
                await asyncio.sleep(1.0)
        finally:
            await browser.close()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="cmd", required=True)

    sub.add_parser("login", help="interactive login + save storage_state")

    fetch = sub.add_parser("fetch", help="fetch checklists for one province")
    fetch.add_argument("--province", required=True)
    fetch.add_argument("--start", default="2024-01-01")
    fetch.add_argument("--end", default="2024-12-31")
    fetch.add_argument("--max-pages", type=int, default=200)

    obs = sub.add_parser(
        "observations",
        help="fetch per-report species lists for every saved checklist",
    )
    obs.add_argument(
        "--refresh", action="store_true",
        help="re-fetch observations even if a file already exists",
    )

    args = parser.parse_args()
    if args.cmd == "login":
        asyncio.run(cmd_login())
    elif args.cmd == "fetch":
        asyncio.run(cmd_fetch(args.province, args.start, args.end, args.max_pages))
    elif args.cmd == "observations":
        asyncio.run(cmd_observations(skip_existing=not args.refresh))


if __name__ == "__main__":
    main()
