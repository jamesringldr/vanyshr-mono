-- ============================================================================
-- Vanyshr Database Migration: Extensions
-- ============================================================================
-- Created: January 2026
-- Description: Enable required PostgreSQL extensions
-- ============================================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable cryptographic functions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
