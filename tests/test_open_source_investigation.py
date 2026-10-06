"""Open-source investigation contract tests."""

from __future__ import annotations

import os
import pathlib
import subprocess
import sys
import tempfile
import threading
import unittest
from unittest.mock import patch


PROJECT_ROOT = pathlib.Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "sdk"))

from memguard.core.event import MemoryEvent, MemoryOp, MemoryType  # noqa: E402
from memguard.core.interceptor import MemGuardInterceptor  # noqa: E402
from memguard.replay import ReplayRunner  # noqa: E402


class CaptureTransport:
    def __init__(self) -> None:
        self.event = None
        self.ready = threading.Event()

    def _emit_sync(self, event) -> None:
        self.event = event
        self.ready.set()


class SDKLineageTests(unittest.TestCase):
    def test_record_preserves_explicit_source_lineage(self):
        transport = CaptureTransport()
        interceptor = MemGuardInterceptor(
            agent_id="support-agent",
            namespace="demo",
            transport=transport,
        )

        interceptor.record(
            operation=MemoryOp.READ,
            memory_key="policy:refund",
            memory_type=MemoryType.SEMANTIC,
            source_id="refund-policy",
            source_version="v2",
            valid_from="2026-09-01T00:00:00+00:00",
            valid_until="2026-12-31T23:59:59+00:00",
        )

        self.assertTrue(transport.ready.wait(1), "SDK event was not emitted")
        self.assertEqual(transport.event.source_id, "refund-policy")
        self.assertEqual(transport.event.source_version, "v2")
        self.assertEqual(transport.event.valid_from, "2026-09-01T00:00:00+00:00")
        self.assertEqual(transport.event.valid_until, "2026-12-31T23:59:59+00:00")


_db_dir = tempfile.TemporaryDirectory(prefix="memguard-open-source-")
os.environ["MEMGUARD_DB_PATH"] = os.path.join(_db_dir.name, "events.db")
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

from fastapi.testclient import TestClient  # noqa: E402
from app.auth import TenantPrincipal  # noqa: E402
from app.main import app, gateway  # noqa: E402


class EvidenceStatusTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.auth_patch = patch(
            "app.main.authenticate_bearer_token",
            return_value=TenantPrincipal(
                subject="test-user",
                tenant_id="open-source-tenant",
                claims={"sub": "test-user"},
            ),
        )
        self.auth_patch.start()

    def tearDown(self):
        self.auth_patch.stop()

    def test_trace_reports_lineage_and_complete_evidence_without_causal_claim(self):
        ingest = self.client.post(
            "/v1/events",
            json={
                "events": [
                    {
                        "event_id": "lineage-event",
                        "agent_id": "support-agent",
                        "operation": "read",
                        "memory_key": "policy:refund",
                        "memory_type": "semantic",
                        "session_id": "lineage-session",
                        "content_hash": "hash-v2",
                        "source_id": "refund-policy",
                        "source_version": "v2",
                        "valid_from": "2026-09-01T00:00:00+00:00",
                        "caused_by": "policy-import-v2",
                    }
                ]
            },
        )
        self.assertEqual(ingest.status_code, 200)
        created = self.client.post(
            "/v1/trace",
            json={
                "trace_id": "lineage-trace",
                "agent_id": "support-agent",
                "session_id": "lineage-session",
                "input_event_ids": ["lineage-event"],
                "output_event_ids": [],
                "output_summary": "Refunds take 14 days.",
            },
        )
        self.assertEqual(created.status_code, 200)

        response = self.client.get("/v1/trace/lineage-trace")

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["causality_status"], "unverified")
        self.assertEqual(
            body["evidence_status"],
            {
                "complete": True,
                "recorded_count": 1,
                "missing_event_ids": [],
                "snapshot_state": "recorded_at_trace",
            },
        )
        evidence = body["evidence_items"][0]
        self.assertEqual(evidence["classification"], "recorded_fact")
        self.assertEqual(evidence["source_id"], "refund-policy")
        self.assertEqual(evidence["source_version"], "v2")
        self.assertEqual(evidence["parent_event_id"], "policy-import-v2")

    def test_trace_reports_incomplete_evidence_without_fabricating_rows(self):
        created = self.client.post(
            "/v1/trace",
            json={
                "trace_id": "incomplete-trace",
                "agent_id": "support-agent",
                "session_id": "incomplete-session",
                "input_event_ids": ["missing-event"],
                "output_event_ids": [],
            },
        )
        self.assertEqual(created.status_code, 200)

        body = self.client.get("/v1/trace/incomplete-trace").json()

        self.assertEqual(body["evidence_items"], [])
        self.assertEqual(
            body["evidence_status"],
            {
                "complete": False,
                "recorded_count": 0,
                "missing_event_ids": ["missing-event"],
                "snapshot_state": "recorded_at_trace",
            },
        )
        self.assertEqual(body["causality_status"], "unverified")

    def test_late_event_is_supplemental_and_does_not_rewrite_trace_evidence(self):
        created = self.client.post(
            "/v1/trace",
            json={
                "trace_id": "frozen-evidence-trace",
                "agent_id": "support-agent",
                "session_id": "frozen-evidence-session",
                "input_event_ids": ["late-policy-event"],
                "output_event_ids": [],
                "output_summary": "Refunds take 30 days.",
            },
        )
        self.assertEqual(created.status_code, 200)
        before = self.client.get("/v1/trace/frozen-evidence-trace").json()
        self.assertFalse(before["evidence_status"]["complete"])

        ingested = self.client.post(
            "/v1/events",
            json={
                "events": [{
                    "event_id": "late-policy-event",
                    "agent_id": "support-agent",
                    "operation": "read",
                    "memory_key": "policy:refund",
                    "memory_type": "semantic",
                    "session_id": "frozen-evidence-session",
                    "source_id": "refund-policy",
                    "source_version": "v2",
                }]
            },
        )
        self.assertEqual(ingested.status_code, 200)

        after = self.client.get("/v1/trace/frozen-evidence-trace").json()
        self.assertEqual(after["evidence_items"], [])
        self.assertEqual(after["missing_evidence_event_ids"], ["late-policy-event"])
        self.assertEqual(after["evidence_status"]["snapshot_state"], "recorded_at_trace")
        self.assertEqual(after["supplemental_evidence_items"][0]["event_id"], "late-policy-event")
        self.assertEqual(after["supplemental_evidence_items"][0]["classification"], "investigation_lead")

    def test_source_version_impact_uses_persisted_trace_evidence(self):
        self.client.post(
            "/v1/events",
            json={
                "events": [{
                    "event_id": "impact-policy-v1",
                    "agent_id": "support-agent",
                    "operation": "read",
                    "memory_key": "policy:refund",
                    "memory_type": "semantic",
                    "session_id": "impact-session",
                    "source_id": "impact-refund-policy",
                    "source_version": "v1",
                }]
            },
        )
        self.client.post(
            "/v1/trace",
            json={
                "trace_id": "impact-trace",
                "agent_id": "support-agent",
                "session_id": "impact-session",
                "input_event_ids": ["impact-policy-v1"],
                "output_summary": "Refunds take 30 days.",
            },
        )

        response = self.client.get("/v1/sources/impact-refund-policy/versions/v1/impact")

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["known_impacted_count"], 1)
        self.assertEqual(body["traces"][0]["trace_id"], "impact-trace")
        self.assertEqual(body["traces"][0]["relationship"], "direct")

    def test_evidence_is_marked_expired_at_the_time_of_the_answer(self):
        self.client.post(
            "/v1/events",
            json={
                "events": [{
                    "event_id": "expired-policy-v1",
                    "agent_id": "support-agent",
                    "operation": "read",
                    "memory_key": "policy:refund",
                    "memory_type": "semantic",
                    "session_id": "expired-session",
                    "source_id": "refund-policy",
                    "source_version": "v1",
                    "valid_until": "2026-08-31T23:59:59+00:00",
                }]
            },
        )
        self.client.post(
            "/v1/trace",
            json={
                "trace_id": "expired-trace",
                "agent_id": "support-agent",
                "session_id": "expired-session",
                "timestamp": "2026-09-10T00:00:00+00:00",
                "input_event_ids": ["expired-policy-v1"],
            },
        )

        evidence = self.client.get("/v1/trace/expired-trace").json()["evidence_items"][0]

        self.assertEqual(evidence["temporal_status"], "expired")

    def test_ingest_rejects_an_event_when_durable_persistence_fails(self):
        with patch.object(gateway, "_persist_event", return_value=False):
            response = self.client.post(
                "/v1/events",
                json={
                    "events": [{
                        "event_id": "not-durable",
                        "agent_id": "support-agent",
                        "operation": "read",
                        "memory_key": "policy:refund",
                    }]
                },
            )

        self.assertEqual(response.json()["accepted"], 0)
        self.assertEqual(response.json()["rejected"], 1)
        self.assertNotIn("not-durable", [event.event_id for event in gateway.events])

    def test_trace_ingest_reports_failure_when_durable_persistence_fails(self):
        with patch.object(gateway, "_persist_trace", return_value=False):
            response = self.client.post(
                "/v1/trace",
                json={
                    "trace_id": "not-durable-trace",
                    "agent_id": "support-agent",
                    "input_event_ids": [],
                    "output_event_ids": [],
                },
            )

        self.assertEqual(response.status_code, 503)
        self.assertNotIn(
            "not-durable-trace", [trace.trace_id for trace in gateway.decision_traces]
        )

    def test_trace_without_client_timestamp_gets_a_server_timestamp(self):
        response = self.client.post(
            "/v1/trace",
            json={
                "trace_id": "server-timestamp-trace",
                "agent_id": "support-agent",
                "input_event_ids": [],
                "output_event_ids": [],
            },
        )
        self.assertEqual(response.status_code, 200)

        trace = self.client.get("/v1/trace/server-timestamp-trace").json()

        self.assertTrue(trace["timestamp"].endswith("+00:00"))


class InvestigationCaseTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.auth_patch = patch(
            "app.main.authenticate_bearer_token",
            return_value=TenantPrincipal(
                subject="case-user",
                tenant_id="case-tenant",
                claims={"sub": "case-user"},
            ),
        )
        self.auth_patch.start()
        self.client.post(
            "/v1/trace",
            json={
                "trace_id": "case-trace",
                "agent_id": "support-agent",
                "session_id": "case-session",
                "output_summary": "Refunds take 30 days.",
            },
        )

    def tearDown(self):
        self.auth_patch.stop()

    def test_case_can_be_created_updated_listed_and_reopened(self):
        created = self.client.post(
            "/v1/cases",
            json={
                "trace_id": "case-trace",
                "title": "Old refund policy",
                "description": "Customer received an outdated promise.",
                "suspected_source_id": "refund-policy",
                "suspected_source_version": "v1",
                "expected_contains": ["14 days"],
                "forbidden_contains": ["30 days"],
            },
        )
        self.assertEqual(created.status_code, 201)
        case_id = created.json()["case_id"]

        updated = self.client.patch(
            f"/v1/cases/{case_id}",
            json={
                "status": "resolved",
                "description": "Confirmed after policy refresh.",
                "remediation_summary": "Replaced the stale retrieval record with v2.",
                "remediation_reference": "commit:abc123",
            },
        )
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.json()["status"], "resolved")

        listed = self.client.get("/v1/cases?trace_id=case-trace")
        self.assertEqual(listed.status_code, 200)
        self.assertEqual(len(listed.json()["cases"]), 1)
        reopened = self.client.get(f"/v1/cases/{case_id}")
        self.assertEqual(reopened.json()["expected_contains"], ["14 days"])
        self.assertEqual(reopened.json()["forbidden_contains"], ["30 days"])
        self.assertEqual(reopened.json()["suspected_source_id"], "refund-policy")
        self.assertEqual(reopened.json()["suspected_source_version"], "v1")
        self.assertEqual(reopened.json()["remediation_reference"], "commit:abc123")

    def test_replay_is_recorded_with_deterministic_assertions(self):
        case = self.client.post(
            "/v1/cases",
            json={
                "trace_id": "case-trace",
                "title": "Refund response regression",
                "expected_contains": ["14 days"],
                "forbidden_contains": ["30 days"],
            },
        ).json()

        failed = self.client.post(
            f"/v1/cases/{case['case_id']}/replays",
            json={
                "variant_label": "before fix",
                "output": "Refunds take 30 days.",
                "disabled_event_ids": ["old-policy-event"],
                "model": "recorded-output",
                "prompt_hash": "sha256:example",
                "run_metadata": {"source": "manual"},
            },
        )
        self.assertEqual(failed.status_code, 201)
        self.assertFalse(failed.json()["passed"])
        self.assertEqual(failed.json()["assertions"], {"expected": False, "forbidden": False})
        self.assertEqual(failed.json()["execution_origin"], "manual_import")

        passed = self.client.post(
            f"/v1/cases/{case['case_id']}/replays",
            json={"variant_label": "after fix", "output": "Refunds take 14 days."},
        )
        self.assertTrue(passed.json()["passed"])

        replays = self.client.get(f"/v1/cases/{case['case_id']}/replays").json()["replays"]
        self.assertEqual([item["variant_label"] for item in replays], ["after fix", "before fix"])

    def test_external_runner_provenance_is_saved_with_the_result(self):
        case = self.client.post(
            "/v1/cases",
            json={
                "trace_id": "case-trace",
                "title": "Runner provenance",
                "expected_contains": ["14 days"],
            },
        ).json()

        replay = self.client.post(
            f"/v1/cases/{case['case_id']}/replays",
            json={
                "variant_label": "CI after fix",
                "output": "Refunds take 14 days.",
                "execution_origin": "external_runner",
                "run_id": "ci-run-42",
                "code_revision": "abc123",
                "input_snapshot_hash": "sha256:fixture",
            },
        ).json()

        self.assertTrue(replay["passed"])
        self.assertEqual(replay["verification_status"], "passed")
        self.assertEqual(replay["execution_origin"], "external_runner")
        self.assertEqual(replay["run_id"], "ci-run-42")
        self.assertEqual(replay["code_revision"], "abc123")
        self.assertEqual(replay["input_snapshot_hash"], "sha256:fixture")

    def test_local_runner_executes_a_callable_and_records_the_real_output(self):
        case = self.client.post(
            "/v1/cases",
            json={
                "trace_id": "case-trace",
                "title": "Run corrected policy",
                "expected_contains": ["14 days"],
                "forbidden_contains": ["30 days"],
            },
        ).json()

        def record(case_id, payload):
            response = self.client.post(f"/v1/cases/{case_id}/replays", json=payload)
            self.assertEqual(response.status_code, 201)
            return response.json()

        observed = {}

        def corrected_agent(input_payload, context):
            observed["input"] = input_payload
            observed["disabled"] = context.disabled_event_ids
            return {"answer": "Refunds take 14 days."}

        runner = ReplayRunner(record=record, runner_name="pytest-local")
        replay = runner.run(
            case_id=case["case_id"],
            variant_label="after fix",
            input_payload={"question": "How long does a refund take?"},
            execute=corrected_agent,
            disabled_event_ids=["old-policy-event"],
            code_revision="abc123",
        )

        self.assertEqual(observed["input"], {"question": "How long does a refund take?"})
        self.assertEqual(observed["disabled"], ("old-policy-event",))
        self.assertTrue(replay["passed"])
        self.assertEqual(replay["execution_origin"], "external_runner")
        self.assertEqual(replay["run_metadata"]["runner_name"], "pytest-local")
        self.assertEqual(replay["run_metadata"]["input_payload"], {"question": "How long does a refund take?"})
        self.assertEqual(replay["output"], '{"answer":"Refunds take 14 days."}')

    def test_replay_without_assertions_is_not_reported_as_passed(self):
        case = self.client.post(
            "/v1/cases",
            json={"trace_id": "case-trace", "title": "Needs acceptance criteria"},
        ).json()

        replay = self.client.post(
            f"/v1/cases/{case['case_id']}/replays",
            json={"variant_label": "manual check", "output": "Looks fine."},
        )

        self.assertEqual(replay.status_code, 201)
        self.assertFalse(replay.json()["passed"])
        self.assertEqual(replay.json()["verification_status"], "not_configured")

    def test_case_is_hidden_from_another_tenant(self):
        case = self.client.post(
            "/v1/cases",
            json={"trace_id": "case-trace", "title": "Tenant private case"},
        ).json()
        with patch(
            "app.main.authenticate_bearer_token",
            return_value=TenantPrincipal(
                subject="other-user",
                tenant_id="other-tenant",
                claims={"sub": "other-user"},
            ),
        ):
            response = self.client.get(f"/v1/cases/{case['case_id']}")
        self.assertEqual(response.status_code, 404)


class InvestigationDemoTests(unittest.TestCase):
    def test_demo_runs_without_model_key_and_records_a_passing_replay(self):
        with tempfile.TemporaryDirectory(prefix="memguard-demo-") as directory:
            result = subprocess.run(
                [
                    sys.executable,
                    str(PROJECT_ROOT / "examples" / "investigation_demo.py"),
                    "--database",
                    str(pathlib.Path(directory) / "demo.db"),
                ],
                cwd=PROJECT_ROOT,
                text=True,
                capture_output=True,
                check=False,
            )

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("Evidence before new source: incomplete", result.stdout)
        self.assertIn("Historical evidence remains: incomplete", result.stdout)
        self.assertIn("Supplemental evidence found: 1", result.stdout)
        self.assertIn("Saved case:", result.stdout)
        self.assertIn("Known affected outputs: 1", result.stdout)
        self.assertIn("Corrected replay: PASS", result.stdout)
        self.assertIn("Replay origin: external_runner", result.stdout)
        self.assertIn("Case status: resolved", result.stdout)


if __name__ == "__main__":
    unittest.main()
