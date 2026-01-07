/**
 * TourService - Intelligent Tour State Machine
 * v5.4.0: Controls the guided tour flow with LLM integration + ActionExecutor
 *
 * This service orchestrates the tour experience:
 * - Manages tour step progression
 * - Coordinates between typing, walking, and energizing phases
 * - Provides spatial awareness context to the LLM
 * - Handles user input during tour
 * - v5.4.0: Uses ActionExecutorService for organic robot movement
 */

import { Injectable, inject, signal, computed } from '@angular/core';
import { PhysicsService } from '../core/services/physics.service';
import { InputService } from '../core/services/input.service';
import { PILLARS } from '../config/pillar.config';
import { ActionExecutorService } from './action-executor.service';
import { RobotAction } from '../config/sendell-ai.config';

// Tour step states
export enum TourStep {
  IDLE = 'idle',               // Tour not active
  INTRO = 'intro',             // LLM generating intro message
  TYPING = 'typing',           // Text animation in progress
  WALKING = 'walking',         // Robot walking to pillar
  ENERGIZING = 'energizing',   // Robot entering pillar
  WAIT_USER = 'wait_user',     // Waiting for user to press key
  PILLAR_INFO = 'pillar_info', // LLM explaining current pillar
  COMPLETE = 'complete'        // Tour finished
}

export interface TourState {
  step: TourStep;
  currentPillarIndex: number;
  pillarSequence: string[];
  pendingAction: { type: string; target?: string } | null;
  lastMessage: string;
  pillarInfoShown: boolean;  // v5.3.0: Track if pillar info was already shown
}

// Default tour sequence - visits these pillars in order
const DEFAULT_TOUR_SEQUENCE = [
  'about-daniel',    // First: Who is Daniel
  'local-llms',      // Second: Main service
  'calendly'         // Third: CTA to schedule
];

// Pillar positions for spatial awareness
const PILLAR_POSITIONS: Record<string, number> = {
  'about-daniel': 1000,
  'local-llms': 1600,
  'rag-systems': 2200,
  'agent-orchestration': 2800,
  'custom-integrations': 3400,
  'calendly': 4000,
  'github': 4600,
  'nuvaris': 5200,
  'multidesktopflow': 5800
};

@Injectable({
  providedIn: 'root'
})
export class TourService {
  private physicsService = inject(PhysicsService);
  private inputService = inject(InputService);
  private actionExecutor = inject(ActionExecutorService);

  // Internal state
  private _state = signal<TourState>({
    step: TourStep.IDLE,
    currentPillarIndex: 0,
    pillarSequence: [...DEFAULT_TOUR_SEQUENCE],
    pendingAction: null,
    lastMessage: '',
    pillarInfoShown: false
  });

  // Public computed signals
  readonly step = computed(() => this._state().step);
  readonly currentPillarIndex = computed(() => this._state().currentPillarIndex);
  readonly currentPillarId = computed(() => {
    const state = this._state();
    return state.pillarSequence[state.currentPillarIndex] || null;
  });
  readonly isActive = computed(() => {
    const step = this._state().step;
    return step !== TourStep.IDLE && step !== TourStep.COMPLETE;
  });
  readonly showContinuePrompt = computed(() =>
    this._state().step === TourStep.WAIT_USER
  );
  readonly pendingAction = computed(() => this._state().pendingAction);
  readonly hasMorePillars = computed(() => {
    const state = this._state();
    return state.currentPillarIndex < state.pillarSequence.length - 1;
  });

  constructor() {
    console.log('[TourService] Initialized');
  }

  /**
   * Start the guided tour
   * v5.4.0: Blocks user input and configures ActionExecutor callbacks
   */
  startTour(): void {
    console.log('[TourService] ========== TOUR STARTED ==========');
    console.log('[TourService] Pillar sequence:', DEFAULT_TOUR_SEQUENCE);

    // v5.4.0: Block user input - Sendell takes control
    this.inputService.blockForTour();

    // v5.4.0: Configure ActionExecutor callbacks
    this.actionExecutor.onWalkComplete(() => {
      console.log('[TourService] ActionExecutor callback: walk complete');
      this.onWalkComplete();
    });

    this._state.set({
      step: TourStep.INTRO,
      currentPillarIndex: 0,
      pillarSequence: [...DEFAULT_TOUR_SEQUENCE],
      pendingAction: null,
      lastMessage: '',
      pillarInfoShown: false
    });
  }

  /**
   * Set pending action from LLM response (to be executed after typing)
   */
  setPendingAction(action: { type: string; target?: string } | null): void {
    console.log('[TourService] Setting pending action:', action);
    this._state.update(s => ({
      ...s,
      pendingAction: action
    }));
  }

  /**
   * Called when typing animation starts
   */
  onTypingStarted(): void {
    console.log('[TourService] Typing started');
    this._state.update(s => ({
      ...s,
      step: TourStep.TYPING
    }));
  }

  /**
   * Called when typing animation completes
   * v5.4.0: Uses ActionExecutor for organic walking
   */
  onTypingComplete(): void {
    const state = this._state();
    console.log('[TourService] Typing complete, step was:', state.step);

    // If we have a pending walk action, start walking via ActionExecutor
    if (state.pendingAction?.type === 'walk_to_pillar' && state.pendingAction.target) {
      console.log('[TourService] Executing pending walk via ActionExecutor to:', state.pendingAction.target);

      this._state.update(s => ({
        ...s,
        step: TourStep.WALKING
      }));

      // v5.4.0: Execute walk via ActionExecutor (simulates keyboard input)
      this.actionExecutor.executeAction({
        type: 'walk_to_pillar',
        target: state.pendingAction.target
      } as RobotAction);

    } else if (state.step === TourStep.TYPING) {
      // No pending action, go to wait for user
      console.log('[TourService] No pending action, waiting for user');
      this._state.update(s => ({
        ...s,
        step: TourStep.WAIT_USER
      }));
    }
  }

  /**
   * Called when robot finishes walking to pillar
   */
  onWalkComplete(): void {
    console.log('[TourService] Walk complete');
    this._state.update(s => ({
      ...s,
      step: TourStep.ENERGIZING,
      pendingAction: null
    }));
  }

  /**
   * Called when robot finishes energizing pillar (hologram appears)
   */
  onEnergizeComplete(): void {
    console.log('[TourService] Energize complete, waiting for user input');
    this._state.update(s => ({
      ...s,
      step: TourStep.WAIT_USER
    }));
  }

  /**
   * Called when user presses key to continue
   * v5.3.0: Now handles both states - before and after pillar info
   */
  onUserContinue(): void {
    const state = this._state();
    console.log('[TourService] User continued, current step:', state.step, 'pillarInfoShown:', state.pillarInfoShown);

    if (state.step !== TourStep.WAIT_USER) return;

    if (!state.pillarInfoShown) {
      // User is at pillar but hasn't seen info yet -> show pillar info
      console.log('[TourService] Moving to PILLAR_INFO');
      this._state.update(s => ({
        ...s,
        step: TourStep.PILLAR_INFO,
        pillarInfoShown: true  // Mark as shown
      }));
    } else {
      // User has seen pillar info -> advance to next pillar
      console.log('[TourService] Pillar info already shown, advancing to next pillar');
      this.advanceToNextPillar();
    }
  }

  /**
   * Called after pillar info is shown, advances to next pillar or completes
   * v5.3.0: Resets pillarInfoShown for next pillar
   */
  advanceToNextPillar(): void {
    const state = this._state();
    console.log('[TourService] Advancing from pillar', state.currentPillarIndex);

    if (state.currentPillarIndex < state.pillarSequence.length - 1) {
      // More pillars to visit
      const nextIndex = state.currentPillarIndex + 1;
      console.log('[TourService] Moving to pillar', nextIndex, ':', state.pillarSequence[nextIndex]);

      this._state.update(s => ({
        ...s,
        currentPillarIndex: nextIndex,
        step: TourStep.INTRO, // Back to intro for next pillar
        pillarInfoShown: false  // Reset for next pillar
      }));
    } else {
      // Tour complete
      console.log('[TourService] Tour complete!');
      this._state.update(s => ({
        ...s,
        step: TourStep.COMPLETE
      }));
    }
  }

  /**
   * Complete the tour and cleanup
   * v5.4.0: Unblocks user input and cleans up ActionExecutor
   */
  completeTour(): void {
    console.log('[TourService] ========== TOUR COMPLETED ==========');

    // v5.4.0: Unblock user input - user takes control again
    this.inputService.unblockFromTour();

    // v5.4.0: Cancel any pending actions
    this.actionExecutor.cancelCurrentAction();

    this._state.update(s => ({
      ...s,
      step: TourStep.COMPLETE
    }));
  }

  /**
   * Reset tour to idle state
   * v5.4.0: Also resets input blocking and ActionExecutor
   */
  reset(): void {
    console.log('[TourService] Reset');

    // v5.4.0: Ensure user has control
    this.inputService.unblockFromTour();
    this.actionExecutor.cancelCurrentAction();

    this._state.set({
      step: TourStep.IDLE,
      currentPillarIndex: 0,
      pillarSequence: [...DEFAULT_TOUR_SEQUENCE],
      pendingAction: null,
      lastMessage: '',
      pillarInfoShown: false
    });
  }

  // ==================== SPATIAL AWARENESS ====================

  /**
   * Get current robot position (world X)
   */
  getRobotPosition(): number {
    return this.physicsService.state().x;
  }

  /**
   * Get context string for LLM about robot's current position
   */
  getRobotContext(): string {
    const robotX = this.getRobotPosition();
    const nearestPillar = this.findNearestPillar(robotX);

    let context = `[POSICIÓN: x=${Math.round(robotX)}]`;

    if (nearestPillar) {
      const distance = Math.abs(robotX - PILLAR_POSITIONS[nearestPillar.id]);
      if (distance < 200) {
        context += ` [CERCA DE: ${nearestPillar.id}]`;
      }
    }

    return context;
  }

  /**
   * Find the nearest pillar to a given X position
   */
  private findNearestPillar(x: number): { id: string; distance: number } | null {
    let nearest: { id: string; distance: number } | null = null;

    for (const [id, pillarX] of Object.entries(PILLAR_POSITIONS)) {
      const distance = Math.abs(x - pillarX);
      if (!nearest || distance < nearest.distance) {
        nearest = { id, distance };
      }
    }

    return nearest;
  }

  /**
   * Get tour prompt for LLM based on current step
   */
  getTourPrompt(): string {
    const state = this._state();
    const currentPillar = state.pillarSequence[state.currentPillarIndex];
    const robotContext = this.getRobotContext();
    const isFirstPillar = state.currentPillarIndex === 0;
    const isLastPillar = state.currentPillarIndex === state.pillarSequence.length - 1;

    switch (state.step) {
      case TourStep.INTRO:
        if (isFirstPillar) {
          return `[TOUR_INTRO]${robotContext} Ya saludaste al usuario. Invítalo a seguirte al primer pilar (${currentPillar}). Sé breve y amigable. Usa walk_to_pillar con target "${currentPillar}".`;
        } else {
          return `[TOUR_NEXT]${robotContext} Invita al usuario al siguiente pilar (${currentPillar}). Di algo como "Vamos al siguiente" o "Sígueme". Usa walk_to_pillar con target "${currentPillar}".`;
        }

      case TourStep.PILLAR_INFO:
        return `[TOUR_PILLAR_INFO]${robotContext} Estás frente al pilar ${currentPillar}. Explica brevemente qué es este servicio/sección en 2 oraciones máximo. No uses acciones, solo explica.`;

      case TourStep.COMPLETE:
        return `[TOUR_END]${robotContext} El tour terminó. Despídete amablemente e invita al usuario a explorar libremente o agendar una sesión. No uses acciones.`;

      default:
        return '';
    }
  }

  /**
   * Get pillar position by ID
   */
  getPillarPosition(pillarId: string): number | undefined {
    return PILLAR_POSITIONS[pillarId];
  }
}
