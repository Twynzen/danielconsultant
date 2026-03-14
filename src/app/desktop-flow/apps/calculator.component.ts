import { Component } from '@angular/core';

@Component({
  selector: 'app-calculator',
  template: `
    <div class="calc-container">
      <div class="calc-display">
        <div class="calc-expression">{{ expression || '&nbsp;' }}</div>
        <div class="calc-result">{{ display }}</div>
      </div>
      <div class="calc-buttons">
        <button class="func" (click)="clear()">C</button>
        <button class="func" (click)="backspace()">⌫</button>
        <button class="func" (click)="inputOp('%')">%</button>
        <button class="op" (click)="inputOp('/')">÷</button>

        <button (click)="inputNum('7')">7</button>
        <button (click)="inputNum('8')">8</button>
        <button (click)="inputNum('9')">9</button>
        <button class="op" (click)="inputOp('*')">×</button>

        <button (click)="inputNum('4')">4</button>
        <button (click)="inputNum('5')">5</button>
        <button (click)="inputNum('6')">6</button>
        <button class="op" (click)="inputOp('-')">−</button>

        <button (click)="inputNum('1')">1</button>
        <button (click)="inputNum('2')">2</button>
        <button (click)="inputNum('3')">3</button>
        <button class="op" (click)="inputOp('+')">+</button>

        <button (click)="toggleSign()">±</button>
        <button (click)="inputNum('0')">0</button>
        <button (click)="inputDot()">.</button>
        <button class="equals" (click)="calculate()">=</button>
      </div>
    </div>
  `,
  styles: [`
    .calc-container {
      display: flex; flex-direction: column; height: 100%;
      background: #202020; color: white; font-family: 'Segoe UI', sans-serif;
    }
    .calc-display {
      padding: 20px 16px 12px; text-align: right; flex-shrink: 0;
    }
    .calc-expression { font-size: 14px; color: #888; min-height: 20px; }
    .calc-result { font-size: 42px; font-weight: 300; margin-top: 4px; overflow: hidden; text-overflow: ellipsis; }
    .calc-buttons {
      flex: 1; display: grid; grid-template-columns: repeat(4, 1fr);
      gap: 2px; padding: 2px;
    }
    button {
      border: none; font-size: 18px; cursor: pointer; border-radius: 4px;
      background: #333; color: white; transition: background .12s;
      display: flex; align-items: center; justify-content: center;
      min-height: 56px;
    }
    button:hover { background: #444; }
    button:active { background: #555; }
    button.func { background: #3a3a3a; }
    button.func:hover { background: #4a4a4a; }
    button.op { background: #3a3a3a; color: #8ecaff; }
    button.op:hover { background: #4a4a4a; }
    button.equals { background: #4cc2ff; color: #1a1a1a; font-size: 22px; font-weight: bold; }
    button.equals:hover { background: #5ad0ff; }
  `]
})
export class CalculatorComponent {
  display = '0';
  expression = '';
  private current = '0';
  private previous = '';
  private operator = '';
  private shouldReset = false;

  inputNum(n: string) {
    if (this.shouldReset) { this.current = ''; this.shouldReset = false; }
    if (this.current === '0' && n !== '0') this.current = n;
    else if (this.current === '0' && n === '0') return;
    else this.current += n;
    this.display = this.current;
  }

  inputDot() {
    if (this.shouldReset) { this.current = '0'; this.shouldReset = false; }
    if (!this.current.includes('.')) this.current += '.';
    this.display = this.current;
  }

  inputOp(op: string) {
    if (this.operator && !this.shouldReset) this.calculate();
    this.previous = this.current || this.previous;
    this.operator = op;
    const opDisplay: Record<string, string> = { '+': '+', '-': '−', '*': '×', '/': '÷', '%': '%' };
    this.expression = `${this.previous} ${opDisplay[op] || op}`;
    this.shouldReset = true;
  }

  calculate() {
    if (!this.operator || !this.previous) return;
    const a = parseFloat(this.previous);
    const b = parseFloat(this.current);
    let result = 0;
    switch (this.operator) {
      case '+': result = a + b; break;
      case '-': result = a - b; break;
      case '*': result = a * b; break;
      case '/': result = b !== 0 ? a / b : 0; break;
      case '%': result = a % b; break;
    }
    this.expression = `${this.previous} ${this.operator} ${this.current} =`;
    this.current = String(parseFloat(result.toFixed(10)));
    this.display = this.current;
    this.previous = '';
    this.operator = '';
    this.shouldReset = true;
  }

  clear() {
    this.current = '0'; this.previous = ''; this.operator = '';
    this.display = '0'; this.expression = ''; this.shouldReset = false;
  }

  backspace() {
    if (this.shouldReset) return;
    this.current = this.current.slice(0, -1) || '0';
    this.display = this.current;
  }

  toggleSign() {
    if (this.current !== '0') {
      this.current = this.current.startsWith('-') ? this.current.slice(1) : '-' + this.current;
      this.display = this.current;
    }
  }
}
