import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class DeviceService {
  private readonly MOBILE_BREAKPOINT = 768;

  isMobile = signal(this.checkIsMobile());

  constructor() {
    // Escuchar cambios de tamaño de ventana
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', () => {
        this.isMobile.set(this.checkIsMobile());
      });
    }
  }

  private checkIsMobile(): boolean {
    if (typeof window === 'undefined') return false;
    return window.innerWidth <= this.MOBILE_BREAKPOINT;
  }
}
