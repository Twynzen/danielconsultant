import { Routes } from '@angular/router';
import { LandingPageComponent } from './components/landing-page/landing-page.component';

export const routes: Routes = [
  {
    path: '',
    component: LandingPageComponent
  },
  {
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
