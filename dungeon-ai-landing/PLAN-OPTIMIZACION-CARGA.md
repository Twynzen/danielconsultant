# Plan de Optimización de Carga - Sendell Landing

## Problema Actual

La barra de progreso actual es **FALSA** - basada en tiempo (3.5s), no en descargas reales.
Cuando llega a 100%, si el LLM no está listo, la app se queda congelada sin feedback.

### Análisis del Sistema Actual

```
FLUJO ACTUAL:
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  DARKNESS   │ ──► │   LOADING   │ ──► │  ONBOARDING │
│   (breve)   │     │ (3.5s fake) │     │ (pre-escrito)│
└─────────────┘     └─────────────┘     └─────────────┘
                          │
                    IA se descarga AQUÍ
                    (~700MB WebLLM)
                    Usuario espera congelado
```

### Insight Clave (Confirmado)

Durante el onboarding hay **~10 diálogos pre-escritos** que toman ~25-30 segundos:
- `PRE_SPAWN_DIALOGS`: 2 mensajes
- `PRESENTATION_DIALOGS`: 3 mensajes
- `CHOICE_DIALOG`: 1 prompt Y/N
- `FREE_MODE_DIALOGS`: 4 mensajes

**NINGUNO usa IA** - todos están en `onboarding.config.ts` como texto estático.

La IA (WebLLM) solo se necesita cuando:
1. Usuario hace double-tap en robot DESPUÉS del onboarding
2. `isChatMode() === true` (solo después de completar onboarding)

---

## Solución Propuesta

### Nueva Arquitectura de Carga

```
FLUJO OPTIMIZADO:
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  DARKNESS   │ ──► │   LOADING   │ ──► │  ONBOARDING │
│   (breve)   │     │ (rápido)    │     │ (pre-escrito)│
└─────────────┘     └─────────────┘     └─────────────┘
                          │                    │
                    Solo assets Angular   IA descarga en
                    (instantáneo)         BACKGROUND aquí
                                          (~700MB pero
                                           usuario no espera)
```

### Fases de Implementación

#### Fase 1: Loading Instantáneo (Assets Angular)

**Objetivo**: La pantalla de loading solo espera los assets de Angular, no la IA.

**Cambios en `onboarding.service.ts`:**

```typescript
// ANTES (línea ~225):
const minDuration = 3500; // Fake 3.5s wait
const timeProgress = Math.min((elapsed / minDuration) * 100, 100);

// DESPUÉS:
// Sin espera artificial - transición inmediata cuando Angular está listo
private async runLoadingPhase(): Promise<void> {
  // Solo esperar a que los assets de la app estén listos
  // NO esperar al LLM
  await this.ensureMinimalAssetsLoaded();
  this.completeLoadingPhase();
}
```

#### Fase 2: Descarga de IA en Background Durante Onboarding

**Objetivo**: Iniciar descarga de WebLLM cuando empieza el onboarding (no antes).

**Nuevo servicio `background-loader.service.ts`:**

```typescript
@Injectable({ providedIn: 'root' })
export class BackgroundLoaderService {
  private downloadProgress = signal<DownloadProgress>({
    isDownloading: false,
    currentFile: '',
    fileProgress: 0,
    totalProgress: 0,
    estimatedTimeRemaining: null
  });

  // Iniciar descarga cuando empieza onboarding
  async startBackgroundDownload(): Promise<void> {
    // 1. Primero embeddings (pequeño, ~23MB)
    await this.downloadEmbeddings();

    // 2. Luego LLM (grande, ~700MB)
    await this.downloadLLM();
  }
}
```

**Integración en `onboarding.service.ts`:**

```typescript
private async startPresentationPhase(): Promise<void> {
  // Iniciar descarga en background (no bloquea)
  this.backgroundLoader.startBackgroundDownload();

  // Continuar con diálogos pre-escritos (no necesitan IA)
  await this.showPreSpawnDialogs();
  await this.showPresentationDialogs();
  // ... etc
}
```

#### Fase 3: Indicador de Progreso Sutil (No Intrusivo)

**Objetivo**: Mostrar progreso real de descarga SIN bloquear la experiencia.

**Opciones de UI:**

1. **Indicador en esquina inferior**: Pequeña barra que muestra "Descargando IA..."
2. **En el robot Sendell**: Aura o partículas que indican "cargando poderes"
3. **Tooltip sutil**: Al hacer hover en robot muestra progreso

**Implementación sugerida (opción 2 - más inmersiva):**

```typescript
// En binary-character.component.ts o flame-head-character.component.ts
@Input() aiLoadingProgress: number = 0; // 0-100

// Visual: partículas verdes más intensas mientras descarga
// Cuando llega a 100%, efecto de "power up" completado
```

#### Fase 4: Manejo de Chat Pre-IA

**Objetivo**: Si usuario intenta chatear antes de que IA esté lista, feedback claro.

```typescript
// En sendell-dialog.component.ts
async handleUserMessage(message: string): Promise<void> {
  if (!this.llmService.isReady()) {
    // Mostrar mensaje amigable, no error
    this.showTypingMessage(
      "Un momento... estoy cargando mis capacidades de IA (" +
      this.backgroundLoader.totalProgress() + "%)..."
    );

    // Esperar a que termine
    await this.backgroundLoader.waitForCompletion();
  }

  // Continuar con chat normal
  await this.processWithAI(message);
}
```

---

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `onboarding.service.ts` | Remover espera fake, iniciar descarga en background |
| `llm.service.ts` | Exponer método para iniciar descarga separado de inicialización |
| `semantic-search.service.ts` | Exponer método para descarga separada |
| `sendell-dialog.component.ts` | Manejar caso donde IA no está lista |
| `flame-head-character.component.ts` | Indicador visual de carga (opcional) |
| **NUEVO** `background-loader.service.ts` | Coordinar descargas en background |

---

## Beneficios

1. **Carga inicial instantánea**: De ~5-10s a <1s
2. **Sin pantalla congelada**: Usuario siempre ve progreso o interacción
3. **Mejor UX**: La presentación de Sendell no se siente como "espera"
4. **Descarga real**: El usuario sabe qué está pasando
5. **Graceful degradation**: Si IA tarda, el usuario puede seguir explorando

---

## Riesgos y Mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| Usuario termina onboarding antes de que IA descargue | Mensaje amigable + espera corta |
| Conexión lenta | Indicador de progreso real + estimación de tiempo |
| Error de descarga | Retry automático + mensaje claro |
| Memoria en mobile | Detectar dispositivo, ajustar modelo si necesario |

---

## Orden de Implementación

1. **Crear `background-loader.service.ts`** - Servicio central de descargas
2. **Modificar `onboarding.service.ts`** - Remover fake progress, integrar background loader
3. **Modificar `llm.service.ts`** - Exponer descarga separada
4. **Modificar `sendell-dialog.component.ts`** - Manejar chat pre-IA
5. **Opcional: Indicador visual en robot** - UX mejorada

---

## Tiempo Estimado de Implementación

No aplica - se implementará según disponibilidad.

---

**Autor**: Claude Code
**Fecha**: Enero 15, 2026
**Versión**: 1.0
