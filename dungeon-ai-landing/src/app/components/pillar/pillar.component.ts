import { Component, Input, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { PillarConfig, PILLAR_ICONS } from '../../config/pillar.config';

@Component({
  selector: 'app-pillar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pillar.component.html',
  styleUrl: './pillar.component.scss'
})
export class PillarComponent {
  @Input() config!: PillarConfig;
  @Input() isHighlighted = false;
  @Input() isInteractable = false;
  @Input() illumination = 0; // 0-1 based on light proximity
  @Input() worldX = 0; // World position X in pixels
  @Input() worldY = 0; // World position Y in pixels

  constructor(private sanitizer: DomSanitizer) {}

  /**
   * Obtiene el SVG del icono de forma segura
   */
  get iconSvg(): SafeHtml {
    const svgString = PILLAR_ICONS[this.config?.icon] || '';
    return this.sanitizer.bypassSecurityTrustHtml(svgString);
  }
}
