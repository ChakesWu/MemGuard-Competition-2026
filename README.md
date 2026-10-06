# MemGuard Competition Demo

A deterministic demonstration of AI-agent memory evidence, source-version impact analysis, investigation cases, and replay. The demo uses synthetic data and does not call an LLM.

## Run

Install Python dependencies from `backend/requirements.txt` and `sdk/pyproject.toml`, then run:

```sh
python examples/investigation_demo.py --database /tmp/memguard-competition-demo.db
python -m pytest -q tests/test_open_source_investigation.py tests/test_migrations.py
```

This repository is a competition-safe subset with a new Git history. It does not contain customer data, private service code, credentials, or the original database.
