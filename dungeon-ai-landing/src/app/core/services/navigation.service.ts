// src/app/core/services/navigation.service.ts
// Servicio de navegación y manejo de modales

import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Door } from '../interfaces/game-state.interfaces';
import { LightingService } from './lighting.service';

export type ModalType = 'about' | 'consulting' | null;

@Injectable({ providedIn: 'root' })
export class NavigationService {
  private readonly router = inject(Router);
  private readonly lighting = inject(LightingService);

  readonly activeModal = signal<ModalType>(null);
  readonly isTransitioning = signal(false);

  async handleDoorInteraction(door: Door): Promise<void> {
    if (this.isTransitioning()) return;

    this.isTransitioning.set(true);

    // Fade a negro primero
    await this.lighting.fadeToBlack();

    switch (door.type) {
      case 'external':
        this.redirectToExternal(door.destination);
        break;
      case 'internal':
        await this.navigateToInternal(door.destination);
        break;
      case 'modal':
        this.openModal(door.destination as 'about' | 'consulting');
        await this.lighting.fadeFromBlack();
        this.isTransitioning.set(false);
        break;
    }
  }

  private redirectToExternal(url: string): void {
    // No reseteamos isTransitioning porque navegamos fuera
    window.open(url, '_blank');
    // Fade back si el usuario no navegó
    setTimeout(async () => {
      await this.lighting.fadeFromBlack();
      this.isTransitioning.set(false);
    }, 500);
  }

  private async navigateToInternal(path: string): Promise<void> {
    await this.router.navigate([path]);
    await this.lighting.fadeFromBlack();
    this.isTransitioning.set(false);
  }

  openModal(modalId: 'about' | 'consulting'): void {
    this.activeModal.set(modalId);
  }

  closeModal(): void {
    this.activeModal.set(null);
  }

  // Método para navegar de vuelta al juego desde otras páginas
  async navigateToGame(): Promise<void> {
    await this.lighting.fadeToBlack();
    await this.router.navigate(['/']);
    await this.lighting.fadeFromBlack();
  }
}
