# Third-Party Notices

This project's birdreport.cn API client (request signing, RSA-chunked request encryption, and AES-CBC response decryption) is adapted from two upstream open-source projects. Both are MIT-licensed.

## commonBird

- Repository: https://github.com/CKRainbow/commonBird
- License: MIT
- Vendored into `data/raw/refs/`:
  - `ebird_sci_to_code.json` — slimmed from commonBird's `ebird_taxonomy.json`
    (eBird scientific name → speciesCode + common name). Used to link each
    species to its `ebird.org/species/<code>` page.
  - `ch4_to_eb_taxon_map.json` — birdreport(CH4) → eBird 学名 reconciliation
    (~98 names that differ taxonomically), so the eBird join matches.
- The underlying eBird taxonomy is © Cornell Lab of Ornithology.

## 懂鸟 / Xeno-canto (物种外链)

- `data/raw/refs/dongniao_name_to_nd.json` — 中文名 → {懂鸟分类编号, 英文名}，
  解析自懂鸟公开分类页 https://dongniao.net/taxonomy.html，仅用于拼接指回懂鸟
  物种页的深链（`/nd/{编号}/{中文名}/{英文名}`）。© dongniao.net (懂鸟 / Aboutbirds)。
- Xeno-canto 鸣声链接由拉丁学名直接拼接（`xeno-canto.org/species/{Genus-species}`），
  不落地任何数据。© Xeno-canto Foundation，录音为各贡献者所有（多为 CC 协议）。

## qBird

- Repository: https://github.com/TaQini/qBird
- Author: TaQini
- License: MIT, Copyright (c) 2023 TaQini
- Inherited from this project:
  - The sign algorithm: `md5(format_data + request_id + timestamp)`.
  - The `/front/record/activity/search` and `/front/activity/taxon` parameter shapes.
  - The overall request flow: format → encrypt body → sign → POST → decrypt response.
  - The pagination loop and per-checklist taxon-fetch fan-out.

## commonBird

- Repository: https://github.com/CKRainbow/commonBird
- Author: CKRainbow (which itself credits qBird as its base, and birdreportcn-to-ebird by sun-jiao as additional inspiration)
- License: MIT, Copyright (c) 2023 TaQini (preserved by commonBird)
- Inherited from this project:
  - The pure-Python AES-CBC key and IV used for response decryption (originally embedded in birdreport.cn's frontend JavaScript).
  - `LongRSAKey`: chunked PKCS1_v1_5 encryption for request bodies longer than 117 bytes.
  - `public_key.pem` (the birdreport.cn frontend public key).
  - Architectural reference for the `member_*` user-scope endpoints (not yet ported here).
  - Reference data files we may incorporate later: `ebird_cn_hotspots.json`, `birdreport_taxon_infos.json`, `ch4_to_eb_taxon_map.json`.

## birdreportcn-to-ebird

- Repository: https://github.com/sun-jiao/birdreportcn-to-ebird
- Cited by commonBird as additional inspiration. Listed here for completeness; we have not directly copied code from it at this time.

## SpiderChaser

- Repository: https://github.com/Achernar0208/SpiderChaser (`bird-report/` directory)
- License: GPL-3.0
- This project contains a verbatim copy of birdreport.cn's frontend JavaScript (`jQuertAjax.js`) — the original ground-truth that both qBird and commonBird were derived from. We used it as **reference material only** to recover the protocol details that other ports got wrong or never tested:
  - The `format()` function is `JSON.stringify(sort_ASCII(dataTojson(qs)))`. The plaintext that gets signed and RSA-encrypted is **sorted-key JSON with raw UTF-8 (no escapes, no spaces)**, NOT urlencoded as we initially assumed from qBird's wrapper.
  - The `/front/record/activity/search` endpoint is called **without** `X-Auth-Token`.
  - AES-256-CBC parameters embedded in the JS: key `3583ec0257e2f4c8195eec7410ff1619`, iv `d93c0d5ec6352f20` (parsed as UTF-8 bytes).
- No SpiderChaser source code (no `.js`, no `.py`) is reproduced in this repository. Protocol details and constants are facts about the third-party birdreport.cn server, not copyrightable expression — so GPL-3.0 does not propagate to our independently-written Python client. The credit here is for the reverse-engineering effort.

---

The original MIT license text from TaQini is preserved verbatim below, as required by the license.

```
MIT License

Copyright (c) 2023 TaQini

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
