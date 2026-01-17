import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  signal,
  computed,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  ViewChild,
  ElementRef,
  AfterViewInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TowerFloorComponent } from '../tower-floor/tower-floor.component';
import { MobileRobotComponent } from '../mobile-robot/mobile-robot.component';
import { MobileSendellComponent } from '../mobile-sendell/mobile-sendell.component';
import { PILLARS, PillarConfig } from '../../../config/pillar.config';
import { DeviceDetectorService } from '../../../services/device-detector.service';

/**
 * v7.0: Mobile Tower Layout Component
 * Vertical scrolling tower experience for mobile devices
 *
 * Visual concept:
 * ┌──────────────────────┐
 * │   CONSULTOR IA       │ ← Fixed header
 * ├──────────────────────┤
 * │  ┌─────────────────┐ │
 * │  │   Floor 9       │ │
 * │  │   DESKFLOW      │ │
 * │  └─────────────────┘ │
 * │  ┌─────────────────┐ │
 * │  │   Floor 8       │ │ ← Scrollable tower
 * │  │   NÚVARIZ       │ │
 * │  └─────────────────┘ │
 * │         ...          │
 * │  ┌─────────────────┐ │
 * │  │   Floor 1       │ │
 * │  │   QUIÉN SOY     │ │
 * │  └─────────────────┘ │
 * ├──────────────────────┤
 * │  [Robot] 💬 Chat     │ ← Fixed bottom panel
 * └──────────────────────┘
 */
@Component({
  selector: 'app-mobile-tower-layout',
  standalone: true,
  imports: [
    CommonModule,
    TowerFloorComponent,
    MobileRobotComponent,
    MobileSendellComponent
  ],
  templateUrl: './mobile-tower-layout.component.html',
  styleUrls: ['./mobile-tower-layout.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MobileTowerLayoutComponent implements OnInit, OnDestroy, AfterViewInit {
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private deviceDetector = inject(DeviceDetectorService);

  @ViewChild('towerContainer') towerContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('robotPanel') robotPanel!: ElementRef<HTMLDivElement>;

  // Tower floors (pillars in reverse order - bottom to top)
  floors = signal<PillarConfig[]>([]);

  // Current active floor
  activeFloorId = signal<string | null>(null);

  // Robot state
  robotFloorIndex = signal(0); // Which floor the robot is on (0 = ground floor)
  isRobotMoving = signal(false);
  robotDirection = signal<'up' | 'down' | 'idle'>('idle');

  // Chat state
  isChatOpen = signal(false);
  isChatMinimized = signal(false);

  // Scroll state
  private scrollTimeout: any = null;
  currentScrollFloor = signal(0);

  // Animation state
  isRobotEnergizing = signal(false);

  ngOnInit(): void {
    // Reverse pillars for tower (first pillar = ground floor, last = top floor)
    const reversedPillars = [...PILLARS].reverse();
    this.floors.set(reversedPillars);

    // Start robot at ground floor (last item in reversed array = "QUIÉN SOY")
    this.robotFloorIndex.set(reversedPillars.length - 1);
  }

  ngAfterViewInit(): void {
    this.setupScrollListener();
    // Scroll to bottom (ground floor) on init
    setTimeout(() => {
      if (this.towerContainer?.nativeElement) {
        this.towerContainer.nativeElement.scrollTop =
          this.towerContainer.nativeElement.scrollHeight;
      }
    }, 100);
  }

  ngOnDestroy(): void {
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
    }
  }

  private setupScrollListener(): void {
    if (!this.towerContainer?.nativeElement) return;

    this.towerContainer.nativeElement.addEventListener('scroll', () => {
      this.onScroll();
    }, { passive: true });
  }

  private onScroll(): void {
    if (!this.towerContainer?.nativeElement) return;

    const container = this.towerContainer.nativeElement;
    const scrollTop = container.scrollTop;
    const containerHeight = container.clientHeight;
    const scrollHeight = container.scrollHeight;

    // Calculate which floor is in view (reversed because we scroll from bottom)
    const floors = this.floors();
    const floorHeight = scrollHeight / floors.length;
    const scrollFromBottom = scrollHeight - scrollTop - containerHeight;
    const floorIndex = Math.floor(scrollFromBottom / floorHeight);

    const clampedIndex = Math.max(0, Math.min(floors.length - 1, floorIndex));
    this.currentScrollFloor.set(clampedIndex);

    // Debounced active floor update
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
    }

    this.scrollTimeout = setTimeout(() => {
      this.updateActiveFloor(clampedIndex);
    }, 150);
  }

  private updateActiveFloor(floorIndex: number): void {
    const floors = this.floors();
    if (floorIndex >= 0 && floorIndex < floors.length) {
      const floor = floors[floors.length - 1 - floorIndex]; // Reverse index
      this.activeFloorId.set(floor.id);
      this.cdr.markForCheck();
    }
  }

  /**
   * Handle floor tap - robot moves to that floor
   */
  onFloorTapped(floor: PillarConfig, index: number): void {
    // Index in reversed array
    const targetFloorIndex = this.floors().length - 1 - index;
    const currentIndex = this.robotFloorIndex();

    if (targetFloorIndex === currentIndex) {
      // Already on this floor - activate/enter
      this.onFloorActivated(floor);
      return;
    }

    // Move robot to floor
    this.moveRobotToFloor(targetFloorIndex);
  }

  private moveRobotToFloor(targetIndex: number): void {
    const currentIndex = this.robotFloorIndex();

    if (targetIndex === currentIndex) return;

    // Set movement direction
    this.robotDirection.set(targetIndex < currentIndex ? 'up' : 'down');
    this.isRobotMoving.set(true);

    // Animate movement (step by step)
    const step = targetIndex < currentIndex ? -1 : 1;
    const moveStep = () => {
      const current = this.robotFloorIndex();
      if (current !== targetIndex) {
        this.robotFloorIndex.set(current + step);
        this.cdr.markForCheck();
        setTimeout(moveStep, 200); // 200ms per floor
      } else {
        this.isRobotMoving.set(false);
        this.robotDirection.set('idle');
        this.cdr.markForCheck();
      }
    };

    setTimeout(moveStep, 50);
  }

  /**
   * Activate floor (open modal/external link)
   */
  onFloorActivated(floor: PillarConfig): void {
    // Handle different pillar types
    if (floor.type === 'external' || floor.hologramConfig?.externalUrl) {
      const url = floor.hologramConfig?.externalUrl || floor.destination;
      if (url.startsWith('http')) {
        window.open(url, '_blank');
      } else {
        this.router.navigate([url]);
      }
      return;
    }

    // For modal/hologram types, trigger energization animation
    this.isRobotEnergizing.set(true);

    setTimeout(() => {
      this.activeFloorId.set(floor.id);
      this.isRobotEnergizing.set(false);
      this.cdr.markForCheck();
      // TODO: Open modal with floor details
    }, 1500);
  }

  /**
   * Toggle chat panel
   */
  toggleChat(): void {
    if (this.isChatMinimized()) {
      this.isChatMinimized.set(false);
    } else {
      this.isChatOpen.set(!this.isChatOpen());
    }
    this.cdr.markForCheck();
  }

  /**
   * Minimize chat
   */
  minimizeChat(): void {
    this.isChatMinimized.set(true);
    this.cdr.markForCheck();
  }

  /**
   * Close chat completely
   */
  closeChat(): void {
    this.isChatOpen.set(false);
    this.isChatMinimized.set(false);
    this.cdr.markForCheck();
  }

  /**
   * Handle robot double-tap
   */
  onRobotDoubleTap(): void {
    if (!this.isChatOpen()) {
      this.isChatOpen.set(true);
      this.isChatMinimized.set(false);
    }
    this.cdr.markForCheck();
  }

  /**
   * Handle robot single tap
   */
  onRobotTap(): void {
    if (this.isChatOpen() && !this.isChatMinimized()) {
      this.minimizeChat();
    }
  }

  /**
   * Get floor display number (1-based, from bottom)
   */
  getFloorNumber(index: number): number {
    return this.floors().length - index;
  }

  /**
   * Check if robot is on this floor
   */
  isRobotOnFloor(index: number): boolean {
    const floorIndex = this.floors().length - 1 - index;
    return this.robotFloorIndex() === floorIndex;
  }

  /**
   * Navigate back to desktop version
   */
  goToDesktop(): void {
    this.router.navigate(['/']);
  }

  /**
   * Get current floor for robot
   */
  getCurrentFloor(): PillarConfig | null {
    const floors = this.floors();
    const index = floors.length - 1 - this.robotFloorIndex();
    return floors[index] || null;
  }
}
