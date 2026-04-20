# fire-reminders Edge Function

Fires calendar reminders that are due (`event_reminders.fire_at <= now AND sent_at IS NULL`).

For each due reminder, delivers via:
- **WhatsApp** → POSTs to Sendell webhook → user receives WhatsApp message
- **Toast** → broadcasts on Supabase Realtime channel `reminders:${userId}` → in-app toast

The in-app `ReminderRealtimeService` (mounted at `app.ts` root) listens and pops a sticky toast with a "Ver evento" button that deep-links to `/calendar?view=day&date=...`.

---

## Deploy (one-time)

### 1. Set env vars in Supabase Dashboard

Go to **Project → Edge Functions → Secrets** and add:

```
SENDELL_WEBHOOK_URL = https://your-sendell-instance.com/api/incoming-reminder
SENDELL_TOKEN       = <shared-secret-string>
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are auto-injected — no need to set them.

### 2. Deploy the function

From `frontend/deskflow/`:

```bash
supabase functions deploy fire-reminders --no-verify-jwt
```

### 3. Schedule via pg_cron

In the Supabase SQL editor, run once:

```sql
-- Enable pg_cron + pg_net extensions if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule the function every 5 minutes
SELECT cron.schedule(
  'fire-reminders',
  '*/5 * * * *',
  $$
    SELECT net.http_post(
      url := 'https://<your-project-ref>.supabase.co/functions/v1/fire-reminders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    );
  $$
);
```

Replace `<your-project-ref>` with your actual project ref (e.g., `mzgwipdaveyzgscnxlhj`).

To unschedule later: `SELECT cron.unschedule('fire-reminders');`

---

## Sendell webhook payload

The function POSTs this JSON to `SENDELL_WEBHOOK_URL`:

```json
{
  "type": "calendar.reminder",
  "userId": "uuid",
  "eventId": "uuid",
  "title": "Reunión con cliente",
  "startsAt": "2026-04-19T15:00:00Z",
  "location": "Zoom",
  "minutesUntil": 15,
  "message": "Tienes \"Reunión con cliente\" en 15 minutos en Zoom"
}
```

Header: `X-Sendell-Token: <SENDELL_TOKEN>` — Sendell should reject any request without this header matching.

Sendell's job: take the `message` field and send it as WhatsApp text to the linked user. The full payload is provided so Sendell can build richer messages later (deep-links, location maps, etc.).

---

## Verifying deployment

```bash
# Manual invoke
curl -X POST https://<project-ref>.supabase.co/functions/v1/fire-reminders

# Expected response
{ "ok": true, "processed": 0, "now": "...", "results": [] }
```

If `processed > 0` it means there were due reminders and they were delivered. Check the `event_reminders` table — `sent_at` should now be populated for those rows.

---

## Failure modes

- **SENDELL_WEBHOOK_URL not configured** → WhatsApp deliveries are skipped, toasts still work.
- **Sendell returns 5xx** → reminder is marked `sent_at` anyway (no retry to avoid spam). Logged in the response.
- **User has the calendar route open** → toast appears immediately via realtime.
- **User is offline** → in-app toast is missed; WhatsApp delivery still succeeds.
- **Event was deleted between insert and fire** → marked `sent_at` with status `event-missing`, no delivery attempted.
