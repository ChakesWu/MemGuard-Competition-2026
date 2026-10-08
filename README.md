# MemGuard Competition Demo

A deterministic demonstration of AI-agent memory evidence, source-version impact analysis, investigation cases, and replay. The demo uses synthetic data and does not call an LLM.

## Run

Install Python dependencies from `backend/requirements.txt` and `sdk/pyproject.toml`, then run:

```sh
python examples/investigation_demo.py --database /tmp/memguard-competition-demo.db
python -m pytest -q tests/test_open_source_investigation.py tests/test_migrations.py
```

This repository is a competition-safe subset with a new Git history. It does not contain customer data, private service code, credentials, or the original database.

## Offline support-agent frontend

The `/agent` frontend preserves the support-desk presentation while replacing the original live agent connection with a deterministic, synthetic conversation. It does not call an LLM, Keycloak, an agent server, or any external API. The approval buttons only update the browser's local demo state.

```sh
cd frontend
npm ci
npm run dev
```

Open `http://localhost:3001/agent`. Ask about `ORD-4821` or request a refund to see the simulated approval card. No `.env` file or API key is needed.
