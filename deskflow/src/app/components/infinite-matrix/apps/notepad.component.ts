import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-notepad',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="notepad-app">
      <div class="notepad-toolbar">
        <button class="nd-btn" (click)="saveLocal()" title="Guardar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
            <polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
          </svg>
          Guardar
        </button>
        <button class="nd-btn" (click)="clearText()" title="Nuevo">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
          Nuevo
        </button>
        <div class="nd-stats">{{ lines() }} líneas · {{ chars() }} chars</div>
        <div class="save-indicator" [class.show]="saved()">✓ Guardado</div>
      </div>
      <textarea
        [(ngModel)]="content"
        class="notepad-area"
        placeholder="// Escribe aquí...&#10;// Ctrl+S para guardar"
        spellcheck="false"
        (keydown.control.s)="saveLocal(); $event.preventDefault()">
      </textarea>
    </div>
  `,
  styles: [`
    .notepad-app { display:flex; flex-direction:column; height:100%; background:#0d1117; }
    .notepad-toolbar {
      display:flex; align-items:center; gap:8px; padding:6px 12px;
      background:#0a0e14; border-bottom:1px solid rgba(0,255,65,0.15);
    }
    .nd-btn {
      display:flex; align-items:center; gap:5px; padding:5px 10px;
      background:rgba(0,255,65,0.05); border:1px solid rgba(0,255,65,0.2);
      border-radius:4px; cursor:pointer; color:#00ff41; font-size:11px;
      font-family:'Share Tech Mono',monospace; transition:all 0.2s;
      svg { width:14px; height:14px; }
      &:hover { background:rgba(0,255,65,0.15); border-color:#00ff41; }
    }
    .nd-stats {
      margin-left:auto; font-size:10px; color:#555; font-family:'Share Tech Mono',monospace;
    }
    .save-indicator {
      font-size:11px; color:#00ff41; font-family:monospace;
      opacity:0; transition:opacity 0.3s; &.show { opacity:1; }
    }
    .notepad-area {
      flex:1; background:#0d1117; color:#00ff41; border:none; outline:none;
      padding:16px; font-family:'Share Tech Mono',monospace; font-size:13px;
      line-height:1.6; resize:none; caret-color:#00ff41;
      &::placeholder { color:#333; }
      &::selection { background:rgba(0,255,65,0.2); }
    }
  `]
})
export class NotepadComponent {
  content = '';
  saved = signal(false);

  lines = computed(() => this.content ? this.content.split('\n').length : 0);
  chars = computed(() => this.content.length);

  saveLocal() {
    localStorage.setItem('deskflow-notepad', this.content);
    this.saved.set(true);
    setTimeout(() => this.saved.set(false), 2000);
  }

  clearText() {
    if (this.content && !confirm('¿Descartar el contenido actual?')) return;
    this.content = '';
  }

  ngOnInit() {
    this.content = localStorage.getItem('deskflow-notepad') || '';
  }
}
