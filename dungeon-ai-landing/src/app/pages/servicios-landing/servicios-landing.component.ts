import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-servicios-landing',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './servicios-landing.component.html',
  styleUrl: './servicios-landing.component.scss',
})
export class ServiciosLandingComponent {

  onAgendarClick(): void {
    window.open('https://calendly.com/darmcastiblanco/30min', '_blank');
  }

  scrollTo(id: string, event?: Event): void {
    event?.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }

  onChatClick(): void {
    window.open('https://wa.me/573007980679', '_blank');
  }
}
