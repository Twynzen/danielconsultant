import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import {
  SmartViewFilters,
  SmartViewItem,
  SmartViewsService,
} from '../../services/smart-views.service';
import { StorageService } from '../../services/storage.service';
import { NoteStatus, NoteType } from '../../models/desktop.model';

type ViewMode = 'table' | 'kanban' | 'timeline';

@Component({
  selector: 'app-smart-views',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, DatePipe],
  templateUrl: './smart-views.component.html',
  styleUrl: './smart-views.component.scss',
})
export class SmartViewsComponent {
  private smart = inject(SmartViewsService);
  private storage = inject(StorageService);
  private router = inject(Router);

  readonly view = signal<ViewMode>('table');

  readonly filterType = signal<NoteType | ''>('');
  readonly filterStatus = signal<NoteStatus | ''>('');
  readonly filterTag = signal<string>('');
  readonly filterSearch = signal<string>('');

  readonly tags = this.smart.allTags;

  readonly filters = computed<SmartViewFilters>(() => ({
    type: (this.filterType() || undefined) as NoteType | undefined,
    status: (this.filterStatus() || undefined) as NoteStatus | undefined,
    tag: this.filterTag() || undefined,
    search: this.filterSearch() || undefined,
  }));

  readonly tableItems = computed<SmartViewItem[]>(() => {
    const items = [...this.smart.allItems()].sort((a, b) => b.score - a.score);
    return this.smart.filter(items, this.filters());
  });

  readonly kanbanColumns = computed(() => {
    const filters = this.filters();
    return this.smart.kanban().map(col => ({
      ...col,
      items: this.smart.filter(col.items, filters),
    }));
  });

  readonly timelineItems = computed<SmartViewItem[]>(() => {
    return this.smart.filter(this.smart.timeline(), this.filters());
  });

  setView(mode: ViewMode): void {
    this.view.set(mode);
  }

  /** Jump to the desktop that contains a given note. */
  openNote(item: SmartViewItem): void {
    this.storage.navigateToDesktop(item.desktop.id);
    this.storage.bringNoteToFront(item.note.id);
    this.router.navigate(['/']);
  }

  resetFilters(): void {
    this.filterType.set('');
    this.filterStatus.set('');
    this.filterTag.set('');
    this.filterSearch.set('');
  }
}
