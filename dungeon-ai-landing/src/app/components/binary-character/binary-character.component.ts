import {
  Component,
  Input,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  inject,
  signal,
  HostListener,
  ElementRef,
  computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  getBodyGrid,
  getLegFrames,
  getArmFrames,
  BinaryDigit,
  DigitType,
  CHARACTER_CONFIG,
  FacingDirection
} from '../../config/character-matrix.config';

// Emotional states for the character
export enum CharacterEmotion {
  IDLE = 'idle',
  CURIOUS = 'curious',
  EXCITED = 'excited',
  TIRED = 'tired',
  STARTLED = 'startled'
}

@Component({
  selector: 'app-binary-character',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './binary-character.component.html',
  styleUrls: ['./binary-character.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BinaryCharacterComponent implements OnInit, OnDestroy {
  private cdr = inject(ChangeDetectorRef);
  private elementRef = inject(ElementRef);

  // Input from parent
  @Input() isMoving = false;
  @Input() isJumping = false;
  @Input() facingRight = true;
  @Input() isTalking = false; // v4.1: For mouth animation during dialog

  // Character grids
  bodyGrid: BinaryDigit[][] = [];
  armsGrid: BinaryDigit[][] = []; // v4.1: Separate arm grid
  legsGrid: BinaryDigit[][] = [];

  // Animation states
  isBlinking = signal(false);
  glitchDigits = signal<Set<string>>(new Set());

  // v4.1: Mouth animation
  mouthFrame = signal(0); // 0=closed, 1=open, 2=wide
  private lastMouthTime = 0;
  private readonly MOUTH_FRAME_DURATION = 80; // ms per frame

  // Walk animation
  private walkFrames: BinaryDigit[][][] = [];
  private armFrames: BinaryDigit[][][] = []; // v4.1: Arm animation frames
  private walkFrameIndex = 0;
  private lastWalkFrameTime = 0;

  // v4.1: Track previous facing for body pose changes
  private lastFacingRight = true;
  private wasMoving = false;

  // Animation loop
  private animationFrameId: number | null = null;
  private lastBlinkTime = 0;
  private lastGlitchTime = 0;
  private isDestroyed = false;

  // Landing effect
  private wasJumping = false;
  isLanding = signal(false);

  // ========== V4.0 - GIVING LIFE ==========

  // Eye tracking
  private mousePosition = { x: 0, y: 0 };
  private eyeTarget = { x: 0, y: 0 };
  eyeOffset = signal({ x: 0, y: 0 });
  private readonly EYE_MAX_RANGE = 3; // pixels
  private readonly EYE_SMOOTHING = 0.12; // LERP factor

  // Emotional state
  emotion = signal<CharacterEmotion>(CharacterEmotion.IDLE);

  // Proximity detection
  private distanceToMouse = 9999;

  // Inactivity detection
  private inactivityTimer: any = null;
  private lastMouseMoveTime = 0;
  private readonly TIRED_THRESHOLD = 5000; // 5 seconds

  // Computed emotion class for template
  emotionClass = computed(() => this.emotion());

  // v4.1: When idle, face towards mouse. When moving, face movement direction
  get characterTransform(): string {
    let shouldFaceRight = this.facingRight;

    // When idle (not moving), look towards the mouse
    if (!this.isMoving) {
      const element = this.elementRef.nativeElement as HTMLElement;
      const rect = element.getBoundingClientRect();
      const characterCenterX = rect.left + rect.width / 2;

      // Face towards mouse position
      shouldFaceRight = this.mousePosition.x > characterCenterX;
    }

    return shouldFaceRight ? 'scaleX(1)' : 'scaleX(-1)';
  }

  // Eye transform style
  getEyeTransform(): string {
    const offset = this.eyeOffset();
    // Flip X when facing left
    const x = this.facingRight ? offset.x : -offset.x;
    return `translate(${x}px, ${offset.y}px)`;
  }

  // Mouse tracking
  @HostListener('window:mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    this.mousePosition = { x: event.clientX, y: event.clientY };
    this.lastMouseMoveTime = performance.now();

    // Reset inactivity timer
    this.resetInactivityTimer();
  }

  // Click reaction
  @HostListener('click')
  onClick(): void {
    this.triggerStartled();
  }

  ngOnInit(): void {
    this.initializeCharacter();
    this.startAnimationLoop();
    this.lastMouseMoveTime = performance.now();
    this.resetInactivityTimer();
  }

  ngOnDestroy(): void {
    this.isDestroyed = true;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
    }
  }

  private initializeCharacter(): void {
    // v4.1: Always use 'right' pose - scaleX handles direction
    this.bodyGrid = getBodyGrid('right');
    this.walkFrames = getLegFrames();
    this.armFrames = getArmFrames(); // v4.1: Initialize arm frames
    this.legsGrid = this.walkFrames[0];
    this.armsGrid = this.armFrames[0]; // v4.1: Start with neutral arms
  }

  private startAnimationLoop(): void {
    const loop = (currentTime: number) => {
      if (this.isDestroyed) return;

      this.checkBlink(currentTime);

      // V4.0: Update eye tracking
      this.updateEyeTracking();

      // V4.0: Update emotion based on proximity
      this.updateEmotion(currentTime);

      // V4.1: Update body pose based on movement direction
      this.updateBodyPose();

      // V4.1: Update mouth animation during dialog
      this.updateMouthAnimation(currentTime);

      if (this.isMoving) {
        this.applyGlitch(currentTime);
        this.updateWalkAnimation(currentTime);
      } else {
        if (this.glitchDigits().size > 0) {
          this.glitchDigits.set(new Set());
        }
        this.walkFrameIndex = 0;
        this.legsGrid = this.walkFrames[0];
        this.armsGrid = this.armFrames[0]; // v4.1: Reset arms to neutral
      }

      this.checkLanding();

      // Track state for next frame
      this.wasMoving = this.isMoving;
      this.lastFacingRight = this.facingRight;

      this.cdr.markForCheck();
      this.animationFrameId = requestAnimationFrame(loop);
    };

    this.animationFrameId = requestAnimationFrame(loop);
  }

  // ========== V4.1 BODY POSE ==========

  private updateBodyPose(): void {
    // v4.1 FINAL: Always use BODY_RIGHT for the "looking sideways" effect
    // The scaleX transform handles left/right direction
    //
    // This creates the effect:
    // - Walk right: RIGHT + scaleX(1) = looks right ✓
    // - Walk left: RIGHT + scaleX(-1) = eyes flip to left ✓
    // - Idle + mouse right: RIGHT + scaleX(1) = looks right ✓
    // - Idle + mouse left: RIGHT + scaleX(-1) = eyes flip to left ✓
    //
    // The neck/head rotation effect is consistent whether walking or idle

    // Always use 'right' pose - scaleX does the direction flip
    if (!this.bodyGrid || this.bodyGrid.length === 0) {
      this.bodyGrid = getBodyGrid('right');
    }
  }

  // ========== V4.1 MOUTH ANIMATION ==========

  private updateMouthAnimation(currentTime: number): void {
    if (!this.isTalking) {
      // Reset to closed mouth when not talking
      if (this.mouthFrame() !== 0) {
        this.mouthFrame.set(0);
      }
      return;
    }

    // Animate mouth while talking
    const timeSinceMouth = currentTime - this.lastMouthTime;
    if (timeSinceMouth > this.MOUTH_FRAME_DURATION) {
      // Cycle through mouth frames: 0 -> 1 -> 2 -> 1 -> 0 -> ...
      const frames = [0, 1, 2, 1]; // closed, open, wide, open (loop)
      const currentIdx = frames.indexOf(this.mouthFrame());
      const nextIdx = (currentIdx + 1) % frames.length;
      this.mouthFrame.set(frames[nextIdx]);
      this.lastMouthTime = currentTime;
    }
  }

  // ========== V4.0 EYE TRACKING ==========

  private updateEyeTracking(): void {
    const element = this.elementRef.nativeElement as HTMLElement;
    const rect = element.getBoundingClientRect();

    // Character center (eyes are roughly at top third)
    const eyeCenterX = rect.left + rect.width / 2;
    const eyeCenterY = rect.top + rect.height * 0.25; // Eyes are near top

    // Vector to mouse
    const deltaX = this.mousePosition.x - eyeCenterX;
    const deltaY = this.mousePosition.y - eyeCenterY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    // Store distance for proximity detection
    this.distanceToMouse = distance;

    if (distance > 0) {
      // Calculate angle and target position
      const angle = Math.atan2(deltaY, deltaX);
      this.eyeTarget.x = this.EYE_MAX_RANGE * Math.cos(angle);
      this.eyeTarget.y = this.EYE_MAX_RANGE * Math.sin(angle);
    }

    // LERP to target (smooth movement)
    const current = this.eyeOffset();
    const newX = current.x + (this.eyeTarget.x - current.x) * this.EYE_SMOOTHING;
    const newY = current.y + (this.eyeTarget.y - current.y) * this.EYE_SMOOTHING;

    this.eyeOffset.set({ x: newX, y: newY });
  }

  // ========== V4.0 EMOTIONAL STATES ==========

  private updateEmotion(currentTime: number): void {
    // Don't override startled state (it auto-clears)
    if (this.emotion() === CharacterEmotion.STARTLED) return;

    // Check for tired (inactivity)
    const timeSinceMouseMove = currentTime - this.lastMouseMoveTime;
    if (timeSinceMouseMove > this.TIRED_THRESHOLD) {
      if (this.emotion() !== CharacterEmotion.TIRED) {
        this.emotion.set(CharacterEmotion.TIRED);
      }
      return;
    }

    // Proximity-based emotions
    if (this.distanceToMouse < 80) {
      this.emotion.set(CharacterEmotion.EXCITED);
    } else if (this.distanceToMouse < 200) {
      this.emotion.set(CharacterEmotion.CURIOUS);
    } else {
      this.emotion.set(CharacterEmotion.IDLE);
    }
  }

  private resetInactivityTimer(): void {
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
    }

    // Clear tired state when mouse moves
    if (this.emotion() === CharacterEmotion.TIRED) {
      this.emotion.set(CharacterEmotion.IDLE);
    }

    this.inactivityTimer = setTimeout(() => {
      if (!this.isDestroyed) {
        this.emotion.set(CharacterEmotion.TIRED);
        this.cdr.markForCheck();
      }
    }, this.TIRED_THRESHOLD);
  }

  private triggerStartled(): void {
    this.emotion.set(CharacterEmotion.STARTLED);

    // Auto-reset after flinch animation
    setTimeout(() => {
      if (!this.isDestroyed) {
        this.emotion.set(CharacterEmotion.IDLE);
        this.cdr.markForCheck();
      }
    }, 400);
  }

  private checkBlink(currentTime: number): void {
    const timeSinceBlink = currentTime - this.lastBlinkTime;
    const blinkInterval = CHARACTER_CONFIG.BLINK_INTERVAL_MIN +
      Math.random() * (CHARACTER_CONFIG.BLINK_INTERVAL_MAX - CHARACTER_CONFIG.BLINK_INTERVAL_MIN);

    if (timeSinceBlink > blinkInterval && !this.isBlinking()) {
      this.triggerBlink();
      this.lastBlinkTime = currentTime;
    }
  }

  private triggerBlink(): void {
    this.isBlinking.set(true);
    setTimeout(() => {
      if (!this.isDestroyed) {
        this.isBlinking.set(false);
        this.cdr.markForCheck();

        // V4.1: 20% chance of double blink (like humans)
        if (Math.random() < 0.2) {
          setTimeout(() => {
            if (!this.isDestroyed) {
              this.isBlinking.set(true);
              this.cdr.markForCheck();
              setTimeout(() => {
                if (!this.isDestroyed) {
                  this.isBlinking.set(false);
                  this.cdr.markForCheck();
                }
              }, CHARACTER_CONFIG.BLINK_DURATION);
            }
          }, 150); // Short pause between blinks
        }
      }
    }, CHARACTER_CONFIG.BLINK_DURATION);
  }

  private updateWalkAnimation(currentTime: number): void {
    const timeSinceFrame = currentTime - this.lastWalkFrameTime;

    if (timeSinceFrame > CHARACTER_CONFIG.WALK_FRAME_DURATION) {
      this.walkFrameIndex = (this.walkFrameIndex + 1) % this.walkFrames.length;
      this.legsGrid = this.walkFrames[this.walkFrameIndex];
      // V4.1: Arms animate in sync (opposite to legs)
      this.armsGrid = this.armFrames[this.walkFrameIndex];
      this.lastWalkFrameTime = currentTime;
    }
  }

  private checkLanding(): void {
    if (this.wasJumping && !this.isJumping) {
      this.isLanding.set(true);
      setTimeout(() => {
        if (!this.isDestroyed) {
          this.isLanding.set(false);
          this.cdr.markForCheck();
        }
      }, 250);
    }
    this.wasJumping = this.isJumping;
  }

  private applyGlitch(currentTime: number): void {
    const timeSinceGlitch = currentTime - this.lastGlitchTime;

    if (timeSinceGlitch > 100) {
      const newGlitch = new Set<string>();

      // Glitch ~5% of visible digits
      this.bodyGrid.forEach((row, ri) => {
        row.forEach((digit, ci) => {
          if (!digit.isEmpty && Math.random() < 0.05) {
            newGlitch.add(`body-${ri}-${ci}`);
          }
        });
      });

      this.legsGrid.forEach((row, ri) => {
        row.forEach((digit, ci) => {
          if (!digit.isEmpty && Math.random() < 0.08) {
            newGlitch.add(`legs-${ri}-${ci}`);
          }
        });
      });

      this.glitchDigits.set(newGlitch);
      this.lastGlitchTime = currentTime;
    }
  }

  /**
   * Get CSS classes for a digit
   */
  getDigitClasses(digit: BinaryDigit, section: string, rowIndex: number, colIndex: number): string {
    if (digit.isEmpty) {
      return 'digit empty';
    }

    const classes: string[] = ['digit', `type-${digit.type}`];

    if (digit.type === DigitType.EYE) {
      classes.push('eye');
      if (this.isBlinking()) {
        classes.push('blink');
      }
    }

    if (digit.type === DigitType.SMILE) {
      classes.push('smile');
    }

    if (this.glitchDigits().has(`${section}-${rowIndex}-${colIndex}`)) {
      classes.push('glitch');
    }

    return classes.join(' ');
  }

  /**
   * Get display character (possibly glitched or animated)
   */
  getDisplayChar(digit: BinaryDigit, section: string, rowIndex: number, colIndex: number): string {
    if (digit.isEmpty) {
      return '\u00A0'; // Non-breaking space
    }

    if (this.glitchDigits().has(`${section}-${rowIndex}-${colIndex}`)) {
      const glitchChars = ['0', '1', '/', '|', '-'];
      return glitchChars[Math.floor(Math.random() * glitchChars.length)];
    }

    // V4.1: Mouth animation - change character based on mouth frame
    if (digit.type === DigitType.SMILE) {
      const mouthChars = ['_', 'o', 'O']; // closed, open, wide
      return mouthChars[this.mouthFrame()];
    }

    return digit.char;
  }

  /**
   * Get brightness for digit type
   */
  getBrightness(digit: BinaryDigit): number {
    if (digit.isEmpty) return 0;

    const brightness = CHARACTER_CONFIG.BRIGHTNESS;
    switch (digit.type) {
      case DigitType.EYE: return brightness.EYE;
      case DigitType.SMILE: return brightness.SMILE;
      case DigitType.CORE: return brightness.CORE;
      case DigitType.LIMB: return brightness.LIMB;
      case DigitType.EDGE: return brightness.EDGE;
      default: return brightness.LIMB;
    }
  }
}
