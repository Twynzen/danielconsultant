import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

const AUTH_TIMEOUT_MS = 5000; // 5 seconds max wait (reduced from 10s)
const AUTH_CHECK_INTERVAL_MS = 100;

export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Allow access if authenticated OR in offline mode
  if (authService.canAccessApp()) {
    return true;
  }

  // Wait for auth state to be determined (with timeout)
  if (authService.isLoading()) {
    return new Promise((resolve) => {
      const startTime = Date.now();

      const checkAuth = setInterval(() => {
        const elapsed = Date.now() - startTime;

        // Timeout protection
        if (elapsed >= AUTH_TIMEOUT_MS) {
          clearInterval(checkAuth);
          router.navigate(['/login']);
          resolve(false);
          return;
        }

        // Normal check
        if (!authService.isLoading()) {
          clearInterval(checkAuth);

          if (authService.canAccessApp()) {
            resolve(true);
          } else {
            router.navigate(['/login']);
            resolve(false);
          }
        }
      }, AUTH_CHECK_INTERVAL_MS);
    });
  }

  router.navigate(['/login']);
  return false;
};

export const guestGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // If already authenticated, redirect to home
  if (authService.isAuthenticated() && !authService.isLoading()) {
    router.navigate(['/']);
    return false;
  }

  return true;
};
