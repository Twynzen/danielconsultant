import { Component, computed, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { SmartViewItem, SmartViewsService } from '../../services/smart-views.service';
import { StorageService } from '../../services/storage.service';

interface ProjectSummary {
  total: number;
  active: number;
  blocked: number;
  inactive: number;
  completed: number;
  archived: number;
  none: number;
}

@Component({
  selector: 'app-daily-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, DatePipe],
  templateUrl: './daily-dashboard.component.html',
  styleUrl: './daily-dashboard.component.scss',
})
export class DailyDashboardComponent {
  private smart = inject(SmartViewsService);
  private storage = inject(StorageService);
  private router = inject(Router);

  /** Top items the user should look at today, ordered by score. */
  readonly priorities = computed<SmartViewItem[]>(() => {
    return [...this.smart.allItems()]
      .filter(i => i.score >= 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 12);
  });

  /** Items flagged as blocked — surfaced separately because they need action. */
  readonly blocked = computed<SmartViewItem[]>(() =>
    this.smart.allItems().filter(i => i.metadata.status === 'blocked')
  );

  /** Active projects, sorted by recent activity. */
  readonly activeProjects = computed<SmartViewItem[]>(() =>
    this.smart.allItems()
      .filter(i => i.metadata.type === 'project' && i.metadata.status === 'active')
      .sort((a, b) => b.note.updatedAt.getTime() - a.note.updatedAt.getTime())
  );

  readonly projectSummary = computed<ProjectSummary>(() => {
    const summary: ProjectSummary = {
      total: 0, active: 0, blocked: 0, inactive: 0,
      completed: 0, archived: 0, none: 0,
    };
    for (const item of this.smart.allItems()) {
      if (item.metadata.type !== 'project') continue;
      summary.total++;
      const key = (item.metadata.status ?? 'none') as keyof ProjectSummary;
      summary[key] = (summary[key] ?? 0) + 1;
    }
    return summary;
  });

  readonly today = new Date();

  open(item: SmartViewItem): void {
    this.storage.navigateToDesktop(item.desktop.id);
    this.storage.bringNoteToFront(item.note.id);
    this.router.navigate(['/']);
  }
}
