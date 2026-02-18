/**
 * ConsultantChatService - WebSocket RPC client for Sendell Consultant
 *
 * Connects the Angular frontend to Sendell Consultant instance via WebSocket.
 * Uses sendell-clawd's custom protocol (NOT JSON-RPC 2.0).
 *
 * ## Protocol Summary (sendell-clawd gateway)
 *
 * Handshake:
 *   1. Server sends challenge: { type: "event", event: "connect.challenge", payload: { nonce, ts } }
 *   2. Client sends connect:   { type: "req", id: "1", method: "connect", params: { minProtocol: 1, maxProtocol: 99, client: { id: "webchat-ui", ... }, auth: { token } } }
 *   3. Server responds:        { type: "res", id: "1", ok: true, payload: { type: "hello-ok", ... } }
 *
 * Chat:
 *   - Send:    { type: "req", id: "N", method: "chat.send", params: { message, sessionKey, idempotencyKey } }
 *   - ACK:     { type: "res", id: "N", ok: true, payload: { runId, status: "started" } }
 *   - Delta:   { type: "event", event: "chat", payload: { runId, state: "delta", delta: { type: "text", text } } }
 *   - Final:   { type: "event", event: "chat", payload: { runId, state: "final", message: { role, content, ... } } }
 *   - Abort:   { type: "req", id: "N", method: "chat.abort", params: { sessionKey, runId } }
 *   - History: { type: "req", id: "N", method: "chat.history", params: { sessionKey, limit } }
 */

import { Injectable, signal, computed, NgZone, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';

// --- Types ---

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface StreamingChunk {
  state: 'delta' | 'final' | 'error';
  text: string;
  runId: string;
}

/** sendell-clawd gateway request */
interface GatewayRequest {
  type: 'req';
  id: string;
  method: string;
  params?: Record<string, unknown>;
}

/** sendell-clawd gateway response */
interface GatewayResponse {
  type: 'res';
  id: string;
  ok: boolean;
  payload?: Record<string, unknown>;
  error?: string;
}

/** sendell-clawd gateway event */
interface GatewayEvent {
  type: 'event';
  event: string;
  payload?: Record<string, unknown>;
}

type GatewayMessage = GatewayResponse | GatewayEvent;

interface PendingCall {
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  timeout: ReturnType<typeof setTimeout>;
}

// --- Configuration ---

export const CONSULTANT_WS_CONFIG = {
  /** Default endpoint - override via connect() parameter */
  DEFAULT_ENDPOINT: 'ws://localhost:3004/ws',

  /** Client identifier for the WS handshake */
  CLIENT_ID: 'webchat-ui',

  /** Reconnect settings */
  RECONNECT_BASE_DELAY_MS: 1000,
  RECONNECT_MAX_DELAY_MS: 30000,
  RECONNECT_MAX_ATTEMPTS: 10,

  /** RPC call timeout */
  RPC_TIMEOUT_MS: 60000,

  /** Session key prefix for web visitors */
  SESSION_PREFIX: 'web:',

  /** Max conversation turns before suggesting Calendly */
  MAX_TURNS: 10,
};


@Injectable({ providedIn: 'root' })
export class ConsultantChatService implements OnDestroy {
  // --- State ---
  private readonly _connectionState = signal<ConnectionState>('disconnected');
  private readonly _isTyping = signal(false);
  private readonly _messages = signal<ChatMessage[]>([]);
  private readonly _turnCount = signal(0);
  private readonly _turnLimitReached = signal(false);

  /** Reactive connection state */
  readonly connectionState = this._connectionState.asReadonly();
  /** Whether the assistant is currently generating a response */
  readonly isTyping = this._isTyping.asReadonly();
  /** Chat messages for the current session */
  readonly messages = this._messages.asReadonly();
  /** Whether we're connected and ready to chat */
  readonly isReady = computed(() => this._connectionState() === 'connected');
  /** Current turn count */
  readonly turnCount = this._turnCount.asReadonly();
  /** Whether the conversation turn limit has been reached */
  readonly turnLimitReached = this._turnLimitReached.asReadonly();

  // --- Streaming output ---
  private readonly _streamChunk$ = new Subject<StreamingChunk>();
  /** Emits each streaming chunk as it arrives */
  readonly streamChunk$ = this._streamChunk$.asObservable();

  // --- Internals ---
  private ws: WebSocket | null = null;
  private rpcId = 0;
  private pendingCalls = new Map<string, PendingCall>();
  private sessionKey = '';
  private endpoint = '';
  private token = '';
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private currentRunId = '';
  private streamingText = '';

  constructor(private ngZone: NgZone) {
    this.sessionKey = CONSULTANT_WS_CONFIG.SESSION_PREFIX + this.generateSessionId();
  }

  ngOnDestroy(): void {
    this.disconnect();
  }

  // --- Public API ---

  /**
   * Connect to the Sendell Consultant WebSocket gateway.
   * @param endpoint  WS URL (e.g. ws://localhost:3004/ws or wss://api.danielconsultant.dev/ws)
   * @param token     Auth token for the handshake
   */
  connect(endpoint: string, token: string = ''): void {
    if (this.ws && this._connectionState() === 'connected') {
      console.warn('[ConsultantChat] Already connected');
      return;
    }

    this.endpoint = endpoint;
    this.token = token;
    this.reconnectAttempt = 0;
    this._connectionState.set('connecting');
    this.openSocket();
  }

  /** Disconnect and clean up */
  disconnect(): void {
    this.clearReconnect();
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    this.rejectAllPending('Disconnected');
    this._connectionState.set('disconnected');
    this._isTyping.set(false);
  }

  /**
   * Send a chat message and receive streaming response tokens via streamChunk$.
   * Returns a Promise that resolves when the server acknowledges the message.
   * The actual response arrives via streaming events.
   */
  async sendMessage(text: string): Promise<void> {
    if (this._connectionState() !== 'connected') {
      throw new Error('Not connected to Sendell Consultant');
    }

    // Check turn limit
    if (this._turnLimitReached()) {
      throw new Error('Turn limit reached. Please schedule a call with Daniel.');
    }

    // Increment turn count
    this._turnCount.update(n => n + 1);

    // Add user message to history
    this._messages.update(msgs => [...msgs, {
      role: 'user' as const,
      content: text,
      timestamp: new Date(),
    }]);

    this._isTyping.set(true);
    this.streamingText = '';

    const idempotencyKey = this.generateUUID();

    const result = await this.rpcCall('chat.send', {
      message: text,
      sessionKey: this.sessionKey,
      idempotencyKey,
    }) as { runId?: string; status?: string };

    this.currentRunId = result?.runId || '';
    // Response will arrive via streaming events (handleChatEvent)
  }

  /** Load chat history for the current session */
  async loadHistory(): Promise<ChatMessage[]> {
    if (this._connectionState() !== 'connected') {
      return [];
    }

    const result = await this.rpcCall('chat.history', {
      sessionKey: this.sessionKey,
      limit: 100,
    }) as {
      messages?: Array<{
        role: string;
        content: Array<{ type: string; text?: string }> | string;
        timestamp?: number;
      }>;
    };

    if (result?.messages) {
      const msgs: ChatMessage[] = result.messages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({
          role: m.role as 'user' | 'assistant',
          content: this.extractText(m.content),
          timestamp: m.timestamp ? new Date(m.timestamp) : new Date(),
        }));
      this._messages.set(msgs);
      return msgs;
    }

    return [];
  }

  /** Abort the current in-progress response */
  abortMessage(): void {
    if (this.currentRunId) {
      this.rpcCall('chat.abort', {
        sessionKey: this.sessionKey,
        runId: this.currentRunId,
      }).catch(() => {}); // Best effort
    }
    this._isTyping.set(false);
    this.currentRunId = '';
  }

  /** Clear local message history */
  clearMessages(): void {
    this._messages.set([]);
  }

  /** Get the current session key */
  getSessionKey(): string {
    return this.sessionKey;
  }

  // --- WebSocket Management ---

  private openSocket(): void {
    try {
      this.ws = new WebSocket(this.endpoint);

      this.ws.onopen = () => {
        console.log('[ConsultantChat] WebSocket connected, waiting for challenge...');
      };

      this.ws.onmessage = (event) => {
        this.ngZone.run(() => {
          this.handleMessage(event.data);
        });
      };

      this.ws.onerror = (event) => {
        console.error('[ConsultantChat] WebSocket error:', event);
        this._connectionState.set('error');
      };

      this.ws.onclose = (event) => {
        console.log('[ConsultantChat] WebSocket closed:', event.code, event.reason);
        this.ws = null;
        this.rejectAllPending('Connection closed');

        if (this._connectionState() !== 'disconnected') {
          this._connectionState.set('disconnected');
          this._isTyping.set(false);
          this.scheduleReconnect();
        }
      };
    } catch (err) {
      console.error('[ConsultantChat] Failed to open WebSocket:', err);
      this._connectionState.set('error');
      this.scheduleReconnect();
    }
  }

  private handleMessage(raw: string): void {
    let msg: GatewayMessage;
    try {
      msg = JSON.parse(raw);
    } catch {
      console.warn('[ConsultantChat] Invalid JSON:', raw);
      return;
    }

    if (msg.type === 'event') {
      this.handleEvent(msg as GatewayEvent);
    } else if (msg.type === 'res') {
      this.handleResponse(msg as GatewayResponse);
    }
  }

  private handleEvent(msg: GatewayEvent): void {
    switch (msg.event) {
      case 'connect.challenge': {
        // Respond with connect handshake
        const payload = msg.payload as { nonce?: string; ts?: number } | undefined;
        this.sendConnect(payload?.nonce || '');
        break;
      }

      case 'chat': {
        this.handleChatEvent(msg.payload as Record<string, unknown>);
        break;
      }

      default:
        // Ignore other events (agent, presence, health, tick, etc.)
        break;
    }
  }

  private sendConnect(nonce: string): void {
    const id = this.nextId();
    const timeout = setTimeout(() => {
      this.pendingCalls.delete(id);
      this._connectionState.set('error');
    }, 10000);

    this.pendingCalls.set(id, {
      resolve: () => {
        this._connectionState.set('connected');
        this.reconnectAttempt = 0;
        console.log('[ConsultantChat] Handshake complete - connected');
      },
      reject: (err) => {
        console.error('[ConsultantChat] Handshake failed:', err);
        this._connectionState.set('error');
      },
      timeout,
    });

    this.sendRaw({
      type: 'req',
      id,
      method: 'connect',
      params: {
        minProtocol: 1,
        maxProtocol: 99,
        client: {
          id: CONSULTANT_WS_CONFIG.CLIENT_ID,
          displayName: 'danielconsultant.dev',
          version: '1.0.0',
          platform: 'web',
          mode: 'webchat',
        },
        auth: this.token ? { token: this.token } : undefined,
      },
    });
  }

  private handleChatEvent(payload: Record<string, unknown> | undefined): void {
    if (!payload) return;

    const state = payload['state'] as string;

    if (state === 'delta') {
      const delta = payload['delta'] as { type?: string; text?: string } | undefined;
      if (delta?.text) {
        this.streamingText += delta.text;
        this._streamChunk$.next({
          state: 'delta',
          text: delta.text,
          runId: (payload['runId'] as string) || '',
        });
      }
    } else if (state === 'final') {
      const message = payload['message'] as {
        role?: string;
        content?: Array<{ type: string; text?: string }> | string;
      } | undefined;

      const fullText = message?.content
        ? this.extractText(message.content)
        : this.streamingText;

      this._streamChunk$.next({
        state: 'final',
        text: fullText,
        runId: (payload['runId'] as string) || '',
      });

      // Add complete message to history
      if (fullText) {
        this._messages.update(msgs => [...msgs, {
          role: 'assistant' as const,
          content: fullText,
          timestamp: new Date(),
        }]);
      }

      this._isTyping.set(false);
      this.currentRunId = '';
      this.streamingText = '';

      // Check if turn limit reached after response
      if (this._turnCount() >= CONSULTANT_WS_CONFIG.MAX_TURNS) {
        this._turnLimitReached.set(true);
        // Add a system message suggesting Calendly
        this._messages.update(msgs => [...msgs, {
          role: 'assistant' as const,
          content: '¿Le gustaría agendar una sesión gratuita con Daniel para profundizar? 👉 https://calendly.com/darmcastiblanco/30min',
          timestamp: new Date(),
        }]);
      }
    }
  }

  private handleResponse(msg: GatewayResponse): void {
    const pending = this.pendingCalls.get(msg.id);
    if (!pending) return;

    clearTimeout(pending.timeout);
    this.pendingCalls.delete(msg.id);

    if (msg.ok) {
      pending.resolve(msg.payload || {});
    } else {
      pending.reject(new Error(msg.error || 'RPC error'));
    }
  }

  // --- RPC helpers ---

  private rpcCall(method: string, params: Record<string, unknown>): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const id = this.nextId();
      const timeout = setTimeout(() => {
        this.pendingCalls.delete(id);
        reject(new Error(`RPC timeout: ${method}`));
      }, CONSULTANT_WS_CONFIG.RPC_TIMEOUT_MS);

      this.pendingCalls.set(id, { resolve, reject, timeout });
      this.sendRaw({ type: 'req', id, method, params });
    });
  }

  private sendRaw(msg: GatewayRequest): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[ConsultantChat] Cannot send - WebSocket not open');
      return;
    }
    this.ws.send(JSON.stringify(msg));
  }

  private nextId(): string {
    return String(++this.rpcId);
  }

  // --- Reconnect ---

  private scheduleReconnect(): void {
    if (this.reconnectAttempt >= CONSULTANT_WS_CONFIG.RECONNECT_MAX_ATTEMPTS) {
      console.error('[ConsultantChat] Max reconnect attempts reached');
      this._connectionState.set('error');
      return;
    }

    const delay = Math.min(
      CONSULTANT_WS_CONFIG.RECONNECT_BASE_DELAY_MS * Math.pow(2, this.reconnectAttempt),
      CONSULTANT_WS_CONFIG.RECONNECT_MAX_DELAY_MS
    );
    this.reconnectAttempt++;
    console.log(`[ConsultantChat] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempt})`);

    this.reconnectTimer = setTimeout(() => {
      this._connectionState.set('connecting');
      this.openSocket();
    }, delay);
  }

  private clearReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  // --- Utilities ---

  private rejectAllPending(reason: string): void {
    for (const [id, call] of this.pendingCalls) {
      clearTimeout(call.timeout);
      call.reject(new Error(reason));
    }
    this.pendingCalls.clear();
  }

  private generateSessionId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
  }

  private generateUUID(): string {
    return Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 10);
  }

  /** Extract text from sendell message content (can be string or content array) */
  private extractText(content: Array<{ type: string; text?: string }> | string | unknown): string {
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
      return content
        .filter(c => c.type === 'text' && c.text)
        .map(c => c.text!)
        .join('');
    }
    return '';
  }
}
