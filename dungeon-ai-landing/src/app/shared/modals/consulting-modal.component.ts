// src/app/shared/modals/consulting-modal.component.ts
// Modal de servicios de consultoría con información detallada

import { Component, Output, EventEmitter } from '@angular/core';
import { CONSULTING_SERVICES, GAME_CONFIG } from '../../core/config/game.config';

@Component({
  selector: 'app-consulting-modal',
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
          <span class="terminal-title">services.json</span>
        </div>

        <div class="modal-body">
          <h2 class="section-title">> SERVICIOS DE CONSULTORÍA IA</h2>

          <div class="services-grid">
            @for (service of services; track service.id) {
              <div class="service-card" [style.--service-color]="service.color">
                <div class="service-header">
                  <h3>{{ service.title }}</h3>
                  <span class="short-desc">{{ service.shortDescription }}</span>
                </div>

                <p class="full-desc">{{ service.fullDescription }}</p>

                <div class="features">
                  <span class="features-label">Características:</span>
                  <ul>
                    @for (feature of service.features; track feature) {
                      <li>{{ feature }}</li>
                    }
                  </ul>
                </div>

                <div class="technologies">
                  <span class="tech-label">Tecnologías:</span>
                  <div class="tech-tags">
                    @for (tech of service.technologies; track tech) {
                      <span class="tech-tag">{{ tech }}</span>
                    }
                  </div>
                </div>
              </div>
            }
          </div>

          <div class="cta-section">
            <p class="cta-message">¿Listo para transformar tu negocio con IA?</p>
            <a [href]="calendlyUrl" target="_blank" class="cta-button">
              AGENDAR SESIÓN GRATUITA
            </a>
            <p class="cta-subtitle">30 minutos para identificar 3 oportunidades de IA</p>
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
      border: 2px solid #ff00ff;
      border-radius: 12px;
      max-width: 900px;
      width: 95%;
      max-height: 90vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      animation: slideIn 0.3s ease;
      box-shadow: 0 0 40px rgba(255, 0, 255, 0.3);
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
      border-bottom: 1px solid rgba(255, 0, 255, 0.2);
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
      font-family: 'Source Code Pro', monospace;
      font-size: 12px;
      color: rgba(255, 0, 255, 0.6);
    }

    .modal-body {
      padding: 24px;
      overflow-y: auto;
      flex: 1;
      color: #ff00ff;
      font-family: 'Source Code Pro', monospace;
    }

    .section-title {
      font-size: 18px;
      margin: 0 0 20px;
      text-shadow: 0 0 15px rgba(255, 0, 255, 0.5);
    }

    .services-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }

    .service-card {
      --service-color: #ff00ff;
      background: rgba(255, 0, 255, 0.05);
      border: 1px solid var(--service-color);
      border-radius: 8px;
      padding: 16px;
      transition: all 0.3s ease;

      &:hover {
        background: rgba(255, 0, 255, 0.1);
        transform: translateY(-2px);
        box-shadow: 0 5px 20px rgba(255, 0, 255, 0.2);
      }

      .service-header {
        margin-bottom: 12px;

        h3 {
          font-size: 14px;
          color: var(--service-color);
          margin: 0 0 4px;
        }

        .short-desc {
          font-size: 11px;
          opacity: 0.7;
        }
      }

      .full-desc {
        font-size: 11px;
        line-height: 1.5;
        opacity: 0.9;
        margin: 0 0 12px;
      }

      .features {
        margin-bottom: 12px;

        .features-label {
          font-size: 10px;
          opacity: 0.6;
          display: block;
          margin-bottom: 6px;
        }

        ul {
          margin: 0;
          padding-left: 16px;
          font-size: 10px;
          opacity: 0.8;

          li {
            margin-bottom: 4px;
            color: #00ff44;
          }
        }
      }

      .technologies {
        .tech-label {
          font-size: 10px;
          opacity: 0.6;
          display: block;
          margin-bottom: 6px;
        }

        .tech-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
        }

        .tech-tag {
          font-size: 9px;
          padding: 2px 6px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 4px;
          color: var(--service-color);
        }
      }
    }

    .cta-section {
      text-align: center;
      padding-top: 20px;
      border-top: 1px solid rgba(255, 0, 255, 0.2);

      .cta-message {
        font-size: 16px;
        margin: 0 0 16px;
      }

      .cta-button {
        display: inline-block;
        background: #ff00ff;
        color: #0a0a0a;
        padding: 14px 28px;
        border-radius: 8px;
        text-decoration: none;
        font-weight: bold;
        font-size: 14px;
        transition: all 0.3s ease;
        cursor: pointer;

        &:hover {
          transform: translateY(-2px);
          box-shadow: 0 5px 25px rgba(255, 0, 255, 0.5);
        }
      }

      .cta-subtitle {
        font-size: 12px;
        opacity: 0.6;
        margin: 12px 0 0;
      }
    }

    .modal-footer {
      padding: 12px;
      text-align: center;
      border-top: 1px solid rgba(255, 0, 255, 0.1);

      .hint {
        font-family: 'Source Code Pro', monospace;
        font-size: 11px;
        color: rgba(255, 0, 255, 0.4);
      }
    }

    // Responsive
    @media (max-width: 600px) {
      .services-grid {
        grid-template-columns: 1fr;
      }
    }
  `],
})
export class ConsultingModalComponent {
  @Output() close = new EventEmitter<void>();

  readonly services = CONSULTING_SERVICES;
  readonly calendlyUrl = GAME_CONFIG.profile.calendlyUrl;
}
