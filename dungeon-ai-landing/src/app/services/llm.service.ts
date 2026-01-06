/**
 * LLM Service - WebLLM Integration for Sendell AI
 * v1.0: Local LLM running entirely in the browser via WebGPU
 *
 * This service manages:
 * - WebLLM engine initialization with progress tracking
 * - Conversation history and context management
 * - JSON mode for structured responses
 * - Streaming support for real-time output
 * - Fallback handling when WebGPU is unavailable
 */

import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import {
  LLM_CONFIG,
  SENDELL_SYSTEM_PROMPT,
  SendellResponse,
  getLoadingMessage
} from '../config/sendell-ai.config';

// WebLLM types (will be dynamically imported)
type WebWorkerMLCEngine = any;
type ChatCompletionMessageParam = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type LLMStatus = 'uninitialized' | 'checking' | 'loading' | 'ready' | 'error' | 'generating' | 'unsupported';

export interface LLMState {
  status: LLMStatus;
  progress: number;
  progressText: string;
  error?: string;
  modelId?: string;
}

@Injectable({
  providedIn: 'root'
})
export class LLMService {
  private engine: WebWorkerMLCEngine | null = null;
  private worker: Worker | null = null;
  private conversationHistory: ChatCompletionMessageParam[] = [];
  private webllmModule: any = null;

  private stateSubject = new BehaviorSubject<LLMState>({
    status: 'uninitialized',
    progress: 0,
    progressText: ''
  });

  public state$ = this.stateSubject.asObservable();

  constructor(private ngZone: NgZone) {}

  /**
   * Check if LLM is ready for use
   */
  get isReady(): boolean {
    return this.stateSubject.value.status === 'ready';
  }

  /**
   * Get current state snapshot
   */
  get currentState(): LLMState {
    return this.stateSubject.value;
  }

  /**
   * Check if WebGPU is supported in current browser
   */
  async checkWebGPUSupport(): Promise<boolean> {
    if (!('gpu' in navigator)) {
      return false;
    }

    try {
      const gpu = (navigator as any).gpu;
      const adapter = await gpu.requestAdapter();

      if (!adapter) {
        return false;
      }

      // Check if it's a fallback adapter (software rendering)
      const info = await adapter.requestAdapterInfo?.();
      if (info?.vendor === 'Google Inc. (Google)' && info?.architecture === 'swiftshader') {
        console.warn('WebGPU: SwiftShader detected (software fallback)');
        return false;
      }

      return true;
    } catch (error) {
      console.error('WebGPU check failed:', error);
      return false;
    }
  }

  /**
   * Initialize the LLM engine
   * This downloads the model and prepares it for inference
   */
  async initialize(modelId: string = LLM_CONFIG.MODEL_ID): Promise<void> {
    if (this.engine) {
      console.log('LLM already initialized');
      return;
    }

    this.updateState({ status: 'checking', progress: 0, progressText: 'Verificando compatibilidad...' });

    // Check WebGPU support
    const hasWebGPU = await this.checkWebGPUSupport();
    if (!hasWebGPU) {
      this.updateState({
        status: 'unsupported',
        progress: 0,
        progressText: '',
        error: 'WebGPU no soportado. Usa Chrome 113+, Edge 113+, o Safari 18+.'
      });
      return;
    }

    this.updateState({
      status: 'loading',
      progress: 0,
      progressText: getLoadingMessage(0),
      modelId
    });

    try {
      // Dynamically import WebLLM to avoid issues if not installed
      this.webllmModule = await import('@mlc-ai/web-llm');

      // Create web worker for LLM inference
      this.worker = new Worker(
        new URL('./llm.worker', import.meta.url),
        { type: 'module' }
      );

      // Initialize engine with progress callback
      this.engine = await this.webllmModule.CreateWebWorkerMLCEngine(
        this.worker,
        modelId,
        {
          initProgressCallback: (progress: { progress: number; text: string }) => {
            this.ngZone.run(() => {
              const percent = progress.progress * 100;
              this.updateState({
                status: 'loading',
                progress: percent,
                progressText: getLoadingMessage(percent),
                modelId
              });
            });
          }
        }
      );

      // Initialize conversation with system prompt
      this.resetConversation();

      this.ngZone.run(() => {
        this.updateState({
          status: 'ready',
          progress: 100,
          progressText: '¡Listo!',
          modelId
        });
      });

      console.log('LLM initialized successfully:', modelId);

    } catch (error) {
      console.error('LLM initialization failed:', error);
      this.ngZone.run(() => {
        this.updateState({
          status: 'error',
          progress: 0,
          progressText: '',
          error: (error as Error).message
        });
      });
      throw error;
    }
  }

  /**
   * Process user input and get structured response
   * Uses JSON mode to ensure parseable output
   */
  async processInput(userMessage: string): Promise<SendellResponse> {
    if (!this.engine) {
      throw new Error('LLM not initialized');
    }

    const previousStatus = this.stateSubject.value.status;
    this.updateState({ ...this.stateSubject.value, status: 'generating' });

    try {
      // Add user message to history
      this.conversationHistory.push({ role: 'user', content: userMessage });

      // Generate response with JSON mode
      const response = await this.engine.chat.completions.create({
        messages: this.conversationHistory,
        response_format: { type: 'json_object' },
        temperature: LLM_CONFIG.TEMPERATURE,
        max_tokens: LLM_CONFIG.MAX_TOKENS
      });

      const content = response.choices[0]?.message?.content || '';

      // Add assistant response to history
      this.conversationHistory.push({ role: 'assistant', content });

      // Trim history if too long
      this.trimHistory();

      this.ngZone.run(() => {
        this.updateState({ ...this.stateSubject.value, status: 'ready' });
      });

      return this.parseResponse(content);

    } catch (error) {
      console.error('LLM generation error:', error);
      this.ngZone.run(() => {
        this.updateState({ ...this.stateSubject.value, status: previousStatus });
      });
      throw error;
    }
  }

  /**
   * Stream response token by token
   * Useful for showing real-time typing effect
   */
  async streamResponse(
    userMessage: string,
    onToken: (token: string) => void
  ): Promise<SendellResponse> {
    if (!this.engine) {
      throw new Error('LLM not initialized');
    }

    this.conversationHistory.push({ role: 'user', content: userMessage });
    this.updateState({ ...this.stateSubject.value, status: 'generating' });

    try {
      const stream = await this.engine.chat.completions.create({
        messages: this.conversationHistory,
        response_format: { type: 'json_object' },
        temperature: LLM_CONFIG.TEMPERATURE,
        max_tokens: LLM_CONFIG.MAX_TOKENS,
        stream: true
      });

      let fullResponse = '';

      for await (const chunk of stream) {
        const token = chunk.choices[0]?.delta?.content || '';
        if (token) {
          fullResponse += token;
          onToken(token);
        }
      }

      this.conversationHistory.push({ role: 'assistant', content: fullResponse });
      this.trimHistory();

      this.ngZone.run(() => {
        this.updateState({ ...this.stateSubject.value, status: 'ready' });
      });

      return this.parseResponse(fullResponse);

    } catch (error) {
      console.error('LLM streaming error:', error);
      this.ngZone.run(() => {
        this.updateState({ ...this.stateSubject.value, status: 'ready' });
      });
      throw error;
    }
  }

  /**
   * Parse JSON response from LLM
   * Handles malformed JSON gracefully
   */
  private parseResponse(jsonString: string): SendellResponse {
    try {
      // Try to extract JSON from the response (in case of extra text)
      const jsonMatch = jsonString.match(/\{[\s\S]*\}/);
      const cleanJson = jsonMatch ? jsonMatch[0] : jsonString;

      const parsed = JSON.parse(cleanJson);

      // Validate and normalize actions
      const validActionTypes = ['walk_to_pillar', 'jump', 'energize_pillar', 'wave', 'crash', 'idle', 'point_at'];
      const actions = (parsed.actions || [])
        .filter((a: any) => a && validActionTypes.includes(a.type))
        .map((a: any) => ({
          type: a.type,
          target: a.target,
          duration: a.duration
        }));

      // Validate emotion
      const validEmotions = ['friendly', 'helpful', 'excited', 'curious', 'frustrated', 'existential', 'reset'];
      const emotion = validEmotions.includes(parsed.emotion) ? parsed.emotion : 'friendly';

      return {
        actions: actions.length > 0 ? actions : [{ type: 'idle' }],
        dialogue: parsed.dialogue || parsed.message || parsed.response || '¿En qué puedo ayudarte?',
        emotion
      };

    } catch (parseError) {
      console.warn('JSON parse error, attempting regex extraction:', parseError);

      // Regex fallback for extracting dialogue from malformed JSON
      const dialogueMatch = jsonString.match(/"dialogue"\s*:\s*"([^"]+)"/);
      const messageMatch = jsonString.match(/"message"\s*:\s*"([^"]+)"/);

      return {
        actions: [{ type: 'idle' }],
        dialogue: dialogueMatch?.[1] || messageMatch?.[1] || 'Disculpa, ¿podrías repetirlo?',
        emotion: 'friendly'
      };
    }
  }

  /**
   * Reset conversation to initial state
   * Clears history and reinitializes with system prompt
   */
  resetConversation(): void {
    this.conversationHistory = [
      { role: 'system', content: SENDELL_SYSTEM_PROMPT }
    ];

    // Also reset the engine's internal chat if available
    if (this.engine?.resetChat) {
      this.engine.resetChat();
    }

    console.log('LLM conversation reset');
  }

  /**
   * Trim conversation history to prevent context overflow
   */
  private trimHistory(): void {
    const maxTurns = LLM_CONFIG.MAX_HISTORY_TURNS * 2; // Each turn = user + assistant

    if (this.conversationHistory.length > maxTurns + 1) {
      // Keep system prompt and last N turns
      this.conversationHistory = [
        this.conversationHistory[0], // System prompt
        ...this.conversationHistory.slice(-(maxTurns))
      ];
    }
  }

  /**
   * Update internal state
   */
  private updateState(state: LLMState): void {
    this.stateSubject.next(state);
  }

  /**
   * Terminate LLM engine and clean up resources
   */
  async terminate(): Promise<void> {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }

    this.engine = null;
    this.conversationHistory = [];

    this.updateState({
      status: 'uninitialized',
      progress: 0,
      progressText: ''
    });

    console.log('LLM terminated');
  }

  /**
   * Get conversation history (for debugging)
   */
  getHistory(): ChatCompletionMessageParam[] {
    return [...this.conversationHistory];
  }
}
