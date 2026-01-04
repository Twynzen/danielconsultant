// src/app/features/game/dungeon-scene/dungeon-scene.component.ts
// Componente principal de la escena del dungeon

import { Component, inject } from '@angular/core';
import { PlayerCharacterComponent } from './player-character/player-character.component';
import { DoorComponent } from './door/door.component';
import { LightingOverlayComponent } from './lighting-overlay/lighting-overlay.component';
import { GameStateService } from '../../../core/services/game-state.service';
import { GAME_CONFIG } from '../../../core/config/game.config';

@Component({
  selector: 'app-dungeon-scene',
  standalone: true,
  imports: [PlayerCharacterComponent, DoorComponent, LightingOverlayComponent],
  template: `
    <div
      class="dungeon-scene"
      [style.width.px]="worldWidth"
      [style.height.px]="worldHeight">

      <!-- Puertas -->
      @for (door of doors(); track door.id) {
        <app-door [door]="door" />
      }

      <!-- Jugador -->
      <app-player-character />

      <!-- Overlay de iluminación -->
      <app-lighting-overlay />

      <!-- Instrucciones de control -->
      <div class="controls-hint">
        <span>WASD / Flechas para mover</span>
        <span>ENTER para interactuar</span>
      </div>
    </div>
  `,
  styleUrl: './dungeon-scene.component.scss',
})
export class DungeonSceneComponent {
  private readonly gameState = inject(GameStateService);

  readonly worldWidth = GAME_CONFIG.world.width;
  readonly worldHeight = GAME_CONFIG.world.height;
  readonly doors = this.gameState.doors;
}
