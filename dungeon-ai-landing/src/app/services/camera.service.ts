import { Injectable, signal, computed } from '@angular/core';
import { SIDESCROLLER_CONFIG } from '../config/sidescroller.config';

/**
 * Camera Service - Side-Scroller Mode
 * Horizontal-only scrolling with look-ahead and world wrapping
 * Y is fixed (no vertical scroll)
 */
@Injectable({
  providedIn: 'root'
})
export class CameraService {
  // Camera position (only X matters for side-scroller)
  private _cameraX = signal(0);

  // Target position
  private _targetX = signal(0);

  // Player velocity for look-ahead
  private _velocityX = signal(0);

  // Public readonly signals
  readonly cameraX = this._cameraX.asReadonly();

  /**
   * CSS offset for transform: translate3d()
   * Only horizontal offset, Y is always 0
   */
  cameraOffset = computed(() => ({
    x: -this._cameraX(),
    y: 0  // Fixed Y - no vertical scroll
  }));

  /**
   * CSS transform string ready to apply
   */
  cameraTransform = computed(() => {
    const offset = this.cameraOffset();
    return `translate3d(${offset.x}px, ${offset.y}px, 0)`;
  });

  constructor() {
    // Start camera at beginning of level
    this._cameraX.set(0);
  }

  /**
   * Update camera to follow target with look-ahead
   * @param targetX Player X position in world coords
   * @param velocityX Player horizontal velocity (for look-ahead)
   * @param deltaTime Time since last frame
   */
  updateCamera(targetX: number, velocityX: number, deltaTime: number): void {
    this._targetX.set(targetX);
    this._velocityX.set(velocityX);

    const vw = window.innerWidth;
    const levelWidth = SIDESCROLLER_CONFIG.LEVEL_WIDTH;

    // Look-ahead: shift camera target based on movement direction
    const lookAhead = velocityX > 0 ? SIDESCROLLER_CONFIG.CAMERA_LOOK_AHEAD :
                      velocityX < 0 ? -SIDESCROLLER_CONFIG.CAMERA_LOOK_AHEAD : 0;

    // Calculate ideal camera position (center target in viewport + look-ahead)
    let idealX = targetX + lookAhead - vw / 2;

    // Handle world wrapping for camera
    // When player is near the edges, the camera needs special handling
    const wrapMargin = SIDESCROLLER_CONFIG.WRAP_MARGIN;

    // Clamp to level bounds (with wrap consideration)
    // For a circular level, we don't clamp - we let it wrap
    // But we need to handle the visual wrap smoothly

    // Simple approach: just clamp for now, world wrapping handled separately
    idealX = Math.max(0, Math.min(levelWidth - vw, idealX));

    // Calculate lerp amount (frame-rate independent)
    const lerpAmount = 1 - Math.pow(1 - SIDESCROLLER_CONFIG.CAMERA_LERP, deltaTime * 60);

    const currentX = this._cameraX();
    const dx = idealX - currentX;

    // Apply deadzone to prevent micro-jitter
    if (Math.abs(dx) > SIDESCROLLER_CONFIG.CAMERA_DEADZONE) {
      this._cameraX.set(currentX + dx * lerpAmount);
    }
  }

  /**
   * Convert world X to screen X
   */
  worldToScreenX(worldX: number): number {
    return worldX - this._cameraX();
  }

  /**
   * Convert screen X to world X
   */
  screenToWorldX(screenX: number): number {
    return screenX + this._cameraX();
  }

  /**
   * Check if a world X position is visible on screen
   * @param margin Extra pixels around viewport
   */
  isVisibleX(worldX: number, margin: number = 100): boolean {
    const screenX = this.worldToScreenX(worldX);
    return screenX > -margin && screenX < window.innerWidth + margin;
  }

  /**
   * Check if a world X position is visible, accounting for world wrap
   * Returns true if visible either directly or via wrap
   */
  isVisibleWithWrap(worldX: number, margin: number = 100): boolean {
    const levelWidth = SIDESCROLLER_CONFIG.LEVEL_WIDTH;

    // Check direct visibility
    if (this.isVisibleX(worldX, margin)) return true;

    // Check wrapped positions
    if (this.isVisibleX(worldX - levelWidth, margin)) return true;
    if (this.isVisibleX(worldX + levelWidth, margin)) return true;

    return false;
  }

  /**
   * Get viewport bounds in world coordinates
   */
  getViewportBounds(): { left: number; right: number } {
    const x = this._cameraX();
    return {
      left: x,
      right: x + window.innerWidth
    };
  }

  /**
   * Instantly set camera position (no lerp)
   */
  setCameraPosition(x: number): void {
    const vw = window.innerWidth;
    const levelWidth = SIDESCROLLER_CONFIG.LEVEL_WIDTH;

    // Clamp to bounds
    const clampedX = Math.max(0, Math.min(levelWidth - vw, x - vw / 2));
    this._cameraX.set(clampedX);
  }

  /**
   * Reset camera to start
   */
  reset(): void {
    this._cameraX.set(0);
  }

  /**
   * Get normalized camera position (0-1 range for minimap)
   */
  getNormalizedPosition(): number {
    const levelWidth = SIDESCROLLER_CONFIG.LEVEL_WIDTH;
    const vw = window.innerWidth;
    return this._cameraX() / (levelWidth - vw);
  }
}
