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

  // Internal state
  private _status = signal<SendellAIStatus>('initializing');
  private _llmProgress = signal<number>(0);
  private _llmProgressText = signal<string>('');
  private _isWebGPUSupported = signal<boolean>(false);
  private _offTopicCount = signal<number>(0);
  private _lastResponse = signal<SendellResponse | null>(null);
  private _isProcessing = signal<boolean>(false);

  // Chat history
  private _chatHistory = signal<ChatMessage[]>([]);

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
   */
  async processUserInput(input: string): Promise<SendellResponse> {
    if (this._isProcessing()) {
      return FALLBACK_RESPONSES['loading'];
    }

    this._isProcessing.set(true);
    const trimmedInput = input.trim();

    // Add user message to history
    this.addChatMessage({
      role: 'user',
      content: trimmedInput,
      timestamp: new Date()
    });

    try {
      let response: SendellResponse;

      // Check for off-topic query first
      const offTopicResponse = this.checkOffTopic(trimmedInput);
      if (offTopicResponse) {
        response = offTopicResponse;
      }
      // Use LLM if available
      else if (this.llmService.isReady) {
        // Add context from pillar knowledge
        const contextualInput = this.addContext(trimmedInput);
        response = await this.llmService.processInput(contextualInput);
      }
      // Fallback to keyword matching
      else {
        response = getFallbackResponse(trimmedInput);
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
   */
  private addContext(input: string): string {
    const relevantPillars = searchPillarsByKeyword(input);

    if (relevantPillars.length === 0) {
      return input;
    }

    // Add relevant context
    const context = relevantPillars
      .slice(0, 2) // Max 2 relevant sections
      .map(p => `## ${p.title}\n${p.content.substring(0, 300)}...`)
      .join('\n\n');

    return `[Contexto relevante de la página]\n${context}\n\n[Pregunta del usuario]\n${input}`;
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

  /**
   * Clean up resources
   */
  async terminate(): Promise<void> {
    await this.llmService.terminate();
    this._status.set('initializing');
    this._chatHistory.set([]);
    this._offTopicCount.set(0);
  }
}
