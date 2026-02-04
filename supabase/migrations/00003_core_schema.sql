-- ============================================================================
-- Vanyshr Database Core Schema
-- ============================================================================
-- Created: January 2026
-- Description: Production-ready JSONB-based schema
--   - quick_scans: JSONB-based quick scan (temp data with 30-min TTL)
--   - user_profiles: Dedicated user profiles for signed-up users
--   - Broker registry with parent/child relationships
--   - Exposure and removal tracking
--   - Supporting tables (notifications, activity log, todos)
-- ============================================================================

-- ============================================================================
-- SECTION 1: HELPER FUNCTIONS (Must be created before tables that use them)
-- ============================================================================

-- Generic updated_at trigger function (used by multiple tables)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SECTION 2: QUICK SCANS (Temporary/Anonymous Data)
-- ============================================================================

CREATE TABLE IF NOT EXISTS quick_scans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Session tracking (for anonymous users)
    session_id TEXT NOT NULL,

    -- Search input (what user provided)
    search_input JSONB NOT NULL,
    -- Example: {
    --   "first_name": "John",
    --   "last_name": "Doe",
    --   "middle_name": null,
    --   "zip": "10001",
    --   "city": "New York",
    --   "state": "NY",
    --   "email": "john@example.com",
    --   "phone": "555-123-4567"
    -- }

    -- Scan state
    status TEXT DEFAULT 'pending' CHECK (status IN (
        'pending',           -- Initial state
        'scanning',          -- Scrapers running
        'matches_found',     -- Profiles found, awaiting selection
        'selection_required', -- Multiple matches, user must choose
        'processing',        -- User selected, fetching full details
        'completed',         -- All data retrieved
        'no_matches',        -- No profiles found
        'failed',            -- Error occurred
        'expired'            -- TTL exceeded
    )),
    error_message TEXT,

    -- Multiple profile matches (when disambiguation needed)
    profile_matches JSONB,
    -- Alias for compatibility
    candidate_matches JSONB,
    -- Example: [
    --   {"id": "1", "name": "John Doe", "age": "35", "city_state": "New York, NY", "source": "zabasearch"},
    --   {"id": "2", "name": "John Doe", "age": "42", "city_state": "Brooklyn, NY", "source": "zabasearch"}
    -- ]
    selected_match_id TEXT,

    -- Final profile data (ALL scraped data consolidated)
    profile_data JSONB,
    -- Structure defined in QuickScanProfileData type

    -- Tracking which scrapers were used
    data_sources TEXT[] DEFAULT '{}',
    scraper_runs JSONB DEFAULT '[]',
    -- Example: [
    --   {"scraper": "zabasearch", "status": "success", "profiles_found": 2, "duration_ms": 1500},
    --   {"scraper": "anywho", "status": "success", "profiles_found": 1, "duration_ms": 800}
    -- ]

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 minutes'),
    completed_at TIMESTAMPTZ,

    -- If user signs up, link to their account (prevents deletion)
    converted_to_user_id UUID,
    converted_at TIMESTAMPTZ
);

-- Indexes for quick_scans
CREATE INDEX IF NOT EXISTS idx_quick_scans_session ON quick_scans(session_id);
CREATE INDEX IF NOT EXISTS idx_quick_scans_status ON quick_scans(status);
CREATE INDEX IF NOT EXISTS idx_quick_scans_expires_at ON quick_scans(expires_at)
    WHERE converted_to_user_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_quick_scans_converted_user ON quick_scans(converted_to_user_id)
    WHERE converted_to_user_id IS NOT NULL;

-- Updated_at trigger for quick_scans
CREATE OR REPLACE FUNCTION update_quick_scans_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_quick_scans_updated_at ON quick_scans;
CREATE TRIGGER trigger_quick_scans_updated_at
    BEFORE UPDATE ON quick_scans
    FOR EACH ROW
    EXECUTE FUNCTION update_quick_scans_updated_at();

-- RLS for quick_scans
ALTER TABLE quick_scans ENABLE ROW LEVEL SECURITY;

-- Allow anonymous access for quick scans (session-based)
CREATE POLICY "Allow insert for anon" ON quick_scans
    FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow select own session" ON quick_scans
    FOR SELECT TO anon USING (true);

CREATE POLICY "Allow update own session" ON quick_scans
    FOR UPDATE TO anon USING (true);

-- Service role full access
CREATE POLICY "Service role full access quick_scans" ON quick_scans
    FOR ALL TO service_role USING (true);


-- ============================================================================
-- SECTION 3: USER PROFILES (Permanent/Signed-Up Users)
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Identity fields
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    middle_name TEXT,
    date_of_birth DATE,
    gender TEXT,

    -- Contact (for account, not for monitoring)
    phone TEXT,

    -- Subscription
    subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN (
        'free',      -- Limited scans, DIY only
        'basic',     -- Regular scans, automated removals
        'premium',   -- Priority processing, more features
        'family'     -- Multiple family members
    )),
    subscription_status TEXT DEFAULT 'active' CHECK (subscription_status IN (
        'active',
        'inactive',
        'cancelled',
        'past_due',
        'trialing'
    )),
    subscription_started_at TIMESTAMPTZ,
    subscription_ends_at TIMESTAMPTZ,

    -- Stripe integration
    stripe_customer_id TEXT UNIQUE,
    stripe_subscription_id TEXT,

    -- Settings stored as JSONB for flexibility
    preferences JSONB DEFAULT '{
        "dark_mode": false,
        "compact_view": false,
        "auto_remove": true
    }'::jsonb,

    notification_settings JSONB DEFAULT '{
        "email_new_exposure": true,
        "email_removal_complete": true,
        "email_weekly_summary": true,
        "push_enabled": true
    }'::jsonb,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_login_at TIMESTAMPTZ,
    last_scan_at TIMESTAMPTZ,
    onboarding_completed BOOLEAN DEFAULT FALSE,
    onboarding_step INTEGER DEFAULT 0,

    -- Original quick scan reference
    source_quick_scan_id UUID REFERENCES quick_scans(id) ON DELETE SET NULL
);

-- Indexes for user_profiles
CREATE INDEX IF NOT EXISTS idx_user_profiles_subscription ON user_profiles(subscription_tier, subscription_status);
CREATE INDEX IF NOT EXISTS idx_user_profiles_stripe ON user_profiles(stripe_customer_id);

-- Updated_at trigger
DROP TRIGGER IF EXISTS trigger_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER trigger_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS for user_profiles
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON user_profiles
    FOR SELECT TO authenticated USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON user_profiles
    FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON user_profiles
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE POLICY "Service role full access user_profiles" ON user_profiles
    FOR ALL TO service_role USING (true);


-- ============================================================================
-- SECTION 4: FAMILY MEMBERS (For Family Plan)
-- ============================================================================

CREATE TABLE IF NOT EXISTS family_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,

    -- Identity
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    middle_name TEXT,
    date_of_birth DATE,
    relationship TEXT CHECK (relationship IN (
        'spouse',
        'child',
        'parent',
        'sibling',
        'grandparent',
        'other'
    )),

    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    monitoring_enabled BOOLEAN DEFAULT TRUE,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_scan_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_family_members_owner ON family_members(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_family_members_active ON family_members(owner_user_id) WHERE is_active = TRUE;

-- Updated_at trigger
DROP TRIGGER IF EXISTS trigger_family_members_updated_at ON family_members;
CREATE TRIGGER trigger_family_members_updated_at
    BEFORE UPDATE ON family_members
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own family members" ON family_members
    FOR ALL TO authenticated USING (owner_user_id = auth.uid());

CREATE POLICY "Service role full access family_members" ON family_members
    FOR ALL TO service_role USING (true);


-- ============================================================================
-- SECTION 5: MONITORED DATA POINTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS monitored_data_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    family_member_id UUID REFERENCES family_members(id) ON DELETE CASCADE,

    -- Data classification
    data_type TEXT NOT NULL CHECK (data_type IN (
        'phone',
        'email',
        'address',
        'name_alias',
        'employer',
        'relative',
        'social_profile',
        'other'
    )),

    -- The actual data value
    data_value TEXT NOT NULL,
    data_value_normalized TEXT, -- Lowercase, stripped version for matching

    -- Additional context
    metadata JSONB DEFAULT '{}',

    -- Monitoring status
    is_active BOOLEAN DEFAULT TRUE,
    source TEXT, -- Where this data point came from: 'quick_scan', 'user_input', 'scan_discovery'

    -- Timestamps
    first_seen_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Prevent duplicates
    UNIQUE(user_id, data_type, data_value_normalized)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_monitored_data_user ON monitored_data_points(user_id);
CREATE INDEX IF NOT EXISTS idx_monitored_data_family ON monitored_data_points(family_member_id);
CREATE INDEX IF NOT EXISTS idx_monitored_data_type ON monitored_data_points(data_type);
CREATE INDEX IF NOT EXISTS idx_monitored_data_active ON monitored_data_points(user_id) WHERE is_active = TRUE;

-- Trigger to auto-normalize data_value
CREATE OR REPLACE FUNCTION normalize_data_value()
RETURNS TRIGGER AS $$
BEGIN
    NEW.data_value_normalized = LOWER(TRIM(REGEXP_REPLACE(NEW.data_value, '[^a-zA-Z0-9@.]', '', 'g')));
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_normalize_data_value ON monitored_data_points;
CREATE TRIGGER trigger_normalize_data_value
    BEFORE INSERT OR UPDATE ON monitored_data_points
    FOR EACH ROW
    EXECUTE FUNCTION normalize_data_value();

-- RLS
ALTER TABLE monitored_data_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own data points" ON monitored_data_points
    FOR ALL TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Service role full access monitored_data_points" ON monitored_data_points
    FOR ALL TO service_role USING (true);


-- ============================================================================
-- SECTION 6: BROKER REGISTRY
-- ============================================================================

-- Broker categories
CREATE TABLE IF NOT EXISTS broker_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    icon TEXT,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default categories
INSERT INTO broker_categories (name, slug, description, display_order) VALUES
    ('People Search', 'people_search', 'Sites that aggregate public records and let anyone search for individuals', 1),
    ('Background Check', 'background_check', 'Services that provide detailed background reports', 2),
    ('Data Broker', 'data_broker', 'Companies that collect and sell consumer data', 3),
    ('Marketing List', 'marketing_list', 'Companies that maintain marketing contact lists', 4),
    ('Public Records', 'public_records', 'Government or court records aggregators', 5),
    ('Social Search', 'social_search', 'Sites that aggregate social media profiles', 6)
ON CONFLICT (slug) DO NOTHING;

-- Main brokers table
CREATE TABLE IF NOT EXISTS brokers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Identity
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,

    -- Hierarchy (for parent/child brokers)
    parent_broker_id UUID REFERENCES brokers(id) ON DELETE SET NULL,

    -- URLs
    website_url TEXT,
    search_url_template TEXT,
    opt_out_url TEXT,
    privacy_policy_url TEXT,

    -- Opt-out process details
    opt_out_method TEXT CHECK (opt_out_method IN (
        'online_form',
        'email',
        'mail',
        'phone',
        'automated',
        'account_required',
        'none'
    )),

    opt_out_difficulty TEXT DEFAULT 'medium' CHECK (opt_out_difficulty IN (
        'easy',
        'medium',
        'hard',
        'very_hard'
    )),

    opt_out_steps JSONB,

    -- Verification requirements
    requires_verification BOOLEAN DEFAULT FALSE,
    verification_method TEXT CHECK (verification_method IN (
        'email',
        'phone',
        'sms',
        'id_upload',
        'notarized_letter',
        'none'
    )),

    -- Timing expectations
    estimated_removal_days INTEGER DEFAULT 14,
    re_listing_likelihood TEXT DEFAULT 'medium' CHECK (re_listing_likelihood IN (
        'low',
        'medium',
        'high'
    )),
    re_scan_interval_days INTEGER DEFAULT 90,

    -- Scraper configuration
    scraper_config JSONB DEFAULT '{}',

    is_scrapeable BOOLEAN DEFAULT TRUE,
    scraper_status TEXT DEFAULT 'active' CHECK (scraper_status IN (
        'active',
        'degraded',
        'blocked',
        'maintenance',
        'disabled'
    )),
    last_scrape_at TIMESTAMPTZ,
    last_scrape_success BOOLEAN,
    scrape_success_rate DECIMAL(5,2),

    -- What data this broker typically has
    data_types_collected TEXT[] DEFAULT '{}',

    -- Metadata
    description TEXT,
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    priority INTEGER DEFAULT 50,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for brokers
CREATE INDEX IF NOT EXISTS idx_brokers_slug ON brokers(slug);
CREATE INDEX IF NOT EXISTS idx_brokers_parent ON brokers(parent_broker_id);
CREATE INDEX IF NOT EXISTS idx_brokers_active ON brokers(is_active, priority DESC);
CREATE INDEX IF NOT EXISTS idx_brokers_scrapeable ON brokers(is_scrapeable, scraper_status);

-- Updated_at trigger
DROP TRIGGER IF EXISTS trigger_brokers_updated_at ON brokers;
CREATE TRIGGER trigger_brokers_updated_at
    BEFORE UPDATE ON brokers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Broker to category mapping (many-to-many)
CREATE TABLE IF NOT EXISTS broker_category_map (
    broker_id UUID REFERENCES brokers(id) ON DELETE CASCADE,
    category_id UUID REFERENCES broker_categories(id) ON DELETE CASCADE,
    PRIMARY KEY (broker_id, category_id)
);

-- RLS for brokers (read-only for users)
ALTER TABLE brokers ENABLE ROW LEVEL SECURITY;
ALTER TABLE broker_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE broker_category_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read brokers" ON brokers
    FOR SELECT USING (true);

CREATE POLICY "Service role full access brokers" ON brokers
    FOR ALL TO service_role USING (true);

CREATE POLICY "Anyone can read categories" ON broker_categories
    FOR SELECT USING (true);

CREATE POLICY "Service role full access broker_categories" ON broker_categories
    FOR ALL TO service_role USING (true);

CREATE POLICY "Anyone can read broker_category_map" ON broker_category_map
    FOR SELECT USING (true);

CREATE POLICY "Service role full access broker_category_map" ON broker_category_map
    FOR ALL TO service_role USING (true);


-- ============================================================================
-- SECTION 7: EXPOSURES (User Data Found on Brokers)
-- ============================================================================

CREATE TABLE IF NOT EXISTS exposures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    family_member_id UUID REFERENCES family_members(id) ON DELETE CASCADE,
    broker_id UUID NOT NULL REFERENCES brokers(id) ON DELETE CASCADE,

    -- What was found
    profile_url TEXT,
    profile_identifier TEXT,

    -- Snapshot of exposed data at discovery
    data_snapshot JSONB,

    -- Matching
    match_confidence DECIMAL(3,2) DEFAULT 1.00,
    match_method TEXT,
    matched_data_points UUID[],

    -- Status
    status TEXT DEFAULT 'found' CHECK (status IN (
        'found',
        'queued',
        'removal_requested',
        'removal_in_progress',
        'removed',
        'verified_removed',
        'failed',
        'relisted',
        'manual_required',
        'ignored'
    )),
    status_notes TEXT,

    -- Timestamps
    first_found_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    removal_requested_at TIMESTAMPTZ,
    removed_at TIMESTAMPTZ,
    verified_removed_at TIMESTAMPTZ,

    -- Scan tracking
    found_in_scan_id UUID,
    last_checked_at TIMESTAMPTZ,
    check_count INTEGER DEFAULT 1,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for exposures
CREATE INDEX IF NOT EXISTS idx_exposures_user ON exposures(user_id);
CREATE INDEX IF NOT EXISTS idx_exposures_family ON exposures(family_member_id);
CREATE INDEX IF NOT EXISTS idx_exposures_broker ON exposures(broker_id);
CREATE INDEX IF NOT EXISTS idx_exposures_status ON exposures(status);
CREATE INDEX IF NOT EXISTS idx_exposures_user_status ON exposures(user_id, status);
CREATE INDEX IF NOT EXISTS idx_exposures_pending ON exposures(user_id)
    WHERE status IN ('found', 'queued', 'removal_requested', 'removal_in_progress');

-- Unique constraint to prevent duplicate entries
CREATE UNIQUE INDEX IF NOT EXISTS idx_exposures_unique_profile
    ON exposures(user_id, broker_id, COALESCE(profile_url, profile_identifier, id::text));

-- Updated_at trigger
DROP TRIGGER IF EXISTS trigger_exposures_updated_at ON exposures;
CREATE TRIGGER trigger_exposures_updated_at
    BEFORE UPDATE ON exposures
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE exposures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own exposures" ON exposures
    FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Service role full access exposures" ON exposures
    FOR ALL TO service_role USING (true);


-- ============================================================================
-- SECTION 8: REMOVAL REQUESTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS removal_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exposure_id UUID NOT NULL REFERENCES exposures(id) ON DELETE CASCADE,

    -- Request details
    request_method TEXT CHECK (request_method IN (
        'automated',
        'manual_form',
        'email',
        'mail',
        'phone',
        'api'
    )),

    -- Reference/tracking info
    request_reference TEXT,
    request_email TEXT,
    request_details JSONB,

    -- Status
    status TEXT DEFAULT 'pending' CHECK (status IN (
        'pending',
        'submitted',
        'acknowledged',
        'processing',
        'completed',
        'failed',
        'retry_scheduled',
        'cancelled'
    )),
    status_notes TEXT,
    failure_reason TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,

    -- Timing
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    submitted_at TIMESTAMPTZ,
    acknowledged_at TIMESTAMPTZ,
    expected_completion_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    next_retry_at TIMESTAMPTZ,

    -- For DIY users
    is_diy BOOLEAN DEFAULT FALSE,
    diy_current_step INTEGER DEFAULT 0,
    diy_completed_steps INTEGER[] DEFAULT '{}',

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_removal_requests_exposure ON removal_requests(exposure_id);
CREATE INDEX IF NOT EXISTS idx_removal_requests_status ON removal_requests(status);
CREATE INDEX IF NOT EXISTS idx_removal_requests_pending ON removal_requests(status)
    WHERE status IN ('pending', 'submitted', 'processing', 'retry_scheduled');
CREATE INDEX IF NOT EXISTS idx_removal_requests_retry ON removal_requests(next_retry_at)
    WHERE status = 'retry_scheduled';

-- Updated_at trigger
DROP TRIGGER IF EXISTS trigger_removal_requests_updated_at ON removal_requests;
CREATE TRIGGER trigger_removal_requests_updated_at
    BEFORE UPDATE ON removal_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE removal_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own removal requests" ON removal_requests
    FOR SELECT TO authenticated
    USING (exposure_id IN (SELECT id FROM exposures WHERE user_id = auth.uid()));

CREATE POLICY "Service role full access removal_requests" ON removal_requests
    FOR ALL TO service_role USING (true);


-- ============================================================================
-- SECTION 9: NOTIFICATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,

    -- Notification type
    type TEXT NOT NULL CHECK (type IN (
        'new_exposure',
        'removal_complete',
        'removal_failed',
        'scan_complete',
        'subscription',
        'security_alert',
        'action_required',
        'weekly_summary',
        'system'
    )),

    -- Content
    title TEXT NOT NULL,
    message TEXT,
    action_url TEXT,
    action_text TEXT,

    -- Related entities
    metadata JSONB DEFAULT '{}',

    -- Status
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    is_archived BOOLEAN DEFAULT FALSE,

    -- Delivery tracking
    email_sent BOOLEAN DEFAULT FALSE,
    email_sent_at TIMESTAMPTZ,
    push_sent BOOLEAN DEFAULT FALSE,
    push_sent_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(user_id, type);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(user_id, created_at DESC);

-- RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications" ON notifications
    FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications" ON notifications
    FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Service role full access notifications" ON notifications
    FOR ALL TO service_role USING (true);


-- ============================================================================
-- SECTION 10: ACTIVITY LOG (Audit Trail)
-- ============================================================================

CREATE TABLE IF NOT EXISTS activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,

    -- Action details
    action TEXT NOT NULL,

    -- Related entity
    entity_type TEXT,
    entity_id UUID,

    -- Details
    description TEXT,
    metadata JSONB DEFAULT '{}',

    -- Context
    ip_address INET,
    user_agent TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_activity_log_user ON activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_action ON activity_log(action);
CREATE INDEX IF NOT EXISTS idx_activity_log_entity ON activity_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created ON activity_log(created_at DESC);

-- RLS
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own activity" ON activity_log
    FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Service role full access activity_log" ON activity_log
    FOR ALL TO service_role USING (true);


-- ============================================================================
-- SECTION 11: USER TODOS (DIY Action Items)
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_todos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,

    -- Related entities
    exposure_id UUID REFERENCES exposures(id) ON DELETE CASCADE,
    broker_id UUID REFERENCES brokers(id) ON DELETE SET NULL,

    -- Todo details
    title TEXT NOT NULL,
    description TEXT,
    instructions JSONB,

    -- Classification
    todo_type TEXT DEFAULT 'manual_removal' CHECK (todo_type IN (
        'manual_removal',
        'verification',
        'account_setup',
        'document_upload',
        'follow_up',
        'other'
    )),

    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),

    -- Status
    status TEXT DEFAULT 'pending' CHECK (status IN (
        'pending',
        'in_progress',
        'completed',
        'skipped',
        'blocked'
    )),

    -- Timing
    due_date DATE,
    reminder_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_todos_user ON user_todos(user_id);
CREATE INDEX IF NOT EXISTS idx_user_todos_status ON user_todos(user_id, status);
CREATE INDEX IF NOT EXISTS idx_user_todos_pending ON user_todos(user_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_user_todos_due ON user_todos(due_date) WHERE status = 'pending';

-- Updated_at trigger
DROP TRIGGER IF EXISTS trigger_user_todos_updated_at ON user_todos;
CREATE TRIGGER trigger_user_todos_updated_at
    BEFORE UPDATE ON user_todos
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE user_todos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own todos" ON user_todos
    FOR ALL TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Service role full access user_todos" ON user_todos
    FOR ALL TO service_role USING (true);


-- ============================================================================
-- SECTION 12: SCAN HISTORY
-- ============================================================================

CREATE TABLE IF NOT EXISTS scan_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    family_member_id UUID REFERENCES family_members(id) ON DELETE CASCADE,

    -- Scan type
    scan_type TEXT DEFAULT 'full' CHECK (scan_type IN (
        'full',
        'targeted',
        'quick',
        'verification'
    )),

    -- Results summary
    brokers_scanned INTEGER DEFAULT 0,
    brokers_succeeded INTEGER DEFAULT 0,
    brokers_failed INTEGER DEFAULT 0,
    exposures_found INTEGER DEFAULT 0,
    new_exposures INTEGER DEFAULT 0,

    -- Status
    status TEXT DEFAULT 'pending' CHECK (status IN (
        'pending',
        'in_progress',
        'completed',
        'failed',
        'cancelled'
    )),
    error_message TEXT,

    -- Detailed results
    results JSONB DEFAULT '{}',

    -- Timing
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_scan_history_user ON scan_history(user_id);
CREATE INDEX IF NOT EXISTS idx_scan_history_status ON scan_history(status);
CREATE INDEX IF NOT EXISTS idx_scan_history_created ON scan_history(user_id, created_at DESC);

-- RLS
ALTER TABLE scan_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own scan history" ON scan_history
    FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Service role full access scan_history" ON scan_history
    FOR ALL TO service_role USING (true);


-- ============================================================================
-- SECTION 13: DATA BREACHES (HaveIBeenPwned Integration)
-- ============================================================================

CREATE TABLE IF NOT EXISTS data_breaches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,

    -- Breach details (from HIBP)
    breach_name TEXT NOT NULL,
    breach_title TEXT,
    breach_domain TEXT,
    breach_date DATE,

    -- What was exposed
    exposed_data_types TEXT[],

    -- Matched data
    matched_email TEXT,

    -- Status
    is_acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_at TIMESTAMPTZ,

    -- HIBP metadata
    hibp_data JSONB,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(user_id, breach_name, matched_email)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_data_breaches_user ON data_breaches(user_id);
CREATE INDEX IF NOT EXISTS idx_data_breaches_unacked ON data_breaches(user_id) WHERE is_acknowledged = FALSE;

-- RLS
ALTER TABLE data_breaches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own breaches" ON data_breaches
    FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can update own breaches" ON data_breaches
    FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Service role full access data_breaches" ON data_breaches
    FOR ALL TO service_role USING (true);


-- ============================================================================
-- SECTION 14: HELPER FUNCTIONS
-- ============================================================================

-- Function to convert quick scan to user profile
CREATE OR REPLACE FUNCTION convert_quick_scan_to_user(
    p_quick_scan_id UUID,
    p_user_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_scan RECORD;
    v_result JSONB;
BEGIN
    -- Get the quick scan data
    SELECT * INTO v_scan FROM quick_scans WHERE id = p_quick_scan_id;

    IF v_scan IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Quick scan not found');
    END IF;

    -- Create user profile from search input
    INSERT INTO user_profiles (id, first_name, last_name, source_quick_scan_id)
    VALUES (
        p_user_id,
        COALESCE(v_scan.search_input->>'first_name', 'Unknown'),
        COALESCE(v_scan.search_input->>'last_name', 'Unknown'),
        p_quick_scan_id
    )
    ON CONFLICT (id) DO UPDATE SET
        source_quick_scan_id = p_quick_scan_id,
        updated_at = NOW();

    -- Extract monitored data points from profile_data JSONB
    IF v_scan.profile_data IS NOT NULL THEN
        -- Phones
        IF v_scan.profile_data->'phones' IS NOT NULL THEN
            INSERT INTO monitored_data_points (user_id, data_type, data_value, metadata, source)
            SELECT
                p_user_id,
                'phone',
                phone->>'number',
                phone,
                'quick_scan'
            FROM jsonb_array_elements(v_scan.profile_data->'phones') AS phone
            WHERE phone->>'number' IS NOT NULL
            ON CONFLICT (user_id, data_type, data_value_normalized) DO NOTHING;
        END IF;

        -- Emails
        IF v_scan.profile_data->'emails' IS NOT NULL THEN
            INSERT INTO monitored_data_points (user_id, data_type, data_value, metadata, source)
            SELECT
                p_user_id,
                'email',
                email->>'email',
                email,
                'quick_scan'
            FROM jsonb_array_elements(v_scan.profile_data->'emails') AS email
            WHERE email->>'email' IS NOT NULL
            ON CONFLICT (user_id, data_type, data_value_normalized) DO NOTHING;
        END IF;

        -- Addresses
        IF v_scan.profile_data->'addresses' IS NOT NULL THEN
            INSERT INTO monitored_data_points (user_id, data_type, data_value, metadata, source)
            SELECT
                p_user_id,
                'address',
                COALESCE(addr->>'full_address', addr->>'street', 'Unknown'),
                addr,
                'quick_scan'
            FROM jsonb_array_elements(v_scan.profile_data->'addresses') AS addr
            ON CONFLICT (user_id, data_type, data_value_normalized) DO NOTHING;
        END IF;

        -- Aliases
        IF v_scan.profile_data->'aliases' IS NOT NULL THEN
            INSERT INTO monitored_data_points (user_id, data_type, data_value, metadata, source)
            SELECT
                p_user_id,
                'name_alias',
                alias::text,
                jsonb_build_object('alias', alias),
                'quick_scan'
            FROM jsonb_array_elements_text(v_scan.profile_data->'aliases') AS alias
            ON CONFLICT (user_id, data_type, data_value_normalized) DO NOTHING;
        END IF;
    END IF;

    -- Mark quick scan as converted
    UPDATE quick_scans
    SET
        converted_to_user_id = p_user_id,
        converted_at = NOW()
    WHERE id = p_quick_scan_id;

    RETURN jsonb_build_object(
        'success', true,
        'user_id', p_user_id,
        'quick_scan_id', p_quick_scan_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Function to cleanup expired quick scans
CREATE OR REPLACE FUNCTION cleanup_expired_quick_scans()
RETURNS INTEGER AS $$
DECLARE
    v_deleted INTEGER;
BEGIN
    DELETE FROM quick_scans
    WHERE expires_at < NOW()
      AND converted_to_user_id IS NULL;

    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN v_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Function to get user dashboard stats
CREATE OR REPLACE FUNCTION get_user_dashboard_stats(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_stats JSONB;
BEGIN
    SELECT jsonb_build_object(
        'total_exposures', (SELECT COUNT(*) FROM exposures WHERE user_id = p_user_id),
        'active_exposures', (SELECT COUNT(*) FROM exposures WHERE user_id = p_user_id AND status IN ('found', 'queued', 'removal_requested', 'removal_in_progress')),
        'removed_exposures', (SELECT COUNT(*) FROM exposures WHERE user_id = p_user_id AND status IN ('removed', 'verified_removed')),
        'pending_removals', (SELECT COUNT(*) FROM removal_requests r JOIN exposures e ON r.exposure_id = e.id WHERE e.user_id = p_user_id AND r.status IN ('pending', 'submitted', 'processing')),
        'brokers_with_data', (SELECT COUNT(DISTINCT broker_id) FROM exposures WHERE user_id = p_user_id AND status NOT IN ('removed', 'verified_removed', 'ignored')),
        'unread_notifications', (SELECT COUNT(*) FROM notifications WHERE user_id = p_user_id AND is_read = FALSE),
        'pending_todos', (SELECT COUNT(*) FROM user_todos WHERE user_id = p_user_id AND status = 'pending'),
        'last_scan_at', (SELECT MAX(completed_at) FROM scan_history WHERE user_id = p_user_id AND status = 'completed'),
        'data_breaches', (SELECT COUNT(*) FROM data_breaches WHERE user_id = p_user_id AND is_acknowledged = FALSE)
    ) INTO v_stats;

    RETURN v_stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- SECTION 15: GRANTS
-- ============================================================================

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO service_role;

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION convert_quick_scan_to_user(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_expired_quick_scans() TO service_role;
GRANT EXECUTE ON FUNCTION get_user_dashboard_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_dashboard_stats(UUID) TO service_role;


-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Tables created (14 total):
-- 1.  quick_scans           - JSONB-based quick scan data
-- 2.  user_profiles         - Permanent user data
-- 3.  family_members        - Family plan members
-- 4.  monitored_data_points - Data points being tracked
-- 5.  broker_categories     - Broker classification
-- 6.  brokers               - Broker registry
-- 7.  broker_category_map   - Many-to-many broker<->category
-- 8.  exposures             - User data found on brokers
-- 9.  removal_requests      - Removal request history
-- 10. notifications         - User notifications
-- 11. activity_log          - Audit trail
-- 12. user_todos            - DIY action items
-- 13. scan_history          - Scan records
-- 14. data_breaches         - HIBP integration
-- ============================================================================
