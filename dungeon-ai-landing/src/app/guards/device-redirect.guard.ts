import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { DeviceDetectorService } from '../services/device-detector.service';

/**
 * v7.0: Guard to redirect mobile users to mobile layout
 * Only redirects on initial load, not on manual navigation
 */
export const deviceRedirectGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const deviceDetector = inject(DeviceDetectorService);

  // Check if user has explicitly chosen a view (stored in sessionStorage)
  const userChoice = sessionStorage.getItem('preferredView');
  if (userChoice) {
    return true; // Respect user's explicit choice
  }

  // Check if should redirect to mobile
  if (deviceDetector.shouldUseTowerLayout()) {
    // Only redirect if we're on the root path
    if (state.url === '/' || state.url === '') {
      router.navigate(['/mobile'], { replaceUrl: true });
      return false;
    }
  }

  return true;
};

/**
 * v7.0: Guard for mobile route - allows access and marks preference
 */
export const mobileRouteGuard: CanActivateFn = (route, state) => {
  // Mark that user is viewing mobile version
  sessionStorage.setItem('currentView', 'mobile');
  return true;
};

/**
 * v7.0: Guard for desktop route - allows access and marks preference
 */
export const desktopRouteGuard: CanActivateFn = (route, state) => {
  // Mark that user is viewing desktop version
  sessionStorage.setItem('currentView', 'desktop');
  return true;
};
