import { Injectable, signal, computed, inject } from '@angular/core';
import { rrulestr, RRule } from 'rrule';
import { SupabaseService } from './supabase.service';
import { StorageService } from './storage.service';
import {
  Calendar,
  CalendarEvent,
  EventReminder,
  RecurrenceEditScope,
} from '../models/calendar.model';

/**
 * Owns the calendar UI state. Talks directly to Supabase via the existing
 * SupabaseService client — RLS handles ownership and the user's session
 * token is already injected by the auth flow on bootstrap.
 *
 * Recurring events are stored as a single row per series (rrule + dtstart);
 * we expand instances client-side for the active view window, so the same
 * pattern works regardless of how many years of recurrence the user has.
 */
/**
 * Marker for instances that originated from a note's metadata scheduling
 * rather than a calendar_events row. Used to route clicks back to the
 * note instead of the EventModal.
 */
export const NOTE_PSEUDO_CALENDAR_ID = '__notes__';

@Injectable({ providedIn: 'root' })
export class CalendarStorageService {
  private supabase = inject(SupabaseService);
  private noteStorage = inject(StorageService);

  // Raw rows pulled from Supabase (recurring rows kept as series).
  private _calendars = signal<Calendar[]>([]);
  private _eventRows = signal<CalendarEvent[]>([]);
  private _windowStart = signal<Date | null>(null);
  private _windowEnd = signal<Date | null>(null);
  private _loading = signal(false);

  readonly calendars = computed(() => this._calendars());
  readonly loading = computed(() => this._loading());

  /** Visible calendar IDs (visibility toggle from sidebar). */
  readonly visibleCalendarIds = computed(
    () => new Set(this._calendars().filter(c => c.visible).map(c => c.id))
  );

  /**
   * All event INSTANCES inside the current window. Includes two sources:
   *   1. Rows from calendar_events (including recurring series expanded)
   *   2. Notes whose metadata.scheduledStart/End falls in the window —
   *      rendered with a synthetic `calendarId = NOTE_PSEUDO_CALENDAR_ID`
   *      so the UI can route clicks back to the note instead of opening
   *      the event modal.
   *
   * Notes are the primary entity in Daniel's workflow; the calendar is a
   * view. A note with a schedule appears here automatically.
   */
  readonly events = computed(() => {
    const start = this._windowStart();
    const end = this._windowEnd();
    if (!start || !end) return [] as CalendarInstance[];
    const visible = this.visibleCalendarIds();
    const out: CalendarInstance[] = [];

    // Source 1: calendar_events rows (with RRULE expansion)
    for (const row of this._eventRows()) {
      if (!visible.has(row.calendarId)) continue;
      out.push(...this.expandInstances(row, start, end));
    }

    // Source 2: notes with metadata.scheduledStart/End in the window.
    // Read the notes signal so this computed re-runs when notes change.
    // StorageService exposes `desktops` as a computed signal — reading it
    // here creates the reactive dependency we need for auto-refresh.
    this.noteStorage.desktops();
    for (const { note, desktop } of this.noteStorage.scheduledNotes(start, end)) {
      const s = note.metadata?.scheduledStart;
      const e = note.metadata?.scheduledEnd;
      if (!s || !e) continue;
      out.push({
        id: `note-${note.id}`,
        userId: '',
        calendarId: NOTE_PSEUDO_CALENDAR_ID,
        title: note.title || '(sin título)',
        description: desktop.name,
        location: undefined,
        startsAt: s,
        endsAt: e,
        allDay: false,
        rrule: undefined,
        rruleExdates: undefined,
        recurrenceParentId: undefined,
        linkedNoteId: note.id,
        icsUid: undefined,
        metadata: {},
        createdAt: new Date(note.createdAt).toISOString(),
        updatedAt: new Date(note.updatedAt).toISOString(),
        instanceStart: s,
        color: note.color ?? '#00ff41',
      } satisfies CalendarInstance);
    }

    out.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    return out;
  });

  // ==================== LOAD ====================

  async loadCalendars(): Promise<void> {
    const client = this.supabase.client;
    if (!client) return;
    const { data, error } = await client
      .from('calendars')
      .select('*')
      .order('is_default', { ascending: false })
      .order('name');
    if (error) {
      console.error('[CalendarStorage] loadCalendars error', error);
      return;
    }
    this._calendars.set((data || []).map(rowToCalendar));
    if (data && data.length === 0) {
      // First-time use — bootstrap a default calendar so the UI isn't empty.
      await this.createCalendar('Mi Calendario', '#00ff41', true);
    }
  }

  async loadRange(start: Date, end: Date): Promise<void> {
    this._windowStart.set(start);
    this._windowEnd.set(end);
    const client = this.supabase.client;
    if (!client) return;
    this._loading.set(true);
    try {
      // Pull every series for the user. Recurring series might extend past
      // the window so we can't filter by `starts_at` in SQL alone — we
      // instead pull all events and let the expander prune. For users with
      // huge calendars this can later be optimized with a "starts_at <= end
      // AND (rrule IS NULL → ends_at >= start)" predicate plus a separate
      // pass for recurrings.
      const { data, error } = await client
        .from('calendar_events')
        .select('*');
      if (error) {
        console.error('[CalendarStorage] loadRange error', error);
        return;
      }
      this._eventRows.set((data || []).map(rowToEvent));
    } finally {
      this._loading.set(false);
    }
  }

  // ==================== CRUD ====================

  async createCalendar(name: string, color = '#00ff41', isDefault = false): Promise<Calendar | null> {
    const client = this.supabase.client;
    if (!client) return null;
    if (isDefault) {
      await client.from('calendars')
        .update({ is_default: false })
        .eq('is_default', true);
    }
    const { data, error } = await client
      .from('calendars')
      .insert({ name: name.trim(), color, is_default: isDefault })
      .select()
      .single();
    if (error || !data) {
      console.error('[CalendarStorage] createCalendar error', error);
      return null;
    }
    const cal = rowToCalendar(data);
    this._calendars.update(list => [...list, cal]);
    return cal;
  }

  async updateCalendar(id: string, patch: Partial<Calendar>): Promise<void> {
    const client = this.supabase.client;
    if (!client) return;
    const dbPatch: Record<string, unknown> = {};
    if (patch.name !== undefined) dbPatch['name'] = patch.name;
    if (patch.color !== undefined) dbPatch['color'] = patch.color;
    if (patch.visible !== undefined) dbPatch['visible'] = patch.visible;
    if (patch.isDefault !== undefined) dbPatch['is_default'] = patch.isDefault;
    const { error } = await client.from('calendars').update(dbPatch).eq('id', id);
    if (error) {
      console.error('[CalendarStorage] updateCalendar error', error);
      return;
    }
    this._calendars.update(list =>
      list.map(c => (c.id === id ? { ...c, ...patch } : c))
    );
  }

  async deleteCalendar(id: string): Promise<void> {
    const client = this.supabase.client;
    if (!client) return;
    const { error } = await client.from('calendars').delete().eq('id', id);
    if (error) {
      console.error('[CalendarStorage] deleteCalendar error', error);
      return;
    }
    this._calendars.update(list => list.filter(c => c.id !== id));
    this._eventRows.update(list => list.filter(e => e.calendarId !== id));
  }

  async createEvent(input: EventCreateInput): Promise<CalendarEvent | null> {
    const client = this.supabase.client;
    if (!client) return null;
    const row = {
      calendar_id: input.calendarId,
      title: input.title.trim().slice(0, 200),
      description: input.description ?? null,
      location: input.location ?? null,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      all_day: input.allDay ?? false,
      rrule: input.rrule ?? null,
      linked_note_id: input.linkedNoteId ?? null,
    };
    const { data, error } = await client
      .from('calendar_events')
      .insert(row)
      .select()
      .single();
    if (error || !data) {
      console.error('[CalendarStorage] createEvent error', error);
      return null;
    }
    const evt = rowToEvent(data);

    if (input.reminders?.length) {
      const dtstart = new Date(input.startsAt);
      const reminderRows = input.reminders.map(r => ({
        event_id: evt.id,
        minutes_before: r.minutesBefore,
        channel: r.channel,
        fire_at: new Date(dtstart.getTime() - r.minutesBefore * 60_000).toISOString(),
      }));
      await client.from('event_reminders').insert(reminderRows);
    }

    this._eventRows.update(list => [...list, evt]);
    return evt;
  }

  async updateEvent(
    id: string,
    patch: EventPatch,
    scope: RecurrenceEditScope = 'this',
  ): Promise<void> {
    const client = this.supabase.client;
    if (!client) return;
    const existing = this._eventRows().find(e => e.id === id);
    if (!existing) {
      console.warn('[CalendarStorage] updateEvent: id not found locally', id);
    }
    const isRecurring = !!existing?.rrule;

    const dbPatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.title !== undefined) dbPatch['title'] = patch.title.slice(0, 200);
    if (patch.startsAt !== undefined) dbPatch['starts_at'] = patch.startsAt;
    if (patch.endsAt !== undefined) dbPatch['ends_at'] = patch.endsAt;
    if (patch.allDay !== undefined) dbPatch['all_day'] = patch.allDay;
    if (patch.description !== undefined) dbPatch['description'] = patch.description;
    if (patch.location !== undefined) dbPatch['location'] = patch.location;
    if (patch.rrule !== undefined) dbPatch['rrule'] = patch.rrule;
    if (patch.linkedNoteId !== undefined) dbPatch['linked_note_id'] = patch.linkedNoteId;
    if (patch.calendarId !== undefined) dbPatch['calendar_id'] = patch.calendarId;

    if (!isRecurring || scope === 'all') {
      const { data, error } = await client
        .from('calendar_events')
        .update(dbPatch)
        .eq('id', id)
        .select()
        .single();
      if (error) {
        console.error('[CalendarStorage] updateEvent error', error);
        return;
      }
      if (data) {
        const updated = rowToEvent(data);
        this._eventRows.update(list => list.map(e => (e.id === id ? updated : e)));
      }
      return;
    }

    if (scope === 'this' && existing) {
      // Add the original starts_at to parent's exdates and create an isolated event.
      const exdates = [...(existing.rruleExdates ?? []), existing.startsAt];
      const isolated = {
        calendar_id: dbPatch['calendar_id'] ?? existing.calendarId,
        title: dbPatch['title'] ?? existing.title,
        description: dbPatch['description'] ?? existing.description ?? null,
        location: dbPatch['location'] ?? existing.location ?? null,
        starts_at: dbPatch['starts_at'] ?? existing.startsAt,
        ends_at: dbPatch['ends_at'] ?? existing.endsAt,
        all_day: dbPatch['all_day'] ?? existing.allDay,
        rrule: null,
        recurrence_parent_id: existing.id,
        linked_note_id: dbPatch['linked_note_id'] ?? existing.linkedNoteId ?? null,
      };
      await client.from('calendar_events').update({ rrule_exdates: exdates }).eq('id', id);
      const { data: ins } = await client
        .from('calendar_events')
        .insert(isolated)
        .select()
        .single();
      this._eventRows.update(list => {
        const next = list.map(e =>
          e.id === id ? { ...e, rruleExdates: exdates } : e
        );
        if (ins) next.push(rowToEvent(ins));
        return next;
      });
      return;
    }

    // scope === 'future'
    if (existing) {
      const cutoff = (patch.startsAt ?? existing.startsAt).replace(/[-:]/g, '').replace(/\.\d+/, '').slice(0, 15) + 'Z';
      const oldRrule = existing.rrule ?? '';
      const stripped = oldRrule.split(';').filter(p => !p.toUpperCase().startsWith('UNTIL=')).join(';');
      const newParentRrule = stripped ? `${stripped};UNTIL=${cutoff}` : `UNTIL=${cutoff}`;
      const newSeries = {
        calendar_id: dbPatch['calendar_id'] ?? existing.calendarId,
        title: dbPatch['title'] ?? existing.title,
        description: dbPatch['description'] ?? existing.description ?? null,
        location: dbPatch['location'] ?? existing.location ?? null,
        starts_at: dbPatch['starts_at'] ?? existing.startsAt,
        ends_at: dbPatch['ends_at'] ?? existing.endsAt,
        all_day: dbPatch['all_day'] ?? existing.allDay,
        rrule: dbPatch['rrule'] ?? existing.rrule,
        linked_note_id: dbPatch['linked_note_id'] ?? existing.linkedNoteId ?? null,
      };
      await client.from('calendar_events').update({ rrule: newParentRrule }).eq('id', id);
      const { data: ins } = await client
        .from('calendar_events')
        .insert(newSeries)
        .select()
        .single();
      this._eventRows.update(list => {
        const next = list.map(e =>
          e.id === id ? { ...e, rrule: newParentRrule } : e
        );
        if (ins) next.push(rowToEvent(ins));
        return next;
      });
    }
  }

  async deleteEvent(id: string, scope: RecurrenceEditScope = 'this'): Promise<void> {
    const client = this.supabase.client;
    if (!client) return;
    const existing = this._eventRows().find(e => e.id === id);
    const isRecurring = !!existing?.rrule;

    if (!isRecurring || scope === 'all') {
      await client.from('calendar_events').delete().eq('id', id);
      this._eventRows.update(list => list.filter(e => e.id !== id));
      return;
    }

    if (scope === 'this' && existing) {
      const exdates = [...(existing.rruleExdates ?? []), existing.startsAt];
      await client.from('calendar_events').update({ rrule_exdates: exdates }).eq('id', id);
      this._eventRows.update(list =>
        list.map(e => (e.id === id ? { ...e, rruleExdates: exdates } : e))
      );
      return;
    }

    // scope === 'future'
    if (existing) {
      const cutoff = existing.startsAt.replace(/[-:]/g, '').replace(/\.\d+/, '').slice(0, 15) + 'Z';
      const oldRrule = existing.rrule ?? '';
      const stripped = oldRrule.split(';').filter(p => !p.toUpperCase().startsWith('UNTIL=')).join(';');
      const newRrule = stripped ? `${stripped};UNTIL=${cutoff}` : `UNTIL=${cutoff}`;
      await client.from('calendar_events').update({ rrule: newRrule }).eq('id', id);
      this._eventRows.update(list =>
        list.map(e => (e.id === id ? { ...e, rrule: newRrule } : e))
      );
    }
  }

  // ==================== HELPERS ====================

  /** Color lookup used by views that render event blocks. */
  colorFor(calendarId: string): string {
    return this._calendars().find(c => c.id === calendarId)?.color ?? '#00ff41';
  }

  /** Convenience for daily-dashboard timeline (Phase 4 hook). */
  getTodayEvents(): CalendarInstance[] {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const visible = this.visibleCalendarIds();
    const out: CalendarInstance[] = [];
    for (const row of this._eventRows()) {
      if (!visible.has(row.calendarId)) continue;
      out.push(...this.expandInstances(row, start, end));
    }
    out.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    return out;
  }

  private expandInstances(row: CalendarEvent, start: Date, end: Date): CalendarInstance[] {
    if (!row.rrule) {
      const s = new Date(row.startsAt);
      const e = new Date(row.endsAt);
      if (e < start || s > end) return [];
      return [{
        ...row,
        instanceStart: row.startsAt,
        color: this.colorFor(row.calendarId),
      }];
    }
    try {
      const dtstart = new Date(row.startsAt);
      const duration = new Date(row.endsAt).getTime() - dtstart.getTime();
      const rule = rrulestr(row.rrule, { dtstart });
      const occurrences = rule.between(start, end, true);
      const exdates = new Set((row.rruleExdates ?? []).map(d => new Date(d).toISOString()));
      const out: CalendarInstance[] = [];
      for (const occ of occurrences) {
        const occIso = occ.toISOString();
        if (exdates.has(occIso)) continue;
        out.push({
          ...row,
          startsAt: occIso,
          endsAt: new Date(occ.getTime() + duration).toISOString(),
          instanceStart: occIso,
          color: this.colorFor(row.calendarId),
        });
      }
      return out;
    } catch (e) {
      console.warn('[CalendarStorage] failed to expand RRULE for event', row.id, e);
      return [];
    }
  }
}

// ===== local types ========================================================

export interface CalendarInstance extends CalendarEvent {
  /** Unique within a series — combine with `id` if you need a stable key. */
  instanceStart: string;
  color: string;
}

export interface EventCreateInput {
  calendarId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  allDay?: boolean;
  description?: string;
  location?: string;
  rrule?: string;
  linkedNoteId?: string;
  reminders?: Array<{ minutesBefore: number; channel: 'whatsapp' | 'toast' | 'both' }>;
}

export interface EventPatch {
  calendarId?: string;
  title?: string;
  startsAt?: string;
  endsAt?: string;
  allDay?: boolean;
  description?: string;
  location?: string;
  rrule?: string | null;
  linkedNoteId?: string | null;
}

// ===== row mappers =========================================================

function rowToCalendar(row: any): Calendar {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    color: row.color,
    visible: row.visible ?? true,
    isDefault: row.is_default ?? false,
    source: row.source ?? 'manual',
    createdAt: row.created_at,
  };
}

function rowToEvent(row: any): CalendarEvent {
  return {
    id: row.id,
    userId: row.user_id,
    calendarId: row.calendar_id,
    title: row.title,
    description: row.description ?? undefined,
    location: row.location ?? undefined,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    allDay: row.all_day ?? false,
    rrule: row.rrule ?? undefined,
    rruleExdates: row.rrule_exdates ?? undefined,
    recurrenceParentId: row.recurrence_parent_id ?? undefined,
    linkedNoteId: row.linked_note_id ?? undefined,
    icsUid: row.ics_uid ?? undefined,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
