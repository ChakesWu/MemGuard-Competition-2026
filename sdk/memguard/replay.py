"""Run an isolated agent callable and record its replay result."""

from __future__ import annotations

import hashlib
import json
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Callable


@dataclass(frozen=True)
class ReplayContext:
    """Controls that the integration must apply while executing the replay."""

    disabled_event_ids: tuple[str, ...]


class ReplayRunner:
    """Execute a caller-provided agent function and persist the observed result."""

    def __init__(
        self,
        *,
        record: Callable[[str, dict[str, Any]], dict[str, Any]],
        runner_name: str = "memguard-local",
    ) -> None:
        self.record = record
        self.runner_name = runner_name

    def run(
        self,
        *,
        case_id: str,
        variant_label: str,
        input_payload: Any,
        execute: Callable[[Any, ReplayContext], Any],
        disabled_event_ids: list[str] | None = None,
        code_revision: str | None = None,
        model: str | None = None,
        prompt_hash: str | None = None,
    ) -> dict[str, Any]:
        canonical_input = json.dumps(
            input_payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False
        )
        input_snapshot_hash = "sha256:" + hashlib.sha256(
            canonical_input.encode("utf-8")
        ).hexdigest()
        context = ReplayContext(tuple(disabled_event_ids or ()))
        started_at = datetime.now(timezone.utc)
        result = execute(input_payload, context)
        finished_at = datetime.now(timezone.utc)
        output = result if isinstance(result, str) else json.dumps(
            result, sort_keys=True, separators=(",", ":"), ensure_ascii=False
        )
        return self.record(case_id, {
            "variant_label": variant_label,
            "output": output,
            "disabled_event_ids": list(context.disabled_event_ids),
            "model": model,
            "prompt_hash": prompt_hash,
            "execution_origin": "external_runner",
            "run_id": str(uuid.uuid4()),
            "code_revision": code_revision,
            "input_snapshot_hash": input_snapshot_hash,
            "run_metadata": {
                "runner_name": self.runner_name,
                "input_payload": input_payload,
                "started_at": started_at.isoformat(),
                "finished_at": finished_at.isoformat(),
            },
        })
