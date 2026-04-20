import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-recurrence-scope-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="rec-modal-backdrop" (click)="onBackdrop($event)">
      <div class="rec-modal cyber-panel">
        <h3 class="font-display">{{ action === 'delete' ? 'ELIMINAR EVENTO RECURRENTE' : 'EDITAR EVENTO RECURRENTE' }}</h3>
        <p>Este evento es parte de una serie. ¿A qué quieres aplicar el cambio?</p>
        <div class="scope-options">
          <button (click)="chosen.emit('this')">Solo este evento</button>
          <button (click)="chosen.emit('future')">Esta y las siguientes</button>
          <button (click)="chosen.emit('all')">Toda la serie</button>
        </div>
        <button class="cancel" (click)="cancelled.emit()">Cancelar</button>
      </div>
    </div>
  `,
  styles: [`
    .rec-modal-backdrop {
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.75);
      backdrop-filter: blur(4px);
      display: flex; align-items: center; justify-content: center;
      z-index: 10000;
      padding: 20px;
    }
    .rec-modal {
      background: #050807;
      border: 1px solid rgba(0,255,65,0.4);
      border-radius: 6px;
      padding: 20px 24px;
      width: 100%; max-width: 420px;
      box-shadow: 0 0 40px rgba(0,255,65,0.25);
      font-family: 'Source Code Pro', 'Courier New', monospace;
      color: #d6f5dc;
      h3 {
        margin: 0 0 8px;
        font-size: 13px;
        letter-spacing: 2px;
        color: #00ff41;
      }
      p { margin: 0 0 16px; font-size: 12px; color: #8db4a0; }
    }
    .scope-options {
      display: flex; flex-direction: column; gap: 8px; margin-bottom: 14px;
      button {
        padding: 10px 14px;
        background: transparent;
        border: 1px solid rgba(0,255,65,0.25);
        border-radius: 3px;
        color: #d6f5dc;
        font-family: inherit; font-size: 12px;
        text-align: left;
        cursor: pointer;
        transition: all 0.15s ease;
        &:hover {
          background: rgba(0,255,65,0.1);
          border-color: #00ff41;
          color: #00ff41;
        }
      }
    }
    .cancel {
      width: 100%;
      padding: 8px;
      background: transparent;
      border: 1px solid rgba(255,80,80,0.4);
      color: #ff5050;
      border-radius: 3px;
      cursor: pointer;
      font-family: inherit;
      &:hover { background: rgba(255,80,80,0.15); }
    }
  `],
})
export class RecurrenceScopeModalComponent {
  @Input() action: 'edit' | 'delete' | null = null;
  @Output() chosen = new EventEmitter<'this' | 'future' | 'all'>();
  @Output() cancelled = new EventEmitter<void>();

  onBackdrop(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('rec-modal-backdrop')) {
      this.cancelled.emit();
    }
  }
}
