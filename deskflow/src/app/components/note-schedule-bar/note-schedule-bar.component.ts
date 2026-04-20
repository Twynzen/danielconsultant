import { Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Note } from '../../models/desktop.model';

/**
 * Inline time-block strip shown inside every note. Collapsed state is a
 * small "📅 Hoy" pill; clicking it expands to two `<input type="time">`
 * pickers plus a visual duration bar representing the proportion of the
 * day the block occupies.
 *
 * The component is deliberately dumb — it computes the patch and emits it
 * upstream. Persistence stays in the parent (`note.component`) so the
 * existing `noteChange → desktop.component → storage` pipeline keeps
 * working without special cases.
 */
@Component({
  selector: 'app-note-schedule-bar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './note-schedule-bar.component.html',
  styleUrl: './note-schedule-bar.component.scss',
})
export class NoteScheduleBarComponent {
  @Input({ required: true }) note!: Note;
  @Output() scheduleChange = new EventEmitter<{
    scheduledStart?: string;
    scheduledEnd?: string;
  }>();

  // Collapsed shows just the toggle pill. Expanded shows the inputs.
  expanded = signal(false);

  // Whether this note currently has a schedule saved.
  readonly hasSchedule = computed(() => {
    const m = this.note.metadata;
    return !!(m?.scheduledStart && m?.scheduledEnd);
  });

  // Reads from metadata and converts to HH:mm for the time inputs. If the
  // note has no schedule yet we default to today 09:00–10:00 so the first
  // interaction lands somewhere sensible.
  readonly startValue = computed(() => this.hhmm(this.note.metadata?.scheduledStart, 9, 0));
  readonly endValue = computed(() => this.hhmm(this.note.metadata?.scheduledEnd, 10, 0));

  // The date portion (YYYY-MM-DD) used as the anchor when composing ISO.
  // Today by default; if the note already had a schedule we preserve its day.
  readonly dayValue = computed(() => {
    const iso = this.note.metadata?.scheduledStart;
    if (iso) {
      const d = new Date(iso);
      if (!isNaN(d.getTime())) return this.yyyymmdd(d);
    }
    return this.yyyymmdd(new Date());
  });

  // Visual bar width (% of 24h). Purely decorative.
  readonly fillPercent = computed(() => {
    const m = this.note.metadata;
    if (!m?.scheduledStart || !m?.scheduledEnd) return 0;
    const start = new Date(m.scheduledStart);
    const end = new Date(m.scheduledEnd);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
    const mins = Math.max(0, (end.getTime() - start.getTime()) / 60_000);
    return Math.min(100, (mins / (24 * 60)) * 100);
  });

  // Starting offset (% of 24h) for the bar position.
  readonly fillOffset = computed(() => {
    const m = this.note.metadata;
    if (!m?.scheduledStart) return 0;
    const start = new Date(m.scheduledStart);
    if (isNaN(start.getTime())) return 0;
    const mins = start.getHours() * 60 + start.getMinutes();
    return (mins / (24 * 60)) * 100;
  });

  // Compact label: "10:00 → 11:30".
  readonly compactLabel = computed(() => {
    const m = this.note.metadata;
    if (!m?.scheduledStart || !m?.scheduledEnd) return '';
    return `${this.hhmm(m.scheduledStart)} → ${this.hhmm(m.scheduledEnd)}`;
  });

  // ===== Handlers =====

  toggleExpanded(event?: MouseEvent): void {
    event?.stopPropagation();
    this.expanded.update(v => !v);
  }

  /**
   * Called when the user picks a new start time. We keep the existing date
   * (or today's date) and rebuild the ISO string.
   */
  onStartChange(hhmm: string): void {
    if (!hhmm) return;
    this.scheduleChange.emit({
      scheduledStart: this.composeIso(this.dayValue(), hhmm),
    });
  }

  onEndChange(hhmm: string): void {
    if (!hhmm) return;
    this.scheduleChange.emit({
      scheduledEnd: this.composeIso(this.dayValue(), hhmm),
    });
  }

  /**
   * First-time tap on the pill. Sets a default 09:00–10:00 today block so
   * the user sees immediate feedback, and opens the picker for edits.
   */
  initializeToday(event: MouseEvent): void {
    event.stopPropagation();
    const today = this.yyyymmdd(new Date());
    this.scheduleChange.emit({
      scheduledStart: this.composeIso(today, '09:00'),
      scheduledEnd: this.composeIso(today, '10:00'),
    });
    this.expanded.set(true);
  }

  /**
   * Clears the schedule — note goes back to being a plain note, disappears
   * from the calendar view.
   */
  clearSchedule(event: MouseEvent): void {
    event.stopPropagation();
    this.scheduleChange.emit({
      scheduledStart: undefined,
      scheduledEnd: undefined,
    });
    this.expanded.set(false);
  }

  // ===== Helpers =====

  private yyyymmdd(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  private hhmm(iso: string | undefined, fallbackH = 0, fallbackM = 0): string {
    if (!iso) {
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${pad(fallbackH)}:${pad(fallbackM)}`;
    }
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  private composeIso(day: string, hhmm: string): string {
    const [y, m, d] = day.split('-').map(Number);
    const [hh, mm] = hhmm.split(':').map(Number);
    const local = new Date(y, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0, 0, 0);
    return local.toISOString();
  }
}
