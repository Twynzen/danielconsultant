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
import { RobotAction, getPillarDescription, PILLAR_DESCRIPTIONS } from '../config/sendell-ai.config';

// Tour step states
export enum TourStep {
  IDLE = 'idle',               // Tour not active
  INTRO = 'intro',             // LLM generating intro message
  TYPING = 'typing',           // Text animation in progress
  WALKING = 'walking',         // Robot walking to pillar
  ENERGIZING = 'energizing',   // Robot entering pillar
  WAIT_USER = 'wait_user',     // Waiting for user to press key
  PILLAR_INFO = 'pillar_info', // LLM explaining current pillar
  EXITING = 'exiting',         // v5.4.2: Robot exiting pillar before walking to next
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
   * v5.9.4: Only act if tour is active
   */
  onTypingStarted(): void {
    // v5.9.4: Guard - only process if tour is actually in progress
    if (!this.isActive()) {
      console.log('[TourService] Typing started ignored - tour not active');
      return;
    }

    console.log('[TourService] Typing started');
    this._state.update(s => ({
      ...s,
      step: TourStep.TYPING
    }));
  }

  /**
   * Called when typing animation completes
   * v5.4.0: Uses ActionExecutor for organic walking
   * v5.9.4: Only act if tour is active
   */
  onTypingComplete(): void {
    // v5.9.4: Guard - only process if tour is actually in progress
    if (!this.isActive()) {
      console.log('[TourService] Typing complete ignored - tour not active');
      return;
    }

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
   * v5.9.4: Only act if tour is active (prevents free-mode walks from activating tour)
   */
  onWalkComplete(): void {
    // v5.9.4: Guard - only process if tour is actually in progress
    if (!this.isActive()) {
      console.log('[TourService] Walk complete ignored - tour not active');
      return;
    }

    console.log('[TourService] Walk complete');
    this._state.update(s => ({
      ...s,
      step: TourStep.ENERGIZING,
      pendingAction: null
    }));
  }

  /**
   * Called when robot finishes energizing pillar (hologram appears)
   * v5.9.4: Only act if tour is active
   */
  onEnergizeComplete(): void {
    // v5.9.4: Guard - only process if tour is actually in progress
    if (!this.isActive()) {
      console.log('[TourService] Energize complete ignored - tour not active');
      return;
    }

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
   * v5.4.2: Now goes to EXITING first before walking to next pillar
   */
  advanceToNextPillar(): void {
    const state = this._state();
    console.log('[TourService] Advancing from pillar', state.currentPillarIndex);

    if (state.currentPillarIndex < state.pillarSequence.length - 1) {
      // More pillars to visit - first EXIT the current pillar
      console.log('[TourService] Need to exit current pillar before walking to next');

      this._state.update(s => ({
        ...s,
        step: TourStep.EXITING
      }));

      // v5.4.2: Execute exit_pillar action via ActionExecutor
      console.log('[TourService] Executing exit_pillar action');
      this.actionExecutor.executeAction({
        type: 'exit_pillar'
      } as RobotAction);

    } else {
      // Last pillar - also need to exit before completing
      console.log('[TourService] Last pillar, exiting before completing tour');

      this._state.update(s => ({
        ...s,
        step: TourStep.EXITING
      }));

      this.actionExecutor.executeAction({
        type: 'exit_pillar'
      } as RobotAction);
    }
  }

  /**
   * v5.4.2: Called when robot finishes exiting pillar
   * Advances to next pillar's INTRO or completes the tour
   */
  onExitComplete(): void {
    const state = this._state();
    console.log('[TourService] Exit complete, current pillar index:', state.currentPillarIndex);

    if (state.currentPillarIndex < state.pillarSequence.length - 1) {
      // More pillars to visit - now advance to next and go to INTRO
      const nextIndex = state.currentPillarIndex + 1;
      console.log('[TourService] Moving to pillar', nextIndex, ':', state.pillarSequence[nextIndex]);

      this._state.update(s => ({
        ...s,
        currentPillarIndex: nextIndex,
        step: TourStep.INTRO,
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
   * v5.4.0: Now includes rich pillar context for better responses
   */
  getTourPrompt(): string {
    const state = this._state();
    const currentPillar = state.pillarSequence[state.currentPillarIndex];
    const robotContext = this.getRobotContext();
    const isFirstPillar = state.currentPillarIndex === 0;
    const isLastPillar = state.currentPillarIndex === state.pillarSequence.length - 1;

    // v5.4.0: Get pillar description for RAG context
    const pillarInfo = getPillarDescription(currentPillar);
    const pillarContext = pillarInfo
      ? `[PILAR: ${pillarInfo.name} - ${pillarInfo.shortDesc}]`
      : `[PILAR: ${currentPillar}]`;

    switch (state.step) {
      case TourStep.INTRO:
        if (isFirstPillar) {
          // v5.4.0: More explicit instruction with example
          return `[TOUR_INTRO]${robotContext}${pillarContext}
INSTRUCCIÓN: Di UNA frase invitando al usuario a seguirte. Ejemplo: "${pillarInfo?.tourIntro || '¡Sígueme!'}"
ACCIÓN REQUERIDA: walk_to_pillar con target "${currentPillar}"
HABLA EN PRIMERA PERSONA como Sendell.`;
        } else {
          return `[TOUR_NEXT]${robotContext}${pillarContext}
INSTRUCCIÓN: Invita al siguiente pilar con UNA frase. Ejemplo: "${pillarInfo?.tourIntro || '¡Vamos al siguiente!'}"
ACCIÓN REQUERIDA: walk_to_pillar con target "${currentPillar}"`;
        }

      case TourStep.PILLAR_INFO:
        // v5.4.0: Provide the explanation content for the LLM to use
        return `[TOUR_PILLAR_INFO]${robotContext}${pillarContext}
INSTRUCCIÓN: Explica este pilar en 2 oraciones. Usa esta info: "${pillarInfo?.tourExplain || 'Servicio de IA de Daniel.'}"
NO incluyas acciones. HABLA EN PRIMERA PERSONA.`;

      case TourStep.COMPLETE:
        return `[TOUR_END]${robotContext}
INSTRUCCIÓN: Despídete en 1-2 oraciones. Invita a explorar o agendar sesión.
NO incluyas acciones. HABLA EN PRIMERA PERSONA como Sendell.`;

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
