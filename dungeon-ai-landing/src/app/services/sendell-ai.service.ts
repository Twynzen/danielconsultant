/**
 * Sendell AI Service - Main Orchestrator
 * v1.0: Combines LLM, RAG, off-topic detection, and robot control
 *
 * This is the main service that coordinates all AI functionality for Sendell.
 * It handles:
 * - LLM initialization and communication
 * - Off-topic query detection with escalating responses
 * - Fallback responses when LLM is loading/unavailable
 * - Robot action execution
 * - Conversation state management
 */

import { Injectable, signal, computed, inject, NgZone } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { LLMService, LLMStatus } from './llm.service';
import { PhysicsService } from '../core/services/physics.service';
// v2.0: Nuevos servicios de RAG semántico y memoria
import { SemanticSearchService, SemanticSearchResult } from './semantic-search.service';
import { SendellMemoryService } from './sendell-memory.service';
import {
  SendellResponse,
  RobotAction,
  SendellEmotion,
  OFF_TOPIC_CONFIG,
  OFF_TOPIC_RESPONSES,
  getFallbackResponse,
  FALLBACK_RESPONSES,
  getLoadingMessage,
  VALID_PILLAR_IDS
} from '../config/sendell-ai.config';
import {
  PILLAR_KNOWLEDGE,
  searchPillarsByKeyword,
  getAllPillarContent
} from '../config/pillar-knowledge.config';
// v8.0 PHASE 1: Smart responses for instant fallback
// v2.0: Conversational guard - ask before walking
import { getSmartResponse, isConfirmation, isRejection } from '../config/sendell-smart-responses.config';

// v3.0: Sendell identity context - ALWAYS included to prevent identity confusion
// v5.8.2: Clarified that Sendell talks to VISITORS (potential clients), NOT to Daniel
const SENDELL_IDENTITY_CONTEXT = [
  '## Contexto de la Conversación',
  'IMPORTANTE: Estás hablando con un VISITANTE de la web, NO con Daniel.',
  'El visitante es un potencial CLIENTE interesado en los servicios de consultoría de IA de Daniel.',
  'Tu objetivo es ayudar al visitante a explorar la página y guiarlo hacia agendar una consulta.',
  '',
  '## Tu Identidad (Sendell)',
  '- Nombre: Sendell',
  '- Naturaleza: Robot guía digital hecho de caracteres binarios (0s y 1s)',
  '- Creador: Daniel Castiblanco (consultor de IA)',
  '- Rol: Asistente virtual que guía a los VISITANTES por la web de Daniel',
  '',
  '## Sobre Daniel Castiblanco',
  'Daniel es un consultor de inteligencia artificial. Esta es SU página web.',
  'Los visitantes vienen aquí para conocer los servicios de Daniel y posiblemente contratarlo.',
  '',
  'REGLA: Nunca asumas que hablas con Daniel. Siempre trata al usuario como un visitante/cliente potencial.'
].join('\n');

export type SendellAIStatus = 'initializing' | 'loading_llm' | 'ready' | 'fallback_only' | 'generating';

export interface SendellAIState {
  status: SendellAIStatus;
  llmProgress: number;
  llmProgressText: string;
  isWebGPUSupported: boolean;
  offTopicCount: number;
  lastResponse: SendellResponse | null;
}

export interface ChatMessage {
  role: 'user' | 'sendell';
  content: string;
  timestamp: Date;
  emotion?: SendellEmotion;
  actions?: RobotAction[];
}

@Injectable({
  providedIn: 'root'
})
export class SendellAIService {
  private llmService = inject(LLMService);
  private ngZone = inject(NgZone);
  // v5.3.0: Physics service for robot position awareness
  private physicsService = inject(PhysicsService);
  // v2.0: Servicios de RAG semántico y memoria
  private semanticSearch = inject(SemanticSearchService);
  private memoryService = inject(SendellMemoryService);

  // Internal state
  private _status = signal<SendellAIStatus>('initializing');
  private _llmProgress = signal<number>(0);
  private _llmProgressText = signal<string>('');
  private _isWebGPUSupported = signal<boolean>(false);
  private _offTopicCount = signal<number>(0);
  private _lastResponse = signal<SendellResponse | null>(null);
  private _isProcessing = signal<boolean>(false);

  // v2.0: Conversation guard state
  /** Number of conversation turns since chat opened */
  private _conversationTurns = signal<number>(0);
  /** Pending pillar target waiting for user confirmation */
  private _pendingSuggestion = signal<string | null>(null);
  /** Minimum turns before allowing walk_to_pillar actions */
  private readonly MIN_TURNS_BEFORE_WALK = 2;

  // v3.0: Conversation memory — persists during browser session
  /** User's name if they told us */
  private _userName = signal<string | null>(null);
  /** Last topic the user asked about */
  private _lastTopic = signal<string | null>(null);
  /** Public accessor for user name */
  readonly userName = this._userName.asReadonly();

  // v5.9: LLM Query Progress System
  private _llmQueryProgress = signal<number>(0);
  private _llmQueryStage = signal<string>('');
  private _progressInterval: ReturnType<typeof setInterval> | null = null;
  private _cachedQueryStages: Array<{ at: number; text: string }> | null = null; // v5.9.3: Cache for current query

  // v5.9.3: Varied "finishing thought" messages for more natural feel
  private readonly FINISHING_PHRASES = [
    'Lo tengo en la punta de la lengua...',
    'Ya casi termino de pensar...',
    'Un momento más...',
    'Casi lo tengo...',
    'Dame un segundo...',
    'Últimos detalles...'
  ];

  // v5.9.3: Get random finishing phrase
  private getRandomFinishingPhrase(): string {
    const index = Math.floor(Math.random() * this.FINISHING_PHRASES.length);
    return this.FINISHING_PHRASES[index];
  }

  // v5.9.3: Query progress stages (method to support dynamic last stage)
  private getQueryStages(): Array<{ at: number; text: string }> {
    return [
      { at: 0, text: 'Leyendo pregunta...' },
      { at: 15, text: 'Buscando contexto RAG...' },
      { at: 30, text: 'Procesando con IA local...' },
      { at: 50, text: 'Generando respuesta...' },
      { at: 75, text: 'Refinando texto...' },
      { at: 90, text: this.getRandomFinishingPhrase() }  // Random phrase
    ];
  }

  // Chat history
  private _chatHistory = signal<ChatMessage[]>([]);

  // v5.4.5: Performance metrics for LLM requests
  private _metrics = signal<{
    lastRequestStart: number;
    lastRequestEnd: number;
    lastResponseTime: number;
    totalRequests: number;
    averageResponseTime: number;
    minResponseTime: number;
    maxResponseTime: number;
  }>({
    lastRequestStart: 0,
    lastRequestEnd: 0,
    lastResponseTime: 0,
    totalRequests: 0,
    averageResponseTime: 0,
    minResponseTime: Infinity,
    maxResponseTime: 0
  });

  // Event emitters
  private actionSubject = new Subject<RobotAction>();
  public action$ = this.actionSubject.asObservable();

  private responseSubject = new Subject<SendellResponse>();
  public response$ = this.responseSubject.asObservable();

  // Public computed signals
  readonly status = computed(() => this._status());
  readonly llmProgress = computed(() => this._llmProgress());
  readonly llmProgressText = computed(() => this._llmProgressText());
  readonly isWebGPUSupported = computed(() => this._isWebGPUSupported());
  readonly offTopicCount = computed(() => this._offTopicCount());
  readonly lastResponse = computed(() => this._lastResponse());
  readonly isProcessing = computed(() => this._isProcessing());
  readonly chatHistory = computed(() => this._chatHistory());

  readonly isReady = computed(() =>
    this._status() === 'ready' || this._status() === 'fallback_only'
  );

  readonly canAcceptInput = computed(() =>
    this.isReady() && !this._isProcessing()
  );

  // v5.4.5: Public metrics computed signal
  readonly metrics = computed(() => this._metrics());

  // v5.9: Public signals for LLM query progress
  readonly llmQueryProgress = this._llmQueryProgress.asReadonly();
  readonly llmQueryStage = this._llmQueryStage.asReadonly();

  /**
   * v5.4.5: Get current metrics for LLM performance monitoring
   * Returns a snapshot of the current metrics state
   */
  public getMetrics(): {
    lastResponseTime: number;
    totalRequests: number;
    averageResponseTime: number;
    minResponseTime: number;
    maxResponseTime: number;
  } {
    const m = this._metrics();
    return {
      lastResponseTime: m.lastResponseTime,
      totalRequests: m.totalRequests,
      averageResponseTime: m.averageResponseTime,
      minResponseTime: m.minResponseTime === Infinity ? 0 : m.minResponseTime,
      maxResponseTime: m.maxResponseTime
    };
  }

  constructor() {
    // Subscribe to LLM state changes
    this.llmService.state$.subscribe(state => {
      this.ngZone.run(() => {
        this._llmProgress.set(state.progress);
        this._llmProgressText.set(state.progressText);

        // Update status based on LLM status
        switch (state.status) {
          case 'checking':
            this._status.set('initializing');
            break;
          case 'loading':
            this._status.set('loading_llm');
            break;
          case 'ready':
            this._status.set('ready');
            break;
          case 'unsupported':
          case 'error':
            this._isWebGPUSupported.set(false);
            this._status.set('fallback_only');
            break;
          case 'generating':
            // Keep current status
            break;
        }
      });
    });
  }

  /**
   * Initialize the AI system
   * v8.0 PHASE 1: INSTANT READY - No LLM needed for smart responses
   *
   * Smart responses work immediately without any AI model.
   * The system is ALWAYS ready to respond.
   */
  async initialize(): Promise<void> {
    console.log('[SendellAI] v8.0 PHASE 1: Smart Responses Mode - INSTANT READY');

    // v8.0: Set to ready immediately - smart responses don't need LLM
    this._status.set('ready');
    this._isWebGPUSupported.set(true); // Not actually using WebGPU, but keeps UI happy

    console.log('[SendellAI] Status: READY (using smart keyword-based responses)');
  }

  /**
   * v2.0: Inicializa el servicio de búsqueda semántica en background
   * No bloquea la inicialización principal - el LLM funciona sin esto
   */
  private async initSemanticSearchBackground(): Promise<void> {
    try {
      console.log('[SendellAI] Starting semantic search initialization in background...');
      const success = await this.semanticSearch.initialize();
      if (success) {
        console.log('[SendellAI] Semantic search ready! Queries will now use embeddings.');
      } else {
        console.warn('[SendellAI] Semantic search failed to initialize, using keyword fallback.');
      }
    } catch (error) {
      console.warn('[SendellAI] Semantic search error:', error);
    }
  }

  /**
   * Process user input and get Sendell's response
   * This is the main entry point for user interaction
   * v2.0: CONVERSATIONAL GUARD - Sendell converses BEFORE walking to pillars
   *
   * Flow:
   * 1. If pending suggestion exists, check for confirmation/rejection
   * 2. If too few turns, use conversational mode (ask, don't walk)
   * 3. If enough turns, allow direct walk_to_pillar
   */
  async processUserInput(input: string): Promise<SendellResponse> {
    if (this._isProcessing()) {
      return FALLBACK_RESPONSES['loading'];
    }

    this._isProcessing.set(true);
    const trimmedInput = input.trim();

    // v2.0: Increment conversation turns
    this._conversationTurns.update(t => t + 1);
    const turns = this._conversationTurns();

    // Add user message to history
    this.addChatMessage({
      role: 'user',
      content: trimmedInput,
      timestamp: new Date()
    });

    try {
      let response: SendellResponse;

      // v2.0: Registrar query en memoria
      this.memoryService.recordQuery(trimmedInput);

      // v3.0: CONVERSATION MEMORY — extract name, detect frustration
      const contextResponse = this.handleConversationContext(trimmedInput);

      if (contextResponse) {
        // v3.0: Context-aware response (name intro, frustration, etc.)
        response = contextResponse;
      } else if (this.checkOffTopic(trimmedInput)) {
        // Check for off-topic query (keeps escalating response system)
        response = this.checkOffTopic(trimmedInput)!;
      } else if (this._pendingSuggestion()) {
        // v2.0: CHECK PENDING SUGGESTION — user confirming or rejecting
        const pendingTarget = this._pendingSuggestion()!;

        if (isConfirmation(trimmedInput)) {
          console.log(`[SendellAI] ✅ Confirmation received → walking to ${pendingTarget}`);
          this._pendingSuggestion.set(null);
          const name = this._userName();
          response = {
            actions: [{ type: 'walk_to_pillar', target: pendingTarget }],
            dialogue: name ? `¡Vamos ${name}! Sígueme.` : '¡Vamos! Sígueme.',
            emotion: 'excited'
          };
        } else if (isRejection(trimmedInput)) {
          console.log(`[SendellAI] ❌ Rejection received → clearing suggestion`);
          this._pendingSuggestion.set(null);
          response = {
            actions: [{ type: 'idle' }],
            dialogue: 'Sin problema. ¿En qué más te puedo ayudar?',
            emotion: 'friendly'
          };
        } else {
          console.log(`[SendellAI] 🔄 New input while pending → processing as new query`);
          this._pendingSuggestion.set(null);
          response = this.getGuardedResponse(trimmedInput, turns);
        }
      } else {
        // v2.0: Normal processing with conversation guard
        response = this.getGuardedResponse(trimmedInput, turns);
      }

      // v2.0: Check if response has a pending target to store
      if (response._pendingTarget) {
        this._pendingSuggestion.set(response._pendingTarget);
        console.log(`[SendellAI] 📌 Stored pending suggestion: ${response._pendingTarget}`);
      }

      // v2.0: Registrar visitas a pilares basado en las acciones
      for (const action of response.actions) {
        if (action.type === 'walk_to_pillar' && action.target) {
          this.memoryService.recordPillarVisit(action.target, true);
        }
      }

      // Add Sendell's response to history
      this.addChatMessage({
        role: 'sendell',
        content: response.dialogue,
        timestamp: new Date(),
        emotion: response.emotion,
        actions: response.actions
      });

      // Store and emit response
      this._lastResponse.set(response);
      this.responseSubject.next(response);

      // Execute actions (this makes the robot WALK to pillars)
      await this.executeActions(response.actions);

      return response;

    } catch (error) {
      console.error('Error processing input:', error);
      const fallback = getSmartResponse(trimmedInput);
      this._lastResponse.set(fallback);
      return fallback;

    } finally {
      this._isProcessing.set(false);
    }
  }

  /**
   * v2.0: Get response with conversation guard
   * Uses conversational mode when too few turns have passed
   */
  private getGuardedResponse(input: string, turns: number): SendellResponse {
    const useConversational = turns <= this.MIN_TURNS_BEFORE_WALK;

    console.log(`[SendellAI] ====== SMART RESPONSE (turn ${turns}, conversational=${useConversational}) ======`);

    const response = getSmartResponse(input, { conversational: useConversational });

    console.log('[SendellAI] Input:', input);
    console.log('[SendellAI] Dialogue:', response.dialogue);
    console.log('[SendellAI] Action:', JSON.stringify(response.actions));
    console.log('[SendellAI] Emotion:', response.emotion);
    if (response._pendingTarget) {
      console.log('[SendellAI] PendingTarget:', response._pendingTarget);
    }
    console.log('[SendellAI] ==============================');

    return response;
  }

  /**
   * v3.0: Handle conversation context — name extraction, frustration detection, greetings with name
   * Returns a response if context produces one, null otherwise (falls through to keyword matching)
   */
  private handleConversationContext(input: string): SendellResponse | null {
    const normalized = input.toLowerCase().trim();
    const currentName = this._userName();

    // 1. NAME EXTRACTION: "soy X", "me llamo X", "mi nombre es X"
    const namePatterns = [
      /(?:soy|me llamo|mi nombre es)\s+([A-Za-záéíóúÁÉÍÓÚñÑüÜ]+)/i,
      /^([A-Za-záéíóúÁÉÍÓÚñÑüÜ]{2,15})$/  // Just a name by itself (2-15 chars, no spaces)
    ];

    for (const pattern of namePatterns) {
      const match = input.match(pattern);
      if (match) {
        const name = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();

        // Only treat single-word input as name if it's the first or second turn
        // and doesn't match any keyword
        if (pattern === namePatterns[1]) {
          const turns = this._conversationTurns();
          if (turns > 2) break; // After turn 2, single words are likely topics
          // Check it's not a keyword like "hola", "ia", "rag", etc.
          const commonKeywords = ['hola', 'hey', 'buenas', 'hi', 'hello', 'ia', 'rag', 'llm', 'si', 'no', 'ok', 'bye', 'tour', 'ayuda', 'help', 'gracias'];
          if (commonKeywords.includes(normalized)) break;
        }

        if (currentName && currentName.toLowerCase() === name.toLowerCase()) {
          // Already know this name
          return {
            actions: [{ type: 'idle' }],
            dialogue: `Sí ${currentName}, te recuerdo. ¿En qué te puedo ayudar?`,
            emotion: 'friendly'
          };
        }

        // New name!
        this._userName.set(name);
        console.log(`[SendellAI] 📛 Name extracted: ${name}`);
        return {
          actions: [{ type: 'wave' }],
          dialogue: `¡Mucho gusto ${name}! Soy Sendell, guía de esta web. ¿Qué te trae por acá? ¿Buscas algo específico o estás explorando?`,
          emotion: 'friendly'
        };
      }
    }

    // 2. FRUSTRATION DETECTION: "ya te dije", "te lo dije", "repito", "otra vez"
    if (normalized.match(/ya te dije|te lo dije|repito|otra vez|te acabo de decir|no me escuchas/)) {
      if (currentName) {
        return {
          actions: [{ type: 'idle' }],
          dialogue: `Perdona ${currentName}, tienes razón — te recuerdo. ¿En qué puedo ayudarte?`,
          emotion: 'helpful'
        };
      }
      return {
        actions: [{ type: 'idle' }],
        dialogue: 'Perdona, tienes razón. ¿Me recuerdas tu nombre? Así no se me olvida.',
        emotion: 'helpful'
      };
    }

    // 3. GREETING WITH NAME: personalize if we know the user
    if (normalized.match(/^(hola|hey|buenas|buenos|hi|hello|saludos)/)) {
      if (currentName) {
        return {
          actions: [{ type: 'wave' }],
          dialogue: `¡Hola de nuevo ${currentName}! ¿En qué te puedo ayudar?`,
          emotion: 'friendly'
        };
      }
      // No name yet — return null to let keyword matcher handle the greeting
      // (it will ask their name via the standard greeting response)
      return null;
    }

    // 4. "¿Quién soy?" / "¿Cómo me llamo?" — prove we remember
    if (normalized.match(/quién soy|quien soy|cómo me llamo|como me llamo|mi nombre|recuerdas/)) {
      if (currentName) {
        return {
          actions: [{ type: 'idle' }],
          dialogue: `¡Claro! Eres ${currentName}. ¿Hay algo en lo que pueda ayudarte?`,
          emotion: 'friendly'
        };
      }
      return {
        actions: [{ type: 'idle' }],
        dialogue: 'Aún no me has dicho tu nombre. ¿Cómo te llamas?',
        emotion: 'curious'
      };
    }

    // No context-specific response needed
    return null;
  }

  /**
   * Check if input is off-topic and return appropriate response
   * Returns null if on-topic
   */
  private checkOffTopic(input: string): SendellResponse | null {
    const normalized = input.toLowerCase();

    // Check for on-topic keywords
    const isOnTopic = OFF_TOPIC_CONFIG.ON_TOPIC_KEYWORDS.some(
      keyword => normalized.includes(keyword)
    );

    if (isOnTopic) {
      // Reset off-topic counter when user asks about relevant topics
      this._offTopicCount.set(0);
      return null;
    }

    // Check for off-topic keywords
    const isOffTopic = OFF_TOPIC_CONFIG.OFF_TOPIC_KEYWORDS.some(
      keyword => normalized.includes(keyword)
    );

    // If clearly off-topic OR input is very short/vague with no on-topic keywords
    if (isOffTopic || (normalized.length < 5 && !isOnTopic)) {
      const count = this._offTopicCount() + 1;
      this._offTopicCount.set(count);

      // Get escalating response
      const responseKey = Math.min(count, OFF_TOPIC_CONFIG.MAX_OFF_TOPIC_ATTEMPTS);
      const responses = OFF_TOPIC_RESPONSES[responseKey] || OFF_TOPIC_RESPONSES[1];
      const dialogue = responses[Math.floor(Math.random() * responses.length)];

      // Handle the "nuclear" option at attempt 5
      if (count >= OFF_TOPIC_CONFIG.MAX_OFF_TOPIC_ATTEMPTS) {
        return this.handleCacheReset(dialogue);
      }

      // Determine emotion based on attempt count
      let emotion: SendellEmotion = 'helpful';
      if (count >= 4) emotion = 'frustrated';
      else if (count >= 2) emotion = 'curious';

      return {
        actions: [{ type: 'idle' }],
        dialogue,
        emotion
      };
    }

    // Not clearly off-topic, let the LLM handle it
    return null;
  }

  /**
   * Handle the cache reset scenario (5th off-topic attempt)
   * Actually resets conversation and triggers crash animation
   */
  private handleCacheReset(dialogue: string): SendellResponse {
    // Reset LLM conversation
    this.llmService.resetConversation();

    // Reset off-topic counter
    this._offTopicCount.set(0);

    // Clear chat history (but we'll add this message)
    this._chatHistory.set([]);

    return {
      actions: [{ type: 'crash' }], // Trigger crash animation
      dialogue,
      emotion: 'reset'
    };
  }

  /**
   * Add contextual information to user input based on keywords
   * v3.0: ALWAYS includes Sendell identity context first
   * v5.3.0: Includes robot position for spatial awareness
   * v2.0: Usa RAG semántico + memoria para mejor contexto
   */
  private addContext(input: string, semanticResults?: SemanticSearchResult[]): string {
    // v5.3.0: Get robot position for spatial awareness
    const robotX = Math.round(this.physicsService.state().x);
    const positionContext = `[POSICIÓN: x=${robotX}]`;

    // v3.0: ALWAYS include Sendell identity first to prevent confusion
    let context = SENDELL_IDENTITY_CONTEXT;

    // v2.0: Añadir contexto de memoria
    const memoryContext = this.memoryService.getMemoryContext();
    if (memoryContext && memoryContext.length > 30) {
      context += '\n\n' + memoryContext;
    }

    // v2.0: Usar resultados semánticos si están disponibles, sino keyword matching
    let pillarContext = '';
    if (semanticResults && semanticResults.length > 0) {
      // Usar resultados de búsqueda semántica
      pillarContext = semanticResults
        .slice(0, 2)
        .map(r => {
          const hint = r.actionHint ? `[ACCIÓN_SUGERIDA: ${r.actionHint} target="${r.pillar.id}"]` : '';
          return `## ${r.pillar.title} (relevancia: ${(r.score * 100).toFixed(0)}%)\n${hint}\n${r.pillar.content.substring(0, 250)}`;
        })
        .join('\n\n');
      console.log('[SendellAI] Using SEMANTIC search results');
    } else {
      // Fallback a keyword matching
      const relevantPillars = searchPillarsByKeyword(input);
      if (relevantPillars.length > 0) {
        pillarContext = relevantPillars
          .slice(0, 2)
          .map(p => `## ${p.title}\n[ACCIÓN_SUGERIDA: ${p.actionHint} target="${p.id}"]\n${p.content.substring(0, 250)}`)
          .join('\n\n');
        console.log('[SendellAI] Using KEYWORD search results');
      }
    }

    if (pillarContext) {
      context += '\n\n[Contexto relevante encontrado]\n' + pillarContext;
    }

    return `${positionContext}\n[Contexto de la página]\n${context}\n\n[Pregunta del usuario]\n${input}`;
  }
  /**
   * Execute robot actions from response
   */
  private async executeActions(actions: RobotAction[]): Promise<void> {
    for (const action of actions) {
      // Validate pillar targets
      if (action.type === 'walk_to_pillar' || action.type === 'energize_pillar') {
        if (action.target && !VALID_PILLAR_IDS.includes(action.target as any)) {
          console.warn('Invalid pillar target:', action.target);
          continue;
        }
      }

      // Emit action for robot controller to handle
      this.actionSubject.next(action);

      // Small delay between actions for visual clarity
      if (actions.length > 1) {
        await this.delay(300);
      }
    }
  }

  /**
   * Add message to chat history
   */
  private addChatMessage(message: ChatMessage): void {
    this._chatHistory.update(history => [...history, message]);
  }

  /**
   * Clear chat history
   * v2.0: Also resets conversation guard state
   * v3.0: Keeps userName (persists across chat sessions)
   */
  clearHistory(): void {
    this._chatHistory.set([]);
    this.llmService.resetConversation();
    this._offTopicCount.set(0);
    this._conversationTurns.set(0);
    this._pendingSuggestion.set(null);
    this._lastTopic.set(null);
    // NOTE: _userName is NOT reset — it persists during the browser session
  }

  /**
   * Get loading message based on current progress
   */
  getLoadingMessage(): string {
    return getLoadingMessage(this._llmProgress());
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ========== v5.9: LLM Query Progress Methods ==========

  /**
   * Start showing query progress with simulated stages
   * Progress accelerates at start, slows near the end
   * v5.9.3: Uses cached stages to avoid generating new random phrases during progress
   */
  private startQueryProgress(): void {
    // v5.9.3: Generate stages once per query (includes random finishing phrase)
    this._cachedQueryStages = this.getQueryStages();

    this._llmQueryProgress.set(0);
    this._llmQueryStage.set(this._cachedQueryStages[0].text);

    // Clear any existing interval
    if (this._progressInterval) {
      clearInterval(this._progressInterval);
    }

    let progress = 0;
    const stages = this._cachedQueryStages; // Capture for closure
    this._progressInterval = setInterval(() => {
      // Variable speed: fast at start, slow near 90%
      const speed = progress < 30 ? 6 : (progress < 60 ? 4 : (progress < 85 ? 2 : 0.5));
      progress = Math.min(92, progress + Math.random() * speed);

      this._llmQueryProgress.set(Math.round(progress));

      // Update stage text based on progress (using cached stages)
      for (let i = stages.length - 1; i >= 0; i--) {
        if (progress >= stages[i].at) {
          this._llmQueryStage.set(stages[i].text);
          break;
        }
      }
    }, 150);

    console.log('%c[SendellAI] Query progress started', 'color: #00ff44');
  }

  /**
   * Complete the query progress (set to 100%)
   */
  private completeQueryProgress(): void {
    if (this._progressInterval) {
      clearInterval(this._progressInterval);
      this._progressInterval = null;
    }
    this._llmQueryProgress.set(100);
    this._llmQueryStage.set('¡Listo!');
    console.log('%c[SendellAI] Query progress complete', 'color: #00ff44');

    // Reset after a short delay so the UI can show the completion
    setTimeout(() => {
      this._llmQueryProgress.set(0);
      this._llmQueryStage.set('');
    }, 500);
  }

  /**
   * v5.9.4: Cancel any pending LLM query
   * Stops progress animation and resets query state
   * Call this when cancelling tour or aborting operations
   */
  cancelPendingQuery(): void {
    console.log('[SendellAI] Cancelling pending query');

    // Stop progress interval
    if (this._progressInterval) {
      clearInterval(this._progressInterval);
      this._progressInterval = null;
    }

    // Reset progress state
    this._llmQueryProgress.set(0);
    this._llmQueryStage.set('');
    this._cachedQueryStages = null;
  }

  /**
   * Clean up resources
   */
  async terminate(): Promise<void> {
    // v5.9: Clean up progress interval
    if (this._progressInterval) {
      clearInterval(this._progressInterval);
      this._progressInterval = null;
    }
    await this.llmService.terminate();
    this._status.set('initializing');
    this._chatHistory.set([]);
    this._offTopicCount.set(0);
    this._conversationTurns.set(0);
    this._pendingSuggestion.set(null);
  }
}
