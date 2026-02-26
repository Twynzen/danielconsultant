import { Component, AfterViewInit, OnDestroy } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-servicios-landing',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './servicios-landing.component.html',
  styleUrl: './servicios-landing.component.scss',
})
export class ServiciosLandingComponent implements AfterViewInit, OnDestroy {
  private observer: IntersectionObserver | null = null;

  ngAfterViewInit(): void {
    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );
    document.querySelectorAll('.aos').forEach((el) => this.observer!.observe(el));
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }

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
