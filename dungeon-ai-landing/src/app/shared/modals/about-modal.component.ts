// src/app/shared/modals/about-modal.component.ts
// Modal "Sobre Mí" con información de Daniel Castiblanco

import { Component, Output, EventEmitter } from '@angular/core';
import { GAME_CONFIG, CONSULTATION_PROCESS } from '../../core/config/game.config';

@Component({
  selector: 'app-about-modal',
  standalone: true,
  template: `
    <div class="modal-backdrop" (click)="close.emit()">
      <div class="modal-content" (click)="$event.stopPropagation()">
        <!-- Terminal header -->
        <div class="terminal-header">
          <div class="terminal-dots">
            <span class="dot red"></span>
            <span class="dot yellow"></span>
            <span class="dot green" (click)="close.emit()"></span>
          </div>
          <span class="terminal-title">about_me.sh</span>
        </div>

        <div class="modal-body">
          <div class="profile-section">
            <h2 class="name">{{ profile.name }}</h2>
            <p class="title">{{ profile.title }}</p>
            <p class="subtitle">{{ profile.subtitle }}</p>
          </div>

          <div class="divider"></div>

          <div class="bio-section">
            <h3>> BIO</h3>
            <p>
              Especialista en implementación de soluciones de Inteligencia Artificial
              para empresas y personas. Mi enfoque combina experiencia técnica profunda
              con visión estratégica de negocio.
            </p>
            <p>
              Ayudo a organizaciones a adoptar IA de manera práctica y medible,
              desde sistemas RAG hasta orquestación de agentes autónomos.
            </p>
          </div>

          <div class="divider"></div>

          <div class="process-section">
            <h3>> PROCESO DE TRABAJO</h3>

            <div class="process-step">
              <div class="step-header">
                <span class="step-icon">1</span>
                <span class="step-duration">{{ process.discovery.duration }}</span>
              </div>
              <p class="step-description">{{ process.discovery.description }}</p>
              <p class="step-deliverable">→ {{ process.discovery.deliverable }}</p>
            </div>

            <div class="process-step">
              <div class="step-header">
                <span class="step-icon">2</span>
                <span class="step-duration">{{ process.pilot.duration }}</span>
              </div>
              <p class="step-description">{{ process.pilot.description }}</p>
              <p class="step-deliverable">→ {{ process.pilot.deliverable }}</p>
            </div>

            <div class="process-step">
              <div class="step-header">
                <span class="step-icon">3</span>
                <span class="step-duration">{{ process.scale.duration }}</span>
              </div>
              <p class="step-description">{{ process.scale.description }}</p>
              <p class="step-deliverable">→ {{ process.scale.deliverable }}</p>
            </div>
          </div>

          <div class="cta-section">
            <a [href]="profile.calendlyUrl" target="_blank" class="cta-button">
              AGENDAR SESIÓN GRATUITA
            </a>
          </div>
        </div>

        <div class="modal-footer">
          <span class="hint">Presiona ESC o ENTER para cerrar</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.95);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      animation: fadeIn 0.3s ease;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .modal-content {
      background: #0a0a0a;
      border: 2px solid #ffff00;
      border-radius: 12px;
      max-width: 600px;
      width: 90%;
      max-height: 85vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      animation: slideIn 0.3s ease;
      box-shadow: 0 0 40px rgba(255, 255, 0, 0.3);
    }

    @keyframes slideIn {
      from { transform: translateY(-20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }

    .terminal-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      background: #1a1a1a;
      border-bottom: 1px solid rgba(255, 255, 0, 0.2);
    }

    .terminal-dots {
      display: flex;
      gap: 8px;
    }

    .dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      cursor: pointer;
      transition: transform 0.2s;

      &:hover { transform: scale(1.2); }
      &.red { background: #ff5f56; }
      &.yellow { background: #ffbd2e; }
      &.green { background: #27c93f; }
    }

    .terminal-title {
      font-family: 'Courier New', monospace;
      font-size: 12px;
      color: rgba(255, 255, 0, 0.6);
    }

    .modal-body {
      padding: 24px;
      overflow-y: auto;
      flex: 1;
      color: #ffff00;
      font-family: 'Courier New', monospace;
    }

    .profile-section {
      text-align: center;
      margin-bottom: 20px;

      .name {
        font-size: 28px;
        margin: 0;
        text-shadow: 0 0 20px rgba(255, 255, 0, 0.5);
      }

      .title {
        font-size: 18px;
        margin: 8px 0 4px;
        opacity: 0.9;
      }

      .subtitle {
        font-size: 14px;
        opacity: 0.7;
        margin: 0;
      }
    }

    .divider {
      height: 1px;
      background: linear-gradient(90deg, transparent, #ffff00, transparent);
      margin: 20px 0;
      opacity: 0.3;
    }

    .bio-section, .process-section {
      h3 {
        font-size: 14px;
        color: #ffff00;
        margin: 0 0 12px;
        opacity: 0.8;
      }

      p {
        font-size: 13px;
        line-height: 1.6;
        margin: 0 0 12px;
        opacity: 0.9;
      }
    }

    .process-step {
      background: rgba(255, 255, 0, 0.05);
      border-left: 3px solid #ffff00;
      padding: 12px;
      margin-bottom: 12px;
      border-radius: 0 8px 8px 0;

      .step-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
      }

      .step-icon {
        background: #ffff00;
        color: #0a0a0a;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        font-size: 12px;
      }

      .step-duration {
        font-size: 11px;
        opacity: 0.7;
      }

      .step-description {
        font-size: 12px;
        margin: 0 0 4px;
      }

      .step-deliverable {
        font-size: 11px;
        opacity: 0.8;
        margin: 0;
        color: #00ff44;
      }
    }

    .cta-section {
      text-align: center;
      margin-top: 20px;
    }

    .cta-button {
      display: inline-block;
      background: #ffff00;
      color: #0a0a0a;
      padding: 12px 24px;
      border-radius: 8px;
      text-decoration: none;
      font-weight: bold;
      font-size: 14px;
      transition: all 0.3s ease;
      cursor: pointer;

      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 5px 20px rgba(255, 255, 0, 0.4);
      }
    }

    .modal-footer {
      padding: 12px;
      text-align: center;
      border-top: 1px solid rgba(255, 255, 0, 0.1);

      .hint {
        font-family: 'Courier New', monospace;
        font-size: 11px;
        color: rgba(255, 255, 0, 0.4);
      }
    }
  `],
})
export class AboutModalComponent {
  @Output() close = new EventEmitter<void>();

  readonly profile = GAME_CONFIG.profile;
  readonly process = CONSULTATION_PROCESS;
}
