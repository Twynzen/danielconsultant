/**
 * OnboardingService - Sendell Welcome System
 * v1.0: State machine for first-time visitor experience
 * v2.0: Integrated LLM preloading during initial loading phase
 *
 * Manages:
 * - Onboarding phases (darkness → dialogs → illumination)
 * - Progressive illumination (ground → title → pillars)
 * - User choice (tour vs free exploration)
 * - LocalStorage persistence
 * - Background LLM preloading (v2.0)
 */

import { Injectable, signal, computed, inject } from '@angular/core';
import {
  DialogMessage,
  PRE_SPAWN_DIALOGS,
  PRESENTATION_DIALOGS,
  CHOICE_DIALOG,
  TOUR_MODE_DIALOGS,
  FREE_MODE_DIALOGS,
  RETURN_VISITOR_DIALOG,
  ONBOARDING_TIMING,
  ONBOARDING_STORAGE_KEY,
  LOADING_CONFIG
} from '../config/onboarding.config';

export enum OnboardingPhase {
  DARKNESS = 'darkness',
  LOADING = 'loading',           // v5.1: Loading bar phase
  WELCOME = 'welcome',           // v5.1: Welcome message after loading
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
  loadingProgress: number;  // v5.1: 0-100 loading bar progress
}

// v2.0: Import LLM service for background preloading
import { LLMService } from './llm.service';

@Injectable({
  providedIn: 'root'
})
export class OnboardingService {
  // v2.0: LLM service for background preloading
  private llmService = inject(LLMService);

  // v2.0: LLM preloading state (separate from onboarding state)
  private _llmPreloadStarted = signal(false);
  private _llmPreloadProgress = signal(0);
  private _llmPreloadText = signal('');
  private _isWebGPUSupported = signal<boolean | null>(null); // null = not checked yet

  // v2.0: Public signals for LLM state
  readonly llmPreloadProgress = computed(() => this._llmPreloadProgress());
  readonly llmPreloadText = computed(() => this._llmPreloadText());
  readonly isLLMPreloading = computed(() =>
    this._llmPreloadStarted() && this._llmPreloadProgress() < 100
  );
  readonly isLLMReady = computed(() => this._llmPreloadProgress() >= 100);
  readonly isWebGPUSupported = computed(() => this._isWebGPUSupported());

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
    displayedText: '',
    loadingProgress: 0  // v5.1
  });

  // v5.1: Loading animation frame ID
  private loadingAnimationId: number | null = null;

  // v5.1: Talking animation state
  private talkingTimeoutId: any = null;
  private _isSendellTalking = signal(false);
  readonly isSendellTalking = computed(() => this._isSendellTalking());

  // Public computed signals
  readonly phase = computed(() => this.state().phase);
  readonly isFirstVisit = computed(() => this.state().isFirstVisit);
  readonly currentDialogIndex = computed(() => this.state().currentDialogIndex);
  readonly userChoice = computed(() => this.state().userChoice);
  readonly illumination = computed(() => this.state().illumination);
  readonly isTyping = computed(() => this.state().isTyping);
  readonly displayedText = computed(() => this.state().displayedText);
  readonly loadingProgress = computed(() => this.state().loadingProgress);  // v5.1

  // v5.1: Loading phase checks
  readonly isLoading = computed(() => this.state().phase === OnboardingPhase.LOADING);
  readonly isWelcome = computed(() => this.state().phase === OnboardingPhase.WELCOME);

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
  readonly shouldShowCharacter = computed(() => {
    const phase = this.state().phase;
    // v5.1: Don't show character during loading/welcome/pre-spawn phases
    return phase !== OnboardingPhase.DARKNESS &&
           phase !== OnboardingPhase.LOADING &&
           phase !== OnboardingPhase.WELCOME &&
           phase !== OnboardingPhase.PRE_SPAWN_DIALOG;
  });
  readonly isDialogCentered = computed(() => {
    const phase = this.state().phase;
    // v5.1: Centered for loading, welcome, and pre-spawn phases
    return phase === OnboardingPhase.LOADING ||
           phase === OnboardingPhase.WELCOME ||
           phase === OnboardingPhase.PRE_SPAWN_DIALOG;
  });

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
   * v5.1: Now goes through LOADING → WELCOME → PRE_SPAWN_DIALOG
   */
  startOnboarding(): void {
    // Start with darkness phase
    this.state.update(s => ({
      ...s,
      phase: OnboardingPhase.DARKNESS,
      currentDialogIndex: 0,
      loadingProgress: 0
    }));

    // After brief darkness, start loading bar
    setTimeout(() => {
      this.state.update(s => ({
        ...s,
        phase: OnboardingPhase.LOADING
      }));
      this.startLoadingAnimation();
    }, ONBOARDING_TIMING.INITIAL_DARKNESS_MS);
  }

  /**
   * v5.1: Animate loading bar from 0 to 100
   * v2.0: Also starts LLM preloading in background
   */
  private startLoadingAnimation(): void {
    const startTime = performance.now();
    const duration = ONBOARDING_TIMING.LOADING_DURATION_MS;

    // v2.0: Start LLM preloading in background (non-blocking)
    this.startLLMPreloading();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min((elapsed / duration) * 100, 100);

      this.state.update(s => ({
        ...s,
        loadingProgress: progress
      }));

      if (progress < 100) {
        this.loadingAnimationId = requestAnimationFrame(animate);
      } else {
        // Loading complete, show welcome
        this.loadingAnimationId = null;
        this.state.update(s => ({
          ...s,
          phase: OnboardingPhase.WELCOME
        }));
      }
    };

    this.loadingAnimationId = requestAnimationFrame(animate);
  }

  /**
   * v2.0: Start LLM preloading in background
   * This runs independently of the onboarding animation
   * The UI will use fallback responses until the LLM is ready
   */
  private async startLLMPreloading(): Promise<void> {
    if (this._llmPreloadStarted()) {
      return; // Already started
    }

    this._llmPreloadStarted.set(true);
    this._llmPreloadText.set('Verificando compatibilidad...');

    // Subscribe to LLM state changes
    this.llmService.state$.subscribe(state => {
      this._llmPreloadProgress.set(state.progress);
      this._llmPreloadText.set(state.progressText);

      if (state.status === 'unsupported') {
        this._isWebGPUSupported.set(false);
      } else if (state.status === 'ready') {
        this._isWebGPUSupported.set(true);
      }
    });

    try {
      // Start LLM initialization (runs in background, doesn't block)
      await this.llmService.initialize();
    } catch (error) {
      console.warn('LLM preloading failed, will use fallback mode:', error);
      this._isWebGPUSupported.set(false);
    }
  }

  /**
   * v5.1: Advance from welcome to pre-spawn dialog
   */
  advanceFromWelcome(): void {
    this.state.update(s => ({
      ...s,
      phase: OnboardingPhase.PRE_SPAWN_DIALOG,
      currentDialogIndex: 0
    }));
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

  // ==================== TALKING ANIMATION (v5.1) ====================

  /**
   * v5.1: Start mouth animation - called when new dialog text appears
   * Mouth animates for 2 seconds then stops
   */
  startTalking(): void {
    // Clear any existing timeout
    if (this.talkingTimeoutId) {
      clearTimeout(this.talkingTimeoutId);
    }

    // Start talking
    this._isSendellTalking.set(true);

    // Stop after 2 seconds
    this.talkingTimeoutId = setTimeout(() => {
      this._isSendellTalking.set(false);
      this.talkingTimeoutId = null;
    }, 2000);
  }

  /**
   * v5.1: Stop mouth animation immediately
   */
  stopTalking(): void {
    if (this.talkingTimeoutId) {
      clearTimeout(this.talkingTimeoutId);
      this.talkingTimeoutId = null;
    }
    this._isSendellTalking.set(false);
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
