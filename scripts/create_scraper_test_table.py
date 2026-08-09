#!/usr/bin/env python3
"""
Create the scraper_test_results table in Supabase.

Usage:
    python scripts/create_scraper_test_table.py <SUPABASE_URL> <SUPABASE_ADMIN_KEY>

Or set environment variables:
    export SUPABASE_URL="https://..."
    export SUPABASE_ADMIN_KEY="eyJ..."
    python scripts/create_scraper_test_table.py
"""

import sys
import os
from pathlib import Path

# SQL to create the table
CREATE_TABLE_SQL = """
-- Scraper Test Results Table
-- Tracks actual scraped data from all 4 scrapers

CREATE TABLE IF NOT EXISTS public.scraper_test_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    scraper_type TEXT NOT NULL CHECK (scraper_type IN ('anywho', 'fps', 'zabasearch', 'npd')),
    scrape_mode TEXT NOT NULL CHECK (scrape_mode IN ('summary', 'full_profile')),
    input_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    summary_results JSONB,
    full_profile_results JSONB,
    status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'error')),
    error_message TEXT,
    execution_time_ms INTEGER,
    notes TEXT
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_scraper_test_results_scraper_type ON public.scraper_test_results(scraper_type);
CREATE INDEX IF NOT EXISTS idx_scraper_test_results_scrape_mode ON public.scraper_test_results(scrape_mode);
CREATE INDEX IF NOT EXISTS idx_scraper_test_results_status ON public.scraper_test_results(status);
CREATE INDEX IF NOT EXISTS idx_scraper_test_results_created_at ON public.scraper_test_results(created_at DESC);

-- Grant permissions
ALTER TABLE public.scraper_test_results ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read/write
CREATE POLICY "Allow authenticated users to read" ON public.scraper_test_results
    FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to insert" ON public.scraper_test_results
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');
"""


def create_table(supabase_url: str, admin_key: str) -> bool:
    """Create the scraper_test_results table."""
    try:
        from supabase import create_client
    except ImportError:
        print("❌ supabase-py not installed. Run: pip install supabase")
        return False

    try:
        client = create_client(supabase_url, admin_key)

        # Execute the SQL
        response = client.postgrest.raw(
            method="POST",
            path="/rpc/exec_sql",
            body={"sql": CREATE_TABLE_SQL}
        )

        print("✅ Table created successfully!")
        return True
    except Exception as e:
        # Try alternative approach using the SQL directly
        print(f"⚠️  Trying alternative method...")
        try:
            # For Supabase, we can use the admin client to run raw SQL
            import postgrest

            # This is a fallback - the user should run the SQL in Supabase console
            print("❌ Could not execute SQL directly from Python.")
            print("\n📝 Please run this SQL manually in Supabase SQL Editor:")
            print("=" * 70)
            print(CREATE_TABLE_SQL)
            print("=" * 70)
            return False
        except Exception as e2:
            print(f"❌ Error: {e2}")
            return False


def main():
    """Main entry point."""
    # Get credentials from args or environment
    if len(sys.argv) > 2:
        url = sys.argv[1]
        key = sys.argv[2]
    else:
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_ADMIN_KEY")

    if not url or not key:
        print("❌ Missing credentials!")
        print("\nUsage:")
        print("  python scripts/create_scraper_test_table.py <URL> <ADMIN_KEY>")
        print("\nOr set environment variables:")
        print("  export SUPABASE_URL=https://...")
        print("  export SUPABASE_ADMIN_KEY=eyJ...")
        print("  python scripts/create_scraper_test_table.py")
        sys.exit(1)

    print("🔗 Connecting to Supabase...")
    print(f"   URL: {url[:40]}...")

    success = create_table(url, key)

    if success:
        print("\n✅ Setup complete!")
        print("\nYou can now use:")
        print("  from log_scraper_results import log_scrape_result")
        print("  log_scrape_result(...)")
    else:
        print("\n📝 Please run the SQL above in Supabase:")
        print("   1. Go to https://app.supabase.com/project/...")
        print("   2. Click 'SQL Editor'")
        print("   3. Paste the SQL above")
        print("   4. Click 'Run'")
        sys.exit(1)


if __name__ == "__main__":
    main()
