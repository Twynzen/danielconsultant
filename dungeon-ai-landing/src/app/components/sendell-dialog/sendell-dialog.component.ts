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
// v9.0: Real-time chat via Sendell Consultant WebSocket
import { ConsultantChatService } from '../../services/consultant-chat.service';
import { getConsultantConfig } from '../../config/consultant-chat.config';
import { TourService, TourStep } from '../../services/tour.service';
// v7.0: Background loader for deferred AI downloads
import { BackgroundLoaderService } from '../../services/background-loader.service';
import { DialogMessage, ONBOARDING_TIMING, LOADING_CONFIG, FREE_MODE_DIALOGS } from '../../config/onboarding.config';
import { SIDESCROLLER_CONFIG } from '../../config/sidescroller.config';
import { SendellResponse, RobotAction, getTourFallback, getPillarDescription, TOUR_FAREWELL } from '../../config/sendell-ai.config';

@Component({
    selector: 'app-sendell-dialog',
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
  // v7.0: Background loader for deferred AI downloads
  private backgroundLoader = inject(BackgroundLoaderService);
  // v9.0: Real-time chat via Sendell Consultant
  private consultantChat = inject(ConsultantChatService);
  private consultantConnected = false;

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
  // v5.9.2: Flag to track if current message is a greeting (not LLM response)
  private _isGreetingMessage = false;
  // v6.3: Flag to track if LLM had an error (keep chat open for retry)
  private _hadChatError = false;
  // v5.9.4: Flag to track if tour was cancelled by ESC
  private _tourCancelled = false;

  // v9.0: Chat UX improvements
  /** Last user message shown above the AI response */
  lastUserMessage = signal('');
  /** Dynamic status badge: CONSULTANT / MODO SMART / CONECTANDO */
  chatStatusText = computed(() => {
    const state = this.consultantChat.connectionState();
    if (state === 'connected') return 'CONSULTANT';
    if (state === 'connecting') return 'CONECTANDO...';
    if (state === 'error') return 'MODO SMART';
    return 'MODO SMART';
  });
  /** CSS class for status badge */
  chatStatusClass = computed(() => {
    const state = this.consultantChat.connectionState();
    if (state === 'connected') return 'consultant';
    if (state === 'connecting') return 'connecting';
    return 'smart';
  });

  // v2.0: LLM info tooltip state
  showLLMInfo = signal(false);

  // v5.9: Dialog stuck detection
  private dialogStuckTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly STUCK_THRESHOLD_MS = 30000;  // 30 seconds

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

  // v7.0: Background download progress (for visual indicator)
  readonly isBackgroundDownloading = computed(() => this.backgroundLoader.isDownloading());
  readonly backgroundProgress = computed(() => this.backgroundLoader.totalProgress());
  readonly backgroundCurrentFile = computed(() => this.backgroundLoader.currentFile());
  readonly isAIFullyReady = computed(() => this.backgroundLoader.isReady());

  // v5.9.1: Computed to determine if dialog should be on LEFT of character (arrow points right)
  // This is computed based on whether the dialog would overflow the right viewport edge
  readonly isDialogOnLeft = computed(() => {
    if (this.isCentered) return false;

    const state = this.physics.state();
    const cameraX = this.camera.cameraX();
    const screenX = state.x - cameraX - this.CHARACTER_WIDTH / 2;
    const dialogLeft = screenX + this.CHARACTER_WIDTH + 20;

    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1920;
    const estimatedDialogWidth = 380;
    const margin = 20;

    // If dialog would overflow right edge, it should be on left
    return dialogLeft + estimatedDialogWidth > viewportWidth - margin;
  });

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
    // v5.9: Clean up stuck detection
    this.clearStuckDetection();
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

    // v5.9.4: ESC cancel during tour DISABLED - causes LLM corruption
    // TODO: Re-enable when LLM interrupt is properly implemented
    // if (event.code === 'Escape' && this.tourService.isActive()) {
    //   event.preventDefault();
    //   console.log('[Tour] User pressed ESC to cancel tour');
    //   this.cancelTourWithMessage();
    //   return;
    // }

    // v5.9.2: ESC key closes dialog in chat mode (emergency escape)
    if (event.code === 'Escape' && this.isChatMode()) {
      event.preventDefault();
      console.log('[Chat] ESC pressed, closing dialog');
      this.closeDialog();
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
   * v6.2: Close chat when user drags or clicks the robot
   * Called from landing-page when robot receives drag/click interaction
   * This separates drag/click from double-click (which opens chat)
   */
  public closeChatFromRobotInteraction(): void {
    // Only close if chat is actually open or has content
    if (this.isChatMode() && (this.isChatOpen() || this.displayedText())) {
      console.log('[SendellDialog] Closing chat from robot drag/click interaction');
      this.closeDialog();
    }
  }

  /**
   * v5.4.5: Open chat when user double-clicks on the robot
   * v5.5: Also restores from minimized state
   * v6.2: REMOVED toggle behavior - only opens, never closes
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

    // v6.2: REMOVED toggle behavior
    // Double-click only OPENS the chat, never closes it
    // Use closeChatFromRobotInteraction() for closing via click/drag

    // Activate chat mode if not already active
    if (!this.isChatMode()) {
      this.isChatMode.set(true);
    }

    // Open the input (if already open, this is a no-op)
    this.openChatInput();

    // v9.0: Connect to Sendell Consultant on first chat open
    if (!this.consultantConnected) {
      this.consultantConnected = true;
      const config = getConsultantConfig();
      this.consultantChat.connect(config.wsEndpoint, config.wsToken);

      // Subscribe to streaming chunks for typing effect
      this.consultantChat.streamChunk$.subscribe(chunk => {
        if (chunk.state === 'delta') {
          // v9.0: Progressive streaming — show cursor (not dots)
          const current = this.displayedText() || '';
          this.displayedText.set(current + chunk.text);
          this.isTyping.set(true);    // Show blinking cursor
          this.isAITyping.set(false); // Hide "..." dots
          this.cdr.markForCheck();
        } else if (chunk.state === 'final') {
          // Final response received — show complete text
          if (chunk.text) {
            this.displayedText.set(chunk.text);
          }
          this.isTyping.set(false);
          this.isAITyping.set(false);
          this._isLLMResponsePending = false;
          this.finishAITyping();
        }
      });
    }

    // If dialog has no text, show a greeting
    if (!this.displayedText() || this.displayedText().length === 0) {
      this._isGreetingMessage = true;  // v5.9.2: Mark as greeting (not LLM response)
      this.startAITypingAnimation('¡Hola! Soy Sendell, el asistente de Daniel. ¿Con quién tengo el gusto?');
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
   * v5.9.3: Resume input to prevent character from getting stuck
   */
  closeDialog(): void {
    // v5.9.3: Resume input in case it was paused during chat input focus
    this.inputService.resume();

    this.isChatMode.set(false);
    this.isChatOpen.set(false);
    this.isDialogMinimized.set(false);
    this.showChatInput.set(false);
    this.displayedText.set('');
    this.chatUserInput = '';
    this.hasUnsentText.set(false);
    // v5.9.2: Reset all state flags to prevent stuck states
    this._isGreetingMessage = false;
    this._isLLMResponsePending = false;
    this._hadChatError = false;  // v6.3: Reset error flag
    this.isChatResponseComplete.set(false);
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
   * v5.9: Start stuck detection after typing finishes
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

    // v5.9: Start stuck detection
    this.startStuckDetection();
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
   * v5.9.1: Dynamic positioning that never overflows viewport
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

      // v5.9.1: Calculate ideal position to the right of character
      let dialogLeft = screenX + this.CHARACTER_WIDTH + 20;
      let dialogTop = screenY + 20;

      // v5.9.1: Get viewport dimensions
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // Estimated dialog size (will be clamped by CSS, but we want smart positioning)
      const estimatedDialogWidth = 380;
      const estimatedDialogHeight = 300;
      const margin = 20;

      // v5.9.1: If dialog would overflow right edge, position to the LEFT of character
      if (dialogLeft + estimatedDialogWidth > viewportWidth - margin) {
        dialogLeft = screenX - estimatedDialogWidth - 20;
        // If that still overflows (character on left edge), clamp to viewport
        if (dialogLeft < margin) {
          dialogLeft = margin;
        }
      }

      // v5.9.1: Clamp vertical position to viewport
      if (dialogTop < margin) {
        dialogTop = margin;
      }
      if (dialogTop + estimatedDialogHeight > viewportHeight - margin) {
        dialogTop = viewportHeight - estimatedDialogHeight - margin;
      }

      return {
        position: 'fixed',
        left: `${dialogLeft}px`,
        top: `${Math.max(margin, dialogTop)}px`
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
   * v8.0: PHASE 1 - Uses predefined fallbacks directly (no LLM/AI call)
   */
  private async handleTourIntro(): Promise<void> {
    // v5.9.4: Guard - only process if tour is actually in progress
    if (!this.tourService.isActive() || this._tourCancelled) {
      console.log('[Tour] INTRO skipped - tour not active or cancelled');
      return;
    }

    // v5.4.0: Guard against duplicate/concurrent execution
    if (this._isTourStepProcessing) {
      console.log('[Tour] INTRO already processing, skipping');
      return;
    }
    this._isTourStepProcessing = true;

    const currentPillar = this.tourService.currentPillarId() || 'about-daniel';
    console.log('[Tour] ====== INTRO (SMART MODE) ======');
    console.log('[Tour] Current pillar:', currentPillar);

    // v8.0: Use predefined fallbacks directly (instant, no AI wait)
    const fallback = getTourFallback(currentPillar);
    const dialogueToShow = fallback.intro.dialogue;

    console.log('[Tour] Using fallback dialogue:', dialogueToShow);
    console.log('[Tour] Action: walk_to_pillar →', currentPillar);

    // Set pending walk action
    this.tourService.setPendingAction({ type: 'walk_to_pillar', target: currentPillar });

    // Start typing animation (TourService will be notified when done)
    this.tourService.onTypingStarted();
    this.startAITypingAnimation(dialogueToShow);

    // v5.4.0: Release processing lock
    this._isTourStepProcessing = false;
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
   * v8.0: PHASE 1 - Uses predefined fallbacks directly (no LLM/AI call)
   */
  private async handleTourPillarInfo(): Promise<void> {
    const currentPillar = this.tourService.currentPillarId() || 'about-daniel';
    console.log('[Tour] ====== PILLAR_INFO (SMART MODE) ======');
    console.log('[Tour] Current pillar:', currentPillar);

    // v5.9.4: Check if tour was cancelled
    if (!this.tourService.isActive() || this._tourCancelled) {
      console.log('[Tour] PILLAR_INFO aborted - tour cancelled');
      return;
    }

    // v8.0: Use predefined fallbacks directly (instant, no AI wait)
    const fallback = getTourFallback(currentPillar);
    const dialogueToShow = fallback.explain.dialogue;

    console.log('[Tour] Using fallback dialogue:', dialogueToShow);

    // Clear any pre-fetched data (not needed anymore)
    this.prefetchedPillarInfo = null;

    // Start typing animation immediately
    this.tourService.onTypingStarted();
    this.startAITypingAnimation(dialogueToShow);
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
   * v5.9.4: Added cancellation check
   */
  private async prefetchPillarInfo(): Promise<void> {
    // v5.9.4: Guard - only pre-fetch if tour is active
    if (!this.tourService.isActive() || this._tourCancelled) {
      console.log('[Tour] Pre-fetch skipped - tour not active or cancelled');
      return;
    }

    const currentPillar = this.tourService.currentPillarId() || 'about-daniel';
    console.log('[Tour] Pre-fetching pillar info for:', currentPillar);

    // Clear any previous pre-fetch
    this.prefetchedPillarInfo = null;

    // Build the prompt for pillar info
    const tourPrompt = this.buildPillarInfoPrompt(currentPillar);

    try {
      const response = await this.sendellAI.processUserInput(tourPrompt);

      // v5.9.4: Check if tour was cancelled during LLM request
      if (!this.tourService.isActive() || this._tourCancelled) {
        console.log('[Tour] Pre-fetch result discarded - tour cancelled');
        this.prefetchedPillarInfo = null;
        return;
      }

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
   * v5.9.3: Resume input to prevent character from getting stuck
   * v5.9.3: Initialize AI for free chat mode (same as hideDialogAfterFreeMode)
   */
  private hideDialogAfterFarewell(): void {
    console.log('[Tour] Farewell acknowledged, hiding dialog');

    // v5.9.3: Ensure input is resumed (in case chat input had focus)
    this.inputService.resume();

    // Reset farewell state
    this.isFarewellComplete.set(false);

    // Clear dialog
    this.displayedText.set('');

    // Exit chat mode to hide dialog
    this.isChatMode.set(false);
    this.isChatOpen.set(false);
    this.showChatInput.set(false);

    // v5.9.4: CRITICAL - Clear LLM history to free context window
    // Tour uses ~6+ LLM calls, filling the 4096 token context
    this.sendellAI.clearHistory();
    // v5.9.4: Cancel any pending LLM query (stops progress animation)
    this.sendellAI.cancelPendingQuery();
    console.log('[Tour] LLM history cleared for free chat mode');

    // v5.9.3: Initialize AI for free chat (same as free mode)
    // This ensures LLM is ready when user opens chat after tour
    this.aiInitialized = true;
    this.sendellAI.initialize().catch(error => {
      console.error('[Tour] AI initialization error:', error);
    });

    // v5.9.2: Reset tour service to clear step and showContinuePrompt
    // This prevents showTourContinuePrompt from being TRUE after tour ends
    this.tourService.reset();

    // Now complete onboarding (allows doble-click to reopen chat)
    this.onboarding.completeOnboarding();

    this.cdr.markForCheck();
  }

  /**
   * v5.9.4: Cancel tour when user presses ESC
   * Shows a farewell message and transitions to free mode
   */
  private cancelTourWithMessage(): void {
    console.log('[Tour] ====== TOUR CANCELLED BY USER ======');

    // v5.9.4: Mark as cancelled FIRST (prevents pending async operations from continuing)
    this._tourCancelled = true;

    // Stop any ongoing tour actions
    this.tourService.reset();
    this.inputService.unblockFromTour();

    // Clear LLM history (tour filled the context)
    this.sendellAI.clearHistory();
    // v5.9.4: Cancel any pending LLM query (stops progress animation)
    this.sendellAI.cancelPendingQuery();
    console.log('[Tour] LLM history cleared after cancel');

    // v5.9.4: Clear all tour-related state
    this._isTourStepProcessing = false;
    this._lastHandledTourStep = null;
    this._lastHandledPillarIndex = -1;
    this.prefetchedPillarInfo = null;
    this._isLLMResponsePending = false;
    this._isGreetingMessage = false;

    // Reset dialog state
    this.isFarewellComplete.set(false);
    this.isFreeModeComplete.set(false);
    this.isChatResponseComplete.set(false);
    this.isTyping.set(false);
    this.isAITyping.set(false);
    this.displayedText.set('');

    // Show cancellation message
    const cancelMessage = '¡Entendido! Paramos el tour por ahora. Puedes explorar libremente y hacer doble clic en mí si necesitas ayuda.';

    // Show the cancellation message with typing animation
    this.isChatMode.set(true);
    this.startAITypingAnimation(cancelMessage);

    // Initialize AI for free mode
    this.aiInitialized = true;
    this.sendellAI.initialize().catch(error => {
      console.error('[Tour] AI initialization error:', error);
    });

    // Complete onboarding to enable free mode
    this.onboarding.completeOnboarding();

    this.cdr.markForCheck();
  }

  /**
   * v5.8: Dismiss chat response and close/minimize dialog
   * Called when user presses any key after Sendell responds in free chat
   * v5.9.3: Resume input to prevent character from getting stuck
   */
  private dismissChatResponse(): void {
    console.log('[Chat] Dismissing chat response');

    // v5.9.3: Ensure input is resumed
    this.inputService.resume();

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
   * v5.9.3: Resume input to prevent character from getting stuck
   */
  private hideDialogAfterFreeMode(): void {
    console.log('[FreeMode] User acknowledged, hiding dialog');

    // v5.9.3: Ensure input is resumed
    this.inputService.resume();

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

    // v5.9.2: Greeting message - show input immediately, no continue prompt
    if (this._isGreetingMessage) {
      console.log('[Chat] Greeting complete, showing input');
      this._isGreetingMessage = false;  // Reset flag
      this.showChatInput.set(true);
      setTimeout(() => this.chatInputRef?.nativeElement?.focus(), 100);
      this.cdr.markForCheck();
      return;
    }

    // v5.9.4: Tour cancelled message - show continue prompt then close
    if (this._tourCancelled) {
      console.log('[Tour] Cancellation message complete');
      this._tourCancelled = false;
      this.isChatResponseComplete.set(true);  // Show "[CUALQUIER TECLA]"
      this.cdr.markForCheck();
      return;
    }

    // v6.3: If there was an error, show input immediately for retry (don't close chat)
    if (this._hadChatError) {
      console.log('[Chat] Error occurred, showing input for retry');
      this._hadChatError = false;  // Reset flag
      this._isLLMResponsePending = false;  // Clear pending flag
      this.showChatInput.set(true);
      this.isChatOpen.set(true);  // Ensure chat stays open
      setTimeout(() => this.chatInputRef?.nativeElement?.focus(), 100);
      this.cdr.markForCheck();
      return;  // Don't show "[CUALQUIER TECLA]" - keep input visible
    }

    // v9.0: After chat response, show input directly for continued conversation
    if (this.isChatMode() && !this.tourService.isActive() && this._isLLMResponsePending) {
      console.log('[Chat] Response complete, showing input for continued conversation');
      this._isLLMResponsePending = false;
      this.showChatInput.set(true);
      this.isChatOpen.set(true);
      setTimeout(() => this.chatInputRef?.nativeElement?.focus(), 100);
      this.cdr.markForCheck();
      return;
    }

    // v2.1: Fallback - show input if chat is already open
    if (this.isChatOpen()) {
      this.showChatInput.set(true);
      setTimeout(() => {
        this.chatInputRef?.nativeElement?.focus();
      }, 100);
    }
    this.cdr.markForCheck();

    // v5.9: Start stuck detection
    this.startStuckDetection();
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
   * v8.0 PHASE 1: INSTANT responses with smart keyword matching
   * No more waiting for WebLLM - responses are immediate!
   */
  async submitChat(): Promise<void> {
    const input = this.chatUserInput.trim();
    if (!input) return;

    // v9.0: Save user message for display above AI response
    this.lastUserMessage.set(input);

    // Clear input immediately
    this.chatUserInput = '';
    this.isChatOpen.set(false);  // v3.0: Reset to prevent auto-show
    this.showChatInput.set(false);

    // v5.8.1: Mark that we're expecting a response
    this._isLLMResponsePending = true;

    // v8.0: Brief processing indicator (smart responses are instant)
    this.isAITyping.set(true);
    this.displayedText.set('...');
    this.isTyping.set(false);
    this.cdr.markForCheck();

    try {
      // v9.0: Try Sendell Consultant (real AI) first, fall back to smart responses
      if (this.consultantChat.isReady()) {
        console.log('[Chat] ====== CONSULTANT MODE (WebSocket) ======');
        console.log('[Chat] User input:', input);

        // Clear display for streaming response — deltas will populate it
        this.displayedText.set('');

        // sendMessage() returns when server ACKs, response arrives via streaming
        await this.consultantChat.sendMessage(input);
        // Streaming chunks will update displayedText via the subscription above
      } else {
        // v8.0 PHASE 1: Smart responses are INSTANT - no waiting needed
        console.log('[Chat] ====== SMART RESPONSE MODE ======');
        console.log('[Chat] User input:', input);

        // Process with AI service (uses smart keyword matching)
        const response = await this.sendellAI.processUserInput(input);

        console.log('[Chat] Response received (instant)');
        console.log('[Chat] Dialogue:', response.dialogue);
        console.log('[Chat] Action:', JSON.stringify(response.actions));
        console.log('[Chat] ================================');

        // Show response with typing animation
        this.startAITypingAnimation(response.dialogue);
      }

    } catch (error) {
      console.error('Chat error:', error);
      this._hadChatError = true;

      // Fall back to smart responses if Consultant fails
      try {
        const fallback = await this.sendellAI.processUserInput(input);
        this.startAITypingAnimation(fallback.dialogue);
      } catch {
        this.startAITypingAnimation(
          'Mmm, algo salió mal. ¿Puedes intentar de nuevo?'
        );
      }
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

  // ==================== v5.9: DIALOG STUCK DETECTION ====================

  /**
   * v5.9: Start detecting if dialog gets stuck (no valid exit path)
   * Called after typing finishes to monitor for stuck states
   */
  private startStuckDetection(): void {
    this.clearStuckDetection();

    this.dialogStuckTimeout = setTimeout(() => {
      this.detectStuckDialog();
    }, this.STUCK_THRESHOLD_MS);
  }

  /**
   * v5.9: Clear the stuck detection timeout
   * Called when dialog state changes or user interacts
   */
  private clearStuckDetection(): void {
    if (this.dialogStuckTimeout) {
      clearTimeout(this.dialogStuckTimeout);
      this.dialogStuckTimeout = null;
    }
  }

  /**
   * v5.9: Analyze current dialog state and report if stuck
   * Logs detailed state info for debugging
   */
  private detectStuckDialog(): void {
    const state = {
      isVisible: this.isVisible(),
      isChatMode: this.isChatMode(),
      isTyping: this.isTyping(),
      isAITyping: this.isAITyping(),
      showTourPrompt: this.showTourContinuePrompt(),
      showChatPrompt: this.showChatContinuePrompt(),
      showContinue: this.showContinuePrompt(),
      tourStep: this.tourService.step(),
      phase: this.onboarding.phase(),
      displayedText: this.displayedText().substring(0, 50) + '...',
      isChatOpen: this.isChatOpen(),
      isDialogMinimized: this.isDialogMinimized(),
      isFarewellComplete: this.isFarewellComplete(),
      isFreeModeComplete: this.isFreeModeComplete()
    };

    // Check if there's a valid exit path
    const hasExitPath =
      state.showTourPrompt ||
      state.showChatPrompt ||
      state.showContinue ||
      !state.isVisible ||
      state.isDialogMinimized ||
      (state.isChatMode && state.isChatOpen) ||
      state.isFarewellComplete ||
      state.isFreeModeComplete;

    if (!hasExitPath && state.isVisible) {
      console.error('%c[DIALOG STUCK DETECTED]', 'color: #ff0000; font-size: 16px; font-weight: bold');
      console.log('%c30 seconds passed with no valid exit path', 'color: #ff6b6b');
      console.table(state);
      console.log('%cPossible fixes:', 'color: #ffaa00');
      console.log('- Check keyboard handler conditions');
      console.log('- Verify tour/chat state transitions');
      console.log('- Ensure isTyping/isAITyping properly reset');
    } else if (state.isVisible) {
      // Still visible but has exit path - just log for monitoring
      console.log('%c[Dialog Monitor] 30s check - exit path available', 'color: #00ff44');
    }
  }
}
