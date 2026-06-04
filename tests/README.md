# tests/

两类文件，别混淆：

## 真测试（离线、可 CI）

- `test_export.py` —— 导出流水线纯逻辑的单元测试，用内存 SQLite，**不联网**。

跑法（任选其一，无需装 pytest）：

```bash
python3 -m unittest discover -s tests
# 或
pytest tests/
```

## 探针脚本（联网、手动跑）

- `probe_yunnan.py` / `probe_plaintext.py` —— **会打真实 birdreport.cn API** 并写
  sample 文件，用来手动验证线上接口是否可达、抓回的字段长什么样。**不是测试**，
  没有断言，不要放进 CI（故意去掉了 `test_` 前缀，避免被 unittest 自动发现而联网）。

手动跑：`python3 tests/probe_yunnan.py`
