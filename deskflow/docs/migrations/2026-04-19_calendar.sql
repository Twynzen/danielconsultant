-- ============================================================================
-- DeskFlow Calendar - Schema Migration
-- Date: 2026-04-19
-- Branch: feature/calendar
-- ============================================================================
--
-- Adds a dedicated calendar layer (calendars + calendar_events + reminders)
-- on top of the existing Intelligence Engine. ADDITIVE: no existing column,
-- table or row is dropped or modified. Notes/desktops/folders keep working
-- exactly as before.
--
-- Apply via Supabase SQL editor.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. calendars  —  one row per (user, named calendar)
-- ----------------------------------------------------------------------------
-- A user can keep events in several calendars (work / personal / project-X)
-- and toggle their visibility independently from the calendar UI sidebar.
CREATE TABLE IF NOT EXISTS public.calendars (
    id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name        TEXT NOT NULL,
    color       TEXT NOT NULL DEFAULT '#00ff41',
    visible     BOOLEAN NOT NULL DEFAULT TRUE,
    is_default  BOOLEAN NOT NULL DEFAULT FALSE,
    source      TEXT NOT NULL DEFAULT 'manual',  -- manual | ics | google (future)
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS calendars_user_idx ON public.calendars(user_id);

ALTER TABLE public.calendars ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own calendars" ON public.calendars;
CREATE POLICY "Users manage own calendars"
    ON public.calendars
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);


-- ----------------------------------------------------------------------------
-- 2. calendar_events  —  one row per scheduled event
-- ----------------------------------------------------------------------------
-- Recurring events store an RFC 5545 RRULE in `rrule` and individual
-- exception dates in `rrule_exdates`. "Edit only this instance" creates a
-- new row whose `recurrence_parent_id` points back to the original series.
--
-- `linked_note_id` is the bridge to the existing notes table — an event can
-- reference a project/task note, and the dashboard can deep-link both ways.
--
-- `ics_uid` enables idempotent ingestion from ICS feeds: re-importing the
-- same UID updates instead of duplicating (UNIQUE constraint below).
CREATE TABLE IF NOT EXISTS public.calendar_events (
    id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    calendar_id     UUID REFERENCES public.calendars(id) ON DELETE CASCADE NOT NULL,
    title           TEXT NOT NULL,
    description     TEXT,
    location        TEXT,
    starts_at       TIMESTAMPTZ NOT NULL,
    ends_at         TIMESTAMPTZ NOT NULL,
    all_day         BOOLEAN NOT NULL DEFAULT FALSE,
    rrule           TEXT,                                -- RFC 5545 RRULE; null => single
    rrule_exdates   TIMESTAMPTZ[],                       -- exception list for "this only" edits
    recurrence_parent_id UUID REFERENCES public.calendar_events(id) ON DELETE CASCADE,
    linked_note_id  UUID REFERENCES public.notes(id) ON DELETE SET NULL,
    ics_uid         TEXT,
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (user_id, ics_uid)
);

CREATE INDEX IF NOT EXISTS events_user_time_idx
    ON public.calendar_events(user_id, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS events_calendar_idx
    ON public.calendar_events(calendar_id);
CREATE INDEX IF NOT EXISTS events_note_link_idx
    ON public.calendar_events(linked_note_id);

ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own events" ON public.calendar_events;
CREATE POLICY "Users manage own events"
    ON public.calendar_events
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);


-- ----------------------------------------------------------------------------
-- 3. event_reminders  —  one row per (event, lead-time, channel)
-- ----------------------------------------------------------------------------
-- `fire_at` is materialized at insert/update (= starts_at - minutes_before)
-- so the cron worker query becomes a cheap partial-index scan.
-- When an event is rescheduled, the application recomputes `fire_at` for
-- every reminder belonging to it.
CREATE TABLE IF NOT EXISTS public.event_reminders (
    id             UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id        UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    event_id       UUID REFERENCES public.calendar_events(id) ON DELETE CASCADE NOT NULL,
    minutes_before INT NOT NULL,                         -- 0, 5, 15, 30, 60, 1440
    channel        TEXT NOT NULL DEFAULT 'whatsapp',     -- whatsapp | toast | both
    fire_at        TIMESTAMPTZ NOT NULL,
    sent_at        TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS reminders_due_idx
    ON public.event_reminders(fire_at)
    WHERE sent_at IS NULL;
CREATE INDEX IF NOT EXISTS reminders_event_idx
    ON public.event_reminders(event_id);

ALTER TABLE public.event_reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own reminders" ON public.event_reminders;
CREATE POLICY "Users manage own reminders"
    ON public.event_reminders
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);


-- ----------------------------------------------------------------------------
-- Done.
-- ----------------------------------------------------------------------------
