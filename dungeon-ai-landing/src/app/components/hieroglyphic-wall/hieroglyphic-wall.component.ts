/**
 * HieroglyphicWallComponent v1.2
 * Background wall with service inscriptions
 * Illuminates based on proximity to pillars
 * v4.7.1: Added dynamic colors and external pillar support
 * v4.8: Added 'about' type with animated portrait hologram
 */
import {
  Component,
  Input,
  Output,
  EventEmitter,
  inject,
  ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ServicesDataService, ServiceDetail } from '../../services/services-data.service';
import { PILLARS, PillarConfig } from '../../config/pillar.config';
import { HologramPortraitComponent } from '../hologram-portrait/hologram-portrait.component';

// Extended inscription data combining service + pillar info
interface InscriptionData {
  id: string;
  type: 'modal' | 'external' | 'about';  // v4.8: Added 'about' type
  title: string;
  description: string;
  color: string;
  icon: string;
  x: number;
  bottom: number; // v4.7.2: Distance from bottom (relative to ground/pillars)
  serviceId?: string; // v4.7.2: Service ID for modal click handler
  // Modal-specific
  features?: { text: string }[];
  technologies?: string[];
  // External-specific
  url?: string;
  urlDisplay?: string;
}

@Component({
  selector: 'app-hieroglyphic-wall',
  standalone: true,
  imports: [CommonModule, HologramPortraitComponent],  // v4.8: Added HologramPortrait
  templateUrl: './hieroglyphic-wall.component.html',
  styleUrls: ['./hieroglyphic-wall.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HieroglyphicWallComponent {
  private servicesData = inject(ServicesDataService);

  // Input: Map of pillar destination ID → illumination (0-1)
  @Input() pillarIlluminations: Map<string, number> = new Map();

  // v4.7.2: Output events for inscription clicks
  @Output() serviceClicked = new EventEmitter<string>(); // Emits service ID for modal
  @Output() externalClicked = new EventEmitter<string>(); // Emits URL for external links

  // v4.7.1: All inscriptions (both modal services and external links)
  inscriptions: InscriptionData[] = this.buildInscriptions();

  /**
   * v4.7.1: Build inscription data from pillars and services
   * Uses pillar.id as key for illumination matching
   * v4.8: Added 'about' type support for portrait hologram
   */
  private buildInscriptions(): InscriptionData[] {
    return PILLARS.map(pillar => {
      const baseData = {
        id: pillar.id, // v4.7.1: Use pillar.id (not destination) for illumination matching
        type: pillar.type,
        color: pillar.color,
        icon: pillar.icon,
        x: this.getPositionX(pillar),
        bottom: this.getPositionBottom(pillar) // v4.7.2: Use bottom positioning
      };

      // v4.8: Handle 'about' type for portrait hologram
      if (pillar.type === 'about') {
        return {
          ...baseData,
          title: pillar.label,
          description: pillar.description ?? ''
        } as InscriptionData;
      }

      if (pillar.type === 'modal') {
        // Get service details
        const service = this.servicesData.getServiceDetail(pillar.destination);
        return {
          ...baseData,
          serviceId: pillar.destination, // v4.7.2: Store service ID for click handler
          title: service?.title ?? pillar.label,
          description: service?.description ?? pillar.description ?? '',
          features: service?.features?.map(f => ({ text: f.text })) ?? [],
          technologies: service?.technologies ?? []
        } as InscriptionData;
      } else {
        // External link
        return {
          ...baseData,
          title: pillar.label,
          description: pillar.description ?? '',
          url: pillar.destination,
          urlDisplay: this.formatUrl(pillar.destination)
        } as InscriptionData;
      }
    });
  }

  /**
   * Format URL for display (remove https://, www., etc)
   */
  private formatUrl(url: string): string {
    try {
      const parsed = new URL(url);
      return parsed.hostname.replace('www.', '').toUpperCase();
    } catch {
      return url;
    }
  }

  /**
   * v4.7.2: Get X position for inscription
   * External pillars: centered above pillar
   * Modal pillars: offset to the left
   * v4.8: About type centered above pillar
   */
  private getPositionX(pillar: PillarConfig): number {
    if (pillar.type === 'about') {
      // About: Center above pillar (portrait is 280px wide)
      return pillar.worldX - 140;
    } else if (pillar.type === 'external') {
      // External: Center above pillar (inscription is 280px wide)
      return pillar.worldX - 140;
    } else {
      // Modal: Position to the left of pillar (inscription is 380px wide)
      return pillar.worldX - 200;
    }
  }

  /**
   * v4.7.2: Get bottom position for inscription (distance from bottom)
   * This positions inscriptions relative to the ground where pillars stand
   * v4.8: Added 'about' type positioning
   *
   * Layout from bottom:
   * - Ground: 120px
   * - Pillar height: ~120px
   * - Glyph above pillar: ~60px
   * - Gap: variable
   * - Inscription
   */
  private getPositionBottom(pillar: PillarConfig): number {
    // Ground is 120px from bottom, pillar visual is ~120px, glyph ~60px above
    const groundHeight = 120;
    const pillarVisualHeight = 150; // Pillar + glyph
    const baseFromBottom = groundHeight + pillarVisualHeight;

    if (pillar.type === 'about') {
      // About: Portrait hologram (~450px height), position above pillar
      return baseFromBottom + 20;
    } else if (pillar.type === 'external') {
      // External: Compact inscription (~250px height), position just above pillar
      // Small gap of 30px above the glyph
      return baseFromBottom + 30;
    } else {
      // Modal: Larger inscription (~500px height), needs more vertical space
      // Stagger slightly for visual interest
      const stagger: Record<string, number> = {
        'custom-integrations': 0,
        'rag-systems': 20,
        'process-automation': 10,
        'agent-orchestration': 0,
        'finops-ai': 15,
        'local-llms': 25
      };
      return baseFromBottom + 50 + (stagger[pillar.id] ?? 0);
    }
  }

  getIllumination(inscriptionId: string): number {
    return this.pillarIlluminations.get(inscriptionId) ?? 0;
  }

  isAwakening(inscriptionId: string): boolean {
    const ill = this.getIllumination(inscriptionId);
    return ill > 0.1 && ill < 0.7;
  }

  isActive(inscriptionId: string): boolean {
    return this.getIllumination(inscriptionId) >= 0.7;
  }

  isDormant(inscriptionId: string): boolean {
    return this.getIllumination(inscriptionId) <= 0.1;
  }

  /**
   * v4.7.2: Check if inscription is clickable (must be awakening or active)
   */
  isClickable(inscriptionId: string): boolean {
    return this.getIllumination(inscriptionId) > 0.3;
  }

  /**
   * v4.7.2: Handle inscription click
   * - Modal type: emit serviceClicked event
   * - External type: handled by <a> tag directly
   */
  onInscriptionClick(inscription: InscriptionData): void {
    // Only clickable when illuminated enough
    if (!this.isClickable(inscription.id)) return;

    if (inscription.type === 'modal' && inscription.serviceId) {
      this.serviceClicked.emit(inscription.serviceId);
    }
    // External types use the <a> tag directly, no need to emit
  }

  // For CSS custom property binding
  getIlluminationStyle(inscriptionId: string): string {
    return this.getIllumination(inscriptionId).toString();
  }

  // Track function for @for
  trackById(index: number, inscription: InscriptionData): string {
    return inscription.id;
  }

  trackByText(index: number, feature: { text: string }): string {
    return feature.text;
  }

  trackByTech(index: number, tech: string): string {
    return tech;
  }
}
