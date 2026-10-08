# MemGuard Competition Demo — User Guide

This guide walks through the competition edition's offline web demo and deterministic investigation example. The UI uses fixed answers and synthetic data. It does not call an LLM or perform external business actions.

## 1. Open the demo

Use the deployed [MemGuard Competition Demo](https://mem-guard-competition-2026.vercel.app/), or start it locally:

```sh
cd vercel-demo
npm ci
npm run dev
```

Then open [http://localhost:3001](http://localhost:3001). The app does not need an API key or `.env` file for this offline flow.

The top navigation links the three pages:

- **Evidence Console (`/`)** — inspect predefined agent outputs and their evidence.
- **Support Agent (`/agent`)** — ask about the synthetic order or try the refund scenario.
- **Enterprise Handover (`/handover`)** — inspect which example memories remain at their source, transfer, require review, stay protected, or are archived.

## 2. Try the support-agent conversation

On **Support Agent**, the conversation starts with a fixed answer about order `ORD-4821`. You can also:

1. Select **Try the policy scenario**, or enter a question about `ORD-4821` in the message box.
2. To see the approval flow, enter: `I need a refund for ORD-4821 because the item is defective.`
3. Review the fixed response and the simulated approval card. The card represents a decision point in the demo only; it does not submit or issue a refund.
4. Use **New conversation** to reset the local conversation.

The demo recognizes a small set of scripted intents, such as greetings, order-status questions, ordinary refund requests, and defective-item refund requests. Other inputs receive a fixed fallback answer rather than a generated response.

## 3. Inspect inline source evidence

Some phrases in an agent answer are accompanied by green source chips. Select a chip to open its **Memory evidence** popover. The popover can include:

- **Role in output** — how the source supports or constrains the answer.
- **Trust** — the sample trust score and label, where applicable. This is demo metadata, not a calibrated probability that an answer is correct.
- **Policy** — the illustrative allow/reject outcome for that source.
- **Source** — the synthetic record or policy identifier.
- **Included in prompt** — whether the demo marks the evidence as included in the response context.
- **Open full evidence** — opens the corresponding trace in the Evidence Console.

The separate **Provenance** and **Trust** links above an answer also open the selected answer's evidence-console view. An expired-memory chip is marked as excluded from the prompt to illustrate that historical context can be shown for review without being used to justify the answer.

## 4. Use the Evidence Console

Open **Evidence Console** from the header or follow **Open full evidence** from a source popover.

1. Choose an output from the left-hand **Agent outputs** list.
2. Read **Agent answer** and the **Evidence story**, which presents the claim, memory used, evidence quote, and governance explanation.
3. Expand **Technical details** to inspect the synthetic record, version, state, and trace identifier.
4. Review **Other memory the agent could have encountered** for expired or insufficiently governed context and policy evidence not used as a separate claim.
5. Scroll to **What the agent actually remembers** for the sample memory inventory, source, writer, verification date, and conflict-check fields.
6. Review **Related memory events** for the sample read events associated with the selected output.

The console is a fixed synthetic snapshot. Its event counts, trust labels, hashes, and timestamps illustrate a presentation format and are not live telemetry.

## 5. Explore Enterprise Handover

Open **Enterprise Handover** and select cards in the three lanes:

- **Company source of truth** keeps authoritative records in their original systems.
- **Departing employee agent** shows company, team, private, mixed, and stale example memories.
- **Successor team agent** shows the approved company/team context selected for transfer.

The **Memory lineage** panel explains each selected record's source, business and memory owner, transfer policy, trust evidence, policy decision, successor eligibility, and reason. The example distinguishes transfer, read-only retention at source, protection, redaction for review, and archival. It is a scripted illustration, not an actual export or transfer operation.

## 6. Run the investigation and replay example

The repository also includes a deterministic Python example. From the repository root:

```sh
python -m venv .venv
source .venv/bin/activate
python -m pip install -r backend/requirements.txt
python -m pip install -e ./sdk
python examples/investigation_demo.py --database /tmp/memguard-competition-demo.db
```

The example records a simulated decision trace, adds a newer source version, checks for supplemental evidence and known impact, saves an investigation case, runs a deterministic replay, and marks the case resolved. The `simulated_support_agent` in the example is a local function, not an LLM call. The database is local to the path supplied with `--database`.

Run the focused test suites with:

```sh
python -m pytest -q tests/test_open_source_investigation.py tests/test_migrations.py
cd vercel-demo && npm test
```

## FAQ

**Does the web demo need my API key?**  
No. The competition UI uses fixed answers and synthetic evidence; it does not make model or external API calls.

**Does approving the request issue a refund?**  
No. Approval controls append a scripted response to the browser conversation only. They do not write to a business system.

**Are the trust scores correctness probabilities?**  
No. They are illustrative evidence metadata used to demonstrate the UI and governance flow.

**Can I use this demo as production policy guidance?**  
No. The records, policy, dates, and outcomes are synthetic examples. Production use requires a separately configured integration, verified source data, and organization-specific policies.
