import { Routes } from '@angular/router';
import { LandingPageComponent } from './components/landing-page/landing-page.component';
import { VampireSurvivorsGameComponent } from './components/vampire-survivors-game/vampire-survivors-game.component';

export const routes: Routes = [
  {
    path: '',
    component: LandingPageComponent
  },
  {
    path: 'game',
    component: VampireSurvivorsGameComponent
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
