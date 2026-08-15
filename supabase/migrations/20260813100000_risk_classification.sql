-- Risk classification for exposed data types.
--
-- Feeds the pilot-scan risk summary hex map
-- (apps/app/src/pages/pilot-scan/risk-summary.tsx), which currently renders
-- hardcoded placeholder scores. Its six points are Critical, Scam, Spam,
-- Identity Theft, Accounts and Family.
--
-- Those six are not one axis, and modelling them as one enum would force a
-- false choice: a date of birth is both "critical" and "identity theft", and a
-- phone number feeds spam, scam and identity verification at once. So:
--
--   severity   how damaging this data type is on its own. One value per type.
--              Critical on the chart is a rollup of the worst of these, not a
--              category anything is filed under.
--
--   category   what a bad actor does with it, or whose it is. A type carries a
--              weight in as many categories as apply, hence the separate
--              weights table rather than a column per category.
--
-- Weights are seeded, not hardcoded in the app, because they will be tuned --
-- and tuning them should not need a deploy.
--
-- Field-by-field provenance of these data types is in docs/scraper-data-flow.md.

-- ---------------------------------------------------------------------------
-- Data types and their standalone severity
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.risk_data_types (
    data_type   TEXT PRIMARY KEY,

    -- Human label for the UI
    label       TEXT NOT NULL,

    -- Where this type comes from, so the rollup can be filtered by phase
    origin      TEXT NOT NULL
        CHECK (origin IN ('broker', 'breach', 'account')),

    -- Standalone damage potential, independent of category. Drives the
    -- Critical point on the chart.
    severity    TEXT NOT NULL
        CHECK (severity IN ('low', 'medium', 'high', 'critical')),

    -- Ordering weight for "worst first" lists; higher is worse
    severity_rank INT NOT NULL,

    notes       TEXT,

    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.risk_data_types IS
    'One row per kind of exposed data, with how damaging it is on its own. '
    'Severity is deliberately separate from category: the same data point is '
    'usually both severe and useful for several kinds of attack.';

COMMENT ON COLUMN public.risk_data_types.origin IS
    'broker = published by a people-search site; breach = leaked in a breach '
    '(leakcheck fields_exposed); account = an account existence signal (holehe).';

-- ---------------------------------------------------------------------------
-- Category weights (many-to-many)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.risk_data_type_categories (
    data_type   TEXT NOT NULL REFERENCES public.risk_data_types(data_type) ON DELETE CASCADE,

    -- The chart's points, minus Critical, which is computed from severity
    category    TEXT NOT NULL
        CHECK (category IN ('scam', 'spam', 'identity', 'accounts', 'family')),

    -- How much this data type contributes to that category, 0..1
    weight      NUMERIC(3,2) NOT NULL CHECK (weight > 0 AND weight <= 1),

    PRIMARY KEY (data_type, category)
);

COMMENT ON TABLE public.risk_data_type_categories IS
    'How much each data type feeds each risk category. Many-to-many on '
    'purpose: a phone number is a spam vector, a scam vector and an identity '
    'verification factor simultaneously.';

CREATE INDEX IF NOT EXISTS idx_risk_data_type_categories_category
    ON public.risk_data_type_categories(category);

-- ---------------------------------------------------------------------------
-- Seed: data types
-- ---------------------------------------------------------------------------
-- Every type below is one the pipeline actually produces. Broker fields come
-- from the four people-search scrapers; breach fields are the values observed
-- in leakcheck's fields_exposed; account rows come from holehe.

INSERT INTO public.risk_data_types (data_type, label, origin, severity, severity_rank, notes) VALUES
    -- Broker-published
    ('full_name',        'Full name',            'broker',  'low',      10, 'Public by itself; dangerous in combination'),
    ('alias',            'Alias / former name',  'broker',  'medium',   30, 'Maiden names are a common security answer'),
    ('age',              'Age',                  'broker',  'low',      15, NULL),
    ('date_of_birth',    'Date of birth',        'broker',  'critical', 90, 'Primary identity verification factor'),
    ('current_address',  'Current address',      'broker',  'high',     70, 'Physical safety as well as identity'),
    ('previous_address', 'Previous address',     'broker',  'medium',   40, 'Common knowledge-based auth question'),
    ('phone',            'Phone number',         'broker',  'high',     60, 'SIM-swap and vishing target'),
    ('phone_carrier',    'Phone carrier',        'broker',  'medium',   35, 'Materially eases SIM-swap attacks'),
    ('email',            'Email address',        'broker',  'high',     65, 'Account recovery pivot'),
    ('relative_name',    'Relative name',        'broker',  'medium',   45, 'Third party, and a KBA answer'),
    ('household_member', 'Household member',     'broker',  'medium',   42, 'Third party'),
    ('property',         'Property record',      'broker',  'medium',   38, NULL),
    ('coordinates',      'Home coordinates',     'broker',  'high',     72, 'Precise physical location'),
    ('county',           'County',               'broker',  'low',      12, NULL),

    -- Breach-exposed (leakcheck fields_exposed)
    ('password',         'Password',             'breach',  'critical', 100, 'Directly enables account takeover'),
    ('breach_dob',       'Date of birth (breach)','breach', 'critical', 92, NULL),
    ('breach_address',   'Address (breach)',     'breach',  'high',     68, NULL),
    ('breach_street',    'Street (breach)',      'breach',  'high',     66, NULL),
    ('breach_zip',       'Postal code (breach)', 'breach',  'medium',   36, NULL),
    ('breach_city',      'City (breach)',        'breach',  'low',      14, NULL),
    ('breach_state',     'State (breach)',       'breach',  'low',      11, NULL),
    ('breach_country',   'Country (breach)',     'breach',  'low',       8, NULL),
    ('breach_name',      'Name (breach)',        'breach',  'low',      16, NULL),
    ('breach_ip',        'IP address',           'breach',  'medium',   44, 'Approximate location and ISP'),
    ('breach_id',        'Account identifier',   'breach',  'medium',   46, 'Links identities across breaches'),

    -- Account existence (holehe)
    ('service_account',  'Online account',       'account', 'medium',   48, 'Reveals which services to target')
ON CONFLICT (data_type) DO UPDATE
    SET label = EXCLUDED.label,
        origin = EXCLUDED.origin,
        severity = EXCLUDED.severity,
        severity_rank = EXCLUDED.severity_rank,
        notes = EXCLUDED.notes,
        updated_at = NOW();

-- ---------------------------------------------------------------------------
-- Seed: category weights
-- ---------------------------------------------------------------------------
-- A type appears once per category it contributes to. Absence means it does
-- not feed that category at all.

INSERT INTO public.risk_data_type_categories (data_type, category, weight) VALUES
    -- Contact channels drive spam and scam hardest
    ('phone',            'spam',     1.00),
    ('phone',            'scam',     0.90),
    ('phone',            'identity', 0.50),
    ('phone',            'accounts', 0.40),
    ('phone_carrier',    'scam',     0.70),
    ('phone_carrier',    'identity', 0.40),
    ('email',            'spam',     1.00),
    ('email',            'scam',     0.85),
    ('email',            'accounts', 0.90),
    ('email',            'identity', 0.40),

    -- Identity building blocks
    ('date_of_birth',    'identity', 1.00),
    ('date_of_birth',    'scam',     0.40),
    ('full_name',        'identity', 0.40),
    ('full_name',        'scam',     0.30),
    ('alias',            'identity', 0.60),
    ('age',              'identity', 0.20),
    ('current_address',  'identity', 0.80),
    ('current_address',  'scam',     0.60),
    ('current_address',  'spam',     0.50),
    ('previous_address', 'identity', 0.70),
    ('coordinates',      'identity', 0.40),
    ('coordinates',      'scam',     0.50),
    ('property',         'identity', 0.40),
    ('property',         'scam',     0.50),
    ('county',           'identity', 0.10),

    -- Relatives are the Family point, and double as KBA answers
    ('relative_name',    'family',   1.00),
    ('relative_name',    'identity', 0.50),
    ('relative_name',    'scam',     0.40),
    ('household_member', 'family',   0.90),
    ('household_member', 'identity', 0.30),

    -- Breach data
    ('password',         'accounts', 1.00),
    ('password',         'identity', 0.70),
    ('password',         'scam',     0.60),
    ('breach_dob',       'identity', 1.00),
    ('breach_address',   'identity', 0.80),
    ('breach_address',   'scam',     0.50),
    ('breach_street',    'identity', 0.75),
    ('breach_zip',       'identity', 0.30),
    ('breach_city',      'identity', 0.15),
    ('breach_state',     'identity', 0.10),
    ('breach_country',   'identity', 0.05),
    ('breach_name',      'identity', 0.35),
    ('breach_ip',        'identity', 0.40),
    ('breach_ip',        'accounts', 0.50),
    ('breach_id',        'accounts', 0.70),
    ('breach_id',        'identity', 0.40),

    -- Account existence. Knowing which services someone uses is what makes a
    -- phishing lure credible, so it carries scam weight as well.
    ('service_account',  'accounts', 1.00),
    ('service_account',  'scam',     0.60),
    ('service_account',  'spam',     0.30)
ON CONFLICT (data_type, category) DO UPDATE
    SET weight = EXCLUDED.weight;

-- ---------------------------------------------------------------------------
-- Rollup helper
-- ---------------------------------------------------------------------------
-- Turns a set of exposed data types into the six points the hex map draws.
-- Takes the types as an array so it works for an anonymous pre-signup scan
-- (no user row yet) as well as a saved profile.
--
-- Scoring is share-of-possible: a category scores the weight this person
-- actually carries divided by the weight they could carry if every
-- contributing data type were exposed. It reads as a sentence -- "87% of the
-- data types that feed scam risk are exposed for you" -- which matters for a
-- chart shown to a non-technical audience before signup.
--
-- The first attempt averaged matched weights and scaled by a log of the count.
-- Against a real finding set it pinned five of the six points at 1.00, which
-- draws a full hexagon and tells the user nothing. Share-of-possible spread
-- the same data across 0.53 to 1.00.
--
-- Two known limitations, both wanting a corpus rather than a formula:
--   * a score of 1.00 is reachable, and legitimately so -- someone with every
--     spam-feeding type exposed is at 100% of spam-relevant exposure
--   * the denominator is the whole catalogue, so adding data types later
--     lowers everyone's historical scores. Recompute rather than store, or
--     version the catalogue, if scores ever need to be comparable over time.

CREATE OR REPLACE FUNCTION public.risk_summary(p_data_types TEXT[])
RETURNS TABLE (
    category    TEXT,
    score       NUMERIC,
    item_count  INT,
    data_types  TEXT[]
)
LANGUAGE sql STABLE AS $$
    WITH category_total AS (
        SELECT category, SUM(weight) AS possible
          FROM public.risk_data_type_categories
         GROUP BY category
    ),
    matched AS (
        SELECT c.category, c.weight, c.data_type
          FROM public.risk_data_type_categories c
         WHERE c.data_type = ANY(p_data_types)
    ),
    -- Left-joined from the full category list so every point comes back, even
    -- at zero. The hex map draws all six every time; a missing row would be a
    -- hole in the chart rather than a low score.
    per_category AS (
        SELECT t.category,
               ROUND((COALESCE(SUM(m.weight), 0) / t.possible)::numeric, 2) AS score,
               COUNT(m.data_type)::int AS item_count,
               COALESCE(ARRAY_AGG(m.data_type ORDER BY m.weight DESC)
                        FILTER (WHERE m.data_type IS NOT NULL), '{}') AS data_types
          FROM category_total t
          LEFT JOIN matched m ON m.category = t.category
         GROUP BY t.category, t.possible
    ),
    -- Critical is not a category anything is filed under: it is how much of
    -- the genuinely damaging catalogue this person carries. Weighted by
    -- severity_rank so a leaked password counts for more than a coordinate.
    critical_total AS (
        SELECT SUM(severity_rank)::numeric AS possible
          FROM public.risk_data_types
         WHERE severity IN ('critical', 'high')
    ),
    critical AS (
        SELECT 'critical'::text AS category,
               ROUND((COALESCE(SUM(t.severity_rank), 0) / c.possible)::numeric, 2) AS score,
               COUNT(t.data_type)::int AS item_count,
               COALESCE(ARRAY_AGG(t.data_type ORDER BY t.severity_rank DESC)
                        FILTER (WHERE t.data_type IS NOT NULL), '{}') AS data_types
          FROM critical_total c
          LEFT JOIN public.risk_data_types t
                 ON t.data_type = ANY(p_data_types)
                AND t.severity IN ('critical', 'high')
         GROUP BY c.possible
    )
    SELECT * FROM per_category
    UNION ALL
    SELECT * FROM critical;
$$;

COMMENT ON FUNCTION public.risk_summary(TEXT[]) IS
    'Given the data types exposed for one person, returns a score, a count and '
    'the contributing types for each hex-map point. Critical is derived from '
    'severity rather than from a category assignment.';
