// src/app/features/game/dungeon-scene/door/door.component.ts
// Componente de puerta interactiva del dungeon

import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { Door } from '../../../../core/interfaces/game-state.interfaces';

@Component({
  selector: 'app-door',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="door"
      [style.left.px]="door.position.x"
      [style.top.px]="door.position.y"
      [style.width.px]="door.size.width"
      [style.height.px]="door.size.height"
      [style.--door-color]="door.color"
      [class.highlighted]="door.isHighlighted"
      [class.interactable]="door.isInteractable">

      <div class="door-frame">
        <div class="door-panel">
          <!-- Icono de puerta -->
          <svg class="door-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <rect x="3" y="2" width="14" height="20" rx="2" stroke-width="2"/>
            <circle cx="14" cy="12" r="1.5" fill="currentColor"/>
          </svg>
          <span class="door-label">{{ door.label }}</span>
        </div>
      </div>

      @if (door.isInteractable) {
        <div class="interaction-prompt">
          <span class="key-hint">ENTER</span>
          @if (door.description) {
            <span class="description">{{ door.description }}</span>
          }
        </div>
      }
    </div>
  `,
  styleUrl: './door.component.scss',
})
export class DoorComponent {
  @Input({ required: true }) door!: Door;
}
