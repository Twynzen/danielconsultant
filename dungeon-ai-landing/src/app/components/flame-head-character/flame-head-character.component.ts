import { Component, OnInit, OnDestroy, inject, signal, computed, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LightingService } from '../../services/lighting.service';

type Direction = 'up' | 'down' | 'left' | 'right';

/** Mensajes de bienvenida del personaje */
const WELCOME_MESSAGES = [
  '> Hola! Bienvenido al hábitat...',
  '> Soy una IA que vive aquí. Este es mi espacio.',
  '> Explora los pilares con WASD. Cada uno guarda conocimiento sobre lo que hacemos.',
  '> Acércate y presiona ENTER para descubrir más. Adelante!'
];

@Component({
  selector: 'app-flame-head-character',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './flame-head-character.component.html',
  styleUrls: ['./flame-head-character.component.scss']
})
export class FlameHeadCharacterComponent implements OnInit, OnDestroy {
  private lightingService = inject(LightingService);

  // Position signals - Start well above the title (centered, ~25% from top)
  x = signal(window.innerWidth / 2 - 60);
  y = signal(Math.max(50, window.innerHeight * 0.22)); // ~22% from top, minimum 50px

  // Movement state
  facing = signal<Direction>('down'); // Face down initially
  isMoving = signal(false);

  // Dialog state
  showDialog = signal(true);
  displayedText = signal('');
  isTyping = signal(true);
  private currentMessageIndex = 0;
  private currentCharIndex = 0;
  private typingInterval: any = null;
  private dialogDismissed = false;

  // Computed classes
  characterClasses = computed(() => {
    const classes: string[] = ['character'];

    if (this.isMoving()) {
      classes.push('walking');
    }

    // Vista lateral para left/right, frontal para up/down
    if (this.facing() === 'left' || this.facing() === 'right') {
      classes.push('facing-side');
    } else {
      classes.push('facing-front');
    }

    return classes.join(' ');
  });

  // Transform para voltear el personaje
  characterTransform = computed(() => {
    return this.facing() === 'left' ? 'scaleX(-1)' : 'scaleX(1)';
  });

  // Input state
  private pressedKeys = new Set<string>();
  private animationFrameId: number | null = null;
  private lastTime = 0;

  // Movement config
  private readonly SPEED = 250; // px/s
  private readonly CHARACTER_WIDTH = 120;
  private readonly CHARACTER_HEIGHT = 140; // Reduced after removing flame

  ngOnInit(): void {
    this.startGameLoop();
    // Actualizar luz inicial
    this.updateLightPosition();
    // Iniciar el diálogo de bienvenida
    this.startWelcomeDialog();
  }

  ngOnDestroy(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    if (this.typingInterval) {
      clearInterval(this.typingInterval);
    }
  }

  /**
   * Inicia el diálogo de bienvenida con efecto typing
   */
  private startWelcomeDialog(): void {
    this.showDialog.set(true);
    this.typeCurrentMessage();
  }

  /**
   * Escribe el mensaje actual caracter por caracter
   */
  private typeCurrentMessage(): void {
    if (this.currentMessageIndex >= WELCOME_MESSAGES.length) {
      this.dismissDialog();
      return;
    }

    const message = WELCOME_MESSAGES[this.currentMessageIndex];
    this.currentCharIndex = 0;
    this.displayedText.set('');
    this.isTyping.set(true);

    this.typingInterval = setInterval(() => {
      if (this.currentCharIndex < message.length) {
        this.displayedText.set(message.substring(0, this.currentCharIndex + 1));
        this.currentCharIndex++;
      } else {
        clearInterval(this.typingInterval);
        this.isTyping.set(false);
      }
    }, 35); // Velocidad de typing
  }

  /**
   * Avanza al siguiente mensaje o cierra el diálogo
   */
  private advanceDialog(): void {
    if (this.isTyping()) {
      // Si está escribiendo, mostrar todo el texto
      clearInterval(this.typingInterval);
      this.displayedText.set(WELCOME_MESSAGES[this.currentMessageIndex]);
      this.isTyping.set(false);
    } else {
      // Avanzar al siguiente mensaje
      this.currentMessageIndex++;
      if (this.currentMessageIndex < WELCOME_MESSAGES.length) {
        this.typeCurrentMessage();
      } else {
        this.dismissDialog();
      }
    }
  }

  /**
   * Cierra el diálogo y permite movimiento
   */
  private dismissDialog(): void {
    this.showDialog.set(false);
    this.dialogDismissed = true;
    if (this.typingInterval) {
      clearInterval(this.typingInterval);
    }
  }

  @HostListener('window:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    const key = event.code;

    // Si el diálogo está visible, manejar avance
    if (this.showDialog()) {
      if (['Space', 'Enter', 'Escape'].includes(key)) {
        event.preventDefault();
        this.advanceDialog();
      }
      return; // No permitir movimiento mientras hay diálogo
    }

    // Movimiento normal cuando no hay diálogo
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
      event.preventDefault();
      this.pressedKeys.add(key);
    }
  }

  @HostListener('window:keyup', ['$event'])
  onKeyUp(event: KeyboardEvent): void {
    this.pressedKeys.delete(event.code);
  }

  private startGameLoop(): void {
    this.lastTime = performance.now();

    const loop = (currentTime: number) => {
      const deltaTime = Math.min((currentTime - this.lastTime) / 1000, 0.1);
      this.lastTime = currentTime;

      this.update(deltaTime);

      this.animationFrameId = requestAnimationFrame(loop);
    };

    this.animationFrameId = requestAnimationFrame(loop);
  }

  private update(deltaTime: number): void {
    const movement = this.getMovementVector();

    if (movement.x !== 0 || movement.y !== 0) {
      this.isMoving.set(true);

      // Actualizar dirección
      if (Math.abs(movement.x) > Math.abs(movement.y)) {
        this.facing.set(movement.x > 0 ? 'right' : 'left');
      } else {
        this.facing.set(movement.y > 0 ? 'down' : 'up');
      }

      // Calcular nueva posición
      const newX = this.x() + movement.x * this.SPEED * deltaTime;
      const newY = this.y() + movement.y * this.SPEED * deltaTime;

      // Clamp dentro del viewport
      const clampedX = Math.max(0, Math.min(window.innerWidth - this.CHARACTER_WIDTH, newX));
      const clampedY = Math.max(0, Math.min(window.innerHeight - this.CHARACTER_HEIGHT, newY));

      this.x.set(clampedX);
      this.y.set(clampedY);

      // Actualizar luz del personaje
      this.updateLightPosition();
    } else {
      this.isMoving.set(false);
    }
  }

  private getMovementVector(): { x: number; y: number } {
    let x = 0;
    let y = 0;

    if (this.pressedKeys.has('KeyW') || this.pressedKeys.has('ArrowUp')) y -= 1;
    if (this.pressedKeys.has('KeyS') || this.pressedKeys.has('ArrowDown')) y += 1;
    if (this.pressedKeys.has('KeyA') || this.pressedKeys.has('ArrowLeft')) x -= 1;
    if (this.pressedKeys.has('KeyD') || this.pressedKeys.has('ArrowRight')) x += 1;

    // Normalizar diagonal
    if (x !== 0 && y !== 0) {
      const length = Math.sqrt(x * x + y * y);
      x /= length;
      y /= length;
    }

    return { x, y };
  }

  private updateLightPosition(): void {
    // Centro del personaje
    const centerX = this.x() + this.CHARACTER_WIDTH / 2;
    const centerY = this.y() + this.CHARACTER_HEIGHT / 3; // Un poco arriba del centro (donde está la llama)

    this.lightingService.updateCharacterLight(centerX, centerY);
  }
}
