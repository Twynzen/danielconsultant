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
import { DialogMessage, ONBOARDING_TIMING, LOADING_CONFIG, FREE_MODE_DIALOGS } from '../../config/onboarding.config';
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
  // v5.5: Minimize system
  isDialogMinimized = signal(false);  // True when dialog is minimized
  hasUnsentText = signal(false);  // True if user has text in input (for smart restore)
  private aiInitialized = false;
  private tourStarted = false;  // v3.0: Track if guided tour has started
  private _lastHandledTourStep: TourStep | null = null;  // v5.4.0: Prevent duplicate step handling
  private _lastHandledPillarIndex = -1;  // v5.4.0: Track pillar index for composite key
  private _isTourStepProcessing = false;  // v5.4.0: Guard against concurrent processing
  private lastClickTime = 0;  // v2.1: For double-click detection

  // v5.4.4: Pre-fetch pillar info during ENERGIZING animation
  private prefetchedPillarInfo: { pillarId: string; response: SendellResponse | null } | null = null;
  // v5.4.4: Track farewell completion to show continue prompt
  private isFarewellComplete = signal(false);
  // v5.5: Track FREE_MODE completion to show continue prompt
  private isFreeModeComplete = signal(false);
  // v5.8: Track when chat response is complete (waiting for user to dismiss)
  isChatResponseComplete = signal(false);
  // v5.8.1: Flag to track if we're waiting for an LLM response (not greeting)
  private _isLLMResponsePending = false;

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
        case TourStep.ENERGIZING:
          // v5.4.4: Pre-fetch pillar info while energizing animation plays
          this.prefetchPillarInfo();
          break;
        case TourStep.PILLAR_INFO:
          this.handleTourPillarInfo();
          break;
        case TourStep.COMPLETE:
          this.handleTourComplete();
          break;
        // TYPING, WALKING, WAIT_USER are handled elsewhere
      }
    }, { allowSignalWrites: true });

    // v5.5: Auto-minimize when robot moves
    // v5.5.1: DON'T minimize while Sendell is typing a response
    effect(() => {
      const velocityX = this.physics.velocityX();
      const isJumping = this.physics.isJumping();
      const isMoving = Math.abs(velocityX) > 10;  // Movement threshold

      // Never minimize while Sendell is typing or processing
      if (this.isTyping() || this.isAITyping()) {
        return;
      }

      // If chat is open and robot is moving/jumping
      if (this.isChatMode() && !this.isDialogMinimized() && (isMoving || isJumping)) {
        // Only minimize if no pending text or if jumping
        if (!this.hasUnsentText() || isJumping) {
          console.log('[SendellDialog] Auto-minimizing - robot is moving');
          this.minimizeDialog();
        }
      }
    }, { allowSignalWrites: true });

    // v5.5: Auto-restore when robot stops (if had pending text)
    effect(() => {
      const velocityX = this.physics.velocityX();
      const isJumping = this.physics.isJumping();
      const isStopped = Math.abs(velocityX) < 5 && !isJumping;

      // If minimized with pending text and robot stopped
      if (this.isDialogMinimized() && this.hasUnsentText() && isStopped) {
        console.log('[SendellDialog] Auto-restoring - had pending text');
        this.restoreDialog();
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

  // v5.5: Check if at last FREE_MODE dialog
  readonly isAtLastFreeModeDialog = computed(() => {
    const phase = this.onboarding.phase();
    const dialogIndex = this.onboarding.currentDialogIndex();
    return phase === OnboardingPhase.FREE_MODE &&
           dialogIndex >= FREE_MODE_DIALOGS.length - 1;
  });

  // v5.3.0: Show "[CUALQUIER TECLA PARA CONTINUAR]" during tour (from TourService)
  // v5.4.0: Also check that typing is not in progress
  // v5.4.4: Also show after farewell message completes
  // v5.5: Also show after FREE_MODE dialogs complete
  readonly showTourContinuePrompt = computed(() => {
    const tourStep = this.tourService.step();
    const tourWantsPrompt = this.tourService.showContinuePrompt();
    const notTyping = !this.isTyping() && !this.isAITyping();

    // v5.4.4: Also show prompt after farewell message is typed
    const isFarewellWaiting = tourStep === TourStep.COMPLETE &&
                              this.isFarewellComplete() &&
                              notTyping;

    // v5.5: Also show after FREE_MODE last dialog is typed
    const isFreeModeWaiting = this.isFreeModeComplete() && notTyping;

    return (tourWantsPrompt || isFarewellWaiting || isFreeModeWaiting) && notTyping;
  });

  // v5.8: Show "[CUALQUIER TECLA]" after chat response completes (free chat mode)
  readonly showChatContinuePrompt = computed(() => {
    return this.isChatMode() &&
           this.isChatResponseComplete() &&
           !this.isTyping() &&
           !this.isAITyping() &&
           !this.tourService.isActive();
  });

  readonly isVisible = computed(() => {
    const phase = this.onboarding.phase();

    // v2.0: Always show in chat mode
    if (this.isChatMode()) {
      return true;
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

    // v5.4.4: Farewell acknowledgment - hide dialog after tour completes
    if (this.isFarewellComplete() && this.tourService.step() === TourStep.COMPLETE) {
      event.preventDefault();
      console.log('[Tour] User acknowledged farewell, hiding dialog');
      this.hideDialogAfterFarewell();
      return;
    }

    // v5.5: FREE_MODE completion - hide dialog and complete onboarding
    if (this.isFreeModeComplete()) {
      event.preventDefault();
      console.log('[FreeMode] User acknowledged last dialog, hiding dialog');
      this.hideDialogAfterFreeMode();
      return;
    }

    // v5.8: Chat response complete - dismiss dialog on any key
    if (this.isChatResponseComplete()) {
      event.preventDefault();
      console.log('[Chat] User dismissed chat response');
      this.dismissChatResponse();
      return;
    }

    // v5.3.0: Tour WAIT_USER - any key continues the tour
    if (this.showTourContinuePrompt() && this.tourService.isActive()) {
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
   * v5.4.5: Open chat when user double-clicks on the robot
   * v5.5: Toggle behavior - also restores from minimized or closes if open
   * Called from landing-page when robot receives double-click
   */
  public openChatFromRobot(): void {
    console.log('[SendellDialog] Robot double-click - isChatMode:', this.isChatMode(), 'isMinimized:', this.isDialogMinimized(), 'isChatOpen:', this.isChatOpen());

    // v5.5: If minimized, restore
    if (this.isDialogMinimized()) {
      console.log('[SendellDialog] Restoring from minimized');
      this.restoreDialog();
      return;
    }

    // v5.5: If chat is open, close it (toggle behavior)
    if (this.isChatMode() && this.isChatOpen()) {
      console.log('[SendellDialog] Closing chat');
      this.closeDialog();
      return;
    }

    // Activate chat mode if not already active
    if (!this.isChatMode()) {
      this.isChatMode.set(true);
    }

    // Open the input
    this.openChatInput();

    // If dialog has no text, show a greeting
    if (!this.displayedText() || this.displayedText().length === 0) {
      this.startAITypingAnimation('¡Hola! ¿En qué puedo ayudarte?');
    }
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
   * v5.5: Minimize dialog (preserves state if there's text)
   * Shows minimized indicator in corner
   */
  minimizeDialog(): void {
    // Save if there's unsent text
    this.hasUnsentText.set(this.chatUserInput.trim().length > 0);

    this.isDialogMinimized.set(true);
    this.showChatInput.set(false);
    this.cdr.markForCheck();

    console.log('[SendellDialog] Dialog minimized, hasUnsentText:', this.hasUnsentText());
  }

  /**
   * v5.5: Restore dialog from minimized state
   * Re-opens input if user had unsent text
   */
  restoreDialog(): void {
    this.isDialogMinimized.set(false);

    // If had text, reopen input and focus
    if (this.hasUnsentText()) {
      this.showChatInput.set(true);
      setTimeout(() => this.chatInputRef?.nativeElement?.focus(), 100);
    }

    this.cdr.markForCheck();
    console.log('[SendellDialog] Dialog restored');
  }

  /**
   * v5.5: Close dialog completely (clears all state)
   */
  closeDialog(): void {
    this.isChatMode.set(false);
    this.isChatOpen.set(false);
    this.isDialogMinimized.set(false);
    this.showChatInput.set(false);
    this.displayedText.set('');
    this.chatUserInput = '';
    this.hasUnsentText.set(false);
    this.cdr.markForCheck();

    console.log('[SendellDialog] Dialog closed completely');
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

    // v5.5: Mark FREE_MODE complete when last dialog finishes typing
    if (this.isAtLastFreeModeDialog()) {
      console.log('[SendellDialog] FREE_MODE last dialog typed, waiting for user key');
      this.isFreeModeComplete.set(true);
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
   * v5.5: NO muestra diálogo automáticamente - espera doble-clic en robot
   * Initializes AI service in background only
   */
  private async enterChatMode(): Promise<void> {
    // v5.5: NO activar chat mode automáticamente
    // Solo preparar el sistema para cuando usuario haga doble-clic
    this.aiInitialized = true;

    // Inicializar AI en background
    this.sendellAI.initialize().catch(error => {
      console.error('AI initialization error:', error);
    });

    // v5.5: NO mostrar diálogo ni greeting
    // El diálogo se abrirá cuando usuario haga doble-clic en robot
    this.isChatMode.set(false);
    this.displayedText.set('');
    this.cdr.markForCheck();

    console.log('[SendellDialog] Chat mode ready - waiting for robot double-click');
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
   * v5.4.4: Uses pre-fetched response if available
   */
  private async handleTourPillarInfo(): Promise<void> {
    const currentPillar = this.tourService.currentPillarId() || 'about-daniel';
    console.log('[Tour] ====== PILLAR_INFO ======');
    console.log('[Tour] Current pillar:', currentPillar);

    // v5.4.4: Check if we have a pre-fetched response
    if (this.prefetchedPillarInfo &&
        this.prefetchedPillarInfo.pillarId === currentPillar &&
        this.prefetchedPillarInfo.response) {

      console.log('[Tour] Using pre-fetched pillar info');
      const response = this.prefetchedPillarInfo.response;
      this.prefetchedPillarInfo = null;  // Clear after use

      // v5.4.0: Use fallback if response is generic/third-person
      const fallback = getTourFallback(currentPillar);
      let dialogueToShow = response.dialogue;

      if (this.isResponseGeneric(dialogueToShow, 'explain')) {
        console.log('[Tour] WARNING: Pre-fetched response is generic, using fallback');
        dialogueToShow = fallback.explain.dialogue;
      }

      // Start typing animation immediately - no loading indicator needed
      this.tourService.onTypingStarted();
      this.startAITypingAnimation(dialogueToShow);
      return;
    }

    // Fallback: No pre-fetch available, make LLM request now
    console.log('[Tour] No pre-fetch available, making LLM request');
    const tourPrompt = this.buildPillarInfoPrompt(currentPillar);

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
   * v5.4.4: Delay completeOnboarding until user acknowledges farewell
   */
  private async handleTourComplete(): Promise<void> {
    console.log('[Tour] ========== TOUR COMPLETE ==========');

    // Unblock user input
    this.inputService.unblockFromTour();

    // v5.4.3: Use predefined farewell message with control instructions
    // This ensures user always gets the A/D control info
    const farewellMessage = TOUR_FAREWELL.dialogue;
    console.log('[Tour] Farewell message:', farewellMessage);

    // Start typing animation with farewell
    // v5.4.4: Don't call completeOnboarding yet - wait for user to press key
    this.startAITypingAnimation(farewellMessage);
  }

  /**
   * v5.4.4: Pre-fetch pillar info during ENERGIZING animation
   * This allows the LLM response to be ready before user asks for it
   */
  private async prefetchPillarInfo(): Promise<void> {
    const currentPillar = this.tourService.currentPillarId() || 'about-daniel';
    console.log('[Tour] Pre-fetching pillar info for:', currentPillar);

    // Clear any previous pre-fetch
    this.prefetchedPillarInfo = null;

    // Build the prompt for pillar info
    const tourPrompt = this.buildPillarInfoPrompt(currentPillar);

    try {
      const response = await this.sendellAI.processUserInput(tourPrompt);

      // Store the pre-fetched response
      this.prefetchedPillarInfo = { pillarId: currentPillar, response };
      console.log('[Tour] Pre-fetched pillar info ready for:', currentPillar);

    } catch (error) {
      console.error('[Tour] Pre-fetch error:', error);
      this.prefetchedPillarInfo = null;
    }
  }

  /**
   * v5.4.4: Build the prompt for pillar info (used by pre-fetch and fallback)
   */
  private buildPillarInfoPrompt(pillarId: string): string {
    const pillarInfo = getPillarDescription(pillarId);
    const robotContext = `[POSICIÓN: x=${Math.round(this.physics.state().x)}]`;
    const pillarContext = pillarInfo
      ? `[PILAR: ${pillarInfo.name} - ${pillarInfo.shortDesc}]`
      : `[PILAR: ${pillarId}]`;

    return `[TOUR_PILLAR_INFO]${robotContext}${pillarContext}
INSTRUCCIÓN: Explica este pilar en 2 oraciones. Usa esta info: "${pillarInfo?.tourExplain || 'Servicio de IA de Daniel.'}"
NO incluyas acciones. HABLA EN PRIMERA PERSONA.`;
  }

  /**
   * v5.4.4: Hide dialog after farewell is acknowledged
   */
  private hideDialogAfterFarewell(): void {
    console.log('[Tour] Farewell acknowledged, hiding dialog');

    // Reset farewell state
    this.isFarewellComplete.set(false);

    // Clear dialog
    this.displayedText.set('');

    // Exit chat mode to hide dialog
    this.isChatMode.set(false);
    this.isChatOpen.set(false);
    this.showChatInput.set(false);

    // Now complete onboarding (allows doble-click to reopen chat)
    this.onboarding.completeOnboarding();

    this.cdr.markForCheck();
  }

  /**
   * v5.8: Dismiss chat response and close/minimize dialog
   * Called when user presses any key after Sendell responds in free chat
   */
  private dismissChatResponse(): void {
    console.log('[Chat] Dismissing chat response');

    // Reset the response complete flag
    this.isChatResponseComplete.set(false);

    // Clear the displayed text
    this.displayedText.set('');

    // Close/minimize the chat dialog
    this.isChatMode.set(false);
    this.isChatOpen.set(false);
    this.showChatInput.set(false);

    this.cdr.markForCheck();
  }

  /**
   * v5.5: Hide dialog after FREE_MODE dialogs complete
   * Similar to farewell but for free exploration mode
   */
  private hideDialogAfterFreeMode(): void {
    console.log('[FreeMode] User acknowledged, hiding dialog');

    // Reset FREE_MODE completion state
    this.isFreeModeComplete.set(false);

    // Clear dialog
    this.displayedText.set('');

    // Initialize AI in background
    this.aiInitialized = true;
    this.sendellAI.initialize().catch(error => {
      console.error('AI initialization error:', error);
    });

    // Illuminate pillars in background
    this.onboarding.illuminatePillars();

    // Complete onboarding immediately (allows double-click to open chat)
    this.onboarding.completeOnboarding();

    this.cdr.markForCheck();
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
   * v5.4.4: Detects farewell completion to show continue prompt
   * v5.8: Shows continue prompt in free chat mode
   */
  private finishAITyping(): void {
    this.clearTypingInterval();
    this.isTyping.set(false);
    this.isAITyping.set(false);

    // v5.4.4: Check if this is the farewell message completing
    if (this.tourService.step() === TourStep.COMPLETE) {
      console.log('[Tour] Farewell typing complete, waiting for user acknowledgment');
      this.isFarewellComplete.set(true);
      this.cdr.markForCheck();
      return;  // Don't proceed to chat mode - wait for user to press key
    }

    // v5.3.0: Notify TourService when typing completes (triggers next step)
    if (this.tourService.isActive()) {
      console.log('[Tour] Typing complete, notifying TourService');
      this.tourService.onTypingComplete();
      this.cdr.markForCheck();
      return;
    }

    // v5.8.1: In free chat mode, show continue prompt ONLY after LLM response (not greeting)
    if (this.isChatMode() && !this.tourService.isActive() && this._isLLMResponsePending) {
      console.log('[Chat] LLM response complete, waiting for user to dismiss');
      this._isLLMResponsePending = false;  // Reset flag
      this.isChatResponseComplete.set(true);
      this.cdr.markForCheck();
      return;
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
   * v5.8.1: Set _isLLMResponsePending flag to show continue prompt after response
   */
  async submitChat(): Promise<void> {
    const input = this.chatUserInput.trim();
    if (!input) return;

    // Clear input immediately
    this.chatUserInput = '';
    this.isChatOpen.set(false);  // v3.0: Reset to prevent auto-show
    this.showChatInput.set(false);

    // v5.8.1: Mark that we're expecting an LLM response (not a greeting)
    this._isLLMResponsePending = true;

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
