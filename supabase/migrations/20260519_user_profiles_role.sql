-- ============================================================================
-- Migration: 20260519_user_profiles_role.sql
-- ============================================================================
-- Description: Add account role to user_profiles for test users and family admins.
--
--   role values:
--     test          — QA / synthetic accounts (safe to purge, no prod side effects)
--     user          — default consumer account
--     family_admin  — primary account on a family plan (manages family_members)
-- ============================================================================

ALTER TABLE public.user_profiles
    ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';

ALTER TABLE public.user_profiles
    DROP CONSTRAINT IF EXISTS user_profiles_role_check;

ALTER TABLE public.user_profiles
    ADD CONSTRAINT user_profiles_role_check
    CHECK (role IN ('test', 'user', 'family_admin'));

COMMENT ON COLUMN public.user_profiles.role IS
    'Account role: test (QA), user (default), family_admin (family plan owner).';

CREATE INDEX IF NOT EXISTS idx_user_profiles_role
    ON public.user_profiles (role)
    WHERE role = 'test';

-- Prevent authenticated clients from escalating or changing role via RLS UPDATE.
-- Service role and SECURITY DEFINER functions may set role on insert/update.
CREATE OR REPLACE FUNCTION public.protect_user_profiles_role()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF auth.role() IS DISTINCT FROM 'service_role' THEN
            NEW.role := 'user';
        END IF;
        RETURN NEW;
    END IF;

    IF NEW.role IS DISTINCT FROM OLD.role AND auth.role() IS DISTINCT FROM 'service_role' THEN
        NEW.role := OLD.role;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_protect_user_profiles_role ON public.user_profiles;

CREATE TRIGGER trigger_protect_user_profiles_role
    BEFORE INSERT OR UPDATE OF role ON public.user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_user_profiles_role();
