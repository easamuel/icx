-- Migration 002: Photographer Verification Metadata & Date/Package/Time-Period Bookings
-- Idempotent migration safe for re-runs.

ALTER TABLE photographer_profiles
  ADD COLUMN IF NOT EXISTS specialty VARCHAR(150),
  ADD COLUMN IF NOT EXISTS years_experience INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE bookings
  ALTER COLUMN slot_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS booking_date DATE,
  ADD COLUMN IF NOT EXISTS package_type VARCHAR(80),
  ADD COLUMN IF NOT EXISTS time_period VARCHAR(80),
  ADD COLUMN IF NOT EXISTS notes TEXT;

CREATE INDEX IF NOT EXISTS idx_bookings_photographer_date_status
  ON bookings (photographer_id, booking_date, status)
  WHERE booking_date IS NOT NULL;
