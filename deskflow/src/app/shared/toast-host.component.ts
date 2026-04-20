import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from './toast.service';

@Component({
  selector: 'app-toast-host',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast-host">
      @for (t of toasts.toasts(); track t.id) {
        <div class="toast" [attr.data-icon]="t.icon">
          <div class="toast-icon">
            @switch (t.icon) {
              @case ('calendar') {
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="4" width="18" height="18" rx="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
              }
              @case ('warning') {
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              }
              @case ('error') {
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="15" y1="9" x2="9" y2="15"/>
                  <line x1="9" y1="9" x2="15" y2="15"/>
                </svg>
              }
              @default {
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="16" x2="12" y2="12"/>
                  <line x1="12" y1="8" x2="12.01" y2="8"/>
                </svg>
              }
            }
          </div>
          <div class="toast-body">
            <div class="toast-title">{{ t.title }}</div>
            @if (t.body) { <div class="toast-text">{{ t.body }}</div> }
          </div>
          @if (t.action && t.onAction) {
            <button class="toast-action" (click)="onAction(t.id, t.onAction!)">
              {{ t.action }}
            </button>
          }
          <button class="toast-close" (click)="toasts.dismiss(t.id)" title="Cerrar">×</button>
        </div>
      }
    </div>
  `,
  styles: [`
    .toast-host {
      position: fixed;
      bottom: 16px;
      right: 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      z-index: 99999;
      pointer-events: none;
      max-width: 380px;
    }
    .toast {
      pointer-events: auto;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 14px;
      background: #050807;
      border: 1px solid #00ff41;
      border-radius: 6px;
      color: #d6f5dc;
      font-family: 'Source Code Pro', 'Courier New', monospace;
      font-size: 12px;
      box-shadow: 0 6px 30px rgba(0, 255, 65, 0.25),
                  0 0 0 1px rgba(0, 255, 65, 0.2);
      animation: toast-in 0.25s ease-out;

      &[data-icon="warning"] {
        border-color: #ffb347;
        box-shadow: 0 6px 30px rgba(255, 179, 71, 0.25);
        .toast-icon { color: #ffb347; }
      }
      &[data-icon="error"] {
        border-color: #ff5050;
        box-shadow: 0 6px 30px rgba(255, 80, 80, 0.25);
        .toast-icon { color: #ff5050; }
      }
    }
    .toast-icon {
      flex-shrink: 0;
      color: #00ff41;
      svg { width: 22px; height: 22px; }
    }
    .toast-body {
      flex: 1;
      min-width: 0;
      .toast-title {
        font-weight: 600;
        color: #00ff41;
        margin-bottom: 2px;
      }
      .toast-text {
        color: #8db4a0;
        font-size: 11px;
      }
    }
    .toast-action {
      flex-shrink: 0;
      padding: 6px 10px;
      background: rgba(0, 255, 65, 0.15);
      border: 1px solid #00ff41;
      border-radius: 3px;
      color: #00ff41;
      cursor: pointer;
      font-family: inherit;
      font-size: 11px;
      &:hover {
        background: rgba(0, 255, 65, 0.28);
      }
    }
    .toast-close {
      background: transparent;
      border: none;
      color: #5a8c70;
      cursor: pointer;
      font-size: 18px;
      line-height: 1;
      padding: 0 4px;
      &:hover { color: #d6f5dc; }
    }
    @keyframes toast-in {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
  `],
})
export class ToastHostComponent {
  toasts = inject(ToastService);

  onAction(id: string, handler: () => void): void {
    handler();
    this.toasts.dismiss(id);
  }
}
