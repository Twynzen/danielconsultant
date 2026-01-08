/**
 * Pillar System Component - Side-Scroller Mode
 * Manages pillars distributed horizontally across the level
 * Auto-illumination when player approaches, hologram preview
 */

import {
  Component,
  OnInit,
  OnDestroy,
  Input,
  Output,
  EventEmitter,
  HostListener,
  inject,
  signal,
  computed,
  ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil, throttleTime } from 'rxjs/operators';

import { PillarComponent } from '../pillar/pillar.component';
import {
  PILLARS,
  PillarConfig,
  PILLAR_INTERACTION,
  getPillarWorldPosition
} from '../../config/pillar.config';
import { SIDESCROLLER_CONFIG, getPillarY } from '../../config/sidescroller.config';
import { PhysicsService } from '../../core/services/physics.service';
import { ViewportCullingService } from '../../core/services/viewport-culling.service';
import { InputService } from '../../core/services/input.service';
import { SendellStateService, SendellState } from '../../services/sendell-state.service';

interface PillarState {
  config: PillarConfig;
  isHighlighted: boolean;
  isInteractable: boolean;
  showHologram: boolean;
  illumination: number;
  distance: number;
  worldX: number;
  worldY: number;
  screenX: number;
  isVisible: boolean;
  // v5.2: Energization state
  isRobotNearby: boolean;   // Robot close enough to show [E] indicator
  isEnergized: boolean;     // Robot is inside THIS pillar
  showExitIndicator: boolean; // Show gray [E] for exit
}

@Component({
  selector: 'app-pillar-system',
  standalone: true,
  imports: [CommonModule, PillarComponent],
  templateUrl: './pillar-system.component.html',
  styleUrl: './pillar-system.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PillarSystemComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private physicsService = inject(PhysicsService);
  private cullingService = inject(ViewportCullingService);
  private inputService = inject(InputService);
  // v5.9: State service for guardrails
  private stateService = inject(SendellStateService);

  // v4.6.2: Event with WORLD coordinates (not screen) for proper hologram anchoring
  @Output() pillarActivated = new EventEmitter<{
    config: PillarConfig;
    worldX: number;
    worldY: number;
  }>();

  // v4.7: Emit illumination levels for hieroglyphic wall
  @Output() illuminationsChanged = new EventEmitter<Map<string, number>>();

  // v5.2: Emit when user presses E to exit pillar (when already inside)
  @Output() pillarExitRequested = new EventEmitter<void>();

  // v5.0: Base illumination from onboarding (0-1, adds to proximity illumination)
  @Input() baseIllumination = 0;

  // v5.2: Energization state - which pillar the robot is inside (null = none)
  @Input() energizedPillarId: string | null = null;

  // Pillar states
  pillarStates = signal<PillarState[]>([]);

  // Active pillar (closest interactable)
  activePillar = computed(() => {
    const states = this.pillarStates();
    const interactable = states.filter(s => s.isInteractable);
    if (interactable.length === 0) return null;

    return interactable.reduce((closest, current) =>
      current.distance < closest.distance ? current : closest
    );
  });

  // Animation frame for updates
  private animationFrameId: number | null = null;
  private lastUpdateTime = 0;
  private readonly UPDATE_INTERVAL = 50; // 20fps for pillar updates

  ngOnInit(): void {
    this.initializePillarStates();
    this.startUpdateLoop();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }

  private initializePillarStates(): void {
    const states = PILLARS.map(config => {
      const worldPos = getPillarWorldPosition(config);
      return {
        config,
        isHighlighted: false,
        isInteractable: false,
        showHologram: false,
        illumination: 0,
        distance: Infinity,
        worldX: worldPos.x,
        worldY: worldPos.y,
        screenX: 0,
        isVisible: false,
        // v5.2: Energization state
        isRobotNearby: false,
        isEnergized: false,
        showExitIndicator: false
      };
    });
    this.pillarStates.set(states);
  }

  private startUpdateLoop(): void {
    const loop = (currentTime: number) => {
      // Throttle updates
      if (currentTime - this.lastUpdateTime >= this.UPDATE_INTERVAL) {
        this.updatePillarStates();
        this.lastUpdateTime = currentTime;
      }

      this.animationFrameId = requestAnimationFrame(loop);
    };

    this.animationFrameId = requestAnimationFrame(loop);
  }

  private updatePillarStates(): void {
    const playerState = this.physicsService.state();
    const playerX = playerState.x;
    const levelWidth = SIDESCROLLER_CONFIG.LEVEL_WIDTH;

    const states = PILLARS.map(config => {
      const worldPos = getPillarWorldPosition(config);
      const pillarX = worldPos.x;
      const pillarY = worldPos.y;

      // Calculate distance considering world wrap
      const directDist = Math.abs(playerX - pillarX);
      const wrappedDist = levelWidth - directDist;
      const distance = Math.min(directDist, wrappedDist);

      // Illumination based on distance + base from onboarding
      const maxDist = PILLAR_INTERACTION.HIGHLIGHT_RADIUS * 1.5;
      const proximityIllumination = Math.max(0, 1 - (distance / maxDist));
      // v5.0: Combine proximity with base illumination (capped at 1)
      const illumination = Math.min(1, proximityIllumination + this.baseIllumination);

      // States based on distance thresholds
      const isHighlighted = distance <= PILLAR_INTERACTION.HIGHLIGHT_RADIUS;
      const showHologram = distance <= SIDESCROLLER_CONFIG.PILLAR_HOLOGRAM_RADIUS;
      const isInteractable = distance <= PILLAR_INTERACTION.INTERACT_RADIUS;

      // Screen position for rendering
      const screenX = this.cullingService.getScreenX(pillarX);
      const isVisible = this.cullingService.isVisible(pillarX, PILLAR_INTERACTION.PILLAR_WIDTH);

      // v5.2: Energization state
      const isEnergized = this.energizedPillarId === config.id;
      const isRobotNearby = isInteractable && !isEnergized && !this.energizedPillarId;
      const showExitIndicator = isEnergized; // Show gray [E] when robot is inside THIS pillar

      return {
        config,
        isHighlighted,
        isInteractable,
        showHologram,
        illumination,
        distance,
        worldX: pillarX,
        worldY: pillarY,
        screenX,
        isVisible,
        // v5.2
        isRobotNearby,
        isEnergized,
        showExitIndicator
      };
    });

    this.pillarStates.set(states);

    // v4.7: Emit illuminations for hieroglyphic wall
    this.emitIlluminations(states);
  }

  /**
   * v4.7.1: Emit illumination map for hieroglyphic wall
   * Emits for ALL pillars (modal + external) using pillar.id as key
   * v5.1: Only emit PROXIMITY illumination (not baseIllumination) so inscriptions
   *       only appear when robot is actually close, not when onboarding illuminates
   */
  private emitIlluminations(states: PillarState[]): void {
    const illMap = new Map<string, number>();
    states.forEach(state => {
      // v5.1: Calculate pure proximity (without baseIllumination)
      // Inscriptions should only appear when robot is within HOLOGRAM_RADIUS (100px)
      const distance = state.distance;
      const hologramRadius = SIDESCROLLER_CONFIG.PILLAR_HOLOGRAM_RADIUS;
      // Only emit illumination when within hologram radius
      const proximityIllumination = distance <= hologramRadius
        ? Math.max(0, 1 - (distance / hologramRadius))
        : 0;
      illMap.set(state.config.id, proximityIllumination);
    });
    this.illuminationsChanged.emit(illMap);
  }

  // v4.6: Changed from ENTER to E key (videogame style)
  // v5.2: Also handles exiting pillar when robot is inside
  @HostListener('window:keydown.e', ['$event'])
  onActivate(event: KeyboardEvent): void {
    // v5.9: Guardrail - No pillar action if being dragged
    if (this.stateService.isBeingDragged()) {
      console.log('%c[Guardrail] E key blocked - robot being dragged', 'color: #ff6b6b');
      event.preventDefault();
      return;
    }

    // v5.9: Guardrail - Check state service for blocking conditions
    const canActivate = this.stateService.canExecuteAction('pillar_activate');
    if (!canActivate.allowed) {
      console.log(`%c[Guardrail] E key blocked - ${canActivate.reason}`, 'color: #ff6b6b');
      event.preventDefault();
      return;
    }

    // v5.2: If robot is inside a pillar, E key triggers exit
    if (this.energizedPillarId) {
      event.preventDefault();
      this.pillarExitRequested.emit();
      return;
    }

    // Normal case: activate/energize the closest pillar
    const active = this.activePillar();
    if (active) {
      event.preventDefault();

      // v4.6.2: Emit WORLD coordinates (not screen) so hologram stays anchored to pillar
      this.pillarActivated.emit({
        config: active.config,
        worldX: active.config.worldX,
        worldY: getPillarY()
      });
    }
  }

  // Only render visible pillars
  get visiblePillars(): PillarState[] {
    return this.pillarStates().filter(s => s.isVisible);
  }

  trackByPillarId(index: number, state: PillarState): string {
    return state.config.id;
  }
}
