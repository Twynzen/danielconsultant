import { Component, OnInit, OnDestroy, inject, signal, computed, HostListener, NgZone, ChangeDetectorRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LightingService } from '../../services/lighting.service';
import { CameraService } from '../../services/camera.service';
import { PhysicsService } from '../../core/services/physics.service';
import { InputService } from '../../core/services/input.service';
import { SIDESCROLLER_CONFIG } from '../../config/sidescroller.config';
import { BinaryCharacterComponent } from '../binary-character/binary-character.component';

type Direction = 'left' | 'right';

/** Welcome messages */
const WELCOME_MESSAGES = [
  '> Hola! Bienvenido al hábitat...',
  '> Soy una IA que vive aquí.',
  '> Usa A/D para caminar, ESPACIO para saltar.',
  '> Explora los pilares y presiona ENTER para descubrir más!'
];

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

  // Dialog state
  showDialog = signal(true);
  displayedText = signal('');
  isTyping = signal(true);
  private currentMessageIndex = 0;
  private currentCharIndex = 0;
  private typingInterval: any = null;
  private dialogDismissed = false;

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
    // v5.0: Dialog is now started after assembly completes (via onAssemblyComplete)
  }

  // v5.0: Called when binary character finishes assembly animation
  onAssemblyComplete(): void {
    this.startWelcomeDialog();
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

  private startWelcomeDialog(): void {
    this.showDialog.set(true);
    this.inputService.pause(); // v4.1 FIX: Pause input during dialog
    this.typeCurrentMessage();
  }

  private typeCurrentMessage(): void {
    if (this.currentMessageIndex >= WELCOME_MESSAGES.length) {
      this.dismissDialog();
      return;
    }

    const message = WELCOME_MESSAGES[this.currentMessageIndex];
    this.currentCharIndex = 0;
    this.displayedText.set('');
    this.isTyping.set(true);

    this.typingInterval = setInterval(() => {
      if (this.currentCharIndex < message.length) {
        this.displayedText.set(message.substring(0, this.currentCharIndex + 1));
        this.currentCharIndex++;
      } else {
        clearInterval(this.typingInterval);
        this.isTyping.set(false);
      }
    }, 35);
  }

  private advanceDialog(): void {
    if (this.isTyping()) {
      clearInterval(this.typingInterval);
      this.displayedText.set(WELCOME_MESSAGES[this.currentMessageIndex]);
      this.isTyping.set(false);
    } else {
      this.currentMessageIndex++;
      if (this.currentMessageIndex < WELCOME_MESSAGES.length) {
        this.typeCurrentMessage();
      } else {
        this.dismissDialog();
      }
    }
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
    // v4.1 FIX: Handle dialog advancement with ANY key
    if (this.showDialog()) {
      event.preventDefault();
      this.advanceDialog();
      return;
    }
  }

  // v5.0: Mouse drag handlers
  @HostListener('window:mousedown', ['$event'])
  onMouseDown(event: MouseEvent): void {
    if (this.showDialog()) return;
    if (this.binaryCharacter?.isCrashing?.()) return;  // v5.1: No grab during crash
    if (this.isCooldown()) return;  // v5.1: No grab during cooldown

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
}
