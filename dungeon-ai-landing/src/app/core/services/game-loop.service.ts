// src/app/core/services/game-loop.service.ts
// Game Loop con requestAnimationFrame fuera de NgZone para rendimiento

import { Injectable, NgZone, OnDestroy, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class GameLoopService implements OnDestroy {
  private animationFrameId: number | null = null;
  private lastTime = 0;
  private isRunning = signal(false);

  readonly fps = signal(0);
  readonly running = this.isRunning.asReadonly();

  constructor(private ngZone: NgZone) {}

  start(updateCallback: (deltaTime: number) => void): void {
    if (this.isRunning()) return;

    this.isRunning.set(true);
    this.lastTime = performance.now();

    // Ejecutar FUERA de Angular zone para máximo rendimiento
    this.ngZone.runOutsideAngular(() => {
      const loop = (currentTime: number) => {
        if (!this.isRunning()) return;

        const deltaTime = (currentTime - this.lastTime) / 1000; // convertir a segundos
        this.lastTime = currentTime;

        // Prevenir saltos grandes (ej: cuando tab está en background)
        const cappedDelta = Math.min(deltaTime, 0.1);

        updateCallback(cappedDelta);

        // Actualizar FPS
        if (deltaTime > 0) {
          this.fps.set(Math.round(1 / deltaTime));
        }

        this.animationFrameId = requestAnimationFrame(loop);
      };

      this.animationFrameId = requestAnimationFrame(loop);
    });
  }

  stop(): void {
    this.isRunning.set(false);
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  ngOnDestroy(): void {
    this.stop();
  }
}
