import { Component, inject, ChangeDetectionStrategy, ChangeDetectorRef, OnInit, OnDestroy, NgZone, ViewChild, HostListener, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { CircuitsBackgroundComponent } from '../circuits-background/circuits-background.component';
import { ModalServiceComponent } from '../modal-service/modal-service.component';
// v4.7: Replaced by HieroglyphicWall
// import { HologramProjectionComponent } from '../hologram-projection/hologram-projection.component';
import { HieroglyphicWallComponent } from '../hieroglyphic-wall/hieroglyphic-wall.component';
import { FlameHeadCharacterComponent } from '../flame-head-character/flame-head-character.component';
import { PillarSystemComponent } from '../pillar-system/pillar-system.component';
import { SendellDialogComponent } from '../sendell-dialog/sendell-dialog.component';
import { TorchSystemComponent } from '../torch-system/torch-system.component';
import { PillarConfig, PILLAR_INTERACTION, PILLARS } from '../../config/pillar.config';
import { CameraService } from '../../services/camera.service';
import { PhysicsService } from '../../core/services/physics.service';
import { SIDESCROLLER_CONFIG } from '../../config/sidescroller.config';
import { OnboardingService, OnboardingPhase } from '../../services/onboarding.service';
// v2.0: AI action types
import { RobotAction, RobotActionType } from '../../config/sendell-ai.config';

@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [
    CommonModule,
    CircuitsBackgroundComponent,
    ModalServiceComponent,
    // v4.7: Replaced HologramProjection with HieroglyphicWall
    HieroglyphicWallComponent,
    FlameHeadCharacterComponent,
    PillarSystemComponent,
    // v5.0: Onboarding dialog system
    SendellDialogComponent,
    // v5.1: Single torch in top-right corner
    TorchSystemComponent
  ],
  templateUrl: './landing-page.component.html',
  styleUrl: './landing-page.component.scss'
})
export class LandingPageComponent implements OnInit, OnDestroy {
  private cameraService = inject(CameraService);
  private physicsService = inject(PhysicsService);  // v2.0: For AI-controlled movement
  private cdr = inject(ChangeDetectorRef);
  private ngZone = inject(NgZone);
  private router = inject(Router);  // v5.1: For internal route navigation

  // v5.0: Onboarding service for first-time visitor experience
  readonly onboarding = inject(OnboardingService);

  // v5.0: Computed signals for onboarding visibility
  readonly groundOpacity = computed(() => this.onboarding.groundOpacity());
  readonly titleOpacity = computed(() => this.onboarding.titleOpacity());
  readonly pillarsBaseIllumination = computed(() => this.onboarding.pillarsIllumination());
  readonly shouldShowCharacter = computed(() => this.onboarding.shouldShowCharacter());
  readonly isDialogCentered = computed(() => this.onboarding.isDialogCentered());
  readonly isOnboardingActive = computed(() => this.onboarding.isOnboardingActive());

  // Reference to character component
  @ViewChild(FlameHeadCharacterComponent) characterComponent!: FlameHeadCharacterComponent;

  // Modal state (legacy - keeping for fallback)
  isModalOpen = false;
  selectedServiceId: string | null = null;
  selectedServiceColor: string = '#00ff44'; // v4.7.2: Dynamic color for modal

  // v4.7: Hieroglyphic wall illuminations (replaces hologram)
  pillarIlluminations = new Map<string, number>();

  // v4.5: Hologram state (DEPRECATED - replaced by hieroglyphic wall)
  isHologramActive = false;
  activeHologramPillar: PillarConfig | null = null;

  // v4.6.2: Store WORLD coordinates (not screen) for proper pillar anchoring
  hologramWorldX = 0;
  hologramWorldY = 0;

  // v5.2: Energization state - which pillar the robot is currently inside
  energizedPillarId = signal<string | null>(null);

  // v4.6.3: Zoom cinematográfico state
  isZoomed = false;
  zoomScale = 1;
  private readonly ZOOM_LEVEL = 1.25;  // 125% zoom for better detail visibility

  // v4.6.2: Reactive getters - recalculate screen position in real-time
  get hologramScreenX(): number {
    return this.cameraService.worldToScreenX(this.hologramWorldX);
  }

  get hologramScreenY(): number {
    // v5.2 FIX: Target the pillar ICON CENTER, not pillar top
    // Pillar top = ground - pillar height
    // Icon is in pillar-top (50px tall), so center is ~25px below pillar top
    const pillarTop = window.innerHeight - SIDESCROLLER_CONFIG.GROUND_HEIGHT - PILLAR_INTERACTION.PILLAR_HEIGHT;
    return pillarTop + 25; // Center of the pillar icon
  }

  // Animation frame for change detection
  private animationFrameId: number | null = null;

  // Camera transform for world scrolling - computed signal
  // v4.6.4: No scale on world - only hologram scales (fixes robot floating issue)
  get cameraTransformValue(): string {
    return this.cameraService.cameraTransform();
  }

  ngOnInit(): void {
    // Start a loop to trigger change detection for camera updates
    this.startRenderLoop();

    // v5.0: Start onboarding experience
    this.onboarding.startOnboarding();
  }

  /**
   * v5.0: Ctrl+Shift+R to reset onboarding (for testing)
   */
  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (event.ctrlKey && event.shiftKey && event.code === 'KeyR') {
      event.preventDefault();
      this.onboarding.resetOnboarding();
      location.reload();
    }
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
   * v5.1: Handles internal route navigation
   */
  onPillarActivated(event: { config: PillarConfig; worldX: number; worldY: number }): void {
    // v5.1: Handle internal routes (navigate to Angular route)
    if (event.config.type === 'internal') {
      this.router.navigate([event.config.destination]);
      return;
    }

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
   * v4.7: Handle illuminations change from pillar system
   * Updates the hieroglyphic wall with new illumination values
   */
  onIlluminationsChanged(illMap: Map<string, number>): void {
    this.pillarIlluminations = illMap;
  }

  /**
   * v4.7.2: Handle service inscription click - opens modal with pillar color
   */
  onServiceClicked(serviceId: string): void {
    this.selectedServiceId = serviceId;

    // v4.7.2: Get pillar color for the service
    const pillar = PILLARS.find(p => p.destination === serviceId);
    this.selectedServiceColor = pillar?.color ?? '#00ff44';

    this.isModalOpen = true;
  }

  /**
   * v4.5: Handle URL click from hologram (DEPRECATED)
   */
  onHologramUrlClick(url: string): void {
    // URL is opened by the hologram component itself
    // We can close the hologram after a brief delay
    setTimeout(() => {
      this.onCloseHologram();
    }, 500);
  }

  // ========== v5.2: ENERGIZATION EVENT HANDLERS ==========

  /**
   * v5.2: Robot started energizing a pillar
   * Called when robot begins decomposing into particles
   */
  onEnergizationStarted(event: { config: PillarConfig }): void {
    // Could add visual effects here (screen shake, flash, etc.)
  }

  /**
   * v5.2: Robot finished entering pillar
   * Called when all particles have reached the pillar
   */
  onEnergizationFinished(event: { config: PillarConfig }): void {
    this.energizedPillarId.set(event.config.id);

    // Activate zoom for better hologram viewing
    this.isZoomed = true;
    this.zoomScale = this.ZOOM_LEVEL;
  }

  /**
   * v5.2: Robot started exiting pillar
   * Called when user presses E to exit
   */
  onPillarExitStarted(): void {
    // Could add visual effects here
  }

  /**
   * v5.2: Robot finished exiting pillar
   * Called when robot is fully recomposed
   */
  onPillarExitFinished(): void {
    this.energizedPillarId.set(null);

    // Deactivate zoom
    this.isZoomed = false;
    this.zoomScale = 1;
  }

  /**
   * v5.2: User pressed E to exit pillar
   * Called from pillar-system when E is pressed while inside pillar
   */
  onPillarExitRequested(): void {
    if (this.characterComponent) {
      this.characterComponent.exitPillar();
    }
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

  // ========== v2.0: AI ACTION HANDLERS ==========

  /**
   * v2.0: Handle AI-requested robot actions
   * Called when Sendell AI decides to move or interact with something
   */
  onAIActionRequested(action: RobotAction): void {
    console.log('AI Action requested:', action);

    switch (action.type) {
      case 'walk_to_pillar':
        this.walkToPillar(action.target);
        break;
      case 'energize_pillar':
        this.energizePillarByAI(action.target);
        break;
      case 'jump':
        this.triggerJump();
        break;
      case 'wave':
        // Wave animation would be handled by BinaryCharacterComponent
        // For now, just log it
        console.log('AI: Sendell waves');
        break;
      case 'crash':
        this.triggerCrash();
        break;
      case 'idle':
        // Do nothing
        break;
      default:
        console.log('Unknown AI action:', action.type);
    }
  }

  /**
   * v2.0: Walk robot to a specific pillar
   */
  private walkToPillar(pillarId: string | undefined): void {
    if (!pillarId) return;

    const pillar = PILLARS.find(p => p.id === pillarId);
    if (!pillar) {
      console.warn('Pillar not found:', pillarId);
      return;
    }

    // Get pillar world X position
    const targetX = pillar.worldX;

    // Animate walk to pillar
    this.animateWalkTo(targetX);
  }

  /**
   * v2.0: Smoothly animate robot walking to a position
   */
  private animateWalkTo(targetX: number): void {
    const currentState = this.physicsService.state();
    const startX = currentState.x;
    const distance = targetX - startX;
    const duration = Math.abs(distance) * 2; // ~2ms per pixel
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease out cubic for smooth deceleration
      const eased = 1 - Math.pow(1 - progress, 3);
      const newX = startX + distance * eased;

      // Update physics position directly
      this.physicsService.setPosition(newX, currentState.y);

      // Update camera to follow
      this.cameraService.updateCamera(newX, distance > 0 ? 100 : -100, 0.016);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }

  /**
   * v2.0: Energize a pillar via AI command
   */
  private energizePillarByAI(pillarId: string | undefined): void {
    if (!pillarId || !this.characterComponent) return;

    const pillar = PILLARS.find(p => p.id === pillarId);
    if (!pillar) return;

    // First walk to pillar, then energize
    this.walkToPillar(pillarId);

    // After walk completes, activate pillar
    setTimeout(() => {
      const pillarScreenX = this.cameraService.worldToScreenX(pillar.worldX);
      const pillarTop = window.innerHeight - SIDESCROLLER_CONFIG.GROUND_HEIGHT - PILLAR_INTERACTION.PILLAR_HEIGHT;
      const pillarScreenY = pillarTop + 25;

      this.characterComponent.activatePillar(pillar, pillarScreenX, pillarScreenY);
    }, Math.abs(this.physicsService.state().x - pillar.worldX) * 2 + 500);
  }

  /**
   * v2.0: Trigger jump animation
   */
  private triggerJump(): void {
    // The physics service handles jump via input
    // We can simulate a jump by directly applying velocity
    const state = this.physicsService.state();
    this.physicsService.setPosition(state.x, state.y);
    // Note: For actual jump, we'd need to expose a jump method in PhysicsService
    console.log('AI: Sendell jumps');
  }

  /**
   * v2.0: Trigger crash animation via AI
   */
  private triggerCrash(): void {
    if (this.characterComponent?.binaryCharacter) {
      this.characterComponent.binaryCharacter.triggerCrash();
    }
  }
}
