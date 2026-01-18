import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  inject,
  signal,
  AfterViewChecked
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'sendell';
  timestamp: Date;
  isTyping?: boolean;
}

/**
 * v7.0: Mobile Sendell Chat Component
 * Optimized chat experience for mobile devices
 */
@Component({
  selector: 'app-mobile-sendell',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './mobile-sendell.component.html',
  styleUrls: ['./mobile-sendell.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MobileSendellComponent implements OnInit, OnDestroy, AfterViewChecked {
  private cdr = inject(ChangeDetectorRef);

  @Input() isMinimized = false;

  @Output() minimizeChat = new EventEmitter<void>();
  @Output() closeChat = new EventEmitter<void>();

  @ViewChild('messagesContainer') messagesContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('inputField') inputField!: ElementRef<HTMLInputElement>;

  // Chat state
  messages = signal<ChatMessage[]>([]);
  inputText = '';
  isTyping = signal(false);
  isLoading = signal(false);

  // Scroll tracking
  private shouldScrollToBottom = false;

  // Predefined responses for demo (can be replaced with actual AI service)
  private responses: { [key: string]: string } = {
    'hola': 'Hola! Soy Sendell, el asistente de Daniel. ¿En qué puedo ayudarte hoy?',
    'servicios': 'Daniel ofrece servicios de consultoría en IA: Local LLMs, RAG Systems, Orquestación de Agentes e Integraciones personalizadas. ¿Te interesa alguno en particular?',
    'contacto': 'Puedes agendar una sesión gratuita de 30 minutos a través de Calendly. ¿Quieres que te lleve al piso de AGENDAR?',
    'default': 'Interesante pregunta. Te recomiendo explorar los diferentes pisos de la torre para conocer más sobre los servicios de Daniel. ¿Hay algo específico que te gustaría saber?'
  };

  ngOnInit(): void {
    // Initial greeting
    this.addMessage({
      id: this.generateId(),
      text: 'Hola! Soy Sendell. ¿En qué puedo ayudarte?',
      sender: 'sendell',
      timestamp: new Date()
    });
  }

  ngOnDestroy(): void {
    // Cleanup if needed
  }

  ngAfterViewChecked(): void {
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }
  }

  /**
   * Send a message
   */
  sendMessage(): void {
    const text = this.inputText.trim();
    if (!text) return;

    // Add user message
    this.addMessage({
      id: this.generateId(),
      text,
      sender: 'user',
      timestamp: new Date()
    });

    this.inputText = '';
    this.shouldScrollToBottom = true;

    // Simulate typing and response
    this.simulateResponse(text);
  }

  /**
   * Simulate AI response
   */
  private simulateResponse(userMessage: string): void {
    this.isTyping.set(true);
    this.cdr.markForCheck();

    // Simulate typing delay
    const typingDelay = 1000 + Math.random() * 1000;

    setTimeout(() => {
      const response = this.getResponse(userMessage.toLowerCase());

      this.addMessage({
        id: this.generateId(),
        text: response,
        sender: 'sendell',
        timestamp: new Date()
      });

      this.isTyping.set(false);
      this.shouldScrollToBottom = true;
      this.cdr.markForCheck();
    }, typingDelay);
  }

  /**
   * Get response based on keywords
   */
  private getResponse(message: string): string {
    if (message.includes('hola') || message.includes('hey') || message.includes('buenas')) {
      return this.responses['hola'];
    }
    if (message.includes('servicio') || message.includes('ofreces') || message.includes('haces')) {
      return this.responses['servicios'];
    }
    if (message.includes('contacto') || message.includes('agendar') || message.includes('reunion')) {
      return this.responses['contacto'];
    }
    return this.responses['default'];
  }

  /**
   * Add message to chat
   */
  private addMessage(message: ChatMessage): void {
    this.messages.update(msgs => [...msgs, message]);
    this.cdr.markForCheck();
  }

  /**
   * Scroll to bottom of messages
   */
  private scrollToBottom(): void {
    if (this.messagesContainer?.nativeElement) {
      const container = this.messagesContainer.nativeElement;
      container.scrollTop = container.scrollHeight;
    }
  }

  /**
   * Handle input keydown
   */
  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  /**
   * Focus input field
   */
  focusInput(): void {
    if (this.inputField?.nativeElement) {
      this.inputField.nativeElement.focus();
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Format timestamp
   */
  formatTime(date: Date): string {
    return date.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Handle minimize
   */
  onMinimize(): void {
    this.minimizeChat.emit();
  }

  /**
   * Handle close
   */
  onClose(): void {
    this.closeChat.emit();
  }

  /**
   * Quick actions
   */
  quickActions = [
    { label: 'Servicios', query: 'servicios' },
    { label: 'Contacto', query: 'contacto' },
    { label: 'Hola', query: 'hola' }
  ];

  onQuickAction(query: string): void {
    this.inputText = query;
    this.sendMessage();
  }
}
