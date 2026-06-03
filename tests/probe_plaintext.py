"""Probe birdreport.cn's plaintext endpoint — no auth, no crypto.

If this works, the server is alive and at least some surface is usable
even when /front/record/activity/search is dead.
"""

import json

import httpx


def main():
    url = "https://api.birdreport.cn/front/province/summary/chart"
    headers = {"Content-Type": "application/json"}
    body = {"version": "CH4"}

    resp = httpx.post(url, headers=headers, json=body, timeout=30)
    print(f"status: {resp.status_code}")
    print(f"body head: {resp.text[:600]}")

    if resp.status_code == 200:
        data = resp.json()
        if isinstance(data, list):
            print(f"got {len(data)} provinces")
            print(f"sample: {json.dumps(data[0], ensure_ascii=False)}")


if __name__ == "__main__":
    main()
