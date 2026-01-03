import {
  Component,
  OnInit,
  OnDestroy,
  Output,
  EventEmitter,
  HostListener,
  inject,
  signal,
  computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { PillarComponent } from '../pillar/pillar.component';
import {
  PILLARS,
  PillarConfig,
  PILLAR_INTERACTION
} from '../../config/pillar.config';
import { LightingService } from '../../services/lighting.service';

interface PillarState {
  config: PillarConfig;
  isHighlighted: boolean;
  isInteractable: boolean;
  illumination: number;
  distance: number;
}

@Component({
  selector: 'app-pillar-system',
  standalone: true,
  imports: [CommonModule, PillarComponent],
  templateUrl: './pillar-system.component.html',
  styleUrl: './pillar-system.component.scss'
})
export class PillarSystemComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private lightingService = inject(LightingService);

  @Output() pillarActivated = new EventEmitter<PillarConfig>();

  // Character position tracking
  private characterX = signal(0);
  private characterY = signal(0);

  // Mouse position tracking (for hover illumination)
  private mouseX = signal(0);
  private mouseY = signal(0);

  // Pillar states computed from character AND mouse position
  pillarStates = signal<PillarState[]>([]);

  // Active pillar (closest interactable by character)
  activePillar = computed(() => {
    const states = this.pillarStates();
    const interactable = states.filter(s => s.isInteractable);
    if (interactable.length === 0) return null;

    // Return the closest interactable pillar
    return interactable.reduce((closest, current) =>
      current.distance < closest.distance ? current : closest
    );
  });

  ngOnInit(): void {
    // Initialize pillar states
    this.initializePillarStates();

    // Subscribe to character light position updates
    this.lightingService.getLightSources()
      .pipe(takeUntil(this.destroy$))
      .subscribe(lights => {
        const characterLight = lights.find(l => l.id === 'character-light');
        if (characterLight) {
          this.characterX.set(characterLight.x);
          this.characterY.set(characterLight.y);
          this.updatePillarStates();
        }
      });

    // Subscribe to mouse position for hover illumination
    this.lightingService.getMousePosition()
      .pipe(takeUntil(this.destroy$))
      .subscribe(pos => {
        this.mouseX.set(pos.x);
        this.mouseY.set(pos.y);
        this.updatePillarStates();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializePillarStates(): void {
    const states = PILLARS.map(config => ({
      config,
      isHighlighted: false,
      isInteractable: false,
      illumination: 0,
      distance: Infinity
    }));
    this.pillarStates.set(states);
  }

  private updatePillarStates(): void {
    const charX = this.characterX();
    const charY = this.characterY();
    const mouseX = this.mouseX();
    const mouseY = this.mouseY();

    // Radio de detección del mouse (más pequeño que el personaje)
    const MOUSE_HIGHLIGHT_RADIUS = 120;

    const states = PILLARS.map(config => {
      // Convert pillar position from % to px
      const pillarX = (config.position.x / 100) * window.innerWidth;
      const pillarY = (config.position.y / 100) * window.innerHeight;

      // Calculate distance from character to pillar
      const charDistance = Math.sqrt(
        Math.pow(charX - pillarX, 2) +
        Math.pow(charY - pillarY, 2)
      );

      // Calculate distance from mouse to pillar
      const mouseDistance = Math.sqrt(
        Math.pow(mouseX - pillarX, 2) +
        Math.pow(mouseY - pillarY, 2)
      );

      // Illumination from character
      const charMaxDistance = PILLAR_INTERACTION.HIGHLIGHT_RADIUS * 1.5;
      const charIllumination = Math.max(0, 1 - (charDistance / charMaxDistance));

      // Illumination from mouse hover
      const mouseIllumination = Math.max(0, 1 - (mouseDistance / (MOUSE_HIGHLIGHT_RADIUS * 1.5)));

      // Use the maximum illumination from either source
      const illumination = Math.max(charIllumination, mouseIllumination * 0.8);

      // Highlighted by character OR mouse hover
      const isHighlightedByChar = charDistance <= PILLAR_INTERACTION.HIGHLIGHT_RADIUS;
      const isHighlightedByMouse = mouseDistance <= MOUSE_HIGHLIGHT_RADIUS;
      const isHighlighted = isHighlightedByChar || isHighlightedByMouse;

      // Interactable only by character (need to walk to it)
      const isInteractable = charDistance <= PILLAR_INTERACTION.INTERACT_RADIUS;

      return {
        config,
        isHighlighted,
        isInteractable,
        illumination,
        distance: charDistance // Keep character distance for Enter key activation
      };
    });

    this.pillarStates.set(states);
  }

  @HostListener('window:keydown.enter', ['$event'])
  @HostListener('window:keydown.space', ['$event'])
  onActivate(event: KeyboardEvent): void {
    const active = this.activePillar();
    if (active) {
      event.preventDefault();
      this.pillarActivated.emit(active.config);
    }
  }

  // Track function for ngFor optimization
  trackByPillarId(index: number, state: PillarState): string {
    return state.config.id;
  }
}
