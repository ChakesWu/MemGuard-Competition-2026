# MemGuard — Competition Edition

MemGuard is an AI-agent memory governance and observability project. It helps teams inspect which memory or policy evidence supports an agent answer, identify stale or conflicting context, and keep consequential actions subject to review. This repository is a competition edition that presents those ideas through a small SDK/backend example and an interactive, deterministic web demo.

## Product at a glance

- **Traceable answers:** connect an agent output to recorded memory events, source versions, and evidence.
- **Memory governance:** represent provenance, validity, ownership, trust signals, and policy decisions so that stale, expired, or insufficiently governed context can be reviewed or excluded.
- **Investigation and replay:** create an investigation case for a recorded output, inspect source-version impact, and compare a deterministic replay after a source is changed or disabled.
- **Human oversight:** illustrate a support workflow that pauses a refund request for human approval, and an enterprise handover scenario that separates transferable company knowledge from protected, mixed, or stale records.
- **Inspectable demo:** explore the answer evidence, source citations, confidence/trust labels, policy state, and handover decision in the browser.

## Demo and implementation boundary

The web experience in [`vercel-demo/`](vercel-demo/) is a scripted offline demonstration. It uses synthetic records and fixed response logic; it does **not** call an LLM, a live database, an authentication service, or an external business API. Clicking a source chip opens its evidence details and a link back to the evidence console. Approval choices change only the local demo conversation; no refund or external business action is performed.

The Python example in [`examples/investigation_demo.py`](examples/investigation_demo.py) uses the repository's SDK/backend components to demonstrate an investigation, source-version impact lookup, replay, and case resolution with simulated inputs and outputs. It also does not call or modify an AI model.

## Open the web demo

The deployed competition demo is available at [mem-guard-competition-2026.vercel.app](https://mem-guard-competition-2026.vercel.app/).

| Page | Route | What to explore |
| --- | --- | --- |
| Evidence Console | `/` | Agent outputs, evidence stories, governed memory inventory, and related events |
| Support Agent | `/agent` | Fixed customer-support answers, inline evidence chips, and a simulated human-approval flow |
| Enterprise Handover | `/handover` | Source-of-truth boundaries, transfer eligibility, protected data, redaction, and archival decisions |
| 答信 playable demo | `/memguard` | Judge-playable assistant built only on 6 public documents (27 clauses with page and version): a real model answers, the Daxin gate checks each number against the clause scope (pass / C1 / C3 / C4 / pending), with an evidence panel, an answer lab, and a tamper-evident audit chain. Out-of-scope questions get "no data, hand off to a human" |

To run the same standalone app locally:

```sh
cd vercel-demo
npm ci
npm run dev
```

Open [http://localhost:3001](http://localhost:3001). No `.env` file, API key, or external service is required for this offline demo. See [`docs/USER_GUIDE.md`](docs/USER_GUIDE.md) for a walkthrough.


### `/memguard` playable demo notes

- The knowledge base (`vercel-demo/lib/daxin/corpus.ts`) is transcribed from public PDFs. It is **not** an official customer-service assistant and is not affiliated with or endorsed by any institution. Document versions are those printed on the files and may be outdated.
- `POST /api/memguard/ask` runs input guards (length, injection and off-topic fixed replies, per-instance rate limit), retrieves clauses, then calls the model. Set `GLM_API_KEY` (and optionally `GLM_MODEL`, `GLM_BASE_URL`) as server environment variables on Vercel. Without a key, or on timeout (8 s) or an empty answer, it falls back to an offline answer built from the top clause and labels it "离线后备".
- The gate (`lib/daxin/engine.ts`) is deterministic and calls no model. It does not judge C2 (old version) or C5 because the knowledge base holds no old-version pairs.
- Rate limiting is per serverless instance only; this is function-level isolation, not a container sandbox.

## Run the investigation example

From the repository root, install the Python dependencies and run the deterministic example:

```sh
python -m venv .venv
source .venv/bin/activate
python -m pip install -r backend/requirements.txt
python -m pip install -e ./sdk
python examples/investigation_demo.py --database /tmp/memguard-competition-demo.db
```

The example prints evidence completeness, supplemental evidence, a saved investigation case, known impacted output count, replay result, and final case status. It writes its local SQLite demo database to the path passed with `--database`.

Run the focused backend tests with:

```sh
python -m pytest -q tests/test_open_source_investigation.py tests/test_migrations.py
```

Run the standalone web demo tests and production build with:

```sh
cd vercel-demo
npm test
npm run build
```

## Repository map

| Path | Purpose |
| --- | --- |
| `sdk/` | Python SDK primitives for memory events, influence metadata, transports, replay, and optional LangGraph integration |
| `backend/` | API and persistence services for traces, audit events, investigations, and migrations |
| `examples/` | Deterministic investigation and replay example |
| `tests/` | Backend and SDK-oriented test coverage |
| `frontend/` | Competition support-agent frontend source and tests |
| `vercel-demo/` | Self-contained Next.js app deployed for the competition demo, including the evidence console, agent, and handover pages |
| `docs/USER_GUIDE.md` | Step-by-step guide to the demo and investigation example |

## Competition-edition scope

This repository has its own Git history and is a competition-safe subset. Do not add production credentials, customer data, private service code, or real API keys. The included UI scenarios and example records are synthetic and should be treated as demonstrations rather than production policy or operational advice.
