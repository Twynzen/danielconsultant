import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { CameraService } from '../../services/camera.service';
import { LightingService } from '../../services/lighting.service';
import { WORLD_CONFIG, AREA_THEMES } from '../../config/world.config';
import { PILLARS, getPillarWorldPosition } from '../../config/pillar.config';

interface AreaState {
  id: string;
  row: number;
  col: number;
  name: string;
  theme: string;
  color: string;
  visited: boolean;
}

interface PillarMarker {
  id: string;
  x: number;
  y: number;
  color: string;
}

@Component({
  selector: 'app-minimap',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './minimap.component.html',
  styleUrl: './minimap.component.scss'
})
export class MinimapComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private cameraService = inject(CameraService);
  private lightingService = inject(LightingService);

  // Minimap dimensions
  readonly MINIMAP_SIZE = 150;
  readonly CELL_SIZE = this.MINIMAP_SIZE / 3; // 50px per cell

  // Player position on minimap (0-150 scale)
  playerX = signal(75);
  playerY = signal(75);

  // Viewport indicator (current visible area)
  viewportX = signal(50);
  viewportY = signal(50);

  // Area states (visited tracking)
  areas = signal<AreaState[]>([]);

  // Pillar markers
  pillars = signal<PillarMarker[]>([]);

  // Current area indicator
  currentArea = computed(() => {
    const px = this.playerX();
    const py = this.playerY();
    const col = Math.floor(px / this.CELL_SIZE);
    const row = Math.floor(py / this.CELL_SIZE);
    return this.areas().find(a => a.row === row && a.col === col);
  });

  ngOnInit(): void {
    this.initializeAreas();
    this.initializePillars();
    this.subscribeToCharacterPosition();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeAreas(): void {
    const areaStates = WORLD_CONFIG.areas.map(area => ({
      id: area.id,
      row: area.row,
      col: area.col,
      name: area.name,
      theme: area.theme,
      color: AREA_THEMES[area.theme]?.primaryColor || '#00ff44',
      visited: area.row === 1 && area.col === 1 // Center starts visited
    }));
    this.areas.set(areaStates);
  }

  private initializePillars(): void {
    const markers = PILLARS.map(pillar => {
      const worldPos = getPillarWorldPosition(pillar);
      return {
        id: pillar.id,
        x: this.worldToMinimapX(worldPos.x),
        y: this.worldToMinimapY(worldPos.y),
        color: pillar.color
      };
    });
    this.pillars.set(markers);
  }

  private subscribeToCharacterPosition(): void {
    this.lightingService.getLightSources()
      .pipe(takeUntil(this.destroy$))
      .subscribe(lights => {
        const characterLight = lights.find(l => l.id === 'character-light');
        if (characterLight) {
          // Convert world position to minimap position
          const minimapX = this.worldToMinimapX(characterLight.x);
          const minimapY = this.worldToMinimapY(characterLight.y);

          this.playerX.set(minimapX);
          this.playerY.set(minimapY);

          // Update viewport indicator (camera position)
          const cameraOffset = this.cameraService.cameraOffset();
          const viewX = this.worldToMinimapX(-cameraOffset.x + window.innerWidth / 2);
          const viewY = this.worldToMinimapY(-cameraOffset.y + window.innerHeight / 2);
          this.viewportX.set(viewX);
          this.viewportY.set(viewY);

          // Mark current area as visited
          this.markCurrentAreaVisited(minimapX, minimapY);
        }
      });
  }

  private markCurrentAreaVisited(minimapX: number, minimapY: number): void {
    const col = Math.floor(minimapX / this.CELL_SIZE);
    const row = Math.floor(minimapY / this.CELL_SIZE);

    const areas = this.areas();
    const updated = areas.map(area => {
      if (area.row === row && area.col === col && !area.visited) {
        return { ...area, visited: true };
      }
      return area;
    });

    // Only update if something changed
    if (updated.some((a, i) => a.visited !== areas[i].visited)) {
      this.areas.set(updated);
    }
  }

  private worldToMinimapX(worldX: number): number {
    const worldWidth = WORLD_CONFIG.getWorldWidth();
    return (worldX / worldWidth) * this.MINIMAP_SIZE;
  }

  private worldToMinimapY(worldY: number): number {
    const worldHeight = WORLD_CONFIG.getWorldHeight();
    return (worldY / worldHeight) * this.MINIMAP_SIZE;
  }

  // Calculate viewport rectangle dimensions on minimap
  get viewportWidth(): number {
    const worldWidth = WORLD_CONFIG.getWorldWidth();
    return (window.innerWidth / worldWidth) * this.MINIMAP_SIZE;
  }

  get viewportHeight(): number {
    const worldHeight = WORLD_CONFIG.getWorldHeight();
    return (window.innerHeight / worldHeight) * this.MINIMAP_SIZE;
  }
}
