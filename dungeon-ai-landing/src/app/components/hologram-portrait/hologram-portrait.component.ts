import { Component, Input, OnInit, OnDestroy, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * HologramPortraitComponent - v4.8
 * Displays animated portrait using 30 PNG frames
 * Matrix-style hologram effect with scan lines and glow
 */
@Component({
  selector: 'app-hologram-portrait',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './hologram-portrait.component.html',
  styleUrl: './hologram-portrait.component.scss'
})
export class HologramPortraitComponent implements OnInit, OnDestroy, OnChanges {
  @Input() isVisible = false;
  @Input() color = '#00ff44';
  @Input() illumination = 0;

  private readonly FRAME_COUNT = 30;
  private readonly FRAME_RATE = 100; // 10fps = 100ms per frame
  private frames: string[] = [];
  private currentFrameIndex = 0;
  private animationInterval: ReturnType<typeof setInterval> | null = null;
  private framesPreloaded = false;

  currentFrame = '';

  ngOnInit(): void {
    this.buildFramePaths();
    this.preloadFrames();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isVisible']) {
      if (this.isVisible) {
        this.startAnimation();
      } else {
        this.stopAnimation();
      }
    }
  }

  ngOnDestroy(): void {
    this.stopAnimation();
  }

  /**
   * Build array of frame paths
   */
  private buildFramePaths(): void {
    for (let i = 1; i <= this.FRAME_COUNT; i++) {
      const num = i.toString().padStart(3, '0');
      this.frames.push(`assets/gifDaniel/yo-${num}.png`);
    }
    // Set initial frame
    this.currentFrame = this.frames[0];
  }

  /**
   * Preload all frames in background for smooth animation
   */
  private preloadFrames(): void {
    if (this.framesPreloaded) return;

    // Load first frame immediately (already set)
    // Preload rest in background
    this.frames.forEach(framePath => {
      const img = new Image();
      img.src = framePath;
    });

    this.framesPreloaded = true;
  }

  /**
   * Start frame animation loop
   */
  private startAnimation(): void {
    if (this.animationInterval) return; // Already running

    this.animationInterval = setInterval(() => {
      this.currentFrameIndex = (this.currentFrameIndex + 1) % this.FRAME_COUNT;
      this.currentFrame = this.frames[this.currentFrameIndex];
    }, this.FRAME_RATE);
  }

  /**
   * Stop frame animation
   */
  private stopAnimation(): void {
    if (this.animationInterval) {
      clearInterval(this.animationInterval);
      this.animationInterval = null;
    }
  }

  /**
   * Get CSS class based on illumination level
   */
  get stateClass(): string {
    if (this.illumination >= 0.7) return 'active';
    if (this.illumination > 0.1) return 'awakening';
    return 'dormant';
  }
}
