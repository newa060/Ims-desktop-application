-- Realtime + RLS for Staff PWA in-app notifications (same as Mens_space 014)
-- Run in Supabase SQL editor if not already applied.

CREATE OR REPLACE FUNCTION public.staff_hr_id_for_auth()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM public.staff
  WHERE "portalUserId" = auth.uid()
    AND "deletedAt" IS NULL
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.staff_hr_id_for_auth() TO authenticated;

ALTER TABLE public.staff_notification_recipients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff read own notification recipients"
  ON public.staff_notification_recipients;

CREATE POLICY "Staff read own notification recipients"
  ON public.staff_notification_recipients
  FOR SELECT
  TO authenticated
  USING ("staffId" = public.staff_hr_id_for_auth());

DROP POLICY IF EXISTS "Staff dismiss own notification recipients"
  ON public.staff_notification_recipients;

CREATE POLICY "Staff dismiss own notification recipients"
  ON public.staff_notification_recipients
  FOR UPDATE
  TO authenticated
  USING ("staffId" = public.staff_hr_id_for_auth())
  WITH CHECK ("staffId" = public.staff_hr_id_for_auth());

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime
    ADD TABLE public.staff_notification_recipients;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN
    RAISE NOTICE 'supabase_realtime publication not found — enable Realtime in dashboard for staff_notification_recipients';
END $$;
