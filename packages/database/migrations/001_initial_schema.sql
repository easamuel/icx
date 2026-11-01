-- ============================================================================
-- ICX STUDIOS PLATFORM — NATIVE POSTGRESQL 16+ SCHEMA MIGRATION (001)
-- Self-Hosted Enterprise Architecture • Zero Supabase Dependencies
-- ============================================================================

BEGIN;

-- Required Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- ============================================================================
-- 1. USERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role VARCHAR(32) NOT NULL CHECK (role IN ('customer', 'photographer', 'editor', 'admin')),
    phone VARCHAR(40),
    full_name VARCHAR(150) NOT NULL,
    two_factor_secret TEXT,
    two_factor_enabled BOOLEAN NOT NULL DEFAULT false,
    status VARCHAR(32) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
    email_verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_role_status ON users (role, status);

-- Automatic updated_at trigger
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_users_updated_at ON users;
CREATE TRIGGER set_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION trigger_set_updated_at();

-- ============================================================================
-- 2. PHOTOGRAPHER PROFILES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS photographer_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    bio TEXT,
    location VARCHAR(150),
    rating NUMERIC(3,2) NOT NULL DEFAULT 5.00 CHECK (rating >= 0.00 AND rating <= 5.00),
    approval_status VARCHAR(32) NOT NULL DEFAULT 'pending'
        CHECK (approval_status IN ('pending', 'approved', 'suspended', 'rejected')),
    portfolio_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
    services_and_prices JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_photographer_profiles_approval_location
    ON photographer_profiles (approval_status, location);

-- ============================================================================
-- 3. AVAILABILITY SLOTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS availability_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    photographer_id UUID NOT NULL REFERENCES photographer_profiles(id) ON DELETE CASCADE,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'free'
        CHECK (status IN ('free', 'held', 'booked')),
    held_until TIMESTAMPTZ,
    CONSTRAINT chk_slot_time_order CHECK (end_time > start_time),
    -- Prevent overlapping availability slots for the same photographer at the DB level
    CONSTRAINT excl_photographer_overlapping_slots
        EXCLUDE USING gist (
            photographer_id WITH =,
            tstzrange(start_time, end_time, '[)') WITH &&
        )
);

CREATE INDEX IF NOT EXISTS idx_availability_slots_photographer_time
    ON availability_slots (photographer_id, start_time, status);
CREATE INDEX IF NOT EXISTS idx_availability_slots_expired_holds
    ON availability_slots (status, held_until)
    WHERE status = 'held';

-- ============================================================================
-- 4. EDIT PACKAGES TABLE (Admin-Configurable)
-- ============================================================================
CREATE TABLE IF NOT EXISTS edit_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(120) NOT NULL UNIQUE,
    description TEXT,
    price_per_picture BIGINT NOT NULL CHECK (price_per_picture > 0),
    turnaround_hours INT NOT NULL CHECK (turnaround_hours > 0),
    free_revisions INT NOT NULL DEFAULT 2 CHECK (free_revisions >= 0),
    active BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_edit_packages_active ON edit_packages (active);

-- ============================================================================
-- 5. EDIT ORDERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS edit_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    package_id UUID NOT NULL REFERENCES edit_packages(id) ON DELETE RESTRICT,
    picture_count INT NOT NULL CHECK (picture_count >= 1 AND picture_count <= 100),
    total_amount BIGINT NOT NULL CHECK (total_amount >= 0),
    amount_paid BIGINT NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
    balance_amount BIGINT NOT NULL CHECK (balance_amount >= 0),
    payment_state VARCHAR(32) NOT NULL DEFAULT 'unpaid'
        CHECK (payment_state IN ('unpaid', 'deposit_paid', 'fully_paid')),
    status VARCHAR(32) NOT NULL DEFAULT 'awaiting_payment'
        CHECK (status IN (
            'awaiting_payment',
            'in_queue',
            'in_editing',
            'ready_for_review',
            'revision',
            'delivered',
            'archived'
        )),
    assignee_id UUID REFERENCES users(id) ON DELETE SET NULL,
    offline_editor_name VARCHAR(255),
    customer_notes TEXT,
    due_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edit_orders_customer ON edit_orders (customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_edit_orders_status_assignee ON edit_orders (status, assignee_id);
CREATE INDEX IF NOT EXISTS idx_edit_orders_payment_state ON edit_orders (payment_state);

-- ============================================================================
-- 6. BOOKINGS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    photographer_id UUID NOT NULL REFERENCES photographer_profiles(id) ON DELETE RESTRICT,
    slot_id UUID NOT NULL REFERENCES availability_slots(id) ON DELETE RESTRICT,
    service_title TEXT NOT NULL,
    price BIGINT NOT NULL CHECK (price > 0),
    commission_rate NUMERIC(5,2) NOT NULL CHECK (commission_rate >= 0 AND commission_rate <= 100),
    commission_amount BIGINT NOT NULL CHECK (commission_amount >= 0),
    status VARCHAR(32) NOT NULL DEFAULT 'requested'
        CHECK (status IN (
            'requested',
            'accepted',
            'declined',
            'expired',
            'awaiting_payment',
            'confirmed',
            'delivered',
            'completed',
            'cancelled'
        )),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bookings_customer ON bookings (customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_photographer ON bookings (photographer_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_slot ON bookings (slot_id);

-- ============================================================================
-- 7. PHOTOS TABLE (Linked to Edit Orders or Bookings)
-- ============================================================================
CREATE TABLE IF NOT EXISTS photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES edit_orders(id) ON DELETE CASCADE,
    booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
    original_storage_key TEXT NOT NULL,
    edited_storage_key TEXT,
    preview_storage_key TEXT,
    version INT NOT NULL DEFAULT 1 CHECK (version >= 1),
    uploaded_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_photo_parent_reference CHECK (
        (order_id IS NOT NULL AND booking_id IS NULL) OR
        (order_id IS NULL AND booking_id IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_photos_order ON photos (order_id);
CREATE INDEX IF NOT EXISTS idx_photos_booking ON photos (booking_id);

-- ============================================================================
-- 8. EQUIPMENT ITEMS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS equipment_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    photos JSONB NOT NULL DEFAULT '[]'::jsonb,
    daily_price BIGINT NOT NULL CHECK (daily_price > 0),
    total_units INT NOT NULL CHECK (total_units >= 0),
    condition TEXT NOT NULL DEFAULT 'excellent'
        CHECK (condition IN ('excellent', 'good', 'fair', 'under_repair', 'retired')),
    active BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_equipment_items_active_condition
    ON equipment_items (active, condition);

-- ============================================================================
-- 9. RENTALS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS rentals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    item_id UUID NOT NULL REFERENCES equipment_items(id) ON DELETE RESTRICT,
    units INT NOT NULL CHECK (units >= 1),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_amount BIGINT NOT NULL CHECK (total_amount > 0),
    form_details JSONB NOT NULL DEFAULT '{}'::jsonb,
    status VARCHAR(32) NOT NULL DEFAULT 'held'
        CHECK (status IN ('held', 'confirmed', 'out', 'returned', 'cancelled')),
    held_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_rental_date_order CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_rentals_item_dates_status
    ON rentals (item_id, status, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_rentals_daterange_gist
    ON rentals USING gist (item_id, daterange(start_date, end_date, '[]'));
CREATE INDEX IF NOT EXISTS idx_rentals_customer
    ON rentals (customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rentals_expired_holds
    ON rentals (status, held_until)
    WHERE status = 'held';

-- ============================================================================
-- 10. PAYMENTS TABLE (Populated Solely by Verified Webhooks)
-- ============================================================================
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_type VARCHAR(32) NOT NULL CHECK (target_type IN ('edit_order', 'booking', 'rental')),
    target_id UUID NOT NULL,
    type VARCHAR(32) NOT NULL CHECK (type IN ('deposit', 'balance', 'full', 'refund')),
    amount BIGINT NOT NULL CHECK (amount > 0),
    gateway_reference TEXT NOT NULL UNIQUE,
    verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_target ON payments (target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_payments_verified_at ON payments (verified_at DESC);

-- ============================================================================
-- 11. REVISION REQUESTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS revision_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    photo_id UUID NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    notes TEXT NOT NULL,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_revision_requests_photo ON revision_requests (photo_id, requested_at DESC);

-- ============================================================================
-- 12. AUDIT EVENTS TABLE (Immutable / Append-Only)
-- ============================================================================
CREATE TABLE IF NOT EXISTS audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    target_entity TEXT NOT NULL,
    target_id UUID,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_events_actor ON audit_events (actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_entity ON audit_events (target_entity, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_created_at ON audit_events (created_at DESC);

-- Enforce append-only immutability on audit_events
CREATE OR REPLACE FUNCTION prevent_audit_event_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'audit_events table is strictly append-only and cannot be modified or deleted';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_events_immutable ON audit_events;
CREATE TRIGGER trg_audit_events_immutable
BEFORE UPDATE OR DELETE ON audit_events
FOR EACH ROW
EXECUTE FUNCTION prevent_audit_event_mutation();

-- ============================================================================
-- PLATFORM SYSTEM CONFIGURATION TABLE (For Admin Dynamic Settings AD-06, AD-09)
-- ============================================================================
CREATE TABLE IF NOT EXISTS platform_settings (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO platform_settings (key, value)
VALUES
    ('pricing_config', '{"deposit_percentage": 70, "photographer_commission_rate": 15.0}'::jsonb),
    ('watermark_config', '{"opacity": 0.45, "scale_ratio": 0.35, "asset_storage_key": "system/watermark.png"}'::jsonb),
    ('rental_form_config', '{"require_government_id": true, "extra_fields": ["NIN / Passport Number", "Production Location"]}'::jsonb)
ON CONFLICT (key) DO NOTHING;

COMMIT;

