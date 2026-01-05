import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  inject,
  signal,
  HostListener,
  ElementRef,
  computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  getBodyGrid,
  getLegFrames,
  getArmFrames,
  BinaryDigit,
  DigitType,
  CHARACTER_CONFIG,
  FacingDirection,
  ASSEMBLY_CONFIG
} from '../../config/character-matrix.config';

// Emotional states for the character
export enum CharacterEmotion {
  IDLE = 'idle',
  CURIOUS = 'curious',
  EXCITED = 'excited',
  TIRED = 'tired',
  STARTLED = 'startled'
}

// v5.0: Assembly phases
export enum AssemblyPhase {
  SCATTERED = 'scattered',
  ASSEMBLING = 'assembling',
  ASSEMBLED = 'assembled',
  LANDING_SCATTER = 'landing',
  REASSEMBLING = 'reassembling'
}

// v5.0: Particle state for scatter/assembly animations
interface ParticleState {
  scatterX: number;
  scatterY: number;
  currentX: number;
  currentY: number;
}

@Component({
  selector: 'app-binary-character',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './binary-character.component.html',
  styleUrls: ['./binary-character.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BinaryCharacterComponent implements OnInit, OnDestroy {
  private cdr = inject(ChangeDetectorRef);
  private elementRef = inject(ElementRef);

  // Input from parent
  @Input() isMoving = false;
  @Input() isJumping = false;
  @Input() facingRight = true;
  @Input() isTalking = false; // v4.1: For mouth animation during dialog
  @Input() characterScreenY = 0; // v5.1: Screen Y position for crash ground calculation
  @Input() facing: FacingDirection = 'right'; // v4.5: For hologram activation (can be 'back')

  // Character grids
  bodyGrid: BinaryDigit[][] = [];
  armsGrid: BinaryDigit[][] = []; // v4.1: Separate arm grid
  legsGrid: BinaryDigit[][] = [];

  // Animation states
  isBlinking = signal(false);
  glitchDigits = signal<Set<string>>(new Set());

  // v4.1: Mouth animation
  mouthFrame = signal(0); // 0=closed, 1=open, 2=wide
  private lastMouthTime = 0;
  private readonly MOUTH_FRAME_DURATION = 80; // ms per frame

  // Walk animation
  private walkFrames: BinaryDigit[][][] = [];
  private armFrames: BinaryDigit[][][] = []; // v4.1: Arm animation frames
  private walkFrameIndex = 0;
  private lastWalkFrameTime = 0;

  // v4.1: Track previous facing for body pose changes
  private lastFacingRight = true;
  private wasMoving = false;

  // v4.5: Track facing direction changes (for hologram back pose)
  private lastFacingDirection: FacingDirection = 'right';

  // Animation loop
  private animationFrameId: number | null = null;
  private lastBlinkTime = 0;
  private lastGlitchTime = 0;
  private isDestroyed = false;

  // Landing effect
  private wasJumping = false;
  isLanding = signal(false);

  // v5.0: Landing scatter animation
  private landingPhase = signal<AssemblyPhase>(AssemblyPhase.ASSEMBLED);
  private landingStartTime = 0;
  private particleStates = new Map<string, ParticleState>();

  // v5.0: Spawn assembly animation
  @Input() enableSpawnAssembly = true;  // Can be disabled for testing
  @Output() assemblyComplete = new EventEmitter<void>();
  assemblyPhase = signal<AssemblyPhase>(AssemblyPhase.SCATTERED);
  private spawnStartTime = 0;
  private spawnParticleStates = new Map<string, ParticleState & { delay: number; arrived: boolean }>();
  isAssembled = signal(false);

  // v5.0: Crash animation (high fall with physics)
  @Output() crashComplete = new EventEmitter<void>();
  isCrashing = signal(false);  // Public for template
  private crashStartTime = 0;
  private crashPhase: 'exploding' | 'falling' | 'settling' | 'reassembling' = 'exploding';
  private crashParticleStates = new Map<string, {
    x: number;
    y: number;
    velocityX: number;
    velocityY: number;
    settled: boolean;
    groundY: number;  // Individual ground level for each piece
  }>();

  // ========== V4.0 - GIVING LIFE ==========

  // Eye tracking
  private mousePosition = { x: 0, y: 0 };
  private eyeTarget = { x: 0, y: 0 };
  eyeOffset = signal({ x: 0, y: 0 });
  private readonly EYE_MAX_RANGE = 3; // pixels
  private readonly EYE_SMOOTHING = 0.12; // LERP factor

  // Emotional state
  emotion = signal<CharacterEmotion>(CharacterEmotion.IDLE);

  // Proximity detection
  private distanceToMouse = 9999;

  // Inactivity detection
  private inactivityTimer: any = null;
  private lastMouseMoveTime = 0;
  private readonly TIRED_THRESHOLD = 5000; // 5 seconds

  // Computed emotion class for template
  emotionClass = computed(() => this.emotion());

  // v4.1: When idle, face towards mouse. When moving, face movement direction
  // v4.5: When facing='back', no flip needed
  get characterTransform(): string {
    // When facing back (hologram activation), no flip
    if (this.facing === 'back') {
      return 'scaleX(1)';
    }

    let shouldFaceRight = this.facingRight;

    // When idle (not moving), look towards the mouse
    if (!this.isMoving) {
      const element = this.elementRef.nativeElement as HTMLElement;
      const rect = element.getBoundingClientRect();
      const characterCenterX = rect.left + rect.width / 2;

      // Face towards mouse position
      shouldFaceRight = this.mousePosition.x > characterCenterX;
    }

    return shouldFaceRight ? 'scaleX(1)' : 'scaleX(-1)';
  }

  // Eye transform style
  getEyeTransform(): string {
    const offset = this.eyeOffset();
    // Flip X when facing left
    const x = this.facingRight ? offset.x : -offset.x;
    return `translate(${x}px, ${offset.y}px)`;
  }

  // Mouse tracking
  @HostListener('window:mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    this.mousePosition = { x: event.clientX, y: event.clientY };
    this.lastMouseMoveTime = performance.now();

    // Reset inactivity timer
    this.resetInactivityTimer();
  }

  // Click reaction
  @HostListener('click')
  onClick(): void {
    this.triggerStartled();
  }

  ngOnInit(): void {
    this.initializeCharacter();

    // v5.0: Start with spawn assembly if enabled
    if (this.enableSpawnAssembly) {
      this.initializeSpawnAssembly();
    } else {
      this.assemblyPhase.set(AssemblyPhase.ASSEMBLED);
      this.isAssembled.set(true);
    }

    this.startAnimationLoop();
    this.lastMouseMoveTime = performance.now();
    this.resetInactivityTimer();
  }

  ngOnDestroy(): void {
    this.isDestroyed = true;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
    }
  }

  private initializeCharacter(): void {
    // v4.1: Always use 'right' pose - scaleX handles direction
    this.bodyGrid = getBodyGrid('right');
    this.walkFrames = getLegFrames();
    this.armFrames = getArmFrames(); // v4.1: Initialize arm frames
    this.legsGrid = this.walkFrames[0];
    this.armsGrid = this.armFrames[0]; // v4.1: Start with neutral arms
  }

  private startAnimationLoop(): void {
    const loop = (currentTime: number) => {
      if (this.isDestroyed) return;

      this.checkBlink(currentTime);

      // V4.0: Update eye tracking
      this.updateEyeTracking();

      // V4.0: Update emotion based on proximity
      this.updateEmotion(currentTime);

      // V4.1: Update body pose based on movement direction
      this.updateBodyPose();

      // V4.1: Update mouth animation during dialog
      this.updateMouthAnimation(currentTime);

      // V5.0: Update assembly animations
      this.updateSpawnAssembly(currentTime);
      this.updateLandingAnimation(currentTime);
      this.updateCrashAnimation(currentTime);
      this.updateReassembly(currentTime);

      if (this.isMoving) {
        this.applyGlitch(currentTime);
        this.updateWalkAnimation(currentTime);
      } else {
        if (this.glitchDigits().size > 0) {
          this.glitchDigits.set(new Set());
        }
        this.walkFrameIndex = 0;
        this.legsGrid = this.walkFrames[0];
        this.armsGrid = this.armFrames[0]; // v4.1: Reset arms to neutral
      }

      this.checkLanding();

      // Track state for next frame
      this.wasMoving = this.isMoving;
      this.lastFacingRight = this.facingRight;

      this.cdr.markForCheck();
      this.animationFrameId = requestAnimationFrame(loop);
    };

    this.animationFrameId = requestAnimationFrame(loop);
  }

  // ========== V4.1 BODY POSE ==========

  private updateBodyPose(): void {
    // v4.5 FIX: Track facing changes to properly update grid
    // Problem: Before this fix, bodyGrid never updated when going from 'back' to 'right'
    // because the condition `if (!this.bodyGrid)` was always false after first init.

    // Determine desired facing: 'back' for hologram, 'right' for everything else
    const desiredFacing: FacingDirection = this.facing === 'back' ? 'back' : 'right';

    // Update grid if:
    // 1. Facing changed (e.g., 'right' -> 'back' or 'back' -> 'right')
    // 2. OR bodyGrid is empty/uninitialized
    if (desiredFacing !== this.lastFacingDirection || !this.bodyGrid?.length) {
      this.bodyGrid = getBodyGrid(desiredFacing);
      this.lastFacingDirection = desiredFacing;
    }

    // Note: scaleX transform handles left/right visual flip for movement
    // - Walk right: RIGHT pose + scaleX(1) = looks right ✓
    // - Walk left: RIGHT pose + scaleX(-1) = eyes flip to left ✓
    // - Hologram: BACK pose (no eyes visible) ✓
  }

  // ========== V4.1 MOUTH ANIMATION ==========

  private updateMouthAnimation(currentTime: number): void {
    if (!this.isTalking) {
      // Reset to closed mouth when not talking
      if (this.mouthFrame() !== 0) {
        this.mouthFrame.set(0);
      }
      return;
    }

    // Animate mouth while talking
    const timeSinceMouth = currentTime - this.lastMouthTime;
    if (timeSinceMouth > this.MOUTH_FRAME_DURATION) {
      // Cycle through mouth frames: 0 -> 1 -> 2 -> 1 -> 0 -> ...
      const frames = [0, 1, 2, 1]; // closed, open, wide, open (loop)
      const currentIdx = frames.indexOf(this.mouthFrame());
      const nextIdx = (currentIdx + 1) % frames.length;
      this.mouthFrame.set(frames[nextIdx]);
      this.lastMouthTime = currentTime;
    }
  }

  // ========== V4.0 EYE TRACKING ==========

  private updateEyeTracking(): void {
    const element = this.elementRef.nativeElement as HTMLElement;
    const rect = element.getBoundingClientRect();

    // Character center (eyes are roughly at top third)
    const eyeCenterX = rect.left + rect.width / 2;
    const eyeCenterY = rect.top + rect.height * 0.25; // Eyes are near top

    // Vector to mouse
    const deltaX = this.mousePosition.x - eyeCenterX;
    const deltaY = this.mousePosition.y - eyeCenterY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    // Store distance for proximity detection
    this.distanceToMouse = distance;

    if (distance > 0) {
      // Calculate angle and target position
      const angle = Math.atan2(deltaY, deltaX);
      this.eyeTarget.x = this.EYE_MAX_RANGE * Math.cos(angle);
      this.eyeTarget.y = this.EYE_MAX_RANGE * Math.sin(angle);
    }

    // LERP to target (smooth movement)
    const current = this.eyeOffset();
    const newX = current.x + (this.eyeTarget.x - current.x) * this.EYE_SMOOTHING;
    const newY = current.y + (this.eyeTarget.y - current.y) * this.EYE_SMOOTHING;

    this.eyeOffset.set({ x: newX, y: newY });
  }

  // ========== V4.0 EMOTIONAL STATES ==========

  private updateEmotion(currentTime: number): void {
    // Don't override startled state (it auto-clears)
    if (this.emotion() === CharacterEmotion.STARTLED) return;

    // Check for tired (inactivity)
    const timeSinceMouseMove = currentTime - this.lastMouseMoveTime;
    if (timeSinceMouseMove > this.TIRED_THRESHOLD) {
      if (this.emotion() !== CharacterEmotion.TIRED) {
        this.emotion.set(CharacterEmotion.TIRED);
      }
      return;
    }

    // Proximity-based emotions
    if (this.distanceToMouse < 80) {
      this.emotion.set(CharacterEmotion.EXCITED);
    } else if (this.distanceToMouse < 200) {
      this.emotion.set(CharacterEmotion.CURIOUS);
    } else {
      this.emotion.set(CharacterEmotion.IDLE);
    }
  }

  private resetInactivityTimer(): void {
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
    }

    // Clear tired state when mouse moves
    if (this.emotion() === CharacterEmotion.TIRED) {
      this.emotion.set(CharacterEmotion.IDLE);
    }

    this.inactivityTimer = setTimeout(() => {
      if (!this.isDestroyed) {
        this.emotion.set(CharacterEmotion.TIRED);
        this.cdr.markForCheck();
      }
    }, this.TIRED_THRESHOLD);
  }

  private triggerStartled(): void {
    this.emotion.set(CharacterEmotion.STARTLED);

    // Auto-reset after flinch animation
    setTimeout(() => {
      if (!this.isDestroyed) {
        this.emotion.set(CharacterEmotion.IDLE);
        this.cdr.markForCheck();
      }
    }, 400);
  }

  private checkBlink(currentTime: number): void {
    const timeSinceBlink = currentTime - this.lastBlinkTime;
    const blinkInterval = CHARACTER_CONFIG.BLINK_INTERVAL_MIN +
      Math.random() * (CHARACTER_CONFIG.BLINK_INTERVAL_MAX - CHARACTER_CONFIG.BLINK_INTERVAL_MIN);

    if (timeSinceBlink > blinkInterval && !this.isBlinking()) {
      this.triggerBlink();
      this.lastBlinkTime = currentTime;
    }
  }

  private triggerBlink(): void {
    this.isBlinking.set(true);
    setTimeout(() => {
      if (!this.isDestroyed) {
        this.isBlinking.set(false);
        this.cdr.markForCheck();

        // V4.1: 20% chance of double blink (like humans)
        if (Math.random() < 0.2) {
          setTimeout(() => {
            if (!this.isDestroyed) {
              this.isBlinking.set(true);
              this.cdr.markForCheck();
              setTimeout(() => {
                if (!this.isDestroyed) {
                  this.isBlinking.set(false);
                  this.cdr.markForCheck();
                }
              }, CHARACTER_CONFIG.BLINK_DURATION);
            }
          }, 150); // Short pause between blinks
        }
      }
    }, CHARACTER_CONFIG.BLINK_DURATION);
  }

  private updateWalkAnimation(currentTime: number): void {
    const timeSinceFrame = currentTime - this.lastWalkFrameTime;

    if (timeSinceFrame > CHARACTER_CONFIG.WALK_FRAME_DURATION) {
      this.walkFrameIndex = (this.walkFrameIndex + 1) % this.walkFrames.length;
      this.legsGrid = this.walkFrames[this.walkFrameIndex];
      // V4.1: Arms animate in sync (opposite to legs)
      this.armsGrid = this.armFrames[this.walkFrameIndex];
      this.lastWalkFrameTime = currentTime;
    }
  }

  private checkLanding(): void {
    if (this.wasJumping && !this.isJumping) {
      this.isLanding.set(true);
      // v5.0: Start scatter animation
      this.startLandingScatter();
    }
    this.wasJumping = this.isJumping;
  }

  // ========== V5.0 LANDING SCATTER ==========

  private startLandingScatter(): void {
    this.landingPhase.set(AssemblyPhase.LANDING_SCATTER);
    this.landingStartTime = performance.now();

    // Calculate scatter vectors for all digits
    this.calculateScatterPositions();
  }

  private calculateScatterPositions(): void {
    this.particleStates.clear();

    // Process all grids (body, arms, legs)
    const grids = [
      { grid: this.bodyGrid, section: 'body' },
      { grid: this.armsGrid, section: 'arms' },
      { grid: this.legsGrid, section: 'legs' }
    ];

    for (const { grid, section } of grids) {
      if (!grid) continue;
      const maxRows = grid.length;
      const maxCols = grid[0]?.length || 0;

      grid.forEach((row, ri) => {
        row.forEach((digit, ci) => {
          if (digit.isEmpty) return;

          const key = `${section}-${ri}-${ci}`;

          // Normalize position (0-1)
          const gridX = ci / maxCols;
          const gridY = ri / maxRows;

          // Vector from center
          const deltaX = gridX - 0.5;
          const deltaY = gridY - 0.5;
          const angle = Math.atan2(deltaY, deltaX);
          const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

          // Magnitude based on type
          const typeMass = ASSEMBLY_CONFIG.TYPE_MASS[digit.type] ?? 0.75;
          const magnitude = ASSEMBLY_CONFIG.LANDING_MAX_SCATTER * typeMass;

          // Calculate scatter position with some randomness
          const randomFactor = 0.7 + Math.random() * 0.6; // 0.7-1.3
          const scatterX = Math.cos(angle) * distance * magnitude * randomFactor;
          const scatterY = Math.sin(angle) * distance * magnitude * randomFactor + (gridY * 15);

          this.particleStates.set(key, {
            scatterX,
            scatterY,
            currentX: 0,
            currentY: 0
          });
        });
      });
    }
  }

  private updateLandingAnimation(currentTime: number): void {
    const phase = this.landingPhase();
    if (phase === AssemblyPhase.ASSEMBLED) return;

    const elapsed = currentTime - this.landingStartTime;
    const scatterDuration = ASSEMBLY_CONFIG.LANDING_SCATTER_DURATION;
    const reassembleDuration = ASSEMBLY_CONFIG.LANDING_REASSEMBLE_DURATION;
    const totalDuration = scatterDuration + reassembleDuration;

    if (elapsed >= totalDuration) {
      // Animation complete
      this.landingPhase.set(AssemblyPhase.ASSEMBLED);
      this.isLanding.set(false);
      this.particleStates.clear();
      return;
    }

    if (elapsed < scatterDuration) {
      // Scatter phase - ease out
      const t = elapsed / scatterDuration;
      const easeOut = 1 - Math.pow(1 - t, 3); // Cubic ease out

      this.particleStates.forEach((state) => {
        state.currentX = state.scatterX * easeOut;
        state.currentY = state.scatterY * easeOut;
      });

      if (phase !== AssemblyPhase.LANDING_SCATTER) {
        this.landingPhase.set(AssemblyPhase.LANDING_SCATTER);
      }
    } else {
      // Reassemble phase - spring physics
      const reassembleElapsed = elapsed - scatterDuration;
      const t = reassembleElapsed / reassembleDuration;

      // Damped oscillation for bounce effect
      const zeta = ASSEMBLY_CONFIG.LANDING_SPRING_DAMPING;
      const omega = 6.28; // ~2π for one full oscillation
      const decay = Math.exp(-zeta * omega * t);
      const oscillation = Math.cos(omega * Math.sqrt(1 - zeta * zeta) * t);
      const progress = 1 - decay * oscillation;

      this.particleStates.forEach((state) => {
        state.currentX = state.scatterX * (1 - progress);
        state.currentY = state.scatterY * (1 - progress);
      });

      if (phase !== AssemblyPhase.REASSEMBLING) {
        this.landingPhase.set(AssemblyPhase.REASSEMBLING);
      }
    }
  }

  /**
   * v5.0: Get transform for a digit during animations (spawn, landing, or crash)
   */
  getDigitTransform(section: string, rowIndex: number, colIndex: number): string {
    const key = `${section}-${rowIndex}-${colIndex}`;

    // Priority: crash > spawn assembly > landing scatter
    const crashState = this.crashParticleStates.get(key);
    if (crashState && this.isCrashing()) {
      return `translate(${crashState.x}px, ${crashState.y}px)`;
    }

    const spawnState = this.spawnParticleStates.get(key);
    if (spawnState && this.assemblyPhase() !== AssemblyPhase.ASSEMBLED) {
      return `translate(${spawnState.currentX}px, ${spawnState.currentY}px)`;
    }

    const landingState = this.particleStates.get(key);
    if (landingState) {
      return `translate(${landingState.currentX}px, ${landingState.currentY}px)`;
    }

    return 'translate(0, 0)';
  }

  // ========== V5.0 SPAWN ASSEMBLY ==========

  private initializeSpawnAssembly(): void {
    this.assemblyPhase.set(AssemblyPhase.SCATTERED);
    this.isAssembled.set(false);
    this.spawnStartTime = performance.now();
    this.spawnParticleStates.clear();

    // Calculate random starting positions for all digits
    const grids = [
      { grid: this.bodyGrid, section: 'body' },
      { grid: this.armsGrid, section: 'arms' },
      { grid: this.legsGrid, section: 'legs' }
    ];

    const spreadX = window.innerWidth * ASSEMBLY_CONFIG.SPAWN_SPREAD;
    const spreadY = window.innerHeight * ASSEMBLY_CONFIG.SPAWN_SPREAD;

    let digitIndex = 0;
    const totalDigits = grids.reduce((sum, { grid }) =>
      sum + (grid?.flat().filter(d => !d.isEmpty).length || 0), 0);

    for (const { grid, section } of grids) {
      if (!grid) continue;

      grid.forEach((row, ri) => {
        row.forEach((digit, ci) => {
          if (digit.isEmpty) return;

          const key = `${section}-${ri}-${ci}`;

          // Random start position (spread from center)
          const angle = Math.random() * Math.PI * 2;
          const distance = 0.5 + Math.random() * 0.5; // 50-100% of spread
          const startX = Math.cos(angle) * spreadX * distance;
          const startY = Math.sin(angle) * spreadY * distance;

          // Stagger delay - center digits arrive first (core→limb→edge)
          const typeMass = ASSEMBLY_CONFIG.TYPE_MASS[digit.type] ?? 0.75;
          const delayFactor = 1 - typeMass; // Core (1.0) = no delay, Edge (0.7) = more delay
          const delay = delayFactor * ASSEMBLY_CONFIG.SPAWN_STAGGER_MAX +
                       (digitIndex / totalDigits) * 100; // Slight order-based stagger

          this.spawnParticleStates.set(key, {
            scatterX: startX,
            scatterY: startY,
            currentX: startX,
            currentY: startY,
            delay,
            arrived: false
          });

          digitIndex++;
        });
      });
    }
  }

  private updateSpawnAssembly(currentTime: number): void {
    const phase = this.assemblyPhase();
    if (phase === AssemblyPhase.ASSEMBLED) return;

    const elapsed = currentTime - this.spawnStartTime;
    let allArrived = true;

    this.spawnParticleStates.forEach((state, key) => {
      // Wait for stagger delay
      const adjustedElapsed = elapsed - state.delay;
      if (adjustedElapsed < 0) {
        allArrived = false;
        return;
      }

      if (state.arrived) return;

      // Spring physics
      const dx = 0 - state.currentX; // Target is 0,0
      const dy = 0 - state.currentY;

      // Check if arrived
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) {
        state.currentX = 0;
        state.currentY = 0;
        state.arrived = true;
        return;
      }

      allArrived = false;

      // Spring force
      const stiffness = ASSEMBLY_CONFIG.SPAWN_STIFFNESS;
      const damping = ASSEMBLY_CONFIG.SPAWN_DAMPING;

      // Simple spring with implicit velocity (stateless)
      const progress = Math.min(1, adjustedElapsed / (ASSEMBLY_CONFIG.SPAWN_DURATION * 0.7));
      const easeProgress = 1 - Math.pow(1 - progress, 3); // Cubic ease out

      state.currentX = state.scatterX * (1 - easeProgress);
      state.currentY = state.scatterY * (1 - easeProgress);
    });

    // Update phase
    if (phase === AssemblyPhase.SCATTERED && elapsed > 100) {
      this.assemblyPhase.set(AssemblyPhase.ASSEMBLING);
    }

    // Check completion
    if (allArrived || elapsed > ASSEMBLY_CONFIG.SPAWN_DURATION) {
      this.completeAssembly();
    }
  }

  private completeAssembly(): void {
    this.assemblyPhase.set(AssemblyPhase.ASSEMBLED);
    this.isAssembled.set(true);
    this.spawnParticleStates.clear();
    this.assemblyComplete.emit();
  }

  // ========== V5.0 CRASH ANIMATION WITH PHYSICS ==========

  /**
   * Public method to trigger crash animation (called from parent on landing)
   */
  triggerCrash(): void {
    if (this.isCrashing()) return;

    this.isCrashing.set(true);
    this.crashStartTime = performance.now();
    this.crashPhase = 'exploding';
    this.crashParticleStates.clear();

    // Calculate explosion velocities for each digit
    const grids = [
      { grid: this.bodyGrid, section: 'body' },
      { grid: this.armsGrid, section: 'arms' },
      { grid: this.legsGrid, section: 'legs' }
    ];

    for (const { grid, section } of grids) {
      if (!grid) continue;
      const maxRows = grid.length;
      const maxCols = grid[0]?.length || 0;

      grid.forEach((row, ri) => {
        row.forEach((digit, ci) => {
          if (digit.isEmpty) return;

          const key = `${section}-${ri}-${ci}`;

          // Position in grid (normalized 0-1)
          const gridX = ci / maxCols;
          const gridY = ri / maxRows;

          // Vector from center
          const deltaX = gridX - 0.5;
          const deltaY = gridY - 0.5;
          const angle = Math.atan2(deltaY, deltaX);
          const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

          // Explosion velocity (upward and outward)
          const typeMass = ASSEMBLY_CONFIG.TYPE_MASS[digit.type] ?? 0.75;
          const explosionForce = 400 + Math.random() * 200;

          // Random angle variation
          const randomAngle = angle + (Math.random() - 0.5) * 1.2;

          // Initial velocities - mostly upward with horizontal spread
          const velocityX = Math.cos(randomAngle) * distance * explosionForce * 0.8;
          const velocityY = -300 - Math.random() * 200; // Strong upward

          // v5.1 FIX: Calculate real ground distance for each particle based on row
          // Each particle's absolute Y = characterScreenY + (row * ~12px line height)
          // Ground is at window.innerHeight - 120
          const rowHeight = 12; // Approximate height of each grid row in pixels
          const groundYAbsolute = window.innerHeight - 120;
          const particleAbsoluteY = this.characterScreenY + (ri * rowHeight);
          const distanceToGround = groundYAbsolute - particleAbsoluteY;
          // Add small variation for visual interest (±15px)
          const baseGroundY = Math.max(10, distanceToGround + (Math.random() * 30 - 15));

          this.crashParticleStates.set(key, {
            x: 0,
            y: 0,
            velocityX,
            velocityY,
            settled: false,
            groundY: baseGroundY
          });
        });
      });
    }
  }

  private updateCrashAnimation(currentTime: number): void {
    if (!this.isCrashing()) return;

    const elapsed = currentTime - this.crashStartTime;
    const deltaTime = 1 / 60; // Assume 60fps for physics
    const gravity = 800; // Gravity acceleration
    const bounceDamping = 0.4; // Energy loss on bounce
    const friction = 0.95; // Horizontal friction

    // Physics simulation for each particle
    let allSettled = true;
    this.crashParticleStates.forEach((state) => {
      if (state.settled) return;

      allSettled = false;

      // Apply gravity
      state.velocityY += gravity * deltaTime;

      // Apply friction to horizontal movement
      state.velocityX *= friction;

      // Update position
      state.x += state.velocityX * deltaTime;
      state.y += state.velocityY * deltaTime;

      // Ground collision
      if (state.y >= state.groundY) {
        state.y = state.groundY;

        // Bounce if moving fast enough
        if (Math.abs(state.velocityY) > 30) {
          state.velocityY = -state.velocityY * bounceDamping;
          state.velocityX *= 0.8; // Lose some horizontal momentum on bounce
        } else {
          // Settle
          state.velocityY = 0;
          state.velocityX = 0;

          // Check if almost stopped
          if (Math.abs(state.velocityX) < 5) {
            state.settled = true;
          }
        }
      }
    });

    // Phases: exploding -> falling -> settling -> reassembling
    if (this.crashPhase === 'exploding' && elapsed > 100) {
      this.crashPhase = 'falling';
    }

    if (allSettled && this.crashPhase !== 'reassembling') {
      // All pieces settled, wait a moment then reassemble
      this.crashPhase = 'settling';

      // After 1.5 seconds of being settled, start reassembly
      setTimeout(() => {
        if (this.isCrashing()) {
          this.crashPhase = 'reassembling';
          this.startReassembly();
        }
      }, 1500);
    }
  }

  private reassemblyStartTime = 0;

  private startReassembly(): void {
    this.reassemblyStartTime = performance.now();
  }

  private updateReassembly(currentTime: number): void {
    if (this.crashPhase !== 'reassembling') return;

    const elapsed = currentTime - this.reassemblyStartTime;
    const duration = ASSEMBLY_CONFIG.CRASH_REASSEMBLE_DURATION;

    if (elapsed >= duration) {
      // Complete
      this.isCrashing.set(false);
      this.crashParticleStates.clear();
      this.crashPhase = 'exploding';
      this.crashComplete.emit();
      return;
    }

    // Spring animation back to origin
    const t = elapsed / duration;
    const zeta = 0.65;
    const omega = 10;
    const decay = Math.exp(-zeta * omega * t);
    const oscillation = Math.cos(omega * Math.sqrt(1 - zeta * zeta) * t);
    const progress = 1 - decay * oscillation;

    this.crashParticleStates.forEach((state) => {
      // Store original positions if not stored
      if (!('originalX' in state)) {
        (state as any).originalX = state.x;
        (state as any).originalY = state.y;
      }

      const origX = (state as any).originalX;
      const origY = (state as any).originalY;

      state.x = origX * (1 - progress);
      state.y = origY * (1 - progress);
    });
  }

  private applyGlitch(currentTime: number): void {
    const timeSinceGlitch = currentTime - this.lastGlitchTime;

    if (timeSinceGlitch > 100) {
      const newGlitch = new Set<string>();

      // Glitch ~5% of visible digits
      this.bodyGrid.forEach((row, ri) => {
        row.forEach((digit, ci) => {
          if (!digit.isEmpty && Math.random() < 0.05) {
            newGlitch.add(`body-${ri}-${ci}`);
          }
        });
      });

      this.legsGrid.forEach((row, ri) => {
        row.forEach((digit, ci) => {
          if (!digit.isEmpty && Math.random() < 0.08) {
            newGlitch.add(`legs-${ri}-${ci}`);
          }
        });
      });

      this.glitchDigits.set(newGlitch);
      this.lastGlitchTime = currentTime;
    }
  }

  /**
   * Get CSS classes for a digit
   */
  getDigitClasses(digit: BinaryDigit, section: string, rowIndex: number, colIndex: number): string {
    if (digit.isEmpty) {
      return 'digit empty';
    }

    const classes: string[] = ['digit', `type-${digit.type}`];

    if (digit.type === DigitType.EYE) {
      classes.push('eye');
      if (this.isBlinking()) {
        classes.push('blink');
      }
    }

    if (digit.type === DigitType.SMILE) {
      classes.push('smile');
    }

    if (this.glitchDigits().has(`${section}-${rowIndex}-${colIndex}`)) {
      classes.push('glitch');
    }

    return classes.join(' ');
  }

  /**
   * Get display character (possibly glitched or animated)
   */
  getDisplayChar(digit: BinaryDigit, section: string, rowIndex: number, colIndex: number): string {
    if (digit.isEmpty) {
      return '\u00A0'; // Non-breaking space
    }

    if (this.glitchDigits().has(`${section}-${rowIndex}-${colIndex}`)) {
      const glitchChars = ['0', '1', '/', '|', '-'];
      return glitchChars[Math.floor(Math.random() * glitchChars.length)];
    }

    // V4.1: Mouth animation - change character based on mouth frame
    if (digit.type === DigitType.SMILE) {
      const mouthChars = ['_', 'o', 'O']; // closed, open, wide
      return mouthChars[this.mouthFrame()];
    }

    return digit.char;
  }

  /**
   * Get brightness for digit type
   */
  getBrightness(digit: BinaryDigit): number {
    if (digit.isEmpty) return 0;

    const brightness = CHARACTER_CONFIG.BRIGHTNESS;
    switch (digit.type) {
      case DigitType.EYE: return brightness.EYE;
      case DigitType.SMILE: return brightness.SMILE;
      case DigitType.CORE: return brightness.CORE;
      case DigitType.LIMB: return brightness.LIMB;
      case DigitType.EDGE: return brightness.EDGE;
      default: return brightness.LIMB;
    }
  }
}
