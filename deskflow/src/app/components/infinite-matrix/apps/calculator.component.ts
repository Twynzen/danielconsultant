import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-calculator',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="calc-app">
      <div class="calc-display">
        <div class="calc-expr">{{ expression() || '&nbsp;' }}</div>
        <div class="calc-result">{{ display() }}</div>
      </div>
      <div class="calc-grid">
        <button class="calc-btn span2 fn" (click)="clear()">C</button>
        <button class="calc-btn fn" (click)="backspace()">⌫</button>
        <button class="calc-btn op" (click)="op('/')">÷</button>

        <button class="calc-btn" (click)="digit('7')">7</button>
        <button class="calc-btn" (click)="digit('8')">8</button>
        <button class="calc-btn" (click)="digit('9')">9</button>
        <button class="calc-btn op" (click)="op('*')">×</button>

        <button class="calc-btn" (click)="digit('4')">4</button>
        <button class="calc-btn" (click)="digit('5')">5</button>
        <button class="calc-btn" (click)="digit('6')">6</button>
        <button class="calc-btn op" (click)="op('-')">−</button>

        <button class="calc-btn" (click)="digit('1')">1</button>
        <button class="calc-btn" (click)="digit('2')">2</button>
        <button class="calc-btn" (click)="digit('3')">3</button>
        <button class="calc-btn op" (click)="op('+')">+</button>

        <button class="calc-btn fn" (click)="toggleSign()">±</button>
        <button class="calc-btn" (click)="digit('0')">0</button>
        <button class="calc-btn" (click)="dot()">.</button>
        <button class="calc-btn eq" (click)="equals()">=</button>
      </div>
    </div>
  `,
  styles: [`
    .calc-app {
      display:flex; flex-direction:column; height:100%;
      background:#0a0e14; font-family:'Share Tech Mono',monospace;
    }
    .calc-display {
      padding:20px 16px 12px; text-align:right;
      border-bottom:1px solid rgba(0,255,65,0.1);
    }
    .calc-expr { font-size:12px; color:#555; min-height:16px; margin-bottom:4px; }
    .calc-result { font-size:32px; color:#00ff41; text-shadow:0 0 15px rgba(0,255,65,0.5); word-break:break-all; }
    .calc-grid {
      flex:1; display:grid; grid-template-columns:repeat(4,1fr);
      gap:1px; background:rgba(0,255,65,0.05); padding:8px; gap:6px;
    }
    .calc-btn {
      background:rgba(0,255,65,0.04); border:1px solid rgba(0,255,65,0.12);
      border-radius:6px; color:#ccc; font-size:18px; cursor:pointer;
      font-family:'Share Tech Mono',monospace; transition:all 0.15s;
      &:hover { background:rgba(0,255,65,0.12); border-color:rgba(0,255,65,0.4); color:#00ff41; }
      &:active { transform:scale(0.95); }
    }
    .calc-btn.fn { color:#aaa; font-size:14px; }
    .calc-btn.op { color:#00cfff; border-color:rgba(0,207,255,0.2);
      &:hover { background:rgba(0,207,255,0.12); border-color:#00cfff; }
    }
    .calc-btn.eq {
      background:rgba(0,255,65,0.12); border-color:rgba(0,255,65,0.4); color:#00ff41;
      &:hover { background:rgba(0,255,65,0.25); box-shadow:0 0 12px rgba(0,255,65,0.3); }
    }
    .calc-btn.span2 { grid-column:span 2; }
  `]
})
export class CalculatorComponent {
  display = signal('0');
  expression = signal('');

  private current = '';
  private previous = '';
  private operator = '';
  private newInput = true;

  digit(d: string) {
    if (this.newInput) { this.current = d; this.newInput = false; }
    else this.current = this.current === '0' ? d : this.current + d;
    this.display.set(this.current);
  }

  dot() {
    if (this.newInput) { this.current = '0.'; this.newInput = false; }
    else if (!this.current.includes('.')) this.current += '.';
    this.display.set(this.current);
  }

  op(o: string) {
    if (this.operator && !this.newInput) this.calculate();
    this.previous = this.display();
    this.operator = o;
    this.newInput = true;
    const symbols: Record<string,string> = { '+':'+', '-':'−', '*':'×', '/':'÷' };
    this.expression.set(`${this.previous} ${symbols[o]}`);
  }

  equals() {
    if (!this.operator) return;
    this.expression.set(`${this.previous} ${this.operator === '*' ? '×' : this.operator === '/' ? '÷' : this.operator} ${this.current} =`);
    this.calculate();
    this.operator = '';
  }

  private calculate() {
    const a = parseFloat(this.previous);
    const b = parseFloat(this.display());
    let result: number;
    switch (this.operator) {
      case '+': result = a + b; break;
      case '-': result = a - b; break;
      case '*': result = a * b; break;
      case '/': result = b !== 0 ? a / b : 0; break;
      default: return;
    }
    const str = parseFloat(result.toFixed(10)).toString();
    this.display.set(str);
    this.current = str;
    this.newInput = true;
  }

  clear() {
    this.current = ''; this.previous = ''; this.operator = '';
    this.newInput = true; this.display.set('0'); this.expression.set('');
  }

  backspace() {
    if (this.newInput) return;
    this.current = this.current.slice(0, -1) || '0';
    this.display.set(this.current);
  }

  toggleSign() {
    const val = parseFloat(this.display());
    if (!isNaN(val)) {
      this.current = (-val).toString();
      this.display.set(this.current);
    }
  }
}
