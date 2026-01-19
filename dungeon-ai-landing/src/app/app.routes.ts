import { Routes } from '@angular/router';
import { LandingPageComponent } from './components/landing-page/landing-page.component';
import { deviceRedirectGuard, mobileRouteGuard, desktopRouteGuard } from './guards/device-redirect.guard';

/**
 * v7.1: Updated routes with Model Research Platform
 *
 * Routes:
 * - '' (root): Desktop landing page (with auto-redirect for mobile devices)
 * - '/mobile': Mobile tower layout
 * - '/game': Vampire Survivors game
 * - '/model-research': AI Model Research Platform (100+ models)
 * - '/deskflow': Served by Netlify separately
 */
export const routes: Routes = [
  {
    path: '',
    component: LandingPageComponent,
    canActivate: [deviceRedirectGuard, desktopRouteGuard]
  },
  {
    // v7.0: Mobile tower layout - lazy loaded
    path: 'mobile',
    loadComponent: () => import('./components/mobile/mobile-tower-layout/mobile-tower-layout.component')
      .then(m => m.MobileTowerLayoutComponent),
    canActivate: [mobileRouteGuard]
  },
  {
    // Lazy load game component to reduce initial bundle size (~35KB savings)
    path: 'game',
    loadComponent: () => import('./components/vampire-survivors-game/vampire-survivors-game.component')
      .then(m => m.VampireSurvivorsGameComponent)
  },
  {
    // v7.1: Model Research Platform - lazy loaded
    // Explore 100+ AI models for WebLLM/WebGPU with demos and documentation
    path: 'model-research',
    loadComponent: () => import('./components/model-research/model-research-layout/model-research-layout.component')
      .then(m => m.ModelResearchLayoutComponent)
  },
  // DeskFlow app is served by Netlify at /deskflow (separate Angular app)
  {
    path: '**',
    redirectTo: '',
  },
];
