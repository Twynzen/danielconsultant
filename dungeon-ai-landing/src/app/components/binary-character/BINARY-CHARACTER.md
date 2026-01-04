# Binary Character - Documentacion Completa v5.2

## DESCRIPCION GENERAL

Personaje de IA construido con caracteres ASCII binarios (0s y 1s) con animaciones avanzadas, tracking de ojos, estados emocionales, y fisica de particulas para efectos de materializacion digital.

---

## ARQUITECTURA

### Estructura de Archivos

```
src/app/components/binary-character/
├── binary-character.component.ts    # Logica principal (~1000 lineas)
├── binary-character.component.html  # Template con 3 grids
├── binary-character.component.scss  # Estilos y animaciones CSS
└── BINARY-CHARACTER.md              # Esta documentacion

src/app/config/
└── character-matrix.config.ts       # Definicion visual del personaje
```

### Como se Construye el Personaje

El personaje esta definido como **3 strings ASCII** en `character-matrix.config.ts`:

1. **TORSO** (3 variantes: FRONT, LEFT, RIGHT) - Cabeza y torso
2. **ARMS** (3 variantes: NEUTRAL, LEFT_FORWARD, RIGHT_FORWARD) - Brazos
3. **LEGS** (3 variantes: NEUTRAL, FRAME_1, FRAME_2) - Piernas

### Leyenda de Caracteres

| Caracter | Significado | Renderizado |
|----------|-------------|-------------|
| `.` | Espacio vacio | Invisible (mantiene estructura) |
| `0`, `1` | Digitos binarios | Verde brillante |
| `E` | Ojo | '0' blanco brillante |
| `S` | Sonrisa | '_', 'o', 'O' segun animacion |

---

## ESTRUCTURA DEL PERSONAJE

### Grids

```
┌─────────────────────────────────┐
│         BODY GRID               │  13 filas x 17 columnas
│  (cabeza + torso + ojos + boca) │
├─────────────────────────────────┤
│         ARMS GRID               │  13 filas x 17 columnas (overlay)
│    (brazos animados)            │
├─────────────────────────────────┤
│         LEGS GRID               │  5 filas x 17 columnas
│    (piernas animadas)           │
└─────────────────────────────────┘
```

### Ejemplo de TORSO_FRONT (v4.4)

```
....000000000....    ← Cabeza rectangular (top plano)
....00.E.E.00....    ← Ojos (E = eye)
....00..S..00....    ← Boca (S = smile)
....000000000....    ← Cabeza rectangular (bottom plano)
.......000.......    ← Cuello
......00000......
......00000......    ← Torso delgado
.....0000000.....    ← Maximo ancho (7 chars)
......00000......
......00000......
......00000......
......00000......
.......000.......    ← Base del torso
```

---

## SISTEMA DE TIPOS (DigitType)

### Enum DigitType

```typescript
enum DigitType {
  EMPTY = 'empty',   // Espacios invisibles
  NORMAL = 'normal', // Digitos regulares
  CORE = 'core',     // Centro del cuerpo - MAS BRILLANTE
  LIMB = 'limb',     // Extremidades - brillo medio
  EDGE = 'edge',     // Bordes externos - mas tenue
  EYE = 'eye',       // Ojos - blancos brillantes
  SMILE = 'smile',   // Boca - animada
}
```

### Niveles de Brillo

| Tipo | Brillo (opacity) | Color |
|------|------------------|-------|
| core | 1.0 | #00ff44 |
| limb | 0.6 | #00ff44 |
| edge | 0.35 | #00ff44 |
| eye | 1.0 | #ffffff |
| smile | 0.9 | #00ff44 |
| empty | 0 | - |

### Como se Asignan los Tipos

El tipo se calcula automaticamente por **distancia al centro** en `parseShape()`:

```typescript
const normalizedDist = distanceFromCenter / maxDistance;

if (normalizedDist < 0.3) {
  type = DigitType.CORE;      // Centro
} else if (normalizedDist < 0.6) {
  type = DigitType.LIMB;      // Medio
} else {
  type = DigitType.EDGE;      // Borde
}
```

---

## ANIMACIONES

### 1. Walk Cycle (Caminar)

**Archivos:** `getLegFrames()` y `getArmFrames()`

**Secuencia:**
```
Frame 0: Neutral (parado)
Frame 1: Pierna izquierda adelante, brazo derecho adelante
Frame 2: Neutral (transicion)
Frame 3: Pierna derecha adelante, brazo izquierdo adelante
```

**Configuracion:**
- Duracion por frame: 150ms
- Los brazos se mueven **opuestos** a las piernas (como humano real)

### 2. Eye Tracking (Seguimiento de Ojos)

**Archivo:** `updateEyeTracking()` en component.ts

**Comportamiento:**
- Los ojos siguen el cursor del mouse
- Rango maximo de movimiento: 3px
- Suavizado con LERP (factor 0.12)

**Calculo:**
```typescript
const angle = Math.atan2(deltaY, deltaX);
eyeTarget.x = EYE_MAX_RANGE * Math.cos(angle);
eyeTarget.y = EYE_MAX_RANGE * Math.sin(angle);
// LERP para suavizado
newX = current.x + (target.x - current.x) * 0.12;
```

### 3. Blink (Parpadeo)

**Comportamiento:**
- Intervalo aleatorio: 3000-6000ms
- Duracion: 120ms
- 20% probabilidad de **parpadeo doble** (como humanos reales)

**Implementacion:**
```typescript
if (Math.random() < 0.2) {
  // Segundo parpadeo despues de 150ms
}
```

### 4. Emotions (Emociones)

**Estados disponibles:**

| Estado | Trigger | Efecto Visual |
|--------|---------|---------------|
| idle | Por defecto | Normal |
| curious | Mouse a <200px | Ojos mas grandes |
| excited | Mouse a <80px | Bounce, glow intenso |
| tired | 5s sin mover mouse | Ojos caidos, tenue |
| startled | Click en personaje | Flinch rapido |

**Selector CSS:**
```scss
[data-emotion="curious"] { ... }
[data-emotion="excited"] { ... }
```

### 5. Mouth Animation (Boca)

**Activacion:** Solo cuando `isTalking=true`

**Frames:**
```
Frame 0: '_' (cerrada)
Frame 1: 'o' (abierta)
Frame 2: 'O' (muy abierta)
```

**Ciclo:** 0 → 1 → 2 → 1 → 0 (loop)
**Duracion por frame:** 80ms

### 6. Assembly (Ensamblaje Inicial)

**Trigger:** Al cargar la pagina

**Comportamiento:**
1. Particulas aparecen dispersas por toda la pantalla
2. Convergen al centro con fisica spring
3. Elementos del centro llegan primero (stagger)

**Configuracion:**
```typescript
SPAWN_DURATION: 2000,      // 2 segundos total
SPAWN_STAGGER_MAX: 500,    // Delay maximo entre particulas
SPAWN_STIFFNESS: 0.08,     // Fuerza del spring
SPAWN_DAMPING: 0.88,       // Friccion
SPAWN_SPREAD: 1.5,         // 1.5x viewport
```

### 7. Landing Scatter (Dispersion al Aterrizar)

**Trigger:** Al aterrizar de un salto normal

**Comportamiento:**
1. Particulas se dispersan brevemente (150ms)
2. Se reagrupan con efecto bounce (250ms)

**Configuracion:**
```typescript
LANDING_SCATTER_DURATION: 150,
LANDING_REASSEMBLE_DURATION: 250,
LANDING_MAX_SCATTER: 40,        // px maximo
LANDING_SPRING_DAMPING: 0.72,
```

### 8. Crash (Caida Fuerte)

**Trigger:** Caer desde >200px de altura (despues de drag & drop)

**Fases:**
1. **Explosion** (100ms) - Particulas salen disparadas hacia arriba/afuera
2. **Caida** - Gravedad, rebote en suelo, friccion
3. **Settling** (1.5s) - Particulas se asientan en el suelo
4. **Reensamblaje** (800ms) - Spring animation de regreso

**Physics:**
```typescript
gravity = 800;           // px/s²
bounceDamping = 0.4;     // Pierde 60% energia en rebote
friction = 0.95;         // Friccion horizontal
settleThreshold = 30;    // px/s para considerar "quieto"
```

**Cooldown:** Despues del crash, 2 segundos sin poder moverse/agarrarse

---

## PHYSICS CONFIG

### Constantes en ASSEMBLY_CONFIG

```typescript
export const ASSEMBLY_CONFIG = {
  // Spawn Assembly
  SPAWN_DURATION: 2000,
  SPAWN_STAGGER_MAX: 500,
  SPAWN_STIFFNESS: 0.08,
  SPAWN_DAMPING: 0.88,
  SPAWN_SPREAD: 1.5,

  // Landing Disassemble
  LANDING_SCATTER_DURATION: 150,
  LANDING_REASSEMBLE_DURATION: 250,
  LANDING_MAX_SCATTER: 40,
  LANDING_SPRING_DAMPING: 0.72,

  // Type-based mass (afecta distancia de scatter)
  TYPE_MASS: {
    core: 1.0,    // Mas pesado, dispersa menos
    limb: 0.85,
    edge: 0.7,
    eye: 0.6,     // Mas liviano, dispersa mas
    smile: 0.8,
    empty: 0,
    normal: 0.75,
  },

  // Crash
  CRASH_SCATTER_MAGNITUDE: 120,
  CRASH_DISASSEMBLED_DURATION: 1500,
  CRASH_REASSEMBLE_DURATION: 800,
  CRASH_MIN_FALL_HEIGHT: 200,
};
```

---

## COMO MODIFICAR EL PERSONAJE

### Cambiar la Forma

1. Abrir `character-matrix.config.ts`
2. Editar los strings `TORSO_FRONT`, `TORSO_LEFT`, `TORSO_RIGHT`
3. Usar:
   - `.` para espacios
   - `0` y `1` para el cuerpo
   - `E` para ojos
   - `S` para boca
4. **IMPORTANTE:** Todas las lineas deben tener el mismo largo

**Ejemplo - Hacer cabeza mas grande:**
```
// ANTES
.......000.......
.....0000000.....

// DESPUES
......00000......
....000000000....
```

### Cambiar Colores

En `binary-character.component.scss`:

```scss
$green: #00ff44;    // Color principal
$white: #ffffff;    // Color de ojos
$glow: rgba(0, 255, 68, 0.5);  // Glow
```

### Cambiar Velocidad de Animaciones

En `character-matrix.config.ts`, dentro de `CHARACTER_CONFIG`:

```typescript
BLINK_INTERVAL_MIN: 3000,  // Minimo entre parpadeos
BLINK_INTERVAL_MAX: 6000,  // Maximo entre parpadeos
BLINK_DURATION: 120,       // Duracion del parpadeo
WALK_FRAME_DURATION: 150,  // Velocidad de caminar
```

### Cambiar Brillo

En `CHARACTER_CONFIG.BRIGHTNESS`:

```typescript
BRIGHTNESS: {
  CORE: 1.0,   // Centro - mas brillante
  LIMB: 0.6,   // Extremidades
  EDGE: 0.35,  // Bordes - mas tenue
  EYE: 1.0,    // Ojos
  SMILE: 0.9,  // Boca
}
```

### Agregar Nuevo Tipo de Digito

1. Agregar a enum `DigitType`:
```typescript
export enum DigitType {
  // ... existentes
  HEART = 'heart',  // Nuevo tipo
}
```

2. Agregar case en `getBrightness()`:
```typescript
case DigitType.HEART: return brightness.HEART;
```

3. Agregar estilos en SCSS:
```scss
.digit.type-heart {
  color: #ff0044;
  text-shadow: 0 0 8px #ff0044;
}
```

4. Agregar a `TYPE_MASS` si se usa en animaciones:
```typescript
TYPE_MASS: {
  // ...
  heart: 0.9,
}
```

---

## INTEGRACION CON PADRE (FlameHeadCharacterComponent)

### Inputs

| Input | Tipo | Descripcion |
|-------|------|-------------|
| isMoving | boolean | Esta caminando? |
| isJumping | boolean | Esta en el aire? |
| facingRight | boolean | Mira a la derecha? |
| isTalking | boolean | Esta hablando? (anima boca) |
| characterScreenY | number | Posicion Y en pantalla (para crash) |

### Outputs

| Output | Tipo | Descripcion |
|--------|------|-------------|
| assemblyComplete | Event | Emite cuando termina ensamblaje inicial |
| crashComplete | Event | Emite cuando termina crash y reensamblaje |

### Metodos Publicos

```typescript
// Iniciar animacion de crash
triggerCrash(): void

// Verificar si esta crasheando
isCrashing(): Signal<boolean>

// Verificar si esta ensamblado
isAssembled(): Signal<boolean>
```

### Ejemplo de Uso

```html
<app-binary-character
  [isMoving]="isMoving()"
  [isJumping]="isJumping()"
  [facingRight]="physicsService.facingRight()"
  [isTalking]="isTyping()"
  [characterScreenY]="screenY()"
  (assemblyComplete)="onAssemblyComplete()"
  (crashComplete)="onCrashComplete()">
</app-binary-character>
```

```typescript
// En el componente padre
onAssemblyComplete(): void {
  // Personaje ensamblado, iniciar dialogo
  this.startWelcomeDialog();
}

onCrashComplete(): void {
  // Crash terminado, mostrar dialogo de enojo
  this.showCrashDialog();
}
```

---

## ESTADOS Y SENALES

### Senales Internas

```typescript
// Estados visuales
isBlinking = signal(false);
glitchDigits = signal<Set<string>>(new Set());
mouthFrame = signal(0);
emotion = signal<CharacterEmotion>(CharacterEmotion.IDLE);
eyeOffset = signal({ x: 0, y: 0 });

// Estados de animacion
isLanding = signal(false);
assemblyPhase = signal<AssemblyPhase>(AssemblyPhase.SCATTERED);
isAssembled = signal(false);
isCrashing = signal(false);
```

### Enum AssemblyPhase

```typescript
enum AssemblyPhase {
  SCATTERED = 'scattered',        // Particulas dispersas
  ASSEMBLING = 'assembling',      // Convergiendo
  ASSEMBLED = 'assembled',        // Completo
  LANDING_SCATTER = 'landing',    // Dispersion por aterrizaje
  REASSEMBLING = 'reassembling'   // Reagrupando
}
```

---

## RENDIMIENTO

### Optimizaciones Aplicadas

1. **CSS Transforms:** Todas las animaciones usan `transform` (GPU accelerated)
2. **Map para lookup O(1):** Estados de particulas en Map, no Array
3. **will-change: transform:** Hint al browser para optimizar
4. **ChangeDetectionStrategy.OnPush:** Deteccion de cambios optimizada
5. **requestAnimationFrame:** Loop de animacion eficiente

### Tips para Mantener Rendimiento

- No agregar mas de ~200 digitos totales
- Evitar animaciones CSS complejas en cada digito
- Usar `trackBy` si se itera sobre grids en template
- Calcular valores una vez y cachear (ej: scatter vectors)

---

## DEPURACION

### Visualizar Estado Actual

```typescript
// En consola del navegador
const char = document.querySelector('app-binary-character');
console.log(char.__ngContext__); // Contexto Angular
```

### Forzar Estados

```typescript
// Forzar crash desde consola
const binaryChar = // referencia al componente
binaryChar.triggerCrash();
```

### CSS Debug

```scss
// Mostrar bordes de cada digito
.digit {
  outline: 1px solid red;
}
```

---

## CHANGELOG

### v5.2 (Enero 2026)
- Design: Cabeza rectangular compacta (4 filas, sin espacio vacio)
- Design: Torso mas delgado (max 7 chars en vez de 9)
- Refactor: Grids reducidos de 14 a 13 filas

### v5.1 (Enero 2026)
- Fix: Particulas ahora caen al suelo real (no flotan)
- Feature: Cooldown de 2 segundos post-crash
- Feature: Bloqueo de movimiento/drag durante crash

### v5.0 (Enero 2026)
- Feature: Spawn Assembly animation
- Feature: Landing Scatter animation
- Feature: Crash animation con fisica real
- Feature: Drag & Drop del personaje

### v4.1 (Anterior)
- Feature: Arm swing animation
- Feature: Body poses (front/left/right)
- Feature: Mouth animation during dialog
- Feature: Neck rotation towards mouse

### v4.0 (Anterior)
- Feature: Eye tracking
- Feature: Emotional states
- Feature: Double blink (20%)
- Feature: Proximity detection
