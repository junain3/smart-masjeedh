-- Add unique constraint to event_attendance for onConflict to work
ALTER TABLE public.event_attendance
ADD CONSTRAINT event_attendance_event_family_unique
UNIQUE (event_id, family_id);
