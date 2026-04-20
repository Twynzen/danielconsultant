import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./components/desktop/desktop.component').then(m => m.DesktopComponent),
    canActivate: [authGuard]
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./components/auth/login/login.component').then(m => m.LoginComponent),
    canActivate: [guestGuard]
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./components/auth/register/register.component').then(m => m.RegisterComponent),
    canActivate: [guestGuard]
  },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./components/daily-dashboard/daily-dashboard.component')
        .then(m => m.DailyDashboardComponent),
    canActivate: [authGuard]
  },
  {
    path: 'views',
    loadComponent: () =>
      import('./components/smart-views/smart-views.component')
        .then(m => m.SmartViewsComponent),
    canActivate: [authGuard]
  },
  {
    path: 'settings/integrations',
    loadComponent: () =>
      import('./components/integrations-settings/integrations-settings.component')
        .then(m => m.IntegrationsSettingsComponent),
    canActivate: [authGuard]
  },
  {
    path: 'calendar',
    loadComponent: () =>
      import('./components/calendar/calendar.component')
        .then(m => m.CalendarComponent),
    canActivate: [authGuard]
  },
  {
    path: '**',
    redirectTo: ''
  }
];
