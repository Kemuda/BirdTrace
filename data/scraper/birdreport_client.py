"""Async client for birdreport.cn's signed POST API.

Wire protocol (recovered from the site's own JS — see THIRD_PARTY_NOTICES.md):

  plaintext      json.dumps(params, sort_keys=True, ensure_ascii=False,
                            separators=(",", ":"))         # sorted-key JSON,
                                                           # raw UTF-8, no spaces
  body sent      RSA-PKCS1v15(plaintext), chunked at 117 bytes, base64
  sign header    md5(plaintext + request_id + timestamp_ms)
  response.data  AES-256-CBC base64, key+iv hardcoded in site JS
                 (multiple generations exist; we try each)

/front/* endpoints don't accept X-Auth-Token.
"""
from __future__ import annotations

import base64
import hashlib
import json
import re
import time
import uuid
from pathlib import Path
from typing import Any

import httpx
from Crypto.Cipher import AES, PKCS1_v1_5
from Crypto.PublicKey import RSA
from Crypto.Util.Padding import unpad

PACKAGE_DIR = Path(__file__).resolve().parent
PUBLIC_KEY_FILE = PACKAGE_DIR / "public_key.pem"
BASE_URL = "https://api.birdreport.cn"

# Each key+iv pair is the ASCII text from the site's JS, parsed as UTF-8 bytes
# (so 32 bytes / 16 bytes → AES-256-CBC). Try in order; first that decrypts wins.
AES_KEYS: list[tuple[bytes, bytes]] = [
    (b"3583ec0257e2f4c8195eec7410ff1619", b"d93c0d5ec6352f20"),
    (b"C8EB5514AF5ADDB94B2207B08C66601C", b"55DD79C6F04E1A67"),
]

DEFAULT_HEADERS: dict[str, str] = {
    "Accept": "*/*",
    "Accept-Language": "zh-CN,zh;q=0.9",
    "Connection": "keep-alive",
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    "Origin": "https://www.birdreport.cn",
    "Referer": "https://www.birdreport.cn/",
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    ),
}


class BirdReportError(RuntimeError):
    """Non-zero `code` in the response envelope, or a transport failure.

    `code` carries the server's numeric status when available so callers
    can branch on it (notably 505/405 = anti-bot captcha challenge —
    `BIRDREPORT_VISIT.codeHtml()` in the page JS).
    """

    def __init__(self, message: str, *, code: int | None = None) -> None:
        super().__init__(message)
        self.code = code


class _LongRSA:
    def __init__(self, pem_path: Path):
        self._key = RSA.import_key(pem_path.read_bytes())
        self._cipher = PKCS1_v1_5.new(self._key)
        self._chunk = (self._key.n.bit_length() + 7 >> 3) - 11

    def encrypt(self, text: str) -> str:
        msg = text.encode("utf-8")
        if len(msg) <= self._chunk:
            ct = self._cipher.encrypt(msg)
        else:
            parts = re.findall(rb".{1,%d}" % self._chunk, msg, re.DOTALL)
            ct = b"".join(self._cipher.encrypt(p) for p in parts)
        return base64.b64encode(ct).decode("ascii")


def _aes_decrypt(b64_ciphertext: str) -> str:
    raw = base64.b64decode(b64_ciphertext)
    last_err: Exception | None = None
    for key, iv in AES_KEYS:
        try:
            cipher = AES.new(key, AES.MODE_CBC, iv=iv)
            return unpad(cipher.decrypt(raw), AES.block_size).decode("utf-8")
        except (ValueError, UnicodeDecodeError) as e:
            last_err = e
    raise BirdReportError(f"AES decrypt failed with all known keys: {last_err}")


def _format_plaintext(params: dict[str, Any]) -> str:
    return json.dumps(
        params, ensure_ascii=False, separators=(",", ":"), sort_keys=True
    )


class BirdReportClient:
    """Lightweight, sequential async client. One instance per scrape run."""

    def __init__(self, http: httpx.AsyncClient | None = None) -> None:
        self._rsa = _LongRSA(PUBLIC_KEY_FILE)
        self._owns_http = http is None
        self._http = http or httpx.AsyncClient(timeout=30.0)

    async def aclose(self) -> None:
        if self._owns_http:
            await self._http.aclose()

    async def reset(self) -> None:
        """Drop the current connection pool and start a fresh session.

        birdreport's anti-bot (code 505) flags the *session/connection*, not the
        IP — once a client trips it, retrying on the same httpx client keeps
        getting 505, but a brand-new client from the same IP succeeds. So on a
        captcha hit we reset instead of hammering the poisoned session."""
        if self._owns_http:
            await self._http.aclose()
            self._http = httpx.AsyncClient(timeout=30.0)

    async def __aenter__(self) -> "BirdReportClient":
        return self

    async def __aexit__(self, *exc: Any) -> None:
        await self.aclose()

    async def post(self, path: str, params: dict[str, Any]) -> Any:
        plaintext = _format_plaintext(params)
        body = self._rsa.encrypt(plaintext)
        request_id = uuid.uuid4().hex
        timestamp = str(int(time.time())) + "000"
        sign = hashlib.md5(
            (plaintext + request_id + timestamp).encode("utf-8")
        ).hexdigest()

        headers = {
            **DEFAULT_HEADERS,
            "requestId": request_id,
            "sign": sign,
            "timestamp": timestamp,
        }

        resp = await self._http.post(f"{BASE_URL}{path}", headers=headers, content=body)
        resp.raise_for_status()
        parsed = resp.json()

        # Some endpoints (e.g. /front/province/summary/chart when signed) return
        # the payload as a bare top-level JSON array, no envelope.
        if isinstance(parsed, list):
            return parsed

        envelope = parsed
        # Error signals to honor:
        #   - explicit success: false
        #   - explicit non-zero numeric code (sign error, captcha, etc.)
        # Endpoints like /front/taxon/search omit `code` entirely on success,
        # so a missing/None code is NOT treated as an error.
        code = envelope.get("code")
        success = envelope.get("success")
        if success is False or (isinstance(code, int) and code != 0):
            raise BirdReportError(
                f"{path} -> code={code} msg={envelope.get('msg')!r}",
                code=code if isinstance(code, int) else None,
            )

        data = envelope.get("data")
        # Encrypted endpoints put a base64 ciphertext string in `data`;
        # cleartext endpoints put the actual list/dict there.
        if isinstance(data, str) and data:
            return json.loads(_aes_decrypt(data))
        return data if data is not None else envelope

    async def search_checklists(
        self,
        province: str,
        *,
        page: int = 1,
        limit: int = 100,
        start: str = "",
        end: str = "",
        version: str = "CH4",
    ) -> list[dict]:
        """Page through `/front/record/activity/search`. Empty `start`/`end`
        means "all time" — same default as the public report-list page."""
        return await self.post("/front/record/activity/search", {
            "province": province,
            "startTime": start,
            "endTime": end,
            "version": version,
            "page": page,
            "limit": limit,
        })

    async def get_observations(self, report_id: str, *, version: str = "CH4") -> list[dict]:
        """Per-report species list. Schema validated 2026-06."""
        return await self.post("/front/activity/taxon", {
            "reportId": report_id,
            "version": version,
            "page": 1,
            "limit": 1500,
        })

    async def get_provinces_summary(self, *, version: str = "CH4") -> list[dict]:
        """36-province roll-up. Used to be cleartext; now requires signing too."""
        return await self.post("/front/province/summary/chart", {"version": version})

    async def get_taxon_list(self, *, version: str = "CH4") -> Any:
        """Full bird-species catalog (~4k entries) in a single call."""
        return await self.post("/front/taxon/search", {"version": version})
