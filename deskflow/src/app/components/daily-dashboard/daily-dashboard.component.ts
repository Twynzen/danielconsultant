import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { SmartViewItem, SmartViewsService } from '../../services/smart-views.service';
import { StorageService } from '../../services/storage.service';
import { CalendarStorageService, CalendarInstance } from '../../services/calendar-storage.service';

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
export class DailyDashboardComponent implements OnInit {
  private smart = inject(SmartViewsService);
  private storage = inject(StorageService);
  private calendarStorage = inject(CalendarStorageService);
  private router = inject(Router);

  /** Today's events expanded from RRULE — populated by ngOnInit. */
  readonly todayEvents = signal<CalendarInstance[]>([]);

  async ngOnInit(): Promise<void> {
    // Load calendars + today window then surface events.
    await this.calendarStorage.loadCalendars();
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    await this.calendarStorage.loadRange(start, end);
    this.todayEvents.set(this.calendarStorage.getTodayEvents());
  }

  formatEventTime(event: CalendarInstance): string {
    if (event.allDay) return 'Todo el día';
    const s = parseISO(event.startsAt);
    const e = parseISO(event.endsAt);
    return `${format(s, 'HH:mm', { locale: es })} – ${format(e, 'HH:mm', { locale: es })}`;
  }

  openEventInCalendar(event: CalendarInstance): void {
    this.router.navigate(['/calendar'], {
      queryParams: {
        view: 'day',
        date: format(parseISO(event.startsAt), 'yyyy-MM-dd'),
      },
    });
  }

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
