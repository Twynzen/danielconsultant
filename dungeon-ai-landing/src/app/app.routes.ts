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
  {
    path: 'multidesktopflow',
    loadComponent: () => import('./pages/multidesktopflow/multidesktopflow.component')
      .then(m => m.MultidesktopflowComponent),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
