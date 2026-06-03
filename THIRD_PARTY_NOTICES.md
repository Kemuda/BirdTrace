# Third-Party Notices

This project's birdreport.cn API client (request signing, RSA-chunked request encryption, and AES-CBC response decryption) is adapted from two upstream open-source projects. Both are MIT-licensed.

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
