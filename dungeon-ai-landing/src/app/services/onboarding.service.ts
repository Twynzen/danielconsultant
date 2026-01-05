/**
 * OnboardingService - Sendell Welcome System
 * v1.0: State machine for first-time visitor experience
 *
 * Manages:
 * - Onboarding phases (darkness → dialogs → illumination)
 * - Progressive illumination (ground → title → pillars)
 * - User choice (tour vs free exploration)
 * - LocalStorage persistence
 */

import { Injectable, signal, computed } from '@angular/core';
import {
  DialogMessage,
  PRE_SPAWN_DIALOGS,
  PRESENTATION_DIALOGS,
  CHOICE_DIALOG,
  TOUR_MODE_DIALOGS,
  FREE_MODE_DIALOGS,
  RETURN_VISITOR_DIALOG,
  ONBOARDING_TIMING,
  ONBOARDING_STORAGE_KEY
} from '../config/onboarding.config';

export enum OnboardingPhase {
  DARKNESS = 'darkness',
  PRE_SPAWN_DIALOG = 'pre-spawn',
  SPAWN_ANIMATION = 'spawn',
  PRESENTATION = 'presentation',
  CHOICE_PROMPT = 'choice',
  TOUR_MODE = 'tour',
  FREE_MODE = 'free',
  COMPLETE = 'complete'
}

export interface IlluminationLevels {
  ground: number;   // 0-1
  title: number;    // 0-1
  pillars: number;  // 0-1
}

export interface OnboardingState {
  phase: OnboardingPhase;
  isFirstVisit: boolean;
  currentDialogIndex: number;
  userChoice: 'tour' | 'free' | null;
  illumination: IlluminationLevels;
  isTyping: boolean;
  displayedText: string;
}

@Injectable({
  providedIn: 'root'
})
export class OnboardingService {
  // Internal state
  private state = signal<OnboardingState>({
    phase: OnboardingPhase.DARKNESS,
    isFirstVisit: true,
    currentDialogIndex: 0,
    userChoice: null,
    illumination: {
      ground: 0,
      title: 0,
      pillars: 0
    },
    isTyping: false,
    displayedText: ''
  });

  // Public computed signals
  readonly phase = computed(() => this.state().phase);
  readonly isFirstVisit = computed(() => this.state().isFirstVisit);
  readonly currentDialogIndex = computed(() => this.state().currentDialogIndex);
  readonly userChoice = computed(() => this.state().userChoice);
  readonly illumination = computed(() => this.state().illumination);
  readonly isTyping = computed(() => this.state().isTyping);
  readonly displayedText = computed(() => this.state().displayedText);

  // Illumination convenience signals
  readonly groundOpacity = computed(() => this.state().illumination.ground);
  readonly titleOpacity = computed(() => this.state().illumination.title);
  readonly pillarsIllumination = computed(() => this.state().illumination.pillars);

  // Visibility flags
  readonly isGroundVisible = computed(() => this.state().illumination.ground > 0);
  readonly isTitleVisible = computed(() => this.state().illumination.title > 0);
  readonly arePillarsVisible = computed(() => this.state().illumination.pillars > 0);

  // Phase checks
  readonly isOnboardingActive = computed(() =>
    this.state().phase !== OnboardingPhase.COMPLETE
  );
  readonly shouldShowCharacter = computed(() =>
    this.state().phase !== OnboardingPhase.DARKNESS &&
    this.state().phase !== OnboardingPhase.PRE_SPAWN_DIALOG
  );
  readonly isDialogCentered = computed(() =>
    this.state().phase === OnboardingPhase.PRE_SPAWN_DIALOG
  );

  // Current dialog based on phase
  readonly currentDialogs = computed((): DialogMessage[] => {
    const phase = this.state().phase;
    switch (phase) {
      case OnboardingPhase.PRE_SPAWN_DIALOG:
        return PRE_SPAWN_DIALOGS;
      case OnboardingPhase.PRESENTATION:
        return PRESENTATION_DIALOGS;
      case OnboardingPhase.CHOICE_PROMPT:
        return [CHOICE_DIALOG];
      case OnboardingPhase.TOUR_MODE:
        return TOUR_MODE_DIALOGS;
      case OnboardingPhase.FREE_MODE:
        return FREE_MODE_DIALOGS;
      default:
        return [];
    }
  });

  readonly currentDialog = computed((): DialogMessage | null => {
    const dialogs = this.currentDialogs();
    const index = this.state().currentDialogIndex;
    // Return visitor shortcut
    if (!this.state().isFirstVisit && this.state().phase === OnboardingPhase.PRE_SPAWN_DIALOG) {
      return RETURN_VISITOR_DIALOG;
    }
    return dialogs[index] ?? null;
  });

  constructor() {
    // Check first visit status on construction
    const isFirst = this.checkFirstVisit();
    this.state.update(s => ({ ...s, isFirstVisit: isFirst }));
  }

  /**
   * Start the onboarding sequence
   */
  startOnboarding(): void {
    // Start with darkness phase
    this.state.update(s => ({
      ...s,
      phase: OnboardingPhase.DARKNESS,
      currentDialogIndex: 0
    }));

    // After brief darkness, show pre-spawn dialog
    setTimeout(() => {
      this.state.update(s => ({
        ...s,
        phase: OnboardingPhase.PRE_SPAWN_DIALOG
      }));
    }, ONBOARDING_TIMING.INITIAL_DARKNESS_MS);
  }

  /**
   * Advance to next dialog or phase
   */
  advanceDialog(): void {
    const dialogs = this.currentDialogs();
    const currentIndex = this.state().currentDialogIndex;
    const phase = this.state().phase;

    // Check if return visitor
    if (!this.state().isFirstVisit) {
      this.handleReturnVisitorAdvance();
      return;
    }

    // More dialogs in current phase?
    if (currentIndex < dialogs.length - 1) {
      this.state.update(s => ({
        ...s,
        currentDialogIndex: s.currentDialogIndex + 1
      }));
    } else {
      // Advance to next phase
      this.advanceToNextPhase();
    }
  }

  /**
   * Handle return visitor flow
   */
  private handleReturnVisitorAdvance(): void {
    // Return visitor goes straight to complete with full illumination
    this.illuminateAll().then(() => {
      this.completeOnboarding();
    });
  }

  /**
   * Advance to the next phase in the sequence
   */
  private advanceToNextPhase(): void {
    const phase = this.state().phase;

    switch (phase) {
      case OnboardingPhase.PRE_SPAWN_DIALOG:
        // After pre-spawn, trigger spawn animation
        this.state.update(s => ({
          ...s,
          phase: OnboardingPhase.SPAWN_ANIMATION,
          currentDialogIndex: 0
        }));
        // Ground illuminates during spawn
        this.illuminateGround();
        break;

      case OnboardingPhase.SPAWN_ANIMATION:
        // After spawn complete, start presentation
        this.state.update(s => ({
          ...s,
          phase: OnboardingPhase.PRESENTATION,
          currentDialogIndex: 0
        }));
        break;

      case OnboardingPhase.PRESENTATION:
        // After presentation, show choice
        this.state.update(s => ({
          ...s,
          phase: OnboardingPhase.CHOICE_PROMPT,
          currentDialogIndex: 0
        }));
        break;

      case OnboardingPhase.CHOICE_PROMPT:
        // Handled by setUserChoice
        break;

      case OnboardingPhase.TOUR_MODE:
      case OnboardingPhase.FREE_MODE:
        // After tour/free dialogs, illuminate pillars and complete
        this.illuminatePillars().then(() => {
          this.completeOnboarding();
        });
        break;
    }
  }

  /**
   * Called when assembly animation completes
   */
  onAssemblyComplete(): void {
    // Small delay after assembly before presentation
    setTimeout(() => {
      this.advanceToNextPhase();
    }, ONBOARDING_TIMING.POST_ASSEMBLY_DELAY_MS);
  }

  /**
   * Set user choice from Y/N input
   */
  setUserChoice(input: string): void {
    const normalized = input.toUpperCase().trim();
    const isTour = ['Y', 'S', 'SI', 'YES'].includes(normalized);

    this.state.update(s => ({
      ...s,
      userChoice: isTour ? 'tour' : 'free',
      phase: isTour ? OnboardingPhase.TOUR_MODE : OnboardingPhase.FREE_MODE,
      currentDialogIndex: 0
    }));
  }

  /**
   * Check if input is valid for choice
   */
  isValidChoice(input: string): boolean {
    const normalized = input.toUpperCase().trim();
    return ['Y', 'N', 'S', 'SI', 'NO', 'YES'].includes(normalized);
  }

  /**
   * Trigger title illumination (called when "Daniel" is typed)
   */
  triggerTitleIllumination(): void {
    this.illuminateTitle();
  }

  // ==================== ILLUMINATION METHODS ====================

  /**
   * Illuminate ground with animation
   */
  async illuminateGround(): Promise<void> {
    return this.animateIllumination('ground', ONBOARDING_TIMING.GROUND_FADE_DURATION_MS);
  }

  /**
   * Illuminate title with animation
   */
  async illuminateTitle(): Promise<void> {
    return this.animateIllumination('title', ONBOARDING_TIMING.TITLE_FADE_DURATION_MS);
  }

  /**
   * Illuminate pillars with animation
   */
  async illuminatePillars(): Promise<void> {
    return this.animateIllumination('pillars', ONBOARDING_TIMING.PILLARS_FADE_DURATION_MS, 0.3);
  }

  /**
   * Illuminate all elements at once (for return visitors)
   */
  async illuminateAll(): Promise<void> {
    return new Promise(resolve => {
      this.state.update(s => ({
        ...s,
        illumination: {
          ground: 1,
          title: 1,
          pillars: 0.3
        }
      }));
      // Small delay for visual effect
      setTimeout(resolve, 300);
    });
  }

  /**
   * Animate illumination of a specific element
   */
  private async animateIllumination(
    element: keyof IlluminationLevels,
    duration: number,
    targetValue: number = 1
  ): Promise<void> {
    return new Promise(resolve => {
      const start = performance.now();
      const startValue = this.state().illumination[element];

      const animate = (now: number) => {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = this.easeOutCubic(progress);
        const value = startValue + (targetValue - startValue) * eased;

        this.state.update(s => ({
          ...s,
          illumination: {
            ...s.illumination,
            [element]: value
          }
        }));

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          resolve();
        }
      };

      requestAnimationFrame(animate);
    });
  }

  /**
   * Easing function for smooth animations
   */
  private easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3);
  }

  // ==================== TYPING STATE ====================

  /**
   * Set typing state
   */
  setTyping(isTyping: boolean): void {
    this.state.update(s => ({ ...s, isTyping }));
  }

  /**
   * Update displayed text during typing
   */
  setDisplayedText(text: string): void {
    this.state.update(s => ({ ...s, displayedText: text }));
  }

  // ==================== PERSISTENCE ====================

  /**
   * Check if this is the user's first visit
   */
  private checkFirstVisit(): boolean {
    return !localStorage.getItem(ONBOARDING_STORAGE_KEY);
  }

  /**
   * Mark onboarding as complete
   */
  completeOnboarding(): void {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, Date.now().toString());
    this.state.update(s => ({
      ...s,
      phase: OnboardingPhase.COMPLETE
    }));
  }

  /**
   * Reset onboarding (for testing with Ctrl+Shift+R)
   */
  resetOnboarding(): void {
    localStorage.removeItem(ONBOARDING_STORAGE_KEY);
  }

  /**
   * Skip onboarding entirely (for dev)
   */
  skipOnboarding(): void {
    this.state.update(s => ({
      ...s,
      phase: OnboardingPhase.COMPLETE,
      illumination: {
        ground: 1,
        title: 1,
        pillars: 0.3
      }
    }));
  }
}
