import { Injectable, signal, computed } from '@angular/core';

export type DeviceType = 'mobile' | 'tablet' | 'desktop';
export type Orientation = 'portrait' | 'landscape';

export interface DeviceInfo {
  type: DeviceType;
  orientation: Orientation;
  isTouchDevice: boolean;
  screenWidth: number;
  screenHeight: number;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
}

/**
 * v7.0: Device Detection Service for responsive mobile experience
 * Detects device type, orientation, and provides reactive signals
 */
@Injectable({
  providedIn: 'root'
})
export class DeviceDetectorService {
  // Breakpoints
  private readonly MOBILE_MAX = 768;
  private readonly TABLET_MAX = 1024;

  // Reactive signals
  private _screenWidth = signal(window.innerWidth);
  private _screenHeight = signal(window.innerHeight);
  private _orientation = signal<Orientation>(this.getOrientation());

  // Computed device type
  deviceType = computed<DeviceType>(() => {
    const width = this._screenWidth();
    if (width <= this.MOBILE_MAX) return 'mobile';
    if (width <= this.TABLET_MAX) return 'tablet';
    return 'desktop';
  });

  // Convenience computed properties
  isMobile = computed(() => this.deviceType() === 'mobile');
  isTablet = computed(() => this.deviceType() === 'tablet');
  isDesktop = computed(() => this.deviceType() === 'desktop');
  isMobileOrTablet = computed(() => this.isMobile() || this.isTablet());

  // Touch detection
  isTouchDevice = signal(this.detectTouch());

  // Full device info
  deviceInfo = computed<DeviceInfo>(() => ({
    type: this.deviceType(),
    orientation: this._orientation(),
    isTouchDevice: this.isTouchDevice(),
    screenWidth: this._screenWidth(),
    screenHeight: this._screenHeight(),
    isMobile: this.isMobile(),
    isTablet: this.isTablet(),
    isDesktop: this.isDesktop()
  }));

  constructor() {
    this.setupListeners();
  }

  private setupListeners(): void {
    // Resize listener
    window.addEventListener('resize', () => {
      this._screenWidth.set(window.innerWidth);
      this._screenHeight.set(window.innerHeight);
      this._orientation.set(this.getOrientation());
    });

    // Orientation change listener (for mobile)
    window.addEventListener('orientationchange', () => {
      setTimeout(() => {
        this._screenWidth.set(window.innerWidth);
        this._screenHeight.set(window.innerHeight);
        this._orientation.set(this.getOrientation());
      }, 100); // Small delay for orientation to complete
    });
  }

  private getOrientation(): Orientation {
    return window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';
  }

  private detectTouch(): boolean {
    return (
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      (navigator as any).msMaxTouchPoints > 0
    );
  }

  /**
   * Force mobile view (for testing)
   */
  forceMobileView(): void {
    this._screenWidth.set(375);
    this._screenHeight.set(667);
  }

  /**
   * Force desktop view (for testing)
   */
  forceDesktopView(): void {
    this._screenWidth.set(1920);
    this._screenHeight.set(1080);
  }

  /**
   * Check if should use mobile tower layout
   * Returns true for mobile devices OR portrait tablets
   */
  shouldUseTowerLayout = computed(() => {
    return this.isMobile() || (this.isTablet() && this._orientation() === 'portrait');
  });
}
