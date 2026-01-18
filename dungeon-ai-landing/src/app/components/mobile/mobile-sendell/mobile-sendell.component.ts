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
// v8.1: Import Smart Responses system
import { getSmartResponse } from '../../../config/sendell-smart-responses.config';
import { RobotAction } from '../../../config/sendell-ai.config';

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
  // v8.1: Emit action when Smart Response includes walk_to_pillar
  @Output() actionRequested = new EventEmitter<RobotAction>();

  @ViewChild('messagesContainer') messagesContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('inputField') inputField!: ElementRef<HTMLInputElement>;

  // Chat state
  messages = signal<ChatMessage[]>([]);
  inputText = '';
  isTyping = signal(false);
  isLoading = signal(false);

  // Scroll tracking
  private shouldScrollToBottom = false;

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
   * v8.1: Process user message with Smart Responses system
   * Uses the same keyword-based responses as desktop version
   */
  private simulateResponse(userMessage: string): void {
    this.isTyping.set(true);
    this.cdr.markForCheck();

    // Small delay for natural feel (instant responses feel robotic)
    const typingDelay = 300 + Math.random() * 400;

    setTimeout(() => {
      // v8.1: Use Smart Responses system (same as desktop)
      const smartResponse = getSmartResponse(userMessage);
      const response = smartResponse.dialogue;

      this.addMessage({
        id: this.generateId(),
        text: response,
        sender: 'sendell',
        timestamp: new Date()
      });

      // v8.1: Emit actions (walk_to_pillar becomes scroll to floor in mobile)
      for (const action of smartResponse.actions) {
        if (action.type === 'walk_to_pillar' && action.target) {
          console.log('[MobileSendell] Action requested:', action);
          this.actionRequested.emit(action);
        }
      }

      this.isTyping.set(false);
      this.shouldScrollToBottom = true;
      this.cdr.markForCheck();
    }, typingDelay);
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
   * Quick actions - v8.1: Updated to match Smart Responses keywords
   */
  quickActions = [
    { label: '👋 Hola', query: 'hola' },
    { label: '📅 Agendar', query: 'agendar' },
    { label: '🤖 LLMs', query: 'llm local' },
    { label: '🔍 RAG', query: 'rag' }
  ];

  onQuickAction(query: string): void {
    this.inputText = query;
    this.sendMessage();
  }
}
