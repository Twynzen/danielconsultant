import { Injectable, computed, inject } from '@angular/core';
import { StorageService } from './storage.service';
import { Desktop, Note, NoteMetadata, NoteStatus, NoteType } from '../models/desktop.model';

export interface SmartViewItem {
  note: Note;
  desktop: Desktop;
  metadata: NoteMetadata;
  score: number;
  reasons: string[];
}

export interface KanbanColumn {
  status: NoteStatus | 'none';
  label: string;
  items: SmartViewItem[];
}

export interface SmartViewFilters {
  type?: NoteType;
  status?: NoteStatus;
  tag?: string;
  search?: string;
  minPriority?: number;
  maxPriority?: number;
}

const STATUS_ORDER: Array<NoteStatus | 'none'> = [
  'blocked', 'active', 'inactive', 'none', 'completed', 'archived'
];

const STATUS_LABELS: Record<NoteStatus | 'none', string> = {
  blocked: 'Bloqueado',
  active: 'Activo',
  inactive: 'Inactivo',
  none: 'Sin estado',
  completed: 'Completado',
  archived: 'Archivado'
};

/**
 * Cross-desktop projections of the workspace.
 *
 * A SmartView is just a reactive `computed` derived from StorageService —
 * the source of truth never changes, only the way it's displayed.
 */
@Injectable({ providedIn: 'root' })
export class SmartViewsService {
  private storage = inject(StorageService);

  /** Flat, metadata-aware projection of every note in every desktop. */
  readonly allItems = computed<SmartViewItem[]>(() => {
    const now = new Date();
    return this.storage.getAllNotes().map(({ note, desktop }) => {
      const metadata = note.metadata ?? {};
      const { score, reasons } = this.scoreNote(note, metadata, now);
      return { note, desktop, metadata, score, reasons };
    });
  });

  /** Kanban grouping by status, ordered by intelligence score. */
  readonly kanban = computed<KanbanColumn[]>(() => {
    const buckets = new Map<NoteStatus | 'none', SmartViewItem[]>();
    for (const status of STATUS_ORDER) buckets.set(status, []);

    for (const item of this.allItems()) {
      const status = (item.metadata.status ?? 'none') as NoteStatus | 'none';
      const bucket = buckets.get(status) ?? buckets.get('none')!;
      bucket.push(item);
    }

    for (const items of buckets.values()) {
      items.sort((a, b) => b.score - a.score);
    }

    return STATUS_ORDER.map(status => ({
      status,
      label: STATUS_LABELS[status],
      items: buckets.get(status) ?? []
    }));
  });

  /** Items with `dueDate` set, sorted ascending. Used by the Timeline view. */
  readonly timeline = computed<SmartViewItem[]>(() => {
    return this.allItems()
      .filter(it => Boolean(it.metadata.dueDate))
      .sort((a, b) => {
        const aDate = new Date(a.metadata.dueDate!).getTime();
        const bDate = new Date(b.metadata.dueDate!).getTime();
        return aDate - bDate;
      });
  });

  /**
   * Apply user filters on top of the flat projection.
   * Filters compose with AND. Search is a case-insensitive substring match
   * against title and content.
   */
  filter(items: SmartViewItem[], filters: SmartViewFilters): SmartViewItem[] {
    const search = filters.search?.trim().toLowerCase() ?? '';
    return items.filter(item => {
      const m = item.metadata;
      if (filters.type && m.type !== filters.type) return false;
      if (filters.status && m.status !== filters.status) return false;
      if (filters.tag && !(m.tags ?? []).includes(filters.tag)) return false;
      if (filters.minPriority !== undefined && (m.priority ?? 99) > filters.minPriority) {
        // priority is inverted (1 = urgent), so >= minPriority means more important.
        // We treat minPriority as "show items at least this urgent".
        if ((m.priority ?? 99) > filters.minPriority) return false;
      }
      if (filters.maxPriority !== undefined && (m.priority ?? -1) < filters.maxPriority) {
        return false;
      }
      if (search) {
        const hay = `${item.note.title} ${item.note.content}`.toLowerCase();
        if (!hay.includes(search)) return false;
      }
      return true;
    });
  }

  /** Distinct tags across the workspace, alphabetically sorted. */
  readonly allTags = computed<string[]>(() => {
    const set = new Set<string>();
    for (const item of this.allItems()) {
      for (const tag of item.metadata.tags ?? []) set.add(tag);
    }
    return Array.from(set).sort();
  });

  /**
   * Mirror of intelligence.py:_score_note kept simple. This is purely for the
   * client-side ranking in Smart Views; the authoritative scoring lives on
   * the Python engine (so external agents see consistent numbers).
   */
  private scoreNote(
    note: Note,
    metadata: NoteMetadata,
    now: Date
  ): { score: number; reasons: string[] } {
    const reasons: string[] = [];
    let score = 0;

    if (metadata.status === 'archived' || metadata.status === 'completed') {
      return { score: -1, reasons: [metadata.status] };
    }
    if (metadata.status === 'blocked') {
      score += 5;
      reasons.push('blocked');
    }
    if (metadata.status === 'active') score += 2;

    if (metadata.priority && metadata.priority >= 1 && metadata.priority <= 5) {
      score += (6 - metadata.priority) * 1.5;
      if (metadata.priority <= 2) reasons.push(`priority ${metadata.priority}`);
    }

    if (metadata.dueDate) {
      const due = new Date(metadata.dueDate).getTime();
      const deltaH = (due - now.getTime()) / 3_600_000;
      if (deltaH < 0) { score += 8; reasons.push('overdue'); }
      else if (deltaH <= 24) { score += 6; reasons.push('due today'); }
      else if (deltaH <= 72) { score += 4; reasons.push('due soon'); }
      else if (deltaH <= 168) { score += 2; }
    }

    if (metadata.type === 'meeting' || metadata.type === 'task') score += 1.5;
    else if (metadata.type === 'project') score += 1;
    else if (metadata.type === 'reference' || metadata.type === 'log') score -= 0.5;

    const ageH = (now.getTime() - note.updatedAt.getTime()) / 3_600_000;
    if (ageH <= 48) score += 1;

    return { score, reasons };
  }
}
