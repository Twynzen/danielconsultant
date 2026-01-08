// src/app/services/sendell-state.service.ts
// v5.9: Central State Management & Logging for Sendell

import { Injectable, signal } from '@angular/core';

/**
 * All possible states for Sendell robot
 */
export enum SendellState {
  IDLE = 'idle',
  WALKING = 'walking',
  JUMPING = 'jumping',
  ENERGIZING = 'energizing',
  INSIDE_PILLAR = 'inside_pillar',
  EXITING_PILLAR = 'exiting_pillar',
  BEING_DRAGGED = 'being_dragged',
  CRASHING = 'crashing',
  COOLDOWN = 'cooldown',
  TYPING_RESPONSE = 'typing_response',
  WAITING_LLM = 'waiting_llm'
}

/**
 * Record of a state transition attempt
 */
export interface StateTransition {
  from: SendellState;
  to: SendellState;
  timestamp: number;
  trigger: string;
  blocked: boolean;
  reason?: string;
}

/**
 * Action validation result
 */
export interface ActionValidation {
  allowed: boolean;
  reason?: string;
}

/**
 * SendellStateService - Single source of truth for Sendell's current state
 *
 * Features:
 * - Centralized state tracking
 * - Guardrails to prevent conflicting actions
 * - Color-coded console logging
 * - State history for debugging
 */
@Injectable({ providedIn: 'root' })
export class SendellStateService {
  // Core state
  private _currentState = signal<SendellState>(SendellState.IDLE);
  private _stateHistory: StateTransition[] = [];
  private _activeActions = signal<Set<string>>(new Set());

  // Public readonly signals
  readonly currentState = this._currentState.asReadonly();
  readonly activeActions = this._activeActions.asReadonly();

  // v5.9: States that block other actions
  private readonly BLOCKING_STATES = new Set<SendellState>([
    SendellState.ENERGIZING,
    SendellState.BEING_DRAGGED,
    SendellState.CRASHING,
    SendellState.INSIDE_PILLAR,
    SendellState.EXITING_PILLAR
  ]);

  // v5.9: Valid state transitions (from -> allowed destinations)
  // Using Record for simpler TypeScript typing
  private readonly VALID_TRANSITIONS: Record<SendellState, SendellState[]> = {
    [SendellState.IDLE]: [
      SendellState.WALKING, SendellState.JUMPING, SendellState.BEING_DRAGGED,
      SendellState.ENERGIZING, SendellState.TYPING_RESPONSE, SendellState.WAITING_LLM
    ],
    [SendellState.WALKING]: [
      SendellState.IDLE, SendellState.JUMPING, SendellState.BEING_DRAGGED,
      SendellState.ENERGIZING, SendellState.CRASHING
    ],
    [SendellState.JUMPING]: [
      SendellState.IDLE, SendellState.WALKING, SendellState.CRASHING
    ],
    [SendellState.ENERGIZING]: [
      SendellState.INSIDE_PILLAR, SendellState.IDLE
    ],
    [SendellState.INSIDE_PILLAR]: [
      SendellState.EXITING_PILLAR
    ],
    [SendellState.EXITING_PILLAR]: [
      SendellState.IDLE, SendellState.WALKING
    ],
    [SendellState.BEING_DRAGGED]: [
      SendellState.IDLE, SendellState.CRASHING
    ],
    [SendellState.CRASHING]: [
      SendellState.COOLDOWN
    ],
    [SendellState.COOLDOWN]: [
      SendellState.IDLE
    ],
    [SendellState.TYPING_RESPONSE]: [
      SendellState.IDLE, SendellState.WAITING_LLM
    ],
    [SendellState.WAITING_LLM]: [
      SendellState.TYPING_RESPONSE, SendellState.IDLE
    ]
  };

  // v5.9: Incompatible action pairs that cannot run together
  private readonly INCOMPATIBLE_ACTIONS: [string, string][] = [
    ['drag', 'pillar_activate'],
    ['drag', 'walking'],
    ['drag', 'jumping'],
    ['energize', 'walking'],
    ['energize', 'drag'],
    ['crash', 'any']
  ];

  constructor() {
    console.log('%c[SendellState] v5.9 State Service initialized', 'color: #00ff44; font-weight: bold');
  }

  /**
   * Request a state transition with guardrails
   * Returns true if transition was allowed, false if blocked
   */
  requestTransition(to: SendellState, trigger: string): boolean {
    const from = this._currentState();

    // Check if transition is valid
    const canTransition = this.canTransitionTo(to);
    const reason = canTransition ? undefined : this.getBlockReason(from, to);

    const transition: StateTransition = {
      from,
      to,
      trigger,
      timestamp: performance.now(),
      blocked: !canTransition,
      reason
    };

    // Keep history bounded
    this._stateHistory.push(transition);
    if (this._stateHistory.length > 100) {
      this._stateHistory.shift();
    }

    this.logTransition(transition);

    if (canTransition) {
      this._currentState.set(to);
      return true;
    }

    return false;
  }

  /**
   * Force set state (use sparingly, bypasses guardrails)
   * For initialization or recovery scenarios
   */
  forceState(to: SendellState, reason: string): void {
    const from = this._currentState();
    console.log(
      `%c[SendellState] FORCE: ${from} → ${to} (${reason})`,
      'color: #ffaa00; font-weight: bold'
    );
    this._currentState.set(to);
  }

  /**
   * Check if an action can execute given current state
   */
  canExecuteAction(action: string): ActionValidation {
    const state = this._currentState();
    const activeActionsSet = this._activeActions();

    // Check if current state blocks all actions
    if (this.BLOCKING_STATES.has(state)) {
      return {
        allowed: false,
        reason: `Blocked by current state: ${state}`
      };
    }

    // Check incompatible action pairs
    for (const [actionA, actionB] of this.INCOMPATIBLE_ACTIONS) {
      // Check if the new action conflicts with any active action
      if (action === actionA && activeActionsSet.has(actionB)) {
        return {
          allowed: false,
          reason: `Action '${action}' incompatible with active '${actionB}'`
        };
      }
      if (action === actionB && activeActionsSet.has(actionA)) {
        return {
          allowed: false,
          reason: `Action '${action}' incompatible with active '${actionA}'`
        };
      }
      // 'any' means this action blocks everything
      if (actionB === 'any' && activeActionsSet.has(actionA)) {
        return {
          allowed: false,
          reason: `Action '${actionA}' blocks all other actions`
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Register an action as active (started)
   */
  startAction(action: string): void {
    const newSet = new Set(this._activeActions());
    newSet.add(action);
    this._activeActions.set(newSet);
    console.log(`%c[SendellState] Action START: ${action}`, 'color: #66ff66');
  }

  /**
   * Unregister an action as active (completed)
   */
  endAction(action: string): void {
    const newSet = new Set(this._activeActions());
    newSet.delete(action);
    this._activeActions.set(newSet);
    console.log(`%c[SendellState] Action END: ${action}`, 'color: #aaffaa');
  }

  /**
   * Clear all active actions (for recovery)
   */
  clearAllActions(): void {
    this._activeActions.set(new Set());
    console.log('%c[SendellState] All actions cleared', 'color: #ffaa00');
  }

  /**
   * Check if a specific transition is valid
   */
  private canTransitionTo(to: SendellState): boolean {
    const from = this._currentState();

    // Same state is always "allowed" (no-op)
    if (from === to) return true;

    const validDestinations = this.VALID_TRANSITIONS[from];
    if (!validDestinations) return false;

    return validDestinations.includes(to);
  }

  /**
   * Get human-readable reason why transition was blocked
   */
  private getBlockReason(from: SendellState, to: SendellState): string {
    if (this.BLOCKING_STATES.has(from)) {
      return `State '${from}' blocks transitions`;
    }

    const validDestinations = this.VALID_TRANSITIONS[from];
    if (!validDestinations) {
      return `No transitions defined from '${from}'`;
    }

    if (!validDestinations.includes(to)) {
      return `Cannot transition from '${from}' to '${to}'`;
    }

    return 'Unknown block reason';
  }

  /**
   * Log state transition to console with color coding
   */
  private logTransition(t: StateTransition): void {
    const icon = t.blocked ? '\u{1F6AB}' : '\u{2705}';
    const color = t.blocked ? 'color: #ff6b6b' : 'color: #00ff44';
    const blockInfo = t.blocked ? ` BLOCKED: ${t.reason}` : '';

    console.log(
      `%c[SendellState] ${icon} ${t.from} → ${t.to} (${t.trigger})${blockInfo}`,
      color
    );
  }

  /**
   * Get current state summary for debugging
   * Call from browser console: sendellState.getDebugSummary()
   */
  getDebugSummary(): void {
    console.group('%c[Sendell State Summary]', 'color: #00ff44; font-weight: bold; font-size: 14px');
    console.log('Current State:', this._currentState());
    console.log('Active Actions:', [...this._activeActions()]);
    console.log('Last 10 transitions:');
    console.table(this._stateHistory.slice(-10));
    console.groupEnd();
  }

  /**
   * Get state history for analysis
   */
  getStateHistory(): StateTransition[] {
    return [...this._stateHistory];
  }

  /**
   * Check if robot is in a "busy" state that should block new inputs
   */
  isBusy(): boolean {
    return this.BLOCKING_STATES.has(this._currentState());
  }

  /**
   * Check if robot is being dragged
   */
  isBeingDragged(): boolean {
    return this._currentState() === SendellState.BEING_DRAGGED;
  }

  /**
   * Check if robot is inside or interacting with pillar
   */
  isInPillarInteraction(): boolean {
    const state = this._currentState();
    return state === SendellState.ENERGIZING ||
           state === SendellState.INSIDE_PILLAR ||
           state === SendellState.EXITING_PILLAR;
  }
}
