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
// v5.2: Added ENERGIZING, INSIDE_PILLAR, EXITING_PILLAR for pillar energization
export enum AssemblyPhase {
  SCATTERED = 'scattered',
  ASSEMBLING = 'assembling',
  ASSEMBLED = 'assembled',
  LANDING_SCATTER = 'landing',
  REASSEMBLING = 'reassembling',
  // v5.2: Robot energizes pillar animation
  ENERGIZING = 'energizing',        // Robot decomposing and flowing to pillar
  INSIDE_PILLAR = 'inside_pillar',  // Robot invisible, inside pillar
  EXITING_PILLAR = 'exiting_pillar' // Robot recomposing from pillar
}

// v5.0: Particle state for scatter/assembly animations
interface ParticleState {
  scatterX: number;
  scatterY: number;
  currentX: number;
  currentY: number;
}

// v5.2: Particle state for energization animation (Bézier curves)
// v5.2.1: Enhanced with scale, opacity, rotation for spectacular effect
interface EnergyParticleState {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  targetX: number;
  targetY: number;
  progress: number;
  delay: number;          // Staggered start (ms)
  controlPoint1X: number; // Bézier control point 1
  controlPoint1Y: number;
  controlPoint2X: number; // Bézier control point 2
  controlPoint2Y: number;
  // v5.2.1: Enhanced visual properties
  scale: number;          // 1.0 → 0.3 as particle approaches pillar
  opacity: number;        // Glow intensity
  rotation: number;       // Spin effect (degrees)
  rotationSpeed: number;  // Degrees per second
  startScale: number;     // Initial scale (varies by particle type)
  endScale: number;       // Final scale at destination
  trailLength: number;    // Number of trail segments
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

  // v5.2.3: Frame counter for throttled change detection
  private frameCounter = 0;

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

  // v5.2: Pillar energization
  @Input() targetPillarPosition: { x: number; y: number } | null = null;
  @Output() energizationComplete = new EventEmitter<void>();
  @Output() exitPillarComplete = new EventEmitter<void>();
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

  // v5.2: Energy animation state
  isEnergizing = signal(false);
  isInsidePillar = signal(false);
  private energyAnimationStartTime = 0;
  private energyParticleStates = new Map<string, EnergyParticleState>();
  private pillarTargetX = 0;  // Target pillar X (relative to robot)
  private pillarTargetY = 0;  // Target pillar Y (relative to robot)
  private robotOriginalX = 0; // Robot position before energizing
  private robotOriginalY = 0;
  // v5.2.2: STREAMING EFFECT - particles flow one by one
  private readonly ENERGY_ANIMATION_DURATION = 3500; // 3.5 seconds total for all particles
  private readonly EXIT_ANIMATION_DURATION = 3000;   // 3.0 seconds to recompose
  private readonly PARTICLE_FLIGHT_TIME = 800;       // Each particle takes 800ms to travel
  private readonly TOTAL_STAGGER_SPREAD = 2500;      // 2.5 seconds spread across all particles

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

      // V5.2: Update energy animation (pillar energization)
      this.updateEnergyAnimation(currentTime);

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

      // v5.2.3: Throttled change detection for better performance
      // During heavy animations (energizing), update every 2 frames
      // During light state (idle), update every 3 frames
      this.frameCounter++;
      const isAnimatingEnergy = this.isEnergizing() || this.assemblyPhase() === AssemblyPhase.EXITING_PILLAR;
      const throttleRate = isAnimatingEnergy ? 2 : 3;

      if (this.frameCounter % throttleRate === 0) {
        this.cdr.markForCheck();
      }
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
   * v5.0: Get transform for a digit during animations (spawn, landing, crash, or energize)
   * v5.2.1: Enhanced energy animation with scale and rotation
   * v5.2.3: OPTIMIZED - Removed rotation for better performance
   */
  getDigitTransform(section: string, rowIndex: number, colIndex: number): string {
    const key = `${section}-${rowIndex}-${colIndex}`;

    // Priority: energize > crash > spawn assembly > landing scatter
    // v5.2.3: Energy animation with translate + scale only (rotation removed for performance)
    const energyState = this.energyParticleStates.get(key);
    if (energyState && (this.isEnergizing() || this.assemblyPhase() === AssemblyPhase.EXITING_PILLAR)) {
      // v5.2.3: Simplified transform without rotation + rounded values for less repaints
      const x = Math.round(energyState.currentX * 10) / 10;
      const y = Math.round(energyState.currentY * 10) / 10;
      const s = Math.round(energyState.scale * 100) / 100;
      return `translate(${x}px, ${y}px) scale(${s})`;
    }

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

  /**
   * v5.2.1: Get opacity for a digit during energy animation
   */
  getDigitOpacity(section: string, rowIndex: number, colIndex: number, baseOpacity: number): number {
    const key = `${section}-${rowIndex}-${colIndex}`;
    const energyState = this.energyParticleStates.get(key);

    if (energyState && (this.isEnergizing() || this.assemblyPhase() === AssemblyPhase.EXITING_PILLAR)) {
      return energyState.opacity * baseOpacity;
    }

    return baseOpacity;
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
    // v5.2 FIX: Only process during spawn phases, not during energization or other states
    if (phase !== AssemblyPhase.SCATTERED && phase !== AssemblyPhase.ASSEMBLING) return;

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
          // Ground is at window.innerHeight - 60 (v4.8.2: halved from 120)
          const rowHeight = 12; // Approximate height of each grid row in pixels
          const groundYAbsolute = window.innerHeight - 60;
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

  // ========== V5.2 PILLAR ENERGIZATION ==========

  /**
   * v5.2: Trigger energization animation - robot decomposes and flows to pillar
   * @param pillarScreenX - Target pillar screen X position (relative to viewport)
   * @param pillarScreenY - Target pillar screen Y position
   */
  triggerEnergize(pillarScreenX: number, pillarScreenY: number): void {
    if (this.isEnergizing() || this.isInsidePillar() || this.isCrashing()) return;

    // Store target position (relative to robot)
    this.pillarTargetX = pillarScreenX;
    this.pillarTargetY = pillarScreenY;

    // Set state
    this.isEnergizing.set(true);
    this.assemblyPhase.set(AssemblyPhase.ENERGIZING);
    this.energyAnimationStartTime = performance.now();
    this.energyParticleStates.clear();

    // Initialize particle states for all digits
    this.initializeEnergyParticles(true);  // true = flowing TO pillar
  }

  /**
   * v5.2: Trigger exit from pillar - robot recomposes from pillar
   */
  triggerExitPillar(): void {
    if (!this.isInsidePillar()) return;

    this.isInsidePillar.set(false);
    this.assemblyPhase.set(AssemblyPhase.EXITING_PILLAR);
    this.energyAnimationStartTime = performance.now();
    this.energyParticleStates.clear();

    // Initialize particles starting from pillar position
    this.initializeEnergyParticles(false);  // false = flowing FROM pillar
  }

  /**
   * v5.2.2: STREAMING EFFECT - particles flow ONE BY ONE
   * Key concept: Each particle starts at a different time, creating a "stream"
   * - TO PILLAR: Edges/limbs go first, core/eyes go last (like dissolving)
   * - FROM PILLAR: Core/eyes appear first, edges fill in last (like materializing)
   * @param toPillar - true if flowing to pillar, false if returning from pillar
   */
  private initializeEnergyParticles(toPillar: boolean): void {
    const grids = [
      { grid: this.bodyGrid, section: 'body' },
      { grid: this.armsGrid, section: 'arms' },
      { grid: this.legsGrid, section: 'legs' }
    ];

    // First pass: collect all particles with their properties for sorting
    const particles: Array<{
      key: string;
      digit: any;
      section: string;
      ri: number;
      ci: number;
      gridPosX: number;
      gridPosY: number;
      typeMass: number;
      distFromCenter: number;
    }> = [];

    // Calculate grid dimensions
    const maxRows = Math.max(...grids.map(g => g.grid?.length || 0));
    const maxCols = Math.max(...grids.map(g => g.grid?.[0]?.length || 0));

    for (const { grid, section } of grids) {
      if (!grid) continue;

      grid.forEach((row, ri) => {
        row.forEach((digit, ci) => {
          if (digit.isEmpty) return;

          const key = `${section}-${ri}-${ci}`;
          const gridPosX = ci / maxCols - 0.5;
          const gridPosY = ri / maxRows - 0.5;
          const typeMass = ASSEMBLY_CONFIG.TYPE_MASS[digit.type] ?? 0.75;
          const distFromCenter = Math.sqrt(gridPosX * gridPosX + gridPosY * gridPosY);

          particles.push({
            key, digit, section, ri, ci,
            gridPosX, gridPosY, typeMass, distFromCenter
          });
        });
      });
    }

    // Sort particles to determine streaming order
    if (toPillar) {
      // TO PILLAR: Sort by (low mass first, then outer first)
      // This makes edges/limbs leave first, core/eyes leave last
      particles.sort((a, b) => {
        // Primary: lower mass goes first (edges before core)
        const massSort = a.typeMass - b.typeMass;
        if (Math.abs(massSort) > 0.1) return massSort;
        // Secondary: outer particles go first
        return b.distFromCenter - a.distFromCenter;
      });
    } else {
      // FROM PILLAR: Sort by (high mass first, then inner first)
      // This makes core/eyes appear first, edges fill in last
      particles.sort((a, b) => {
        // Primary: higher mass goes first (core before edges)
        const massSort = b.typeMass - a.typeMass;
        if (Math.abs(massSort) > 0.1) return massSort;
        // Secondary: inner particles go first
        return a.distFromCenter - b.distFromCenter;
      });
    }

    // Second pass: assign sequential delays based on sorted order
    const totalParticles = particles.length;

    particles.forEach((p, index) => {
      const { key, digit, section, ri, ci, gridPosX, gridPosY, typeMass } = p;

      // === SEQUENTIAL DELAY - the key to streaming effect ===
      // Each particle starts slightly after the previous one
      const sequentialDelay = (index / totalParticles) * this.TOTAL_STAGGER_SPREAD;
      // Add small random variation for organic feel
      const randomVariation = (Math.random() - 0.5) * 50;
      const delay = sequentialDelay + randomVariation;

      // === POSITION CALCULATION ===
      let startX: number, startY: number, endX: number, endY: number;

      // Smaller scatter at destination for tighter convergence
      const scatter = 15;
      const randomX = (Math.random() - 0.5) * scatter;
      const randomY = (Math.random() - 0.5) * scatter;

      if (toPillar) {
        startX = 0;
        startY = 0;
        endX = this.pillarTargetX + randomX;
        endY = this.pillarTargetY + randomY;
      } else {
        startX = this.pillarTargetX + randomX;
        startY = this.pillarTargetY + randomY;
        endX = 0;
        endY = 0;
      }

      // === BÉZIER CURVES - particles curve outward based on their grid position ===
      const distance = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
      const midX = (startX + endX) / 2;
      const midY = (startY + endY) / 2;

      // Arc height - moderate for cleaner streaming effect
      const baseArcHeight = Math.min(distance * 0.5, 120);

      // Position affects curve direction
      const horizontalBias = gridPosX * 100;
      const verticalBias = (0.5 - gridPosY) * 50;

      const arcDirection = toPillar ? -1 : 1;
      const controlRandom1 = (Math.random() - 0.5) * 40 + horizontalBias;
      const controlRandom2 = (Math.random() - 0.5) * 40 + horizontalBias * 0.6;

      const controlPoint1X = startX + (endX - startX) * 0.35 + controlRandom1;
      const controlPoint1Y = midY + arcDirection * (baseArcHeight * 0.7 + verticalBias);
      const controlPoint2X = startX + (endX - startX) * 0.65 + controlRandom2;
      const controlPoint2Y = midY + arcDirection * (baseArcHeight + verticalBias * 0.5);

      // === VISUAL PROPERTIES ===
      const startScale = toPillar ? 1.0 : 0.3;
      const endScale = toPillar ? 0.3 : 1.0;
      const rotationSpeed = (Math.random() - 0.5) * 540; // Slightly slower rotation
      const trailLength = Math.floor(2 + Math.random() * 3);

      this.energyParticleStates.set(key, {
        startX,
        startY,
        currentX: startX,
        currentY: startY,
        targetX: endX,
        targetY: endY,
        progress: 0,
        delay,
        controlPoint1X,
        controlPoint1Y,
        controlPoint2X,
        controlPoint2Y,
        scale: startScale,
        opacity: toPillar ? 1 : 0, // Start invisible when exiting pillar
        rotation: Math.random() * 360,
        rotationSpeed,
        startScale,
        endScale,
        trailLength
      });
    });
  }

  /**
   * v5.2.2: STREAMING animation - particles flow one by one
   * Each particle:
   * - Waits for its delay before starting
   * - Takes PARTICLE_FLIGHT_TIME to travel from start to end
   * - Becomes invisible (toPillar) or visible (fromPillar) upon arrival
   */
  private updateEnergyAnimation(currentTime: number): void {
    const phase = this.assemblyPhase();

    // Only process during energization phases
    if (phase !== AssemblyPhase.ENERGIZING && phase !== AssemblyPhase.EXITING_PILLAR) {
      return;
    }

    const elapsed = currentTime - this.energyAnimationStartTime;
    const toPillar = phase === AssemblyPhase.ENERGIZING;
    const deltaTime = 1 / 60;

    let allComplete = true;
    let anyStarted = false;

    this.energyParticleStates.forEach((state) => {
      const adjustedElapsed = elapsed - state.delay;

      // === PARTICLE HASN'T STARTED YET ===
      if (adjustedElapsed < 0) {
        allComplete = false;
        // Keep at start position, with appropriate visibility
        state.currentX = state.startX;
        state.currentY = state.startY;
        state.scale = state.startScale;
        state.opacity = toPillar ? 1 : 0; // Visible when waiting to leave, invisible when waiting to appear
        return;
      }

      anyStarted = true;

      // === PARTICLE IS IN FLIGHT ===
      const rawProgress = adjustedElapsed / this.PARTICLE_FLIGHT_TIME;
      state.progress = Math.min(1, rawProgress);

      if (state.progress < 1) {
        allComplete = false;

        // Easing for smooth movement
        const t = toPillar
          ? this.easeInOutQuad(state.progress)  // Smooth acceleration/deceleration
          : this.easeOutCubic(state.progress);  // Quick start, gentle arrival

        // Position along Bézier curve
        state.currentX = this.cubicBezier(t, state.startX, state.controlPoint1X, state.controlPoint2X, state.targetX);
        state.currentY = this.cubicBezier(t, state.startY, state.controlPoint1Y, state.controlPoint2Y, state.targetY);

        // Scale interpolation
        state.scale = state.startScale + (state.endScale - state.startScale) * t;

        // Opacity: bright during flight
        if (toPillar) {
          // Glow bright then fade as approaching pillar
          state.opacity = 1.0 - state.progress * 0.7;
        } else {
          // Fade in as materializing
          state.opacity = 0.3 + state.progress * 0.7;
        }

        // v5.2.3: REMOVED rotation calculation for better performance
        // (rotation was barely visible on small particles, but added CPU overhead)

      } else {
        // === PARTICLE HAS ARRIVED ===
        state.currentX = state.targetX;
        state.currentY = state.targetY;
        state.scale = state.endScale;

        if (toPillar) {
          // Arrived at pillar - become invisible (absorbed)
          state.opacity = 0;
        } else {
          // Arrived at robot position - become fully visible
          state.opacity = 1;
        }
      }
    });

    // Check for completion
    const maxDuration = this.TOTAL_STAGGER_SPREAD + this.PARTICLE_FLIGHT_TIME + 200;
    if (allComplete || elapsed > maxDuration) {
      this.completeEnergyAnimation(phase);
    }
  }

  /**
   * v5.2.2: Ease in-out quadratic - smooth acceleration and deceleration
   */
  private easeInOutQuad(t: number): number {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  /**
   * v5.2.2: Ease out cubic - quick start, gentle end
   */
  private easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3);
  }

  /**
   * v5.2.1: Ease out quart - fast start, very slow end
   */
  private easeOutQuart(t: number): number {
    return 1 - Math.pow(1 - t, 4);
  }

  /**
   * v5.2: Complete energy animation and transition to next state
   */
  private completeEnergyAnimation(phase: AssemblyPhase): void {
    this.energyParticleStates.clear();

    if (phase === AssemblyPhase.ENERGIZING) {
      // Robot is now inside pillar
      this.isEnergizing.set(false);
      this.isInsidePillar.set(true);
      this.assemblyPhase.set(AssemblyPhase.INSIDE_PILLAR);
      this.energizationComplete.emit();
    } else if (phase === AssemblyPhase.EXITING_PILLAR) {
      // Robot has recomposed
      this.assemblyPhase.set(AssemblyPhase.ASSEMBLED);
      this.exitPillarComplete.emit();
    }
  }

  /**
   * v5.2: Cubic Bézier interpolation
   * B(t) = (1-t)³P0 + 3(1-t)²tP1 + 3(1-t)t²P2 + t³P3
   */
  private cubicBezier(t: number, p0: number, p1: number, p2: number, p3: number): number {
    const mt = 1 - t;
    return mt * mt * mt * p0 +
           3 * mt * mt * t * p1 +
           3 * mt * t * t * p2 +
           t * t * t * p3;
  }

  /**
   * v5.2: Ease in-out cubic
   */
  private easeInOutCubic(t: number): number {
    return t < 0.5
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  /**
   * v5.2: Check if robot is currently inside a pillar (public getter)
   */
  isRobotInsidePillar(): boolean {
    return this.isInsidePillar();
  }
}
