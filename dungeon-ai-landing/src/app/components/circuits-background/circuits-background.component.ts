import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LightingService, LightSource } from '../../services/lighting.service';
import { Subscription, interval } from 'rxjs';
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

interface MatrixChar {
  symbol: string;
  delay: number;
}


@Component({
  selector: 'app-circuits-background',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './circuits-background.component.html',
  styleUrl: './circuits-background.component.scss'
})
export class CircuitsBackgroundComponent implements OnInit, OnDestroy {
  // Circuit system
  fixedCircuits: FixedCircuit[] = [];
  dynamicConnections: DynamicConnection[] = [];

  // World dimensions for SVG viewBox (3x viewport)
  worldWidth = WORLD_CONFIG.getWorldWidth();
  worldHeight = WORLD_CONFIG.getWorldHeight();
  
  // Subscriptions
  private lightingSubscription!: Subscription;
  private animationSubscription!: Subscription;
  
  // Matrix rain cache
  private matrixCharsCache: Map<number, MatrixChar[]> = new Map();
  
  // Debug mode flag
  debugMode = false; // Set to true para ver circuitos siempre

  constructor(private lightingService: LightingService) {}

  ngOnInit(): void {
    this.generateFixedCircuits();
    this.generateDynamicConnections();
    this.setupLightingSubscription();
    this.startAnimationLoop();
    
    // Debug: hacer algunos circuitos visibles inicialmente
    if (this.debugMode) {
      this.fixedCircuits.forEach((circuit, i) => {
        if (i % 3 === 0) circuit.isLit = true;
      });
    }
  }

  ngOnDestroy(): void {
    if (this.lightingSubscription) {
      this.lightingSubscription.unsubscribe();
    }
    if (this.animationSubscription) {
      this.animationSubscription.unsubscribe();
    }
  }

  @HostListener('window:resize')
  onResize() {
    this.worldWidth = WORLD_CONFIG.getWorldWidth();
    this.worldHeight = WORLD_CONFIG.getWorldHeight();
  }

  private generateFixedCircuits(): void {
    // Patrones de circuitos Matrix binarios
    const patterns = ['-', '|', '+', '0', '1', '0', '0', '1', '1'];

    // Generate fixed circuits across entire 3x3 world
    // Use world dimensions for proper coverage
    const worldW = this.worldWidth;
    const worldH = this.worldHeight;

    // Grid size for 3x3 world (more circuits needed)
    const rows = 30; // 10 * 3 for 3x world
    const cols = 48; // 16 * 3 for 3x world
    const cellWidth = worldW / cols;
    const cellHeight = worldH / rows;

    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        // Skip some cells to avoid oversaturation
        if (Math.random() < 0.5) continue; // Balance performance vs coverage

        const circuitX = j * cellWidth + (cellWidth / 2) + (Math.random() - 0.5) * 30;
        const circuitY = i * cellHeight + (cellHeight / 2) + (Math.random() - 0.5) * 30;

        const circuit: FixedCircuit = {
          x: circuitX,
          y: circuitY,
          pattern: patterns[Math.floor(Math.random() * patterns.length)],
          baseOpacity: 0.3 + Math.random() * 0.2,
          litOpacity: 0.9 + Math.random() * 0.1,
          isLit: false
        };

        this.fixedCircuits.push(circuit);
      }
    }
  }

  private generateDynamicConnections(): void {
    // Create potential connections between fixed circuits
    const maxConnections = Math.floor(this.fixedCircuits.length * 0.2); // Menos conexiones para performance
    
    for (let i = 0; i < maxConnections; i++) {
      const startCircuit = this.fixedCircuits[Math.floor(Math.random() * this.fixedCircuits.length)];
      const nearbyCircuits = this.fixedCircuits.filter(circuit => {
        const distance = Math.sqrt(
          Math.pow(circuit.x - startCircuit.x, 2) + 
          Math.pow(circuit.y - startCircuit.y, 2)
        );
        return distance > 50 && distance < 250 && circuit !== startCircuit;
      });
      
      if (nearbyCircuits.length > 0) {
        const endCircuit = nearbyCircuits[Math.floor(Math.random() * nearbyCircuits.length)];
        
        const connection: DynamicConnection = {
          startX: startCircuit.x,
          startY: startCircuit.y,
          endX: endCircuit.x,
          endY: endCircuit.y,
          progress: 0,
          isActive: false,
          connectedCircuits: [startCircuit, endCircuit]
        };
        
        this.dynamicConnections.push(connection);
      }
    }
  }

  private setupLightingSubscription(): void {
    this.lightingSubscription = this.lightingService.getLightSources().subscribe(lightSources => {
      this.updateCircuitIllumination(lightSources);
    });
  }

  private updateCircuitIllumination(lightSources: LightSource[]): void {
    // Update fixed circuits
    this.fixedCircuits.forEach(circuit => {
      let isNowLit = false;
      
      lightSources.forEach(light => {
        const distance = Math.sqrt(
          Math.pow(circuit.x - light.x, 2) + 
          Math.pow(circuit.y - light.y, 2)
        );
        
        if (distance <= light.radius) {
          isNowLit = true;
        }
      });
      
      // Una vez iluminado, permanece iluminado (como pidió Daniel)
      if (isNowLit && !circuit.isLit) {
        circuit.isLit = true;
      }
    });
    
    // Update dynamic connections
    this.dynamicConnections.forEach(connection => {
      const allConnectedLit = connection.connectedCircuits.every(circuit => circuit.isLit);
      
      if (allConnectedLit && !connection.isActive) {
        connection.isActive = true;
        connection.progress = 0;
      }
    });
  }

  private startAnimationLoop(): void {
    // CSS animations handle most of the animation
    // Solo necesitamos actualizar progress de connections
    this.animationSubscription = interval(50).subscribe(() => {
      this.dynamicConnections.forEach(connection => {
        if (connection.isActive && connection.progress < 1) {
          connection.progress += 0.02;
          if (connection.progress >= 1) {
            connection.progress = 0; // Loop animation
          }
        }
      });
    });
  }

  // Helper para generar caracteres Matrix rain
  getMatrixChars(circuitIndex: number): MatrixChar[] {
    if (!this.matrixCharsCache.has(circuitIndex)) {
      const chars: MatrixChar[] = [];
      const charCount = 3 + Math.floor(Math.random() * 3);
      const symbols = ['-', '|', '+', '0', '1', '0', '0', '1', '1']; // Solo símbolos básicos + binario Matrix
      
      for (let i = 0; i < charCount; i++) {
        chars.push({
          symbol: symbols[Math.floor(Math.random() * symbols.length)],
          delay: i * 200 + Math.random() * 100
        });
      }
      
      this.matrixCharsCache.set(circuitIndex, chars);
    }
    
    return this.matrixCharsCache.get(circuitIndex) || [];
  }
}