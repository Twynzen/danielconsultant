import { Component, Input, Output, EventEmitter, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { format, parseISO } from 'date-fns';
import { Calendar, ReminderChannel } from '../../models/calendar.model';
import { CalendarInstance } from '../../services/calendar-storage.service';
import { StorageService } from '../../services/storage.service';

export interface EventModalResult {
  calendarId: string;
  title: string;
  startsAt: string;        // ISO
  endsAt: string;          // ISO
  allDay: boolean;
  description?: string;
  location?: string;
  rrule?: string;
  linkedNoteId?: string;
  reminders?: Array<{ minutesBefore: number; channel: ReminderChannel }>;
}

interface ReminderRow {
  minutesBefore: number;
  channel: ReminderChannel;
}

const RRULE_PRESETS: Array<{ label: string; value: string }> = [
  { label: 'No se repite',         value: '' },
  { label: 'Diario',               value: 'FREQ=DAILY' },
  { label: 'Lunes a Viernes',      value: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR' },
  { label: 'Semanal',              value: 'FREQ=WEEKLY' },
  { label: 'Mensual',              value: 'FREQ=MONTHLY' },
  { label: 'Anual',                value: 'FREQ=YEARLY' },
];

const REMINDER_PRESETS = [
  { label: 'Al inicio',            minutes: 0 },
  { label: '5 minutos antes',      minutes: 5 },
  { label: '15 minutos antes',     minutes: 15 },
  { label: '30 minutos antes',     minutes: 30 },
  { label: '1 hora antes',         minutes: 60 },
  { label: '1 día antes',          minutes: 1440 },
];

@Component({
  selector: 'app-event-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './event-modal.component.html',
  styleUrl: './event-modal.component.scss',
})
export class EventModalComponent implements OnInit {
  @Input() calendars: Calendar[] = [];
  @Input() editing: CalendarInstance | null = null;
  @Input() prefill: { startsAt: string; endsAt: string } | null = null;

  @Output() save = new EventEmitter<EventModalResult>();
  @Output() deleteRequested = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  private notes = inject(StorageService);

  // Form fields (signals so the template binds reactively).
  title = signal('');
  description = signal('');
  location = signal('');
  calendarId = signal('');
  startDate = signal('');     // YYYY-MM-DD
  startTime = signal('');     // HH:mm
  endDate = signal('');
  endTime = signal('');
  allDay = signal(false);
  rrule = signal('');
  linkedNoteId = signal('');
  reminders = signal<ReminderRow[]>([]);

  rrulePresets = RRULE_PRESETS;
  reminderPresets = REMINDER_PRESETS;
  channels: ReminderChannel[] = ['whatsapp', 'toast', 'both'];

  ngOnInit(): void {
    const ed = this.editing;
    const pf = this.prefill;
    const defaultCal = this.calendars.find(c => c.isDefault) ?? this.calendars[0];
    this.calendarId.set(ed?.calendarId ?? defaultCal?.id ?? '');

    const start = parseISO(ed?.startsAt ?? pf?.startsAt ?? new Date().toISOString());
    const end = parseISO(ed?.endsAt ?? pf?.endsAt ?? new Date(start.getTime() + 60 * 60 * 1000).toISOString());

    this.title.set(ed?.title ?? '');
    this.description.set(ed?.description ?? '');
    this.location.set(ed?.location ?? '');
    this.startDate.set(format(start, 'yyyy-MM-dd'));
    this.startTime.set(format(start, 'HH:mm'));
    this.endDate.set(format(end, 'yyyy-MM-dd'));
    this.endTime.set(format(end, 'HH:mm'));
    this.allDay.set(ed?.allDay ?? false);
    this.rrule.set(ed?.rrule ?? '');
    this.linkedNoteId.set(ed?.linkedNoteId ?? '');
    // Reminders are loaded separately via API (Phase 5) — leave empty for edits for now.
    this.reminders.set([]);
  }

  // ===== template helpers =====

  notesList(): Array<{ id: string; title: string; desktopName: string }> {
    return this.notes.getAllNotes().map(({ note, desktop }) => ({
      id: note.id,
      title: note.title || '(sin título)',
      desktopName: desktop.name,
    }));
  }

  toggleAllDay(): void {
    this.allDay.update(v => !v);
  }

  selectRrulePreset(value: string): void {
    this.rrule.set(value);
  }

  addReminder(minutes: number): void {
    if (this.reminders().some(r => r.minutesBefore === minutes)) return;
    this.reminders.update(list => [...list, { minutesBefore: minutes, channel: 'whatsapp' }]);
  }

  removeReminder(idx: number): void {
    this.reminders.update(list => list.filter((_, i) => i !== idx));
  }

  setReminderChannel(idx: number, channel: ReminderChannel): void {
    this.reminders.update(list =>
      list.map((r, i) => (i === idx ? { ...r, channel } : r))
    );
  }

  reminderLabel(minutes: number): string {
    const preset = REMINDER_PRESETS.find(p => p.minutes === minutes);
    if (preset) return preset.label;
    if (minutes >= 1440) return `${Math.floor(minutes / 1440)}d antes`;
    if (minutes >= 60) return `${Math.floor(minutes / 60)}h antes`;
    return `${minutes}min antes`;
  }

  // ===== actions =====

  onSave(): void {
    const title = this.title().trim();
    if (!title) {
      alert('El título es requerido');
      return;
    }
    if (!this.calendarId()) {
      alert('Selecciona un calendario');
      return;
    }

    const startsAt = this.composeIso(this.startDate(), this.startTime(), this.allDay());
    const endsAt = this.composeIso(this.endDate(), this.endTime(), this.allDay());

    if (new Date(endsAt).getTime() < new Date(startsAt).getTime()) {
      alert('La hora de fin debe ser posterior a la de inicio');
      return;
    }

    this.save.emit({
      calendarId: this.calendarId(),
      title,
      startsAt,
      endsAt,
      allDay: this.allDay(),
      description: this.description() || undefined,
      location: this.location() || undefined,
      rrule: this.rrule() || undefined,
      linkedNoteId: this.linkedNoteId() || undefined,
      reminders: this.reminders().length ? this.reminders() : undefined,
    });
  }

  onDelete(): void {
    this.deleteRequested.emit();
  }

  onCancel(): void {
    this.cancel.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('event-modal-backdrop')) {
      this.cancel.emit();
    }
  }

  private composeIso(date: string, time: string, allDay: boolean): string {
    const [y, m, d] = date.split('-').map(Number);
    if (allDay) {
      return new Date(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0).toISOString();
    }
    const [hh, mm] = (time || '00:00').split(':').map(Number);
    return new Date(y, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0, 0, 0).toISOString();
  }
}
