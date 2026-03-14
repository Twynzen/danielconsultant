import { Component, Input, OnInit, OnDestroy, HostListener } from '@angular/core';
import { WindowManagerService, WindowState } from './services/window-manager.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-windows-desktop',
  template: `
    <div class="win11-desktop" [attr.data-desktop]="desktopId">
      <!-- Wallpaper -->
      <div class="wallpaper" [style.background]="wallpaperGradient"></div>

      <!-- Desktop Icons -->
      <div class="desktop-icons">
        <div class="desktop-icon" (dblclick)="openApp('notepad', 'Bloc de notas')">
          <div class="icon-img">📝</div>
          <span>Bloc de notas</span>
        </div>
        <div class="desktop-icon" (dblclick)="openApp('paint', 'Paint')">
          <div class="icon-img">🎨</div>
          <span>Paint</span>
        </div>
        <div class="desktop-icon" (dblclick)="openApp('calculator', 'Calculadora')">
          <div class="icon-img">🧮</div>
          <span>Calculadora</span>
        </div>
        <div class="desktop-icon" (dblclick)="openApp('file-explorer', 'Explorador')">
          <div class="icon-img">📁</div>
          <span>Explorador</span>
        </div>
      </div>

      <!-- Windows -->
      <ng-container *ngFor="let win of desktopWindows">
        <div class="window-frame"
             *ngIf="!win.minimized"
             [class.maximized]="win.maximized"
             [class.focused]="win.focused"
             [style.left.px]="win.maximized ? 0 : win.x"
             [style.top.px]="win.maximized ? 0 : win.y"
             [style.width.px]="win.maximized ? undefined : win.width"
             [style.height.px]="win.maximized ? undefined : win.height"
             [style.z-index]="win.zIndex"
             (mousedown)="wm.focusWindow(win.id)">
          <!-- Title Bar -->
          <div class="titlebar" (mousedown)="startDrag($event, win)">
            <span class="titlebar-icon">
              <ng-container [ngSwitch]="win.appType">
                <span *ngSwitchCase="'paint'">🎨</span>
                <span *ngSwitchCase="'notepad'">📝</span>
                <span *ngSwitchCase="'calculator'">🧮</span>
                <span *ngSwitchCase="'file-explorer'">📁</span>
              </ng-container>
            </span>
            <span class="titlebar-text">{{ win.title }}</span>
            <div class="titlebar-buttons">
              <button class="tb-btn minimize" (click)="wm.minimizeWindow(win.id)" (mousedown)="$event.stopPropagation()">
                <svg width="10" height="1"><rect width="10" height="1" fill="currentColor"/></svg>
              </button>
              <button class="tb-btn maximize" (click)="wm.toggleMaximize(win.id)" (mousedown)="$event.stopPropagation()">
                <svg width="10" height="10"><rect x="0" y="0" width="10" height="10" fill="none" stroke="currentColor" stroke-width="1"/></svg>
              </button>
              <button class="tb-btn close" (click)="wm.closeWindow(win.id)" (mousedown)="$event.stopPropagation()">
                <svg width="10" height="10"><line x1="0" y1="0" x2="10" y2="10" stroke="currentColor" stroke-width="1.3"/>
                <line x1="10" y1="0" x2="0" y2="10" stroke="currentColor" stroke-width="1.3"/></svg>
              </button>
            </div>
          </div>
          <!-- Content -->
          <div class="window-content">
            <app-paint *ngIf="win.appType === 'paint'"></app-paint>
            <app-notepad *ngIf="win.appType === 'notepad'"></app-notepad>
            <app-calculator *ngIf="win.appType === 'calculator'"></app-calculator>
            <div *ngIf="win.appType === 'file-explorer'" class="file-explorer">
              <div class="fe-sidebar">
                <div class="fe-item active">📁 Escritorio</div>
                <div class="fe-item">📁 Documentos</div>
                <div class="fe-item">📁 Descargas</div>
                <div class="fe-item">💿 Disco C:</div>
              </div>
              <div class="fe-content">
                <div class="fe-file" *ngFor="let f of fakeFiles">
                  <span class="fe-file-icon">{{ f.icon }}</span>
                  <span>{{ f.name }}</span>
                </div>
              </div>
            </div>
          </div>
          <!-- Resize handle -->
          <div class="resize-handle" *ngIf="!win.maximized" (mousedown)="startResize($event, win)"></div>
        </div>
      </ng-container>

      <!-- Start Menu -->
      <div class="start-menu" *ngIf="startMenuOpen" (click)="$event.stopPropagation()">
        <div class="start-search">
          <input type="text" placeholder="Buscar aplicaciones..." [(ngModel)]="searchTerm" />
        </div>
        <div class="start-pinned">
          <h3>Anclados</h3>
          <div class="pinned-grid">
            <div class="pinned-app" (click)="openApp('notepad', 'Bloc de notas'); startMenuOpen = false">
              <span class="pa-icon">📝</span><span>Bloc de notas</span>
            </div>
            <div class="pinned-app" (click)="openApp('paint', 'Paint'); startMenuOpen = false">
              <span class="pa-icon">🎨</span><span>Paint</span>
            </div>
            <div class="pinned-app" (click)="openApp('calculator', 'Calculadora'); startMenuOpen = false">
              <span class="pa-icon">🧮</span><span>Calculadora</span>
            </div>
            <div class="pinned-app" (click)="openApp('file-explorer', 'Explorador'); startMenuOpen = false">
              <span class="pa-icon">📁</span><span>Explorador</span>
            </div>
          </div>
        </div>
        <div class="start-footer">
          <div class="user-info">
            <span class="user-avatar">👤</span>
            <span>Usuario</span>
          </div>
          <button class="power-btn" title="Apagar">⏻</button>
        </div>
      </div>

      <!-- Taskbar -->
      <div class="taskbar">
        <div class="taskbar-center">
          <button class="start-btn" [class.active]="startMenuOpen" (click)="toggleStartMenu()">
            <svg width="20" height="20" viewBox="0 0 20 20">
              <rect x="1" y="1" width="8" height="8" rx="1" fill="#4cc2ff"/>
              <rect x="11" y="1" width="8" height="8" rx="1" fill="#4cc2ff"/>
              <rect x="1" y="11" width="8" height="8" rx="1" fill="#4cc2ff"/>
              <rect x="11" y="11" width="8" height="8" rx="1" fill="#4cc2ff"/>
            </svg>
          </button>
          <button class="taskbar-search" (click)="openApp('file-explorer', 'Buscar')">
            🔍
          </button>
          <ng-container *ngFor="let win of desktopWindows">
            <button class="taskbar-app" [class.active]="win.focused && !win.minimized"
                    [class.minimized]="win.minimized"
                    (click)="taskbarClick(win)">
              <ng-container [ngSwitch]="win.appType">
                <span *ngSwitchCase="'paint'">🎨</span>
                <span *ngSwitchCase="'notepad'">📝</span>
                <span *ngSwitchCase="'calculator'">🧮</span>
                <span *ngSwitchCase="'file-explorer'">📁</span>
              </ng-container>
            </button>
          </ng-container>
        </div>
        <div class="taskbar-right">
          <span class="tray-icon">🔊</span>
          <span class="tray-icon">📶</span>
          <div class="taskbar-clock">
            <div class="clock-time">{{ currentTime }}</div>
            <div class="clock-date">{{ currentDate }}</div>
          </div>
          <div class="desktop-peek" (click)="minimizeAll()"></div>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./windows-desktop.component.scss']
})
export class WindowsDesktopComponent implements OnInit, OnDestroy {
  @Input() desktopId = 'desktop-0-0';
  @Input() wallpaperIndex = 0;

  desktopWindows: WindowState[] = [];
  startMenuOpen = false;
  searchTerm = '';
  currentTime = '';
  currentDate = '';
  private sub!: Subscription;
  private clockInterval!: ReturnType<typeof setInterval>;
  private dragging: { win: WindowState; offsetX: number; offsetY: number } | null = null;
  private resizing: { win: WindowState; startX: number; startY: number; startW: number; startH: number } | null = null;

  fakeFiles = [
    { icon: '📄', name: 'documento.txt' }, { icon: '🖼️', name: 'foto.png' },
    { icon: '📊', name: 'datos.xlsx' }, { icon: '📁', name: 'Proyectos' },
    { icon: '🎵', name: 'musica.mp3' }, { icon: '📹', name: 'video.mp4' },
  ];

  private wallpapers = [
    'linear-gradient(135deg, #0078d4 0%, #005a9e 30%, #1a1a2e 70%, #16213e 100%)',
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
    'linear-gradient(135deg, #fccb90 0%, #d57eeb 100%)',
    'radial-gradient(ellipse at bottom, #1B2735 0%, #090A0F 100%)',
  ];

  get wallpaperGradient(): string {
    return this.wallpapers[this.wallpaperIndex % this.wallpapers.length];
  }

  constructor(public wm: WindowManagerService) {}

  ngOnInit() {
    this.sub = this.wm.getWindows().subscribe(all => {
      this.desktopWindows = all.filter(w => w.desktopId === this.desktopId);
    });
    this.updateClock();
    this.clockInterval = setInterval(() => this.updateClock(), 1000);
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
    clearInterval(this.clockInterval);
  }

  private updateClock() {
    const now = new Date();
    this.currentTime = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    this.currentDate = now.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  openApp(type: WindowState['appType'], title: string) {
    this.wm.openWindow(type, title, this.desktopId);
  }

  toggleStartMenu() { this.startMenuOpen = !this.startMenuOpen; }

  taskbarClick(win: WindowState) {
    if (win.minimized) this.wm.restoreWindow(win.id);
    else if (win.focused) this.wm.minimizeWindow(win.id);
    else this.wm.focusWindow(win.id);
  }

  minimizeAll() {
    this.desktopWindows.forEach(w => this.wm.minimizeWindow(w.id));
  }

  startDrag(e: MouseEvent, win: WindowState) {
    if (win.maximized) return;
    this.dragging = { win, offsetX: e.clientX - win.x, offsetY: e.clientY - win.y };
    e.preventDefault();
  }

  startResize(e: MouseEvent, win: WindowState) {
    this.resizing = { win, startX: e.clientX, startY: e.clientY, startW: win.width, startH: win.height };
    e.preventDefault();
    e.stopPropagation();
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(e: MouseEvent) {
    if (this.dragging) {
      const { win, offsetX, offsetY } = this.dragging;
      this.wm.moveWindow(win.id, e.clientX - offsetX, e.clientY - offsetY);
    }
    if (this.resizing) {
      const { win, startX, startY, startW, startH } = this.resizing;
      this.wm.resizeWindow(win.id, startW + (e.clientX - startX), startH + (e.clientY - startY));
    }
  }

  @HostListener('document:mouseup')
  onMouseUp() {
    this.dragging = null;
    this.resizing = null;
  }

  @HostListener('document:click', ['$event'])
  onDocClick(e: Event) {
    const target = e.target as HTMLElement;
    if (this.startMenuOpen && !target.closest('.start-menu') && !target.closest('.start-btn')) {
      this.startMenuOpen = false;
    }
  }
}
