import { Component, inject, ChangeDetectionStrategy, ChangeDetectorRef, OnInit, OnDestroy, NgZone } from '@angular/core';
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
export class LandingPageComponent implements OnInit, OnDestroy {
  private cameraService = inject(CameraService);
  private cdr = inject(ChangeDetectorRef);
  private ngZone = inject(NgZone);

  // Modal state
  isModalOpen = false;
  selectedServiceId: string | null = null;

  // Animation frame for change detection
  private animationFrameId: number | null = null;

  // Camera transform for world scrolling - computed signal
  get cameraTransformValue(): string {
    return this.cameraService.cameraTransform();
  }

  ngOnInit(): void {
    // Start a loop to trigger change detection for camera updates
    this.startRenderLoop();
  }

  ngOnDestroy(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }

  private startRenderLoop(): void {
    const loop = () => {
      // Trigger change detection
      this.cdr.detectChanges();
      this.animationFrameId = requestAnimationFrame(loop);
    };
    this.animationFrameId = requestAnimationFrame(loop);
  }

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
