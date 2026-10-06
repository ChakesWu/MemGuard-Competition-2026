#!/usr/bin/env python3
"""Deterministic stale-policy investigation demo; no model or API key required."""

from __future__ import annotations

import argparse
import os
import pathlib
import sys


PROJECT_ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "backend"))
sys.path.insert(0, str(PROJECT_ROOT / "sdk"))


def main() -> None:
    parser = argparse.ArgumentParser(description="Run a simulated MemGuard investigation")
    parser.add_argument("--database", default=str(PROJECT_ROOT / "investigation-demo.db"))
    args = parser.parse_args()
    os.environ["MEMGUARD_DB_PATH"] = args.database

    from app.investigations import InvestigationStore
    from app.services import DecisionTrace, MemoryGateway
    from memguard.replay import ReplayRunner

    tenant_id = "simulated-support-team"
    gateway = MemoryGateway()
    store = InvestigationStore(gateway.database)

    gateway.ingest_sdk_events([
        {
            "event_id": "refund-policy-v1-read",
            "namespace": tenant_id,
            "agent_id": "support-agent",
            "operation": "read",
            "memory_key": "policy:refund",
            "memory_type": "semantic",
            "session_id": "simulated-session",
            "content_hash": "sha256:old-refund-policy",
            "source_id": "refund-policy",
            "source_version": "v1",
            "valid_until": "2026-08-31T23:59:59+00:00",
        }
    ])
    trace = DecisionTrace(
        trace_id="simulated-stale-policy-trace",
        tenant_id=tenant_id,
        agent_id="support-agent",
        session_id="simulated-session",
        timestamp="2026-09-10T00:00:00+00:00",
        input_memory_ids=["policy:refund", "policy:refund"],
        input_memory_events=["refund-policy-v1-read", "refund-policy-v2-read"],
        user_input="How long does a refund take?",
        llm_prompt_hash="sha256:simulated-prompt",
        llm_output="Refunds take 30 days.",
        llm_output_hash="sha256:simulated-output",
        llm_model="simulated-output",
        output_memory_ids=[],
        output_memory_events=[],
        memory_influence_scores={},
        total_influence_score=0.0,
        metadata={"simulated": True},
    )
    gateway.create_decision_trace(trace)
    gateway._persist_trace(trace)
    before = gateway.get_decision_trace(trace.trace_id)
    print(f"Evidence before new source: {'complete' if before['evidence_status']['complete'] else 'incomplete'}")

    gateway.ingest_sdk_events([
        {
            "event_id": "refund-policy-v2-read",
            "namespace": tenant_id,
            "agent_id": "support-agent",
            "operation": "read",
            "memory_key": "policy:refund",
            "memory_type": "semantic",
            "session_id": "simulated-session",
            "content_hash": "sha256:new-refund-policy",
            "source_id": "refund-policy",
            "source_version": "v2",
            "valid_from": "2026-09-01T00:00:00+00:00",
        }
    ])
    after = gateway.get_decision_trace(trace.trace_id)
    print(f"Historical evidence remains: {'complete' if after['evidence_status']['complete'] else 'incomplete'}")
    print(f"Supplemental evidence found: {len(after['supplemental_evidence_items'])}")

    case = store.create_case(tenant_id, {
        "trace_id": trace.trace_id,
        "title": "Simulated stale refund policy",
        "description": "The recorded output used the old 30-day policy.",
        "suspected_source_id": "refund-policy",
        "suspected_source_version": "v1",
        "expected_contains": ["14 days"],
        "forbidden_contains": ["30 days"],
    })
    print(f"Saved case: {case['case_id']}")
    impact = gateway.get_source_version_impact(tenant_id, "refund-policy", "v1")
    print(f"Known affected outputs: {impact['known_impacted_count']}")
    def record_replay(case_id, payload):
        return store.create_replay(tenant_id, case_id, payload)

    def simulated_support_agent(input_payload, context):
        days = 14 if "refund-policy-v1-read" in context.disabled_event_ids else 30
        return f"Refunds take {days} days."

    replay = ReplayRunner(record=record_replay, runner_name="investigation-demo").run(
        case_id=case["case_id"],
        variant_label="after policy refresh",
        input_payload={"question": "How long does a refund take?"},
        execute=simulated_support_agent,
        disabled_event_ids=["refund-policy-v1-read"],
        model="simulated-output",
    )
    print(f"Corrected replay: {'PASS' if replay['passed'] else 'FAIL'}")
    print(f"Replay origin: {replay['execution_origin']}")
    resolved = store.update_case(tenant_id, case["case_id"], {
        "status": "resolved",
        "remediation_summary": "Disabled the expired v1 retrieval and used refund policy v2.",
        "remediation_reference": "demo:policy-refresh",
    })
    print(f"Case status: {resolved['status']}")
    print("This demo is simulated and does not call or modify an AI model.")


if __name__ == "__main__":
    main()
