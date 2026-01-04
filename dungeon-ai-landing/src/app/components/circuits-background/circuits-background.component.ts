/**
 * Circuits Background Component - Side-Scroller Mode
 * Circuits light up when player approaches, then fade out after 3-5 seconds
 * Optimized with viewport culling
 */

import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SIDESCROLLER_CONFIG } from '../../config/sidescroller.config';
import { PhysicsService } from '../../core/services/physics.service';
import { ViewportCullingService } from '../../core/services/viewport-culling.service';

interface Circuit {
  id: number;
  x: number;
  y: number;
  pattern: string;
  isLit: boolean;
  litTime: number;
  fadeOutDuration: number;
  opacity: number;
}

@Component({
  selector: 'app-circuits-background',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './circuits-background.component.html',
  styleUrl: './circuits-background.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CircuitsBackgroundComponent implements OnInit, OnDestroy {
  private physicsService = inject(PhysicsService);
  private cullingService = inject(ViewportCullingService);

  circuits: Circuit[] = [];
  visibleCircuits: Circuit[] = [];

  // World dimensions
  levelWidth = SIDESCROLLER_CONFIG.LEVEL_WIDTH;
  levelHeight = SIDESCROLLER_CONFIG.getLevelHeight();

  // Animation
  private animationFrameId: number | null = null;
  private lastUpdateTime = 0;
  private readonly UPDATE_INTERVAL = 100; // 10fps for circuit updates

  ngOnInit(): void {
    this.generateCircuits();
    this.startUpdateLoop();
  }

  ngOnDestroy(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }

  private generateCircuits(): void {
    const patterns = ['-', '|', '+', '0', '1'];
    const levelW = this.levelWidth;
    const levelH = this.levelHeight;

    // Sparse grid for performance
    const cols = 40;  // Across 6000px level
    const rows = 8;   // Across screen height
    const cellWidth = levelW / cols;
    const cellHeight = levelH / rows;

    let id = 0;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        // Skip 60% of cells for performance
        if (Math.random() < 0.6) continue;

        // Don't place circuits in ground area
        const y = row * cellHeight + (cellHeight / 2) + (Math.random() - 0.5) * 30;
        if (y > SIDESCROLLER_CONFIG.getGroundY() - 50) continue;

        const circuit: Circuit = {
          id: id++,
          x: col * cellWidth + (cellWidth / 2) + (Math.random() - 0.5) * 40,
          y,
          pattern: patterns[Math.floor(Math.random() * patterns.length)],
          isLit: false,
          litTime: 0,
          fadeOutDuration: SIDESCROLLER_CONFIG.CIRCUIT_TIMEOUT_MIN +
            Math.random() * (SIDESCROLLER_CONFIG.CIRCUIT_TIMEOUT_MAX - SIDESCROLLER_CONFIG.CIRCUIT_TIMEOUT_MIN),
          opacity: 0
        };

        this.circuits.push(circuit);
      }
    }
  }

  private startUpdateLoop(): void {
    const loop = (currentTime: number) => {
      if (currentTime - this.lastUpdateTime >= this.UPDATE_INTERVAL) {
        this.updateCircuits(currentTime);
        this.lastUpdateTime = currentTime;
      }

      this.animationFrameId = requestAnimationFrame(loop);
    };

    this.animationFrameId = requestAnimationFrame(loop);
  }

  private updateCircuits(currentTime: number): void {
    const playerState = this.physicsService.state();
    const playerX = playerState.x;
    const playerY = playerState.y;
    const lightRadius = SIDESCROLLER_CONFIG.CIRCUIT_LIGHT_RADIUS;
    const levelWidth = SIDESCROLLER_CONFIG.LEVEL_WIDTH;

    // Update circuit states
    this.circuits.forEach(circuit => {
      // Calculate distance with world wrap
      const directDist = Math.abs(playerX - circuit.x);
      const wrappedDist = levelWidth - directDist;
      const distX = Math.min(directDist, wrappedDist);
      const distY = Math.abs(playerY - circuit.y);
      const distance = Math.sqrt(distX * distX + distY * distY);

      // Light up if player is near
      if (distance <= lightRadius && !circuit.isLit) {
        circuit.isLit = true;
        circuit.litTime = currentTime;
        circuit.opacity = 1;
      }

      // Fade out after timeout
      if (circuit.isLit) {
        const elapsed = currentTime - circuit.litTime;

        if (elapsed > circuit.fadeOutDuration) {
          // Start fading
          const fadeElapsed = elapsed - circuit.fadeOutDuration;
          const fadeDuration = SIDESCROLLER_CONFIG.CIRCUIT_FADE_DURATION;

          if (fadeElapsed >= fadeDuration) {
            // Fully faded
            circuit.isLit = false;
            circuit.opacity = 0;
          } else {
            // Fading
            circuit.opacity = 1 - (fadeElapsed / fadeDuration);
          }
        }
      }
    });

    // Filter to only visible circuits for rendering
    this.visibleCircuits = this.circuits.filter(circuit => {
      if (!circuit.isLit && circuit.opacity === 0) return false;
      return this.cullingService.isVisible(circuit.x, 50);
    });
  }

  trackCircuit(index: number, circuit: Circuit): number {
    return circuit.id;
  }
}
