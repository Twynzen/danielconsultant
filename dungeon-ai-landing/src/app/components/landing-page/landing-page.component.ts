import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CircuitsBackgroundComponent } from '../circuits-background/circuits-background.component';
import { ModalServiceComponent } from '../modal-service/modal-service.component';
import { FlameHeadCharacterComponent } from '../flame-head-character/flame-head-character.component';
import { PillarSystemComponent } from '../pillar-system/pillar-system.component';
import { PillarConfig } from '../../config/pillar.config';
import { CameraService } from '../../services/camera.service';
import { SIDESCROLLER_CONFIG } from '../../config/sidescroller.config';

@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [
    CommonModule,
    CircuitsBackgroundComponent,
    ModalServiceComponent,
    FlameHeadCharacterComponent,
    PillarSystemComponent
  ],
  templateUrl: './landing-page.component.html',
  styleUrl: './landing-page.component.scss'
})
export class LandingPageComponent {
  private cameraService = inject(CameraService);

  // Modal state
  isModalOpen = false;
  selectedServiceId: string | null = null;

  // Camera transform for world scrolling
  cameraTransform = this.cameraService.cameraTransform;

  // Level dimensions
  get levelWidth(): number {
    return SIDESCROLLER_CONFIG.LEVEL_WIDTH;
  }

  get groundHeight(): number {
    return SIDESCROLLER_CONFIG.GROUND_HEIGHT;
  }

  /**
   * Called when a pillar is activated via Enter key
   */
  onPillarActivated(pillar: PillarConfig): void {
    if (pillar.type === 'external') {
      window.open(pillar.destination, '_blank', 'noopener,noreferrer');
    } else {
      this.selectedServiceId = pillar.destination;
      this.isModalOpen = true;
    }
  }

  onCloseModal(): void {
    this.isModalOpen = false;
    this.selectedServiceId = null;
  }
}
