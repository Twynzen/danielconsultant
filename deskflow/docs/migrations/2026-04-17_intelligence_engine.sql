-- ============================================================================
-- DeskFlow Intelligence Engine - Schema Migration
-- Date: 2026-04-17
-- Branch: claude/deskflow-intelligence-engine-3JOD0
-- ============================================================================
--
-- This migration is ADDITIVE ONLY. It does not modify or drop any existing
-- column. Notes that have no metadata continue working exactly as before.
--
-- Apply via Supabase SQL editor or `supabase db push`.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Add metadata column to notes
-- ----------------------------------------------------------------------------
-- JSONB storing the NoteMetadata interface (see desktop.model.ts).
-- Default `{}` so existing rows behave identically and TS code can rely on
-- `note.metadata ?? {}` without null checks at the boundary.
ALTER TABLE public.notes
    ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Useful indexes for the intelligence engine queries.
-- type / status / priority lookups
CREATE INDEX IF NOT EXISTS notes_metadata_type_idx
    ON public.notes ((metadata->>'type'));

CREATE INDEX IF NOT EXISTS notes_metadata_status_idx
    ON public.notes ((metadata->>'status'));

CREATE INDEX IF NOT EXISTS notes_metadata_priority_idx
    ON public.notes (((metadata->>'priority')::int));

-- dueDate for upcoming/overdue queries
CREATE INDEX IF NOT EXISTS notes_metadata_due_date_idx
    ON public.notes ((metadata->>'dueDate'));

-- tag membership lookups (GIN over the tags array inside metadata)
CREATE INDEX IF NOT EXISTS notes_metadata_tags_idx
    ON public.notes USING GIN ((metadata->'tags'));


-- ----------------------------------------------------------------------------
-- 2. Multi-agent API key system
-- ----------------------------------------------------------------------------
-- Each user can mint multiple API keys for different agents/integrations.
-- Keys are stored hashed (sha256 hex) — the plaintext is only shown once at
-- creation time.
CREATE TABLE IF NOT EXISTS public.api_keys (
    id           UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name         TEXT NOT NULL,
    key_prefix   TEXT NOT NULL,                      -- first 8 chars for UI hint
    key_hash     TEXT NOT NULL UNIQUE,               -- sha256 hex of full key
    scopes       TEXT[] NOT NULL DEFAULT ARRAY['read'],   -- read | write | admin
    rate_limit   INT NOT NULL DEFAULT 60,            -- requests / minute
    revoked      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS api_keys_user_id_idx ON public.api_keys (user_id);
CREATE INDEX IF NOT EXISTS api_keys_key_hash_idx ON public.api_keys (key_hash);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their own api keys" ON public.api_keys;
CREATE POLICY "Users manage their own api keys"
    ON public.api_keys
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);


-- ----------------------------------------------------------------------------
-- 3. Audit log for agent/API activity
-- ----------------------------------------------------------------------------
-- Every authenticated agent call records a row so the user can see what each
-- integration did. Kept narrow on purpose — agents should not log free-form
-- payloads here, only action+resource identifiers.
CREATE TABLE IF NOT EXISTS public.api_logs (
    id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    api_key_id  UUID REFERENCES public.api_keys(id) ON DELETE CASCADE NOT NULL,
    user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    action      TEXT NOT NULL,                  -- e.g. 'briefing.read', 'note.create'
    tool_name   TEXT,                           -- MCP tool or REST route name
    resource_id TEXT,                           -- optional referenced UUID/slug
    status      INT NOT NULL DEFAULT 200,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS api_logs_user_id_idx ON public.api_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS api_logs_api_key_id_idx ON public.api_logs (api_key_id, created_at DESC);

ALTER TABLE public.api_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read their own api logs" ON public.api_logs;
CREATE POLICY "Users read their own api logs"
    ON public.api_logs
    FOR SELECT
    USING (auth.uid() = user_id);


-- ----------------------------------------------------------------------------
-- 4. External connector registry
-- ----------------------------------------------------------------------------
-- One row per (user, connector) pair. Stores the configuration the connector
-- needs to know which target desktop to write into and its sync state.
CREATE TABLE IF NOT EXISTS public.connectors (
    id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name            TEXT NOT NULL,           -- 'gmail', 'calendar', 'github', 'generic'
    enabled         BOOLEAN NOT NULL DEFAULT TRUE,
    target_desktop_id UUID REFERENCES public.desktops(id) ON DELETE SET NULL,
    config          JSONB NOT NULL DEFAULT '{}'::jsonb,
    last_sync_at    TIMESTAMPTZ,
    last_sync_status TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (user_id, name)
);

CREATE INDEX IF NOT EXISTS connectors_user_id_idx ON public.connectors (user_id);

ALTER TABLE public.connectors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their own connectors" ON public.connectors;
CREATE POLICY "Users manage their own connectors"
    ON public.connectors
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);


-- ----------------------------------------------------------------------------
-- Done.
-- ----------------------------------------------------------------------------
