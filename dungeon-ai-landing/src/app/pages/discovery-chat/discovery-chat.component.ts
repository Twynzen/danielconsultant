import {
  Component, OnInit, OnDestroy, ElementRef, ViewChild, AfterViewInit,
  ChangeDetectionStrategy, ChangeDetectorRef, NgZone
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Meta, Title } from '@angular/platform-browser';

// ── Config ──────────────────────────────────────────────
const WS_URL_PROD = 'wss://discovery-gw.danielconsultant.dev/';
const WS_URL_DEV  = 'ws://localhost:3100/';
const GATEWAY_TOKEN = '2f7386aeea4a3922395811ca80759aa26dba039c65bbe45a';
const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30000;
const RECONNECT_MAX_ATTEMPTS = 50;
const TYPEWRITER_CHAR_MS = 18;

// ── Interfaces ──────────────────────────────────────────
interface ChatMessage { role: 'user' | 'agent' | 'system'; text: string; time: Date; streaming?: boolean; }
interface StreamRun { text: string; displayed: string; done: boolean; timer: any; }

// ── Markdown renderer ───────────────────────────────────
function renderMarkdown(text: string): string {
  if (!text) return '';
  const div = document.createElement('div'); div.textContent = text; let html = div.innerHTML;
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/^[\-\*] (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
  html = html.replace(/\n\n/g, '</p><p>');
  html = html.replace(/\n/g, '<br>');
  if (!html.startsWith('<')) html = '<p>' + html + '</p>';
  return html;
}

@Component({
  selector: 'app-discovery-chat',
  standalone: true,
  imports: [RouterLink, FormsModule],
  templateUrl: './discovery-chat.component.html',
  styleUrl: './discovery-chat.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DiscoveryChatComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('messagesContainer') containerRef!: ElementRef<HTMLDivElement>;
  @ViewChild('messageInput') inputRef!: ElementRef<HTMLTextAreaElement>;

  messages: ChatMessage[] = [];
  connectionStatus: 'connecting' | 'online' | 'offline' = 'connecting';
  statusText = 'Conectando...';
  errorMessage = '';
  showError = false;
  inputText = '';
  sendDisabled = true;
  showWelcome = true;

  private ws: WebSocket | null = null;
  private connected = false;
  private reconnectAttempts = 0;
  private reconnectTimer: any = null;
  private activeRun: StreamRun | null = null;
  private wsUrl: string;

  constructor(
    private cd: ChangeDetectorRef,
    private zone: NgZone,
    private title: Title,
    private meta: Meta,
  ) {
    this.wsUrl = WS_URL_PROD;
  }

  ngOnInit() {
    this.title.setTitle('Sendell Discovery | Consultoria IA');
    this.meta.updateTag({ name: 'description', content: 'Descubre como la IA puede transformar tu negocio. Habla con nuestro agente Discovery.' });
    this.connect();
  }

  ngAfterViewInit() {}

  ngOnDestroy() {
    clearTimeout(this.reconnectTimer);
    if (this.activeRun?.timer) clearTimeout(this.activeRun.timer);
    if (this.ws) { this.ws.onclose = null; this.ws.close(); }
  }

  // ── Connection (simplified — proxy handles auth) ─────
  private connect() {
    if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) return;
    this.setStatus('connecting', 'Conectando...');

    try {
      this.ws = new WebSocket(`${this.wsUrl}?token=${GATEWAY_TOKEN}`);
    } catch {
      this.setError('No se puede conectar al servidor');
      this.scheduleReconnect();
      return;
    }

    this.ws.onmessage = (e) => {
      try { this.handleMessage(JSON.parse(e.data)); } catch {}
    };

    this.ws.onclose = (e) => {
      this.connected = false;
      if (e.code === 1008) this.setError('Conexion cerrada: ' + (e.reason || 'token invalido'));
      else { this.setStatus('offline', 'Desconectado'); if (e.code !== 1000) this.scheduleReconnect(); }
    };

    this.ws.onerror = () => this.setError('Error de conexion');
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= RECONNECT_MAX_ATTEMPTS) {
      this.setError('No se puede reconectar. Recarga la pagina.');
      return;
    }
    const delay = Math.min(RECONNECT_BASE_MS * Math.pow(1.5, this.reconnectAttempts), RECONNECT_MAX_MS);
    this.reconnectAttempts++;
    this.setStatus('connecting', `Reconectando en ${Math.round(delay / 1000)}s...`);
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  retryConnection() { this.hideErrorBanner(); this.connect(); }

  // ── Proxy protocol handler ──────────────────────────
  private handleMessage(msg: any) {
    switch (msg.type) {
      case 'ready':
        this.connected = true;
        this.reconnectAttempts = 0;
        this.setStatus('online', 'En linea');
        this.hideErrorBanner();
        break;

      case 'stream':
        if (!this.activeRun) {
          this.activeRun = { text: '', displayed: '', done: false, timer: null };
        }
        this.activeRun.text = msg.text;
        this.ensureAgentMessage();
        this.drainTypewriter();
        break;

      case 'done':
        if (this.activeRun) {
          this.activeRun.text = msg.text || this.activeRun.text;
          this.activeRun.done = true;
          this.ensureAgentMessage();
          if (!this.activeRun.timer) this.finalizeRun();
          else this.drainTypewriter();
        } else {
          // No streaming happened, show final text directly
          this.ensureAgentMessage();
          const agentMsg = this.getLastAgentMsg();
          if (agentMsg) { agentMsg.text = msg.text || ''; agentMsg.streaming = false; }
          this.cd.markForCheck();
          this.scrollToBottom();
        }
        break;

      case 'error':
        this.removeTypingIndicator();
        if (this.activeRun?.timer) clearTimeout(this.activeRun.timer);
        this.activeRun = null;
        this.messages.push({ role: 'system', text: 'Error: ' + (msg.message || 'Algo salio mal'), time: new Date() });
        this.cd.markForCheck();
        this.scrollToBottom();
        break;

      case 'history':
        // Could be used for loading previous messages
        break;
    }
  }

  // ── Send message ──────────────────────────────────────
  sendMessage() {
    const text = this.inputText.trim();
    if (!text || !this.connected) return;

    this.inputText = '';
    this.sendDisabled = true;
    this.showWelcome = false;

    this.messages.push({ role: 'user', text, time: new Date() });
    this.messages.push({ role: 'agent', text: '', time: new Date(), streaming: true });
    this.cd.markForCheck();
    this.scrollToBottom();

    this.activeRun = null; // Reset for new message

    this.ws!.send(JSON.stringify({ type: 'message', text }));
  }

  onInputChange() { this.sendDisabled = !this.inputText.trim(); }

  onKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.sendMessage(); }
  }

  newChat() {
    this.messages = [];
    this.showWelcome = true;
    if (this.activeRun?.timer) clearTimeout(this.activeRun.timer);
    this.activeRun = null;
    this.cd.markForCheck();
    // Reconnect to get a new session from the proxy
    if (this.ws) { this.ws.onclose = null; this.ws.close(); }
    this.connected = false;
    this.connect();
  }

  // ── Typewriter engine ─────────────────────────────────
  private drainTypewriter() {
    if (!this.activeRun || this.activeRun.timer) return;
    this._tick();
  }

  private _tick() {
    const run = this.activeRun;
    if (!run) return;

    if (run.displayed.length >= run.text.length) {
      run.timer = null;
      if (run.done) this.finalizeRun();
      return;
    }

    const remaining = run.text.length - run.displayed.length;
    const batch = Math.min(remaining, Math.ceil(Math.random() * 3) + 1);
    run.displayed = run.text.substring(0, run.displayed.length + batch);

    const msg = this.getLastAgentMsg();
    if (msg) { msg.text = run.displayed; msg.streaming = true; }

    this.zone.run(() => this.cd.markForCheck());
    this.scrollToBottom();

    run.timer = setTimeout(() => { run.timer = null; this._tick(); }, TYPEWRITER_CHAR_MS * batch);
  }

  private finalizeRun() {
    const run = this.activeRun;
    if (!run) return;
    const msg = this.getLastAgentMsg();
    if (msg) { msg.text = run.text; msg.streaming = false; }
    this.activeRun = null;
    this.zone.run(() => this.cd.markForCheck());
    this.scrollToBottom();
  }

  // ── Helpers ───────────────────────────────────────────
  private ensureAgentMessage() {
    const last = this.getLastAgentMsg();
    if (!last || (!last.streaming && last.text)) {
      this.messages.push({ role: 'agent', text: '', time: new Date(), streaming: true });
    }
  }

  private getLastAgentMsg(): ChatMessage | null {
    for (let i = this.messages.length - 1; i >= 0; i--) {
      if (this.messages[i].role === 'agent') return this.messages[i];
    }
    return null;
  }

  private removeTypingIndicator() {
    for (let i = this.messages.length - 1; i >= 0; i--) {
      if (this.messages[i].role === 'agent' && !this.messages[i].text) {
        this.messages.splice(i, 1);
        break;
      }
    }
  }

  private setStatus(state: 'connecting' | 'online' | 'offline', text: string) {
    this.connectionStatus = state;
    this.statusText = text;
    this.cd.markForCheck();
  }

  private setError(msg: string) {
    this.errorMessage = msg;
    this.showError = true;
    this.cd.markForCheck();
  }

  private hideErrorBanner() { this.showError = false; this.cd.markForCheck(); }

  private scrollToBottom() {
    requestAnimationFrame(() => {
      const el = this.containerRef?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }

  formatTime(date: Date): string {
    return date.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
  }

  renderHtml(text: string): string { return renderMarkdown(text); }
}
