// src/app/core/services/input.service.ts
// Servicio de manejo de input de teclado y touch

import { Injectable, NgZone, OnDestroy, signal } from '@angular/core';
import { fromEvent, Subject, takeUntil } from 'rxjs';
import { InputState } from '../interfaces/game-state.interfaces';

@Injectable({ providedIn: 'root' })
export class InputService implements OnDestroy {
  private readonly pressedKeys = new Set<string>();
  private readonly destroy$ = new Subject<void>();

  readonly inputState = signal<InputState>({
    up: false,
    down: false,
    left: false,
    right: false,
    action: false,
  });

  private readonly keyMap: Record<string, keyof InputState> = {
    'KeyW': 'up',
    'ArrowUp': 'up',
    'KeyS': 'down',
    'ArrowDown': 'down',
    'KeyA': 'left',
    'ArrowLeft': 'left',
    'KeyD': 'right',
    'ArrowRight': 'right',
    'Space': 'action',
    'Enter': 'action',
  };

  constructor(private ngZone: NgZone) {
    this.initializeListeners();
  }

  private initializeListeners(): void {
    this.ngZone.runOutsideAngular(() => {
      fromEvent<KeyboardEvent>(document, 'keydown')
        .pipe(takeUntil(this.destroy$))
        .subscribe(event => this.handleKeyDown(event));

      fromEvent<KeyboardEvent>(document, 'keyup')
        .pipe(takeUntil(this.destroy$))
        .subscribe(event => this.handleKeyUp(event));

      fromEvent(window, 'blur')
        .pipe(takeUntil(this.destroy$))
        .subscribe(() => this.clearAllKeys());
    });
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (this.keyMap[event.code]) {
      event.preventDefault();
    }
    if (event.repeat) return;

    this.pressedKeys.add(event.code);
    this.updateInputState();
  }

  private handleKeyUp(event: KeyboardEvent): void {
    this.pressedKeys.delete(event.code);
    this.updateInputState();
  }

  private updateInputState(): void {
    const newState: InputState = {
      up: this.isPressed('up'),
      down: this.isPressed('down'),
      left: this.isPressed('left'),
      right: this.isPressed('right'),
      action: this.isPressed('action'),
    };

    this.ngZone.run(() => {
      this.inputState.set(newState);
    });
  }

  private isPressed(action: keyof InputState): boolean {
    return Array.from(this.pressedKeys).some(
      code => this.keyMap[code] === action
    );
  }

  getMovementVector(): { x: number; y: number } {
    const state = this.inputState();
    let x = 0, y = 0;

    if (state.left) x -= 1;
    if (state.right) x += 1;
    if (state.up) y -= 1;
    if (state.down) y += 1;

    // Normalizar diagonal
    if (x !== 0 && y !== 0) {
      const length = Math.sqrt(x * x + y * y);
      x /= length;
      y /= length;
    }

    return { x, y };
  }

  private clearAllKeys(): void {
    this.pressedKeys.clear();
    this.updateInputState();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
