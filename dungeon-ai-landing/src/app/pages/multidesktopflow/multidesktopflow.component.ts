// src/app/pages/multidesktopflow/multidesktopflow.component.ts
// Página placeholder para MultiDesktop Flow - Próximamente

import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-multidesktopflow',
  standalone: true,
  template: `
    <div class="coming-soon-container">
      <div class="content">
        <div class="icon-container">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" class="icon">
            <rect x="2" y="3" width="20" height="14" rx="2" stroke-width="2"/>
            <line x1="8" y1="21" x2="16" y2="21" stroke-width="2"/>
            <line x1="12" y1="17" x2="12" y2="21" stroke-width="2"/>
          </svg>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" class="icon">
            <rect x="2" y="3" width="20" height="14" rx="2" stroke-width="2"/>
            <line x1="8" y1="21" x2="16" y2="21" stroke-width="2"/>
            <line x1="12" y1="17" x2="12" y2="21" stroke-width="2"/>
          </svg>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" class="icon">
            <rect x="2" y="3" width="20" height="14" rx="2" stroke-width="2"/>
            <line x1="8" y1="21" x2="16" y2="21" stroke-width="2"/>
            <line x1="12" y1="17" x2="12" y2="21" stroke-width="2"/>
          </svg>
        </div>

        <h1 class="title">MULTIDESKTOP FLOW</h1>
        <p class="subtitle">Gestión inteligente de múltiples escritorios con IA</p>

        <div class="status-badge">
          <span class="dot"></span>
          <span>EN DESARROLLO</span>
        </div>

        <p class="description">
          Estamos trabajando en una herramienta revolucionaria para
          gestionar múltiples escritorios y flujos de trabajo con
          asistencia de Inteligencia Artificial.
        </p>

        <div class="features-preview">
          <div class="feature">
            <span class="feature-icon">→</span>
            <span>Organización automática de ventanas</span>
          </div>
          <div class="feature">
            <span class="feature-icon">→</span>
            <span>Flujos de trabajo personalizados</span>
          </div>
          <div class="feature">
            <span class="feature-icon">→</span>
            <span>Integración con herramientas de productividad</span>
          </div>
        </div>

        <button class="back-button" (click)="goBack()">
          ← VOLVER AL DUNGEON
        </button>
      </div>

      <!-- Matrix rain effect -->
      <div class="matrix-rain"></div>
    </div>
  `,
  styles: [`
    .coming-soon-container {
      min-height: 100vh;
      background: #0a0a0a;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      position: relative;
      overflow: hidden;
    }

    .content {
      text-align: center;
      max-width: 600px;
      z-index: 10;
    }

    .icon-container {
      display: flex;
      justify-content: center;
      gap: 20px;
      margin-bottom: 30px;

      .icon {
        width: 60px;
        height: 60px;
        color: #00ccff;
        opacity: 0.8;
        animation: float 3s ease-in-out infinite;

        &:nth-child(2) {
          animation-delay: 0.5s;
          color: #00ff88;
        }

        &:nth-child(3) {
          animation-delay: 1s;
          color: #ff00ff;
        }
      }
    }

    @keyframes float {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-10px); }
    }

    .title {
      font-family: 'Courier New', monospace;
      font-size: 36px;
      color: #00ccff;
      margin: 0 0 10px;
      text-shadow: 0 0 30px rgba(0, 204, 255, 0.5);
      letter-spacing: 4px;
    }

    .subtitle {
      font-family: 'Courier New', monospace;
      font-size: 16px;
      color: rgba(0, 204, 255, 0.7);
      margin: 0 0 30px;
    }

    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: rgba(255, 106, 0, 0.1);
      border: 1px solid #ff6b00;
      border-radius: 20px;
      padding: 8px 20px;
      margin-bottom: 30px;

      .dot {
        width: 8px;
        height: 8px;
        background: #ff6b00;
        border-radius: 50%;
        animation: pulse 1.5s ease-in-out infinite;
      }

      span {
        font-family: 'Courier New', monospace;
        font-size: 12px;
        color: #ff6b00;
        letter-spacing: 2px;
      }
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }

    .description {
      font-family: 'Courier New', monospace;
      font-size: 14px;
      color: rgba(255, 255, 255, 0.7);
      line-height: 1.8;
      margin: 0 0 30px;
    }

    .features-preview {
      text-align: left;
      background: rgba(0, 204, 255, 0.05);
      border: 1px solid rgba(0, 204, 255, 0.2);
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 40px;

      .feature {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 12px;
        font-family: 'Courier New', monospace;
        font-size: 13px;
        color: rgba(255, 255, 255, 0.8);

        &:last-child {
          margin-bottom: 0;
        }

        .feature-icon {
          color: #00ff44;
        }
      }
    }

    .back-button {
      background: transparent;
      border: 2px solid #00ff44;
      color: #00ff44;
      padding: 12px 24px;
      font-family: 'Courier New', monospace;
      font-size: 14px;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.3s ease;

      &:hover {
        background: #00ff44;
        color: #0a0a0a;
        box-shadow: 0 0 20px rgba(0, 255, 68, 0.4);
      }
    }

    .matrix-rain {
      position: absolute;
      inset: 0;
      background:
        repeating-linear-gradient(
          0deg,
          transparent,
          transparent 2px,
          rgba(0, 255, 68, 0.03) 2px,
          rgba(0, 255, 68, 0.03) 4px
        );
      pointer-events: none;
      animation: scanline 10s linear infinite;
    }

    @keyframes scanline {
      0% { background-position: 0 0; }
      100% { background-position: 0 100vh; }
    }
  `],
})
export class MultidesktopflowComponent {
  private router = inject(Router);

  goBack(): void {
    this.router.navigate(['/']);
  }
}
