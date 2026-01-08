import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * HologramPortraitComponent - v6.0
 * Generic animated hologram component using PNG frames
 * Matrix-style hologram effect with scan lines and glow
 * v5.2: Added energy states for robot energization feature
 * v6.0: Made generic with configurable frame source + click support for modals
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

  // v5.2: Energy states for robot energization feature
  @Input() isLowEnergy = false;      // Robot nearby but NOT energizing (glitched/grayscale)
  @Input() isFullyEnergized = false; // Robot inside pillar (full color/stable)

  // v6.0: Configurable frame source
  @Input() frameFolder = 'gifDaniel';   // Folder in assets/
  @Input() framePrefix = 'yo';          // File prefix (e.g., 'yo' for yo-001.png)
  @Input() frameCount = 30;             // Number of frames

  // v6.0: Legend and click behavior
  @Input() showLegend = true;           // Show Daniel's legend (default for backwards compat)
  @Input() showInfoButton = false;      // Show click hint and make clickable

  // v6.0: Size control for different hologram types
  @Input() hologramWidth = 280;         // Base width in px (280 for Daniel, larger for others)

  // v6.0: Event when hologram is clicked (for opening modal)
  @Output() infoClicked = new EventEmitter<void>();

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
   * Build array of frame paths using configurable folder/prefix
   * v6.0: Now uses @Input() frameFolder, framePrefix, frameCount
   */
  private buildFramePaths(): void {
    this.frames = [];
    for (let i = 1; i <= this.frameCount; i++) {
      const num = i.toString().padStart(3, '0');
      this.frames.push(`assets/${this.frameFolder}/${this.framePrefix}-${num}.png`);
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
      this.currentFrameIndex = (this.currentFrameIndex + 1) % this.frameCount;
      this.currentFrame = this.frames[this.currentFrameIndex];
    }, this.FRAME_RATE);
  }

  /**
   * v6.0: Handle click on frame container (for opening modal)
   */
  onFrameClick(): void {
    if (this.showInfoButton) {
      this.infoClicked.emit();
    }
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
