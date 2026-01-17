import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  signal,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { PillarConfig } from '../../../config/pillar.config';

/**
 * v7.0: Mobile Robot Component
 * Simplified, compact version of the binary character for mobile
 *
 * Visual (compact 7x5 grid):
 *   01110
 *   10001
 *   11111
 *   10001
 *   10001
 */
@Component({
  selector: 'app-mobile-robot',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './mobile-robot.component.html',
  styleUrls: ['./mobile-robot.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MobileRobotComponent implements OnInit, OnDestroy {
  private cdr = inject(ChangeDetectorRef);

  @Input() isMoving = false;
  @Input() direction: 'up' | 'down' | 'idle' = 'idle';
  @Input() isEnergizing = false;
  @Input() currentFloor: PillarConfig | null = null;

  @Output() robotTapped = new EventEmitter<void>();
  @Output() robotDoubleTapped = new EventEmitter<void>();

  // Animation state
  isBlinking = signal(false);
  eyeFrame = signal(0); // 0=normal, 1=looking up, 2=looking down
  mouthFrame = signal(0); // 0=neutral, 1=smile, 2=open

  // Compact robot grid (simplified 7x5)
  robotGrid = [
    [' ', '0', '1', '1', '1', '0', ' '],  // Head top
    ['0', '1', '@', '1', '@', '1', '0'],  // Eyes
    ['0', '1', '1', '1', '1', '1', '0'],  // Face
    [' ', '0', '1', '_', '1', '0', ' '],  // Mouth
    [' ', ' ', '1', '1', '1', ' ', ' '],  // Body
  ];

  // Touch handling
  private lastTapTime = 0;
  private tapTimeout: any = null;

  // Animation loop
  private animationFrameId: number | null = null;
  private lastBlinkTime = 0;
  private isDestroyed = false;

  ngOnInit(): void {
    this.startAnimationLoop();
  }

  ngOnDestroy(): void {
    this.isDestroyed = true;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    if (this.tapTimeout) {
      clearTimeout(this.tapTimeout);
    }
  }

  private startAnimationLoop(): void {
    const loop = (currentTime: number) => {
      if (this.isDestroyed) return;

      // Blink animation
      this.checkBlink(currentTime);

      // Eye direction based on movement
      this.updateEyeDirection();

      // Mouth animation when energizing
      if (this.isEnergizing) {
        this.mouthFrame.set((Math.floor(currentTime / 100) % 3));
      } else {
        this.mouthFrame.set(0);
      }

      this.cdr.markForCheck();
      this.animationFrameId = requestAnimationFrame(loop);
    };

    this.animationFrameId = requestAnimationFrame(loop);
  }

  private checkBlink(currentTime: number): void {
    const timeSinceBlink = currentTime - this.lastBlinkTime;
    const blinkInterval = 3000 + Math.random() * 5000; // 3-8 seconds

    if (timeSinceBlink > blinkInterval && !this.isBlinking()) {
      this.isBlinking.set(true);
      this.lastBlinkTime = currentTime;

      setTimeout(() => {
        if (!this.isDestroyed) {
          this.isBlinking.set(false);
          this.cdr.markForCheck();
        }
      }, 150);
    }
  }

  private updateEyeDirection(): void {
    if (this.direction === 'up') {
      this.eyeFrame.set(1);
    } else if (this.direction === 'down') {
      this.eyeFrame.set(2);
    } else {
      this.eyeFrame.set(0);
    }
  }

  /**
   * Get character for grid cell
   */
  getChar(row: number, col: number): string {
    const char = this.robotGrid[row][col];

    // Eyes
    if (char === '@') {
      if (this.isBlinking()) return '-';
      return 'O';
    }

    // Mouth
    if (char === '_') {
      const mouths = ['_', 'o', 'O'];
      return mouths[this.mouthFrame()];
    }

    return char;
  }

  /**
   * Get CSS class for grid cell
   */
  getCellClass(row: number, col: number): string {
    const char = this.robotGrid[row][col];

    if (char === ' ') return 'cell empty';
    if (char === '@') return 'cell eye';
    if (char === '_') return 'cell mouth';
    if (char === '1') return 'cell core';
    if (char === '0') return 'cell edge';

    return 'cell';
  }

  /**
   * Handle touch/click
   */
  onTap(): void {
    const now = Date.now();

    if (now - this.lastTapTime < 300) {
      // Double tap
      if (this.tapTimeout) {
        clearTimeout(this.tapTimeout);
        this.tapTimeout = null;
      }
      this.robotDoubleTapped.emit();
    } else {
      // Single tap - wait for potential double
      this.tapTimeout = setTimeout(() => {
        this.robotTapped.emit();
        this.tapTimeout = null;
      }, 300);
    }

    this.lastTapTime = now;
  }

  /**
   * Get current floor color
   */
  getFloorColor(): string {
    return this.currentFloor?.color || '#00ff44';
  }
}
