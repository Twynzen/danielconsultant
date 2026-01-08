import { Component, OnInit, OnDestroy, inject, signal, computed, HostListener, NgZone, ChangeDetectorRef, ViewChild, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LightingService } from '../../services/lighting.service';
import { CameraService } from '../../services/camera.service';
import { PhysicsService } from '../../core/services/physics.service';
import { InputService } from '../../core/services/input.service';
import { OnboardingService } from '../../services/onboarding.service';
import { SendellStateService, SendellState } from '../../services/sendell-state.service';
import { SIDESCROLLER_CONFIG } from '../../config/sidescroller.config';
import { BinaryCharacterComponent } from '../binary-character/binary-character.component';
import { FacingDirection } from '../../config/character-matrix.config';
import { PillarConfig } from '../../config/pillar.config';

type Direction = 'left' | 'right';

@Component({
  selector: 'app-flame-head-character',
  standalone: true,
  imports: [CommonModule, BinaryCharacterComponent],
  templateUrl: './flame-head-character.component.html',
  styleUrls: ['./flame-head-character.component.scss']
})
export class FlameHeadCharacterComponent implements OnInit, OnDestroy {
  private lightingService = inject(LightingService);
  private cameraService = inject(CameraService);
  physicsService = inject(PhysicsService); // Public for template access
  private inputService = inject(InputService);
  private ngZone = inject(NgZone);
  private cdr = inject(ChangeDetectorRef);
  // v5.0: Onboarding service for first-time visitor experience
  // v5.1: Made public for template access to isSendellTalking()
  readonly onboarding = inject(OnboardingService);
  // v5.9: Central state service for guardrails
  private readonly stateService = inject(SendellStateService);

  // Character dimensions (v3.0 - clarity & separation)
  private readonly CHARACTER_WIDTH = 180;
  private readonly CHARACTER_HEIGHT = 220;

  // Screen position - X based on world position and camera, Y varies with jump
  screenX = computed(() => {
    // v4.1 FIX: Calculate screen position based on world position and camera
    // This fixes the "invisible character" bug when camera is clamped at edges
    const playerWorldX = this.physicsService.state().x;
    const cameraX = this.cameraService.cameraX();
    // Screen position = world position - camera offset - half character width (to center)
    return playerWorldX - cameraX - this.CHARACTER_WIDTH / 2;
  });
  screenY = computed(() => {
    const state = this.physicsService.state();
    // Y position relative to ground (character feet at ground level)
    const characterBottom = state.y;
    // Convert to screen Y (screen bottom = ground, character moves up when jumping)
    return characterBottom - this.CHARACTER_HEIGHT;
  });

  // World position (for other systems)
  x = computed(() => this.physicsService.state().x);
  y = computed(() => this.physicsService.state().y);

  // Movement state
  facing = signal<Direction>('right');
  isMoving = signal(false);
  isJumping = computed(() => this.physicsService.isJumping());
  isGrounded = computed(() => this.physicsService.isGrounded());

  // Dialog state (v5.0: now only used for crash dialog, onboarding uses SendellDialog)
  showDialog = signal(false);  // v5.0: Start hidden
  displayedText = signal('');
  isTyping = signal(false);  // v5.1: Start false, only true during crash dialog
  private currentMessageIndex = 0;
  private currentCharIndex = 0;
  private typingInterval: any = null;
  private dialogDismissed = false;

  // v5.0: Computed that only shows dialog when NOT in onboarding (for crash dialog only)
  shouldShowCrashDialogUI = computed(() =>
    this.showDialog() && !this.onboarding.isOnboardingActive()
  );

  // v5.0: Drag and drop state
  isDragging = signal(false);
  private dragOffsetX = 0;
  private dragOffsetY = 0;
  private releaseY = 0;  // Y position when released (for crash detection)
  private wasDropped = false;  // Flag to track if character was just dropped
  private wasInAir = false;  // Track if character was falling

  // v5.1: Cooldown after crash (block input for 2 seconds after reassembly)
  isCooldown = signal(false);
  private cooldownTimeout: ReturnType<typeof setTimeout> | null = null;

  // v4.5: Hologram activation - robot turns back to face pillar
  isActivatingPillar = signal(false);
  activePillarConfig = signal<PillarConfig | null>(null);
  robotFacing = signal<FacingDirection>('right'); // Controls TORSO_BACK when 'back'
  @Output() hologramActivated = new EventEmitter<{ config: PillarConfig; screenX: number; screenY: number }>();
  @Output() hologramDeactivated = new EventEmitter<void>();

  // v5.2: Energization state - robot decomposes into pillar
  isRobotInsidePillar = signal(false);  // Robot is currently energizing a pillar
  private currentPillarScreenX = 0;
  private currentPillarScreenY = 0;
  @Output() energizationStarted = new EventEmitter<{ config: PillarConfig }>();
  @Output() energizationFinished = new EventEmitter<{ config: PillarConfig }>();
  @Output() pillarExitStarted = new EventEmitter<void>();
  @Output() pillarExitFinished = new EventEmitter<void>();
  // v5.4.5: Double-click on robot to open chat
  @Output() robotDoubleClicked = new EventEmitter<void>();

  // Reference to binary character for crash trigger
  @ViewChild(BinaryCharacterComponent) binaryCharacter!: BinaryCharacterComponent;

  // Jump tracking - to detect "just pressed"
  private wasJumpPressed = false;

  // Computed classes
  characterClasses = computed(() => {
    const classes: string[] = ['character'];

    if (this.isMoving() || this.isJumping()) {
      classes.push('walking');
    }

    // Side-scroller: always facing-side view
    classes.push('facing-side');

    if (this.isJumping()) {
      classes.push('jumping');
    }

    return classes.join(' ');
  });

  // Transform for flipping character
  characterTransform = computed(() => {
    return this.physicsService.facingRight() ? 'scaleX(1)' : 'scaleX(-1)';
  });

  // Game loop
  private animationFrameId: number | null = null;
  private lastTime = 0;

  ngOnInit(): void {
    this.startGameLoop();
    this.updateLightPosition();
    // v5.0: Dialog is now handled by SendellDialog via OnboardingService
  }

  // v5.0: Called when binary character finishes assembly animation
  // Now notifies OnboardingService instead of starting old welcome dialog
  onAssemblyComplete(): void {
    // Notify onboarding service that assembly is complete
    // This will transition to PRESENTATION phase after a short delay
    this.onboarding.onAssemblyComplete();
  }

  // v5.0: Called when crash animation completes
  onCrashComplete(): void {
    // v5.1: Activate 2-second cooldown after reassembly
    this.isCooldown.set(true);
    this.cooldownTimeout = setTimeout(() => {
      this.isCooldown.set(false);
    }, 2000);

    // Show angry dialog
    this.showCrashDialog();
  }

  // v5.4.5: Called when user double-clicks on the robot
  onRobotDoubleClicked(): void {
    console.log('[FlameHead] Propagating double-click event');
    this.robotDoubleClicked.emit();
  }

  private showCrashDialog(): void {
    this.showDialog.set(true);
    this.inputService.pause();
    this.displayedText.set('');
    this.isTyping.set(true);

    const message = '> ¡Ey, no hagas eso! 😠';
    let charIndex = 0;

    this.typingInterval = setInterval(() => {
      if (charIndex < message.length) {
        this.displayedText.set(message.substring(0, charIndex + 1));
        charIndex++;
      } else {
        clearInterval(this.typingInterval);
        this.isTyping.set(false);
        // Auto-dismiss after 2 seconds
        setTimeout(() => {
          this.dismissDialog();
        }, 2000);
      }
    }, 50);
  }

  ngOnDestroy(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    if (this.typingInterval) {
      clearInterval(this.typingInterval);
    }
    // v5.1: Clean up cooldown timeout
    if (this.cooldownTimeout) {
      clearTimeout(this.cooldownTimeout);
    }
  }

  // v5.0: Old welcome dialog methods removed - now handled by SendellDialogComponent

  // v5.0: Simplified - only used for crash dialog advancement
  private advanceDialog(): void {
    // For crash dialog, just dismiss immediately on key press
    this.dismissDialog();
  }

  private dismissDialog(): void {
    this.showDialog.set(false);
    this.dialogDismissed = true;
    this.inputService.resume(); // v4.1 FIX: Resume input after dialog
    if (this.typingInterval) {
      clearInterval(this.typingInterval);
    }
  }

  @HostListener('window:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    // v5.0: Only handle dialog advancement for crash dialog (not during onboarding)
    // Onboarding dialogs are handled by SendellDialogComponent
    if (this.showDialog() && !this.onboarding.isOnboardingActive()) {
      event.preventDefault();
      this.advanceDialog();
      return;
    }
  }

  // v5.0: Mouse drag handlers
  @HostListener('window:mousedown', ['$event'])
  onMouseDown(event: MouseEvent): void {
    if (this.showDialog()) return;
    if (this.onboarding.isOnboardingActive()) return;  // v5.0: No grab during onboarding
    if (this.binaryCharacter?.isCrashing?.()) return;  // v5.1: No grab during crash
    if (this.isCooldown()) return;  // v5.1: No grab during cooldown

    // v5.9: Guardrail - No drag if pillar action in progress
    if (this.isActivatingPillar() || this.isRobotInsidePillar()) {
      console.log('%c[Guardrail] Drag blocked - pillar action in progress', 'color: #ff6b6b');
      return;
    }

    // v5.9: Guardrail - No drag if energizing
    if (this.binaryCharacter?.isEnergizing?.()) {
      console.log('%c[Guardrail] Drag blocked - energizing in progress', 'color: #ff6b6b');
      return;
    }

    // v5.9: Check state service for additional blocking conditions
    const canDrag = this.stateService.canExecuteAction('drag');
    if (!canDrag.allowed) {
      console.log(`%c[Guardrail] Drag blocked - ${canDrag.reason}`, 'color: #ff6b6b');
      return;
    }

    // Check if click is on character
    const charScreenX = this.screenX();
    const charScreenY = this.screenY();

    // Character bounding box (approximate)
    const charLeft = charScreenX;
    const charRight = charScreenX + this.CHARACTER_WIDTH;
    const charTop = charScreenY;
    const charBottom = charScreenY + this.CHARACTER_HEIGHT;

    if (event.clientX >= charLeft && event.clientX <= charRight &&
      event.clientY >= charTop && event.clientY <= charBottom) {
      this.isDragging.set(true);
      this.dragOffsetX = event.clientX - charScreenX;
      this.dragOffsetY = event.clientY - charScreenY;
      this.inputService.pause();
      // v5.9: Register drag action with state service
      this.stateService.startAction('drag');
      this.stateService.requestTransition(SendellState.BEING_DRAGGED, 'mouse_drag_start');
    }
  }

  @HostListener('window:mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    if (!this.isDragging()) return;

    // Calculate new position based on mouse (both X and Y)
    const newScreenX = event.clientX - this.dragOffsetX;
    const newScreenY = event.clientY - this.dragOffsetY;
    const groundY = this.physicsService.getGroundY();

    // Don't allow dragging below ground
    const maxY = groundY - this.CHARACTER_HEIGHT;
    const clampedY = Math.min(newScreenY, maxY);

    // Convert screen position to world position
    const cameraX = this.cameraService.cameraX();
    const worldX = newScreenX + cameraX + this.CHARACTER_WIDTH / 2;
    const worldY = clampedY + this.CHARACTER_HEIGHT;

    // Clamp X to level bounds
    const clampedWorldX = Math.max(0, Math.min(worldX, 6000));

    // Update physics position directly
    this.physicsService.setPosition(clampedWorldX, worldY);
  }

  @HostListener('window:mouseup', ['$event'])
  onMouseUp(event: MouseEvent): void {
    if (!this.isDragging()) return;

    this.isDragging.set(false);
    this.inputService.resume();
    // v5.9: End drag action with state service
    this.stateService.endAction('drag');
    this.stateService.requestTransition(SendellState.IDLE, 'mouse_drag_end');

    // Store the release Y position for crash detection on landing
    const state = this.physicsService.state();
    this.releaseY = state.y;
    this.wasDropped = true;

    // Release the character - physics will handle the fall
    this.physicsService.setPositionFromDrag(state.x, state.y);
  }

  private startGameLoop(): void {
    this.lastTime = performance.now();

    const loop = (currentTime: number) => {
      const deltaTime = Math.min((currentTime - this.lastTime) / 1000, 0.1);
      this.lastTime = currentTime;

      this.update(deltaTime);

      this.animationFrameId = requestAnimationFrame(loop);
    };

    // Start the loop
    this.animationFrameId = requestAnimationFrame(loop);
  }

  private update(deltaTime: number): void {
    // v4.1 FIX: Always update light position, even during dialog
    // This keeps the character light synced with physics state
    this.updateLightPosition();

    // Don't process movement while dialog is showing or dragging
    if (this.showDialog()) return;
    if (this.isDragging()) return;  // v5.0: Skip physics while dragging
    if (this.binaryCharacter?.isCrashing?.()) return;  // v5.1: Block during crash
    if (this.isCooldown()) return;  // v5.1: Block during 2-second cooldown after crash
    // v5.4.3: Block movement during energization or while inside pillar
    if (this.binaryCharacter?.isEnergizing?.() || this.isRobotInsidePillar()) return;
    // v5.2.3: Block user movement during onboarding
    // v5.4.0: BUT allow Sendell to move when executing simulated actions
    if (this.onboarding.isOnboardingActive() && !this.inputService.isSendellExecuting()) return;

    // Get input from InputService
    const inputState = this.inputService.inputState();
    const horizontalInput = (inputState.left ? -1 : 0) + (inputState.right ? 1 : 0);

    // Detect jump "just pressed" (rising edge)
    const jumpCurrentlyPressed = inputState.jump;
    const jumpJustPressed = jumpCurrentlyPressed && !this.wasJumpPressed;
    this.wasJumpPressed = jumpCurrentlyPressed;

    // Update physics
    this.physicsService.update(deltaTime, horizontalInput, jumpJustPressed);

    // Get updated state
    const state = this.physicsService.state();

    // Update movement state
    this.isMoving.set(Math.abs(state.velocityX) > 10);

    // Update facing direction
    if (state.velocityX > 0) {
      this.facing.set('right');
    } else if (state.velocityX < 0) {
      this.facing.set('left');
    }

    // Update camera
    this.cameraService.updateCamera(
      state.x,
      state.velocityX,
      deltaTime
    );

    // v5.0: Detect landing after drop for crash
    this.checkDropLanding(state);

    // Light position already updated at start of update()

    // Trigger change detection to update the view
    // This is necessary because requestAnimationFrame runs outside Angular zone
    this.ngZone.run(() => {
      this.cdr.markForCheck();
    });
  }

  // v5.0: Check if character just landed after being dropped
  private checkDropLanding(state: any): void {
    const isCurrentlyGrounded = state.isGrounded;

    // Detect transition from air to ground
    if (this.wasDropped && this.wasInAir && isCurrentlyGrounded) {
      // Calculate fall height
      const groundY = this.physicsService.getGroundY();
      const fallHeight = groundY - this.releaseY;

      // Trigger crash if fell from high enough (200px threshold)
      if (fallHeight >= 200 && this.binaryCharacter) {
        this.binaryCharacter.triggerCrash();
      }

      // Reset drop tracking
      this.wasDropped = false;
    }

    // Track if in air
    this.wasInAir = !isCurrentlyGrounded;
  }

  private updateLightPosition(): void {
    const state = this.physicsService.state();
    const centerX = state.x + this.CHARACTER_WIDTH / 2;
    const centerY = state.y - this.CHARACTER_HEIGHT / 2;

    this.lightingService.updateCharacterLight(centerX, centerY);
  }

  // ========== V4.5 HOLOGRAM ACTIVATION ==========
  // ========== V5.2 PILLAR ENERGIZATION ==========

  /**
   * v5.2: Activate pillar with energization animation
   * Robot decomposes into particles and flows into the pillar
   * Called from LandingPage when player presses E near a pillar
   */
  activatePillar(pillar: PillarConfig, pillarScreenX: number, pillarScreenY: number): void {
    if (this.isRobotInsidePillar() || this.binaryCharacter?.isCrashing?.()) return;

    this.isActivatingPillar.set(true);
    this.activePillarConfig.set(pillar);
    // v5.4.3: Clear ALL inputs (including simulated) before energizing
    this.inputService.clearSimulatedInputs();
    this.inputService.pause(); // Block movement during energization

    // v5.8.3: Reset movement state immediately to stop walking animation
    // The update() loop exits early during energizing, so isMoving never gets reset
    this.isMoving.set(false);

    // Store pillar position for exit animation
    this.currentPillarScreenX = pillarScreenX;
    this.currentPillarScreenY = pillarScreenY;

    // v5.2 FIX: Calculate position relative to CHARACTER CENTER, not container corner
    // screenX/screenY return the top-left of the container, but particles are in the CENTER
    // We need to offset by half the character dimensions to get the center point
    const robotContainerX = this.screenX();
    const robotContainerY = this.screenY();

    // Character center is offset from container corner
    // X: center of character width
    // Y: upper third where eyes/head are (particles originate from whole body but converge to pillar)
    const robotCenterX = robotContainerX + this.CHARACTER_WIDTH / 2;
    const robotCenterY = robotContainerY + this.CHARACTER_HEIGHT * 0.4; // Upper-middle of character

    // Calculate relative offset from robot center to pillar icon
    const relativeX = pillarScreenX - robotCenterX;
    const relativeY = pillarScreenY - robotCenterY;

    this.binaryCharacter?.triggerEnergize(relativeX, relativeY);

    // Emit start event
    this.energizationStarted.emit({ config: pillar });
  }

  /**
   * v5.2: Called when robot finishes entering pillar
   * Triggered by binaryCharacter's energizationComplete event
   */
  onEnergizationComplete(): void {
    this.isRobotInsidePillar.set(true);
    const pillar = this.activePillarConfig();

    if (pillar) {
      this.energizationFinished.emit({ config: pillar });

      // Emit hologram activated for landing page to show full hologram
      this.hologramActivated.emit({
        config: pillar,
        screenX: this.currentPillarScreenX,
        screenY: this.currentPillarScreenY
      });
    }
  }

  /**
   * v5.2: Exit pillar - robot recomposes from pillar
   * Called when user presses E while inside pillar
   */
  exitPillar(): void {
    if (!this.isRobotInsidePillar()) return;

    // Start exit animation
    this.binaryCharacter?.triggerExitPillar();
    this.pillarExitStarted.emit();
  }

  /**
   * v5.2: Called when robot finishes exiting pillar
   * Triggered by binaryCharacter's exitPillarComplete event
   */
  onExitPillarComplete(): void {
    this.isRobotInsidePillar.set(false);
    this.isActivatingPillar.set(false);
    this.activePillarConfig.set(null);
    this.robotFacing.set('right'); // Robot turns back to normal
    this.inputService.resume(); // Allow movement again

    this.pillarExitFinished.emit();
    this.hologramDeactivated.emit();
  }

  /**
   * Deactivate pillar - robot turns back to face front
   * v5.2: Now triggers exit animation if inside pillar
   */
  deactivatePillar(): void {
    if (this.isRobotInsidePillar()) {
      // If inside pillar, trigger exit animation
      this.exitPillar();
    } else {
      // If not inside (e.g., during energization), just cancel
      this.isActivatingPillar.set(false);
      this.activePillarConfig.set(null);
      this.robotFacing.set('right');
      this.inputService.resume();
      this.hologramDeactivated.emit();
    }
  }

  /**
   * Check if hologram is currently active
   */
  isHologramActive(): boolean {
    return this.isActivatingPillar();
  }

  /**
   * v5.2: Check if robot is currently inside a pillar
   */
  isInsidePillar(): boolean {
    return this.isRobotInsidePillar();
  }
}
