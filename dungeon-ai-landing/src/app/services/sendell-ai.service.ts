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

  // Internal state
  private _status = signal<SendellAIStatus>('initializing');
  private _llmProgress = signal<number>(0);
  private _llmProgressText = signal<string>('');
  private _isWebGPUSupported = signal<boolean>(false);
  private _offTopicCount = signal<number>(0);
  private _lastResponse = signal<SendellResponse | null>(null);
  private _isProcessing = signal<boolean>(false);

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
   * v2.0: Now checks if LLM is already loading/ready (via OnboardingService preloading)
   */
  async initialize(): Promise<void> {
    // v2.0: Check if LLM is already ready (preloaded during onboarding)
    if (this.llmService.isReady) {
      console.log('LLM already ready (preloaded during onboarding)');
      this._status.set('ready');
      this._isWebGPUSupported.set(true);
      return;
    }

    // v2.0: Check if LLM is currently loading
    const currentState = this.llmService.currentState;
    if (currentState.status === 'loading') {
      console.log('LLM already loading (preloaded during onboarding)');
      this._status.set('loading_llm');
      // Wait for loading to complete
      return new Promise((resolve) => {
        const subscription = this.llmService.state$.subscribe(state => {
          if (state.status === 'ready') {
            this._status.set('ready');
            subscription.unsubscribe();
            resolve();
          } else if (state.status === 'error' || state.status === 'unsupported') {
            this._status.set('fallback_only');
            subscription.unsubscribe();
            resolve();
          }
        });
      });
    }

    this._status.set('initializing');

    // Check WebGPU support first
    const hasWebGPU = await this.llmService.checkWebGPUSupport();
    this._isWebGPUSupported.set(hasWebGPU);

    if (!hasWebGPU) {
      console.warn('WebGPU not supported, running in fallback mode');
      this._status.set('fallback_only');
      return;
    }

    // Start LLM initialization (runs in background)
    this._status.set('loading_llm');

    try {
      await this.llmService.initialize();
      this._status.set('ready');
    } catch (error) {
      console.error('LLM initialization failed:', error);
      this._status.set('fallback_only');
    }
  }

  /**
   * Process user input and get Sendell's response
   * This is the main entry point for user interaction
   * v5.4.5: Added timing metrics for LLM performance monitoring
   */
  async processUserInput(input: string): Promise<SendellResponse> {
    if (this._isProcessing()) {
      return FALLBACK_RESPONSES['loading'];
    }

    this._isProcessing.set(true);
    const trimmedInput = input.trim();

    // v5.4.5: Start timing
    const requestStart = performance.now();

    // Add user message to history
    this.addChatMessage({
      role: 'user',
      content: trimmedInput,
      timestamp: new Date()
    });

    try {
      let response: SendellResponse;
      let usedLLM = false;

      // Check for off-topic query first
      const offTopicResponse = this.checkOffTopic(trimmedInput);
      if (offTopicResponse) {
        response = offTopicResponse;
      }
      // Use LLM if available
      else if (this.llmService.isReady) {
        usedLLM = true;
        // v5.9: Start progress indicator
        this.startQueryProgress();

        // Add context from pillar knowledge
        const contextualInput = this.addContext(trimmedInput);
// v5.6: Detailed LLM request logs
        console.log('[SendellAI] ====== LLM REQUEST ======');
        console.log('[SendellAI] Original input:', trimmedInput);
        console.log('[SendellAI] With context (first 500 chars):', contextualInput.substring(0, 500));

        response = await this.llmService.processInput(contextualInput);

        // v5.9: Complete progress indicator
        this.completeQueryProgress();

        // v5.6: Log LLM response
        console.log('[SendellAI] ====== LLM RESPONSE ======');
        console.log('[SendellAI] Dialogue:', response.dialogue);
        console.log('[SendellAI] Emotion:', response.emotion);
        console.log('[SendellAI] Actions:', JSON.stringify(response.actions));
        console.log('[SendellAI] ==============================');
      }
      // Fallback to keyword matching
      else {
        response = getFallbackResponse(trimmedInput);
      }

      // v5.4.5: Update metrics only for LLM requests
      if (usedLLM) {
        const requestEnd = performance.now();
        const responseTime = requestEnd - requestStart;

        this._metrics.update(m => {
          const newTotalRequests = m.totalRequests + 1;
          const newAverageResponseTime =
            (m.averageResponseTime * m.totalRequests + responseTime) / newTotalRequests;

          return {
            lastRequestStart: requestStart,
            lastRequestEnd: requestEnd,
            lastResponseTime: responseTime,
            totalRequests: newTotalRequests,
            averageResponseTime: newAverageResponseTime,
            minResponseTime: Math.min(m.minResponseTime, responseTime),
            maxResponseTime: Math.max(m.maxResponseTime, responseTime)
          };
        });

        console.log(`[SendellAI] Response time: ${responseTime.toFixed(2)}ms | Avg: ${this._metrics().averageResponseTime.toFixed(2)}ms | Total: ${this._metrics().totalRequests}`);
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

      // Execute actions
      await this.executeActions(response.actions);

      return response;

    } catch (error) {
      console.error('Error processing input:', error);
      // v5.9: Clean up progress on error
      this.completeQueryProgress();
      const fallback = getFallbackResponse(trimmedInput);
      this._lastResponse.set(fallback);
      return fallback;

    } finally {
      this._isProcessing.set(false);
    }
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
   */
  private addContext(input: string): string {
    const relevantPillars = searchPillarsByKeyword(input);

    // v5.3.0: Get robot position for spatial awareness
    const robotX = Math.round(this.physicsService.state().x);
    const positionContext = `[POSICIÓN: x=${robotX}]`;

    // v3.0: ALWAYS include Sendell identity first to prevent confusion
    let context = SENDELL_IDENTITY_CONTEXT;

    // Add relevant pillar context if found
    if (relevantPillars.length > 0) {
      const pillarContext = relevantPillars
        .slice(0, 2) // Max 2 relevant sections
        .map(p => `## ${p.title}\n${p.content.substring(0, 300)}...`)
        .join('\n\n');
      context += '\n\n' + pillarContext;
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
   */
  clearHistory(): void {
    this._chatHistory.set([]);
    this.llmService.resetConversation();
    this._offTopicCount.set(0);
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
  }
}
