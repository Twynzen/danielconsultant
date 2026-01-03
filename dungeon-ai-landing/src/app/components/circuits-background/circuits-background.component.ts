import { Component, OnInit, OnDestroy, HostListener, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LightingService, LightSource } from '../../services/lighting.service';
import { Subscription } from 'rxjs';
import { throttleTime } from 'rxjs/operators';
import { WORLD_CONFIG } from '../../config/world.config';

// Mismas interfaces pero adaptadas para CSS approach
interface FixedCircuit {
  x: number;
  y: number;
  pattern: string;
  baseOpacity: number;
  litOpacity: number;
  isLit: boolean;
}

interface DynamicConnection {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  progress: number;
  isActive: boolean;
  connectedCircuits: FixedCircuit[];
}


@Component({
  selector: 'app-circuits-background',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './circuits-background.component.html',
  styleUrl: './circuits-background.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CircuitsBackgroundComponent implements OnInit, OnDestroy {
  // Circuit system - OPTIMIZED: Reduced count for performance
  fixedCircuits: FixedCircuit[] = [];
  dynamicConnections: DynamicConnection[] = [];

  // World dimensions for SVG viewBox (3x viewport)
  worldWidth = WORLD_CONFIG.getWorldWidth();
  worldHeight = WORLD_CONFIG.getWorldHeight();

  // Subscriptions
  private lightingSubscription!: Subscription;

  constructor(private lightingService: LightingService) {}

  ngOnInit(): void {
    this.generateFixedCircuits();
    this.generateDynamicConnections();
    this.setupLightingSubscription();
  }

  ngOnDestroy(): void {
    if (this.lightingSubscription) {
      this.lightingSubscription.unsubscribe();
    }
  }

  @HostListener('window:resize')
  onResize() {
    this.worldWidth = WORLD_CONFIG.getWorldWidth();
    this.worldHeight = WORLD_CONFIG.getWorldHeight();
  }

  private generateFixedCircuits(): void {
    // Patrones de circuitos Matrix binarios
    const patterns = ['-', '|', '+', '0', '1'];

    // OPTIMIZED: Drastically reduced circuit count for performance
    // Only ~100-150 circuits total instead of 700+
    const worldW = this.worldWidth;
    const worldH = this.worldHeight;

    // Smaller grid = fewer elements = better performance
    const rows = 12; // Reduced from 30
    const cols = 18; // Reduced from 48
    const cellWidth = worldW / cols;
    const cellHeight = worldH / rows;

    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        // Skip 65% of cells for performance
        if (Math.random() < 0.65) continue;

        const circuitX = j * cellWidth + (cellWidth / 2) + (Math.random() - 0.5) * 20;
        const circuitY = i * cellHeight + (cellHeight / 2) + (Math.random() - 0.5) * 20;

        const circuit: FixedCircuit = {
          x: circuitX,
          y: circuitY,
          pattern: patterns[Math.floor(Math.random() * patterns.length)],
          baseOpacity: 0.2,
          litOpacity: 0.8,
          isLit: false
        };

        this.fixedCircuits.push(circuit);
      }
    }
  }

  private generateDynamicConnections(): void {
    // OPTIMIZED: Fewer connections, simpler algorithm
    const maxConnections = Math.min(15, Math.floor(this.fixedCircuits.length * 0.15));

    for (let i = 0; i < maxConnections && i < this.fixedCircuits.length - 1; i++) {
      const startCircuit = this.fixedCircuits[i];
      const endCircuit = this.fixedCircuits[i + 1];

      const connection: DynamicConnection = {
        startX: startCircuit.x,
        startY: startCircuit.y,
        endX: endCircuit.x,
        endY: endCircuit.y,
        progress: 1, // Static - no animation for performance
        isActive: false,
        connectedCircuits: [startCircuit, endCircuit]
      };

      this.dynamicConnections.push(connection);
    }
  }

  private setupLightingSubscription(): void {
    // OPTIMIZED: Throttle updates to 100ms (10fps) instead of every frame
    this.lightingSubscription = this.lightingService.getLightSources()
      .pipe(throttleTime(100))
      .subscribe(lightSources => {
        this.updateCircuitIllumination(lightSources);
      });
  }

  private updateCircuitIllumination(lightSources: LightSource[]): void {
    // Get character light only (most important)
    const characterLight = lightSources.find(l => l.id === 'character-light');
    if (!characterLight) return;

    // OPTIMIZED: Only check circuits within reasonable distance
    const lightRadius = characterLight.radius;

    this.fixedCircuits.forEach(circuit => {
      if (circuit.isLit) return; // Already lit, skip

      const dx = circuit.x - characterLight.x;
      const dy = circuit.y - characterLight.y;
      const distanceSquared = dx * dx + dy * dy;

      if (distanceSquared <= lightRadius * lightRadius) {
        circuit.isLit = true;
      }
    });

    // Update connections only when circuits change
    this.dynamicConnections.forEach(connection => {
      if (!connection.isActive) {
        const allConnectedLit = connection.connectedCircuits.every(c => c.isLit);
        if (allConnectedLit) {
          connection.isActive = true;
        }
      }
    });
  }

  // TrackBy functions for ngFor optimization
  trackCircuit(index: number, circuit: FixedCircuit): number {
    return index;
  }

  trackConnection(index: number, connection: DynamicConnection): number {
    return index;
  }
}