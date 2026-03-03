import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, OnChanges, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ServiceDetail, ServicesDataService } from '../../services/services-data.service';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Component({
    selector: 'app-modal-service',
    imports: [CommonModule],
    templateUrl: './modal-service.component.html',
    styleUrl: './modal-service.component.scss',
})
export class ModalServiceComponent implements OnInit, OnDestroy, OnChanges, AfterViewInit {
  @Input() serviceId: string | null = null;
  @Input() isOpen: boolean = false;
  @Input() serviceColor: string = '#00ff44'; // v4.7.2: Dynamic color from pillar
  @Output() closeModal = new EventEmitter<void>();
  
  serviceDetail: ServiceDetail | undefined;
  matrixRain: string[] = [];
  glitchState = 'inactive';
  typingTitle = '';
  currentTitleIndex = 0;
  typingInterval: any;
  
  constructor(
    private servicesData: ServicesDataService,
    private sanitizer: DomSanitizer,
    private cdr: ChangeDetectorRef
  ) {}
  
  ngOnInit(): void {
    // console.log('🚨 MODAL COMPONENT INITIALIZED!');
    this.loadServiceData();
  }
  
  ngOnChanges(): void {
    // console.log('🚨 MODAL ngOnChanges - isOpen:', this.isOpen, 'serviceId:', this.serviceId);
    this.loadServiceData();
    
    // Force change detection when modal opens
    if (this.isOpen) {
      setTimeout(() => {
        this.attachNativeEventListeners();
        this.cdr.detectChanges();
      }, 100);
    }
  }
  
  ngAfterViewInit(): void {
    // console.log('🚨 MODAL AfterViewInit!');
    if (this.isOpen) {
      this.attachNativeEventListeners();
    }
  }
  
  private attachNativeEventListeners(): void {
    // console.log('🚨 Attaching NATIVE event listeners...');
    
    // Attach native click to backdrop
    setTimeout(() => {
      const backdrop = document.querySelector('.modal-backdrop');
      if (backdrop) {
        // console.log('🚨 Found backdrop, attaching listener...');
        // console.log('🚨 Backdrop z-index:', getComputedStyle(backdrop).zIndex);
        backdrop.addEventListener('click', (event: any) => {
          // console.log('🚨 NATIVE backdrop click!', event.target.className);
          if (event.target.classList.contains('modal-backdrop')) {
            // console.log('🚨 Calling onClose from NATIVE listener...');
            this.onClose();
            this.cdr.detectChanges();
          }
        });
      }
      
      // Attach native click to green dot
      const greenDot = document.querySelector('.dot.green');
      if (greenDot) {
        // console.log('🚨 Found green dot, attaching listener...');
        greenDot.addEventListener('click', () => {
          // console.log('🚨 NATIVE green dot click!');
          this.onClose();
          this.cdr.detectChanges();
        });
      }
    }, 200);
  }
  
  private loadServiceData(): void {
    // console.log('🚨 loadServiceData called - serviceId:', this.serviceId, 'isOpen:', this.isOpen);
    if (this.serviceId && this.isOpen) {
      // console.log('🚨 MODAL IS OPENING! Service:', this.serviceId);
      // Reset previous state
      if (this.typingInterval) {
        clearInterval(this.typingInterval);
      }
      this.currentTitleIndex = 0;
      this.typingTitle = '';
      this.glitchState = 'inactive';
      
      this.serviceDetail = this.servicesData.getServiceDetail(this.serviceId);
      
      if (this.serviceDetail) {
        this.initializeMatrixRain();
        setTimeout(() => {
          this.startTitleTyping();
          this.triggerGlitch();
        }, 100);
      }
    }
  }
  
  ngOnDestroy(): void {
    if (this.typingInterval) {
      clearInterval(this.typingInterval);
    }
  }
  
  private initializeMatrixRain(): void {
    const matrixChars = '01アイウエオカキクケコサシスセソタチツテト';
    for (let i = 0; i < 50; i++) {
      const randomChar = matrixChars[Math.floor(Math.random() * matrixChars.length)];
      this.matrixRain.push(randomChar);
    }
  }
  
  private startTitleTyping(): void {
    if (!this.serviceDetail) return;
    
    const title = this.serviceDetail.title;
    const matrixChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    
    this.typingInterval = setInterval(() => {
      if (this.currentTitleIndex < title.length) {
        let displayText = '';
        
        for (let i = 0; i <= this.currentTitleIndex; i++) {
          displayText += title[i];
        }
        
        for (let i = this.currentTitleIndex + 1; i < title.length; i++) {
          displayText += matrixChars[Math.floor(Math.random() * matrixChars.length)];
        }
        
        this.typingTitle = displayText;
        this.currentTitleIndex++;
      } else {
        clearInterval(this.typingInterval);
        this.typingTitle = title;
      }
    }, 100);
  }
  
  private triggerGlitch(): void {
    setTimeout(() => {
      this.glitchState = 'active';
    }, 300);
  }
  
  onClose(): void {
    // console.log('🔥 onClose ejecutado! Emitiendo closeModal...');
    this.closeModal.emit();
    this.currentTitleIndex = 0;
    this.typingTitle = '';
    this.glitchState = 'inactive';
    if (this.typingInterval) {
      clearInterval(this.typingInterval);
    }
    // console.log('🔥 onClose completado!');
  }

  onBackdropClick(event: MouseEvent): void {
    // console.log('🔥 onBackdropClick ejecutado!', event.target, event.currentTarget);
    // console.log('🔥 event.target === event.currentTarget:', event.target === event.currentTarget);
    
    // Solo cierra si el click fue directamente en el backdrop
    if (event.target === event.currentTarget) {
      // console.log('🔥 Llamando onClose()...');
      this.onClose();
    }
  }

  onModalContainerClick(event: MouseEvent): void {
    // Evita que el click dentro del modal cierre el modal
    event.stopPropagation();
  }
}
