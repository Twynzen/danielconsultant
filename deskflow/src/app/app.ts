import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastHostComponent } from './shared/toast-host.component';
import { ReminderRealtimeService } from './services/reminder-realtime.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ToastHostComponent],
  template: `
    <router-outlet></router-outlet>
    <app-toast-host></app-toast-host>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }
  `]
})
export class App implements OnInit {
  // Subscribed at root so calendar reminders reach the user across every
  // route (dashboard, smart views, calendar, even login screens once they
  // sign in). Service self-manages the Supabase realtime channel lifecycle.
  private reminders = inject(ReminderRealtimeService);

  ngOnInit(): void {
    this.reminders.start();
  }
}
