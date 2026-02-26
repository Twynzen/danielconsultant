import { Component, OnInit, OnDestroy, ViewChild, Output, EventEmitter, HostListener, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LightingService } from '../../services/lighting.service';
import { CatGuideComponent } from '../cat-guide/cat-guide.component';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

interface ServiceCard {
  id: string;
  title: string;
  iconSVG: string; // SVG content for the icon
  illuminated: boolean;
}

@Component({
  selector: 'app-service-hieroglyphs',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './service-hieroglyphs.component.html',
  styleUrl: './service-hieroglyphs.component.scss'
})
export class ServiceHieroglyphsComponent implements OnInit, OnDestroy, AfterViewInit {
  private destroy$ = new Subject<void>();
  headerIlluminated = false;
  
  // Event emitter para comunicar con app.component
  @Output() openModal = new EventEmitter<{ serviceId: string }>();
  
  services: ServiceCard[] = [
    {
      id: 'rag-systems',
      title: 'RAG SYSTEMS',
      // WiFi/señal icon - barras verticales crecientes
      iconSVG: '<rect x="4" y="20" width="3" height="4" fill="currentColor"/><rect x="9" y="16" width="3" height="8" fill="currentColor"/><rect x="14" y="12" width="3" height="12" fill="currentColor"/><rect x="19" y="8" width="3" height="16" fill="currentColor"/><circle cx="26" cy="10" r="2" fill="none" stroke="currentColor" stroke-width="1.5"/>',
      illuminated: false
    },
    {
      id: 'agent-orchestration', 
      title: 'AGENT ORCHESTRATION',
      // Red de nodos conectados - más simple
      iconSVG: '<circle cx="16" cy="8" r="2.5" fill="currentColor"/><circle cx="8" cy="20" r="2.5" fill="currentColor"/><circle cx="24" cy="20" r="2.5" fill="currentColor"/><line x1="14" y1="10" x2="10" y2="18" stroke="currentColor" stroke-width="1.5"/><line x1="18" y1="10" x2="22" y2="18" stroke="currentColor" stroke-width="1.5"/><line x1="8" y1="20" x2="24" y2="20" stroke="currentColor" stroke-width="1.5"/>',
      illuminated: false
    },
    {
      id: 'process-automation',
      title: 'PROCESS AUTOMATION', 
      // Engranajes simples
      iconSVG: '<circle cx="12" cy="12" r="6" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="12" cy="12" r="2" fill="currentColor"/><rect x="11" y="4" width="2" height="4" fill="currentColor"/><rect x="11" y="24" width="2" height="4" fill="currentColor"/><rect x="4" y="11" width="4" height="2" fill="currentColor"/><rect x="24" y="11" width="4" height="2" fill="currentColor"/>',
      illuminated: false
    },
    {
      id: 'local-llms',
      title: 'LOCAL LLMS',
      // Servidor/base datos - rectángulo con indicadores
      iconSVG: '<rect x="6" y="8" width="20" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="10" cy="12" r="1.5" fill="currentColor"/><circle cx="10" cy="16" r="1.5" fill="currentColor"/><circle cx="10" cy="20" r="1.5" fill="currentColor"/><rect x="14" y="11" width="8" height="2" fill="currentColor"/><rect x="14" y="15" width="6" height="2" fill="currentColor"/><rect x="14" y="19" width="10" height="2" fill="currentColor"/>',
      illuminated: false
    },
    {
      id: 'finops-ai',
      title: 'FINOPS AI',
      // Gráfico con flecha hacia arriba - más simple
      iconSVG: '<polyline points="4,20 8,16 12,18 16,14 20,10 24,6" fill="none" stroke="currentColor" stroke-width="2"/><polygon points="20,6 24,6 24,10" fill="currentColor"/><circle cx="8" cy="16" r="1.5" fill="currentColor"/><circle cx="12" cy="18" r="1.5" fill="currentColor"/><circle cx="16" cy="14" r="1.5" fill="currentColor"/><circle cx="20" cy="10" r="1.5" fill="currentColor"/>',
      illuminated: false
    },
    {
      id: 'custom-integrations',
      title: 'CUSTOM INTEGRATIONS',
      // Red de conexiones múltiples - nodos con conexiones cruzadas
      iconSVG: '<circle cx="8" cy="8" r="2" fill="currentColor"/><circle cx="24" cy="8" r="2" fill="currentColor"/><circle cx="16" cy="16" r="2" fill="currentColor"/><circle cx="8" cy="24" r="2" fill="currentColor"/><circle cx="24" cy="24" r="2" fill="currentColor"/><line x1="8" y1="8" x2="24" y2="8" stroke="currentColor" stroke-width="1.5"/><line x1="8" y1="8" x2="16" y2="16" stroke="currentColor" stroke-width="1.5"/><line x1="24" y1="8" x2="16" y2="16" stroke="currentColor" stroke-width="1.5"/><line x1="16" y1="16" x2="8" y2="24" stroke="currentColor" stroke-width="1.5"/><line x1="16" y1="16" x2="24" y2="24" stroke="currentColor" stroke-width="1.5"/>',
      illuminated: false
    }
  ];

  @ViewChild('catGuide') catGuide?: CatGuideComponent;

  constructor(private lightingService: LightingService) {}

  ngOnInit(): void {
    this.setupLightingSubscription();
    // NO registrar aquí - esperar a AfterViewInit para DOM real
  }
  
  ngAfterViewInit(): void {
    // Registrar con coordenadas DOM reales después del render
    this.registerElementsWithRealCoordinates();
  }
  
  @HostListener('window:resize', ['$event'])
  onWindowResize(event: any): void {
    // Re-registrar elementos cuando cambie el tamaño de ventana
    this.updateElementCoordinates();
  }
  
  @HostListener('window:scroll', ['$event'])
  onWindowScroll(event: any): void {
    // Actualizar coordenadas cuando se hace scroll
    this.updateElementCoordinates();
  }

  private setupLightingSubscription(): void {
    this.lightingService.getIlluminatedElements()
      .pipe(takeUntil(this.destroy$))
      .subscribe(elements => {
        // Update header illumination
        const headerElement = elements.find(el => el.id === 'services-header');
        const wasHeaderIlluminated = this.headerIlluminated;
        this.headerIlluminated = headerElement?.isVisible || false;
        
        // Trigger typing animation cuando el header se ilumina por primera vez
        if (!wasHeaderIlluminated && this.headerIlluminated) {
          setTimeout(() => {
            this.triggerHeaderTyping();
          }, 300);
        }
        
        // Update services illumination and trigger Matrix animations
        this.services.forEach(service => {
          const illuminatedElement = elements.find(el => el.id === `service-${service.id}`);
          const wasIlluminated = service.illuminated;
          service.illuminated = illuminatedElement?.isVisible || false;
          
          // Trigger Matrix revelation animation when service gets illuminated for first time
          if (!wasIlluminated && service.illuminated) {
            setTimeout(() => {
              this.triggerServiceTyping(service.id);
            }, 150); // Shorter delay for services
          }
        });
      });
  }

  private triggerHeaderTyping(): void {
    const headerElement = document.querySelector('.services-header.typing') as HTMLElement;
    if (headerElement) {
      this.typeText(headerElement);
    }
  }

  private triggerServiceTyping(serviceId: string): void {
    const serviceElement = document.querySelector(`#service-${serviceId} .service-title.typing`) as HTMLElement;
    if (serviceElement) {
      const service = this.services.find(s => s.id === serviceId);
      if (service) {
        serviceElement.setAttribute('data-text', service.title);
        this.typeText(serviceElement);
      }
    }
  }

  private typeText(element: HTMLElement): void {
    const text = element.getAttribute('data-text') || '';
    const typingSpan = element.querySelector('.typing-text') as HTMLElement;
    
    if (!typingSpan) return;

    // Matrix magical revelation effect - letras aparecen desordenadas
    this.createMatrixRevelation(typingSpan, text);
  }

  private createMatrixRevelation(element: HTMLElement, finalText: string): void {
    const chars = finalText.split('');
    const totalChars = chars.length;
    const revealedChars: boolean[] = new Array(totalChars).fill(false);
    const matrixChars = 'ABCDEFABCDEFABCDEFABCDEFABCDEFGHIJKLMNOPQRSTUVWXYZ'; // Solo letras limpias para Glitchy Demo Italic
    
    // Crear estructura inicial con caracteres Matrix aleatorios
    element.innerHTML = chars.map(() => 
      matrixChars[Math.floor(Math.random() * matrixChars.length)]
    ).join('');
    
    element.style.borderRight = 'none';
    element.style.color = '#00ff44';
    element.style.textShadow = '0 0 10px #00ff44, 0 0 20px #00ff44, 0 0 30px rgba(0, 255, 68, 0.8)';
    element.style.fontFamily = "'Source Code Pro', monospace"; // MANTENER fuente durante animación
    
    let revealedCount = 0;
    const revealInterval = setInterval(() => {
      if (revealedCount >= totalChars) {
        clearInterval(revealInterval);
        return;
      }
      
      // Elegir posición aleatoria no revelada
      let randomIndex;
      do {
        randomIndex = Math.floor(Math.random() * totalChars);
      } while (revealedChars[randomIndex]);
      
      // Revelar el carácter correcto
      revealedChars[randomIndex] = true;
      revealedCount++;
      
      // Actualizar display con caracteres revelados
      const displayChars = chars.map((char, index) => {
        if (revealedChars[index]) {
          return char; // Carácter final correcto
        } else if (char === ' ') {
          return ' '; // Mantener espacios
        } else {
          // Carácter Matrix aleatorio que sigue cambiando
          return matrixChars[Math.floor(Math.random() * matrixChars.length)];
        }
      });
      
      element.innerHTML = displayChars.join('');
      
      // Efecto adicional: cambiar caracteres no revelados más rápido
      if (revealedCount < totalChars) {
        setTimeout(() => {
          const currentDisplay = element.innerHTML.split('');
          for (let i = 0; i < currentDisplay.length; i++) {
            if (!revealedChars[i] && chars[i] !== ' ') {
              currentDisplay[i] = matrixChars[Math.floor(Math.random() * matrixChars.length)];
            }
          }
          element.innerHTML = currentDisplay.join('');
        }, 30);
      }
      
    }, 80); // Revelar una letra cada 80ms - más rápido para servicios
  }

  private registerElementsWithRealCoordinates(): void {
    // Esperar a que Angular complete el render
    setTimeout(() => {
      // Register header si existe
      const headerElement = document.querySelector('.services-header');
      if (headerElement) {
        const headerRect = headerElement.getBoundingClientRect();
        const header = {
          id: 'services-header',
          x: headerRect.left + headerRect.width / 2 + window.scrollX,
          y: headerRect.top + headerRect.height / 2 + window.scrollY,
          width: headerRect.width + 100, // Área generosa
          height: headerRect.height + 50,
          requiredIntensity: 0.1,
          currentIllumination: 0,
          isVisible: false,
          isPermanent: false
        };
        this.lightingService.registerIlluminatedElement(header);
      }
      
      // Register each service card con coordenadas DOM REALES
      this.services.forEach((service, index) => {
        const domElement = document.getElementById(`service-${service.id}`);
        if (domElement) {
          const rect = domElement.getBoundingClientRect();
          
          // COORDENADAS REALES del centro del elemento + scroll offset
          const element = {
            id: `service-${service.id}`,
            x: rect.left + rect.width / 2 + window.scrollX, // Centro X real
            y: rect.top + rect.height / 2 + window.scrollY, // Centro Y real
            width: rect.width + 80, // Área de detección generosa
            height: rect.height + 80, // Área de detección generosa
            requiredIntensity: 0.08, // Aún más fácil de iluminar
            currentIllumination: 0,
            isVisible: false,
            isPermanent: false
          };
          
          this.lightingService.registerIlluminatedElement(element);
          
          // DEBUG temporal para verificar calibración
          console.log('🎯 Service registered:', {
            id: service.id,
            title: service.title,
            realCoords: { x: element.x, y: element.y },
            domRect: { 
              left: rect.left, 
              top: rect.top, 
              width: rect.width, 
              height: rect.height 
            },
            viewport: { 
              width: window.innerWidth, 
              height: window.innerHeight,
              scrollY: window.scrollY
            }
          });
        }
      });
    }, 200); // Dar tiempo al render completo
  }
  
  private updateElementCoordinates(): void {
    // Desregistrar elementos existentes
    this.services.forEach(service => {
      this.lightingService.unregisterIlluminatedElement(`service-${service.id}`);
    });
    this.lightingService.unregisterIlluminatedElement('services-header');
    
    // Re-registrar con nuevas coordenadas
    this.registerElementsWithRealCoordinates();
  }

  onServiceClick(service: ServiceCard): void {
    if (!service.illuminated) {
      return; // Can't click on dark services
    }
    
    // Emit event to parent (app.component) to open modal
    this.openModal.emit({ serviceId: service.id });
    
    // Visual feedback
    this.createClickEffect(service.id);
  }

  private createClickEffect(serviceId: string): void {
    const element = document.getElementById(`service-${serviceId}`);
    if (element) {
      element.classList.add('clicked');
      setTimeout(() => {
        element.classList.remove('clicked');
      }, 500);
    }
  }

  // Métodos helper removidos - CSS maneja estilos directamente

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    
    // Unregister illuminated elements
    this.services.forEach(service => {
      this.lightingService.unregisterIlluminatedElement(`service-${service.id}`);
    });
    this.lightingService.unregisterIlluminatedElement('services-header');
  }
}
