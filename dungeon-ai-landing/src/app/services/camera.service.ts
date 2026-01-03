import { Injectable, signal, computed } from '@angular/core';
import { WORLD_CONFIG, getAreaAtPosition, AreaConfig } from '../config/world.config';

/**
 * Camera Service
 * Manages camera position and smooth following for the expanded 3x3 world
 * Uses GPU-accelerated CSS transforms via translate3d
 */
@Injectable({
  providedIn: 'root'
})
export class CameraService {
  // Camera position signals (world coordinates)
  private _cameraX = signal(0);
  private _cameraY = signal(0);

  // Target position (character position)
  private _targetX = signal(0);
  private _targetY = signal(0);

  // Current area tracking
  private _currentArea = signal<AreaConfig | null>(null);

  // Camera configuration
  private readonly LERP_FACTOR = 0.08;  // Lower = smoother, higher = snappier
  private readonly DEADZONE = 2;         // Pixels of movement before camera reacts

  // Public readonly signals
  readonly cameraX = this._cameraX.asReadonly();
  readonly cameraY = this._cameraY.asReadonly();
  readonly currentArea = this._currentArea.asReadonly();

  /**
   * CSS offset for transform: translate3d()
   * Negative values because we move the world opposite to camera
   */
  cameraOffset = computed(() => ({
    x: -this._cameraX(),
    y: -this._cameraY()
  }));

  /**
   * CSS transform string ready to apply
   */
  cameraTransform = computed(() => {
    const offset = this.cameraOffset();
    return `translate3d(${offset.x}px, ${offset.y}px, 0)`;
  });

  /**
   * Initialize camera at world center
   */
  constructor() {
    // Start camera centered in the world
    const centerX = WORLD_CONFIG.getWorldCenterX() - window.innerWidth / 2;
    const centerY = WORLD_CONFIG.getWorldCenterY() - window.innerHeight / 2;
    this._cameraX.set(centerX);
    this._cameraY.set(centerY);
  }

  /**
   * Update camera to follow target (called every frame)
   * Uses lerp for smooth following with frame-rate independence
   */
  updateCamera(targetX: number, targetY: number, deltaTime: number): void {
    this._targetX.set(targetX);
    this._targetY.set(targetY);

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const worldW = WORLD_CONFIG.getWorldWidth();
    const worldH = WORLD_CONFIG.getWorldHeight();

    // Calculate ideal camera position (center target in viewport)
    const idealX = targetX - vw / 2;
    const idealY = targetY - vh / 2;

    // Clamp to world bounds
    const clampedX = Math.max(0, Math.min(worldW - vw, idealX));
    const clampedY = Math.max(0, Math.min(worldH - vh, idealY));

    // Calculate lerp amount (frame-rate independent)
    const lerpAmount = 1 - Math.pow(1 - this.LERP_FACTOR, deltaTime * 60);

    const currentX = this._cameraX();
    const currentY = this._cameraY();

    // Calculate delta
    const dx = clampedX - currentX;
    const dy = clampedY - currentY;

    // Apply deadzone to prevent micro-jitter
    if (Math.abs(dx) > this.DEADZONE || Math.abs(dy) > this.DEADZONE) {
      this._cameraX.set(currentX + dx * lerpAmount);
      this._cameraY.set(currentY + dy * lerpAmount);
    }

    // Update current area
    const area = getAreaAtPosition(targetX, targetY);
    if (area && area.id !== this._currentArea()?.id) {
      this._currentArea.set(area);
    }
  }

  /**
   * Convert world coordinates to screen coordinates
   */
  worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    return {
      x: worldX - this._cameraX(),
      y: worldY - this._cameraY()
    };
  }

  /**
   * Convert screen coordinates to world coordinates
   */
  screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    return {
      x: screenX + this._cameraX(),
      y: screenY + this._cameraY()
    };
  }

  /**
   * Check if a world position is visible on screen
   * @param margin Extra pixels around viewport to consider "visible"
   */
  isVisible(worldX: number, worldY: number, margin: number = 100): boolean {
    const screen = this.worldToScreen(worldX, worldY);
    return screen.x > -margin &&
           screen.x < window.innerWidth + margin &&
           screen.y > -margin &&
           screen.y < window.innerHeight + margin;
  }

  /**
   * Check if camera is at world edge
   */
  isAtEdge(): { top: boolean; right: boolean; bottom: boolean; left: boolean } {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const worldW = WORLD_CONFIG.getWorldWidth();
    const worldH = WORLD_CONFIG.getWorldHeight();
    const threshold = 5;

    return {
      top: this._cameraY() <= threshold,
      right: this._cameraX() >= worldW - vw - threshold,
      bottom: this._cameraY() >= worldH - vh - threshold,
      left: this._cameraX() <= threshold
    };
  }

  /**
   * Get viewport bounds in world coordinates
   */
  getViewportBounds(): { left: number; top: number; right: number; bottom: number } {
    const x = this._cameraX();
    const y = this._cameraY();
    return {
      left: x,
      top: y,
      right: x + window.innerWidth,
      bottom: y + window.innerHeight
    };
  }

  /**
   * Instantly set camera position (no lerp)
   * Use sparingly - mainly for initialization
   */
  setCameraPosition(x: number, y: number): void {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const worldW = WORLD_CONFIG.getWorldWidth();
    const worldH = WORLD_CONFIG.getWorldHeight();

    // Clamp to bounds
    const clampedX = Math.max(0, Math.min(worldW - vw, x - vw / 2));
    const clampedY = Math.max(0, Math.min(worldH - vh, y - vh / 2));

    this._cameraX.set(clampedX);
    this._cameraY.set(clampedY);
  }

  /**
   * Get normalized camera position (0-1 range for minimap)
   */
  getNormalizedPosition(): { x: number; y: number } {
    const worldW = WORLD_CONFIG.getWorldWidth();
    const worldH = WORLD_CONFIG.getWorldHeight();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    return {
      x: this._cameraX() / (worldW - vw),
      y: this._cameraY() / (worldH - vh)
    };
  }
}
