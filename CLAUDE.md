# 🎮 CLAUDE.md - Dungeon AI Game Portfolio - v6.0

## 🎯 **ESTADO ACTUAL - JUEGO DUNGEON INTERACTIVO**
**Fecha**: Enero 2, 2026
**Status**: ✅ DESARROLLO COMPLETADO - RAMA `claude/refactor-portfolio-dungeon-game-sTbSO`

Refactorización completa del portfolio a un juego interactivo estilo dungeon 2D para **Daniel Castiblanco - Consultor IA**.

---

## 🆕 **CAMBIOS v6.0 - REFACTORIZACIÓN DUNGEON GAME**

### **Transformación Completa:**
El portfolio estático se transformó en un juego interactivo donde un personaje "Flame Head Voxel" navega por un espacio 2D con iluminación dinámica, interactuando con 5 puertas que llevan a diferentes destinos.

### **Características Implementadas:**
- ✅ Personaje jugable con animaciones de caminar y llama animada
- ✅ Sistema de iluminación dinámica con CSS radial-gradients
- ✅ 5 puertas interactivas con detección de proximidad
- ✅ Modales enriquecidos con información de servicios
- ✅ Game loop con requestAnimationFrame (60fps)
- ✅ Control por teclado (WASD/Flechas + Enter)
- ✅ Transiciones fade a negro entre navegaciones
- ✅ Página placeholder para MultiDesktopFlow

---

## 🏗️ **NUEVA ARQUITECTURA**

### **📁 ESTRUCTURA DE ARCHIVOS:**

```
src/app/
├── core/
│   ├── config/
│   │   └── game.config.ts              # Constantes del juego + servicios
│   ├── interfaces/
│   │   └── game-state.interfaces.ts    # Types e interfaces
│   └── services/
│       ├── game-state.service.ts       # Estado con Signals
│       ├── game-loop.service.ts        # Loop fuera de NgZone
│       ├── input.service.ts            # Manejo de teclado
│       ├── lighting.service.ts         # Sistema de iluminación
│       └── navigation.service.ts       # Navegación y modales
│
├── features/game/
│   ├── game-container.component.ts     # Contenedor principal
│   ├── dungeon-scene/
│   │   ├── dungeon-scene.component.ts  # Escena del juego
│   │   ├── player-character/           # Personaje SVG animado
│   │   ├── door/                       # Puertas interactivas
│   │   └── lighting-overlay/           # Overlay de iluminación
│   └── ui-overlay/
│       └── ui-overlay.component.ts     # HUD del juego
│
├── shared/modals/
│   ├── about-modal.component.ts        # Modal Sobre Mí
│   └── consulting-modal.component.ts   # Modal Servicios
│
└── pages/multidesktopflow/
    └── multidesktopflow.component.ts   # Placeholder
```

---

## 🎮 **SISTEMA DE JUEGO**

### **Controles:**
- **WASD / Flechas**: Movimiento del personaje
- **Enter / Space**: Interactuar con puertas
- **ESC / Enter** (en modal): Cerrar modal

### **Las 5 Puertas:**
| Puerta | Color | Tipo | Destino |
|--------|-------|------|---------|
| NUVARIS | Verde | Externa | https://nuvaris.com |
| MULTIDESKTOP | Cyan | Interna | /multidesktopflow |
| AGENDAR | Naranja | Externa | Calendly |
| SERVICIOS | Magenta | Modal | Consulting modal |
| SOBRE MÍ | Amarillo | Modal | About modal |

### **Sistema de Iluminación:**
- Luz dinámica sigue al personaje
- Radio de luz: 180px
- Puertas se iluminan al acercarse
- Transiciones fade a negro entre navegaciones

---

## 🔧 **CONFIGURACIÓN TÉCNICA**

### **Tecnologías Usadas:**
- Angular 17.3.0 (standalone components)
- Angular Signals para estado reactivo
- requestAnimationFrame fuera de NgZone
- CSS radial-gradients para iluminación
- SVG inline para personaje animado

### **Archivos de Configuración Clave:**

**game.config.ts** - Todas las constantes modificables:
```typescript
GAME_CONFIG = {
  player: { speed: 200, lightRadius: 180 },
  world: { width: 800, height: 600 },
  doors: [...],  // 5 puertas configurables
  lighting: { ambientDarkness: 0.92 },
  interaction: { proximityRadius: 80 },
  profile: { name, title, calendlyUrl }
}
```

### **Servicios del Juego:**
1. **GameStateService** - Estado central con Signals
2. **GameLoopService** - requestAnimationFrame a 60fps
3. **InputService** - Manejo de teclado con normalización diagonal
4. **LightingService** - Generación de gradients dinámicos
5. **NavigationService** - Rutas, modales y transiciones

---

## 📊 **MÉTRICAS DE BUILD**

```
Initial chunk files   |  Raw size | Compressed
chunk-Q5QQCDEG.js     | 188.80 kB |    51.79 kB
main-ZH4GOJQC.js      |  62.31 kB |    16.49 kB
polyfills-FFHMD2TL.js |  33.71 kB |    11.02 kB
styles-SOH4KCSC.css   |   1.75 kB |   595 bytes
─────────────────────────────────────────────────
Initial total         | 286.56 kB |    79.88 kB

Lazy chunks:
game-container        |  42.26 kB |     9.72 kB
multidesktopflow      |   4.94 kB |     1.58 kB
```

---

## 🚀 **DEPLOYMENT**

### **Branch Actual:**
`claude/refactor-portfolio-dungeon-game-sTbSO`

### **Para Mergear a Main:**
```bash
git checkout main
git merge claude/refactor-portfolio-dungeon-game-sTbSO
git push origin main
```

### **Netlify:**
- Build: `npm ci && npm run build`
- Publish: `dist/dungeon-ai-landing/browser`
- Node: 20

---

## 📝 **NOTAS IMPORTANTES**

### **Lo que se preservó:**
- ✅ Todos los datos de servicios de consultoría
- ✅ URL de Calendly original
- ✅ Estética Matrix (colores, fonts, cursores)
- ✅ Información de perfil de Daniel Castiblanco

### **Lo que se reemplazó:**
- ❌ Landing estático → Juego interactivo
- ❌ Sistema de iluminación por cursor → Iluminación por personaje
- ❌ Servicios como tarjetas → Modal con grid de servicios
- ❌ Hero section → HUD del juego

### **Pendiente (MultiDesktopFlow):**
- El usuario indicó que proporcionará el contenido después
- Actualmente es una página placeholder con mensaje "EN DESARROLLO"

---

## 🎯 **GUÍA PARA EL PRÓXIMO DESARROLLADOR**

### **Para modificar las puertas:**
Editar `src/app/core/config/game.config.ts`:
```typescript
doors: [
  {
    id: 'nueva-puerta',
    label: 'ETIQUETA',
    position: { x: 100, y: 200 },
    size: { width: 80, height: 120 },
    type: 'external' | 'internal' | 'modal',
    destination: 'URL o ruta o modalId',
    color: '#hexcolor',
  }
]
```

### **Para agregar más modales:**
1. Crear componente en `src/app/shared/modals/`
2. Agregar tipo en `NavigationService`
3. Agregar case en `game-container.component.ts`

### **Para ajustar el juego:**
- Velocidad: `GAME_CONFIG.player.speed`
- Tamaño luz: `GAME_CONFIG.player.lightRadius`
- Radio interacción: `GAME_CONFIG.interaction.proximityRadius`
- Duración fade: `GAME_CONFIG.lighting.fadeTransitionDuration`

---

## 🔄 **HISTORIAL DE VERSIONES**

| Versión | Fecha | Descripción |
|---------|-------|-------------|
| v6.0 | Ene 2, 2026 | Refactorización a juego dungeon interactivo |
| v5.1 | Sep 6, 2025 | Título simplificado, fonts consistentes |
| v5.0 | Sep 6, 2025 | Sistema de iluminación calibrado |
| v4.4 | Sep 5, 2025 | Sistema modal funcional |

---

**🎮 ESTADO FINAL**: Juego dungeon interactivo completamente funcional en rama de desarrollo. Listo para review y merge a main cuando se apruebe.
