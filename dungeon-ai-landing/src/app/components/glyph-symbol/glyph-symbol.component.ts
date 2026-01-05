/**
 * GlyphSymbolComponent v1.0
 * SVG symbol that floats above pillars
 * Animates based on proximity illumination
 */
import {
  Component,
  Input,
  ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-glyph-symbol',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './glyph-symbol.component.html',
  styleUrls: ['./glyph-symbol.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GlyphSymbolComponent {
  @Input() iconType: string = 'default';
  @Input() illumination: number = 0;
  @Input() color: string = '#00ff44';  // v4.7.1: Dynamic color from pillar

  get isDormant(): boolean {
    return this.illumination < 0.2;
  }

  get isAwakening(): boolean {
    return this.illumination >= 0.2 && this.illumination < 0.7;
  }

  get isActive(): boolean {
    return this.illumination >= 0.7;
  }

  // For CSS custom property
  get illuminationStyle(): string {
    return this.illumination.toString();
  }

  // v4.7.1: Color for CSS variable
  get colorStyle(): string {
    return this.color;
  }
}
