-- =============================================================================
-- Staff Push Notifications
-- Shared tables for PWA Web Push subscriptions + admin send audit log.
-- camelCase columns (double-quoted) to match IMS staff_* convention.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. staff_push_subscriptions  (one row per browser/device endpoint)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS staff_push_subscriptions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "staffId"         UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  "portalUserId"    UUID NOT NULL,
  endpoint          TEXT NOT NULL UNIQUE,
  "p256dh"          TEXT NOT NULL,
  auth              TEXT NOT NULL,
  "userAgent"       TEXT,
  "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_push_subs_staffId
  ON staff_push_subscriptions("staffId");

CREATE INDEX IF NOT EXISTS idx_staff_push_subs_portalUserId
  ON staff_push_subscriptions("portalUserId");

-- ---------------------------------------------------------------------------
-- 2. staff_notifications  (admin send log)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS staff_notifications (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title               TEXT NOT NULL,
  body                TEXT NOT NULL,
  "recipientMode"     TEXT NOT NULL DEFAULT 'selected',
  "sentByUserId"      UUID REFERENCES users(id) ON DELETE SET NULL,
  "createdAt"         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_notifications_createdAt
  ON staff_notifications("createdAt" DESC);

-- ---------------------------------------------------------------------------
-- 3. staff_notification_recipients
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS staff_notification_recipients (
  "notificationId"  UUID NOT NULL REFERENCES staff_notifications(id) ON DELETE CASCADE,
  "staffId"         UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  status            TEXT NOT NULL DEFAULT 'sent',
  "errorMessage"    TEXT,
  "dismissedAt"     TIMESTAMPTZ,
  PRIMARY KEY ("notificationId", "staffId")
);

CREATE INDEX IF NOT EXISTS idx_staff_notif_recipients_staffId
  ON staff_notification_recipients("staffId");
