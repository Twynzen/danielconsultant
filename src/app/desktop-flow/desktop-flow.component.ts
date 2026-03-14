import { Component, HostListener, OnInit } from '@angular/core';

interface DesktopCell {
  id: string;
  row: number;
  col: number;
  label: string;
}

@Component({
  selector: 'app-desktop-flow',
  template: `
    <!-- Infinite Desktop Matrix -->
    <div class="desktop-flow-container"
         (mousedown)="startPan($event)"
         (wheel)="onWheel($event)">

      <!-- Matrix Background Effect -->
      <div class="matrix-bg">
        <div class="matrix-grid" [style.transform]="'translate(' + offsetX + 'px, ' + offsetY + 'px) scale(' + zoom + ')'">
          <!-- Grid lines -->
          <svg class="grid-lines" [attr.width]="gridSvgSize" [attr.height]="gridSvgSize"
               [attr.viewBox]="'-' + gridSvgHalf + ' -' + gridSvgHalf + ' ' + gridSvgSize + ' ' + gridSvgSize">
            <defs>
              <pattern id="smallGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(0,200,255,0.06)" stroke-width="0.5"/>
              </pattern>
              <pattern id="bigGrid" [attr.width]="cellWidth" [attr.height]="cellHeight" patternUnits="userSpaceOnUse">
                <rect [attr.width]="cellWidth" [attr.height]="cellHeight" fill="url(#smallGrid)"/>
                <path [attr.d]="'M ' + cellWidth + ' 0 L 0 0 0 ' + cellHeight" fill="none"
                      stroke="rgba(0,200,255,0.15)" stroke-width="1"/>
              </pattern>
            </defs>
            <rect x="-50%" y="-50%" width="200%" height="200%" fill="url(#bigGrid)"/>
          </svg>

          <!-- Desktop Cells -->
          <div *ngFor="let cell of visibleCells"
               class="desktop-cell"
               [class.active]="cell.row === activeRow && cell.col === activeCol"
               [style.left.px]="cell.col * cellWidth"
               [style.top.px]="cell.row * cellHeight"
               [style.width.px]="cellWidth"
               [style.height.px]="cellHeight"
               (dblclick)="enterDesktop(cell)">
            <div class="cell-label">{{ cell.label }}</div>
            <div class="cell-preview">
              <app-windows-desktop
                [desktopId]="cell.id"
                [wallpaperIndex]="getCellWallpaperIndex(cell)">
              </app-windows-desktop>
            </div>
            <div class="cell-overlay" *ngIf="!(cell.row === activeRow && cell.col === activeCol && zoomed)">
              <span class="cell-coords">OS {{ cell.row }}.{{ cell.col }}</span>
              <span class="cell-enter-hint">Doble clic para entrar</span>
            </div>
          </div>
        </div>
      </div>

      <!-- HUD Navigation -->
      <div class="hud" *ngIf="!zoomed">
        <div class="hud-title">
          <span class="hud-glow">∞</span> INFINITE DESKTOP SYSTEM
        </div>
        <div class="hud-minimap">
          <div class="minimap-grid">
            <div *ngFor="let cell of visibleCells"
                 class="minimap-cell"
                 [class.active]="cell.row === activeRow && cell.col === activeCol"
                 (click)="navigateTo(cell.row, cell.col)"
                 [style.left.px]="(cell.col - minCol) * 18"
                 [style.top.px]="(cell.row - minRow) * 14">
            </div>
          </div>
        </div>
        <div class="hud-coords">
          Posición: [{{ activeRow }}, {{ activeCol }}] | Zoom: {{ (zoom * 100).toFixed(0) }}%
        </div>
        <div class="hud-controls">
          <button (click)="pan(-1, 0)">◀</button>
          <div class="vert-controls">
            <button (click)="pan(0, -1)">▲</button>
            <button (click)="pan(0, 1)">▼</button>
          </div>
          <button (click)="pan(1, 0)">▶</button>
          <button class="zoom-btn" (click)="zoomToActive()">⊕ Entrar</button>
        </div>
      </div>

      <!-- Exit button when zoomed -->
      <button class="exit-zoom" *ngIf="zoomed" (click)="zoomOut()">
        ← Volver a la matriz
      </button>

      <!-- Add Desktop buttons on edges -->
      <button class="add-desktop top" *ngIf="!zoomed" (click)="addRow(-1)" title="Agregar escritorios arriba">+ Fila ↑</button>
      <button class="add-desktop bottom" *ngIf="!zoomed" (click)="addRow(1)" title="Agregar escritorios abajo">+ Fila ↓</button>
      <button class="add-desktop left" *ngIf="!zoomed" (click)="addCol(-1)" title="Agregar escritorios a la izquierda">+ Col ←</button>
      <button class="add-desktop right" *ngIf="!zoomed" (click)="addCol(1)" title="Agregar escritorios a la derecha">+ Col →</button>
    </div>
  `,
  styleUrls: ['./desktop-flow.component.scss']
})
export class DesktopFlowComponent implements OnInit {
  cells: Map<string, DesktopCell> = new Map();
  visibleCells: DesktopCell[] = [];

  cellWidth = 960;
  cellHeight = 600;
  gridSvgSize = 10000;
  gridSvgHalf = 5000;

  offsetX = 0;
  offsetY = 0;
  zoom = 0.35;

  activeRow = 0;
  activeCol = 0;
  zoomed = false;

  minRow = -1;
  maxRow = 1;
  minCol = -1;
  maxCol = 1;

  private panning = false;
  private panStartX = 0;
  private panStartY = 0;
  private panStartOffsetX = 0;
  private panStartOffsetY = 0;

  ngOnInit() {
    // Create initial 3x3 grid
    for (let r = this.minRow; r <= this.maxRow; r++) {
      for (let c = this.minCol; c <= this.maxCol; c++) {
        this.createCell(r, c);
      }
    }
    this.updateVisible();
    this.centerOnActive();
  }

  private createCell(row: number, col: number): DesktopCell {
    const id = `desktop-${row}-${col}`;
    if (this.cells.has(id)) return this.cells.get(id)!;
    const names = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta', 'Iota'];
    const idx = ((row - this.minRow) * (this.maxCol - this.minCol + 1) + (col - this.minCol)) % names.length;
    const cell: DesktopCell = { id, row, col, label: `OS ${names[Math.abs(idx)]}` };
    this.cells.set(id, cell);
    return cell;
  }

  private updateVisible() {
    this.visibleCells = Array.from(this.cells.values()).sort((a, b) => a.row === b.row ? a.col - b.col : a.row - b.row);
  }

  getCellWallpaperIndex(cell: DesktopCell): number {
    return Math.abs(cell.row * 3 + cell.col);
  }

  centerOnActive() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    this.offsetX = vw / 2 - (this.activeCol * this.cellWidth + this.cellWidth / 2) * this.zoom;
    this.offsetY = vh / 2 - (this.activeRow * this.cellHeight + this.cellHeight / 2) * this.zoom;
  }

  navigateTo(row: number, col: number) {
    this.activeRow = row;
    this.activeCol = col;
    this.centerOnActive();
  }

  pan(dCol: number, dRow: number) {
    const newRow = this.activeRow + dRow;
    const newCol = this.activeCol + dCol;
    if (this.cells.has(`desktop-${newRow}-${newCol}`)) {
      this.navigateTo(newRow, newCol);
    }
  }

  enterDesktop(cell: DesktopCell) {
    this.activeRow = cell.row;
    this.activeCol = cell.col;
    this.zoomToActive();
  }

  zoomToActive() {
    this.zoomed = true;
    this.zoom = 1;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    this.offsetX = vw / 2 - (this.activeCol * this.cellWidth + this.cellWidth / 2);
    this.offsetY = vh / 2 - (this.activeRow * this.cellHeight + this.cellHeight / 2);
    // Adjust to fill screen
    const scaleX = vw / this.cellWidth;
    const scaleY = vh / this.cellHeight;
    this.zoom = Math.min(scaleX, scaleY);
    this.offsetX = vw / 2 - (this.activeCol * this.cellWidth + this.cellWidth / 2) * this.zoom;
    this.offsetY = vh / 2 - (this.activeRow * this.cellHeight + this.cellHeight / 2) * this.zoom;
  }

  zoomOut() {
    this.zoomed = false;
    this.zoom = 0.35;
    this.centerOnActive();
  }

  addRow(direction: number) {
    if (direction < 0) {
      this.minRow--;
      for (let c = this.minCol; c <= this.maxCol; c++) this.createCell(this.minRow, c);
    } else {
      this.maxRow++;
      for (let c = this.minCol; c <= this.maxCol; c++) this.createCell(this.maxRow, c);
    }
    this.updateVisible();
  }

  addCol(direction: number) {
    if (direction < 0) {
      this.minCol--;
      for (let r = this.minRow; r <= this.maxRow; r++) this.createCell(r, this.minCol);
    } else {
      this.maxCol++;
      for (let r = this.minRow; r <= this.maxRow; r++) this.createCell(r, this.maxCol);
    }
    this.updateVisible();
  }

  startPan(e: MouseEvent) {
    if (this.zoomed) return;
    if ((e.target as HTMLElement).closest('.desktop-cell') && !(e.target as HTMLElement).closest('.cell-overlay')) return;
    this.panning = true;
    this.panStartX = e.clientX;
    this.panStartY = e.clientY;
    this.panStartOffsetX = this.offsetX;
    this.panStartOffsetY = this.offsetY;
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(e: MouseEvent) {
    if (!this.panning) return;
    this.offsetX = this.panStartOffsetX + (e.clientX - this.panStartX);
    this.offsetY = this.panStartOffsetY + (e.clientY - this.panStartY);
  }

  @HostListener('document:mouseup')
  onMouseUp() { this.panning = false; }

  onWheel(e: WheelEvent) {
    if (this.zoomed) return;
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.08 : 0.92;
    const newZoom = Math.max(0.1, Math.min(1.5, this.zoom * factor));
    // Zoom towards cursor
    const mx = e.clientX;
    const my = e.clientY;
    this.offsetX = mx - (mx - this.offsetX) * (newZoom / this.zoom);
    this.offsetY = my - (my - this.offsetY) * (newZoom / this.zoom);
    this.zoom = newZoom;
  }

  @HostListener('window:keydown', ['$event'])
  onKeyDown(e: KeyboardEvent) {
    if (this.zoomed) {
      if (e.key === 'Escape') this.zoomOut();
      return;
    }
    switch (e.key) {
      case 'ArrowLeft': this.pan(-1, 0); break;
      case 'ArrowRight': this.pan(1, 0); break;
      case 'ArrowUp': this.pan(0, -1); break;
      case 'ArrowDown': this.pan(0, 1); break;
      case 'Enter': this.zoomToActive(); break;
    }
  }
}
