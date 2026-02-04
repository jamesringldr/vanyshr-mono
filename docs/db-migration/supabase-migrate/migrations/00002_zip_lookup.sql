-- ============================================================================
-- Vanyshr Database Migration: ZIP Lookup Reference Table
-- ============================================================================
-- Created: January 2026
-- Description: ZIP code to city/state reference data
-- ============================================================================

-- Create zip_lookup reference table
CREATE TABLE IF NOT EXISTS public.zip_lookup (
    zip TEXT PRIMARY KEY,
    city TEXT NOT NULL,
    state_code TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert sample ZIP code data for major cities
INSERT INTO public.zip_lookup (zip, city, state_code) VALUES
    ('10001', 'New York', 'NY'),
    ('10002', 'New York', 'NY'),
    ('10003', 'New York', 'NY'),
    ('90210', 'Beverly Hills', 'CA'),
    ('90211', 'Beverly Hills', 'CA'),
    ('60601', 'Chicago', 'IL'),
    ('60602', 'Chicago', 'IL'),
    ('75201', 'Dallas', 'TX'),
    ('75202', 'Dallas', 'TX'),
    ('33101', 'Miami', 'FL'),
    ('33102', 'Miami', 'FL'),
    ('98101', 'Seattle', 'WA'),
    ('98102', 'Seattle', 'WA'),
    ('02101', 'Boston', 'MA'),
    ('02102', 'Boston', 'MA'),
    ('30301', 'Atlanta', 'GA'),
    ('30302', 'Atlanta', 'GA'),
    ('80201', 'Denver', 'CO'),
    ('80202', 'Denver', 'CO'),
    ('85001', 'Phoenix', 'AZ'),
    ('85002', 'Phoenix', 'AZ'),
    ('19101', 'Philadelphia', 'PA'),
    ('19102', 'Philadelphia', 'PA'),
    ('77001', 'Houston', 'TX'),
    ('77002', 'Houston', 'TX'),
    ('48201', 'Detroit', 'MI'),
    ('48202', 'Detroit', 'MI'),
    ('97201', 'Portland', 'OR'),
    ('97202', 'Portland', 'OR'),
    ('89101', 'Las Vegas', 'NV'),
    ('89102', 'Las Vegas', 'NV'),
    ('64111', 'Kansas City', 'MO'),
    ('64112', 'Kansas City', 'MO'),
    ('63101', 'St. Louis', 'MO'),
    ('63102', 'St. Louis', 'MO'),
    ('55401', 'Minneapolis', 'MN'),
    ('55402', 'Minneapolis', 'MN'),
    ('92101', 'San Diego', 'CA'),
    ('92102', 'San Diego', 'CA'),
    ('78201', 'San Antonio', 'TX'),
    ('78202', 'San Antonio', 'TX')
ON CONFLICT (zip) DO NOTHING;

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_zip_lookup_zip ON public.zip_lookup(zip);

-- Enable Row Level Security
ALTER TABLE public.zip_lookup ENABLE ROW LEVEL SECURITY;

-- Allow read access to everyone
CREATE POLICY "Allow read access to zip_lookup" ON public.zip_lookup
    FOR SELECT USING (true);

-- Grant permissions
GRANT SELECT ON public.zip_lookup TO authenticated;
GRANT SELECT ON public.zip_lookup TO anon;
GRANT SELECT ON public.zip_lookup TO service_role;
