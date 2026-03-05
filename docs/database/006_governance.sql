-- ============================================================
-- MIGRATION 004: Communication & School Governance
-- Kibali Academy CBC School Management System
-- ============================================================
-- Requires: 001_base_schema.sql, 002_subject_allocation_timetable.sql,
--           003_auth_profiles_rls.sql (for set_updated_at, is_admin, auth_role)

-- ── 1. ANNOUNCEMENTS ─────────────────────────────────────────────────────────

CREATE TYPE announcement_audience AS ENUM (
  'all',       -- all authenticated users
  'parents',   -- parents only
  'teachers',  -- teachers only
  'grade'      -- specific grade (see target_grade)
);

CREATE TYPE announcement_priority AS ENUM ('low', 'normal', 'high', 'urgent');

CREATE TABLE announcements (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  title         TEXT        NOT NULL CHECK (char_length(title) BETWEEN 2 AND 200),
  body          TEXT        NOT NULL CHECK (char_length(body) >= 10),
  audience      announcement_audience NOT NULL DEFAULT 'all',
  target_grade  TEXT,
  priority      announcement_priority NOT NULL DEFAULT 'normal',
  pinned        BOOLEAN     NOT NULL DEFAULT false,
  published_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ,
  -- author_id: nullable so deleting a user doesn't cascade-delete announcements
  author_id     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_announcements_audience  ON announcements(audience);
CREATE INDEX idx_announcements_published ON announcements(published_at DESC);
CREATE INDEX idx_announcements_pinned    ON announcements(pinned) WHERE pinned = true;

-- Read receipts
CREATE TABLE announcement_reads (
  announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id)    ON DELETE CASCADE,
  read_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (announcement_id, user_id)
);

CREATE TRIGGER announcements_updated_at
  BEFORE UPDATE ON announcements
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 2. SCHOOL CALENDAR ────────────────────────────────────────────────────────

CREATE TYPE event_category AS ENUM (
  'academic', 'sports', 'cultural', 'holiday', 'meeting', 'other'
);

CREATE TABLE school_events (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  title         TEXT        NOT NULL CHECK (char_length(title) BETWEEN 2 AND 200),
  description   TEXT,
  category      event_category NOT NULL DEFAULT 'other',
  start_date    DATE        NOT NULL,
  end_date      DATE,
  start_time    TIME,
  end_time      TIME,
  location      TEXT,
  target_grades TEXT[],
  is_public     BOOLEAN     NOT NULL DEFAULT true,
  author_id     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT events_dates_check CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE INDEX idx_events_start_date ON school_events(start_date ASC);
CREATE INDEX idx_events_category   ON school_events(category);

CREATE TRIGGER events_updated_at
  BEFORE UPDATE ON school_events
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 3. INVENTORY ──────────────────────────────────────────────────────────────

CREATE TYPE inventory_category AS ENUM (
  'furniture', 'electronics', 'sports', 'stationery',
  'laboratory', 'books', 'kitchen', 'medical', 'maintenance', 'other'
);

CREATE TYPE item_condition    AS ENUM ('new', 'good', 'fair', 'poor', 'condemned');
CREATE TYPE transaction_type  AS ENUM ('received', 'issued', 'returned', 'damaged', 'disposed', 'audited');

CREATE TABLE inventory_items (
  id            UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT           NOT NULL CHECK (char_length(name) BETWEEN 2 AND 200),
  description   TEXT,
  category      inventory_category NOT NULL DEFAULT 'other',
  sku           TEXT           UNIQUE,
  unit          TEXT           NOT NULL DEFAULT 'piece',
  quantity      INTEGER        NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  minimum_stock INTEGER        NOT NULL DEFAULT 0 CHECK (minimum_stock >= 0),
  unit_cost     NUMERIC(12,2)  CHECK (unit_cost >= 0),
  location      TEXT,
  condition     item_condition NOT NULL DEFAULT 'good',
  supplier      TEXT,
  last_audited  DATE,
  created_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_inventory_category ON inventory_items(category);

-- Audit log for every stock movement
CREATE TABLE inventory_transactions (
  id            UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id       UUID           NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  tx_type       transaction_type NOT NULL,
  -- signed quantity: positive = stock in, negative = stock out
  quantity      INTEGER        NOT NULL,
  balance_after INTEGER        NOT NULL DEFAULT 0,
  notes         TEXT,
  reference     TEXT,
  performed_by  UUID           REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_inv_tx_item_date ON inventory_transactions(item_id, created_at DESC);

-- AFTER INSERT trigger so we read the already-updated row quantity
CREATE OR REPLACE FUNCTION apply_inventory_transaction()
RETURNS TRIGGER AS $$
DECLARE
  v_new_qty INTEGER;
BEGIN
  -- Update item stock
  UPDATE inventory_items
  SET    quantity   = quantity + NEW.quantity,
         updated_at = NOW()
  WHERE  id = NEW.item_id
  RETURNING quantity INTO v_new_qty;

  -- Write the post-transaction balance back
  UPDATE inventory_transactions
  SET    balance_after = v_new_qty
  WHERE  id = NEW.id;

  RETURN NULL; -- AFTER trigger returns NULL
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_apply_inventory
  AFTER INSERT ON inventory_transactions
  FOR EACH ROW EXECUTE FUNCTION apply_inventory_transaction();

CREATE TRIGGER inventory_items_updated_at
  BEFORE UPDATE ON inventory_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 4. FEE MANAGEMENT ─────────────────────────────────────────────────────────

CREATE TYPE payment_status AS ENUM ('pending', 'partial', 'paid', 'overdue', 'waived');
CREATE TYPE payment_method AS ENUM ('mpesa', 'bank_transfer', 'cash', 'cheque', 'other');

CREATE TABLE fee_structures (
  id            UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
  grade         TEXT           NOT NULL,
  term          SMALLINT       NOT NULL CHECK (term IN (1,2,3)),
  academic_year SMALLINT       NOT NULL DEFAULT 2026,
  tuition_fee   NUMERIC(12,2)  NOT NULL CHECK (tuition_fee >= 0),
  activity_fee  NUMERIC(12,2)  NOT NULL DEFAULT 0 CHECK (activity_fee >= 0),
  lunch_fee     NUMERIC(12,2)  NOT NULL DEFAULT 0 CHECK (lunch_fee >= 0),
  transport_fee NUMERIC(12,2)  NOT NULL DEFAULT 0 CHECK (transport_fee >= 0),
  other_fee     NUMERIC(12,2)  NOT NULL DEFAULT 0 CHECK (other_fee >= 0),
  notes         TEXT,
  created_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  UNIQUE (grade, term, academic_year)
);

CREATE TABLE fee_payments (
  id               UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id       UUID           NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  fee_structure_id UUID           REFERENCES fee_structures(id) ON DELETE SET NULL,
  term             SMALLINT       NOT NULL CHECK (term IN (1,2,3)),
  academic_year    SMALLINT       NOT NULL DEFAULT 2026,
  amount_due       NUMERIC(12,2)  NOT NULL CHECK (amount_due >= 0),
  amount_paid      NUMERIC(12,2)  NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  status           payment_status NOT NULL DEFAULT 'pending',
  payment_method   payment_method,
  mpesa_code       TEXT,
  paid_at          TIMESTAMPTZ,
  notes            TEXT,
  recorded_by      UUID           REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, term, academic_year)
);

CREATE INDEX idx_fee_payments_student ON fee_payments(student_id);
CREATE INDEX idx_fee_payments_status  ON fee_payments(status);

-- Automatically derive status from amounts (BEFORE trigger so status is set on same row)
CREATE OR REPLACE FUNCTION compute_payment_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Don't auto-change waived records
  IF NEW.status = 'waived' THEN
    RETURN NEW;
  END IF;

  IF NEW.amount_paid = 0 THEN
    NEW.status := 'pending';
  ELSIF NEW.amount_paid >= NEW.amount_due THEN
    NEW.status  := 'paid';
    NEW.paid_at := COALESCE(NEW.paid_at, NOW());
  ELSE
    NEW.status := 'partial';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_payment_status
  BEFORE INSERT OR UPDATE OF amount_paid, amount_due
  ON fee_payments
  FOR EACH ROW EXECUTE FUNCTION compute_payment_status();

CREATE TRIGGER fee_payments_updated_at
  BEFORE UPDATE ON fee_payments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 5. ROW LEVEL SECURITY ─────────────────────────────────────────────────────

ALTER TABLE announcements          ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcement_reads     ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_events          ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_structures         ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_payments           ENABLE ROW LEVEL SECURITY;

-- Announcements
CREATE POLICY "announcements_admin"
  ON announcements FOR ALL TO authenticated USING (is_admin());

CREATE POLICY "announcements_teacher_read"
  ON announcements FOR SELECT TO authenticated
  USING (is_teacher() AND audience IN ('all','teachers')
         AND (expires_at IS NULL OR expires_at > NOW()));

CREATE POLICY "announcements_parent_read"
  ON announcements FOR SELECT TO authenticated
  USING (auth_role() = 'parent' AND audience IN ('all','parents')
         AND (expires_at IS NULL OR expires_at > NOW()));

-- Read receipts
CREATE POLICY "reads_own"
  ON announcement_reads FOR ALL TO authenticated USING (user_id = auth.uid());

-- Calendar
CREATE POLICY "events_admin"
  ON school_events FOR ALL TO authenticated USING (is_admin());

CREATE POLICY "events_authenticated_read_public"
  ON school_events FOR SELECT TO authenticated USING (is_public = true);

-- Inventory
CREATE POLICY "inventory_items_admin"
  ON inventory_items FOR ALL TO authenticated USING (is_admin());

CREATE POLICY "inventory_items_teacher_read"
  ON inventory_items FOR SELECT TO authenticated USING (is_teacher());

CREATE POLICY "inventory_tx_admin"
  ON inventory_transactions FOR ALL TO authenticated USING (is_admin());

CREATE POLICY "inventory_tx_teacher_read"
  ON inventory_transactions FOR SELECT TO authenticated USING (is_teacher());

-- Fee structures
CREATE POLICY "fee_structures_admin"
  ON fee_structures FOR ALL TO authenticated USING (is_admin());

CREATE POLICY "fee_structures_authenticated_read"
  ON fee_structures FOR SELECT TO authenticated USING (true);

-- Fee payments
CREATE POLICY "fee_payments_admin"
  ON fee_payments FOR ALL TO authenticated USING (is_admin());

CREATE POLICY "fee_payments_parent_read_own"
  ON fee_payments FOR SELECT TO authenticated
  USING (student_id IN (
    SELECT id FROM students WHERE parent_id = current_parent_id()
  ));