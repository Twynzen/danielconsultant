/**
 * HologramProjectionComponent v1.0
 * Holographic projection that appears above pillars
 * - SERVICE mode: Shows service details (same as modal but holographic style)
 * - URL mode: Shows clickable URL with WiFi ASCII waves
 */
import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnDestroy,
  OnChanges,
  SimpleChanges,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  inject,
  signal,
  HostListener
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { PillarConfig } from '../../config/pillar.config';
import { ServiceDetail, ServicesDataService } from '../../services/services-data.service';

@Component({
  selector: 'app-hologram-projection',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './hologram-projection.component.html',
  styleUrls: ['./hologram-projection.component.scss'],
  // v4.5 FIX: Changed to Default for better reactivity with @Input changes
  changeDetection: ChangeDetectionStrategy.Default
})
export class HologramProjectionComponent implements OnInit, OnDestroy, OnChanges {
  private servicesData = inject(ServicesDataService);
  private cdr = inject(ChangeDetectorRef);

  // Inputs
  @Input() pillarConfig: PillarConfig | null = null;
  @Input() pillarScreenX = 0;
  @Input() pillarScreenY = 0;
  @Input() isVisible = false;

  // Outputs
  @Output() closeHologram = new EventEmitter<void>();
  @Output() urlClicked = new EventEmitter<string>();

  // State
  serviceData = signal<ServiceDetail | null>(null);
  isAppearing = signal(true);

  // WiFi wave animation frames for URL mode
  wifiWaves = [
    { char: ')', delay: 0 },
    { char: '))', delay: 0.2 },
    { char: ')))', delay: 0.4 }
  ];

  ngOnInit(): void {
    // Remove appearing class after animation
    setTimeout(() => {
      this.isAppearing.set(false);
    }, 500);
  }

  /**
   * v4.5 FIX: React to input changes properly
   * Before this fix, loadServiceData() was called in ngOnInit where pillarConfig might be null
   */
  ngOnChanges(changes: SimpleChanges): void {
    // Load service data when pillarConfig changes
    if (changes['pillarConfig'] && this.pillarConfig) {
      this.loadServiceData();
      this.isAppearing.set(true);

      // Reset appearing animation
      setTimeout(() => {
        this.isAppearing.set(false);
      }, 500);
    }

    // Reset when visibility changes
    if (changes['isVisible']) {
      if (this.isVisible) {
        this.isAppearing.set(true);
        setTimeout(() => this.isAppearing.set(false), 500);
      }
    }
  }

  ngOnDestroy(): void {
    // Cleanup if needed
  }

  private loadServiceData(): void {
    if (this.pillarConfig?.type === 'modal') {
      const data = this.servicesData.getServiceDetail(this.pillarConfig.destination);
      this.serviceData.set(data || null);
    }
  }

  // Handle ESC key to close
  @HostListener('window:keydown.escape')
  onEscapeKey(): void {
    this.onClose();
  }

  // Handle click outside to close
  onBackdropClick(event: MouseEvent): void {
    // Only close if click is on the backdrop itself
    const target = event.target as HTMLElement;
    if (target.classList.contains('hologram-backdrop')) {
      this.onClose();
    }
  }

  onClose(): void {
    this.closeHologram.emit();
  }

  onUrlClick(): void {
    if (this.pillarConfig?.type === 'external' && this.pillarConfig.destination) {
      this.urlClicked.emit(this.pillarConfig.destination);
      // Open in new tab
      window.open(this.pillarConfig.destination, '_blank');
    }
  }

  // Get display URL (shortened for display)
  getDisplayUrl(): string {
    if (!this.pillarConfig?.destination) return '';
    try {
      const url = new URL(this.pillarConfig.destination);
      return url.hostname.replace('www.', '').toUpperCase();
    } catch {
      return this.pillarConfig.destination;
    }
  }

  /**
   * v4.6.1: Hologram positioning ALIGNED with pillar
   * - Uses pillarScreenX/Y to position above the pillar
   * - External links (URLs): Compact 250x180px
   * - Service modals: Full 480x400px
   */
  getHologramStyle(): { [key: string]: string } {
    const isExternal = this.pillarConfig?.type === 'external';

    // Hologram dimensions
    const hologramWidth = isExternal ? 250 : 480;
    const hologramMaxHeight = isExternal ? 180 : 400;

    // v4.6.1: Center horizontally OVER the pillar
    let x = this.pillarScreenX - (hologramWidth / 2);

    // Clamping: keep visible on screen with 10px margin
    x = Math.max(10, Math.min(window.innerWidth - hologramWidth - 10, x));

    // v4.6.1: Position ABOVE the pillar with clearance for beam
    const clearance = isExternal ? 200 : 300;
    const y = Math.max(60, this.pillarScreenY - clearance);

    return {
      left: `${x}px`,
      top: `${y}px`,
      width: `${hologramWidth}px`,
      maxHeight: `${hologramMaxHeight}px`
    };
  }

  /**
   * v4.6.1: Beam connecting hologram to pillar
   * Calculates dynamic positioning based on hologram and pillar positions
   */
  getBeamStyle(): { [key: string]: string } {
    if (!this.pillarConfig) return {};

    const isExternal = this.pillarConfig.type === 'external';

    // Get hologram dimensions and position (same calc as getHologramStyle)
    const hologramWidth = isExternal ? 250 : 480;
    const hologramMaxHeight = isExternal ? 180 : 400;

    let hologramX = this.pillarScreenX - (hologramWidth / 2);
    hologramX = Math.max(10, Math.min(window.innerWidth - hologramWidth - 10, hologramX));

    const clearance = isExternal ? 200 : 300;
    const hologramY = Math.max(60, this.pillarScreenY - clearance);

    // Beam starts at bottom of hologram, ends at pillar top
    const beamStartY = hologramY + hologramMaxHeight;
    const beamEndY = this.pillarScreenY + 20; // Slightly into pillar
    const beamHeight = Math.max(0, beamEndY - beamStartY);

    // Center of hologram horizontally
    const beamX = hologramX + (hologramWidth / 2);

    return {
      left: `${beamX}px`,
      top: `${beamStartY}px`,
      height: `${beamHeight}px`
    };
  }
}
