import { Injectable, signal } from '@angular/core';

export type ToastIcon = 'calendar' | 'info' | 'warning' | 'error';

export interface Toast {
  id: string;
  icon: ToastIcon;
  title: string;
  body?: string;
  /** Optional action button label. Click handler is provided alongside. */
  action?: string;
  onAction?: () => void;
  /** Auto-dismiss after N ms. 0/undefined = sticky until manually closed. */
  duration?: number;
}

/**
 * Tiny signals-based toast queue, mounted once at the app root via
 * ToastHostComponent. Anything in the app can `inject(ToastService)` and
 * call `push(...)` — the host re-renders automatically.
 *
 * Used for calendar reminders received via Supabase realtime so they
 * surface to the user even when the calendar route isn't open.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private _toasts = signal<Toast[]>([]);
  readonly toasts = this._toasts.asReadonly();

  push(toast: Omit<Toast, 'id'>): string {
    const id = `t-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const full: Toast = { id, ...toast };
    this._toasts.update(list => [...list, full]);
    if (toast.duration && toast.duration > 0) {
      setTimeout(() => this.dismiss(id), toast.duration);
    }
    return id;
  }

  dismiss(id: string): void {
    this._toasts.update(list => list.filter(t => t.id !== id));
  }

  clear(): void {
    this._toasts.set([]);
  }
}
