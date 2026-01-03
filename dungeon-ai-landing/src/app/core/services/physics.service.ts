/**
 * Physics Service - Mario-style platformer physics
 * Handles gravity, jumping, ground collision, and world wrapping
 */

import { Injectable, signal, computed } from '@angular/core';
import { SIDESCROLLER_CONFIG } from '../../config/sidescroller.config';

export interface PhysicsState {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  isGrounded: boolean;
  isJumping: boolean;
  facingRight: boolean;
}

@Injectable({ providedIn: 'root' })
export class PhysicsService {
  // Physics state
  private _state = signal<PhysicsState>({
    x: 400,                                       // Start at first pillar area
    y: SIDESCROLLER_CONFIG.getGroundY(),
    velocityX: 0,
    velocityY: 0,
    isGrounded: true,
    isJumping: false,
    facingRight: true,
  });

  // Public readonly state
  readonly state = this._state.asReadonly();

  // Computed values for easy access
  readonly position = computed(() => ({
    x: this._state().x,
    y: this._state().y,
  }));

  readonly isGrounded = computed(() => this._state().isGrounded);
  readonly isJumping = computed(() => this._state().isJumping);
  readonly facingRight = computed(() => this._state().facingRight);
  readonly velocityX = computed(() => this._state().velocityX);

  /**
   * Update physics for one frame
   * @param deltaTime Time since last frame in seconds
   * @param inputX Horizontal input (-1, 0, or 1)
   * @param jumpPressed Whether jump was just pressed
   */
  update(deltaTime: number, inputX: number, jumpPressed: boolean): void {
    const currentState = this._state();
    let { x, y, velocityX, velocityY, isGrounded, isJumping, facingRight } = currentState;

    const groundY = SIDESCROLLER_CONFIG.getGroundY();

    // Handle jump input (only if grounded)
    if (jumpPressed && isGrounded) {
      velocityY = SIDESCROLLER_CONFIG.JUMP_VELOCITY;
      isGrounded = false;
      isJumping = true;
    }

    // Apply gravity
    if (!isGrounded) {
      velocityY += SIDESCROLLER_CONFIG.GRAVITY * deltaTime;
      // Clamp to terminal velocity
      velocityY = Math.min(velocityY, SIDESCROLLER_CONFIG.MAX_FALL_SPEED);
    }

    // Apply horizontal movement
    velocityX = inputX * SIDESCROLLER_CONFIG.MOVE_SPEED;

    // Update facing direction
    if (inputX > 0) facingRight = true;
    if (inputX < 0) facingRight = false;

    // Apply velocities to position
    x += velocityX * deltaTime;
    y += velocityY * deltaTime;

    // Ground collision
    if (y >= groundY) {
      y = groundY;
      velocityY = 0;
      isGrounded = true;
      isJumping = false;
    }

    // World wrapping (circular level)
    const levelWidth = SIDESCROLLER_CONFIG.LEVEL_WIDTH;
    const wrapMargin = SIDESCROLLER_CONFIG.WRAP_MARGIN;

    if (x < -wrapMargin) {
      x = levelWidth - wrapMargin;
    } else if (x > levelWidth + wrapMargin) {
      x = wrapMargin;
    }

    // Update state
    this._state.set({
      x,
      y,
      velocityX,
      velocityY,
      isGrounded,
      isJumping,
      facingRight,
    });
  }

  /**
   * Get the world-wrapped distance between two X positions
   * Accounts for circular level wrapping
   */
  getWrappedDistanceX(x1: number, x2: number): number {
    const levelWidth = SIDESCROLLER_CONFIG.LEVEL_WIDTH;
    const directDist = Math.abs(x1 - x2);
    const wrappedDist = levelWidth - directDist;
    return Math.min(directDist, wrappedDist);
  }

  /**
   * Check if a world X position is within range of the player
   * Accounts for world wrapping
   */
  isInRange(targetX: number, range: number): boolean {
    const playerX = this._state().x;
    return this.getWrappedDistanceX(playerX, targetX) <= range;
  }

  /**
   * Reset player to starting position
   */
  reset(): void {
    this._state.set({
      x: 400,
      y: SIDESCROLLER_CONFIG.getGroundY(),
      velocityX: 0,
      velocityY: 0,
      isGrounded: true,
      isJumping: false,
      facingRight: true,
    });
  }

  /**
   * Set player position directly (for teleports/resets)
   */
  setPosition(x: number, y?: number): void {
    const current = this._state();
    this._state.set({
      ...current,
      x,
      y: y ?? SIDESCROLLER_CONFIG.getGroundY(),
      velocityY: y !== undefined ? current.velocityY : 0,
    });
  }
}
