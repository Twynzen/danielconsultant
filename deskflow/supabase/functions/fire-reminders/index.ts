// Supabase Edge Function — fire-reminders
// ============================================================================
//
// Scheduled via Supabase pg_cron every 5 minutes (see deploy notes below).
// Picks every event_reminders row whose fire_at <= now and sent_at IS NULL,
// then for each row:
//   1. If channel ∈ {whatsapp, both} → POST to SENDELL_WEBHOOK_URL
//   2. If channel ∈ {toast, both}    → broadcast to `reminders:${userId}`
//                                        (the in-app ReminderRealtimeService
//                                         is listening on that channel)
//   3. Mark sent_at=now to prevent re-fires
//
// Failures in either delivery channel are recorded in the response payload
// but do NOT roll back the sent_at update — we don't want a flaky
// downstream to pile up retried alerts. The user's safety net is the
// next ICS sync (re-creates events) and the in-app calendar view.
//
// Required env vars (Supabase Dashboard → Edge Functions → Secrets):
//   - SENDELL_WEBHOOK_URL    (HTTPS endpoint Sendell exposes for incoming
//                             reminders; must accept POST + return 2xx)
//   - SENDELL_TOKEN          (shared secret sent in X-Sendell-Token header)
//   - SUPABASE_URL           (auto-injected by Supabase runtime)
//   - SUPABASE_SERVICE_ROLE_KEY (auto-injected by Supabase runtime)
//
// Deploy:
//   supabase functions deploy fire-reminders --no-verify-jwt
//
// Schedule via SQL editor (one-shot setup, idempotent if you guard with
// SELECT cron.schedule(...) on first call):
//
//   SELECT cron.schedule(
//     'fire-reminders',
//     '*/5 * * * *',
//     $$
//       SELECT net.http_post(
//         url := 'https://<project-ref>.supabase.co/functions/v1/fire-reminders',
//         headers := jsonb_build_object(
//           'Content-Type', 'application/json',
//           'Authorization', 'Bearer ' || current_setting('app.cron_secret')
//         ),
//         body := '{}'::jsonb
//       );
//     $$
//   );
// ============================================================================

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

interface ReminderRow {
  id: string;
  user_id: string;
  event_id: string;
  channel: 'whatsapp' | 'toast' | 'both';
  fire_at: string;
  calendar_events: {
    title: string;
    starts_at: string;
    location: string | null;
  } | null;
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SENDELL_URL = Deno.env.get('SENDELL_WEBHOOK_URL') ?? '';
const SENDELL_TOKEN = Deno.env.get('SENDELL_TOKEN') ?? '';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});

function minutesBetween(now: Date, future: string): number {
  const ms = new Date(future).getTime() - now.getTime();
  return Math.max(0, Math.round(ms / 60_000));
}

function buildMessage(title: string, minutesUntil: number, location: string | null): string {
  const when = minutesUntil <= 0
    ? 'ahora'
    : minutesUntil < 60
      ? `en ${minutesUntil} minutos`
      : minutesUntil < 1440
        ? `en ${Math.floor(minutesUntil / 60)} horas`
        : `en ${Math.floor(minutesUntil / 1440)} días`;
  let msg = `Tienes "${title}" ${when}`;
  if (location) msg += ` en ${location}`;
  return msg;
}

serve(async (_req) => {
  const now = new Date();
  const nowIso = now.toISOString();

  // Pick due, unsent reminders. JOIN gives us the event details in one shot.
  const { data, error } = await supabase
    .from('event_reminders')
    .select('id, user_id, event_id, channel, fire_at, calendar_events(title, starts_at, location)')
    .lte('fire_at', nowIso)
    .is('sent_at', null)
    .limit(200);

  if (error) {
    console.error('[fire-reminders] query error', error);
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const due = (data ?? []) as ReminderRow[];
  const results: Array<{ id: string; status: string; error?: string }> = [];

  for (const r of due) {
    const evt = r.calendar_events;
    const failures: string[] = [];

    if (!evt) {
      // Event was deleted between insert and fire — nothing to deliver.
      await supabase.from('event_reminders').update({ sent_at: nowIso }).eq('id', r.id);
      results.push({ id: r.id, status: 'event-missing' });
      continue;
    }

    const minutesUntil = minutesBetween(now, evt.starts_at);
    const payload = {
      type: 'calendar.reminder',
      userId: r.user_id,
      eventId: r.event_id,
      title: evt.title,
      startsAt: evt.starts_at,
      location: evt.location,
      minutesUntil,
      message: buildMessage(evt.title, minutesUntil, evt.location),
    };

    if (r.channel === 'whatsapp' || r.channel === 'both') {
      if (!SENDELL_URL) {
        failures.push('whatsapp: SENDELL_WEBHOOK_URL not configured');
      } else {
        try {
          const res = await fetch(SENDELL_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Sendell-Token': SENDELL_TOKEN,
            },
            body: JSON.stringify(payload),
          });
          if (!res.ok) failures.push(`whatsapp: HTTP ${res.status}`);
        } catch (e) {
          failures.push(`whatsapp: ${(e as Error).message}`);
        }
      }
    }

    if (r.channel === 'toast' || r.channel === 'both') {
      try {
        const channel = supabase.channel(`reminders:${r.user_id}`);
        await channel.send({
          type: 'broadcast',
          event: 'reminder',
          payload,
        });
        // Realtime channels stay open per process — don't try to remove here,
        // the function instance is reused for subsequent invocations.
      } catch (e) {
        failures.push(`toast: ${(e as Error).message}`);
      }
    }

    // Mark sent regardless — we don't retry to avoid spamming the user.
    await supabase.from('event_reminders').update({ sent_at: nowIso }).eq('id', r.id);

    results.push({
      id: r.id,
      status: failures.length === 0 ? 'sent' : 'partial',
      error: failures.length > 0 ? failures.join('; ') : undefined,
    });
  }

  return new Response(
    JSON.stringify({
      ok: true,
      processed: results.length,
      now: nowIso,
      results,
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
