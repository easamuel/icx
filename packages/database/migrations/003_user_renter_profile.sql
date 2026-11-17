-- Migration 003: Persist verified renter identity & uploaded ID document on user accounts
-- Idempotent migration safe for re-runs.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS renter_profile JSONB;
