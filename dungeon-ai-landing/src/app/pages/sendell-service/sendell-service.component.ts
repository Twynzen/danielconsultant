import { Component, signal, computed, OnInit, OnDestroy, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BinaryCharacterComponent } from '../../components/binary-character/binary-character.component';

interface AgentType {
  id: string;
  label: string;
  color: string;
  colorDim: string;
  bgTint: string;
  hueRotate: string;
  title: string;
  desc: string;
}

@Component({
  selector: 'app-sendell-service',
  standalone: true,
  imports: [RouterLink, BinaryCharacterComponent],
  templateUrl: './sendell-service.component.html',
  styleUrl: './sendell-service.component.scss',
})
export class SendellServiceComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('particleCanvas', { static: false }) canvasRef!: ElementRef<HTMLCanvasElement>;

  readonly agentTypes: AgentType[] = [
    {
      id: 'personal',
      label: 'PERSONAL',
      color: '#ffffff',
      colorDim: 'rgba(255, 255, 255, 0.4)',
      bgTint: 'radial-gradient(ellipse at 50% 40%, rgba(255, 255, 255, 0.04) 0%, transparent 70%)',
      hueRotate: '240deg',
      title: 'Asistente Personal',
      desc: 'Tu asistente 24/7. Organiza tu vida, recuerda todo, te ayuda a pensar.',
    },
    {
      id: 'soporte',
      label: 'SOPORTE',
      color: '#ff4444',
      colorDim: 'rgba(255, 68, 68, 0.4)',
      bgTint: 'radial-gradient(ellipse at 50% 40%, rgba(255, 68, 68, 0.05) 0%, transparent 70%)',
      hueRotate: '315deg',
      title: 'Atenci\u00f3n al Cliente',
      desc: 'Responde preguntas, resuelve dudas, escala cuando necesita. Autom\u00e1tico.',
    },
    {
      id: 'negocios',
      label: 'NEGOCIOS',
      color: '#4488ff',
      colorDim: 'rgba(68, 136, 255, 0.4)',
      bgTint: 'radial-gradient(ellipse at 50% 40%, rgba(68, 136, 255, 0.05) 0%, transparent 70%)',
      hueRotate: '190deg',
      title: 'Automatizaci\u00f3n Empresarial',
      desc: 'Ventas, an\u00e1lisis, reportes, integraciones. Tu equipo digital.',
    },
  ];

  selectedIndex = signal(0);
  selected = computed(() => this.agentTypes[this.selectedIndex()]);

  private animId = 0;
  private particles: { x: number; y: number; vx: number; vy: number; size: number; alpha: number; }[] = [];

  selectAgent(index: number): void {
    this.selectedIndex.set(index);
  }

  onAgendarClick(): void {
    window.open('https://calendly.com/danielconsultant', '_blank');
  }

  ngOnInit(): void {
    // Particles initialized in afterViewInit
  }

  ngAfterViewInit(): void {
    this.initParticles();
  }

  ngOnDestroy(): void {
    if (this.animId) cancelAnimationFrame(this.animId);
  }

  private initParticles(): void {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Create particles
    for (let i = 0; i < 40; i++) {
      this.particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        size: Math.random() * 2 + 0.5,
        alpha: Math.random() * 0.3 + 0.05,
      });
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const agent = this.agentTypes[this.selectedIndex()];
      const color = agent.color;

      for (const p of this.particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.globalAlpha = p.alpha;
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      this.animId = requestAnimationFrame(animate);
    };
    animate();
  }
}
