import { Component, computed, signal, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import {
  startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  addDays, addWeeks, addMonths, format, isSameDay, isToday, parseISO,
  differenceInMinutes, isWithinInterval, eachDayOfInterval,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarStorageService, CalendarInstance, NOTE_PSEUDO_CALENDAR_ID } from '../../services/calendar-storage.service';
import { StorageService } from '../../services/storage.service';
import { CalendarView } from '../../models/calendar.model';
import { EventModalComponent, EventModalResult } from './event-modal.component';
import { RecurrenceScopeModalComponent } from './recurrence-scope-modal.component';
import { CalendarSidebarComponent } from './calendar-sidebar.component';

const HOUR_HEIGHT = 56;     // px per hour in day/week grid
const SLOT_MINUTES = 15;    // snap drag-to-create to 15-min increments

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    EventModalComponent,
    RecurrenceScopeModalComponent,
    CalendarSidebarComponent,
  ],
  templateUrl: './calendar.component.html',
  styleUrl: './calendar.component.scss',
})
export class CalendarComponent implements OnInit, OnDestroy {
  private storage = inject(CalendarStorageService);
  private noteStorage = inject(StorageService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  // ===== view state =====
  currentView = signal<CalendarView>('week');
  cursor = signal<Date>(new Date());

  // ===== modal state =====
  showEventModal = signal(false);
  editingEvent = signal<CalendarInstance | null>(null);
  // When the user starts a NEW event by dragging in the grid, we prefill
  // these. For "edit existing" we hand the instance to editingEvent instead.
  modalPrefill = signal<{ startsAt: string; endsAt: string } | null>(null);

  showScopeModal = signal(false);
  pendingScopeAction = signal<'edit' | 'delete' | null>(null);
  pendingScopeEvent = signal<CalendarInstance | null>(null);
  pendingPatch = signal<EventModalResult | null>(null);

  // ===== drag-to-create state (day/week views) =====
  dragStart = signal<{ minutes: number; day: Date } | null>(null);
  dragEnd = signal<{ minutes: number; day: Date } | null>(null);

  // ===== derived =====
  readonly hours = Array.from({ length: 24 }, (_, i) => i);
  readonly weekdayLabels = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  readonly calendars = computed(() => this.storage.calendars());
  readonly events = computed(() => this.storage.events());

  readonly windowDays = computed(() => {
    const view = this.currentView();
    const c = this.cursor();
    if (view === 'day') return [startOfDay(c)];
    if (view === 'week') {
      const wkStart = startOfWeek(c, { weekStartsOn: 1, locale: es });
      return Array.from({ length: 7 }, (_, i) => addDays(wkStart, i));
    }
    if (view === 'month') {
      // Render full weeks containing the month edges (typical 6×7 grid).
      const mStart = startOfMonth(c);
      const mEnd = endOfMonth(c);
      const gridStart = startOfWeek(mStart, { weekStartsOn: 1, locale: es });
      const gridEnd = endOfWeek(mEnd, { weekStartsOn: 1, locale: es });
      return eachDayOfInterval({ start: gridStart, end: gridEnd });
    }
    // agenda → 30 days starting today
    return Array.from({ length: 30 }, (_, i) => addDays(startOfDay(c), i));
  });

  readonly periodLabel = computed(() => {
    const view = this.currentView();
    const c = this.cursor();
    if (view === 'day') return format(c, "EEEE d 'de' MMMM, yyyy", { locale: es });
    if (view === 'week') {
      const wkStart = startOfWeek(c, { weekStartsOn: 1, locale: es });
      const wkEnd = addDays(wkStart, 6);
      return `${format(wkStart, 'd MMM', { locale: es })} – ${format(wkEnd, "d MMM yyyy", { locale: es })}`;
    }
    if (view === 'month') return format(c, "MMMM yyyy", { locale: es });
    return `Próximos 30 días desde ${format(c, "d MMM", { locale: es })}`;
  });

  // ===== lifecycle =====

  async ngOnInit(): Promise<void> {
    const params = this.route.snapshot.queryParamMap;
    const view = params.get('view') as CalendarView | null;
    if (view && ['day', 'week', 'month', 'agenda'].includes(view)) {
      this.currentView.set(view);
    }
    const dateParam = params.get('date');
    if (dateParam) {
      try { this.cursor.set(parseISO(dateParam)); } catch { /* ignore */ }
    }
    await this.storage.loadCalendars();
    await this.refreshWindow();
  }

  ngOnDestroy(): void { /* nothing to clean up yet */ }

  // ===== view + cursor =====

  setView(view: CalendarView): void {
    this.currentView.set(view);
    this.syncUrl();
    this.refreshWindow();
  }

  navigatePrev(): void {
    const view = this.currentView();
    const c = this.cursor();
    if (view === 'day') this.cursor.set(addDays(c, -1));
    else if (view === 'week') this.cursor.set(addWeeks(c, -1));
    else if (view === 'month') this.cursor.set(addMonths(c, -1));
    else this.cursor.set(addDays(c, -7));
    this.syncUrl();
    this.refreshWindow();
  }

  navigateNext(): void {
    const view = this.currentView();
    const c = this.cursor();
    if (view === 'day') this.cursor.set(addDays(c, 1));
    else if (view === 'week') this.cursor.set(addWeeks(c, 1));
    else if (view === 'month') this.cursor.set(addMonths(c, 1));
    else this.cursor.set(addDays(c, 7));
    this.syncUrl();
    this.refreshWindow();
  }

  navigateToday(): void {
    this.cursor.set(new Date());
    this.syncUrl();
    this.refreshWindow();
  }

  private syncUrl(): void {
    this.router.navigate([], {
      queryParams: {
        view: this.currentView(),
        date: format(this.cursor(), 'yyyy-MM-dd'),
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private async refreshWindow(): Promise<void> {
    const view = this.currentView();
    const c = this.cursor();
    let start: Date, end: Date;
    if (view === 'day') {
      start = startOfDay(c); end = endOfDay(c);
    } else if (view === 'week') {
      const ws = startOfWeek(c, { weekStartsOn: 1, locale: es });
      start = startOfDay(ws); end = endOfDay(addDays(ws, 6));
    } else if (view === 'month') {
      const days = this.windowDays();
      start = startOfDay(days[0]); end = endOfDay(days[days.length - 1]);
    } else {
      start = startOfDay(c); end = endOfDay(addDays(c, 30));
    }
    await this.storage.loadRange(start, end);
  }

  // ===== events for a specific day (used by week/month/agenda views) =====

  eventsForDay(day: Date): CalendarInstance[] {
    return this.events().filter(e => isSameDay(parseISO(e.startsAt), day));
  }

  /** Position of the "now" indicator inside the day grid (px from top). */
  nowIndicatorTop(): number {
    const now = new Date();
    return now.getHours() * HOUR_HEIGHT + (now.getMinutes() / 60) * HOUR_HEIGHT;
  }

  isToday(day: Date): boolean { return isToday(day); }

  // ===== event block layout (day/week views) =====

  blockTop(event: CalendarInstance): number {
    const start = parseISO(event.startsAt);
    return start.getHours() * HOUR_HEIGHT + (start.getMinutes() / 60) * HOUR_HEIGHT;
  }

  blockHeight(event: CalendarInstance): number {
    const minutes = differenceInMinutes(parseISO(event.endsAt), parseISO(event.startsAt));
    return Math.max(20, (minutes / 60) * HOUR_HEIGHT);
  }

  // ===== drag-to-create =====

  onGridPointerDown(day: Date, event: PointerEvent): void {
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const minutes = this.snapMinutes(((event.clientY - rect.top) / HOUR_HEIGHT) * 60);
    this.dragStart.set({ minutes, day });
    this.dragEnd.set({ minutes: minutes + 30, day });
  }

  onGridPointerMove(day: Date, event: PointerEvent): void {
    if (!this.dragStart()) return;
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const minutes = this.snapMinutes(((event.clientY - rect.top) / HOUR_HEIGHT) * 60);
    this.dragEnd.set({ minutes, day });
  }

  onGridPointerUp(): void {
    const start = this.dragStart();
    const end = this.dragEnd();
    this.dragStart.set(null);
    this.dragEnd.set(null);
    if (!start || !end) return;
    const lo = Math.min(start.minutes, end.minutes);
    const hi = Math.max(start.minutes, end.minutes);
    if (hi - lo < 15) return;  // ignore micro-drags

    const startsAt = this.minutesToIso(start.day, lo);
    const endsAt = this.minutesToIso(start.day, hi);
    this.openCreate({ startsAt, endsAt });
  }

  /** Drag-ghost CSS for the in-progress block. */
  ghostStyle(): { top: string; height: string; display: string } {
    const start = this.dragStart();
    const end = this.dragEnd();
    if (!start || !end) return { top: '0', height: '0', display: 'none' };
    const lo = Math.min(start.minutes, end.minutes);
    const hi = Math.max(start.minutes, end.minutes);
    return {
      top: `${(lo / 60) * HOUR_HEIGHT}px`,
      height: `${((hi - lo) / 60) * HOUR_HEIGHT}px`,
      display: 'block',
    };
  }

  ghostBelongsTo(day: Date): boolean {
    const s = this.dragStart();
    return !!s && isSameDay(s.day, day);
  }

  private snapMinutes(raw: number): number {
    return Math.max(0, Math.min(24 * 60, Math.round(raw / SLOT_MINUTES) * SLOT_MINUTES));
  }

  private minutesToIso(day: Date, minutes: number): string {
    const d = new Date(day);
    d.setHours(0, 0, 0, 0);
    d.setMinutes(minutes);
    return d.toISOString();
  }

  // ===== modal flows =====

  /**
   * Primary flow for "arrastré 10am–11am, créalo". Asks once whether the
   * user prefers creating a note (the default / Daniel's workflow) or a
   * calendar_events row (for recurring / ICS-sourced events). Remembers
   * the choice via localStorage so subsequent drags don't re-prompt.
   */
  openCreate(prefill?: { startsAt?: string; endsAt?: string }): void {
    const startsAt = prefill?.startsAt ?? (() => {
      const now = new Date();
      now.setMinutes(0, 0, 0);
      return now.toISOString();
    })();
    const endsAt = prefill?.endsAt ?? new Date(
      new Date(startsAt).getTime() + 60 * 60 * 1000
    ).toISOString();

    const saved = localStorage.getItem('calendar.createAs');
    const createAs = saved === 'note' || saved === 'event'
      ? saved
      : this.askCreateKind();
    if (!createAs) return;

    if (createAs === 'note') {
      this.createScheduledNote(startsAt, endsAt);
    } else {
      this.editingEvent.set(null);
      this.modalPrefill.set({ startsAt, endsAt });
      this.showEventModal.set(true);
    }
  }

  /**
   * Opens the note in its home desktop. The schedule bar inside the note
   * is the primary edit surface — there's nothing calendar-specific to
   * edit here, the note and its metadata own the state.
   */
  openEdit(event: CalendarInstance): void {
    if (event.calendarId === NOTE_PSEUDO_CALENDAR_ID && event.linkedNoteId) {
      const all = this.noteStorage.getAllNotes();
      const entry = all.find(e => e.note.id === event.linkedNoteId);
      if (entry) {
        this.noteStorage.navigateToDesktop(entry.desktop.id);
        this.noteStorage.bringNoteToFront(entry.note.id);
      }
      this.router.navigate(['/']);
      return;
    }
    this.editingEvent.set(event);
    this.modalPrefill.set(null);
    this.showEventModal.set(true);
  }

  private askCreateKind(): 'note' | 'event' | null {
    const msg =
      'Crear aquí como:\n\n' +
      '  OK    → Nota con horario (recomendado)\n' +
      '  Cancelar → Evento de calendario (recurrente / importable)';
    const chose = window.confirm(msg);
    // Not ideal UX long-term (should be a real modal), but acceptable for
    // MVP. Remember the choice so the prompt only appears once per user.
    if (chose === null) return null;
    const kind = chose ? 'note' : 'event';
    localStorage.setItem('calendar.createAs', kind);
    return kind;
  }

  /**
   * Creates a blank note on the root desktop with scheduledStart/End
   * prefilled. The user lands on the calendar after creation — the new
   * block is immediately visible on the grid because the events() computed
   * reacts to the notes signal.
   */
  private createScheduledNote(startsAt: string, endsAt: string): void {
    // Pick the root desktop as the default home. Could extend later to
    // remember the last-edited desktop.
    const root = this.noteStorage.desktops().find(d => !d.parentId);
    const targetDesktopId = root?.id ?? this.noteStorage.desktops()[0]?.id;
    if (!targetDesktopId) {
      console.warn('[Calendar] no desktop available to host a scheduled note');
      return;
    }
    if (this.noteStorage.currentDesktop()?.id !== targetDesktopId) {
      this.noteStorage.navigateToDesktop(targetDesktopId);
    }
    // Place the note somewhere visible. We reuse the same randomisation
    // desktop.component does for manual Add Note.
    const x = 80 + Math.random() * 200;
    const y = 100 + Math.random() * 150;
    const created = this.noteStorage.addNote({ x, y });
    this.noteStorage.updateNoteMetadata(created.id, {
      scheduledStart: startsAt,
      scheduledEnd: endsAt,
      type: 'task',
    });
  }

  async onModalSave(result: EventModalResult): Promise<void> {
    const editing = this.editingEvent();

    if (editing && editing.rrule) {
      // Recurring → ask scope first, then apply.
      this.pendingScopeAction.set('edit');
      this.pendingScopeEvent.set(editing);
      this.pendingPatch.set(result);
      this.showScopeModal.set(true);
      this.showEventModal.set(false);
      return;
    }

    if (editing) {
      await this.storage.updateEvent(editing.id, this.toPatch(result), 'all');
    } else {
      await this.storage.createEvent({
        calendarId: result.calendarId,
        title: result.title,
        startsAt: result.startsAt,
        endsAt: result.endsAt,
        allDay: result.allDay,
        description: result.description,
        location: result.location,
        rrule: result.rrule,
        linkedNoteId: result.linkedNoteId,
        reminders: result.reminders,
      });
    }
    this.showEventModal.set(false);
    await this.refreshWindow();
  }

  async onModalDelete(): Promise<void> {
    const editing = this.editingEvent();
    if (!editing) return;
    if (editing.rrule) {
      this.pendingScopeAction.set('delete');
      this.pendingScopeEvent.set(editing);
      this.showScopeModal.set(true);
      this.showEventModal.set(false);
      return;
    }
    if (confirm('¿Eliminar este evento?')) {
      await this.storage.deleteEvent(editing.id, 'all');
      this.showEventModal.set(false);
      await this.refreshWindow();
    }
  }

  onModalCancel(): void {
    this.showEventModal.set(false);
    this.editingEvent.set(null);
    this.modalPrefill.set(null);
  }

  async onScopeChosen(scope: 'this' | 'future' | 'all'): Promise<void> {
    const action = this.pendingScopeAction();
    const event = this.pendingScopeEvent();
    if (!event || !action) {
      this.showScopeModal.set(false);
      return;
    }
    if (action === 'edit') {
      const patch = this.pendingPatch();
      if (patch) await this.storage.updateEvent(event.id, this.toPatch(patch), scope);
    } else {
      await this.storage.deleteEvent(event.id, scope);
    }
    this.pendingScopeAction.set(null);
    this.pendingScopeEvent.set(null);
    this.pendingPatch.set(null);
    this.showScopeModal.set(false);
    await this.refreshWindow();
  }

  onScopeCancelled(): void {
    this.pendingScopeAction.set(null);
    this.pendingScopeEvent.set(null);
    this.pendingPatch.set(null);
    this.showScopeModal.set(false);
  }

  private toPatch(r: EventModalResult): { calendarId?: string; title?: string; startsAt?: string; endsAt?: string; allDay?: boolean; description?: string; location?: string; rrule?: string | null; linkedNoteId?: string | null } {
    return {
      calendarId: r.calendarId,
      title: r.title,
      startsAt: r.startsAt,
      endsAt: r.endsAt,
      allDay: r.allDay,
      description: r.description,
      location: r.location,
      rrule: r.rrule ?? null,
      linkedNoteId: r.linkedNoteId ?? null,
    };
  }

  // ===== sidebar =====

  onCalendarVisibilityChanged(id: string, visible: boolean): void {
    void this.storage.updateCalendar(id, { visible });
  }

  async onCalendarCreated(name: string): Promise<void> {
    if (!name.trim()) return;
    await this.storage.createCalendar(name);
  }

  async onCalendarDeleted(id: string): Promise<void> {
    if (confirm('¿Eliminar este calendario y todos sus eventos?')) {
      await this.storage.deleteCalendar(id);
    }
  }

  // ===== format helpers (template) =====

  formatHour(h: number): string {
    return `${h.toString().padStart(2, '0')}:00`;
  }

  formatTimeRange(event: CalendarInstance): string {
    if (event.allDay) return 'Todo el día';
    const s = parseISO(event.startsAt);
    const e = parseISO(event.endsAt);
    return `${format(s, 'HH:mm')} – ${format(e, 'HH:mm')}`;
  }

  formatDayHeader(day: Date): string {
    return format(day, "EEE d", { locale: es });
  }

  formatAgendaDay(day: Date): string {
    return format(day, "EEEE d 'de' MMMM", { locale: es });
  }

  isCurrentMonth(day: Date): boolean {
    return day.getMonth() === this.cursor().getMonth();
  }

  trackEvent = (_: number, e: CalendarInstance) => `${e.id}-${e.instanceStart}`;
  trackDay = (_: number, d: Date) => d.toISOString();
}
