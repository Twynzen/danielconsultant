import { Routes } from '@angular/router';
import { LandingPageComponent } from './components/landing-page/landing-page.component';
import { deviceRedirectGuard, mobileRouteGuard, desktopRouteGuard } from './guards/device-redirect.guard';

/**
 * v7.2: Updated routes with Cyber Defense Game
 *
 * Routes:
 * - '' (root): Desktop landing page (with auto-redirect for mobile devices)
 * - '/mobile': Mobile tower layout
 * - '/game': Original Vampire Survivors game
 * - '/cyber-defense': NEW Cyber Defense game with datacenter levels
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
    // Original Vampire Survivors game
    path: 'game',
    loadComponent: () => import('./components/vampire-survivors-game/vampire-survivors-game.component')
      .then(m => m.VampireSurvivorsGameComponent)
  },
  {
    // v7.2: NEW Cyber Defense Game - Defend datacenters from cyber threats
    // Features: 50+ real datacenter levels, 8 enemy types, 6 weapons with evolutions,
    // meta-progression system, world map level selector
    path: 'cyber-defense',
    loadComponent: () => import('./components/cyber-defense-game/cyber-defense-game.component')
      .then(m => m.CyberDefenseGameComponent)
  },
  {
    // v7.1: Model Research Platform - lazy loaded
    // Explore 100+ AI models for WebLLM/WebGPU with demos and documentation
    path: 'model-research',
    loadComponent: () => import('./components/model-research/model-research-layout/model-research-layout.component')
      .then(m => m.ModelResearchLayoutComponent)
  },
  {
    // Sendell AI Agents service page (original - robot + tabs + CTA)
    path: 'sendell',
    loadComponent: () => import('./pages/sendell-service/sendell-service.component')
      .then(m => m.SendellServiceComponent)
  },
  {
    // Sendell commercial landing (AutoManus-style — hero, demo, pricing, story)
    path: 'servicios',
    loadComponent: () => import('./pages/servicios-landing/servicios-landing.component')
      .then(m => m.ServiciosLandingComponent)
  },
  // DeskFlow app is served by Netlify at /deskflow (separate Angular app)
  {
    path: '**',
    redirectTo: '',
  },
];
