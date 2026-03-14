import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy } from '@angular/core';

@Component({
  selector: 'app-paint',
  template: `
    <div class="paint-container">
      <div class="paint-toolbar">
        <div class="tool-group">
          <button [class.active]="tool === 'brush'" (click)="tool = 'brush'" title="Pincel">
            <span class="icon">🖌️</span>
          </button>
          <button [class.active]="tool === 'eraser'" (click)="tool = 'eraser'" title="Borrador">
            <span class="icon">🧹</span>
          </button>
          <button (click)="clearCanvas()" title="Limpiar">
            <span class="icon">🗑️</span>
          </button>
        </div>
        <div class="tool-group">
          <label class="color-pick">
            <input type="color" [(ngModel)]="brushColor" />
            <span class="color-preview" [style.background]="brushColor"></span>
          </label>
          <div class="size-control">
            <span>{{ brushSize }}px</span>
            <input type="range" min="1" max="50" [(ngModel)]="brushSize" />
          </div>
        </div>
        <div class="tool-group colors-quick">
          <span *ngFor="let c of quickColors" class="qcolor" [style.background]="c"
                (click)="brushColor = c; tool = 'brush'"></span>
        </div>
      </div>
      <canvas #canvas
              (mousedown)="startDraw($event)"
              (mousemove)="draw($event)"
              (mouseup)="stopDraw()"
              (mouseleave)="stopDraw()">
      </canvas>
    </div>
  `,
  styles: [`
    .paint-container { display: flex; flex-direction: column; height: 100%; background: #f0f0f0; }
    .paint-toolbar {
      display: flex; align-items: center; gap: 12px; padding: 6px 10px;
      background: #fafafa; border-bottom: 1px solid #ddd; flex-wrap: wrap;
    }
    .tool-group { display: flex; align-items: center; gap: 6px; }
    .tool-group button {
      width: 32px; height: 32px; border: 1px solid #ccc; border-radius: 4px;
      background: white; cursor: pointer; display: flex; align-items: center; justify-content: center;
      font-size: 14px; transition: all .15s;
    }
    .tool-group button:hover { background: #e3f2fd; }
    .tool-group button.active { background: #bbdefb; border-color: #42a5f5; }
    .color-pick { cursor: pointer; position: relative; }
    .color-pick input { position: absolute; opacity: 0; width: 0; height: 0; }
    .color-preview { display: block; width: 28px; height: 28px; border-radius: 4px; border: 2px solid #999; }
    .size-control { display: flex; align-items: center; gap: 4px; font-size: 11px; color: #555; }
    .size-control input { width: 80px; }
    .colors-quick { gap: 3px; }
    .qcolor { width: 18px; height: 18px; border-radius: 3px; cursor: pointer; border: 1px solid #bbb; }
    .qcolor:hover { transform: scale(1.2); }
    canvas { flex: 1; cursor: crosshair; background: white; }
  `]
})
export class PaintComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  private ctx!: CanvasRenderingContext2D;
  private drawing = false;
  private resizeObs!: ResizeObserver;

  tool: 'brush' | 'eraser' = 'brush';
  brushColor = '#000000';
  brushSize = 4;
  quickColors = ['#000','#fff','#f44336','#e91e63','#9c27b0','#2196f3','#4caf50','#ffeb3b','#ff9800','#795548'];

  ngAfterViewInit() {
    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d')!;
    this.fitCanvas();
    this.resizeObs = new ResizeObserver(() => this.fitCanvas());
    this.resizeObs.observe(canvas.parentElement!);
  }

  ngOnDestroy() { this.resizeObs?.disconnect(); }

  private fitCanvas() {
    const canvas = this.canvasRef.nativeElement;
    const parent = canvas.parentElement!;
    const toolbar = parent.querySelector('.paint-toolbar') as HTMLElement;
    const data = this.ctx.getImageData(0, 0, canvas.width, canvas.height);
    canvas.width = parent.clientWidth;
    canvas.height = parent.clientHeight - (toolbar?.offsetHeight || 40);
    this.ctx.putImageData(data, 0, 0);
  }

  startDraw(e: MouseEvent) {
    this.drawing = true;
    this.ctx.beginPath();
    const r = this.canvasRef.nativeElement.getBoundingClientRect();
    this.ctx.moveTo(e.clientX - r.left, e.clientY - r.top);
  }

  draw(e: MouseEvent) {
    if (!this.drawing) return;
    const r = this.canvasRef.nativeElement.getBoundingClientRect();
    this.ctx.lineWidth = this.brushSize;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.strokeStyle = this.tool === 'eraser' ? '#ffffff' : this.brushColor;
    this.ctx.lineTo(e.clientX - r.left, e.clientY - r.top);
    this.ctx.stroke();
  }

  stopDraw() { this.drawing = false; }

  clearCanvas() {
    const c = this.canvasRef.nativeElement;
    this.ctx.clearRect(0, 0, c.width, c.height);
  }
}
