"""Small, dependency-free schema migration runner for pilot deployments."""

from __future__ import annotations

from datetime import datetime, timezone

from .database import DatabaseConfig


INITIAL_SCHEMA = (
    """
    CREATE TABLE IF NOT EXISTS memory_events (
        event_id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        agent_id TEXT NOT NULL,
        memory_id TEXT NOT NULL,
        trace_id TEXT,
        event_type TEXT NOT NULL,
        source_type TEXT NOT NULL,
        content TEXT,
        content_hash TEXT,
        policy_decision TEXT NOT NULL DEFAULT 'allow',
        trust_score REAL NOT NULL DEFAULT 50.0,
        created_at TEXT NOT NULL,
        parent_event_id TEXT,
        embedding_json TEXT DEFAULT '[]',
        metadata_json TEXT DEFAULT '{}'
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS decision_traces (
        trace_id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        agent_id TEXT NOT NULL,
        session_id TEXT,
        timestamp TEXT NOT NULL,
        input_memory_ids_json TEXT DEFAULT '[]',
        input_memory_events_json TEXT DEFAULT '[]',
        user_input TEXT,
        llm_prompt_hash TEXT,
        llm_output TEXT,
        llm_output_hash TEXT,
        llm_model TEXT,
        output_memory_ids_json TEXT DEFAULT '[]',
        output_memory_events_json TEXT DEFAULT '[]',
        memory_influence_scores_json TEXT DEFAULT '{}',
        total_influence_score REAL DEFAULT 0.0,
        metadata_json TEXT DEFAULT '{}'
    )
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_events_agent
    ON memory_events(tenant_id, agent_id, created_at DESC)
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_events_memory
    ON memory_events(memory_id)
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_traces_agent
    ON decision_traces(tenant_id, agent_id)
    """,
)

INVESTIGATION_SCHEMA = (
    """
    CREATE TABLE IF NOT EXISTS investigation_cases (
        case_id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        trace_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'open',
        expected_contains_json TEXT NOT NULL DEFAULT '[]',
        forbidden_contains_json TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS investigation_replays (
        replay_id TEXT PRIMARY KEY,
        case_id TEXT NOT NULL,
        tenant_id TEXT NOT NULL,
        variant_label TEXT NOT NULL,
        output TEXT NOT NULL,
        disabled_event_ids_json TEXT NOT NULL DEFAULT '[]',
        model TEXT,
        prompt_hash TEXT,
        run_metadata_json TEXT NOT NULL DEFAULT '{}',
        assertions_json TEXT NOT NULL DEFAULT '{}',
        passed INTEGER NOT NULL,
        created_at TEXT NOT NULL
    )
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_cases_tenant_updated
    ON investigation_cases(tenant_id, updated_at DESC)
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_replays_tenant_case
    ON investigation_replays(tenant_id, case_id, created_at DESC)
    """,
)

TRACE_SNAPSHOT_SCHEMA = (
    "ALTER TABLE decision_traces ADD COLUMN evidence_snapshot_json TEXT",
    """ALTER TABLE investigation_replays
       ADD COLUMN verification_status TEXT NOT NULL DEFAULT 'not_configured'""",
    """UPDATE investigation_replays
       SET verification_status = CASE WHEN passed = 1 THEN 'passed' ELSE 'failed' END
       WHERE case_id IN (
           SELECT case_id FROM investigation_cases
           WHERE expected_contains_json <> '[]' OR forbidden_contains_json <> '[]'
       )""",
)

INVESTIGATION_PROVENANCE_SCHEMA = (
    "ALTER TABLE investigation_cases ADD COLUMN suspected_source_id TEXT",
    "ALTER TABLE investigation_cases ADD COLUMN suspected_source_version TEXT",
    "ALTER TABLE investigation_cases ADD COLUMN remediation_summary TEXT",
    "ALTER TABLE investigation_cases ADD COLUMN remediation_reference TEXT",
    """ALTER TABLE investigation_replays
       ADD COLUMN execution_origin TEXT NOT NULL DEFAULT 'manual_import'""",
    "ALTER TABLE investigation_replays ADD COLUMN run_id TEXT",
    "ALTER TABLE investigation_replays ADD COLUMN code_revision TEXT",
    "ALTER TABLE investigation_replays ADD COLUMN input_snapshot_hash TEXT",
)


def apply_migrations(database: DatabaseConfig) -> None:
    """Apply every known migration exactly once to the selected database."""
    with database.connect() as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version INTEGER PRIMARY KEY,
                applied_at TEXT NOT NULL
            )
            """
        )
        applied_versions = {
            row["version"]
            for row in connection.execute("SELECT version FROM schema_migrations").fetchall()
        }
        if 1 not in applied_versions:
            for statement in INITIAL_SCHEMA:
                connection.execute(statement)
            connection.execute(
                "INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)",
                (1, datetime.now(timezone.utc).isoformat()),
            )
        if 2 not in applied_versions:
            for statement in INVESTIGATION_SCHEMA:
                connection.execute(statement)
            connection.execute(
                "INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)",
                (2, datetime.now(timezone.utc).isoformat()),
            )
        if 3 not in applied_versions:
            for statement in TRACE_SNAPSHOT_SCHEMA:
                connection.execute(statement)
            connection.execute(
                "INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)",
                (3, datetime.now(timezone.utc).isoformat()),
            )
        if 4 not in applied_versions:
            for statement in INVESTIGATION_PROVENANCE_SCHEMA:
                connection.execute(statement)
            connection.execute(
                "INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)",
                (4, datetime.now(timezone.utc).isoformat()),
            )
        connection.commit()
