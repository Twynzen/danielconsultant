# Plan de Entendimiento y Mejora del Flujo de Carga - v2.0

## 1. ANÁLISIS DEL PROBLEMA ACTUAL

### Lo que vemos en CAPTURA.png:
```
┌─────────────────────────────────────────────────────┐
│  // SENDELL                          [IA: 20%]     │  ← Header muestra 20%
│                                                     │
│  Cargando conocimiento sobre Daniel...              │  ← OLD: llmLoadingText()
│  ████████░░░░░░░░░░░░░░░░░░░░░░░░░                  │  ← OLD: progress bar
│                                                     │
│  IA lista!...                                       │  ← TYPED: displayedText()
│            ^^^                                      │
│           (dots = typewriter effect activo)         │
└─────────────────────────────────────────────────────┘
```

### Problemas identificados:
1. **CONFLICTO**: Header dice 20% pero texto dice "IA lista!"
2. **DOS SISTEMAS**: `backgroundLoader` vs `sendellAI/llmService` corriendo en paralelo
3. **UI CONFUSA**: 3 indicadores diferentes (header, loading bar, texto)
4. **RACE CONDITION**: Múltiples lugares llaman `llmService.initialize()`

---

## 2. MAPEO DEL FLUJO ACTUAL

### 2.1 Puntos de entrada que inicializan LLM:

```
                    ┌─────────────────────────────────────┐
                    │     INICIALIZACIONES DE LLM         │
                    └─────────────────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        │                           │                           │
        ▼                           ▼                           ▼
┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│ backgroundLoader │    │   sendellAI      │    │  onboarding      │
│ .startBackground │    │  .initialize()   │    │ .startLLM        │
│   Download()     │    │                  │    │  Preloading()    │
└────────┬─────────┘    └────────┬─────────┘    └────────┬─────────┘
         │                       │                       │
         │ llmService           │ llmService            │ llmService
         │ .initialize()        │ .initialize()         │ .initialize()
         │                       │                       │
         └───────────────────────┴───────────────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────────────────┐
                    │    MISMO LLM SERVICE!               │
                    │    (race condition)                 │
                    └─────────────────────────────────────┘
```

### 2.2 Cuándo se llama cada uno:

| Iniciador | Cuándo se llama | Archivo:Línea |
|-----------|-----------------|---------------|
| `backgroundLoader.startBackgroundDownload()` | PRESENTATION phase | onboarding.service.ts:372 |
| `sendellAI.initialize()` | enterChatMode() | sendell-dialog.component.ts:964 |
| `sendellAI.initialize()` | hideDialogAfterFarewell() | sendell-dialog.component.ts:1355 |
| `sendellAI.initialize()` | hideDialogAfterFreeMode() | sendell-dialog.component.ts:1468 |
| `sendellAI.initialize()` | cancelTourWithMessage() | sendell-dialog.component.ts:1414 |
| `startLLMPreloading()` | (OLD - ya no se usa) | onboarding.service.ts:265 |

### 2.3 Flujo de fases del onboarding:

```
DARKNESS (500ms)
    ↓
LOADING (3.5s) ──────────────────────────────────→ [v7.0: ya no espera LLM]
    ↓
WELCOME (espera tecla)
    ↓
PRE_SPAWN_DIALOG (2 diálogos)
    ↓
SPAWN_ANIMATION (robot aparece)
    ↓
PRESENTATION (3 diálogos) ──────────────────────→ [v7.0: backgroundLoader.start()]
    ↓
CHOICE_PROMPT (Tour? Y/N)
    ↓
    ├──→ TOUR_WAITING_LLM ──→ TOUR_ACTIVE ──→ COMPLETE
    │
    └──→ FREE_MODE (4 diálogos) ──────────────→ COMPLETE
                                                    ↓
                                            [sendellAI.initialize()]
```

---

## 3. DIAGNÓSTICO: ¿POR QUÉ DICE "IA lista!"?

Rastreando el código:

1. **En la captura**: Chat mode está activo (el header muestra "IA: 20%")
2. **"IA lista!"** viene de `displayedText()` siendo escrito con typewriter
3. **Origen probable**: `getStatusMessage()` en background-loader.service.ts:

```typescript
// background-loader.service.ts:219-229
getStatusMessage(): string {
  switch (progress.currentFile) {
    case 'complete':
      return 'IA lista!';  // ← AQUÍ ESTÁ
    // ...
  }
}
```

4. **Pero `currentFile` es 'complete' cuando `totalProgress` = 100**
5. **Y el header muestra 20%...** → CONTRADICCIÓN

### Hipótesis del bug:
- `backgroundLoader.status` se pone en 'ready' prematuramente
- O hay un error en la lógica de `executeDownloads()`
- O `getStatusMessage()` está usando estado incorrecto

---

## 4. SOLUCIÓN PROPUESTA: SISTEMA UNIFICADO

### 4.1 Principio: UNA SOLA FUENTE DE VERDAD

```
┌─────────────────────────────────────────────────────────────────┐
│                    BackgroundLoaderService                       │
│              (ÚNICA fuente de estado de carga)                   │
├─────────────────────────────────────────────────────────────────┤
│  status: 'idle' | 'downloading' | 'ready' | 'error'             │
│  currentFile: 'none' | 'embeddings' | 'llm' | 'complete'        │
│  totalProgress: 0-100                                            │
│  fileProgress: 0-100 (del archivo actual)                        │
│  estimatedTime: string                                           │
│  errorMessage: string | null                                     │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              │                               │
              ▼                               ▼
    ┌──────────────────┐          ┌──────────────────┐
    │   LLM Service    │          │ SemanticSearch   │
    │   (WebLLM)       │          │   (Embeddings)   │
    └──────────────────┘          └──────────────────┘

```

### 4.2 Cambios necesarios:

#### A. `sendellAI.initialize()` - NO inicializa LLM directamente

```typescript
async initialize(): Promise<void> {
  // v7.1: NO llamar a llmService.initialize() directamente
  // Solo configurar el servicio y esperar a que backgroundLoader termine

  // Iniciar búsqueda semántica si no está en backgroundLoader
  // (El backgroundLoader ya maneja esto)

  // Verificar si LLM ya está listo (del backgroundLoader)
  if (this.llmService.isReady) {
    this._status.set('ready');
    return;
  }

  // Si no está listo, el status quedará en 'initializing'
  // y submitChat() esperará al backgroundLoader
}
```

#### B. `submitChat()` - Flujo claro con estados

```typescript
async submitChat(): Promise<void> {
  // Estado 1: Usuario escribe mensaje
  this.displayedText.set('');

  // Estado 2: Verificar si IA está lista
  if (!this.backgroundLoader.isLLMReady()) {
    // Estado 2a: IA no lista - mostrar progreso
    this.showDownloadProgress();

    const ready = await this.backgroundLoader.waitForLLM();

    if (!ready) {
      // Estado 2b: Error - mensaje claro
      this.showError('No pude cargar la IA. Intenta recargar.');
      return;
    }
  }

  // Estado 3: IA lista - procesar
  this.displayedText.set('Pensando...');
  const response = await this.sendellAI.processUserInput(input);

  // Estado 4: Mostrar respuesta
  this.startAITypingAnimation(response.dialogue);
}
```

#### C. UI Unificada - Un solo indicador

```html
<!-- ANTES: Múltiples indicadores confusos -->
@if (isBackgroundDownloading()) { ... }
@else if (isLLMLoading()) { ... }
@else if (isAIFullyReady()) { ... }

<!-- DESPUÉS: Un solo sistema -->
@if (backgroundLoader.status() !== 'ready') {
  <div class="ai-loading-indicator">
    @switch (backgroundLoader.status()) {
      @case ('downloading') {
        <span>{{ backgroundLoader.statusMessage() }}</span>
        <div class="progress-bar" [style.width.%]="backgroundLoader.totalProgress()"></div>
      }
      @case ('error') {
        <span class="error">{{ backgroundLoader.errorMessage() }}</span>
      }
    }
  </div>
}
```

---

## 5. ESCENARIOS DE USUARIO Y RESPUESTAS

### Escenario 1: Usuario llega por primera vez

```
┌─────────────────────────────────────────────────────────────────┐
│  LOADING (3.5s)                                                  │
│  "Inicializando sistemas..."                                     │
│  [████████████████████████████████████████] 100%                │
│                                                                  │
│  → Transición instantánea a WELCOME                             │
└─────────────────────────────────────────────────────────────────┘
```

### Escenario 2: Usuario ve diálogos de presentación

```
┌─────────────────────────────────────────────────────────────────┐
│  // SENDELL                                                      │
│                                                                  │
│  ¡Hola! Soy Sendell, tu guía digital...                         │
│                                                                  │
│  [CUALQUIER TECLA]                                               │
│                                                                  │
│  ───────────────────────────────────────────────────────────────│
│  Descargando IA: ████████░░░░░░░ 45%  [~30s restantes]          │
│  (Puedes continuar explorando)                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Escenario 3: Usuario intenta chatear antes de que IA esté lista

```
┌─────────────────────────────────────────────────────────────────┐
│  // SENDELL                                                      │
│                                                                  │
│  Un momento, estoy cargando mis capacidades de IA...            │
│                                                                  │
│  Descargando modelo de lenguaje...                               │
│  [█████████████████░░░░░░░░░░░░░] 65%                           │
│                                                                  │
│  Tu mensaje: "¿Qué servicios ofrece Daniel?"                    │
│  (Lo responderé cuando termine de cargar)                        │
└─────────────────────────────────────────────────────────────────┘
```

### Escenario 4: IA lista - chat normal

```
┌─────────────────────────────────────────────────────────────────┐
│  // SENDELL                              [✓ IA ACTIVA]          │
│                                                                  │
│  ¡Daniel ofrece servicios de consultoría en IA!                 │
│  Puedo guiarte a los diferentes pilares para que...             │
│                                                                  │
│  > █                                                             │
│                                                                  │
│  [200/200 caracteres]                    [ENTER para enviar]    │
└─────────────────────────────────────────────────────────────────┘
```

### Escenario 5: Error de carga

```
┌─────────────────────────────────────────────────────────────────┐
│  // SENDELL                              [⚠ ERROR]              │
│                                                                  │
│  No pude cargar mis capacidades completas de IA.                │
│  Puedo seguir ayudándote con respuestas básicas,                │
│  pero para una experiencia completa, intenta recargar           │
│  la página.                                                      │
│                                                                  │
│  [RECARGAR PÁGINA]                                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. IMPLEMENTACIÓN PASO A PASO

### Paso 1: Corregir BackgroundLoaderService
- [ ] Asegurar que `currentFile` y `totalProgress` estén sincronizados
- [ ] Agregar logs detallados para debug
- [ ] Verificar que no se ponga 'complete' prematuramente

### Paso 2: Eliminar inicializaciones duplicadas
- [ ] `sendellAI.initialize()` → NO llama `llmService.initialize()`
- [ ] `startLLMPreloading()` → Marcar como deprecated/eliminar
- [ ] Solo `backgroundLoader.startBackgroundDownload()` inicia descargas

### Paso 3: Unificar UI
- [ ] Eliminar sección `llm-loading-section` vieja
- [ ] Crear un indicador de carga consistente en footer
- [ ] El indicador muestra progreso DURANTE el onboarding, no solo en chat

### Paso 4: Mejorar mensajes al usuario
- [ ] Mensajes claros en español
- [ ] Tiempo estimado de descarga
- [ ] Indicación de qué se está descargando (embeddings vs LLM)

### Paso 5: Manejar casos edge
- [ ] Error de red durante descarga
- [ ] Usuario cierra/abre pestaña
- [ ] WebGPU no soportado
- [ ] Memoria insuficiente

---

## 7. CÓDIGO A MODIFICAR

### Archivos principales:
1. `background-loader.service.ts` - Corregir lógica de estados
2. `sendell-ai.service.ts` - Eliminar llamada a `llmService.initialize()`
3. `sendell-dialog.component.ts` - Simplificar lógica de UI
4. `sendell-dialog.component.html` - Unificar indicadores
5. `onboarding.service.ts` - Limpiar código viejo

### Archivos a eliminar/deprecar:
- Método `startLLMPreloading()` en onboarding.service.ts
- Señales `_llmPreloadProgress`, `_llmPreloadText`, etc.
- Sección `llm-loading-section` en HTML

---

## 8. TESTING CHECKLIST

### Flujo normal:
- [ ] Loading completa en ~3.5s
- [ ] Diálogos de onboarding funcionan sin esperar IA
- [ ] Indicador de descarga visible durante onboarding
- [ ] Chat funciona cuando IA está lista

### Casos de error:
- [ ] Sin WebGPU → mensaje claro de fallback
- [ ] Error de red → retry automático o mensaje
- [ ] Usuario cierra tab durante descarga → estado correcto al volver

### Casos edge:
- [ ] Usuario hace double-tap antes de que IA esté lista
- [ ] Usuario escribe mensaje muy largo
- [ ] Usuario cambia de tab y vuelve

---

## 9. CRONOGRAMA DE IMPLEMENTACIÓN

1. **Fase 1**: Diagnosticar y corregir bug actual ("IA lista!" prematuro)
2. **Fase 2**: Unificar sistema de carga (eliminar duplicados)
3. **Fase 3**: Mejorar UI y mensajes
4. **Fase 4**: Testing exhaustivo
5. **Fase 5**: Documentación y cleanup

---

**Siguiente paso**: Implementar Fase 1 - diagnosticar por qué `getStatusMessage()` devuelve "IA lista!" cuando progress está en 20%.
