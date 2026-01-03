import {
  Component,
  Input,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  inject,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  getBodyGrid,
  getLegFrames,
  BinaryDigit,
  DigitType,
  CHARACTER_CONFIG
} from '../../config/character-matrix.config';

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

  // Input from parent
  @Input() isMoving = false;
  @Input() isJumping = false;
  @Input() facingRight = true;

  // Character grids
  bodyGrid: BinaryDigit[][] = [];
  legsGrid: BinaryDigit[][] = [];

  // Animation states
  isBlinking = signal(false);
  glitchDigits = signal<Set<string>>(new Set());

  // Walk animation
  private walkFrames: BinaryDigit[][][] = [];
  private walkFrameIndex = 0;
  private lastWalkFrameTime = 0;

  // Animation loop
  private animationFrameId: number | null = null;
  private lastBlinkTime = 0;
  private lastGlitchTime = 0;
  private isDestroyed = false;

  // Landing effect
  private wasJumping = false;
  isLanding = signal(false);

  get characterTransform(): string {
    return this.facingRight ? 'scaleX(1)' : 'scaleX(-1)';
  }

  ngOnInit(): void {
    this.initializeCharacter();
    this.startAnimationLoop();
  }

  ngOnDestroy(): void {
    this.isDestroyed = true;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }

  private initializeCharacter(): void {
    this.bodyGrid = getBodyGrid();
    this.walkFrames = getLegFrames();
    this.legsGrid = this.walkFrames[0];
  }

  private startAnimationLoop(): void {
    const loop = (currentTime: number) => {
      if (this.isDestroyed) return;

      this.checkBlink(currentTime);

      if (this.isMoving) {
        this.applyGlitch(currentTime);
        this.updateWalkAnimation(currentTime);
      } else {
        if (this.glitchDigits().size > 0) {
          this.glitchDigits.set(new Set());
        }
        this.walkFrameIndex = 0;
        this.legsGrid = this.walkFrames[0];
      }

      this.checkLanding();

      this.cdr.markForCheck();
      this.animationFrameId = requestAnimationFrame(loop);
    };

    this.animationFrameId = requestAnimationFrame(loop);
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
      }
    }, CHARACTER_CONFIG.BLINK_DURATION);
  }

  private updateWalkAnimation(currentTime: number): void {
    const timeSinceFrame = currentTime - this.lastWalkFrameTime;

    if (timeSinceFrame > CHARACTER_CONFIG.WALK_FRAME_DURATION) {
      this.walkFrameIndex = (this.walkFrameIndex + 1) % this.walkFrames.length;
      this.legsGrid = this.walkFrames[this.walkFrameIndex];
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
   * Get display character (possibly glitched)
   */
  getDisplayChar(digit: BinaryDigit, section: string, rowIndex: number, colIndex: number): string {
    if (digit.isEmpty) {
      return '\u00A0'; // Non-breaking space
    }

    if (this.glitchDigits().has(`${section}-${rowIndex}-${colIndex}`)) {
      const glitchChars = ['0', '1', '/', '|', '-'];
      return glitchChars[Math.floor(Math.random() * glitchChars.length)];
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
