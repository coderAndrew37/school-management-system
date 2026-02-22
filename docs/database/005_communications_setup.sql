


CREATE TYPE communication_status AS ENUM ('sent', 'scheduled', 'failed');

CREATE TABLE communications_log (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sent_by          UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  audience_type    TEXT NOT NULL,
  audience_label   TEXT NOT NULL,
  subject          TEXT NOT NULL,
  body_preview     TEXT NOT NULL,        -- First 120 chars, stored for history UI
  recipient_count  INTEGER NOT NULL DEFAULT 0,
  status           communication_status NOT NULL DEFAULT 'sent',
  scheduled_at     TIMESTAMPTZ,          -- NULL if sent immediately
  sent_at          TIMESTAMPTZ,          -- NULL if scheduled
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_communications_log_created_at ON communications_log(created_at DESC);
CREATE INDEX idx_communications_log_sent_by    ON communications_log(sent_by);
CREATE INDEX idx_communications_log_status     ON communications_log(status);

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE communications_log ENABLE ROW LEVEL SECURITY;

-- Only admins can read or write the log
CREATE POLICY "comms_log: admin all"
  ON communications_log FOR ALL
  USING (is_admin());


-- If you have a profiles table, ensure sent_by references it so the API can join them
ALTER TABLE communications_log 
DROP CONSTRAINT IF EXISTS communications_log_sent_by_fkey;

ALTER TABLE communications_log
ADD CONSTRAINT communications_log_sent_by_fkey 
FOREIGN KEY (sent_by) REFERENCES profiles(id);