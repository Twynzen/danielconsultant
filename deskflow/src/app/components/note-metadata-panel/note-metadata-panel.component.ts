import { Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  Note,
  NoteMetadata,
  NotePriority,
  NoteStatus,
  NoteType,
} from '../../models/desktop.model';

const TYPES: NoteType[] = [
  'note', 'task', 'project', 'reference',
  'contact', 'meeting', 'idea', 'log',
];

const STATUSES: NoteStatus[] = [
  'active', 'inactive', 'completed', 'archived', 'blocked',
];

@Component({
  selector: 'app-note-metadata-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './note-metadata-panel.component.html',
  styleUrl: './note-metadata-panel.component.scss',
})
export class NoteMetadataPanelComponent {
  @Input({ required: true }) note!: Note;
  @Output() close = new EventEmitter<void>();
  @Output() metadataChange = new EventEmitter<Partial<NoteMetadata>>();

  readonly types = TYPES;
  readonly statuses = STATUSES;
  readonly priorities: NotePriority[] = [1, 2, 3, 4, 5];

  readonly tagsDraft = signal<string>('');

  readonly metadata = computed<NoteMetadata>(() => this.note.metadata ?? {});
  readonly tags = computed<string[]>(() => this.metadata().tags ?? []);

  /**
   * `dueDate` is ISO in storage but `<input type=datetime-local>` expects
   * `YYYY-MM-DDTHH:mm`. Do the conversion once here.
   */
  readonly dueDateLocal = computed<string>(() => {
    const iso = this.metadata().dueDate;
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
      + `T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });

  setType(value: string): void {
    this.metadataChange.emit({ type: (value || undefined) as NoteType | undefined });
  }

  setStatus(value: string): void {
    this.metadataChange.emit({ status: (value || undefined) as NoteStatus | undefined });
  }

  setPriority(value: string): void {
    const n = value === '' ? undefined : (parseInt(value, 10) as NotePriority);
    this.metadataChange.emit({ priority: n });
  }

  setDueDate(value: string): void {
    // Empty input clears the due date.
    if (!value) {
      this.metadataChange.emit({ dueDate: undefined });
      return;
    }
    // `datetime-local` has no timezone — interpret it in the user's local tz
    // and persist as ISO-UTC so the intelligence engine sees something
    // unambiguous.
    const local = new Date(value);
    if (isNaN(local.getTime())) return;
    this.metadataChange.emit({ dueDate: local.toISOString() });
  }

  setProgress(value: string): void {
    if (value === '') {
      this.metadataChange.emit({ progress: undefined });
      return;
    }
    const n = parseFloat(value);
    if (!isNaN(n) && n >= 0 && n <= 100) {
      this.metadataChange.emit({ progress: n });
    }
  }

  addTagFromDraft(): void {
    const raw = this.tagsDraft().trim();
    if (!raw) return;
    // Accept comma- or space-separated tags in one go.
    const existing = new Set(this.tags());
    for (const candidate of raw.split(/[\s,]+/)) {
      const tag = candidate.trim();
      if (tag) existing.add(tag);
    }
    this.metadataChange.emit({ tags: Array.from(existing) });
    this.tagsDraft.set('');
  }

  removeTag(tag: string): void {
    const next = this.tags().filter(t => t !== tag);
    this.metadataChange.emit({ tags: next.length ? next : [] });
  }

  markReviewed(): void {
    this.metadataChange.emit({ lastReviewedAt: new Date().toISOString() });
  }

  clearAll(): void {
    this.metadataChange.emit({
      type: undefined,
      status: undefined,
      priority: undefined,
      dueDate: undefined,
      tags: [],
      progress: undefined,
      lastReviewedAt: undefined,
    });
  }
}
