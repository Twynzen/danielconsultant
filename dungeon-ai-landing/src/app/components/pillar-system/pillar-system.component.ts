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

  // v4.6.2: Event with WORLD coordinates (not screen) for proper hologram anchoring
  @Output() pillarActivated = new EventEmitter<{
    config: PillarConfig;
    worldX: number;
    worldY: number;
  }>();

  // v4.7: Emit illumination levels for hieroglyphic wall
  @Output() illuminationsChanged = new EventEmitter<Map<string, number>>();

  // v5.0: Base illumination from onboarding (0-1, adds to proximity illumination)
  @Input() baseIllumination = 0;

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
        isVisible: false
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
        isVisible
      };
    });

    this.pillarStates.set(states);

    // v4.7: Emit illuminations for hieroglyphic wall
    this.emitIlluminations(states);
  }

  /**
   * v4.7.1: Emit illumination map for hieroglyphic wall
   * Emits for ALL pillars (modal + external) using pillar.id as key
   */
  private emitIlluminations(states: PillarState[]): void {
    const illMap = new Map<string, number>();
    states.forEach(state => {
      // Use pillar ID as key for all types
      illMap.set(state.config.id, state.illumination);
    });
    this.illuminationsChanged.emit(illMap);
  }

  // v4.6: Changed from ENTER to E key (videogame style)
  @HostListener('window:keydown.e', ['$event'])
  onActivate(event: KeyboardEvent): void {
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
