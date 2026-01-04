// src/app/core/services/input.service.ts
// Servicio de manejo de input de teclado y touch

import { Injectable, NgZone, OnDestroy, signal } from '@angular/core';
import { fromEvent, Subject, takeUntil } from 'rxjs';
import { InputState } from '../interfaces/game-state.interfaces';

@Injectable({ providedIn: 'root' })
export class InputService implements OnDestroy {
  private readonly pressedKeys = new Set<string>();
  private readonly destroy$ = new Subject<void>();

  // v4.1 FIX: Pause state for dialogs - when paused, all inputs return false
  private _isPaused = signal(false);
  readonly isPaused = this._isPaused.asReadonly();

  readonly inputState = signal<InputState>({
    up: false,
    down: false,
    left: false,
    right: false,
    jump: false,
    action: false,
  });

  // Track if jump was just pressed this frame (for one-shot jump trigger)
  private _jumpJustPressed = signal(false);
  readonly jumpJustPressed = this._jumpJustPressed.asReadonly();

  private readonly keyMap: Record<string, keyof InputState> = {
    // Side-scroller: Up keys now trigger jump
    'KeyW': 'jump',
    'ArrowUp': 'jump',
    'Space': 'jump',
    // Down still available but unused in side-scroller
    'KeyS': 'down',
    'ArrowDown': 'down',
    // Left/Right for horizontal movement
    'KeyA': 'left',
    'ArrowLeft': 'left',
    'KeyD': 'right',
    'ArrowRight': 'right',
    // Enter for pillar interaction
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

    // v4.1 FIX: Don't register inputs when paused (dialog showing)
    if (this._isPaused()) {
      return;
    }

    // Detect jump just pressed (one-shot)
    const isJumpKey = this.keyMap[event.code] === 'jump';
    if (isJumpKey && !this.pressedKeys.has(event.code)) {
      this.ngZone.run(() => {
        this._jumpJustPressed.set(true);
        // Reset on next tick
        requestAnimationFrame(() => this._jumpJustPressed.set(false));
      });
    }

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
      jump: this.isPressed('jump'),
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

  /**
   * Get movement vector for side-scroller (horizontal only)
   * Y is always 0 - vertical movement handled by physics/jump
   */
  getMovementVector(): { x: number; y: number } {
    const state = this.inputState();
    let x = 0;

    if (state.left) x -= 1;
    if (state.right) x += 1;

    // No Y movement in side-scroller (handled by physics)
    return { x, y: 0 };
  }

  /**
   * Get horizontal input (-1, 0, or 1)
   */
  getHorizontalInput(): number {
    const state = this.inputState();
    let x = 0;
    if (state.left) x -= 1;
    if (state.right) x += 1;
    return x;
  }

  private clearAllKeys(): void {
    this.pressedKeys.clear();
    this.updateInputState();
  }

  /**
   * v4.1 FIX: Pause input processing (for dialogs)
   * When paused, new key presses are ignored but existing keys are PRESERVED
   * This allows movement to resume immediately when unpaused
   */
  pause(): void {
    this._isPaused.set(true);
    // NOTE: We intentionally DON'T clear keys here
    // This preserves the movement state for when we resume
  }

  /**
   * v4.1 FIX: Resume input processing
   */
  resume(): void {
    this._isPaused.set(false);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
