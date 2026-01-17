import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
  signal,
  computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { PillarConfig, PILLAR_ICONS } from '../../../config/pillar.config';

/**
 * v7.0: Tower Floor Component
 * Represents a single floor in the mobile tower
 *
 * Visual:
 * ┌─────────────────────────────────────┐
 * │ [3] ◆─────────────────────────────◆ │
 * │     │  🧠  LOCAL LLMS             │ │
 * │     │  Modelos de lenguaje locales│ │
 * │     ◆─────────────────────────────◆ │
 * └─────────────────────────────────────┘
 */
@Component({
  selector: 'app-tower-floor',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tower-floor.component.html',
  styleUrls: ['./tower-floor.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TowerFloorComponent {
  @Input({ required: true }) floor!: PillarConfig;
  @Input() floorNumber = 1;
  @Input() isActive = false;
  @Input() hasRobot = false;
  @Input() isRobotMoving = false;

  @Output() floorTapped = new EventEmitter<void>();
  @Output() floorActivated = new EventEmitter<void>();

  // Touch handling
  private touchStartTime = 0;
  private tapTimeout: any = null;

  /**
   * Get the SVG icon for this floor
   */
  getIcon(): string {
    return PILLAR_ICONS[this.floor.icon] || PILLAR_ICONS['globe'];
  }

  /**
   * Get floor type label
   */
  getTypeLabel(): string {
    switch (this.floor.type) {
      case 'external':
        return 'ENLACE';
      case 'hologram':
        return 'SERVICIO';
      case 'about':
        return 'INFO';
      case 'internal':
        return 'APP';
      default:
        return 'PISO';
    }
  }

  /**
   * Check if floor is external link
   */
  isExternal(): boolean {
    return this.floor.type === 'external' ||
           !!this.floor.hologramConfig?.externalUrl;
  }

  /**
   * Handle touch start
   */
  onTouchStart(event: TouchEvent): void {
    this.touchStartTime = Date.now();
  }

  /**
   * Handle touch end - detect tap vs long press
   */
  onTouchEnd(event: TouchEvent): void {
    const touchDuration = Date.now() - this.touchStartTime;

    if (touchDuration < 300) {
      // Quick tap
      if (this.tapTimeout) {
        // Double tap detected
        clearTimeout(this.tapTimeout);
        this.tapTimeout = null;
        this.floorActivated.emit();
      } else {
        // Single tap - wait for potential double tap
        this.tapTimeout = setTimeout(() => {
          this.tapTimeout = null;
          this.floorTapped.emit();
        }, 250);
      }
    }
  }

  /**
   * Handle click (for mouse)
   */
  onClick(): void {
    this.floorTapped.emit();
  }

  /**
   * Handle double click (for mouse)
   */
  onDoubleClick(): void {
    this.floorActivated.emit();
  }

  /**
   * Get glow color style
   */
  getGlowStyle(): { [key: string]: string } {
    return {
      '--floor-color': this.floor.color,
      '--floor-glow': `${this.floor.color}80`
    };
  }
}
