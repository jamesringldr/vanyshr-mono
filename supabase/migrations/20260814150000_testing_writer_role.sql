-- ============================================================================
-- Migration: 20260814150000_testing_writer_role.sql
-- Purpose: Scoped Postgres role for scripts that write to testing.* directly
--          (run_summary_test.py et al.), so a leaked credential only reaches
--          test data -- not public or any other schema.
-- ============================================================================
-- No password is set here, deliberately -- this file is safe to commit
-- because a role with no password cannot log in. The password is generated
-- and applied out of band, then never stored in git.
--
-- Rotate it with:
--   ALTER ROLE testing_writer WITH PASSWORD '<new password>';
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'testing_writer') THEN
        CREATE ROLE testing_writer WITH LOGIN;
    END IF;
END
$$;

GRANT USAGE ON SCHEMA testing TO testing_writer;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA testing TO testing_writer;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA testing TO testing_writer;

-- So tables/sequences added to testing.* later don't need a follow-up grant.
ALTER DEFAULT PRIVILEGES IN SCHEMA testing
    GRANT SELECT, INSERT, UPDATE ON TABLES TO testing_writer;
ALTER DEFAULT PRIVILEGES IN SCHEMA testing
    GRANT USAGE, SELECT ON SEQUENCES TO testing_writer;
