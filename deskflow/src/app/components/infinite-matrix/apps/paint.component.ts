import {
  Component, ElementRef, ViewChild, AfterViewInit, OnDestroy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-paint',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="paint-app">
      <div class="paint-toolbar">
        <div class="tool-group">
          <button class="tool-btn" [class.active]="tool==='brush'" (click)="tool='brush'" title="Pincel">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
            </svg>
          </button>
          <button class="tool-btn" [class.active]="tool==='eraser'" (click)="tool='eraser'" title="Borrador">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20 20H7L3 16l10-10 7 7-1 1"/><path d="M6.0001 20l4-4"/>
            </svg>
          </button>
          <button class="tool-btn" (click)="clearCanvas()" title="Limpiar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
            </svg>
          </button>
        </div>
        <div class="tool-group">
          <input type="color" [(ngModel)]="color" class="color-picker" title="Color"/>
          <div class="quick-colors">
            <div *ngFor="let c of quickColors" class="qc" [style.background]="c"
                 [class.active]="color===c" (click)="color=c"></div>
          </div>
        </div>
        <div class="tool-group size-group">
          <label>{{ size }}px</label>
          <input type="range" [(ngModel)]="size" min="1" max="40" class="size-slider"/>
        </div>
      </div>
      <canvas #canvas class="paint-canvas"
        (mousedown)="startDraw($event)"
        (mousemove)="draw($event)"
        (mouseup)="stopDraw()"
        (mouseleave)="stopDraw()">
      </canvas>
    </div>
  `,
  styles: [`
    .paint-app { display:flex; flex-direction:column; height:100%; background:#0d1117; }
    .paint-toolbar {
      display:flex; align-items:center; gap:12px; padding:8px 12px;
      background:#0a0e14; border-bottom:1px solid rgba(0,255,65,0.15);
      flex-wrap:wrap;
    }
    .tool-group { display:flex; align-items:center; gap:6px; }
    .tool-btn {
      width:32px; height:32px; background:rgba(0,255,65,0.05); border:1px solid rgba(0,255,65,0.2);
      border-radius:4px; cursor:pointer; display:flex; align-items:center; justify-content:center;
      color:#00ff41; transition:all 0.2s;
      svg { width:16px; height:16px; }
      &:hover { background:rgba(0,255,65,0.15); border-color:#00ff41; }
      &.active { background:rgba(0,255,65,0.2); border-color:#00ff41; box-shadow:0 0 8px rgba(0,255,65,0.3); }
    }
    .color-picker {
      width:36px; height:32px; border:1px solid rgba(0,255,65,0.3);
      border-radius:4px; cursor:pointer; background:transparent; padding:2px;
    }
    .quick-colors { display:flex; gap:4px; }
    .qc {
      width:20px; height:20px; border-radius:3px; cursor:pointer;
      border:2px solid transparent; transition:border-color 0.15s;
      &:hover, &.active { border-color:#00ff41; }
    }
    .size-group { gap:8px; label { font-size:11px; color:#888; font-family:monospace; min-width:30px; } }
    .size-slider { width:80px; accent-color:#00ff41; }
    .paint-canvas { flex:1; cursor:crosshair; display:block; width:100%; }
  `]
})
export class PaintComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  tool: 'brush' | 'eraser' = 'brush';
  color = '#00ff41';
  size = 4;
  quickColors = ['#00ff41', '#00cfff', '#ff0040', '#ffcc00', '#ffffff', '#ff6600', '#cc00ff', '#000000'];

  private ctx!: CanvasRenderingContext2D;
  private drawing = false;
  private resizeObs!: ResizeObserver;

  ngAfterViewInit() {
    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d')!;
    this.resizeObs = new ResizeObserver(() => this.resizeCanvas());
    this.resizeObs.observe(canvas.parentElement!);
    this.resizeCanvas();
  }

  ngOnDestroy() { this.resizeObs?.disconnect(); }

  resizeCanvas() {
    const canvas = this.canvasRef.nativeElement;
    const data = this.ctx.getImageData(0, 0, canvas.width, canvas.height);
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    this.ctx.putImageData(data, 0, 0);
  }

  startDraw(e: MouseEvent) {
    this.drawing = true;
    this.ctx.beginPath();
    this.ctx.moveTo(e.offsetX, e.offsetY);
  }

  draw(e: MouseEvent) {
    if (!this.drawing) return;
    this.ctx.lineWidth = this.size;
    this.ctx.lineCap = 'round';
    this.ctx.strokeStyle = this.tool === 'eraser' ? '#0d1117' : this.color;
    this.ctx.lineTo(e.offsetX, e.offsetY);
    this.ctx.stroke();
    this.ctx.beginPath();
    this.ctx.moveTo(e.offsetX, e.offsetY);
  }

  stopDraw() { this.drawing = false; }

  clearCanvas() {
    const c = this.canvasRef.nativeElement;
    this.ctx.clearRect(0, 0, c.width, c.height);
  }
}
