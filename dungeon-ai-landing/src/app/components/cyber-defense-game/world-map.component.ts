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
      <!-- Loading Spinner -->
      <div class="loading-overlay" *ngIf="isLoading">
        <div class="loading-content">
          <div class="cyber-spinner">
            <div class="spinner-ring"></div>
            <div class="spinner-ring"></div>
            <div class="spinner-ring"></div>
          </div>
          <p class="loading-text">INITIALIZING GLOBAL DEFENSE NETWORK...</p>
          <div class="loading-bar">
            <div class="loading-progress"></div>
          </div>
        </div>
      </div>

      <div #mapContainer class="map-container"></div>

      <!-- Overlay UI -->
      <div class="map-overlay-ui" *ngIf="!isLoading">
        <div class="title-bar">
          <h1 class="game-title">CYBER DEFENSE</h1>
          <p class="subtitle">Select a datacenter under attack</p>
        </div>

        <div class="stats-panel">
          <div class="stat">
            <svg class="stat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="8"/>
              <path d="M12 6v6l4 2"/>
            </svg>
            <span class="value">{{ credits }}</span>
          </div>
          <div class="stat">
            <svg class="stat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2L15 8H21L16 12L18 19L12 15L6 19L8 12L3 8H9L12 2Z"/>
            </svg>
            <span class="value">{{ wins }}</span>
          </div>
          <div class="stat">
            <svg class="stat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="8" r="5"/>
              <path d="M7 21L12 13L17 21"/>
              <path d="M9 17h6"/>
            </svg>
            <span class="value">{{ kills }}</span>
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
            <ng-container *ngIf="selectedDatacenter.isUnlocked">DEFEND</ng-container>
            <ng-container *ngIf="!selectedDatacenter.isUnlocked">
              <svg class="lock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="5" y="11" width="14" height="10" rx="2"/>
                <path d="M8 11V7a4 4 0 118 0v4"/>
              </svg>
              LOCKED
            </ng-container>
          </button>
        </div>
      </div>

      <!-- Back button -->
      <button class="back-btn" (click)="goBack()">
        ← Volver al Hábitat
      </button>

      <!-- Green overlay for Matrix effect -->
      <div class="map-green-overlay"></div>

      <!-- Attack Notifications Panel -->
      <div class="attack-notifications" *ngIf="!isLoading && activeAlerts.length > 0">
        <div
          class="attack-notification"
          *ngFor="let alert of activeAlerts"
          (click)="selectDatacenter(alert)"
        >
          <svg class="alert-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2L2 22h20L12 2z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <circle cx="12" cy="17" r="1"/>
          </svg>
          <div class="alert-content">
            <div class="alert-title">{{ alert.name }}</div>
            <div class="alert-location">{{ alert.city }}, {{ alert.country }}</div>
            <div class="alert-difficulty">{{ getDifficultyLabel(alert.difficulty) }}</div>
          </div>
        </div>
      </div>
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

    /* Loading Overlay */
    .loading-overlay {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: #000;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      animation: fadeIn 0.3s ease-in;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .loading-content {
      text-align: center;
    }

    .cyber-spinner {
      position: relative;
      width: 120px;
      height: 120px;
      margin: 0 auto 2rem;

      .spinner-ring {
        position: absolute;
        top: 50%;
        left: 50%;
        border-radius: 50%;
        border: 3px solid transparent;

        &:nth-child(1) {
          width: 100px;
          height: 100px;
          margin: -50px 0 0 -50px;
          border-top-color: #00ff44;
          border-bottom-color: #00ff44;
          animation: spinRing 1.5s linear infinite;
        }

        &:nth-child(2) {
          width: 70px;
          height: 70px;
          margin: -35px 0 0 -35px;
          border-left-color: #ff3366;
          border-right-color: #ff3366;
          animation: spinRing 1s linear infinite reverse;
        }

        &:nth-child(3) {
          width: 40px;
          height: 40px;
          margin: -20px 0 0 -20px;
          border-top-color: #00ff00;
          animation: spinRing 0.75s linear infinite;
        }
      }
    }

    @keyframes spinRing {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    .loading-text {
      font-family: 'Source Code Pro', monospace;
      font-size: 1rem;
      color: #00ff44;
      margin: 0 0 1.5rem 0;
      letter-spacing: 0.15em;
      animation: textFlicker 0.5s ease-in-out infinite alternate;
    }

    @keyframes textFlicker {
      from { opacity: 0.8; }
      to { opacity: 1; }
    }

    .loading-bar {
      width: 300px;
      height: 4px;
      background: rgba(0, 255, 68, 0.2);
      border-radius: 2px;
      overflow: hidden;
      margin: 0 auto;

      .loading-progress {
        width: 100%;
        height: 100%;
        background: linear-gradient(90deg, #00ff44, #ff3366, #00ff44);
        background-size: 200% 100%;
        animation: progressSlide 1.5s ease-in-out infinite;
      }
    }

    @keyframes progressSlide {
      0% { background-position: 100% 0; }
      100% { background-position: -100% 0; }
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
        font-family: 'Source Code Pro', monospace;
        font-size: 2.5rem;
        color: #00ff44;
        margin: 0;
        text-shadow: 0 0 20px #00ff44, 0 0 40px #00ff44;
        letter-spacing: 0.2em;
      }

      .subtitle {
        font-family: 'Source Code Pro', monospace;
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
        border: 1px solid rgba(0, 255, 68, 0.3);
        padding: 0.75rem 1rem;

        .stat-icon {
          width: 24px;
          height: 24px;
          color: #00ff44;
          margin-bottom: 0.25rem;
          filter: drop-shadow(0 0 4px #00ff44);
        }

        .value {
          font-family: 'Source Code Pro', monospace;
          font-size: 1.2rem;
          color: #ffff00;
          font-weight: bold;
        }
      }
    }

    .lock-icon {
      width: 16px;
      height: 16px;
      margin-right: 0.5rem;
      vertical-align: middle;
    }

    .datacenter-popup {
      position: absolute;
      bottom: 2rem;
      right: 2rem;
      width: 320px;
      background: rgba(10, 10, 26, 0.95);
      border: 2px solid #00ff44;
      box-shadow: 0 0 30px rgba(0, 255, 68, 0.3);
      padding: 1.5rem;
      transform: translateX(400px);
      transition: transform 0.3s ease-out;
      z-index: 20;
      font-family: 'Source Code Pro', monospace;

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
          &.easy { background: rgba(0, 255, 68, 0.2); color: #00ff44; border: 1px solid #00ff44; }
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
        color: #00ff44;
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
          font-family: 'Source Code Pro', monospace;
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
      top: 1.5rem;
      left: 1.5rem;
      padding: 0.75rem 1.5rem;
      font-family: 'Source Code Pro', monospace;
      font-size: 0.9rem;
      background: rgba(0, 0, 0, 0.7);
      border: 1px solid rgba(0, 255, 68, 0.5);
      color: #00ff44;
      cursor: pointer;
      transition: all 0.2s ease;
      z-index: 15;

      &:hover {
        border-color: #00ff44;
        background: rgba(0, 255, 68, 0.1);
        box-shadow: 0 0 15px rgba(0, 255, 68, 0.3);
      }
    }

    /* Attack Notifications */
    .attack-notifications {
      position: absolute;
      bottom: 1.5rem;
      left: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      max-width: 350px;
      z-index: 15;
    }

    .attack-notification {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem 1rem;
      background: rgba(20, 0, 0, 0.9);
      border: 1px solid #ff3333;
      border-left: 4px solid #ff0000;
      font-family: 'Source Code Pro', monospace;
      animation: alertPulse 2s ease-in-out infinite;
      cursor: pointer;
      transition: all 0.2s ease;

      &:hover {
        background: rgba(50, 0, 0, 0.95);
        border-color: #ff5555;
        box-shadow: 0 0 20px rgba(255, 0, 0, 0.4);
      }

      .alert-icon {
        width: 24px;
        height: 24px;
        color: #ff3333;
        flex-shrink: 0;
        animation: iconBlink 1s ease-in-out infinite;
      }

      .alert-content {
        flex: 1;
        min-width: 0;

        .alert-title {
          font-size: 0.85rem;
          color: #ff3333;
          font-weight: bold;
          text-transform: uppercase;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .alert-location {
          font-size: 0.75rem;
          color: #ff6666;
          margin-top: 0.25rem;
        }

        .alert-difficulty {
          font-size: 0.65rem;
          color: #ffaa00;
          text-transform: uppercase;
          margin-top: 0.25rem;
        }
      }
    }

    @keyframes alertPulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.85; }
    }

    @keyframes iconBlink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    /* Green Map Overlay */
    .map-green-overlay {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 255, 68, 0.05);
      pointer-events: none;
      z-index: 1;
      mix-blend-mode: overlay;
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
  activeAlerts: DatacenterLevel[] = [];

  selectedDatacenter: DatacenterLevel | null = null;
  showPopup = false;
  isLoading = true;

  // Difficulty labels in Spanish
  private difficultyLabels: Record<string, string> = {
    tutorial: 'TUTORIAL',
    easy: 'FÁCIL',
    medium: 'MEDIO',
    hard: 'DIFÍCIL',
    boss: 'JEFE'
  };

  getDifficultyLabel(difficulty: string): string {
    return this.difficultyLabels[difficulty] || difficulty.toUpperCase();
  }

  ngOnInit(): void {
    this.initMap();
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
    }
  }

  private initMap(): void {
    // Use MapTiler style that supports globe projection
    this.map = new maplibregl.Map({
      container: this.mapContainer.nativeElement,
      style: {
        version: 8,
        glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
        sources: {
          'carto': {
            type: 'raster',
            tiles: ['https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png'],
            tileSize: 256
          }
        },
        layers: [{
          id: 'carto-tiles',
          type: 'raster',
          source: 'carto'
        }],
        projection: { type: 'globe' }
      },
      center: [0, 20],
      zoom: 1.8,
      minZoom: 1.5,
      maxZoom: 8,
      attributionControl: false
    });

    this.map.on('load', () => {
      // Add datacenter markers
      this.addDatacenterMarkers();

      // Hide loading after a brief delay for smooth transition
      setTimeout(() => {
        this.isLoading = false;
      }, 800);
    });

    // Close popup when user zooms out (any amount) with slide animation
    let lastZoom = this.map.getZoom();
    this.map.on('zoom', () => {
      const currentZoom = this.map.getZoom();
      // If zooming out and popup is visible, close it with animation
      if (currentZoom < lastZoom && this.showPopup) {
        this.dismissPopup();
      }
      lastZoom = currentZoom;
    });

    // Add attribution
    this.map.addControl(new maplibregl.AttributionControl({
      compact: true
    }), 'bottom-right');
  }

  private addDatacenterMarkers(): void {
    // Get all unlocked and not cleared datacenters
    const availableTargets = DATACENTER_LEVELS.filter(
      dc => dc.isUnlocked && !this.clearedLevels.includes(dc.id)
    );

    // Group by region based on longitude to ensure global distribution
    const americas = availableTargets.filter(dc => dc.coordinates[0] < -30);
    const europeAfrica = availableTargets.filter(dc => dc.coordinates[0] >= -30 && dc.coordinates[0] < 60);
    const asiaOceania = availableTargets.filter(dc => dc.coordinates[0] >= 60);

    // Pick 1 random from each region (if available)
    this.activeAlerts = [];

    if (americas.length > 0) {
      this.activeAlerts.push(americas[Math.floor(Math.random() * americas.length)]);
    }
    if (europeAfrica.length > 0) {
      this.activeAlerts.push(europeAfrica[Math.floor(Math.random() * europeAfrica.length)]);
    }
    if (asiaOceania.length > 0) {
      this.activeAlerts.push(asiaOceania[Math.floor(Math.random() * asiaOceania.length)]);
    }

    // Create alert icon as image for the map
    const alertIcon = new Image(48, 48);
    alertIcon.onload = () => {
      this.map.addImage('alert-icon', alertIcon);

      // Add GeoJSON source with alert locations
      this.map.addSource('alerts', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: this.activeAlerts.map(dc => ({
            type: 'Feature' as const,
            properties: { id: dc.id },
            geometry: {
              type: 'Point' as const,
              coordinates: dc.coordinates
            }
          }))
        }
      });

      // Add pulsing circle layer (background glow)
      this.map.addLayer({
        id: 'alerts-glow',
        type: 'circle',
        source: 'alerts',
        paint: {
          'circle-radius': 20,
          'circle-color': '#ff3333',
          'circle-opacity': 0.4,
          'circle-blur': 1
        }
      });

      // Add symbol layer with the alert icon
      this.map.addLayer({
        id: 'alerts-icon',
        type: 'symbol',
        source: 'alerts',
        layout: {
          'icon-image': 'alert-icon',
          'icon-size': 0.7,
          'icon-allow-overlap': true
        }
      });

      // Handle click on alerts
      this.map.on('click', 'alerts-icon', (e) => {
        if (e.features && e.features.length > 0) {
          const clickedId = e.features[0].properties?.['id'];
          const dc = this.activeAlerts.find(a => a.id === clickedId);
          if (dc) {
            this.selectDatacenter(dc);
          }
        }
      });

      // Change cursor on hover
      this.map.on('mouseenter', 'alerts-icon', () => {
        this.map.getCanvas().style.cursor = 'pointer';
      });
      this.map.on('mouseleave', 'alerts-icon', () => {
        this.map.getCanvas().style.cursor = '';
      });
    };

    // Create SVG data URL for the alert triangle
    alertIcon.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="48" height="48">
        <defs>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="blur"/>
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        <path d="M12 2L2 22h20L12 2z" fill="#ff3333" stroke="#ff0000" stroke-width="1" filter="url(#glow)"/>
        <line x1="12" y1="8" x2="12" y2="14" stroke="#000" stroke-width="2"/>
        <circle cx="12" cy="17" r="1.5" fill="#000"/>
      </svg>
    `);
  }

  selectDatacenter(dc: DatacenterLevel): void {
    this.selectedDatacenter = dc;
    this.showPopup = false;

    // Fly to location with maximum zoom
    this.map.flyTo({
      center: dc.coordinates,
      zoom: 8, // Maximum zoom for detailed view
      speed: 1.2,
      curve: 1.42,
      duration: 2500
    });

    // Show popup after fly animation
    setTimeout(() => {
      this.showPopup = true;
    }, 1500);
  }

  closePopup(): void {
    this.dismissPopup();

    // Zoom back out after animation
    setTimeout(() => {
      this.map.flyTo({
        center: [0, 20],
        zoom: 1.5,
        duration: 1500
      });
    }, 350);
  }

  // Dismiss popup with slide-out animation
  private dismissPopup(): void {
    if (!this.showPopup) return;

    this.showPopup = false;
    // Wait for slide-out animation (0.3s) before removing from DOM
    setTimeout(() => {
      this.selectedDatacenter = null;
    }, 350);
  }

  startDefense(): void {
    if (this.selectedDatacenter && this.selectedDatacenter.isUnlocked) {
      this.levelSelected.emit(this.selectedDatacenter);
    }
  }

  goBack(): void {
    this.backClicked.emit();
  }
}
