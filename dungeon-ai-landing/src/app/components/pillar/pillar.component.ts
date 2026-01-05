import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { PillarConfig, PILLAR_ICONS } from '../../config/pillar.config';
// v4.7.2: Removed GlyphSymbolComponent - glyph now integrated in hieroglyphic inscriptions

/**
 * v4.6: Particle configuration for floating binary effect
 */
interface Particle {
  char: string;
  delay: string;
  x: string;
}

@Component({
  selector: 'app-pillar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pillar.component.html',
  styleUrl: './pillar.component.scss'
})
export class PillarComponent implements OnInit {
  @Input() config!: PillarConfig;
  @Input() isHighlighted = false;
  @Input() isInteractable = false;
  @Input() illumination = 0; // 0-1 based on light proximity
  @Input() worldX = 0; // World position X in pixels
  @Input() worldY = 0; // World position Y in pixels

  // v4.6: Floating binary particles
  particles: Particle[] = [];

  constructor(private sanitizer: DomSanitizer) {}

  ngOnInit(): void {
    this.generateParticles();
  }

  /**
   * v4.6: Generate floating binary particles
   */
  private generateParticles(): void {
    const chars = ['0', '1'];
    this.particles = Array.from({ length: 8 }, (_, i) => ({
      char: chars[Math.floor(Math.random() * 2)],
      delay: `${(i * 0.4)}s`,
      x: `${10 + Math.random() * 80}%`  // Random horizontal position 10-90%
    }));
  }

  /**
   * Obtiene el SVG del icono de forma segura
   */
  get iconSvg(): SafeHtml {
    const svgString = PILLAR_ICONS[this.config?.icon] || '';
    return this.sanitizer.bypassSecurityTrustHtml(svgString);
  }
}
