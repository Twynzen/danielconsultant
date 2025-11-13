import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CircuitsBackgroundComponent } from '../circuits-background/circuits-background.component';
import { TorchSystemComponent } from '../torch-system/torch-system.component';
import { ServiceHieroglyphsComponent } from '../service-hieroglyphs/service-hieroglyphs.component';
import { ConsultationButtonComponent } from '../consultation-button/consultation-button.component';
import { CustomCursorComponent } from '../custom-cursor/custom-cursor.component';
import { ModalServiceComponent } from '../modal-service/modal-service.component';
import { LightingService } from '../../services/lighting.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [
    CommonModule,
    CircuitsBackgroundComponent,
    TorchSystemComponent,
    ServiceHieroglyphsComponent,
    ConsultationButtonComponent,
    CustomCursorComponent,
    ModalServiceComponent
  ],
  templateUrl: './landing-page.component.html',
  styleUrl: './landing-page.component.scss'
})
export class LandingPageComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  heroIlluminated = false;
  heroAnimated = false;

  // Modal state
  isModalOpen = false;
  selectedServiceId: string | null = null;

  constructor(private lightingService: LightingService) {}

  ngOnInit(): void {
    setTimeout(() => {
      this.setupHeroIllumination();
    }, 100);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private setupHeroIllumination(): void {
    const heroElement = {
      id: 'hero-section',
      x: window.innerWidth / 2,
      y: 250,
      width: 800,
      height: 300,
      requiredIntensity: 0.1,
      currentIllumination: 0,
      isVisible: false,
      isPermanent: false
    };

    this.lightingService.registerIlluminatedElement(heroElement);

    this.lightingService.getIlluminatedElements()
      .pipe(takeUntil(this.destroy$))
      .subscribe(elements => {
        const heroElementState = elements.find(el => el.id === 'hero-section');
        const wasIlluminated = this.heroIlluminated;
        this.heroIlluminated = heroElementState?.isVisible || false;

        if (this.heroIlluminated && !this.heroAnimated) {
          this.triggerTypingAnimations();
        }
      });
  }

  private triggerTypingAnimations(): void {
    setTimeout(() => {
      const typingElements = document.querySelectorAll('.hero-section .typing');

      typingElements.forEach((element, index) => {
        setTimeout(() => {
          this.typeText(element as HTMLElement);

          if (index === typingElements.length - 1) {
            setTimeout(() => {
              this.heroAnimated = true;
            }, 1500);
          }
        }, index * 250);
      });
    }, 100);
  }

  private typeText(element: HTMLElement): void {
    const text = element.getAttribute('data-text') || '';
    const typingSpan = element.querySelector('.typing-text') as HTMLElement;

    if (!typingSpan) return;

    this.createMatrixRevelation(typingSpan, text);
  }

  private createMatrixRevelation(element: HTMLElement, finalText: string): void {
    const chars = finalText.split('');
    const totalChars = chars.length;
    const revealedChars: boolean[] = new Array(totalChars).fill(false);
    const matrixChars = 'ABCDEFABCDEFABCDEFABCDEFABCDEFGHIJKLMNOPQRSTUVWXYZ';

    element.innerHTML = chars.map(() =>
      matrixChars[Math.floor(Math.random() * matrixChars.length)]
    ).join('');

    element.style.borderRight = 'none';
    element.style.color = '#00ff44';
    element.style.textShadow = '0 0 10px #00ff44, 0 0 20px #00ff44, 0 0 30px rgba(0, 255, 68, 0.8)';
    element.style.fontFamily = "'Courier New', monospace";

    let revealedCount = 0;
    let changeInterval: any;

    const maxDuration = 1500;
    const intervalSpeed = Math.min(50, Math.floor(maxDuration / totalChars));

    const revealInterval = setInterval(() => {
      if (revealedCount >= totalChars) {
        clearInterval(revealInterval);
        if (changeInterval) clearInterval(changeInterval);
        element.innerHTML = finalText;
        return;
      }

      let randomIndex;
      do {
        randomIndex = Math.floor(Math.random() * totalChars);
      } while (revealedChars[randomIndex]);

      revealedChars[randomIndex] = true;
      revealedCount++;

      const displayChars = chars.map((char, index) => {
        if (revealedChars[index]) {
          return char;
        } else if (char === ' ') {
          return ' ';
        } else {
          return matrixChars[Math.floor(Math.random() * matrixChars.length)];
        }
      });

      element.innerHTML = displayChars.join('');

      if (revealedCount < totalChars) {
        if (changeInterval) clearInterval(changeInterval);
        changeInterval = setTimeout(() => {
          if (revealedCount < totalChars) {
            const currentDisplay = element.innerHTML.split('');
            for (let i = 0; i < currentDisplay.length; i++) {
              if (!revealedChars[i] && chars[i] !== ' ') {
                currentDisplay[i] = matrixChars[Math.floor(Math.random() * matrixChars.length)];
              }
            }
            element.innerHTML = currentDisplay.join('');
          }
        }, 15);
      }

    }, intervalSpeed);

    setTimeout(() => {
      clearInterval(revealInterval);
      if (changeInterval) clearInterval(changeInterval);
      element.innerHTML = finalText;
    }, maxDuration);
  }

  onServiceModalOpen(data: { serviceId: string }): void {
    this.selectedServiceId = data.serviceId;
    this.isModalOpen = true;
  }

  onCloseModal(): void {
    this.isModalOpen = false;
    this.selectedServiceId = null;
  }
}
