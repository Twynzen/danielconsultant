import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, fromEvent } from 'rxjs';
import { map, throttleTime } from 'rxjs/operators';

export interface LightSource {
  id: string;
  x: number;
  y: number;
  radius: number;
  intensity: number;
  type: 'torch' | 'cursor' | 'portable' | 'character';
  permanent: boolean;
}

export interface IlluminatedElement {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  requiredIntensity: number;
  currentIllumination: number;
  isVisible: boolean;
  isPermanent: boolean; // Una vez iluminado, permanece iluminado para siempre
}

@Injectable({
  providedIn: 'root'
})
export class LightingService {
  private lightSources = new BehaviorSubject<LightSource[]>([]);
  private illuminatedElements = new BehaviorSubject<IlluminatedElement[]>([]);
  private mousePosition = new BehaviorSubject<{ x: number; y: number }>({ x: 0, y: 0 });
  
  // Cursor types
  private currentCursor = new BehaviorSubject<'fire' | 'torch' | 'net'>('fire');
  private cursorInventory = new BehaviorSubject<{
    fire: { unlocked: boolean; active: boolean };
    torch: { unlocked: boolean; active: boolean };
    net: { unlocked: boolean; active: boolean };
  }>({
    fire: { unlocked: true, active: true },
    torch: { unlocked: false, active: false },
    net: { unlocked: false, active: false }
  });

  // Cat state
  private catCaressed = new BehaviorSubject<boolean>(false);
  
  // Modal state - NUEVO: Control de listeners cuando modal está abierto
  private isModalOpen = new BehaviorSubject<boolean>(false);
  private mouseSubscription: any = null;
  private touchSubscription: any = null;
  private touchStartSubscription: any = null;

  constructor() {
    this.initializeMouseTracking();
    this.initializeTouchTracking(); // NUEVO: Soporte touch para mobile
    this.startLightingCalculations();
  }

  private initializeMouseTracking(): void {
    fromEvent<MouseEvent>(document, 'mousemove')
      .pipe(
        throttleTime(16), // ~60fps
        map(event => ({ x: event.clientX, y: event.clientY }))
      )
      .subscribe(position => {
        this.mousePosition.next(position);
        
        // Add cursor light source for fire or torch
        const inventory = this.cursorInventory.value;
        if (inventory.fire.active || inventory.torch.active) {
          this.updateCursorLight(position.x, position.y);
        }
      });
  }

  // NUEVO: Touch tracking para mobile
  private initializeTouchTracking(): void {
    // Touch move para arrastrar luz
    fromEvent<TouchEvent>(document, 'touchmove')
      .pipe(
        throttleTime(16), // ~60fps
        map(event => {
          const touch = event.touches[0];
          return { x: touch.clientX, y: touch.clientY };
        })
      )
      .subscribe(position => {
        this.mousePosition.next(position);
        this.updateCursorLight(position.x, position.y);
      });

    // Touch start/end para tap iluminación
    fromEvent<TouchEvent>(document, 'touchstart')
      .pipe(
        map(event => {
          const touch = event.touches[0];
          return { x: touch.clientX, y: touch.clientY };
        })
      )
      .subscribe(position => {
        // Crear luz temporal más grande en tap
        this.createTapLight(position.x, position.y);
      });
  }

  // NUEVO: Crear luz temporal en tap
  private createTapLight(x: number, y: number): void {
    const tapLightId = `tap-light-${Date.now()}`;
    const tapLight: LightSource = {
      id: tapLightId,
      x,
      y,
      radius: 250, // Radio más grande para tap
      intensity: 1.2, // Más intenso para iluminar instantáneamente
      type: 'portable',
      permanent: false
    };
    
    this.addLightSource(tapLight);
    
    // Mantener la luz por 2 segundos
    setTimeout(() => {
      this.removeLightSource(tapLightId);
    }, 2000);
  }

  private startLightingCalculations(): void {
    // Update illumination every frame
    const updateLoop = () => {
      this.calculateIllumination();
      requestAnimationFrame(updateLoop);
    };
    requestAnimationFrame(updateLoop);
  }

  private calculateIllumination(): void {
    const lightSources = this.lightSources.value;
    const elements = this.illuminatedElements.value;

    const updatedElements = elements.map(element => {
      // Si ya está permanentemente iluminado, mantenerlo así
      if (element.isPermanent) {
        return {
          ...element,
          isVisible: true,
          currentIllumination: 1
        };
      }

      let totalIllumination = 0;

      lightSources.forEach(light => {
        const distance = Math.sqrt(
          Math.pow(element.x - light.x, 2) + Math.pow(element.y - light.y, 2)
        );

        if (distance <= light.radius) {
          // Calculate falloff (closer = brighter)
          const falloff = Math.max(0, 1 - (distance / light.radius));
          totalIllumination += light.intensity * falloff;
        }
      });

      const wasVisible = element.isVisible;
      const isNowVisible = totalIllumination >= element.requiredIntensity;
      
      // Si se ilumina por primera vez, volverlo permanente
      const shouldBePermanent = !wasVisible && isNowVisible;

      return {
        ...element,
        currentIllumination: totalIllumination,
        isVisible: isNowVisible,
        isPermanent: element.isPermanent || shouldBePermanent
      };
    });

    this.illuminatedElements.next(updatedElements);
  }

  // Light source management
  addLightSource(lightSource: LightSource): void {
    const currentLights = this.lightSources.value;
    this.lightSources.next([...currentLights, lightSource]);
  }

  removeLightSource(id: string): void {
    const currentLights = this.lightSources.value;
    this.lightSources.next(currentLights.filter(light => light.id !== id));
  }

  updateLightSource(id: string, updates: Partial<LightSource>): void {
    const currentLights = this.lightSources.value;
    const updatedLights = currentLights.map(light => 
      light.id === id ? { ...light, ...updates } : light
    );
    this.lightSources.next(updatedLights);
  }

  private updateCursorLight(x: number, y: number): void {
    const inventory = this.cursorInventory.value;
    const cursorLightId = 'cursor-light';
    const currentLights = this.lightSources.value;
    const existingIndex = currentLights.findIndex(light => light.id === cursorLightId);

    // Configurar luz según tipo de cursor activo - AUMENTADO para servicios
    let radius = 180; // Base aumentado para servicios fáciles
    let intensity = 0.9; // Más intenso para mejor iluminación
    
    if (inventory.fire.active) {
      radius = 200; // Fire cursor MÁS alcance para servicios
      intensity = 1.0; // Máxima intensidad 
    } else if (inventory.torch.active) {
      radius = 180; // Torch también aumentado
      intensity = 0.9;
    }

    const cursorLight: LightSource = {
      id: cursorLightId,
      x,
      y,
      radius,
      intensity,
      type: 'cursor',
      permanent: false
    };

    if (existingIndex >= 0) {
      const updatedLights = [...currentLights];
      updatedLights[existingIndex] = cursorLight;
      this.lightSources.next(updatedLights);
    } else {
      this.lightSources.next([...currentLights, cursorLight]);
    }
  }

  // NUEVO: Luz del personaje Flame Head
  updateCharacterLight(x: number, y: number): void {
    const characterLightId = 'character-light';
    const currentLights = this.lightSources.value;
    const existingIndex = currentLights.findIndex(light => light.id === characterLightId);

    const characterLight: LightSource = {
      id: characterLightId,
      x,
      y,
      radius: 220, // Radio grande para iluminar bien
      intensity: 1.0, // Máxima intensidad
      type: 'character',
      permanent: false
    };

    if (existingIndex >= 0) {
      const updatedLights = [...currentLights];
      updatedLights[existingIndex] = characterLight;
      this.lightSources.next(updatedLights);
    } else {
      this.lightSources.next([...currentLights, characterLight]);
    }
  }

  // Obtener posición del personaje
  getCharacterPosition(): { x: number; y: number } | null {
    const lights = this.lightSources.value;
    const characterLight = lights.find(l => l.id === 'character-light');
    if (characterLight) {
      return { x: characterLight.x, y: characterLight.y };
    }
    return null;
  }

  // Element registration
  registerIlluminatedElement(element: IlluminatedElement): void {
    const currentElements = this.illuminatedElements.value;
    this.illuminatedElements.next([...currentElements, element]);
  }

  unregisterIlluminatedElement(id: string): void {
    const currentElements = this.illuminatedElements.value;
    this.illuminatedElements.next(currentElements.filter(el => el.id !== id));
  }

  // Torch interactions
  lightTorch(torchId: string, x: number, y: number): void {
    const torchLight: LightSource = {
      id: `torch-${torchId}`,
      x,
      y,
      radius: 100,
      intensity: 1,
      type: 'torch',
      permanent: true // Torches stay lit permanently
    };
    this.addLightSource(torchLight);
  }

  takeTorch(): void {
    const inventory = this.cursorInventory.value;
    this.cursorInventory.next({
      ...inventory,
      torch: { unlocked: true, active: true },
      fire: { ...inventory.fire, active: false }
    });
    this.currentCursor.next('torch');
  }

  // Cursor management
  switchCursor(type: 'fire' | 'torch' | 'net'): void {
    const inventory = this.cursorInventory.value;
    if (!inventory[type].unlocked) return;

    // Deactivate all cursors
    const newInventory = {
      fire: { ...inventory.fire, active: false },
      torch: { ...inventory.torch, active: false },
      net: { ...inventory.net, active: false }
    };

    // Activate selected cursor
    newInventory[type].active = true;
    
    this.cursorInventory.next(newInventory);
    this.currentCursor.next(type);

    // Remove cursor light if switching to net (net doesn't give light)
    if (type === 'net') {
      this.removeLightSource('cursor-light');
    }
  }

  unlockNetCursor(): void {
    const inventory = this.cursorInventory.value;
    this.cursorInventory.next({
      ...inventory,
      net: { unlocked: true, active: false }
    });
  }

  // Observables
  getLightSources(): Observable<LightSource[]> {
    return this.lightSources.asObservable();
  }

  getIlluminatedElements(): Observable<IlluminatedElement[]> {
    return this.illuminatedElements.asObservable();
  }

  getCurrentCursor(): Observable<'fire' | 'torch' | 'net'> {
    return this.currentCursor.asObservable();
  }

  getCursorInventory(): Observable<any> {
    return this.cursorInventory.asObservable();
  }

  getMousePosition(): Observable<{ x: number; y: number }> {
    return this.mousePosition.asObservable();
  }

  // Utility methods
  isElementIlluminated(elementId: string): boolean {
    const elements = this.illuminatedElements.value;
    const element = elements.find(el => el.id === elementId);
    return element?.isVisible || false;
  }

  getElementIllumination(elementId: string): number {
    const elements = this.illuminatedElements.value;
    const element = elements.find(el => el.id === elementId);
    return element?.currentIllumination || 0;
  }

  // Cat management
  setCatCaressed(isCaressed: boolean): void {
    this.catCaressed.next(isCaressed);
  }

  getCatCaressed(): Observable<boolean> {
    return this.catCaressed.asObservable();
  }

  // Get current illumination level for cat position
  getIllumination(): Observable<number> {
    return this.lightSources.pipe(
      map(sources => {
        const catX = window.innerWidth * 0.15; // Cat position (15% from left)
        const catY = window.innerHeight * 0.75; // Cat position (75% from top)
        
        let totalIllumination = 0;
        
        sources.forEach(source => {
          const distance = Math.sqrt(
            Math.pow(catX - source.x, 2) + Math.pow(catY - source.y, 2)
          );
          
          if (distance < source.radius) {
            const falloff = 1 - (distance / source.radius);
            totalIllumination += source.intensity * falloff;
          }
        });
        
        return Math.min(totalIllumination, 1);
      })
    );
  }
}