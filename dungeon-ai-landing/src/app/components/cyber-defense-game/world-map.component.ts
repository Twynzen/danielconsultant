import { Component, OnInit, OnDestroy, ElementRef, ViewChild, Output, EventEmitter, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as maplibregl from 'maplibre-gl';
import { DatacenterLevel, Difficulty } from './game.types';
import { DATACENTER_LEVELS, getDifficultyColor } from './datacenter.data';

@Component({
  selector: 'app-world-map',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="world-map-container">
      <div #mapContainer class="map-container"></div>

      <!-- Overlay UI -->
      <div class="map-overlay-ui">
        <div class="title-bar">
          <h1 class="game-title">CYBER DEFENSE</h1>
          <p class="subtitle">Select a datacenter under attack</p>
        </div>

        <div class="stats-panel">
          <div class="stat">
            <span class="icon">💰</span>
            <span class="value">{{ credits }}</span>
          </div>
          <div class="stat">
            <span class="icon">🏆</span>
            <span class="value">{{ wins }}</span>
          </div>
          <div class="stat">
            <span class="icon">☠️</span>
            <span class="value">{{ kills }}</span>
          </div>
        </div>

        <div class="legend">
          <div class="legend-item">
            <span class="dot tutorial"></span> Tutorial
          </div>
          <div class="legend-item">
            <span class="dot easy"></span> Easy
          </div>
          <div class="legend-item">
            <span class="dot medium"></span> Medium
          </div>
          <div class="legend-item">
            <span class="dot hard"></span> Hard
          </div>
          <div class="legend-item">
            <span class="dot boss"></span> Boss
          </div>
        </div>
      </div>

      <!-- Selected datacenter popup -->
      <div class="datacenter-popup" *ngIf="selectedDatacenter" [class.visible]="showPopup">
        <div class="popup-header">
          <span class="difficulty-badge" [class]="selectedDatacenter.difficulty">
            {{ selectedDatacenter.difficulty | uppercase }}
          </span>
          <button class="close-btn" (click)="closePopup()">×</button>
        </div>
        <h3>{{ selectedDatacenter.name }}</h3>
        <p class="company">{{ selectedDatacenter.company }}</p>
        <p class="location">{{ selectedDatacenter.city }}, {{ selectedDatacenter.country }}</p>
        <p class="description">{{ selectedDatacenter.description }}</p>
        <p class="duration">Duration: {{ selectedDatacenter.durationMinutes }} minutes</p>

        <div class="popup-actions">
          <button
            class="defend-btn"
            [disabled]="!selectedDatacenter.isUnlocked"
            (click)="startDefense()"
          >
            {{ selectedDatacenter.isUnlocked ? 'DEFEND' : '🔒 LOCKED' }}
          </button>
        </div>
      </div>

      <!-- Back button -->
      <button class="back-btn" (click)="goBack()">
        ← Back to Landing
      </button>
    </div>
  `,
  styles: [`
    .world-map-container {
      position: relative;
      width: 100vw;
      height: 100vh;
      background: #000;
      overflow: hidden;
    }

    .map-container {
      width: 100%;
      height: 100%;
    }

    .map-overlay-ui {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      padding: 1.5rem;
      pointer-events: none;
      z-index: 10;
    }

    .title-bar {
      text-align: center;

      .game-title {
        font-family: 'Courier New', monospace;
        font-size: 2.5rem;
        color: #00ffff;
        margin: 0;
        text-shadow: 0 0 20px #00ffff, 0 0 40px #00ffff;
        letter-spacing: 0.2em;
      }

      .subtitle {
        font-family: 'Courier New', monospace;
        font-size: 1rem;
        color: #ff3366;
        margin: 0.5rem 0 0 0;
        animation: pulse 2s ease-in-out infinite;
      }
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.6; }
    }

    .stats-panel {
      position: absolute;
      top: 1.5rem;
      right: 1.5rem;
      display: flex;
      gap: 1.5rem;
      pointer-events: auto;

      .stat {
        display: flex;
        flex-direction: column;
        align-items: center;
        background: rgba(0, 0, 0, 0.7);
        border: 1px solid rgba(0, 255, 255, 0.3);
        padding: 0.75rem 1rem;

        .icon {
          font-size: 1.2rem;
        }

        .value {
          font-family: 'Courier New', monospace;
          font-size: 1.2rem;
          color: #ffff00;
          font-weight: bold;
        }
      }
    }

    .legend {
      position: absolute;
      bottom: 1.5rem;
      left: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      background: rgba(0, 0, 0, 0.7);
      border: 1px solid rgba(0, 255, 255, 0.3);
      padding: 1rem;
      pointer-events: auto;
      font-family: 'Courier New', monospace;
      font-size: 0.85rem;
      color: #aaa;

      .legend-item {
        display: flex;
        align-items: center;
        gap: 0.5rem;

        .dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          animation: legendPulse 2s ease-in-out infinite;

          &.tutorial { background: #00ff00; box-shadow: 0 0 10px #00ff00; }
          &.easy { background: #00ffff; box-shadow: 0 0 10px #00ffff; }
          &.medium { background: #ffff00; box-shadow: 0 0 10px #ffff00; }
          &.hard { background: #ff6600; box-shadow: 0 0 10px #ff6600; }
          &.boss { background: #ff0066; box-shadow: 0 0 10px #ff0066; }
        }
      }
    }

    @keyframes legendPulse {
      0%, 100% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.2); opacity: 0.8; }
    }

    .datacenter-popup {
      position: absolute;
      bottom: 2rem;
      right: 2rem;
      width: 320px;
      background: rgba(10, 10, 26, 0.95);
      border: 2px solid #00ffff;
      box-shadow: 0 0 30px rgba(0, 255, 255, 0.3);
      padding: 1.5rem;
      transform: translateX(400px);
      transition: transform 0.3s ease-out;
      z-index: 20;
      font-family: 'Courier New', monospace;

      &.visible {
        transform: translateX(0);
      }

      .popup-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.5rem;

        .difficulty-badge {
          padding: 0.25rem 0.75rem;
          font-size: 0.75rem;
          font-weight: bold;

          &.tutorial { background: rgba(0, 255, 0, 0.2); color: #00ff00; border: 1px solid #00ff00; }
          &.easy { background: rgba(0, 255, 255, 0.2); color: #00ffff; border: 1px solid #00ffff; }
          &.medium { background: rgba(255, 255, 0, 0.2); color: #ffff00; border: 1px solid #ffff00; }
          &.hard { background: rgba(255, 102, 0, 0.2); color: #ff6600; border: 1px solid #ff6600; }
          &.boss { background: rgba(255, 0, 102, 0.2); color: #ff0066; border: 1px solid #ff0066; }
        }

        .close-btn {
          background: none;
          border: none;
          color: #888;
          font-size: 1.5rem;
          cursor: pointer;
          padding: 0;
          line-height: 1;

          &:hover {
            color: #ff3366;
          }
        }
      }

      h3 {
        margin: 0;
        color: #fff;
        font-size: 1.3rem;
      }

      .company {
        color: #00ffff;
        margin: 0.25rem 0;
        font-size: 0.9rem;
      }

      .location {
        color: #888;
        margin: 0;
        font-size: 0.85rem;
      }

      .description {
        color: #aaa;
        margin: 1rem 0;
        font-size: 0.85rem;
        line-height: 1.4;
        font-style: italic;
      }

      .duration {
        color: #ffff00;
        margin: 0;
        font-size: 0.85rem;
      }

      .popup-actions {
        margin-top: 1.5rem;

        .defend-btn {
          width: 100%;
          padding: 1rem;
          font-family: 'Courier New', monospace;
          font-size: 1.1rem;
          font-weight: bold;
          background: rgba(255, 51, 102, 0.2);
          border: 2px solid #ff3366;
          color: #ff3366;
          cursor: pointer;
          transition: all 0.2s ease;
          text-transform: uppercase;
          letter-spacing: 0.1em;

          &:hover:not(:disabled) {
            background: rgba(255, 51, 102, 0.4);
            box-shadow: 0 0 20px rgba(255, 51, 102, 0.5);
          }

          &:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            border-color: #666;
            color: #666;
          }
        }
      }
    }

    .back-btn {
      position: absolute;
      bottom: 1.5rem;
      right: 1.5rem;
      padding: 0.75rem 1.5rem;
      font-family: 'Courier New', monospace;
      font-size: 0.9rem;
      background: transparent;
      border: 1px solid #666;
      color: #888;
      cursor: pointer;
      transition: all 0.2s ease;
      z-index: 15;

      &:hover {
        border-color: #00ffff;
        color: #00ffff;
      }
    }

    /* Pulsing marker styles */
    :host ::ng-deep {
      .marker-container {
        cursor: pointer;
        transition: transform 0.2s ease;

        &:hover {
          transform: scale(1.3);
        }
      }

      .pulsing-marker {
        width: 20px;
        height: 20px;
        border-radius: 50%;
        position: relative;

        &::before {
          content: '';
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 100%;
          height: 100%;
          border-radius: 50%;
          animation: markerPulse 2s ease-out infinite;
        }

        &::after {
          content: '';
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: inherit;
        }

        &.tutorial {
          background: #00ff00;
          box-shadow: 0 0 15px #00ff00;
          &::before { border: 2px solid #00ff00; }
        }
        &.easy {
          background: #00ffff;
          box-shadow: 0 0 15px #00ffff;
          &::before { border: 2px solid #00ffff; }
        }
        &.medium {
          background: #ffff00;
          box-shadow: 0 0 15px #ffff00;
          &::before { border: 2px solid #ffff00; }
        }
        &.hard {
          background: #ff6600;
          box-shadow: 0 0 15px #ff6600;
          &::before { border: 2px solid #ff6600; }
        }
        &.boss {
          background: #ff0066;
          box-shadow: 0 0 20px #ff0066;
          width: 26px;
          height: 26px;
          &::before { border: 3px solid #ff0066; }
          &::after { width: 12px; height: 12px; }
        }

        &.locked {
          opacity: 0.4;

          &::before {
            animation: none;
          }
        }
      }

      @keyframes markerPulse {
        0% {
          width: 100%;
          height: 100%;
          opacity: 1;
        }
        100% {
          width: 300%;
          height: 300%;
          opacity: 0;
        }
      }
    }
  `]
})
export class WorldMapComponent implements OnInit, OnDestroy {
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef;
  @Output() levelSelected = new EventEmitter<DatacenterLevel>();
  @Output() backClicked = new EventEmitter<void>();

  @Input() credits = 0;
  @Input() wins = 0;
  @Input() kills = 0;
  @Input() clearedLevels: string[] = [];

  private map!: maplibregl.Map;
  private markers: maplibregl.Marker[] = [];

  selectedDatacenter: DatacenterLevel | null = null;
  showPopup = false;

  ngOnInit(): void {
    this.initMap();
  }

  ngOnDestroy(): void {
    this.markers.forEach(m => m.remove());
    if (this.map) {
      this.map.remove();
    }
  }

  private initMap(): void {
    this.map = new maplibregl.Map({
      container: this.mapContainer.nativeElement,
      style: {
        version: 8,
        sources: {
          'carto-dark': {
            type: 'raster',
            tiles: [
              'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
              'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
              'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png'
            ],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors © CARTO'
          }
        },
        layers: [
          {
            id: 'carto-dark-layer',
            type: 'raster',
            source: 'carto-dark',
            minzoom: 0,
            maxzoom: 19
          }
        ],
        glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf'
      },
      center: [0, 20],
      zoom: 1.5,
      minZoom: 1,
      maxZoom: 8,
      attributionControl: false
    });

    this.map.on('load', () => {
      // Enable globe projection
      this.map.setProjection({ type: 'globe' });

      // Add atmosphere effect (cast to any for types compatibility)
      (this.map as any).setFog({
        color: '#0a0a1a',
        'horizon-blend': 0.1,
        'high-color': '#0a1a2a',
        'space-color': '#000000',
        'star-intensity': 0.5
      });

      // Add datacenter markers
      this.addDatacenterMarkers();

      // Auto-rotate globe slowly
      this.startGlobeRotation();
    });

    // Add attribution
    this.map.addControl(new maplibregl.AttributionControl({
      compact: true
    }), 'bottom-right');
  }

  private addDatacenterMarkers(): void {
    for (const dc of DATACENTER_LEVELS) {
      const el = document.createElement('div');
      el.className = 'marker-container';

      const markerEl = document.createElement('div');
      markerEl.className = `pulsing-marker ${dc.difficulty}`;

      if (!dc.isUnlocked) {
        markerEl.classList.add('locked');
      }

      if (this.clearedLevels.includes(dc.id)) {
        markerEl.style.background = '#00ff00';
        markerEl.style.boxShadow = '0 0 15px #00ff00';
      }

      el.appendChild(markerEl);

      const marker = new maplibregl.Marker({
        element: el,
        anchor: 'center'
      })
        .setLngLat(dc.coordinates)
        .addTo(this.map);

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectDatacenter(dc);
      });

      this.markers.push(marker);
    }
  }

  private selectDatacenter(dc: DatacenterLevel): void {
    this.selectedDatacenter = dc;
    this.showPopup = false;

    // Fly to location
    this.map.flyTo({
      center: dc.coordinates,
      zoom: 5,
      speed: 0.8,
      curve: 1.42,
      duration: 2000
    });

    // Show popup after fly animation
    setTimeout(() => {
      this.showPopup = true;
    }, 1500);
  }

  closePopup(): void {
    this.showPopup = false;

    setTimeout(() => {
      this.selectedDatacenter = null;

      // Zoom back out
      this.map.flyTo({
        center: [0, 20],
        zoom: 1.5,
        duration: 1500
      });
    }, 300);
  }

  startDefense(): void {
    if (this.selectedDatacenter && this.selectedDatacenter.isUnlocked) {
      this.levelSelected.emit(this.selectedDatacenter);
    }
  }

  goBack(): void {
    this.backClicked.emit();
  }

  private startGlobeRotation(): void {
    const rotateGlobe = () => {
      if (!this.map || this.selectedDatacenter) return;

      const center = this.map.getCenter();
      center.lng += 0.02;
      this.map.setCenter(center);

      requestAnimationFrame(rotateGlobe);
    };

    // Start rotation after a delay
    setTimeout(() => {
      requestAnimationFrame(rotateGlobe);
    }, 2000);
  }
}
