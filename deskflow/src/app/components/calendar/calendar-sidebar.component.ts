import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Calendar } from '../../models/calendar.model';

@Component({
  selector: 'app-calendar-sidebar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <aside class="cal-sidebar cyber-panel">
      <div class="sidebar-header">
        <h3 class="font-display">CALENDARIOS</h3>
        <button class="add-btn" (click)="showCreate.set(!showCreate())" title="Nuevo calendario">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>
      </div>

      <div *ngIf="showCreate()" class="create-row">
        <input type="text"
               placeholder="Nombre"
               [(ngModel)]="newName"
               (keydown.enter)="onCreate()" />
        <button (click)="onCreate()">OK</button>
      </div>

      <ul class="cal-list">
        <li *ngFor="let cal of calendars" class="cal-item">
          <label>
            <input type="checkbox"
                   [checked]="cal.visible"
                   (change)="visibilityChanged.emit({ id: cal.id, visible: !cal.visible })" />
            <span class="color-dot" [style.background]="cal.color"></span>
            <span class="cal-name">{{ cal.name }}</span>
            <span class="cal-default" *ngIf="cal.isDefault">★</span>
          </label>
          <button class="delete-btn"
                  *ngIf="!cal.isDefault"
                  (click)="calendarDeleted.emit(cal.id)"
                  title="Eliminar">×</button>
        </li>
      </ul>
    </aside>
  `,
  styles: [`
    .cal-sidebar {
      width: 240px;
      flex-shrink: 0;
      padding: 16px 12px;
      border-right: 1px solid rgba(0,255,65,0.25);
      overflow-y: auto;
      background: #050807;
      font-family: 'Source Code Pro', 'Courier New', monospace;
      color: #d6f5dc;

      @media (max-width: 768px) {
        display: none;
      }
    }
    .sidebar-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 14px;
      h3 {
        margin: 0;
        font-size: 11px;
        letter-spacing: 2px;
        color: #00ff41;
      }
      .add-btn {
        width: 26px; height: 26px;
        background: transparent;
        border: 1px solid rgba(0,255,65,0.25);
        border-radius: 3px;
        color: #00ff41;
        cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        svg { width: 14px; height: 14px; }
        &:hover { background: rgba(0,255,65,0.1); }
      }
    }
    .create-row {
      display: flex;
      gap: 6px;
      margin-bottom: 10px;
      input {
        flex: 1;
        background: rgba(0,0,0,0.5);
        border: 1px solid rgba(0,255,65,0.25);
        border-radius: 3px;
        padding: 6px 8px;
        color: #d6f5dc;
        font-family: inherit;
        font-size: 12px;
      }
      button {
        padding: 4px 10px;
        background: rgba(0,255,65,0.15);
        border: 1px solid #00ff41;
        color: #00ff41;
        border-radius: 3px;
        cursor: pointer;
      }
    }
    .cal-list {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .cal-item {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 6px 4px;
      border-radius: 3px;
      &:hover { background: rgba(0,255,65,0.05); }

      label {
        flex: 1;
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
        font-size: 12px;
      }
      .color-dot {
        width: 10px; height: 10px;
        border-radius: 50%;
        box-shadow: 0 0 4px currentColor;
      }
      .cal-name { flex: 1; }
      .cal-default { color: #ffd700; font-size: 11px; }
      input[type="checkbox"] { accent-color: #00ff41; }

      .delete-btn {
        width: 20px; height: 20px;
        background: transparent;
        border: none;
        color: #5a8c70;
        cursor: pointer;
        font-size: 14px;
        opacity: 0;
        transition: opacity 0.15s ease;
        &:hover { color: #ff5050; }
      }
      &:hover .delete-btn { opacity: 1; }
    }
  `],
})
export class CalendarSidebarComponent {
  @Input() calendars: Calendar[] = [];
  @Output() visibilityChanged = new EventEmitter<{ id: string; visible: boolean }>();
  @Output() calendarCreated = new EventEmitter<string>();
  @Output() calendarDeleted = new EventEmitter<string>();

  showCreate = signal(false);
  newName = '';

  onCreate(): void {
    if (!this.newName.trim()) return;
    this.calendarCreated.emit(this.newName.trim());
    this.newName = '';
    this.showCreate.set(false);
  }
}
