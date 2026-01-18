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
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { MobileSendellComponent } from '../mobile-sendell/mobile-sendell.component';
import { ModalServiceComponent } from '../../modal-service/modal-service.component';
import { PILLARS, PillarConfig, PILLAR_ICONS } from '../../../config/pillar.config';
import { DeviceDetectorService } from '../../../services/device-detector.service';
import { RobotAction } from '../../../config/sendell-ai.config';

/**
 * v8.2: Mobile Tower Layout Component - Elevator Design
 * Simplified vertical tower with elevator indicator
 *
 * Visual concept:
 * ┌────────────────────────────┐
 * │   CONSULTOR IA        [🖥️] │ ← Header
 * ├────────────────────────────┤
 * │ ║ ┌──────────────────────┐ │
 * │ ◆ │  DESKFLOW            │ │ ← Elevator + Floor
 * │ ║ └──────────────────────┘ │
 * │ ║ ┌──────────────────────┐ │
 * │ ● │  NÚVARIZ             │ │ ← Track marker
 * │ ║ └──────────────────────┘ │
 * │ ║         ...              │
 * ├────────────────────────────┤
 * │  [💬 CHAT CON SENDELL]     │ ← Footer button
 * └────────────────────────────┘
 */
@Component({
  selector: 'app-mobile-tower-layout',
  standalone: true,
  imports: [
    CommonModule,
    MobileSendellComponent,
    ModalServiceComponent
  ],
  templateUrl: './mobile-tower-layout.component.html',
  styleUrls: ['./mobile-tower-layout.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MobileTowerLayoutComponent implements OnInit, OnDestroy, AfterViewInit {
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private deviceDetector = inject(DeviceDetectorService);
  private sanitizer = inject(DomSanitizer);

  @ViewChild('towerContainer') towerContainer!: ElementRef<HTMLDivElement>;

  // Tower floors (pillars in reverse order - bottom to top)
  floors = signal<PillarConfig[]>([]);

  // Current active floor
  activeFloorId = signal<string | null>(null);

  // Elevator state (which floor index the elevator is on)
  elevatorFloorIndex = signal(0);
  isRobotMoving = signal(false);
  robotDirection = signal<'up' | 'down' | 'idle'>('idle');

  // Chat state
  isChatOpen = signal(false);
  isChatMinimized = signal(false);

  // Modal state
  isModalOpen = signal(false);
  selectedFloorId = signal<string | null>(null);
  selectedFloorColor = signal('#00ff44');

  // v8.2: Floor highlight state (after elevator arrives)
  highlightedFloorId = signal<string | null>(null);
  private highlightTimeout: any = null;

  // Scroll state
  private scrollTimeout: any = null;
  currentScrollFloor = signal(0);

  // For backwards compatibility
  robotFloorIndex = computed(() => this.floors().length - 1 - this.elevatorFloorIndex());

  ngOnInit(): void {
    // Reverse pillars for tower (first pillar = ground floor, last = top floor)
    const reversedPillars = [...PILLARS].reverse();
    this.floors.set(reversedPillars);

    // Start elevator at ground floor (bottom = last in reversed array)
    this.elevatorFloorIndex.set(reversedPillars.length - 1);
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

    // Calculate which floor is in view
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
      const floor = floors[floors.length - 1 - floorIndex];
      this.activeFloorId.set(floor.id);
      this.cdr.markForCheck();
    }
  }

  /**
   * Get elevator position as percentage (0% = top, 100% = bottom)
   */
  getElevatorPosition(): number {
    const floors = this.floors();
    if (floors.length <= 1) return 0;
    return (this.elevatorFloorIndex() / (floors.length - 1)) * 100;
  }

  /**
   * Get SVG icon for a floor
   */
  getFloorIcon(floor: PillarConfig): SafeHtml {
    const iconSvg = PILLAR_ICONS[floor.icon] || PILLAR_ICONS['globe'];
    return this.sanitizer.bypassSecurityTrustHtml(iconSvg);
  }

  /**
   * Check if floor is external link
   */
  isExternalFloor(floor: PillarConfig): boolean {
    return floor.type === 'external' || !!floor.hologramConfig?.externalUrl;
  }

  /**
   * v8.2: Handle floor tap - two-step interaction
   * 1st click: Move elevator + highlight floor
   * 2nd click (when elevator is there): Open modal/link
   */
  onFloorTapped(floor: PillarConfig, index: number): void {
    const currentElevatorIndex = this.elevatorFloorIndex();
    const isElevatorHere = index === currentElevatorIndex;

    // Clear any pending highlight timeout
    if (this.highlightTimeout) {
      clearTimeout(this.highlightTimeout);
    }

    // If elevator is already here AND floor is highlighted, open modal
    if (isElevatorHere && this.highlightedFloorId() === floor.id) {
      this.openFloorContent(floor);
      return;
    }

    // If elevator not here, move it
    if (!isElevatorHere) {
      this.moveElevatorToFloor(index);

      // After elevator arrives (400ms animation), highlight the floor
      setTimeout(() => {
        this.highlightFloor(floor);
      }, 450);
    } else {
      // Elevator is here but floor not highlighted yet - highlight it
      this.highlightFloor(floor);
    }

    this.cdr.markForCheck();
  }

  /**
   * v8.2: Highlight a floor for 2 seconds
   */
  private highlightFloor(floor: PillarConfig): void {
    this.highlightedFloorId.set(floor.id);
    this.activeFloorId.set(floor.id);
    this.cdr.markForCheck();

    // Keep highlighted for 2 seconds, then dim if not clicked
    this.highlightTimeout = setTimeout(() => {
      // Don't remove highlight if modal is open
      if (!this.isModalOpen()) {
        this.highlightedFloorId.set(null);
        this.cdr.markForCheck();
      }
    }, 2000);
  }

  /**
   * v8.2: Open floor content (modal or external link)
   */
  private openFloorContent(floor: PillarConfig): void {
    if (this.isExternalFloor(floor)) {
      const url = floor.hologramConfig?.externalUrl || floor.destination;
      if (url.startsWith('http')) {
        window.open(url, '_blank');
      } else {
        this.router.navigate([url]);
      }
    } else {
      // Open service info modal
      this.selectedFloorId.set(floor.id);
      this.selectedFloorColor.set(floor.color);
      this.isModalOpen.set(true);
    }
    this.cdr.markForCheck();
  }

  /**
   * Move elevator to a specific floor index
   */
  private moveElevatorToFloor(targetIndex: number): void {
    const currentIndex = this.elevatorFloorIndex();

    if (targetIndex === currentIndex) return;

    // Set movement state
    this.robotDirection.set(targetIndex < currentIndex ? 'up' : 'down');
    this.isRobotMoving.set(true);

    // Animate movement (smooth transition via CSS, instant state change)
    this.elevatorFloorIndex.set(targetIndex);

    // Reset moving state after animation
    setTimeout(() => {
      this.isRobotMoving.set(false);
      this.robotDirection.set('idle');
      this.cdr.markForCheck();
    }, 400);
  }

  /**
   * Close the service info modal
   */
  closeModal(): void {
    this.isModalOpen.set(false);
    this.selectedFloorId.set(null);
    this.cdr.markForCheck();
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
   * Check if elevator is on this floor
   */
  isRobotOnFloor(index: number): boolean {
    return this.elevatorFloorIndex() === index;
  }

  /**
   * Navigate back to desktop version
   */
  goToDesktop(): void {
    this.router.navigate(['/']);
  }

  /**
   * Get current floor for elevator
   */
  getCurrentFloor(): PillarConfig | null {
    const floors = this.floors();
    const index = this.elevatorFloorIndex();
    return floors[index] || null;
  }

  /**
   * Get color of current floor (for elevator dynamic color)
   */
  getCurrentFloorColor(): string {
    const floor = this.getCurrentFloor();
    return floor?.color || '#00ff44';
  }

  /**
   * v8.1: Handle chat action requests (from Smart Responses)
   */
  onChatActionRequested(action: RobotAction): void {
    console.log('[MobileTower] Chat action requested:', action);

    if (action.type === 'walk_to_pillar' && action.target) {
      const floors = this.floors();
      const floorIndex = floors.findIndex(f => f.id === action.target);

      if (floorIndex !== -1) {
        console.log('[MobileTower] Moving elevator to floor:', action.target, 'index:', floorIndex);

        // Move elevator to that floor
        this.moveElevatorToFloor(floorIndex);

        // Scroll to that floor
        this.scrollToFloor(floorIndex);

        // Minimize chat so user can see the floor
        if (this.isChatOpen()) {
          setTimeout(() => {
            this.minimizeChat();
          }, 500);
        }
      }
    }
  }

  /**
   * Scroll tower to a specific floor
   */
  private scrollToFloor(floorIndex: number): void {
    if (!this.towerContainer?.nativeElement) return;

    const container = this.towerContainer.nativeElement;
    const floors = this.floors();
    const floorHeight = container.scrollHeight / floors.length;

    // Calculate scroll position
    const scrollFromBottom = (floors.length - 1 - floorIndex) * floorHeight;
    const targetScroll = container.scrollHeight - scrollFromBottom - container.clientHeight;

    container.scrollTo({
      top: Math.max(0, targetScroll),
      behavior: 'smooth'
    });
  }
}
