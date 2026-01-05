import { Component, inject, ChangeDetectionStrategy, ChangeDetectorRef, OnInit, OnDestroy, NgZone, ViewChild, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CircuitsBackgroundComponent } from '../circuits-background/circuits-background.component';
import { ModalServiceComponent } from '../modal-service/modal-service.component';
import { HologramProjectionComponent } from '../hologram-projection/hologram-projection.component';
import { FlameHeadCharacterComponent } from '../flame-head-character/flame-head-character.component';
import { PillarSystemComponent } from '../pillar-system/pillar-system.component';
import { PillarConfig, PILLAR_INTERACTION } from '../../config/pillar.config';
import { CameraService } from '../../services/camera.service';
import { SIDESCROLLER_CONFIG } from '../../config/sidescroller.config';

@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [
    CommonModule,
    CircuitsBackgroundComponent,
    ModalServiceComponent,
    HologramProjectionComponent,
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

  // Reference to character component
  @ViewChild(FlameHeadCharacterComponent) characterComponent!: FlameHeadCharacterComponent;

  // Modal state (legacy - keeping for fallback)
  isModalOpen = false;
  selectedServiceId: string | null = null;

  // v4.5: Hologram state
  isHologramActive = false;
  activeHologramPillar: PillarConfig | null = null;

  // v4.6.2: Store WORLD coordinates (not screen) for proper pillar anchoring
  hologramWorldX = 0;
  hologramWorldY = 0;

  // v4.6.3: Zoom cinematográfico state
  isZoomed = false;
  zoomScale = 1;
  private readonly ZOOM_LEVEL = 1.25;  // 125% zoom for better detail visibility

  // v4.6.2: Reactive getters - recalculate screen position in real-time
  get hologramScreenX(): number {
    return this.cameraService.worldToScreenX(this.hologramWorldX);
  }

  get hologramScreenY(): number {
    // Y is fixed relative to viewport (ground minus pillar height)
    return window.innerHeight - SIDESCROLLER_CONFIG.GROUND_HEIGHT - PILLAR_INTERACTION.PILLAR_HEIGHT;
  }

  // Animation frame for change detection
  private animationFrameId: number | null = null;

  // Camera transform for world scrolling - computed signal
  // v4.6.3: Includes zoom scale when hologram is active
  get cameraTransformValue(): string {
    const baseTransform = this.cameraService.cameraTransform();
    if (this.isZoomed) {
      // Combine translate3d with scale for zoom effect
      return `${baseTransform} scale(${this.zoomScale})`;
    }
    return baseTransform;
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
   * v4.6.2: Called when a pillar is activated via E key
   * Stores WORLD coordinates so hologram stays anchored to pillar
   * v4.6.3: Activates cinematic zoom effect
   */
  onPillarActivated(event: { config: PillarConfig; worldX: number; worldY: number }): void {
    // Store hologram config
    this.activeHologramPillar = event.config;

    // v4.6.2: Store WORLD coordinates (getters will convert to screen in real-time)
    this.hologramWorldX = event.worldX;
    this.hologramWorldY = event.worldY;

    // v4.6.3: Activate cinematic zoom
    this.isZoomed = true;
    this.zoomScale = this.ZOOM_LEVEL;

    // Show hologram
    this.isHologramActive = true;

    // Make robot turn around to face the pillar
    if (this.characterComponent) {
      this.characterComponent.activatePillar(event.config, this.hologramScreenX, this.hologramScreenY);
    }
  }

  /**
   * v4.5: Close hologram
   * v4.6.3: Deactivates zoom effect
   */
  onCloseHologram(): void {
    // v4.6.3: Deactivate cinematic zoom
    this.isZoomed = false;
    this.zoomScale = 1;

    this.isHologramActive = false;
    this.activeHologramPillar = null;

    // Make robot turn back to normal
    if (this.characterComponent) {
      this.characterComponent.deactivatePillar();
    }
  }

  /**
   * v4.5: Handle URL click from hologram
   */
  onHologramUrlClick(url: string): void {
    // URL is opened by the hologram component itself
    // We can close the hologram after a brief delay
    setTimeout(() => {
      this.onCloseHologram();
    }, 500);
  }

  /**
   * v4.5: ESC key closes hologram
   */
  @HostListener('window:keydown.escape')
  onEscapeKey(): void {
    if (this.isHologramActive) {
      this.onCloseHologram();
    }
  }

  // Legacy modal methods (keeping for potential fallback)
  onCloseModal(): void {
    this.isModalOpen = false;
    this.selectedServiceId = null;
  }
}
