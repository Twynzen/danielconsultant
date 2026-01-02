// src/app/core/services/lighting.service.ts
// Servicio de sistema de iluminación dinámica con radial gradients

import { Injectable, signal } from '@angular/core';
import { Position } from '../interfaces/game-state.interfaces';
import { GAME_CONFIG } from '../config/game.config';

@Injectable({ providedIn: 'root' })
export class LightingService {
  readonly isFadingToBlack = signal(false);
  readonly fadeProgress = signal(0); // 0-1

  private fadeAnimationId: number | null = null;

  generateLightingStyle(lightPosition: Position, lightRadius: number): string {
    return `
      radial-gradient(
        circle ${lightRadius}px at ${lightPosition.x}px ${lightPosition.y}px,
        transparent 0%,
        transparent 40%,
        rgba(0, 0, 0, 0.5) 60%,
        rgba(0, 0, 0, ${GAME_CONFIG.lighting.ambientDarkness}) 100%
      )
    `;
  }

  generateDoorHighlightStyle(
    doorPosition: Position,
    doorSize: { width: number; height: number },
    intensity: number,
    color: string
  ): string {
    const centerX = doorPosition.x + doorSize.width / 2;
    const centerY = doorPosition.y + doorSize.height / 2;
    const radius = GAME_CONFIG.lighting.doorHighlightRadius;

    return `
      radial-gradient(
        circle ${radius}px at ${centerX}px ${centerY}px,
        ${this.hexToRgba(color, 0.6 * intensity)} 0%,
        ${this.hexToRgba(color, 0.2 * intensity)} 50%,
        transparent 100%
      )
    `;
  }

  fadeToBlack(): Promise<void> {
    return new Promise(resolve => {
      this.isFadingToBlack.set(true);
      const duration = GAME_CONFIG.lighting.fadeTransitionDuration;
      const startTime = performance.now();

      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        this.fadeProgress.set(progress);

        if (progress < 1) {
          this.fadeAnimationId = requestAnimationFrame(animate);
        } else {
          resolve();
        }
      };

      this.fadeAnimationId = requestAnimationFrame(animate);
    });
  }

  fadeFromBlack(): Promise<void> {
    return new Promise(resolve => {
      const duration = GAME_CONFIG.lighting.fadeTransitionDuration;
      const startTime = performance.now();

      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = 1 - Math.min(elapsed / duration, 1);

        this.fadeProgress.set(progress);

        if (progress > 0) {
          this.fadeAnimationId = requestAnimationFrame(animate);
        } else {
          this.isFadingToBlack.set(false);
          resolve();
        }
      };

      this.fadeAnimationId = requestAnimationFrame(animate);
    });
  }

  resetFade(): void {
    if (this.fadeAnimationId) {
      cancelAnimationFrame(this.fadeAnimationId);
      this.fadeAnimationId = null;
    }
    this.fadeProgress.set(0);
    this.isFadingToBlack.set(false);
  }

  private hexToRgba(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
}
