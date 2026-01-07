/**
 * SendellDialogComponent - Centralized Dialog System
 * v1.0: Supports both centered (pre-spawn) and character-attached modes
 * v2.0: Added AI chat mode post-onboarding with LLM integration
 *
 * Features:
 * - Typewriter text animation
 * - Y/N choice input
 * - Trigger word detection for illumination
 * - Keyboard navigation (SPACE/ENTER)
 * - AI Chat mode with LLM (post-onboarding)
 * - LLM loading indicator with progress
 */

import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnDestroy,
  OnChanges,
  SimpleChanges,
  ElementRef,
  ViewChild,
  inject,
  signal,
  computed,
  effect,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  HostListener
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OnboardingService, OnboardingPhase } from '../../services/onboarding.service';
import { PhysicsService } from '../../core/services/physics.service';
import { InputService } from '../../core/services/input.service';
import { CameraService } from '../../services/camera.service';
import { SendellAIService } from '../../services/sendell-ai.service';
import { TourService, TourStep } from '../../services/tour.service';
import { DialogMessage, ONBOARDING_TIMING, LOADING_CONFIG } from '../../config/onboarding.config';
import { SIDESCROLLER_CONFIG } from '../../config/sidescroller.config';
import { SendellResponse, RobotAction, getTourFallback, getPillarDescription, TOUR_FAREWELL } from '../../config/sendell-ai.config';

@Component({
  selector: 'app-sendell-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sendell-dialog.component.html',
  styleUrls: ['./sendell-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SendellDialogComponent implements OnInit, OnDestroy, OnChanges {
  private onboarding = inject(OnboardingService);
  private physics = inject(PhysicsService);
  private camera = inject(CameraService);
  private cdr = inject(ChangeDetectorRef);
  // v2.0: AI Service for post-onboarding chat
  readonly sendellAI = inject(SendellAIService);
  // v5.2.3: Input service to pause movement while typing
  private inputService = inject(InputService);
  // v5.3.0: Tour service for intelligent guided tour
  private tourService = inject(TourService);

  // v1.1: Character dimensions for positioning
  private readonly CHARACTER_WIDTH = 180;
  private readonly CHARACTER_HEIGHT = 220;

  // Positioning
  @Input() isCentered = false;

  // Dialog content (optional override, otherwise uses onboarding service)
  @Input() dialog: DialogMessage | null = null;

  // Events
  @Output() dialogAdvanced = new EventEmitter<void>();
  @Output() choiceSubmitted = new EventEmitter<string>();
  @Output() triggerWordReached = new EventEmitter<string>();
  // v2.0: AI action events
  @Output() aiActionRequested = new EventEmitter<RobotAction>();

  // Choice input
  @ViewChild('choiceInput') choiceInputRef!: ElementRef<HTMLInputElement>;
  // v2.0: Chat input reference
  @ViewChild('chatInputEl') chatInputRef!: ElementRef<HTMLInputElement>;
  userInput = '';
  // v2.0: Chat input separate from choice input
  chatUserInput = '';

  // Internal state
  displayedText = signal('');
  isTyping = signal(false);  // v1.1: Start false, typing starts when dialog appears
  private typingInterval: any = null;
  private currentCharIndex = 0;
  private hasTriggeredWord = false;
  private lastDialogId: string | null = null;  // v1.1: Track dialog changes

  // v2.0: Chat mode state
  isChatMode = signal(false);  // True when onboarding is complete and chat is active
  isAITyping = signal(false);  // True when AI is generating response
  showChatInput = signal(false);  // v2.1: Only shows when user double-clicks dialog
  isChatOpen = signal(false);  // v2.1: Tracks if chat mode is actively open
  private aiInitialized = false;
  private tourStarted = false;  // v3.0: Track if guided tour has started
  private _lastHandledTourStep: TourStep | null = null;  // v5.4.0: Prevent duplicate step handling
  private _lastHandledPillarIndex = -1;  // v5.4.0: Track pillar index for composite key
  private _isTourStepProcessing = false;  // v5.4.0: Guard against concurrent processing
  private lastClickTime = 0;  // v2.1: For double-click detection
  private _hideDialogAfterFarewell = signal(false);  // v5.4.3: Hide dialog after tour farewell
  private _isFarewellTyping = false;  // v5.4.3: Track if we're typing the farewell message

  // v2.0: LLM info tooltip state
  showLLMInfo = signal(false);

  constructor() {
    // v1.1: Effect to detect dialog changes from onboarding service
    // v5.1.2: allowSignalWrites needed because resetTyping writes to signals
    effect(() => {
      const dialog = this.onboarding.currentDialog();
      const phase = this.onboarding.phase();

      // Only start typing if:
      // 1. We have a dialog
      // 2. It's a new dialog (different from last one)
      // 3. We're in a valid phase
      if (dialog && dialog.id !== this.lastDialogId &&
          phase !== OnboardingPhase.DARKNESS &&
          phase !== OnboardingPhase.COMPLETE &&
          phase !== OnboardingPhase.SPAWN_ANIMATION) {
        this.lastDialogId = dialog.id;
        this.resetTyping();
        this.startTypingAnimation(dialog);
      }
    }, { allowSignalWrites: true });

    // v2.0: Effect to detect onboarding completion and enter chat mode
    effect(() => {
      const phase = this.onboarding.phase();

      if (phase === OnboardingPhase.COMPLETE && !this.aiInitialized) {
        this.aiInitialized = true;
        this.enterChatMode();
      }
    }, { allowSignalWrites: true });

    // v3.0: Effect to handle tour phases
    effect(() => {
      const phase = this.onboarding.phase();

      // Handle TOUR_WAITING_LLM: Show waiting message with LLM progress
      if (phase === OnboardingPhase.TOUR_WAITING_LLM) {
        // v5.2.3: Clear previous text and show loading
        this.displayedText.set('Preparando tour personalizado...');
        this.isTyping.set(false);
        this.isAITyping.set(true);
        this.cdr.markForCheck();

        // Check if LLM became ready
        if (this.sendellAI.status() === 'ready' || this.sendellAI.status() === 'fallback_only') {
          this.onboarding.advanceToTourActive();
        }
      }

      // Handle TOUR_ACTIVE: Start guided tour with LLM
      if (phase === OnboardingPhase.TOUR_ACTIVE && !this.tourStarted) {
        this.tourStarted = true;
        // v5.2.3: Clear text and show loading indicator before LLM responds
        this.displayedText.set('Organizando mis circuitos');
        this.isTyping.set(false);
        this.isAITyping.set(true);
        this.cdr.markForCheck();
        this.startGuidedTour();
      }
    }, { allowSignalWrites: true });

    // v2.0: Subscribe to AI actions
    // v5.4.0: Skip during tour - TourService handles actions via pendingAction
    this.sendellAI.action$.subscribe(action => {
      if (!this.tourService.isActive()) {
        this.aiActionRequested.emit(action);
      } else {
        console.log('[SendellDialog] Skipping AI action emit during tour (handled by TourService)');
      }
    });

    // v5.3.0: Effect to handle TourService step changes
    // v5.4.0: Added guards against duplicate/concurrent processing
    effect(() => {
      const step = this.tourService.step();
      const pillarIndex = this.tourService.currentPillarIndex();

      // Skip IDLE - tour not started yet
      if (step === TourStep.IDLE) return;

      // v5.4.0: Skip if currently processing a step
      if (this._isTourStepProcessing) {
        console.log('[SendellDialog] Skipping - already processing:', step);
        return;
      }

      // v5.4.0: Create composite key for step + pillar to allow INTRO for each pillar
      const stepKey = `${step}_${pillarIndex}`;
      const lastKey = this._lastHandledTourStep ? `${this._lastHandledTourStep}_${this._lastHandledPillarIndex}` : null;

      if (stepKey === lastKey) {
        console.log('[SendellDialog] Skipping duplicate step:', stepKey);
        return;
      }

      console.log('[SendellDialog] TourStep changed to:', step, 'pillar:', pillarIndex);
      this._lastHandledTourStep = step;
      this._lastHandledPillarIndex = pillarIndex;

      switch (step) {
        case TourStep.INTRO:
          this.handleTourIntro();
          break;
        case TourStep.PILLAR_INFO:
          this.handleTourPillarInfo();
          break;
        case TourStep.COMPLETE:
          this.handleTourComplete();
          break;
        // TYPING, WALKING, ENERGIZING, WAIT_USER are handled elsewhere
      }
    }, { allowSignalWrites: true });
  }

  // Computed from onboarding service or input
  readonly currentDialog = computed(() => {
    return this.dialog ?? this.onboarding.currentDialog();
  });

  // v5.2.3: Check if onboarding is complete (for showing double-click hint)
  readonly isOnboardingComplete = computed(() => {
    return this.onboarding.phase() === OnboardingPhase.COMPLETE;
  });

  // v5.2.4: Check if tour is in progress (blocks chat input)
  readonly isTourInProgress = computed(() => {
    const phase = this.onboarding.phase();
    return phase === OnboardingPhase.TOUR_WAITING_LLM ||
           phase === OnboardingPhase.TOUR_ACTIVE;
  });

  // v5.3.0: Show "[CUALQUIER TECLA PARA CONTINUAR]" during tour (from TourService)
  // v5.4.0: Also check that typing is not in progress
  readonly showTourContinuePrompt = computed(() => {
    const tourWantsPrompt = this.tourService.showContinuePrompt();
    const notTyping = !this.isTyping() && !this.isAITyping();

    return tourWantsPrompt && notTyping;
  });

  readonly isVisible = computed(() => {
    const phase = this.onboarding.phase();

    // v5.4.3: Hide after farewell unless user opens chat
    if (this._hideDialogAfterFarewell() && !this.isChatOpen()) {
      return false;
    }

    // v2.0: Always show in chat mode (if chat is open or has content)
    if (this.isChatMode()) {
      // v5.4.3: Only show if chat is actively open or we're typing/have content
      return this.isChatOpen() || this.isTyping() || this.isAITyping() || this.showChatInput();
    }

    // Never show during these phases (except COMPLETE which is now chat mode)
    if (phase === OnboardingPhase.DARKNESS ||
        phase === OnboardingPhase.SPAWN_ANIMATION) {
      return false;
    }

    // v2.0: Don't show during COMPLETE until chat mode is active
    if (phase === OnboardingPhase.COMPLETE && !this.isChatMode()) {
      return false;
    }

    // v5.1: Always show during loading and welcome (they have their own content)
    if (phase === OnboardingPhase.LOADING || phase === OnboardingPhase.WELCOME || phase === OnboardingPhase.TOUR_WAITING_LLM || phase === OnboardingPhase.TOUR_ACTIVE) {
      return true;
    }

    // v5.1.2: Show if we have a dialog AND (typing OR has text)
    const dialog = this.currentDialog();
    const hasContent = this.displayedText().length > 0 || this.isTyping();
    return dialog !== null && hasContent;
  });

  // v5.1: Loading and welcome state
  readonly isLoading = computed(() => this.onboarding.isLoading());
  readonly isWelcome = computed(() => this.onboarding.isWelcome());
  readonly loadingProgress = computed(() => this.onboarding.loadingProgress());
  readonly loadingText = LOADING_CONFIG.TEXT;
  readonly welcomeText = LOADING_CONFIG.WELCOME_TEXT;

  readonly requiresChoice = computed(() => {
    const dialog = this.currentDialog();
    return dialog?.inputType === 'choice';
  });

  readonly showContinuePrompt = computed(() => {
    // v5.1.1: Don't show during loading or welcome (welcome has its own hint)
    if (this.isLoading()) return false;
    if (this.isWelcome()) return false;  // Welcome section has its own hint
    // v2.0: Don't show in chat mode
    if (this.isChatMode()) return false;
    return !this.isTyping() && !this.requiresChoice();
  });

  // v2.0: Computed for LLM loading state
  readonly isLLMLoading = computed(() => {
    const status = this.sendellAI.status();
    return status === 'loading_llm' || status === 'initializing';
  });

  readonly llmLoadingProgress = computed(() => this.sendellAI.llmProgress());
  readonly llmLoadingText = computed(() => this.sendellAI.llmProgressText());

  ngOnInit(): void {
    // v1.1: Effect handles automatic typing start now
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Reset typing when @Input dialog changes (for manual override)
    if (changes['dialog'] && this.dialog) {
      this.resetTyping();
      this.startTypingAnimation(this.dialog);
    }
  }

  ngOnDestroy(): void {
    this.clearTypingInterval();
  }

  /**
   * Handle keyboard input
   * v5.1: Also handles welcome phase advancement
   * v2.0: Also handles chat mode input
   * v5.3.0: Handles tour WAIT_USER state
   */
  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (!this.isVisible()) return;

    // v5.1: Loading phase - no input allowed
    if (this.isLoading()) return;

    // v5.1: Welcome phase - any key advances to pre-spawn
    if (this.isWelcome()) {
      event.preventDefault();
      this.onboarding.advanceFromWelcome();
      return;
    }

    // v5.3.0: Tour WAIT_USER - any key continues the tour
    if (this.showTourContinuePrompt()) {
      event.preventDefault();
      console.log('[Tour] User pressed key to continue');
      this.tourService.onUserContinue();
      return;
    }

    // v2.0: Chat mode - let input handle most keys
    if (this.isChatMode()) {
      // If typing (AI response), skip to end on any key except when in input
      if (this.isTyping() && document.activeElement !== this.chatInputRef?.nativeElement) {
        this.skipToEnd();
        event.preventDefault();
        return;
      }
      // Otherwise, focus chat input if not already focused
      if (this.showChatInput() && document.activeElement !== this.chatInputRef?.nativeElement) {
        setTimeout(() => {
          this.chatInputRef?.nativeElement?.focus();
        }, 0);
      }
      return;
    }

    // If currently typing, skip to end on any key
    if (this.isTyping()) {
      this.skipToEnd();
      event.preventDefault();
      return;
    }

    // If choice mode, let input handle it
    if (this.requiresChoice()) {
      // Focus input if not focused
      setTimeout(() => {
        this.choiceInputRef?.nativeElement?.focus();
      }, 0);
      return;
    }

    // v5.1: Continue on ANY key (not just SPACE/ENTER)
    event.preventDefault();
    this.advanceDialog();
  }

  /**
   * v5.1: Handle click to advance dialog
   * v2.0: Handle click in chat mode
   * v2.1: Handle double-click to open chat input
   */
  @HostListener('document:click', ['$event'])
  onClick(event: MouseEvent): void {
    if (!this.isVisible()) return;

    // Loading phase - no input allowed
    if (this.isLoading()) return;

    // Welcome phase - click advances to pre-spawn
    if (this.isWelcome()) {
      this.onboarding.advanceFromWelcome();
      return;
    }

    // v2.0: Chat mode handling
    if (this.isChatMode()) {
      // Skip typing on click
      if (this.isTyping()) {
        this.skipToEnd();
        return;
      }

      // v2.1: Check for double-click on dialog to open chat
      // Only check if chat is not already open
      if (!this.isChatOpen()) {
        const now = Date.now();
        if (now - this.lastClickTime < 400) {
          // Double-click detected - check if clicking on dialog
          this.openChatInput();
        }
        this.lastClickTime = now;
      }
      return;
    }

    // If currently typing, skip to end
    if (this.isTyping()) {
      this.skipToEnd();
      return;
    }

    // If choice mode, don't advance on click (let input handle it)
    if (this.requiresChoice()) return;

    // Advance dialog
    this.advanceDialog();
  }

  /**
   * v2.1: Open chat input (called on double-click)
   */
  openChatInput(): void {
    this.isChatOpen.set(true);
    this.showChatInput.set(true);
    this.cdr.markForCheck();

    // Focus chat input after a small delay
    setTimeout(() => {
      this.chatInputRef?.nativeElement?.focus();
    }, 100);
  }

  /**
   * v2.1: Close chat input (called when clicking outside or after sending)
   */
  closeChatInput(): void {
    this.isChatOpen.set(false);
    this.showChatInput.set(false);
    this.cdr.markForCheck();
  }

  /**
   * Start typing animation for a specific dialog
   * v1.1: Now accepts dialog parameter instead of reading from computed
   * v1.2: Added markForCheck() to ensure change detection with OnPush
   * v5.1: Triggers talking animation on robot
   */
  private startTypingAnimation(dialog: DialogMessage): void {
    if (!dialog) return;

    this.clearTypingInterval();
    this.isTyping.set(true);
    this.displayedText.set('');
    this.currentCharIndex = 0;
    this.hasTriggeredWord = false;
    this.cdr.markForCheck();

    // v5.1: Start robot mouth animation (2 seconds)
    this.onboarding.startTalking();

    this.typingInterval = setInterval(() => {
      const text = dialog.text;
      if (this.currentCharIndex < text.length) {
        this.currentCharIndex++;
        const newText = text.substring(0, this.currentCharIndex);
        this.displayedText.set(newText);
        this.cdr.markForCheck();  // v1.2: Force change detection

        // Check for trigger word
        if (dialog.triggerWord && !this.hasTriggeredWord) {
          if (newText.includes(dialog.triggerWord)) {
            this.hasTriggeredWord = true;
            this.triggerWordReached.emit(dialog.triggerWord);
            this.onboarding.triggerTitleIllumination();
          }
        }
      } else {
        this.finishTyping();
      }
    }, ONBOARDING_TIMING.TYPING_SPEED_MS);
  }

  /**
   * Skip to end of current text
   */
  private skipToEnd(): void {
    const dialog = this.currentDialog();
    if (!dialog) return;

    this.clearTypingInterval();
    this.displayedText.set(dialog.text);
    this.currentCharIndex = dialog.text.length;

    // Trigger word if we skipped past it
    if (dialog.triggerWord && !this.hasTriggeredWord) {
      this.hasTriggeredWord = true;
      this.triggerWordReached.emit(dialog.triggerWord);
      this.onboarding.triggerTitleIllumination();
    }

    this.finishTyping();
  }

  /**
   * Finish typing animation
   * v1.2: Added markForCheck() for OnPush
   */
  private finishTyping(): void {
    this.clearTypingInterval();
    this.isTyping.set(false);
    this.cdr.markForCheck();

    // Auto-focus choice input if needed
    if (this.requiresChoice()) {
      setTimeout(() => {
        this.choiceInputRef?.nativeElement?.focus();
      }, 100);
    }
  }

  /**
   * Clear typing interval
   */
  private clearTypingInterval(): void {
    if (this.typingInterval) {
      clearInterval(this.typingInterval);
      this.typingInterval = null;
    }
  }

  /**
   * Reset typing state
   */
  private resetTyping(): void {
    this.clearTypingInterval();
    this.displayedText.set('');
    this.currentCharIndex = 0;
    this.isTyping.set(true);
    this.hasTriggeredWord = false;
    this.userInput = '';
  }

  /**
   * Advance to next dialog
   * v5.1.1: DON'T call resetTyping() here - let the effect handle it
   * This prevents the empty dialog flash during transitions
   */
  advanceDialog(): void {
    // Don't reset here - keep current text visible until new dialog starts
    this.onboarding.advanceDialog();
    this.dialogAdvanced.emit();
    // Effect will automatically detect the new dialog, reset, and start typing
  }

  /**
   * Submit choice (Y/N)
   * v5.1.1: DON'T call resetTyping() - let effect handle it
   */
  submitChoice(): void {
    const input = this.userInput.trim();
    if (!input) return;

    if (this.onboarding.isValidChoice(input)) {
      this.onboarding.setUserChoice(input);
      this.choiceSubmitted.emit(input);
      this.userInput = '';
      // Don't reset here - effect will handle the transition
    } else {
      // Invalid input - shake or flash
      this.userInput = '';
    }
  }

  /**
   * Handle input keydown for choice
   */
  onChoiceKeydown(event: KeyboardEvent): void {
    if (event.code === 'Enter') {
      event.preventDefault();
      this.submitChoice();
    }
  }

  /**
   * v5.4.3: Handle tour choice via buttons
   * @param wantsTour - true for guided tour, false for free exploration
   */
  selectTourChoice(wantsTour: boolean): void {
    const choice = wantsTour ? 'Y' : 'N';
    console.log('[SendellDialog] Tour choice selected:', wantsTour ? 'TOUR' : 'FREE');
    this.onboarding.setUserChoice(choice);
    this.choiceSubmitted.emit(choice);
  }

  /**
   * Get dialog position style
   * v1.1: Now calculates character position internally using physics/camera services
   */
  getPositionStyle(): Record<string, string> {
    if (this.isCentered) {
      return {
        position: 'fixed',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)'
      };
    } else {
      // Calculate character screen position
      const state = this.physics.state();
      const cameraX = this.camera.cameraX();

      // Screen X = world X - camera offset - half character width
      const screenX = state.x - cameraX - this.CHARACTER_WIDTH / 2;
      // Screen Y = character Y position - character height
      const screenY = state.y - this.CHARACTER_HEIGHT;

      // Position dialog to the right of character
      return {
        position: 'fixed',
        left: `${screenX + this.CHARACTER_WIDTH + 20}px`,
        top: `${screenY + 20}px`
      };
    }
  }

  // ==================== v2.0: CHAT MODE METHODS ====================

  /**
   * v2.0: Enter chat mode after onboarding completes
   * Initializes AI service and shows initial greeting
   */
  private async enterChatMode(): Promise<void> {
    this.isChatMode.set(true);

    // Start AI initialization in background
    this.sendellAI.initialize().catch(error => {
      console.error('AI initialization error:', error);
    });

    // Show initial greeting with typing effect
    const greeting = '¡Listo para ayudarte! Pregúntame sobre los servicios de Daniel.';
    this.startAITypingAnimation(greeting);
  }

  /**
   * v5.3.0: Start guided tour using TourService
   * Initializes AI and starts the tour state machine
   */
  private async startGuidedTour(): Promise<void> {
    console.log('[Tour] ========== GUIDED TOUR STARTED ==========');
    console.log('[Tour] Blocking user input - Sendell takes control');

    // v5.4.0: Reset tour step tracking for fresh start
    this._lastHandledTourStep = null;
    this._lastHandledPillarIndex = -1;
    this._isTourStepProcessing = false;

    // Block ALL user input during tour
    this.inputService.blockForTour();

    // Enter chat mode
    this.isChatMode.set(true);

    // Ensure AI is initialized
    if (!this.aiInitialized) {
      this.aiInitialized = true;
      console.log('[Tour] Initializing AI service...');
      await this.sendellAI.initialize().catch(error => {
        console.error('[Tour] AI initialization error:', error);
      });
    }

    // Illuminate pillars (visual effect)
    this.onboarding.illuminatePillars();

    // Start tour via TourService (this will trigger the INTRO step)
    this.tourService.startTour();
  }

  /**
   * v5.3.0: Handle TOUR_INTRO step - LLM generates intro message
   * v5.4.0: Added processing guard to prevent duplicate execution
   */
  private async handleTourIntro(): Promise<void> {
    // v5.4.0: Guard against duplicate/concurrent execution
    if (this._isTourStepProcessing) {
      console.log('[Tour] INTRO already processing, skipping');
      return;
    }
    this._isTourStepProcessing = true;

    const tourPrompt = this.tourService.getTourPrompt();
    console.log('[Tour] ====== INTRO - LLM REQUEST ======');
    console.log('[Tour] Prompt:', tourPrompt);

    // Show loading indicator with descriptive message
    this.displayedText.set('Organizando mis circuitos');
    this.isTyping.set(false);
    this.isAITyping.set(true);
    this.cdr.markForCheck();

    try {
      const response = await this.sendellAI.processUserInput(tourPrompt);

      console.log('[Tour] ====== INTRO - LLM RESPONSE ======');
      console.log('[Tour] Dialogue:', response.dialogue);
      console.log('[Tour] Actions:', JSON.stringify(response.actions));

      // v5.4.0: Enhanced detection of bad LLM responses
      const currentPillar = this.tourService.currentPillarId() || 'about-daniel';
      const fallback = getTourFallback(currentPillar);
      let dialogueToShow = response.dialogue;

      // Detect generic, third-person, or malformed responses
      const isGenericResponse = this.isResponseGeneric(dialogueToShow, 'intro');

      if (isGenericResponse) {
        console.log('[Tour] WARNING: Generic/third-person response detected, using fallback');
        dialogueToShow = fallback.intro.dialogue;
      }

      // Store pending action (will execute after typing)
      const walkAction = response.actions.find(a => a.type === 'walk_to_pillar');
      if (walkAction && !isGenericResponse) {
        this.tourService.setPendingAction(walkAction);
      } else {
        // Use fallback action
        this.tourService.setPendingAction({ type: 'walk_to_pillar', target: currentPillar });
      }

      // Start typing animation (TourService will be notified when done)
      this.tourService.onTypingStarted();
      this.startAITypingAnimation(dialogueToShow);

    } catch (error) {
      console.error('[Tour] INTRO ERROR:', error);
      // v5.4.0: Use config fallback on error
      const currentPillar = this.tourService.currentPillarId() || 'about-daniel';
      const fallback = getTourFallback(currentPillar);
      this.tourService.setPendingAction({ type: 'walk_to_pillar', target: currentPillar });
      this.tourService.onTypingStarted();
      this.startAITypingAnimation(fallback.intro.dialogue);
    } finally {
      // v5.4.0: Release processing lock
      this._isTourStepProcessing = false;
    }
  }

  /**
   * v5.4.0: Detect if LLM response is generic, third-person, or malformed
   * This helps decide when to use predefined fallbacks instead
   */
  private isResponseGeneric(dialogue: string, context: 'intro' | 'explain'): boolean {
    const lowerDialogue = dialogue.toLowerCase();

    // Third-person references to Sendell (LLM describing instead of acting)
    const thirdPersonPatterns = [
      'sendell es',
      'sendell está',
      'el asistente',
      'un asistente',
      'este robot',
      'el robot es',
      'está diseñado para',
      'fue creado para',
      'su función es'
    ];

    // Generic/loading responses
    const genericPatterns = [
      'en qué puedo ayudarte',
      'cómo puedo ayudarte',
      'ayudarte con',
      'cargando mi inteligencia',
      'procesando',
      'un momento'
    ];

    // Check for third-person description
    for (const pattern of thirdPersonPatterns) {
      if (lowerDialogue.includes(pattern)) {
        console.log('[Tour] Detected third-person pattern:', pattern);
        return true;
      }
    }

    // Check for generic responses
    for (const pattern of genericPatterns) {
      if (lowerDialogue.includes(pattern)) {
        console.log('[Tour] Detected generic pattern:', pattern);
        return true;
      }
    }

    // Too short for meaningful content
    if (dialogue.length < 25) {
      console.log('[Tour] Response too short:', dialogue.length, 'chars');
      return true;
    }

    return false;
  }

  /**
   * v5.3.0: Handle TOUR_PILLAR_INFO step - LLM explains current pillar
   * v5.4.0: Uses enhanced fallback detection
   */
  private async handleTourPillarInfo(): Promise<void> {
    const tourPrompt = this.tourService.getTourPrompt();
    const currentPillar = this.tourService.currentPillarId() || 'about-daniel';
    console.log('[Tour] ====== PILLAR_INFO - LLM REQUEST ======');
    console.log('[Tour] Current pillar:', currentPillar);
    console.log('[Tour] Prompt:', tourPrompt);

    // Show loading indicator with descriptive message
    this.displayedText.set('Analizando pilar');
    this.isTyping.set(false);
    this.isAITyping.set(true);
    this.cdr.markForCheck();

    try {
      const response = await this.sendellAI.processUserInput(tourPrompt);

      console.log('[Tour] ====== PILLAR_INFO - LLM RESPONSE ======');
      console.log('[Tour] Dialogue:', response.dialogue);

      // v5.4.0: Use fallback if response is generic/third-person
      const fallback = getTourFallback(currentPillar);
      let dialogueToShow = response.dialogue;

      if (this.isResponseGeneric(dialogueToShow, 'explain')) {
        console.log('[Tour] WARNING: Generic/third-person response, using fallback');
        dialogueToShow = fallback.explain.dialogue;
      }

      // Start typing animation
      this.tourService.onTypingStarted();
      this.startAITypingAnimation(dialogueToShow);

    } catch (error) {
      console.error('[Tour] PILLAR_INFO ERROR:', error);
      // v5.4.0: Use config fallback on error
      const fallback = getTourFallback(currentPillar);
      this.tourService.onTypingStarted();
      this.startAITypingAnimation(fallback.explain.dialogue);
    }
  }

  /**
   * v5.3.0: Handle TOUR_COMPLETE step - farewell message and cleanup
   * v5.4.3: Now uses predefined TOUR_FAREWELL for reliable control instructions
   */
  private async handleTourComplete(): Promise<void> {
    console.log('[Tour] ========== TOUR COMPLETE ==========');

    // Unblock user input
    this.inputService.unblockFromTour();

    // v5.4.3: Use predefined farewell message with control instructions
    // This ensures user always gets the A/D control info
    const farewellMessage = TOUR_FAREWELL.dialogue;
    console.log('[Tour] Farewell message:', farewellMessage);

    // v5.4.3: Mark that we're typing the farewell (to hide dialog after)
    this._isFarewellTyping = true;

    // Start typing animation with farewell
    this.startAITypingAnimation(farewellMessage);

    // Complete the onboarding
    this.onboarding.completeOnboarding();
  }

  /**
   * v2.0: Start typing animation for AI response
   */
  private startAITypingAnimation(text: string): void {
    this.clearTypingInterval();
    this.isTyping.set(true);
    this.isAITyping.set(true);
    this.showChatInput.set(false);
    this.displayedText.set('');
    this.currentCharIndex = 0;
    this.cdr.markForCheck();

    // Start robot mouth animation
    this.onboarding.startTalking();

    this.typingInterval = setInterval(() => {
      if (this.currentCharIndex < text.length) {
        this.currentCharIndex++;
        this.displayedText.set(text.substring(0, this.currentCharIndex));
        this.cdr.markForCheck();
      } else {
        this.finishAITyping();
      }
    }, ONBOARDING_TIMING.TYPING_SPEED_MS);
  }

  /**
   * v2.0: Finish AI typing
   * v2.1: No longer auto-shows input - user must double-click to chat
   * v5.3.0: Notifies TourService when typing completes
   * v5.4.3: Hides dialog after farewell message completes
   */
  private finishAITyping(): void {
    this.clearTypingInterval();
    this.isTyping.set(false);
    this.isAITyping.set(false);

    // v5.4.3: If this was the farewell, hide dialog after a delay
    if (this._isFarewellTyping) {
      this._isFarewellTyping = false;
      console.log('[Tour] Farewell complete, will hide dialog in 3 seconds');
      setTimeout(() => {
        this._hideDialogAfterFarewell.set(true);
        this.displayedText.set(''); // Clear the text
        this.cdr.markForCheck();
        console.log('[Tour] Dialog hidden after farewell');
      }, 3000); // Give user 3 seconds to read the farewell
      return; // Don't notify TourService for farewell (tour is already complete)
    }

    // v5.3.0: Notify TourService when typing completes (triggers next step)
    if (this.tourService.isActive()) {
      console.log('[Tour] Typing complete, notifying TourService');
      this.tourService.onTypingComplete();
    }

    // v2.1: Don't auto-show input - only show if chat is already open
    if (this.isChatOpen()) {
      this.showChatInput.set(true);
      // Focus chat input after a small delay
      setTimeout(() => {
        this.chatInputRef?.nativeElement?.focus();
      }, 100);
    }
    this.cdr.markForCheck();
  }

  /**
   * v2.0: Skip AI typing animation to end
   */
  private skipAIToEnd(text: string): void {
    this.clearTypingInterval();
    this.displayedText.set(text);
    this.currentCharIndex = text.length;
    this.finishAITyping();
  }

  /**
   * v2.0: Submit chat message to AI
   */
  async submitChat(): Promise<void> {
    const input = this.chatUserInput.trim();
    if (!input) return;

    // Clear input immediately
    this.chatUserInput = '';
    this.isChatOpen.set(false);  // v3.0: Reset to prevent auto-show
    this.showChatInput.set(false);

    // Show processing state with descriptive message
    this.isAITyping.set(true);
    this.displayedText.set('Procesando consulta');
    this.isTyping.set(false);
    this.cdr.markForCheck();

    try {
      // Process with AI service
      const response = await this.sendellAI.processUserInput(input);

      // Show response with typing animation
      this.startAITypingAnimation(response.dialogue);

    } catch (error) {
      console.error('Chat error:', error);
      this.startAITypingAnimation('Disculpa, hubo un error. ¿Puedes repetir?');
    }
  }

  /**
   * v2.0: Handle chat input keydown
   */
  onChatKeydown(event: KeyboardEvent): void {
    if (event.code === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.submitChat();
    }
  }

  /**
   * v2.0: Handle chat input click (prevent propagation)
   */
  onChatInputClick(event: MouseEvent): void {
    event.stopPropagation();
  }

  /**
   * v5.2.3: Pause robot movement when user focuses on input
   */
  onInputFocus(): void {
    this.inputService.pause();
  }

  /**
   * v5.2.3: Resume robot movement when user leaves input
   */
  onInputBlur(): void {
    this.inputService.resume();
  }

  /**
   * v2.0: Toggle LLM info tooltip visibility
   */
  toggleLLMInfo(): void {
    this.showLLMInfo.update(v => !v);
  }
}
