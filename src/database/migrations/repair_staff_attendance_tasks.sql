-- =============================================================================
-- Staff attendance / tasks repair (IMS camelCase)
-- =============================================================================
-- Run on shared Supabase if tables were overwritten by Mens_space migration 011
-- (snake_case). Safe when tables are empty or data is already lost.
-- Also adds dismissedAt for in-app Staff PWA inbox.
-- =============================================================================

DROP TABLE IF EXISTS staff_attendance CASCADE;

CREATE TABLE staff_attendance (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "staffId"           UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,

  "attendanceDate"    DATE NOT NULL,
  status              TEXT NOT NULL,
  "checkInTime"       TIME,
  "checkOutTime"      TIME,
  notes               TEXT,

  "recordedByUserId"  UUID REFERENCES users(id) ON DELETE SET NULL,
  "createdAt"         TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_staff_attendance_staff_date
  ON staff_attendance("staffId", "attendanceDate");

CREATE INDEX idx_staff_attendance_date    ON staff_attendance("attendanceDate");
CREATE INDEX idx_staff_attendance_staffId ON staff_attendance("staffId");


DROP TABLE IF EXISTS staff_tasks CASCADE;

CREATE TABLE staff_tasks (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "staffId"           UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,

  title               TEXT NOT NULL,
  description         TEXT,
  priority            TEXT NOT NULL DEFAULT 'Medium',
  status              TEXT NOT NULL DEFAULT 'pending',
  "dueDate"           DATE,
  "completedAt"       TIMESTAMPTZ,

  "assignedByUserId"  UUID REFERENCES users(id) ON DELETE SET NULL,

  "createdAt"         TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"         TIMESTAMPTZ NOT NULL DEFAULT now(),
  "deletedAt"         TIMESTAMPTZ
);

CREATE INDEX idx_staff_tasks_staffId  ON staff_tasks("staffId");
CREATE INDEX idx_staff_tasks_status   ON staff_tasks(status);
CREATE INDEX idx_staff_tasks_dueDate  ON staff_tasks("dueDate");


ALTER TABLE staff_notification_recipients
  ADD COLUMN IF NOT EXISTS "dismissedAt" TIMESTAMPTZ;
