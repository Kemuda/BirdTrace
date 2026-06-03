"""End-to-end smoke test against birdreport.cn for Yunnan checklists.

Fetches a small page from /front/record/activity/search (the encrypted endpoint),
exercising the full RSA-sign + AES-decrypt path we plan to reuse from commonBird.

Run:
    BIRDREPORT_TOKEN=xxx python tests/test_birdreport_yunnan.py

The crypto layer (sign algorithm, RSA chunked encrypt, AES key/iv) is adapted from
commonBird (MIT, CKRainbow), which in turn descends from qBird (MIT, TaQini).
See THIRD_PARTY_NOTICES.md.
"""

import asyncio
import base64
import hashlib
import json
import os
import re
import sys
import time
import uuid
from pathlib import Path
from urllib.parse import urlencode

import httpx
from Crypto.Cipher import AES, PKCS1_v1_5
from Crypto.PublicKey import RSA
from Crypto.Util.Padding import unpad

REPO_ROOT = Path(__file__).resolve().parent.parent
PUBLIC_KEY = REPO_ROOT / "data" / "scraper" / "public_key.pem"

AES_KEY = b"C8EB5514AF5ADDB94B2207B08C66601C"
AES_IV = b"55DD79C6F04E1A67"

SEARCH_URL = "https://api.birdreport.cn/front/record/activity/search"


class LongRSAKey:
    """RSA-PKCS1v15 with chunked encryption for payloads > 117 bytes."""

    def __init__(self, pem_path: Path):
        self.key = RSA.import_key(pem_path.read_bytes())
        self.cipher = PKCS1_v1_5.new(self.key)
        self.chunk = (self.key.n.bit_length() + 7 >> 3) - 11

    def encrypt(self, text: str) -> str:
        msg = text.encode("utf-8")
        if len(msg) <= self.chunk:
            return base64.b64encode(self.cipher.encrypt(msg)).decode()
        parts = re.findall(rb".{1,%d}" % self.chunk, msg, re.DOTALL)
        ct = b"".join(self.cipher.encrypt(p) for p in parts)
        return base64.b64encode(ct).decode()


def aes_decrypt(b64_ciphertext: str) -> str:
    raw = base64.b64decode(b64_ciphertext)
    cipher = AES.new(AES_KEY, AES.MODE_CBC, iv=AES_IV)
    return unpad(cipher.decrypt(raw), AES.block_size).decode("utf-8")


def build_headers(token: str, sign: str, request_id: str, timestamp: str) -> dict:
    headers = {
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "Origin": "https://www.birdreport.cn",
        "Referer": "https://www.birdreport.cn/",
        "User-Agent": (
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
        ),
        "requestId": request_id,
        "sign": sign,
        "timestamp": timestamp,
    }
    if token and os.environ.get("BR_SEND_TOKEN", "1") != "0":
        headers["X-Auth-Token"] = token
    return headers


async def search_yunnan(token: str, start: str, end: str, page: int, limit: int):
    rsa = LongRSAKey(PUBLIC_KEY)

    province = os.environ.get("BR_PROVINCE", "云南省")
    state = os.environ.get("BR_STATE", "")

    params = {
        "page": str(page),
        "limit": str(limit),
        "taxonid": "",
        "startTime": start,
        "endTime": end,
        "province": province,
        "city": "",
        "district": "",
        "pointname": "",
        "username": "",
        "serial_id": "",
        "ctime": "",
        "taxonname": "",
        "state": state,
        "mode": "0",
        "outside_type": "0",
    }

    plaintext = urlencode(params)
    encrypted_body = rsa.encrypt(plaintext)
    request_id = uuid.uuid4().hex
    timestamp = str(int(time.time())) + "000"
    sign = hashlib.md5((plaintext + request_id + timestamp).encode()).hexdigest()
    headers = build_headers(token, sign, request_id, timestamp)

    print(f"DEBUG plaintext ({len(plaintext)} chars): {plaintext}")
    print(f"DEBUG encrypted body len: {len(encrypted_body)}")
    print(f"DEBUG sign: {sign}")
    print(f"DEBUG timestamp: {timestamp}, requestId: {request_id}")

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(SEARCH_URL, headers=headers, content=encrypted_body)

    print(f"DEBUG response status: {resp.status_code}")
    print(f"DEBUG response body: {resp.text[:1500]}")

    resp.raise_for_status()
    envelope = resp.json()
    if envelope.get("code") != 0:
        raise RuntimeError(f"API returned non-zero code: {envelope}")
    return json.loads(aes_decrypt(envelope["data"]))


async def main():
    token = os.environ.get("BIRDREPORT_TOKEN")
    if not token:
        print("ERROR: set BIRDREPORT_TOKEN env var (X-Auth-Token from DevTools).")
        sys.exit(2)

    end = time.strftime("%Y-%m-%d")
    start = time.strftime("%Y-%m-%d", time.localtime(time.time() - 30 * 86400))
    print(f"Fetching Yunnan checklists, {start} -> {end}, page=1, limit=10")

    records = await search_yunnan(token, start, end, page=1, limit=100)

    print(f"Got {len(records)} checklists.")
    if records:
        sample = records[0]
        print("Sample keys:", sorted(sample.keys()))
        print("First record:", json.dumps(sample, ensure_ascii=False, indent=2)[:1200])

    out = REPO_ROOT / "data" / "scraper" / "yunnan_sample.json"
    out.write_text(json.dumps(records, ensure_ascii=False, indent=2))
    print(f"Saved -> {out.relative_to(REPO_ROOT)}")


if __name__ == "__main__":
    asyncio.run(main())
