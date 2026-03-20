import { Injectable, signal } from '@angular/core';

export interface WindowState {
  id: string;
  desktopId: string;
  title: string;
  appType: 'paint' | 'notepad' | 'calculator' | 'file-explorer';
  x: number;
  y: number;
  width: number;
  height: number;
  minimized: boolean;
  maximized: boolean;
  focused: boolean;
  zIndex: number;
}

@Injectable({ providedIn: 'root' })
export class WindowManagerService {
  private _windows = signal<WindowState[]>([]);
  private _zCounter = 100;

  readonly windows = this._windows.asReadonly();

  getDesktopWindows(desktopId: string): WindowState[] {
    return this._windows().filter(w => w.desktopId === desktopId);
  }

  openWindow(desktopId: string, appType: WindowState['appType'], title: string): void {
    const existing = this._windows().find(
      w => w.desktopId === desktopId && w.appType === appType
    );
    if (existing) {
      this.focusWindow(existing.id);
      if (existing.minimized) {
        this._windows.update(ws =>
          ws.map(w => w.id === existing.id ? { ...w, minimized: false } : w)
        );
      }
      return;
    }

    const offset = (this._windows().filter(w => w.desktopId === desktopId).length) * 24;
    const newWin: WindowState = {
      id: `win-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      desktopId,
      title,
      appType,
      x: 60 + offset,
      y: 50 + offset,
      width: appType === 'calculator' ? 320 : 640,
      height: appType === 'calculator' ? 480 : 420,
      minimized: false,
      maximized: false,
      focused: true,
      zIndex: ++this._zCounter
    };

    this._windows.update(ws => [
      ...ws.map(w => w.desktopId === desktopId ? { ...w, focused: false } : w),
      newWin
    ]);
  }

  focusWindow(id: string): void {
    const win = this._windows().find(w => w.id === id);
    if (!win) return;
    this._windows.update(ws =>
      ws.map(w => ({
        ...w,
        focused: w.id === id,
        zIndex: w.id === id ? ++this._zCounter : w.zIndex
      }))
    );
  }

  minimizeWindow(id: string): void {
    this._windows.update(ws =>
      ws.map(w => w.id === id ? { ...w, minimized: true, focused: false } : w)
    );
  }

  toggleMaximize(id: string): void {
    this._windows.update(ws =>
      ws.map(w => w.id === id ? { ...w, maximized: !w.maximized } : w)
    );
  }

  closeWindow(id: string): void {
    this._windows.update(ws => ws.filter(w => w.id !== id));
  }

  moveWindow(id: string, x: number, y: number): void {
    this._windows.update(ws =>
      ws.map(w => w.id === id ? { ...w, x, y } : w)
    );
  }

  resizeWindow(id: string, width: number, height: number): void {
    this._windows.update(ws =>
      ws.map(w => w.id === id ? { ...w, width, height } : w)
    );
  }

  closeAllForDesktop(desktopId: string): void {
    this._windows.update(ws => ws.filter(w => w.desktopId !== desktopId));
  }
}
