// src/app/features/game/game-container.component.ts
// Contenedor principal del juego con lógica de game loop

import { Component, OnInit, OnDestroy, inject, effect } from '@angular/core';
import { DungeonSceneComponent } from './dungeon-scene/dungeon-scene.component';
import { UIOverlayComponent } from './ui-overlay/ui-overlay.component';
import { AboutModalComponent } from '../../shared/modals/about-modal.component';
import { ConsultingModalComponent } from '../../shared/modals/consulting-modal.component';
import { GameStateService } from '../../core/services/game-state.service';
import { GameLoopService } from '../../core/services/game-loop.service';
import { InputService } from '../../core/services/input.service';
import { NavigationService } from '../../core/services/navigation.service';
import { LightingService } from '../../core/services/lighting.service';
import { GAME_CONFIG } from '../../core/config/game.config';
import { FacingDirection } from '../../core/interfaces/game-state.interfaces';

@Component({
  selector: 'app-game-container',
  standalone: true,
  imports: [
    DungeonSceneComponent,
    UIOverlayComponent,
    AboutModalComponent,
    ConsultingModalComponent,
  ],
  template: `
    <div class="game-container">
      <app-dungeon-scene />
      <app-ui-overlay />

      @if (navigation.activeModal() === 'about') {
        <app-about-modal (close)="navigation.closeModal()" />
      }
      @if (navigation.activeModal() === 'consulting') {
        <app-consulting-modal (close)="navigation.closeModal()" />
      }

      <!-- Fade overlay -->
      <div
        class="fade-overlay"
        [style.opacity]="lighting.fadeProgress()"
        [class.active]="lighting.isFadingToBlack()">
      </div>
    </div>
  `,
  styles: [`
    .game-container {
      position: relative;
      width: 100vw;
      height: 100vh;
      overflow: hidden;
      background: #0a0a0a;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .fade-overlay {
      position: fixed;
      inset: 0;
      background: #000;
      pointer-events: none;
      z-index: 9999;
    }

    .fade-overlay.active {
      pointer-events: all;
    }
  `],
})
export class GameContainerComponent implements OnInit, OnDestroy {
  readonly gameState = inject(GameStateService);
  readonly gameLoop = inject(GameLoopService);
  readonly input = inject(InputService);
  readonly navigation = inject(NavigationService);
  readonly lighting = inject(LightingService);

  private actionPressed = false;

  constructor() {
    // Effect para manejar interacción con puertas
    effect(() => {
      const inputState = this.input.inputState();
      const activeDoor = this.gameState.activeDoor();
      const phase = this.gameState.phase();
      const activeModal = this.navigation.activeModal();

      // Si hay un modal abierto, Enter lo cierra
      if (inputState.action && !this.actionPressed && activeModal) {
        this.actionPressed = true;
        this.navigation.closeModal();
        return;
      }

      // Interacción con puerta
      if (inputState.action && !this.actionPressed && activeDoor && phase === 'playing' && !activeModal) {
        this.actionPressed = true;
        this.navigation.handleDoorInteraction(activeDoor);
      }

      if (!inputState.action) {
        this.actionPressed = false;
      }
    });
  }

  ngOnInit(): void {
    this.startGame();
  }

  private async startGame(): Promise<void> {
    this.gameState.setPhase('igniting');

    // Animación de encendido de llama
    await this.igniteFlame();

    this.gameState.setPhase('playing');

    // Iniciar game loop
    this.gameLoop.start((deltaTime) => this.update(deltaTime));
  }

  private async igniteFlame(): Promise<void> {
    const duration = GAME_CONFIG.animation.flameIgnitionDuration;
    const startTime = performance.now();

    return new Promise(resolve => {
      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        this.gameState.setFlameIntensity(progress);

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          resolve();
        }
      };
      requestAnimationFrame(animate);
    });
  }

  private update(deltaTime: number): void {
    // No actualizar si hay modal abierto o está en transición
    if (this.gameState.phase() !== 'playing' || this.navigation.activeModal()) return;

    // Actualizar posición del jugador
    this.updatePlayerMovement(deltaTime);

    // Actualizar proximidades de puertas
    this.updateDoorProximities();
  }

  private updatePlayerMovement(deltaTime: number): void {
    const movement = this.input.getMovementVector();
    const player = this.gameState.player();
    const speed = GAME_CONFIG.player.speed;

    const newX = player.position.x + movement.x * speed * deltaTime;
    const newY = player.position.y + movement.y * speed * deltaTime;

    const facing = this.determineFacing(movement.x, movement.y, player.facing);
    const isMoving = movement.x !== 0 || movement.y !== 0;

    this.gameState.updatePlayerPosition(newX, newY, facing, isMoving);
  }

  private determineFacing(dx: number, dy: number, current: FacingDirection): FacingDirection {
    if (dx === 0 && dy === 0) return current;
    if (Math.abs(dx) > Math.abs(dy)) {
      return dx > 0 ? 'right' : 'left';
    }
    return dy > 0 ? 'down' : 'up';
  }

  private updateDoorProximities(): void {
    const playerCenter = {
      x: this.gameState.playerPosition().x + GAME_CONFIG.player.size.width / 2,
      y: this.gameState.playerPosition().y + GAME_CONFIG.player.size.height / 2,
    };

    const doors = this.gameState.doors();

    doors.forEach(door => {
      const doorCenter = {
        x: door.position.x + door.size.width / 2,
        y: door.position.y + door.size.height / 2,
      };

      const distance = Math.sqrt(
        Math.pow(playerCenter.x - doorCenter.x, 2) +
        Math.pow(playerCenter.y - doorCenter.y, 2)
      );

      const highlightRadius = GAME_CONFIG.interaction.proximityRadius * 1.5;
      const interactRadius = GAME_CONFIG.interaction.proximityRadius;

      const isHighlighted = distance < highlightRadius;
      const isInteractable = distance < interactRadius;

      this.gameState.updateDoorProximity(door.id, isHighlighted, isInteractable);
    });
  }

  ngOnDestroy(): void {
    this.gameLoop.stop();
  }
}
