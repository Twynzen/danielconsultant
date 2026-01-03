// src/app/core/services/game-state.service.ts
// Servicio de estado del juego con Angular Signals

import { Injectable, signal, computed } from '@angular/core';
import {
  GameState, Player, Door, Position,
  FacingDirection, GamePhase
} from '../interfaces/game-state.interfaces';
import { GAME_CONFIG } from '../config/game.config';

@Injectable({ providedIn: 'root' })
export class GameStateService {

  // Estado principal como signal
  private readonly state = signal<GameState>(this.createInitialState());

  // Selectores computados (read-only)
  readonly phase = computed(() => this.state().phase);
  readonly player = computed(() => this.state().player);
  readonly playerPosition = computed(() => this.state().player.position);
  readonly playerFacing = computed(() => this.state().player.facing);
  readonly isPlayerMoving = computed(() => this.state().player.isMoving);
  readonly flameIntensity = computed(() => this.state().player.flameIntensity);
  readonly doors = computed(() => this.state().doors);
  readonly activeDoor = computed(() => {
    const id = this.state().activeDoorId;
    return id ? this.state().doors.find(d => d.id === id) ?? null : null;
  });
  readonly lightPosition = computed(() => this.state().lightPosition);

  private createInitialState(): GameState {
    return {
      phase: 'loading',
      player: {
        position: { ...GAME_CONFIG.player.initialPosition },
        facing: 'down',
        isMoving: false,
        flameIntensity: 0,
      },
      doors: GAME_CONFIG.doors.map(d => ({
        ...d,
        isHighlighted: false,
        isInteractable: false,
      })),
      activeDoorId: null,
      lightPosition: { ...GAME_CONFIG.player.initialPosition },
    };
  }

  // === ACCIONES ===

  setPhase(phase: GamePhase): void {
    this.state.update(s => ({ ...s, phase }));
  }

  updatePlayerPosition(
    x: number,
    y: number,
    facing: FacingDirection,
    isMoving: boolean
  ): void {
    // Clamping dentro de límites del mundo
    const clampedX = Math.max(0, Math.min(
      GAME_CONFIG.world.width - GAME_CONFIG.player.size.width, x
    ));
    const clampedY = Math.max(0, Math.min(
      GAME_CONFIG.world.height - GAME_CONFIG.player.size.height, y
    ));

    this.state.update(s => ({
      ...s,
      player: {
        ...s.player,
        position: { x: clampedX, y: clampedY },
        facing,
        isMoving,
      },
      lightPosition: {
        x: clampedX + GAME_CONFIG.player.size.width / 2,
        y: clampedY + GAME_CONFIG.player.size.height / 2
      },
    }));
  }

  setFlameIntensity(intensity: number): void {
    this.state.update(s => ({
      ...s,
      player: { ...s.player, flameIntensity: Math.min(1, Math.max(0, intensity)) },
    }));
  }

  updateDoorProximity(doorId: string, isHighlighted: boolean, isInteractable: boolean): void {
    this.state.update(s => ({
      ...s,
      doors: s.doors.map(d =>
        d.id === doorId
          ? { ...d, isHighlighted, isInteractable }
          : d
      ),
      activeDoorId: isInteractable ? doorId :
        (s.activeDoorId === doorId ? null : s.activeDoorId),
    }));
  }

  resetProximities(): void {
    this.state.update(s => ({
      ...s,
      doors: s.doors.map(d => ({ ...d, isHighlighted: false, isInteractable: false })),
      activeDoorId: null,
    }));
  }

  resetGame(): void {
    this.state.set(this.createInitialState());
  }
}
