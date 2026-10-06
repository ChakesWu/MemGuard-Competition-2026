"""Contract tests for MemGuard's versioned database migrations."""

import pathlib
import sys
import tempfile
import unittest


sys.path.insert(0, str(pathlib.Path(__file__).parent.parent / "backend"))


class MigrationTests(unittest.TestCase):
    def test_initial_schema_migration_is_recorded_and_idempotent(self):
        from app.database import DatabaseConfig
        from app.migrations import apply_migrations

        with tempfile.TemporaryDirectory(prefix="memguard-migrations-") as directory:
            database = DatabaseConfig(url=f"sqlite:///{directory}/memguard.db", driver="sqlite")

            apply_migrations(database)
            apply_migrations(database)

            with database.connect() as connection:
                versions = connection.execute(
                    "SELECT version FROM schema_migrations ORDER BY version"
                ).fetchall()
                events_table = connection.execute(
                    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'memory_events'"
                ).fetchone()

        self.assertEqual([row["version"] for row in versions], [1, 2, 3, 4])
        self.assertIsNotNone(events_table)

    def test_replay_verification_status_is_backfilled_from_existing_case_rules(self):
        from app.database import DatabaseConfig
        from app.migrations import INITIAL_SCHEMA, INVESTIGATION_SCHEMA, apply_migrations

        with tempfile.TemporaryDirectory(prefix="memguard-migrations-") as directory:
            database = DatabaseConfig(url=f"sqlite:///{directory}/memguard.db", driver="sqlite")
            with database.connect() as connection:
                connection.execute(
                    "CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)"
                )
                for statement in INITIAL_SCHEMA + INVESTIGATION_SCHEMA:
                    connection.execute(statement)
                connection.execute("INSERT INTO schema_migrations VALUES (1, 'now')")
                connection.execute("INSERT INTO schema_migrations VALUES (2, 'now')")
                connection.execute(
                    """INSERT INTO investigation_cases(
                           case_id, tenant_id, trace_id, title, expected_contains_json,
                           forbidden_contains_json, created_at, updated_at
                       ) VALUES ('case-1', 'tenant-1', 'trace-1', 'Existing case',
                                 '[\"14 days\"]', '[]', 'now', 'now')"""
                )
                connection.execute(
                    """INSERT INTO investigation_replays(
                           replay_id, case_id, tenant_id, variant_label, output,
                           assertions_json, passed, created_at
                       ) VALUES ('replay-1', 'case-1', 'tenant-1', 'before upgrade',
                                 'Refunds take 14 days.', '{}', 1, 'now')"""
                )
                connection.commit()

            apply_migrations(database)

            with database.connect() as connection:
                status = connection.execute(
                    "SELECT verification_status FROM investigation_replays WHERE replay_id = 'replay-1'"
                ).fetchone()["verification_status"]

        self.assertEqual(status, "passed")


if __name__ == "__main__":
    unittest.main()
