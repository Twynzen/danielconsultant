import { Routes } from '@angular/router';
import { LandingPageComponent } from './components/landing-page/landing-page.component';

export const routes: Routes = [
  {
    path: '',
    component: LandingPageComponent
  },
  {
    // Lazy load game component to reduce initial bundle size (~35KB savings)
    path: 'game',
    loadComponent: () => import('./components/vampire-survivors-game/vampire-survivors-game.component')
      .then(m => m.VampireSurvivorsGameComponent)
  },
  // DeskFlow app is served by Netlify at /deskflow (separate Angular app)
  {
    path: '**',
    redirectTo: '',
  },
];
