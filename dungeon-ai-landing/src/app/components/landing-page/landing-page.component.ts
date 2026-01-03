import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CircuitsBackgroundComponent } from '../circuits-background/circuits-background.component';
import { TorchSystemComponent } from '../torch-system/torch-system.component';
import { ModalServiceComponent } from '../modal-service/modal-service.component';
import { FlameHeadCharacterComponent } from '../flame-head-character/flame-head-character.component';
import { PillarSystemComponent } from '../pillar-system/pillar-system.component';
import { PillarConfig } from '../../config/pillar.config';
import { LightingService } from '../../services/lighting.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [
    CommonModule,
    CircuitsBackgroundComponent,
    TorchSystemComponent,
    ModalServiceComponent,
    FlameHeadCharacterComponent,
    PillarSystemComponent
  ],
  templateUrl: './landing-page.component.html',
  styleUrl: './landing-page.component.scss'
})
export class LandingPageComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private lightingService = inject(LightingService);

  // Modal state
  isModalOpen = false;
  selectedServiceId: string | null = null;

  // Title illumination - Dynamic based on character proximity
  titleIllumination = signal(0.08); // Base opacity (subtle "carved" look)

  // Computed styles for title
  titleStyle = computed(() => {
    const illumination = this.titleIllumination();
    // Base opacity 0.08, max 0.6 when fully illuminated
    const opacity = 0.08 + (illumination * 0.52);
    const glowIntensity = illumination * 40;
    const glowSpread = illumination * 80;

    return {
      color: `rgba(0, 255, 68, ${opacity})`,
      textShadow: `
        0 0 ${glowIntensity}px rgba(0, 255, 68, ${illumination * 0.4}),
        0 0 ${glowSpread}px rgba(0, 255, 68, ${illumination * 0.2}),
        2px 2px 0 rgba(0, 0, 0, 0.3),
        -1px -1px 0 rgba(40, 40, 40, 0.2)
      `
    };
  });

  subtitleStyle = computed(() => {
    const illumination = this.titleIllumination();
    const opacity = 0.05 + (illumination * 0.35);
    const glowIntensity = illumination * 20;

    return {
      color: `rgba(0, 255, 68, ${opacity})`,
      textShadow: `
        0 0 ${glowIntensity}px rgba(0, 255, 68, ${illumination * 0.3}),
        1px 1px 0 rgba(0, 0, 0, 0.2)
      `
    };
  });

  ngOnInit(): void {
    // Subscribe to character light position for title illumination
    this.lightingService.getLightSources()
      .pipe(takeUntil(this.destroy$))
      .subscribe(lights => {
        const characterLight = lights.find(l => l.id === 'character-light');
        if (characterLight) {
          this.calculateTitleIllumination(characterLight.x, characterLight.y);
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Calculate title illumination based on character proximity
   * Title is at 50%, 50% of viewport
   */
  private calculateTitleIllumination(charX: number, charY: number): void {
    // Title center position
    const titleX = window.innerWidth / 2;
    const titleY = window.innerHeight / 2;

    // Calculate distance from character to title
    const distance = Math.sqrt(
      Math.pow(charX - titleX, 2) +
      Math.pow(charY - titleY, 2)
    );

    // Illumination radius - start fading at 300px, full at 100px
    const maxRadius = 350;
    const minRadius = 80;

    let illumination: number;
    if (distance <= minRadius) {
      illumination = 1; // Full brightness when very close
    } else if (distance >= maxRadius) {
      illumination = 0; // No extra illumination when far
    } else {
      // Smooth falloff using ease-out curve
      const normalized = (distance - minRadius) / (maxRadius - minRadius);
      illumination = 1 - Math.pow(normalized, 0.7);
    }

    this.titleIllumination.set(illumination);
  }

  /**
   * Called when a pillar is activated via Enter key
   * Opens external URL or modal depending on pillar type
   */
  onPillarActivated(pillar: PillarConfig): void {
    if (pillar.type === 'external') {
      // Open external URL in new tab
      window.open(pillar.destination, '_blank', 'noopener,noreferrer');
    } else {
      // Open modal with service info
      this.selectedServiceId = pillar.destination;
      this.isModalOpen = true;
    }
  }

  onCloseModal(): void {
    this.isModalOpen = false;
    this.selectedServiceId = null;
  }
}
