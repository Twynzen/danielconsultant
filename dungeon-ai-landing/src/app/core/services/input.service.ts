// src/app/core/services/input.service.ts
// Servicio de manejo de input de teclado y touch

import { Injectable, NgZone, OnDestroy, signal } from '@angular/core';
import { fromEvent, Subject, takeUntil } from 'rxjs';
import { InputState } from '../interfaces/game-state.interfaces';

@Injectable({ providedIn: 'root' })
export class InputService implements OnDestroy {
  // v5.4.0: Separate sets for user keys and Sendell's simulated keys
  private readonly pressedKeys = new Set<string>();      // User's real keyboard input
  private readonly _simulatedKeys = new Set<string>();   // Sendell's simulated input
  private readonly destroy$ = new Subject<void>();

  // v4.1 FIX: Pause state for dialogs - when paused, all inputs return false
  private _isPaused = signal(false);
  readonly isPaused = this._isPaused.asReadonly();

  // v5.2.3: Tour block state - completely blocks ALL input during guided tour
  private _isTourBlocked = signal(false);
  readonly isTourBlocked = this._isTourBlocked.asReadonly();

  // v5.4.0: Track if Sendell is currently executing an action
  private _isSendellExecuting = signal(false);
  readonly isSendellExecuting = this._isSendellExecuting.asReadonly();

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
    // v5.2.3: Skip if user is typing in an input field
    const target = event.target as HTMLElement;
    const isTypingInInput = target.tagName === 'INPUT' || 
                            target.tagName === 'TEXTAREA' ||
                            target.isContentEditable;
    
    if (isTypingInInput) {
      return; // Let the input handle the key naturally
    }

    // v5.2.3: Block ALL input during guided tour (Sendell has control)
    if (this._isTourBlocked()) {
      // Only allow ESC to cancel tour
      if (event.code !== 'Escape') {
        event.preventDefault();
        console.log('[InputService] Input blocked - tour in progress');
        return;
      }
    }

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

  /**
   * v5.4.0: Check if an action is pressed (user OR simulated)
   * Combines both input sources for unified state
   */
  private isPressed(action: keyof InputState): boolean {
    // Check user keys
    const userPressed = Array.from(this.pressedKeys).some(
      code => this.keyMap[code] === action
    );

    // v5.4.0: Also check Sendell's simulated keys
    const simulatedPressed = Array.from(this._simulatedKeys).some(
      code => this.keyMap[code] === action
    );

    return userPressed || simulatedPressed;
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

  /**
   * v5.2.3: Block all input for guided tour
   * When blocked, user cannot control robot - Sendell has full control
   */
  blockForTour(): void {
    this._isTourBlocked.set(true);
    this.clearAllKeys(); // Clear any currently pressed keys
    console.log('[InputService] Tour block ENABLED - Sendell has control');
  }

  /**
   * v5.2.3: Unblock input after tour ends
   */
  unblockFromTour(): void {
    this._isTourBlocked.set(false);
    console.log('[InputService] Tour block DISABLED - User has control');
  }

  // ==================== v5.4.0: SENDELL KEY SIMULATION ====================

  /**
   * v5.4.0: Simula presionar una tecla (para acciones de Sendell)
   * Estas teclas se procesan igual que inputs reales del usuario
   * pero en un canal separado que funciona incluso con tour bloqueado
   */
  simulateKeyDown(keyCode: string): void {
    const action = this.keyMap[keyCode];
    if (!action) {
      console.warn('[InputService] Unknown key code to simulate:', keyCode);
      return;
    }

    this._simulatedKeys.add(keyCode);
    this._isSendellExecuting.set(true);
    this.updateInputState();
    console.log('[InputService] Sendell simulated keydown:', keyCode, '→', action);
  }

  /**
   * v5.4.0: Simula soltar una tecla (para acciones de Sendell)
   */
  simulateKeyUp(keyCode: string): void {
    this._simulatedKeys.delete(keyCode);

    // Si no quedan teclas simuladas, Sendell ya no está ejecutando
    if (this._simulatedKeys.size === 0) {
      this._isSendellExecuting.set(false);
    }

    this.updateInputState();
    console.log('[InputService] Sendell simulated keyup:', keyCode);
  }

  /**
   * v5.4.0: Limpia todas las teclas simuladas de Sendell
   * Útil para detener cualquier acción en progreso
   */
  clearSimulatedInputs(): void {
    this._simulatedKeys.clear();
    this._isSendellExecuting.set(false);
    this.updateInputState();
    console.log('[InputService] Cleared all Sendell simulated inputs');
  }

  /**
   * v5.4.0: Simula una pulsación instantánea (keydown + keyup)
   * Para acciones de un solo disparo como saltar o activar pilar
   */
  simulateKeyPress(keyCode: string, durationMs: number = 50): void {
    this.simulateKeyDown(keyCode);
    setTimeout(() => {
      this.simulateKeyUp(keyCode);
    }, durationMs);
  }

  /**
   * v5.4.0: Verifica si una tecla está siendo simulada por Sendell
   */
  isSimulating(keyCode: string): boolean {
    return this._simulatedKeys.has(keyCode);
  }

  /**
   * v5.4.0: Obtiene todas las teclas actualmente simuladas
   */
  getSimulatedKeys(): string[] {
    return Array.from(this._simulatedKeys);
  }

  /**
   * v5.4.2: Despacha un evento de teclado REAL al DOM
   * Necesario para que @HostListener lo detecte (e.g., pillar-system)
   * @param key - La tecla a simular (e.g., 'e', 'Enter')
   * @param eventType - 'keydown' o 'keyup'
   */
  dispatchRealKeyEvent(key: string, eventType: 'keydown' | 'keyup' = 'keydown'): void {
    const event = new KeyboardEvent(eventType, {
      key: key,
      code: `Key${key.toUpperCase()}`,
      bubbles: true,
      cancelable: true
    });

    this._isSendellExecuting.set(true);
    document.dispatchEvent(event);
    console.log(`[InputService] Dispatched REAL ${eventType} event: ${key}`);

    // Reset executing flag after a short delay if it's a keyup
    if (eventType === 'keyup') {
      setTimeout(() => {
        if (this._simulatedKeys.size === 0) {
          this._isSendellExecuting.set(false);
        }
      }, 100);
    }
  }

  /**
   * v5.4.2: Despacha una pulsación completa de tecla real (keydown + keyup)
   * Para acciones que requieren que @HostListener las detecte
   */
  dispatchRealKeyPress(key: string, durationMs: number = 100): void {
    this.dispatchRealKeyEvent(key, 'keydown');
    setTimeout(() => {
      this.dispatchRealKeyEvent(key, 'keyup');
    }, durationMs);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
