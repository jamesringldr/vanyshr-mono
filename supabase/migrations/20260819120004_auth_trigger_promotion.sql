-- ============================================================================
-- Migration: 20260819120004_auth_trigger_promotion.sql
-- ============================================================================
-- Description: Teach the auth.users trigger about the quickscan partition.
--
-- ⚠️  Without this migration the partition silently destroys user data.
--
-- The bug it fixes:
--   handle_new_auth_user() fires AFTER INSERT ON auth.users and races the
--   link-auth-to-profile Edge Function — by design; whichever wins, the other
--   sees the work already done.
--
--   Its Guard A branch tests `EXISTS (SELECT 1 FROM public.user_profiles
--   WHERE id = profile_id)`. Before this partition that row was always there,
--   written by create_pending_profile(). It now lives in
--   quickscan.pending_profiles instead, so that test returns FALSE and the
--   function falls into its "profile doesn't exist" branch — which inserts a
--   BARE profile using the same UUID, carrying only the name from auth
--   metadata.
--
--   promote_pending_profile() then finds that id already present in
--   public.user_profiles, concludes the promotion already happened, and
--   returns early. The pending phones, addresses, aliases and emails are never
--   copied — and the pending row is left to be deleted by the purge job 7 days
--   later. The user converts and their entire scan result is gone.
--
-- The fix: Guard A promotes from quickscan instead of testing public, and only
--   falls back to creating a bare profile when there is genuinely nothing to
--   promote (e.g. the pending row was already purged).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_meta        JSONB := NEW.raw_user_meta_data;
    v_profile_id  UUID;
    v_scan_id     UUID;
    v_first_name  TEXT;
    v_last_name   TEXT;
    v_promoted    JSONB;
BEGIN
    -- ── Guard A: quick-scan → magic-link flow ──────────────────────────────
    -- profile_id was embedded in the magic link metadata by the frontend and
    -- refers to a quickscan.pending_profiles row.

    IF (v_meta->>'profile_id') IS NOT NULL THEN

        BEGIN
            v_profile_id := (v_meta->>'profile_id')::uuid;
        EXCEPTION WHEN invalid_text_representation THEN
            v_profile_id := NULL;
        END;

        IF v_profile_id IS NOT NULL THEN

            -- Promote pending → public, carrying the harvested PII across.
            -- Idempotent: if the Edge Function already won the race this
            -- returns success with note='already promoted' and changes nothing.
            v_promoted := public.promote_pending_profile(
                v_profile_id, NEW.id, NEW.email
            );

            IF (v_promoted->>'success')::boolean THEN
                RETURN NEW;
            END IF;

            -- Promotion failed — the only expected cause is that the pending
            -- row is gone (purged after its 7-day window while an old magic
            -- link sat unopened in an inbox). Fall through and create a bare
            -- profile so the person can still sign in; their scan data is not
            -- recoverable at this point, which is the intended retention
            -- outcome rather than an error.
            RAISE WARNING 'handle_new_auth_user: no pending profile % to promote (%); creating bare profile',
                v_profile_id, v_promoted->>'error';

            IF NOT EXISTS (
                SELECT 1 FROM public.user_profiles WHERE id = v_profile_id
            ) THEN
                v_first_name := COALESCE(NULLIF(trim(v_meta->>'first_name'), ''), '');
                v_last_name  := COALESCE(NULLIF(trim(v_meta->>'last_name'),  ''), '');

                BEGIN
                    v_scan_id := (v_meta->>'source_quick_scan_id')::uuid;
                EXCEPTION WHEN invalid_text_representation THEN
                    v_scan_id := NULL;
                END;

                INSERT INTO public.user_profiles (
                    id, auth_user_id, first_name, last_name, email,
                    signup_status, subscription_tier, subscription_status,
                    source_quick_scan_id, onboarding_completed, onboarding_step
                ) VALUES (
                    v_profile_id, NEW.id, v_first_name, v_last_name, NEW.email,
                    'active', 'free', 'active',
                    v_scan_id, FALSE, 0
                );

                PERFORM public.initialize_onboarding_steps(v_profile_id);

                UPDATE public.user_onboarding_progress
                SET status = 'completed', completed_at = NOW(), updated_at = NOW()
                WHERE user_id = v_profile_id AND step = 'account_signup';

                INSERT INTO public.user_emails (
                    user_id, email, is_primary,
                    source, user_confirmed_status, confirmed_at
                ) VALUES (
                    v_profile_id, NEW.email, TRUE,
                    'auth', 'confirmed', NOW()
                )
                ON CONFLICT (user_id, email) DO NOTHING;
            END IF;

            RETURN NEW;
        END IF;
    END IF;

    -- ── Guard B: direct signup — no prior scan ─────────────────────────────
    -- Unchanged from 20260304144344.

    IF EXISTS (SELECT 1 FROM public.user_profiles WHERE auth_user_id = NEW.id LIMIT 1) THEN
        RETURN NEW;
    END IF;

    v_profile_id := gen_random_uuid();
    v_first_name := COALESCE(NULLIF(trim(v_meta->>'first_name'), ''), '');
    v_last_name  := COALESCE(NULLIF(trim(v_meta->>'last_name'),  ''), '');

    INSERT INTO public.user_profiles (
        id, auth_user_id, first_name, last_name, email,
        signup_status, subscription_tier, subscription_status,
        onboarding_completed, onboarding_step
    ) VALUES (
        v_profile_id, NEW.id, v_first_name, v_last_name, NEW.email,
        'active', 'free', 'active',
        FALSE, 0
    );

    PERFORM public.initialize_onboarding_steps(v_profile_id);

    UPDATE public.user_onboarding_progress
    SET status = 'completed', completed_at = NOW(), updated_at = NOW()
    WHERE user_id = v_profile_id AND step = 'account_signup';

    INSERT INTO public.user_emails (
        user_id, email, is_primary,
        source, user_confirmed_status, confirmed_at
    ) VALUES (
        v_profile_id, NEW.email, TRUE,
        'auth', 'confirmed', NOW()
    )
    ON CONFLICT (user_id, email) DO NOTHING;

    RETURN NEW;

EXCEPTION WHEN OTHERS THEN
    -- A profile creation failure must NOT block authentication.
    RAISE WARNING 'handle_new_auth_user: failed for auth uid=%: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- Trigger definition itself is unchanged; re-asserted for clarity.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_auth_user();


-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- handle_new_auth_user() now promotes from quickscan.pending_profiles rather
-- than assuming the pre-auth row is already in public.user_profiles.
--
-- Ordering requirement: this migration MUST be applied together with
-- 20260819120002 (which defines promote_pending_profile) and 20260819120003
-- (which moves the pre-auth rows). Applying the partition without this file
-- results in silent data loss on every conversion.
-- ============================================================================
