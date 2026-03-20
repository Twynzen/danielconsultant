import {
  Component, Input, HostListener, computed, inject, signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { WindowManagerService, WindowState } from '../../services/window-manager.service';
import { PaintComponent } from '../infinite-matrix/apps/paint.component';
import { NotepadComponent } from '../infinite-matrix/apps/notepad.component';
import { CalculatorComponent } from '../infinite-matrix/apps/calculator.component';

@Component({
  selector: 'app-desktop-windows-layer',
  standalone: true,
  imports: [CommonModule, PaintComponent, NotepadComponent, CalculatorComponent],
  templateUrl: './desktop-windows-layer.component.html',
  styleUrl: './desktop-windows-layer.component.scss'
})
export class DesktopWindowsLayerComponent {
  @Input() desktopId = 'main';

  wm = inject(WindowManagerService);

  desktopWindows = computed(() =>
    this.wm.windows().filter(w => w.desktopId === this.desktopId)
  );

  hasWindows = computed(() => this.desktopWindows().length > 0);

  private dragging: {
    win: WindowState;
    startX: number; startY: number;
    origX: number; origY: number;
  } | null = null;

  private resizing: {
    win: WindowState;
    startX: number; startY: number;
    origW: number; origH: number;
  } | null = null;

  getAppIcon(appType: string): string {
    const icons: Record<string, string> = {
      paint: `<svg viewBox="0 0 24 24" fill="none" stroke="#00ff41" stroke-width="1.5">
        <path d="M12 19l7-7 3 3-7 7-3-3z"/>
        <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
      </svg>`,
      notepad: `<svg viewBox="0 0 24 24" fill="none" stroke="#00cfff" stroke-width="1.5">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
      </svg>`,
      calculator: `<svg viewBox="0 0 24 24" fill="none" stroke="#ff6600" stroke-width="1.5">
        <rect x="4" y="2" width="16" height="20" rx="2"/>
        <line x1="8" y1="6" x2="16" y2="6"/>
      </svg>`,
    };
    return icons[appType] ?? '';
  }

  startDrag(e: MouseEvent, win: WindowState) {
    if (win.maximized) return;
    e.preventDefault();
    e.stopPropagation();
    this.wm.focusWindow(win.id);
    this.dragging = {
      win,
      startX: e.clientX, startY: e.clientY,
      origX: win.x, origY: win.y
    };
  }

  startResize(e: MouseEvent, win: WindowState) {
    e.preventDefault();
    e.stopPropagation();
    this.resizing = {
      win,
      startX: e.clientX, startY: e.clientY,
      origW: win.width, origH: win.height
    };
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(e: MouseEvent) {
    if (this.dragging) {
      const dx = e.clientX - this.dragging.startX;
      const dy = e.clientY - this.dragging.startY;
      this.wm.moveWindow(this.dragging.win.id,
        this.dragging.origX + dx,
        this.dragging.origY + dy
      );
    }
    if (this.resizing) {
      const dw = e.clientX - this.resizing.startX;
      const dh = e.clientY - this.resizing.startY;
      this.wm.resizeWindow(this.resizing.win.id,
        Math.max(280, this.resizing.origW + dw),
        Math.max(200, this.resizing.origH + dh)
      );
    }
  }

  @HostListener('document:mouseup')
  onMouseUp() {
    this.dragging = null;
    this.resizing = null;
  }
}
