// src/app/app.routes.ts
// Rutas de la aplicación Dungeon Game

import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/game/game-container.component')
      .then(m => m.GameContainerComponent),
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
