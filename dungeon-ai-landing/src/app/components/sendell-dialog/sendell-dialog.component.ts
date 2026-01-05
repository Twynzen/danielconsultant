/**
 * SendellDialogComponent - Centralized Dialog System
 * v1.0: Supports both centered (pre-spawn) and character-attached modes
 *
 * Features:
 * - Typewriter text animation
 * - Y/N choice input
 * - Trigger word detection for illumination
 * - Keyboard navigation (SPACE/ENTER)
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
import { CameraService } from '../../services/camera.service';
import { DialogMessage, ONBOARDING_TIMING, LOADING_CONFIG } from '../../config/onboarding.config';
import { SIDESCROLLER_CONFIG } from '../../config/sidescroller.config';

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

  // Choice input
  @ViewChild('choiceInput') choiceInputRef!: ElementRef<HTMLInputElement>;
  userInput = '';

  // Internal state
  displayedText = signal('');
  isTyping = signal(false);  // v1.1: Start false, typing starts when dialog appears
  private typingInterval: any = null;
  private currentCharIndex = 0;
  private hasTriggeredWord = false;
  private lastDialogId: string | null = null;  // v1.1: Track dialog changes

  constructor() {
    // v1.1: Effect to detect dialog changes from onboarding service
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
    });
  }

  // Computed from onboarding service or input
  readonly currentDialog = computed(() => {
    return this.dialog ?? this.onboarding.currentDialog();
  });

  readonly isVisible = computed(() => {
    const phase = this.onboarding.phase();
    // v5.1: Show during loading, welcome, and normal dialog phases
    if (phase === OnboardingPhase.LOADING || phase === OnboardingPhase.WELCOME) {
      return true;
    }
    const dialog = this.currentDialog();
    return dialog !== null && phase !== OnboardingPhase.DARKNESS && phase !== OnboardingPhase.COMPLETE;
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
    // v5.1: Don't show during loading, show during welcome
    if (this.isLoading()) return false;
    if (this.isWelcome()) return true;
    return !this.isTyping() && !this.requiresChoice();
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
  }

  /**
   * Handle keyboard input
   * v5.1: Also handles welcome phase advancement
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
   */
  advanceDialog(): void {
    this.resetTyping();
    this.onboarding.advanceDialog();
    this.dialogAdvanced.emit();
    // v1.1: Effect will automatically detect the new dialog and start typing
  }

  /**
   * Submit choice (Y/N)
   */
  submitChoice(): void {
    const input = this.userInput.trim();
    if (!input) return;

    if (this.onboarding.isValidChoice(input)) {
      this.onboarding.setUserChoice(input);
      this.choiceSubmitted.emit(input);
      this.userInput = '';
      this.resetTyping();
      // v1.1: Effect will automatically detect the new dialog and start typing
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
}
