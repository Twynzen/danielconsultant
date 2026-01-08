/**
 * ActionExecutorService - Ejecuta acciones de Sendell
 * v5.4.0: Simula inputs de teclado reales para movimiento orgánico
 *
 * Este servicio es el puente entre las acciones del LLM y el sistema de física.
 * En lugar de teletransportar al robot, simula las teclas reales que el usuario
 * presionaría, logrando un movimiento orgánico a 300px/s.
 */

import { Injectable, inject, signal, computed, NgZone } from '@angular/core';
import { InputService } from '../core/services/input.service';
import { PhysicsService } from '../core/services/physics.service';
import { PILLARS, PillarConfig } from '../config/pillar.config';
import { RobotAction } from '../config/sendell-ai.config';

// Estado de una acción en ejecución
interface ActionExecution {
  type: string;
  target?: string;
  startTime: number;
  targetX?: number;
  keyCode?: string;
}

// v5.9: Active action tracking for concurrency detection
interface ActiveAction {
  id: string;
  action: RobotAction;
  startTime: number;
}

@Injectable({ providedIn: 'root' })
export class ActionExecutorService {
  private inputService = inject(InputService);
  private physicsService = inject(PhysicsService);
  private ngZone = inject(NgZone);

  // Estado de acción en progreso
  private _currentAction = signal<ActionExecution | null>(null);
  private _walkAnimationId: number | null = null;

  // v5.9: Track all active actions for concurrency detection
  private _activeActions = new Map<string, ActiveAction>();

  // Callbacks para notificar completación
  private _onWalkComplete: (() => void) | null = null;
  private _onActionComplete: (() => void) | null = null;

  // Computed signals públicos
  readonly isExecutingAction = computed(() => this._currentAction() !== null);
  readonly currentActionType = computed(() => this._currentAction()?.type ?? null);

  // Tolerancia para considerar que llegamos al destino
  private readonly ARRIVAL_THRESHOLD = 50; // pixels

  /**
   * Ejecuta una acción del catálogo
   * Retorna una Promise que se resuelve cuando la acción completa
   * v5.9: Added concurrent action detection and logging
   */
  async executeAction(action: RobotAction): Promise<void> {
    const actionId = `${action.type}_${Date.now()}`;
    const startTime = performance.now();

    // v5.9: Log concurrent actions
    if (this._activeActions.size > 0) {
      const activeIds = [...this._activeActions.keys()];
      console.warn(
        '%c[ActionExecutor] CONCURRENT ACTIONS DETECTED',
        'color: #ffaa00; font-weight: bold'
      );
      console.warn('[ActionExecutor] Active actions:', activeIds);
      console.warn('[ActionExecutor] New action:', action.type);
    }

    // Register this action as active
    this._activeActions.set(actionId, { id: actionId, action, startTime });

    console.log('[ActionExecutor] ========== EXECUTING ACTION ==========');
    console.log('[ActionExecutor] Action:', action);
    console.log('[ActionExecutor] Action ID:', actionId);

    try {
      await this._executeActionInternal(action);
    } finally {
      // v5.9: Clean up and log completion time
      this._activeActions.delete(actionId);
      const duration = performance.now() - startTime;
      console.log(
        `%c[ActionExecutor] ${action.type} completed in ${duration.toFixed(2)}ms`,
        'color: #00ff44'
      );
    }
  }

  /**
   * v5.9: Internal action execution (separated for cleanup handling)
   */
  private async _executeActionInternal(action: RobotAction): Promise<void> {
    switch (action.type) {
      case 'walk_to_pillar':
        if (action.target) {
          await this.walkToPillar(action.target);
        }
        break;

      case 'walk_right':
        this.startWalking('right');
        break;

      case 'walk_left':
        this.startWalking('left');
        break;

      case 'stop':
        this.stopWalking();
        break;

      case 'jump':
        this.simulateJump();
        break;

      case 'activate_pillar':
      case 'energize_pillar':
        // v5.4.2: Use real key event for E (pillar interaction key)
        this.simulatePillarAction();
        break;

      case 'exit_pillar':
        // v5.4.2: Exit pillar uses E key (same as activate)
        // Must dispatch REAL event for @HostListener to detect
        this.simulatePillarAction();
        break;

      case 'wave':
      case 'idle':
      case 'point_at':
        // Animaciones que no requieren input de teclado
        // Se manejan visualmente en el componente del personaje
        console.log('[ActionExecutor] Animation action (no keyboard input):', action.type);
        break;

      case 'crash':
        // Acción especial de reinicio
        console.log('[ActionExecutor] Crash action - handled by dialog component');
        break;

      default:
        console.warn('[ActionExecutor] Unknown action type:', action.type);
    }
  }

  /**
   * Registra callback para cuando termina de caminar
   */
  onWalkComplete(callback: () => void): void {
    this._onWalkComplete = callback;
  }

  /**
   * Registra callback para cuando termina cualquier acción
   */
  onActionComplete(callback: () => void): void {
    this._onActionComplete = callback;
  }

  /**
   * v5.4.0: Caminar a un pilar SIMULANDO input de teclado
   * El robot REALMENTE camina a 300px/s usando el sistema de física
   */
  async walkToPillar(pillarId: string): Promise<void> {
    const pillar = PILLARS.find(p => p.id === pillarId);
    if (!pillar) {
      console.warn('[ActionExecutor] Pillar not found:', pillarId);
      return;
    }

    const targetX = pillar.worldX;
    const currentX = this.physicsService.state().x;
    const distance = Math.abs(targetX - currentX);

    console.log('[ActionExecutor] Walking to pillar:', pillarId);
    console.log('[ActionExecutor] Current X:', currentX, 'Target X:', targetX, 'Distance:', distance);

    // Si ya estamos cerca, no caminar
    if (distance < this.ARRIVAL_THRESHOLD) {
      console.log('[ActionExecutor] Already at pillar, skipping walk');
      this.notifyWalkComplete();
      return;
    }

    // Determinar dirección
    const direction = targetX > currentX ? 'right' : 'left';
    const keyCode = direction === 'right' ? 'KeyD' : 'KeyA';

    // Registrar acción en progreso
    this._currentAction.set({
      type: 'walk_to_pillar',
      target: pillarId,
      startTime: performance.now(),
      targetX,
      keyCode
    });

    // Simular presionar tecla de dirección
    this.inputService.simulateKeyDown(keyCode);
    console.log('[ActionExecutor] Started walking', direction, 'to', pillarId);

    // Monitorear posición hasta llegar
    return new Promise((resolve) => {
      this.ngZone.runOutsideAngular(() => {
        const checkPosition = () => {
          const currentAction = this._currentAction();
          if (!currentAction || currentAction.type !== 'walk_to_pillar') {
            // Acción cancelada
            resolve();
            return;
          }

          const currentPos = this.physicsService.state().x;
          const target = currentAction.targetX!;
          const remainingDistance = Math.abs(target - currentPos);

          // Si llegamos (dentro del threshold), parar
          if (remainingDistance < this.ARRIVAL_THRESHOLD) {
            console.log('[ActionExecutor] Arrived at pillar:', pillarId, 'Final X:', currentPos);
            this.inputService.simulateKeyUp(keyCode);
            this._currentAction.set(null);
            this._walkAnimationId = null;
            this.notifyWalkComplete();
            resolve();
            return;
          }

          // Verificar que vamos en la dirección correcta (no nos pasamos)
          const newDirection = target > currentPos ? 'right' : 'left';
          const expectedDirection = keyCode === 'KeyD' ? 'right' : 'left';

          if (newDirection !== expectedDirection) {
            // Nos pasamos del objetivo, parar
            console.log('[ActionExecutor] Overshot target, stopping at:', currentPos);
            this.inputService.simulateKeyUp(keyCode);
            this._currentAction.set(null);
            this._walkAnimationId = null;
            this.notifyWalkComplete();
            resolve();
            return;
          }

          // Continuar monitoreando
          this._walkAnimationId = requestAnimationFrame(checkPosition);
        };

        this._walkAnimationId = requestAnimationFrame(checkPosition);
      });
    });
  }

  /**
   * Empezar a caminar en una dirección (sin objetivo específico)
   */
  startWalking(direction: 'left' | 'right'): void {
    const keyCode = direction === 'right' ? 'KeyD' : 'KeyA';

    this._currentAction.set({
      type: 'walking_' + direction,
      startTime: performance.now(),
      keyCode
    });

    this.inputService.simulateKeyDown(keyCode);
    console.log('[ActionExecutor] Started continuous walking:', direction);
  }

  /**
   * Parar de caminar (cualquier movimiento)
   */
  stopWalking(): void {
    const currentAction = this._currentAction();

    if (currentAction?.keyCode) {
      this.inputService.simulateKeyUp(currentAction.keyCode);
    }

    // Limpiar cualquier tecla simulada
    this.inputService.clearSimulatedInputs();

    // Cancelar animación de monitoreo
    if (this._walkAnimationId) {
      cancelAnimationFrame(this._walkAnimationId);
      this._walkAnimationId = null;
    }

    this._currentAction.set(null);
    console.log('[ActionExecutor] Stopped walking');
  }

  /**
   * Simular salto (Space)
   */
  simulateJump(): void {
    console.log('[ActionExecutor] Simulating jump');
    this.inputService.simulateKeyPress('Space', 50);
  }

  /**
   * Simular Enter (legacy - for actions that need Enter key)
   */
  simulateEnter(): void {
    console.log('[ActionExecutor] Simulating Enter');
    this.inputService.simulateKeyPress('Enter', 100);
  }

  /**
   * v5.4.2: Simular tecla E para interacción con pilar (activar/salir)
   * Despacha un evento de teclado REAL para que @HostListener lo detecte
   */
  simulatePillarAction(): void {
    console.log('[ActionExecutor] Simulating pillar action (E key - REAL event)');
    this.inputService.dispatchRealKeyPress('e', 100);
  }

  /**
   * Cancelar cualquier acción en progreso
   */
  cancelCurrentAction(): void {
    console.log('[ActionExecutor] Cancelling current action');
    this.stopWalking();
  }

  /**
   * Obtiene la posición actual del robot
   */
  getRobotPosition(): number {
    return this.physicsService.state().x;
  }

  /**
   * Obtiene el pilar más cercano al robot
   */
  getNearestPillar(): PillarConfig | null {
    const robotX = this.getRobotPosition();
    let nearest: PillarConfig | null = null;
    let minDistance = Infinity;

    for (const pillar of PILLARS) {
      const distance = Math.abs(robotX - pillar.worldX);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = pillar;
      }
    }

    return nearest;
  }

  /**
   * Verifica si el robot está cerca de un pilar específico
   */
  isNearPillar(pillarId: string, threshold: number = 100): boolean {
    const pillar = PILLARS.find(p => p.id === pillarId);
    if (!pillar) return false;

    const robotX = this.getRobotPosition();
    return Math.abs(robotX - pillar.worldX) < threshold;
  }

  /**
   * Notifica que terminó de caminar
   */
  private notifyWalkComplete(): void {
    if (this._onWalkComplete) {
      this._onWalkComplete();
    }
    if (this._onActionComplete) {
      this._onActionComplete();
    }
  }

  /**
   * Limpieza al destruir el servicio
   */
  cleanup(): void {
    this.stopWalking();
    this._onWalkComplete = null;
    this._onActionComplete = null;
  }
}
