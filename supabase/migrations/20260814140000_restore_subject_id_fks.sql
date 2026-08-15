-- ============================================================================
-- Migration: 20260814140000_restore_subject_id_fks.sql
-- Purpose: Re-add the subject_id -> test_subjects(id) foreign keys that were
--          dropped when the CSV import recreated testing.test_subjects.
-- ============================================================================
-- Dropping a table CASCADEs to drop FK constraints that point at it, but does
-- not recreate them once the table comes back. The CSV import into
-- test_subjects took the table down that path, leaving subject_id as a plain
-- (unconstrained) TEXT column on all 5 dependent tables. Confirmed via
-- pg_constraint before writing this: no subject_id FK exists on any of them.
--
-- All 5 tables are still empty, so this is a plain ADD CONSTRAINT -- no
-- orphaned subject_id values to clean up first.
-- ============================================================================

ALTER TABLE testing.summary_results
    ADD CONSTRAINT summary_results_subject_id_fkey
    FOREIGN KEY (subject_id) REFERENCES testing.test_subjects(id) ON DELETE CASCADE;

ALTER TABLE testing.full_profile_results
    ADD CONSTRAINT full_profile_results_subject_id_fkey
    FOREIGN KEY (subject_id) REFERENCES testing.test_subjects(id) ON DELETE CASCADE;

ALTER TABLE testing.holehe_results
    ADD CONSTRAINT holehe_results_subject_id_fkey
    FOREIGN KEY (subject_id) REFERENCES testing.test_subjects(id) ON DELETE CASCADE;

ALTER TABLE testing.leakcheck_results
    ADD CONSTRAINT leakcheck_results_subject_id_fkey
    FOREIGN KEY (subject_id) REFERENCES testing.test_subjects(id) ON DELETE CASCADE;

ALTER TABLE testing.data_points
    ADD CONSTRAINT data_points_subject_id_fkey
    FOREIGN KEY (subject_id) REFERENCES testing.test_subjects(id) ON DELETE CASCADE;
