import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-notepad',
  template: `
    <div class="notepad-container">
      <div class="notepad-menu">
        <div class="menu-item" (click)="newFile()">Archivo Nuevo</div>
        <div class="menu-item" (click)="saveFile()">Guardar</div>
        <div class="menu-item" (click)="loadFile()">Abrir</div>
        <span class="status" *ngIf="statusMsg">{{ statusMsg }}</span>
      </div>
      <textarea [(ngModel)]="content" placeholder="Escribe aquí..." spellcheck="false"></textarea>
      <div class="notepad-statusbar">
        <span>Líneas: {{ lineCount }}</span>
        <span>Caracteres: {{ content.length }}</span>
      </div>
    </div>
  `,
  styles: [`
    .notepad-container { display: flex; flex-direction: column; height: 100%; background: #fff; }
    .notepad-menu {
      display: flex; gap: 2px; padding: 2px 4px; background: #f5f5f5;
      border-bottom: 1px solid #ddd; align-items: center;
    }
    .menu-item {
      padding: 4px 12px; font-size: 12px; cursor: pointer; border-radius: 4px;
      color: #333; transition: background .15s;
    }
    .menu-item:hover { background: #e3e3e3; }
    .status { margin-left: auto; font-size: 11px; color: #4caf50; padding-right: 8px; }
    textarea {
      flex: 1; border: none; outline: none; resize: none; padding: 12px;
      font-family: 'Consolas', 'Courier New', monospace; font-size: 14px;
      line-height: 1.5; color: #1a1a1a; background: #fff;
    }
    .notepad-statusbar {
      display: flex; gap: 16px; padding: 3px 12px; background: #f0f0f0;
      border-top: 1px solid #ddd; font-size: 11px; color: #666;
    }
  `]
})
export class NotepadComponent implements OnInit {
  content = '';
  statusMsg = '';

  get lineCount(): number { return this.content.split('\n').length; }

  ngOnInit() { this.loadFile(); }

  saveFile() {
    localStorage.setItem('win11-notepad', this.content);
    this.statusMsg = 'Guardado ✓';
    setTimeout(() => this.statusMsg = '', 2000);
  }

  loadFile() {
    const saved = localStorage.getItem('win11-notepad');
    if (saved) this.content = saved;
  }

  newFile() { this.content = ''; }
}
