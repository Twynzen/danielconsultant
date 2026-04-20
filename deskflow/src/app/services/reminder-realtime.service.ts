import { Injectable, inject, effect } from '@angular/core';
import { Router } from '@angular/router';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import { ToastService } from '../shared/toast.service';

interface ReminderPayload {
  type: 'calendar.reminder';
  userId: string;
  eventId: string;
  title: string;
  startsAt: string;
  location?: string;
  minutesUntil: number;
  message: string;
}

/**
 * Listens on the user's `reminders:${userId}` Supabase realtime channel.
 * The fire-reminders Edge Function broadcasts a payload here whenever a
 * `event_reminders.fire_at` rolls over and the user has the toast channel
 * (or 'both') configured.
 *
 * On receive: pushes a Toast that links to /calendar at the event's day.
 * The realtime channel is rebuilt every time the auth user changes so a
 * sign-in/sign-out round-trip keeps the subscription pointed at the right
 * user without leaks.
 */
@Injectable({ providedIn: 'root' })
export class ReminderRealtimeService {
  private supabase = inject(SupabaseService);
  private auth = inject(AuthService);
  private toasts = inject(ToastService);
  private router = inject(Router);

  private channel: RealtimeChannel | null = null;
  private currentUserId: string | null = null;
  private started = false;

  start(): void {
    if (this.started) return;
    this.started = true;

    // Re-subscribe whenever the auth user changes (sign-in, switch, sign-out).
    effect(() => {
      const user = this.auth.currentUser();
      const userId = user?.id ?? null;
      if (userId === this.currentUserId) return;
      this.unsubscribe();
      this.currentUserId = userId;
      if (userId) this.subscribe(userId);
    });
  }

  private subscribe(userId: string): void {
    const client = this.supabase.client;
    if (!client) return;
    this.channel = client.channel(`reminders:${userId}`);
    this.channel
      .on('broadcast', { event: 'reminder' }, ({ payload }) => {
        const r = payload as ReminderPayload;
        if (!r || r.type !== 'calendar.reminder') return;
        this.toasts.push({
          icon: 'calendar',
          title: r.title,
          body: this.composeBody(r),
          action: 'Ver evento',
          onAction: () => this.router.navigate(['/calendar'], {
            queryParams: {
              view: 'day',
              date: format(parseISO(r.startsAt), 'yyyy-MM-dd'),
            },
          }),
          duration: 0,  // sticky — user dismisses or clicks action
        });
      })
      .subscribe();
  }

  private unsubscribe(): void {
    if (this.channel) {
      const client = this.supabase.client;
      try { client?.removeChannel(this.channel); } catch { /* ignore */ }
      this.channel = null;
    }
  }

  private composeBody(r: ReminderPayload): string {
    const parts: string[] = [];
    if (r.minutesUntil > 0) {
      parts.push(`En ${this.humanizeMinutes(r.minutesUntil)}`);
    } else {
      parts.push('Ahora');
    }
    if (r.location) parts.push(`📍 ${r.location}`);
    try {
      parts.push(format(parseISO(r.startsAt), "HH:mm", { locale: es }));
    } catch { /* ignore */ }
    return parts.join(' · ');
  }

  private humanizeMinutes(mins: number): string {
    if (mins >= 60 * 24) return `${Math.floor(mins / 1440)} día(s)`;
    if (mins >= 60) return `${Math.floor(mins / 60)} h`;
    return `${mins} min`;
  }
}
