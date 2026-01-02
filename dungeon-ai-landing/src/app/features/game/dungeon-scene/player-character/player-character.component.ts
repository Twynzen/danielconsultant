// src/app/features/game/dungeon-scene/player-character/player-character.component.ts
// Componente del personaje jugable "Flame Head Voxel"

import { Component, inject, computed, ChangeDetectionStrategy } from '@angular/core';
import { GameStateService } from '../../../../core/services/game-state.service';

@Component({
  selector: 'app-player-character',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="player-container"
      [style.left.px]="position().x"
      [style.top.px]="position().y"
      [class.walking]="isMoving()"
      [attr.data-facing]="facing()">

      <svg
        viewBox="0 0 64 80"
        class="character-svg"
        [class.facing-left]="facing() === 'left'"
        [class.facing-right]="facing() === 'right'">

        <defs>
          <!-- Gradiente de llama verde (Matrix style) -->
          <linearGradient id="flameGradient" x1="50%" y1="100%" x2="50%" y2="0%">
            <stop offset="0%" stop-color="#00ff00"/>
            <stop offset="50%" stop-color="#00cc00"/>
            <stop offset="100%" stop-color="#88ff88"/>
          </linearGradient>

          <!-- Filtro de glow -->
          <filter id="flameGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur"/>
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>

          <!-- Pattern de píxeles para visor -->
          <pattern id="visorPattern" patternUnits="userSpaceOnUse" width="4" height="4">
            <rect width="2" height="2" fill="#00ff00"/>
            <rect x="2" y="2" width="2" height="2" fill="#00ff00"/>
          </pattern>
        </defs>

        <!-- Llama (cabeza) -->
        <g
          class="flame-head"
          filter="url(#flameGlow)"
          [style.opacity]="flameIntensity()"
          [style.transform]="'scale(' + (0.3 + flameIntensity() * 0.7) + ')'">
          <path
            class="flame-main"
            d="M32 5 Q20 20 25 35 Q28 45 32 40 Q36 45 39 35 Q44 20 32 5"
            fill="url(#flameGradient)"/>
          <path
            class="flame-inner"
            d="M32 15 Q26 25 29 35 Q31 38 32 36 Q33 38 35 35 Q38 25 32 15"
            fill="#ccffcc"
            opacity="0.7"/>
        </g>

        <!-- Cuerpo voxel -->
        <rect class="body" x="22" y="38" width="20" height="24" fill="#1a1a1a" rx="2"/>

        <!-- Visor -->
        <rect class="visor" x="24" y="42" width="16" height="8" fill="url(#visorPattern)" rx="1"/>

        <!-- Brazos -->
        <g class="arms">
          <rect class="arm-left" x="14" y="42" width="8" height="16" fill="#1a1a1a" rx="2"/>
          <rect class="arm-right" x="42" y="42" width="8" height="16" fill="#1a1a1a" rx="2"/>
        </g>

        <!-- Piernas -->
        <g class="legs">
          <rect class="leg-left" x="24" y="62" width="7" height="16" fill="#0d0d0d" rx="1"/>
          <rect class="leg-right" x="33" y="62" width="7" height="16" fill="#0d0d0d" rx="1"/>
        </g>
      </svg>
    </div>
  `,
  styleUrl: './player-character.component.scss',
})
export class PlayerCharacterComponent {
  private readonly gameState = inject(GameStateService);

  readonly position = this.gameState.playerPosition;
  readonly facing = this.gameState.playerFacing;
  readonly isMoving = this.gameState.isPlayerMoving;
  readonly flameIntensity = this.gameState.flameIntensity;

  readonly isFacingSide = computed(() =>
    this.facing() === 'left' || this.facing() === 'right'
  );
}
