import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CircuitsBackgroundComponent } from '../circuits-background/circuits-background.component';
import { TorchSystemComponent } from '../torch-system/torch-system.component';
import { ModalServiceComponent } from '../modal-service/modal-service.component';
import { FlameHeadCharacterComponent } from '../flame-head-character/flame-head-character.component';
import { PillarSystemComponent } from '../pillar-system/pillar-system.component';
import { PillarConfig } from '../../config/pillar.config';
import { Subject } from 'rxjs';

@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [
    CommonModule,
    CircuitsBackgroundComponent,
    TorchSystemComponent,
    ModalServiceComponent,
    FlameHeadCharacterComponent,
    PillarSystemComponent
  ],
  templateUrl: './landing-page.component.html',
  styleUrl: './landing-page.component.scss'
})
export class LandingPageComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // Modal state
  isModalOpen = false;
  selectedServiceId: string | null = null;

  ngOnInit(): void {
    // Dungeon is ready - character can explore
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Called when a pillar is activated via Enter key
   * Opens external URL or modal depending on pillar type
   */
  onPillarActivated(pillar: PillarConfig): void {
    if (pillar.type === 'external') {
      // Open external URL in new tab
      window.open(pillar.destination, '_blank', 'noopener,noreferrer');
    } else {
      // Open modal with service info
      this.selectedServiceId = pillar.destination;
      this.isModalOpen = true;
    }
  }

  onCloseModal(): void {
    this.isModalOpen = false;
    this.selectedServiceId = null;
  }
}
