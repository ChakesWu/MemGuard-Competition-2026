"""Persistent, tenant-scoped investigation cases and replay records."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Any

from .database import DatabaseConfig


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _decode_case(row: Any) -> dict[str, Any]:
    result = dict(row)
    result["expected_contains"] = json.loads(result.pop("expected_contains_json"))
    result["forbidden_contains"] = json.loads(result.pop("forbidden_contains_json"))
    return result


def _decode_replay(row: Any) -> dict[str, Any]:
    result = dict(row)
    result["disabled_event_ids"] = json.loads(result.pop("disabled_event_ids_json"))
    result["run_metadata"] = json.loads(result.pop("run_metadata_json"))
    result["assertions"] = json.loads(result.pop("assertions_json"))
    result["passed"] = bool(result["passed"])
    return result


def evaluate_output(output: str, expected: list[str], forbidden: list[str]) -> dict[str, bool]:
    """Evaluate a recorded output with transparent, case-insensitive substring rules."""
    normalized = output.casefold()
    expected_ok = all(value.casefold() in normalized for value in expected if value)
    forbidden_ok = all(value.casefold() not in normalized for value in forbidden if value)
    return {"expected": expected_ok, "forbidden": forbidden_ok}


class InvestigationStore:
    def __init__(self, database: DatabaseConfig) -> None:
        self.database = database

    def create_case(self, tenant_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        case_id = str(uuid.uuid4())
        timestamp = _now()
        with self.database.connect() as connection:
            connection.execute(
                """
                INSERT INTO investigation_cases(
                    case_id, tenant_id, trace_id, title, description, status,
                    expected_contains_json, forbidden_contains_json, created_at, updated_at,
                    suspected_source_id, suspected_source_version
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    case_id, tenant_id, payload["trace_id"], payload["title"],
                    payload.get("description", ""), "open",
                    json.dumps(payload.get("expected_contains", [])),
                    json.dumps(payload.get("forbidden_contains", [])), timestamp, timestamp,
                    payload.get("suspected_source_id"), payload.get("suspected_source_version"),
                ),
            )
            connection.commit()
        return self.get_case(tenant_id, case_id)

    def get_case(self, tenant_id: str, case_id: str) -> dict[str, Any] | None:
        with self.database.connect() as connection:
            row = connection.execute(
                "SELECT * FROM investigation_cases WHERE case_id = ? AND tenant_id = ?",
                (case_id, tenant_id),
            ).fetchone()
        return _decode_case(row) if row else None

    def list_cases(self, tenant_id: str, trace_id: str | None = None) -> list[dict[str, Any]]:
        sql = "SELECT * FROM investigation_cases WHERE tenant_id = ?"
        params: list[Any] = [tenant_id]
        if trace_id:
            sql += " AND trace_id = ?"
            params.append(trace_id)
        sql += " ORDER BY updated_at DESC"
        with self.database.connect() as connection:
            rows = connection.execute(sql, params).fetchall()
        return [_decode_case(row) for row in rows]

    def update_case(self, tenant_id: str, case_id: str, changes: dict[str, Any]) -> dict[str, Any] | None:
        allowed = {
            "title": "title", "description": "description", "status": "status",
            "expected_contains": "expected_contains_json",
            "forbidden_contains": "forbidden_contains_json",
            "suspected_source_id": "suspected_source_id",
            "suspected_source_version": "suspected_source_version",
            "remediation_summary": "remediation_summary",
            "remediation_reference": "remediation_reference",
        }
        assignments: list[str] = []
        values: list[Any] = []
        for key, value in changes.items():
            if key not in allowed or value is None:
                continue
            assignments.append(f"{allowed[key]} = ?")
            values.append(json.dumps(value) if key.endswith("contains") else value)
        if not assignments:
            return self.get_case(tenant_id, case_id)
        assignments.append("updated_at = ?")
        values.extend([_now(), case_id, tenant_id])
        with self.database.connect() as connection:
            cursor = connection.execute(
                f"UPDATE investigation_cases SET {', '.join(assignments)} WHERE case_id = ? AND tenant_id = ?",
                values,
            )
            connection.commit()
            if cursor.rowcount == 0:
                return None
        return self.get_case(tenant_id, case_id)

    def create_replay(self, tenant_id: str, case_id: str, payload: dict[str, Any]) -> dict[str, Any] | None:
        case = self.get_case(tenant_id, case_id)
        if not case:
            return None
        assertions = evaluate_output(
            payload["output"], case["expected_contains"], case["forbidden_contains"]
        )
        configured = bool(case["expected_contains"] or case["forbidden_contains"])
        passed = configured and all(assertions.values())
        verification_status = "passed" if passed else "failed" if configured else "not_configured"
        replay_id = str(uuid.uuid4())
        with self.database.connect() as connection:
            connection.execute(
                """
                INSERT INTO investigation_replays(
                    replay_id, case_id, tenant_id, variant_label, output,
                    disabled_event_ids_json, model, prompt_hash, run_metadata_json,
                    assertions_json, passed, created_at, verification_status,
                    execution_origin, run_id, code_revision, input_snapshot_hash
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    replay_id, case_id, tenant_id, payload.get("variant_label", "replay"),
                    payload["output"], json.dumps(payload.get("disabled_event_ids", [])),
                    payload.get("model"), payload.get("prompt_hash"),
                    json.dumps(payload.get("run_metadata", {})), json.dumps(assertions),
                    int(passed), _now(), verification_status,
                    payload.get("execution_origin", "manual_import"), payload.get("run_id"),
                    payload.get("code_revision"), payload.get("input_snapshot_hash"),
                ),
            )
            connection.commit()
        return self.get_replay(tenant_id, replay_id)

    def get_replay(self, tenant_id: str, replay_id: str) -> dict[str, Any] | None:
        with self.database.connect() as connection:
            row = connection.execute(
                "SELECT * FROM investigation_replays WHERE replay_id = ? AND tenant_id = ?",
                (replay_id, tenant_id),
            ).fetchone()
        return _decode_replay(row) if row else None

    def list_replays(self, tenant_id: str, case_id: str) -> list[dict[str, Any]] | None:
        if not self.get_case(tenant_id, case_id):
            return None
        with self.database.connect() as connection:
            rows = connection.execute(
                """SELECT * FROM investigation_replays
                   WHERE case_id = ? AND tenant_id = ? ORDER BY created_at DESC""",
                (case_id, tenant_id),
            ).fetchall()
        return [_decode_replay(row) for row in rows]
