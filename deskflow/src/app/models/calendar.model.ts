/**
 * DeskFlow Calendar — domain types.
 *
 * Lives in its own file (not desktop.model.ts) because the calendar route
 * is lazy-loaded; keeping the types separate lets the existing desktop
 * bundle stay slim until the user opens /calendar for the first time.
 */

export type CalendarSource = 'manual' | 'ics' | 'google';

export interface Calendar {
  id: string;
  userId: string;
  name: string;
  /** Hex string. Used to color event blocks across every view. */
  color: string;
  visible: boolean;
  isDefault: boolean;
  source: CalendarSource;
  createdAt: string;
}

export type ReminderChannel = 'whatsapp' | 'toast' | 'both';

export interface EventReminder {
  id: string;
  eventId: string;
  /** Minutes before `event.startsAt` the reminder fires. 0 = at event time. */
  minutesBefore: number;
  channel: ReminderChannel;
  fireAt: string;
  sentAt?: string;
}

/**
 * A single calendar event. If `rrule` is set, the event represents an
 * entire recurring series and the API expands instances on demand.
 *
 * `linkedNoteId` bridges to a DeskFlow note so an event can deep-link to a
 * project/task and a project note can show its upcoming events.
 */
export interface CalendarEvent {
  id: string;
  userId: string;
  calendarId: string;
  title: string;
  description?: string;
  location?: string;
  /** ISO 8601 with timezone. */
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  /** RFC 5545 RRULE string, e.g. "FREQ=WEEKLY;BYDAY=MO". */
  rrule?: string;
  /** Dates excluded from the recurring series (used by "this only" edits). */
  rruleExdates?: string[];
  recurrenceParentId?: string;
  linkedNoteId?: string;
  /** Set by ICS ingestion — enables idempotent re-import. */
  icsUid?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  /** Hydrated client-side from /api/agent/events?include=reminders. */
  reminders?: EventReminder[];
}

/**
 * Edit-scope sent to the server when mutating a recurring event:
 *   - `this`    → adds an EXDATE and inserts a new isolated event
 *   - `future`  → splits the series at this instance
 *   - `all`     → patches the parent series row
 */
export type RecurrenceEditScope = 'this' | 'future' | 'all';

export type CalendarView = 'day' | 'week' | 'month' | 'agenda';
