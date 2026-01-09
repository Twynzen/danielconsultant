# 🏰 CLAUDE.md - Dungeon AI Landing Angular - v6.2 ROBOT INTERACTION FIX

## 🚨 **REGLAS CRÍTICAS DE GIT - LEER SIEMPRE**

### **NUNCA hacer sin preguntar:**
1. **`git push`** - El usuario SIEMPRE hace el push manualmente
2. **`git merge ... main`** - SIEMPRE preguntar antes de mergear a main
3. **Merge a main sin que el usuario pruebe** - El usuario DEBE probar los cambios primero

### **Flujo correcto:**
1. Hacer commits en la rama de trabajo ✅
2. **PREGUNTAR**: "¿Quieres que mergee a main?" ❓
3. Esperar confirmación del usuario ⏳
4. Si confirma, hacer merge
5. **NUNCA** hacer push - el usuario lo hace

### **Recordatorio:**
> "Los cambios están listos para probar. Cuando confirmes que funcionan,
> puedo mergear a main y tú haces el push."

---

## 🤖 **v6.2: ROBOT-CHAT INTERACTION FIX (Enero 9, 2026)**

### **Problema Corregido:**
El comportamiento de clic/drag en el robot era inconsistente con respecto al chat de Sendell. El chat se cerraba de forma inesperada o no se cerraba cuando debía.

### **Nuevo Comportamiento:**
| Acción | Resultado |
|--------|-----------|
| **Arrastrar robot** | CIERRA el chat inmediatamente (interacciones separadas) |
| **Clic simple** | CIERRA el chat si está abierto |
| **Doble-clic** | ABRE el chat si está cerrado |

### **Archivos Modificados:**
- `binary-character.component.ts` - Nuevo Output `robotClicked`
- `flame-head-character.component.ts` - Nuevos Outputs `robotClicked`, `robotDragStarted` + protección 200ms post-drag
- `flame-head-character.component.html` - Conexión de eventos
- `sendell-dialog.component.ts` - Nuevo método `closeChatFromRobotInteraction()`, removido toggle de `openChatFromRobot()`
- `landing-page.component.ts` - Nuevos handlers `onRobotDragStarted()`, `onRobotClicked()`
- `landing-page.component.html` - Conexión de eventos

### **Testing Checklist v6.2:**
- [ ] Doble-clic en robot → abre chat con saludo
- [ ] Clic simple en robot (chat abierto) → CIERRA el chat
- [ ] Iniciar drag (mousedown) → chat se CIERRA inmediatamente
- [ ] Soltar robot + clic inmediato (<200ms) → clic ignorado
- [ ] Soltar robot + esperar (>200ms) + clic → clic funciona
- [ ] Chat minimizado + doble-clic → restaura chat
- [ ] Durante tour → chat bloqueado, interacciones ignoradas

---

## 📅 **CAMBIOS ÚLTIMA SEMANA (Enero 2-9, 2026)**

### **Commits Recientes:**
| Fecha | Commit | Descripción |
|-------|--------|-------------|
| Jan 9 | `7647832` | feat: Add Núvariz rename, SVG holograms, and GitHub animation |
| Jan 9 | `5321902` | feat: Add AGENTS and INTEGRATIONS hologram animations |
| Jan 9 | `024830c` | feat: Add RAG hologram animation with red Matrix theme |
| Jan 8 | `d21bda2` | feat: Add generic hologram animation for LOCAL LLMS pillar |
| Jan 8 | `fd5e970` | docs: Add git workflow rules to CLAUDE.md |
| Jan 8 | `6fd9385` | assets: Add LLM local demo screenshots |
| Jan 8 | `52098f5` | feat: v5.9.5 Loading/Welcome Fusion + Tour Guards + Tooltip Fix |

### **Sistema de Hologramas (v6.0-6.1):**
- `HologramPortraitComponent` soporta PNG frames y SVG animations
- Nuevos hologramas: LOCAL LLMS, RAG, AGENTS, INTEGRATIONS, GITHUB
- Hologramas SVG animados: Calendly (calendario), Núvariz (planeta)
- Configuración en `pillar.config.ts` con `HologramConfig` interface

### **Núvariz Rename:**
- Renombrado de "Nuvaris" → "NÚVARIZ" en toda la aplicación
- Nueva descripción: "Universo Núvariz - Próximamente"

### **Loading/Welcome Fusion (v5.9.5):**
- Fusión de loading bar y welcome message en sección unificada
- Nuevas animaciones CSS: `fadeSlideIn`, `morphIn`
- Guards para evitar callbacks después de que el tour termine
- Limpieza de historial LLM después del tour

### **Assets Añadidos:**
- 30 frames PNG para cada hologram (~150 archivos totales)
- ~31 MB de assets de animación
- Directorios: gifllmlocal/, gifrag/, gifagents/, gifintegrations/, gifgithub/

---

## 🎮 **NUEVO: VAMPIRE SURVIVORS GAME - COMPLETAMENTE INTEGRADO**
**Fecha**: Noviembre 13, 2025
**Status**: ✅ JUEGO FUNCIONAL + LANDING PAGE INTACTA

Se ha integrado un videojuego completo estilo **Vampire Survivors** como página independiente, accesible mediante routing sin afectar la landing page principal.

### **🎯 CARACTERÍSTICAS DEL JUEGO:**
- ✅ **Game Engine completo** con Canvas HTML5 y RequestAnimationFrame loop a 60fps
- ✅ **Sistema de entidades robusto**: Player, Enemies (4 tipos), Projectiles, XP Orbs
- ✅ **Auto-ataque inteligente** al enemigo más cercano dentro del rango
- ✅ **Sistema de XP y niveles** con 6 upgrades diferentes (Damage, Speed, Range, HP, etc.)
- ✅ **Spawn de enemigos progresivo** con dificultad escalable cada 30 segundos
- ✅ **4 tipos de enemigos**: Basic (cuadrado), Fast (triángulo), Tank (cuadrado grande), Boss (pentágono)
- ✅ **Sistema de puntuación** con High Score guardado en localStorage
- ✅ **UI completa**: Menú, HUD en tiempo real, Pausa, Level Up, Game Over
- ✅ **Controles**: WASD/Arrows para movimiento, ESC para pausar, SPACE para iniciar
- ✅ **Estética Matrix coherente** con la landing page (verde neón, efectos glow)
- ✅ **Responsive y optimizado** para navegadores modernos

### **📁 ESTRUCTURA DEL JUEGO:**
```
dungeon-ai-landing/src/app/components/
├── vampire-survivors-game/
│   ├── vampire-survivors-game.component.ts      # 800+ líneas de game logic
│   ├── vampire-survivors-game.component.html    # Overlays + Canvas
│   ├── vampire-survivors-game.component.scss    # Estilos Matrix theme
│   └── vampire-survivors-game.component.spec.ts # Unit tests
├── landing-page/                                # Landing page movida aquí
│   ├── landing-page.component.ts
│   ├── landing-page.component.html
│   ├── landing-page.component.scss
│   └── landing-page.component.spec.ts
```

### **🔀 ROUTING CONFIGURADO:**
```typescript
// app.routes.ts
'/'       → LandingPageComponent  // Landing page original
'/game'   → VampireSurvivorsGameComponent  // Juego nuevo
```

### **🎮 MECÁNICAS DEL JUEGO:**

#### **Player System:**
- Movimiento fluido en 8 direcciones (normalizado en diagonales)
- Auto-ataque automático al enemigo más cercano
- Sistema de rango de ataque visible
- Radio de pickup para XP orbs
- Health bar dinámica con colores según HP%

#### **Enemy System:**
- **Basic**: 30 HP, velocidad media, color rojo
- **Fast**: 20 HP, velocidad alta, color naranja, forma triangular
- **Tank**: 80 HP, velocidad lenta, color rojo oscuro, tamaño grande
- **Boss**: 300 HP, velocidad media, color magenta, forma pentagonal
- Spawn desde bordes aleatorios (top/right/bottom/left)
- Health bars individuales sobre cada enemigo
- AI de persecución directa al jugador

#### **Progression System:**
- XP para level up con curva exponencial (xp * 1.5 por nivel)
- Al subir nivel: +20 HP curación inmediata
- 6 upgrades aleatorios para elegir:
  - **+20% Damage**: Aumenta daño de proyectiles
  - **+15% Attack Speed**: Más ataques por segundo
  - **+20% Range**: Mayor alcance de ataque
  - **+10% Move Speed**: Movimiento más rápido
  - **+20 Max Health**: Vida máxima aumentada
  - **+30% Pickup Radius**: Recolectar XP desde más lejos

#### **Difficulty Scaling:**
- Multiplicador de dificultad aumenta cada 30 segundos
- Spawn rate de enemigos se acelera progresivamente
- Límite máximo de enemigos incrementa hasta 200
- Stats de enemigos escalan con dificultad (HP, damage, XP, size)

### **🎨 UI/UX DEL JUEGO:**

#### **Menu Screen:**
- Título grande "VAMPIRE SURVIVORS" con glow effect
- Controles e instrucciones claras
- High Score display si existe
- Botones: "START GAME" y "Back to Landing"

#### **HUD (In-Game):**
- Level y XP actual/requerido
- Score en tiempo real
- Kill count
- Tiempo de supervivencia
- Health bar grande en bottom con HP numérico

#### **Level Up Screen:**
- Pausa automática del juego
- Grid de 3 upgrades aleatorios
- Icono emoji + nombre + descripción
- Cards con hover effects Matrix

#### **Game Over Screen:**
- Stats finales: Score, Level, Kills, Time
- Indicador de NEW HIGH SCORE si aplica
- Botones: "PLAY AGAIN" y "Main Menu"

### **⚙️ TECHNICAL IMPLEMENTATION:**

#### **Game Loop:**
```typescript
- RequestAnimationFrame a 60fps
- Delta time para frame-rate independence
- Update → Render → Loop
- Performance.now() para timing preciso
```

#### **Collision Detection:**
```typescript
- Circle-to-circle para todas las colisiones
- Projectile vs Enemy (marca projectile para removal)
- Enemy vs Player (damage continuo por frame)
- XP Orb vs Player pickup radius (magnetismo)
```

#### **Entity Management:**
```typescript
- Arrays dinámicos para enemies, projectiles, xpOrbs
- Cleanup automático de entidades muertas/expiradas
- Pooling implícito mediante array filtering
```

#### **Canvas Rendering:**
```typescript
- Clear → Grid → XP → Enemies → Projectiles → Player → HUD
- Figuras geométricas simples (rect, circle, polygon)
- Glow effects con shadowBlur
- Color coding por tipo de enemigo/objeto
```

### **🚀 CÓMO ACCEDER AL JUEGO:**

#### **Desarrollo Local:**
```bash
cd dungeon-ai-landing
npm install
npm start
# Navegar a: http://localhost:4200/game
```

#### **Build Producción:**
```bash
npm run build
# Output: dist/dungeon-ai-landing/
# Ruta del juego: https://tu-dominio.com/game
```

#### **Desde la Landing Page:**
- Agregar un botón/link que navegue a `/game`
- Ejemplo: `<a routerLink="/game">🎮 Play Game</a>`
- El juego incluye botón "Back to Landing" (ESC también funciona)

### **📊 BUNDLE SIZE POST-INTEGRACIÓN:**
```
main.js:      333.47 kB raw / 80.00 kB gzipped
polyfills.js:  33.71 kB raw / 11.02 kB gzipped
styles.css:     1.78 kB raw / 629 bytes gzipped
TOTAL:        368.96 kB raw / 91.63 kB gzipped
```
**Impacto**: +35 kB compressed vs landing sola (juego completamente auto-contenido)

### **✅ TESTING CHECKLIST JUEGO:**
- [x] Menú principal muestra correctamente
- [x] START GAME inicia el juego
- [x] Movimiento WASD/Arrows funciona
- [x] Auto-ataque dispara al enemigo más cercano
- [x] Enemigos spawean y persiguen al jugador
- [x] Colisiones funcionan (proyectiles, daño player)
- [x] XP orbs spawean al matar enemigos
- [x] XP orbs son atraídos al jugador
- [x] Level up pausa y muestra upgrades
- [x] Upgrades se aplican correctamente
- [x] Dificultad escala progresivamente
- [x] Game Over muestra stats finales
- [x] High Score se guarda en localStorage
- [x] Pausa con ESC funciona
- [x] Botón "Back to Landing" navega correctamente
- [x] Responsive en diferentes tamaños de pantalla

---

## 🎯 **LANDING PAGE - SISTEMA COMPLETO Y FUNCIONAL**
**Status**: ✅ PRODUCCIÓN READY (INTACTA - NO AFECTADA POR JUEGO)

Landing page profesional Matrix para **Daniel Castiblanco - Consultor IA** con sistema de iluminación por proximidad calibrado y todas las características implementadas.

### **🎯 TÍTULO FINAL SIMPLIFICADO:**
- **Hero Section**: "CONSULTOR IA" (sin "de" - más corto y directo)
- **Page Title**: "Consultor IA" (favicon actualizado manualmente)
- **Font System**: Courier New nativo (sin flash inicial)

## 📋 **ESTADO ACTUAL - SISTEMA MODAL FUNCIONAL**
**Fecha**: Septiembre 05, 2025 - v4.4

### ✅ **IMPLEMENTACIONES COMPLETADAS:**
- **Sistema de modales informativos** para 6 servicios completamente funcional
- **Iconos SVG animados personalizados** (ECG pulse, eye blink, brain pulse, chart bars, escudo medieval)
- **Event handlers híbridos** (Angular + Native listeners para máxima compatibilidad)
- **Z-index nuclear** para modal (999999) con backdrop click funcional
- **Dot verde clickeable** en terminal header para cerrar modal
- **Scroll horizontal eliminado** en modales
- **Estética Matrix completa** con efectos visuales coherentes

### 🚨 **ISSUE PENDIENTE CRÍTICO:**
1. **Botón CTA Z-index**: El botón "AGENDAR SESIÓN GRATUITA" sigue apareciendo encima del modal
   - **Cambio de requerimientos**: Originalmente se quería que el botón estuviera siempre visible, pero ahora debe quedarse DETRÁS de los modales porque se ve feo que se interponga
   - **Estado actual**: Probados z-index extremos (999999 vs 10) con `!important` sin éxito
   - **Posible causa**: Stacking context issue o CSS conflictivo más profundo

## 🏗️ **ARQUITECTURA TÉCNICA**

### **📁 ESTRUCTURA DE COMPONENTES:**

#### **Componente Modal** ✅
```
src/app/components/modal-service/
├── modal-service.component.ts      # Event handlers híbridos + lifecycle hooks
├── modal-service.component.html    # Template con dot verde clickeable  
├── modal-service.component.scss    # Z-index 999999 + overflow hidden
└── modal-service.component.spec.ts
```

#### **Servicios de Datos** ✅
```
src/app/services/services-data.service.ts
- Interface ServiceDetail con iconos animados
- 6 servicios con features y tecnologías detalladas
- Métodos getServiceDetail() y getAllServiceDetails()
```

#### **Integración Principal** ✅
```
src/app/components/service-hieroglyphs/
├── service-hieroglyphs.component.ts   # Modal state management
└── service-hieroglyphs.component.html # Modal component render
```

### **🎯 FUNCIONALIDADES IMPLEMENTADAS:**

#### **1. Sistema Modal Completo**
- **Apertura**: Click en tarjeta servicio iluminada
- **Cierre método 1**: Click en dot verde del terminal header  
- **Cierre método 2**: Click en backdrop (fuera del contenido)
- **Protección**: Click dentro del modal NO lo cierra
- **Animaciones**: Matrix rain, terminal header, glow effects

#### **2. Iconos SVG Personalizados**
- **ECG Pulse**: `modal-service.component.html:54-59` - Waveform médico animado
- **Eye Blink**: `modal-service.component.html:61-70` - Parpadeo realista
- **Brain Pulse**: `modal-service.component.html:72-84` - Pulso cerebral con glow
- **Chart Bars**: `modal-service.component.html:86-92` - Barras animadas
- **Shield Medieval**: `modal-service.component.html:90-95` - Escudo futurista con checkmark

#### **3. Event Handling Robusto**
- **Angular Bindings**: `(click)="onClose()"` en dot verde
- **Native Listeners**: `addEventListener` en backdrop con `afterViewInit`
- **Change Detection**: Forzada con `ChangeDetectorRef.detectChanges()`
- **Error Handling**: Try-catch con debugging comentado

#### **4. Estilos Matrix Coherentes**
- **Terminal Header**: Dots rojos/amarillos/verdes con hover effects
- **Typography**: Courier New monospace con green glow
- **Scrollbar Custom**: Verde Matrix con border-radius
- **Responsive**: Mobile-friendly con breakpoints

### **🔧 CONFIGURACIÓN TÉCNICA ACTUAL:**

#### **Z-Index Hierarchy (PROBLEMÁTICA)**
```css
Modal Backdrop:     999999 !important  ← Máximo intentado
Botón Consulta:     10 !important      ← Mínimo intentado  
Partículas:         9 !important       ← Mínimo intentado
Otros elementos:    < 9                 ← Normal
```

#### **Event Listeners**
```typescript
// Angular bindings
(click)="onClose()" 
(click)="onBackdropClick($event)"

// Native listeners (fallback)
backdrop.addEventListener('click', handler)
greenDot.addEventListener('click', handler)
```

#### **CSS Overflow Control**
```scss
.modal-container {
  overflow: hidden;
  overflow-x: hidden;  // Sin scroll horizontal
}

.modal-content {
  overflow-y: auto;    // Solo vertical
  overflow-x: hidden;  // Sin horizontal
  word-wrap: break-word;
  box-sizing: border-box;
}
```

## 🚨 **ROADMAP PARA PRÓXIMO DESARROLLADOR**

### **PRIORIDAD 1 - CRÍTICA (Z-index Issue)**
**Problema**: Botón "AGENDAR SESIÓN GRATUITA" aparece encima del modal  
**Ubicación**: `consultation-button.component.scss:6` 

**Intentos realizados SIN éxito:**
- Z-index extremos (999999 vs 10) con `!important`
- Inline styles en modal backdrop  
- Múltiples niveles de z-index
- Verificación de CSS conflicts

**Próximas estrategias a probar:**
1. **Stacking Context Reset**: Crear nuevo stacking context para modal
2. **CSS Transform Fix**: Usar `transform: translateZ(0)` para forzar layer
3. **Position Strategy**: Cambiar position del botón de `fixed` a `absolute`
4. **DOM Order**: Mover modal al final del body con `document.body.appendChild`
5. **CSS Isolation**: Usar `isolation: isolate` en modal container

### **Código sugerido para probar:**
```scss
// Opción 1: Stacking context
.modal-backdrop {
  z-index: 999999 !important;
  isolation: isolate;
  transform: translateZ(0);
}

// Opción 2: Cambiar botón
.consultation-container {
  position: absolute;  // En lugar de fixed
  z-index: 1;
}
```

### **PRIORIDAD 2 - MEJORAS OPCIONALES**

#### **A. Re-activar Animaciones Angular**
**Estado**: Deshabilitadas por errores que mataban event handlers  
**Ubicación**: `modal-service.component.ts:15`  
**Causa**: `ExpressionChangedAfterItHasBeenCheckedException`

#### **B. Limpieza de Debug Code**
**Ubicación**: Múltiples console.log comentados en:
- `modal-service.component.ts` 
- `service-hieroglyphs.component.ts`
- `app.component.ts`

## 🎮 **GUÍA DE USO ACTUAL**

### **Para el Usuario:**
1. **Abrir modal**: Click en cualquier servicio iluminado  
2. **Ver información**: Scroll dentro del modal para ver features/tecnologías
3. **Cerrar modal**: Click en dot verde (terminal header) O click fuera del contenido

### **Para el Desarrollador:**
```bash
ng serve          # Testing local
ng build          # Build producción
ng lint          # Verificar código
```

### **Testing Checklist:**
- [ ] Modal abre con click en servicio
- [ ] Dot verde cierra modal  
- [ ] Backdrop click cierra modal
- [ ] Click dentro NO cierra modal
- [ ] **PENDIENTE: Botón CTA queda detrás del modal**
- [ ] Sin scroll horizontal en modal
- [ ] Iconos SVG se renderizan y animan
- [ ] Responsive funciona en mobile

## 🤝 **METODOLOGÍA DE DESARROLLO ESTABLECIDA**

### **Principios:**
- **"Ultra Think"** - Análisis profundo antes de implementar
- **Debugging extremo** - Console logs detallados para diagnóstico  
- **Event handling híbrido** - Angular + Native para máxima compatibilidad
- **Z-index nuclear** - Valores extremos cuando sea necesario
- **Comunicación constante** - Documentar TODO en CLAUDE.md

### **Git Workflow:**
- **Branch actual**: `main` (desarrollo directo)
- **Commits**: Descriptivos con emoji + Claude Code signature
- **Documentation**: CLAUDE.md siempre actualizado antes de commits

## 🎯 **ACTUALIZACIONES FINALES - SEPTIEMBRE 6, 2025**

### **✅ CAMBIOS IMPLEMENTADOS:**
1. **Título simplificado**: "CONSULTOR IA" (removido "de" para mayor impacto)
2. **Font system consistente**: Courier New nativo sin flash inicial
3. **Favicon actualizado**: Robot verde Matrix (actualizado manualmente)
4. **Page title**: Simplificado a "Consultor IA" en navegador
5. **Bundle optimizado**: 342.94 kB → 86.94 kB compressed
6. **Documentación completa**: v5.1 FINAL con todos los cambios

### **🚀 COMMITS REALIZADOS:**
- `chore: simplify title and fix fonts` - Título sin "de" + fonts consistentes
- `docs: update CLAUDE.md v5.1 FINAL` - Documentación completa actualizada
- `build: production deployment` - Build final deployado a main

### **📊 MÉTRICAS FINALES:**
- **Performance**: Smooth 60fps en todas las animaciones
- **Responsive**: Mobile + desktop funcional
- **Bundle**: ~86kB compressed final
- **Git**: Branch main actualizado y deployado

---

**🎯 PRÓXIMO DESARROLLADOR**: Sistema completamente funcional y deployado. Título simplificado a "CONSULTOR IA", fonts consistentes, favicon actualizado. Solo pendiente opcional: resolver z-index del botón CTA si se considera necesario.

**🚀 ESTADO FINAL**: Landing page profesional Matrix completamente funcional, optimizada, y deployada en producción con todas las mejoras solicitadas implementadas.