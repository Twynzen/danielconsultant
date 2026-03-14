import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface WindowState {
  id: string;
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
  desktopId: string;
}

@Injectable({ providedIn: 'root' })
export class WindowManagerService {
  private windows: WindowState[] = [];
  private windows$ = new BehaviorSubject<WindowState[]>([]);
  private nextZ = 100;

  getWindows() {
    return this.windows$.asObservable();
  }

  openWindow(appType: WindowState['appType'], title: string, desktopId: string): WindowState {
    const offset = (this.windows.filter(w => w.desktopId === desktopId).length % 5) * 30;
    const win: WindowState = {
      id: `win-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title,
      appType,
      x: 100 + offset,
      y: 60 + offset,
      width: appType === 'calculator' ? 320 : 700,
      height: appType === 'calculator' ? 500 : 480,
      minimized: false,
      maximized: false,
      focused: true,
      zIndex: ++this.nextZ,
      desktopId
    };
    this.windows.forEach(w => { if (w.desktopId === desktopId) w.focused = false; });
    this.windows.push(win);
    this.emit();
    return win;
  }

  closeWindow(id: string) {
    this.windows = this.windows.filter(w => w.id !== id);
    this.emit();
  }

  minimizeWindow(id: string) {
    const win = this.find(id);
    if (win) { win.minimized = true; win.focused = false; this.emit(); }
  }

  restoreWindow(id: string) {
    const win = this.find(id);
    if (win) { win.minimized = false; this.focusWindow(id); }
  }

  toggleMaximize(id: string) {
    const win = this.find(id);
    if (win) { win.maximized = !win.maximized; this.emit(); }
  }

  focusWindow(id: string) {
    const win = this.find(id);
    if (win) {
      this.windows.filter(w => w.desktopId === win.desktopId).forEach(w => w.focused = false);
      win.focused = true;
      win.zIndex = ++this.nextZ;
      this.emit();
    }
  }

  moveWindow(id: string, x: number, y: number) {
    const win = this.find(id);
    if (win && !win.maximized) { win.x = x; win.y = y; this.emit(); }
  }

  resizeWindow(id: string, w: number, h: number) {
    const win = this.find(id);
    if (win && !win.maximized) { win.width = Math.max(300, w); win.height = Math.max(200, h); this.emit(); }
  }

  getWindowsForDesktop(desktopId: string): WindowState[] {
    return this.windows.filter(w => w.desktopId === desktopId);
  }

  private find(id: string): WindowState | undefined {
    return this.windows.find(w => w.id === id);
  }

  private emit() {
    this.windows$.next([...this.windows]);
  }
}
