// src/app/features/game/dungeon-scene/lighting-overlay/lighting-overlay.component.ts
// Overlay de iluminación dinámica con radial gradients

import { Component, inject, computed, ChangeDetectionStrategy } from '@angular/core';
import { GameStateService } from '../../../../core/services/game-state.service';
import { LightingService } from '../../../../core/services/lighting.service';
import { GAME_CONFIG } from '../../../../core/config/game.config';

@Component({
  selector: 'app-lighting-overlay',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="lighting-overlay" [style.background]="lightingGradient()"></div>
  `,
  styles: [`
    .lighting-overlay {
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 50;
      transition: background 0.1s linear;
    }
  `],
})
export class LightingOverlayComponent {
  private readonly gameState = inject(GameStateService);
  private readonly lighting = inject(LightingService);

  readonly lightingGradient = computed(() => {
    const lightPos = this.gameState.lightPosition();
    const flameIntensity = this.gameState.flameIntensity();
    const lightRadius = GAME_CONFIG.player.lightRadius * flameIntensity;

    // Luz principal del jugador
    const playerLight = this.lighting.generateLightingStyle(lightPos, lightRadius);

    // Luces de puertas destacadas
    const doorLights = this.gameState.doors()
      .filter(d => d.isHighlighted)
      .map(d => this.lighting.generateDoorHighlightStyle(
        d.position,
        d.size,
        d.isInteractable ? 1 : 0.5,
        d.color
      ));

    // Combinar todas las capas
    return [playerLight, ...doorLights].join(', ');
  });
}
