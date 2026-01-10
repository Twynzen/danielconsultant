/**
 * TorchSystemComponent - Single Torch in Top-Right Corner
 * v5.1: Simplified to show one decorative torch that lights with the title
 */
import { Component, OnInit, OnDestroy, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OnboardingService } from '../../services/onboarding.service';

@Component({
    selector: 'app-torch-system',
    imports: [CommonModule],
    templateUrl: './torch-system.component.html',
    styleUrl: './torch-system.component.scss'
})
export class TorchSystemComponent implements OnInit, OnDestroy {
  private onboarding = inject(OnboardingService);

  // v5.1: Single torch state - lights when title appears
  isLit = signal(false);
  private hasLit = false;

  constructor() {
    // v5.1: Effect to light torch when title becomes visible
    effect(() => {
      const titleOpacity = this.onboarding.titleOpacity();
      if (titleOpacity > 0 && !this.hasLit) {
        this.hasLit = true;
        // Small delay for dramatic effect
        setTimeout(() => {
          this.isLit.set(true);
        }, 200);
      }
    });
  }

  ngOnInit(): void {
    // Check if already lit (return visitor)
    if (this.onboarding.titleOpacity() > 0) {
      this.isLit.set(true);
      this.hasLit = true;
    }
  }

  ngOnDestroy(): void {
    // Cleanup if needed
  }

  // v5.1: Torch position - top-right corner
  readonly torchStyle = {
    position: 'fixed',
    right: '40px',
    top: '40px',
    zIndex: 100
  };

  // v5.1: CSS classes for torch state
  readonly torchClasses = computed(() => {
    const classes = ['single-torch'];
    if (this.isLit()) {
      classes.push('lit');
    }
    return classes.join(' ');
  });
}