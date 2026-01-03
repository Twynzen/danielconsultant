/**
 * Viewport Culling Service
 * Optimizes rendering by only processing/displaying elements within the visible viewport
 */

import { Injectable, inject, computed } from '@angular/core';
import { CameraService } from '../../services/camera.service';
import { SIDESCROLLER_CONFIG } from '../../config/sidescroller.config';

export interface CullableObject {
  worldX: number;
  width?: number;
}

@Injectable({ providedIn: 'root' })
export class ViewportCullingService {
  private cameraService = inject(CameraService);

  // Margin around viewport to include objects about to enter view
  private readonly CULL_MARGIN = 200;

  /**
   * Get the visible range in world coordinates
   */
  getVisibleRange(): { left: number; right: number } {
    const bounds = this.cameraService.getViewportBounds();
    return {
      left: bounds.left - this.CULL_MARGIN,
      right: bounds.right + this.CULL_MARGIN
    };
  }

  /**
   * Check if a world X position is visible
   */
  isVisible(worldX: number, objectWidth: number = 0): boolean {
    const range = this.getVisibleRange();
    const objectRight = worldX + objectWidth;

    // Check direct visibility
    if (objectRight >= range.left && worldX <= range.right) {
      return true;
    }

    // Check wrapped visibility (circular level)
    const levelWidth = SIDESCROLLER_CONFIG.LEVEL_WIDTH;

    // Object wrapped from end to beginning
    const wrappedX1 = worldX - levelWidth;
    const wrappedRight1 = objectRight - levelWidth;
    if (wrappedRight1 >= range.left && wrappedX1 <= range.right) {
      return true;
    }

    // Object wrapped from beginning to end
    const wrappedX2 = worldX + levelWidth;
    const wrappedRight2 = objectRight + levelWidth;
    if (wrappedRight2 >= range.left && wrappedX2 <= range.right) {
      return true;
    }

    return false;
  }

  /**
   * Filter an array to only include visible objects
   */
  filterVisible<T extends CullableObject>(objects: T[]): T[] {
    return objects.filter(obj => this.isVisible(obj.worldX, obj.width || 0));
  }

  /**
   * Get screen X position for a world X position
   * Handles world wrapping for seamless circular level
   */
  getScreenX(worldX: number): number {
    const cameraX = this.cameraService.cameraX();
    const vw = window.innerWidth;
    const levelWidth = SIDESCROLLER_CONFIG.LEVEL_WIDTH;

    let screenX = worldX - cameraX;

    // Handle wrapping - if object is off-screen, check wrapped position
    if (screenX < -this.CULL_MARGIN) {
      screenX = (worldX + levelWidth) - cameraX;
    } else if (screenX > vw + this.CULL_MARGIN) {
      screenX = (worldX - levelWidth) - cameraX;
    }

    return screenX;
  }

  /**
   * Get the best wrapped position for an object
   * Returns the position that makes it closest to the viewport center
   */
  getBestWrappedPosition(worldX: number): number {
    const cameraX = this.cameraService.cameraX();
    const vw = window.innerWidth;
    const viewportCenter = cameraX + vw / 2;
    const levelWidth = SIDESCROLLER_CONFIG.LEVEL_WIDTH;

    // Calculate distances to viewport center for each wrapped position
    const positions = [
      worldX,
      worldX - levelWidth,
      worldX + levelWidth
    ];

    let bestPos = worldX;
    let bestDist = Math.abs(worldX - viewportCenter);

    for (const pos of positions) {
      const dist = Math.abs(pos - viewportCenter);
      if (dist < bestDist) {
        bestDist = dist;
        bestPos = pos;
      }
    }

    return bestPos;
  }
}
