// src/app/features/game/ui-overlay/ui-overlay.component.ts
// HUD del juego con información de perfil

import { Component, inject } from '@angular/core';
import { GameStateService } from '../../../core/services/game-state.service';
import { GameLoopService } from '../../../core/services/game-loop.service';
import { GAME_CONFIG } from '../../../core/config/game.config';

@Component({
  selector: 'app-ui-overlay',
  standalone: true,
  template: `
    <div class="ui-overlay">
      <!-- Header con nombre -->
      <header class="game-header">
        <div class="profile-info">
          <h1 class="name">{{ profile.name }}</h1>
          <p class="title">{{ profile.title }}</p>
        </div>
        <div class="game-status">
          <span class="phase" [class.active]="phase() === 'playing'">
            {{ phase() === 'playing' ? 'EXPLORANDO' : phase() === 'igniting' ? 'INICIANDO...' : 'CARGANDO' }}
          </span>
        </div>
      </header>

      <!-- Footer con instrucciones -->
      <footer class="game-footer">
        <p class="subtitle">{{ profile.subtitle }}</p>
      </footer>
    </div>
  `,
  styles: [`
    .ui-overlay {
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 300;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 20px;
    }

    .game-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }

    .profile-info {
      background: rgba(0, 0, 0, 0.8);
      border: 1px solid rgba(0, 255, 68, 0.3);
      border-radius: 8px;
      padding: 12px 20px;

      .name {
        font-family: 'Courier New', monospace;
        font-size: 18px;
        color: #00ff44;
        margin: 0;
        text-shadow: 0 0 10px rgba(0, 255, 68, 0.5);
      }

      .title {
        font-family: 'Courier New', monospace;
        font-size: 12px;
        color: rgba(0, 255, 68, 0.7);
        margin: 4px 0 0 0;
      }
    }

    .game-status {
      background: rgba(0, 0, 0, 0.8);
      border: 1px solid rgba(0, 255, 68, 0.3);
      border-radius: 8px;
      padding: 8px 16px;

      .phase {
        font-family: 'Courier New', monospace;
        font-size: 11px;
        color: rgba(0, 255, 68, 0.5);
        text-transform: uppercase;
        letter-spacing: 2px;

        &.active {
          color: #00ff44;
          animation: blink 1s infinite;
        }
      }
    }

    .game-footer {
      text-align: center;

      .subtitle {
        font-family: 'Courier New', monospace;
        font-size: 14px;
        color: rgba(0, 255, 68, 0.6);
        margin: 0;
        background: rgba(0, 0, 0, 0.6);
        padding: 8px 20px;
        border-radius: 4px;
        display: inline-block;
      }
    }

    @keyframes blink {
      0%, 50%, 100% { opacity: 1; }
      25%, 75% { opacity: 0.5; }
    }
  `],
})
export class UIOverlayComponent {
  private readonly gameState = inject(GameStateService);
  private readonly gameLoop = inject(GameLoopService);

  readonly profile = GAME_CONFIG.profile;
  readonly phase = this.gameState.phase;
  readonly fps = this.gameLoop.fps;
}
