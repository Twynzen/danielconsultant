/**
 * Pillar Configuration - Side-Scroller Mode
 * Pillars distributed horizontally across the level
 */

import { SIDESCROLLER_CONFIG, SIDESCROLLER_PILLAR_POSITIONS, getPillarY } from './sidescroller.config';

export interface PillarConfig {
  id: string;
  label: string;
  icon: string;
  type: 'external' | 'modal' | 'about' | 'internal';  // v5.1: Added 'internal' for Angular routes
  destination: string;
  color: string;
  worldX: number;           // Horizontal position in world
  description?: string;
}

/**
 * SVG Icons for pillars
 */
export const PILLAR_ICONS: Record<string, string> = {
  'globe': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
    <circle cx="12" cy="12" r="10"/>
    <ellipse cx="12" cy="12" rx="10" ry="4"/>
    <line x1="12" y1="2" x2="12" y2="22"/>
    <line x1="2" y1="12" x2="22" y2="12"/>
  </svg>`,

  'plug': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
    <rect x="6" y="2" width="4" height="8" rx="1"/>
    <rect x="14" y="2" width="4" height="8" rx="1"/>
    <path d="M6 10h12v4a6 6 0 01-6 6 6 6 0 01-6-6v-4z"/>
    <line x1="12" y1="20" x2="12" y2="22"/>
  </svg>`,

  'database': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
    <ellipse cx="12" cy="5" rx="8" ry="3"/>
    <path d="M4 5v14c0 1.66 3.58 3 8 3s8-1.34 8-3V5"/>
    <path d="M4 12c0 1.66 3.58 3 8 3s8-1.34 8-3"/>
  </svg>`,

  'robot': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
    <rect x="4" y="6" width="16" height="14" rx="2"/>
    <circle cx="9" cy="12" r="2"/>
    <circle cx="15" cy="12" r="2"/>
    <line x1="9" y1="17" x2="15" y2="17"/>
    <line x1="12" y1="2" x2="12" y2="6"/>
    <circle cx="12" cy="2" r="1"/>
  </svg>`,

  'brain': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
    <path d="M12 4c-2 0-3.5 1-4 2.5C6.5 6 5 7 5 9c0 1.5 1 2.5 2 3-1 .5-2 1.5-2 3 0 2 2 3.5 4 3.5.5 1.5 1.5 2.5 3 2.5s2.5-1 3-2.5c2 0 4-1.5 4-3.5 0-1.5-1-2.5-2-3 1-.5 2-1.5 2-3 0-2-1.5-3-3-3.5-.5-1.5-2-2.5-4-2.5z"/>
    <path d="M12 4v17"/>
    <path d="M7 9h10"/>
    <path d="M7 15h10"/>
  </svg>`,

  'gear': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
    <circle cx="12" cy="12" r="3"/>
    <path d="M12 1v3M12 20v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M1 12h3M20 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/>
  </svg>`,

  'chart': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
    <rect x="3" y="14" width="4" height="8"/>
    <rect x="10" y="9" width="4" height="13"/>
    <rect x="17" y="4" width="4" height="18"/>
    <path d="M3 4l7 5 7-5"/>
  </svg>`,

  'calendar': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
    <rect x="3" y="4" width="18" height="18" rx="2"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
    <line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="16" y1="2" x2="16" y2="6"/>
    <circle cx="12" cy="15" r="2" fill="currentColor"/>
  </svg>`,

  // v4.8: User icon for "About Daniel" pillar
  'user': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
    <circle cx="12" cy="8" r="4"/>
    <path d="M4 20c0-4 4-6 8-6s8 2 8 6"/>
    <path d="M12 14v2"/>
  </svg>`,

  // v5.1: Desktop icon for MultiDesktopFlow
  'desktop': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
    <rect x="2" y="3" width="20" height="14" rx="2"/>
    <line x1="8" y1="21" x2="16" y2="21"/>
    <line x1="12" y1="17" x2="12" y2="21"/>
    <path d="M6 7h4M6 10h8"/>
  </svg>`
};

/**
 * 8 Pillars distributed horizontally across the side-scroller level
 * v5.1: Reorganized - removed FinOps AI & Process Automation, added MultiDesktopFlow
 * Layout:
 * |--spawn--|--QUIÉN SOY--|--LOCAL LLMS--|--RAG--|--AGENTS--|--INTEGRATIONS--|--CALENDLY--|--NUVARIS--|--MULTIDESKTOPFLOW--|
 *    400px      1000px        1600px      2200px    2800px       3400px          4000px       4600px         5200px
 */
export const PILLARS: PillarConfig[] = [
  // v5.1: "Quién Soy" pillar with animated hologram portrait
  {
    id: 'about-daniel',
    label: 'QUIÉN SOY',
    icon: 'user',
    type: 'about',
    destination: 'about',
    color: '#00ff44',  // Matrix green
    worldX: 1000,
    description: 'Consultor de Inteligencia Artificial'
  },
  {
    id: 'local-llms',
    label: 'LOCAL LLMS',
    icon: 'brain',
    type: 'modal',
    destination: 'local-llms',
    color: '#00ccff',
    worldX: 1600,
    description: 'Modelos de Lenguaje Locales'
  },
  {
    id: 'rag-systems',
    label: 'RAG SYSTEMS',
    icon: 'database',
    type: 'modal',
    destination: 'rag-systems',
    color: '#00ccff',
    worldX: 2200,
    description: 'Sistemas de Retrieval Augmented Generation'
  },
  {
    id: 'agent-orchestration',
    label: 'AGENTS',
    icon: 'robot',
    type: 'modal',
    destination: 'agent-orchestration',
    color: '#ff6600',
    worldX: 2800,
    description: 'Orquestación de Agentes de IA'
  },
  {
    id: 'custom-integrations',
    label: 'INTEGRATIONS',
    icon: 'plug',
    type: 'modal',
    destination: 'custom-integrations',
    color: '#ff6600',
    worldX: 3400,
    description: 'Integraciones personalizadas con IA'
  },
  {
    id: 'calendly',
    label: 'AGENDAR',
    icon: 'calendar',
    type: 'external',
    destination: 'https://calendly.com/darmcastiblanco/30min',
    color: '#ff6b00',
    worldX: 4000,
    description: 'Agenda una sesión de consultoría'
  },
  {
    id: 'nuvaris',
    label: 'NUVARIS',
    icon: 'globe',
    type: 'external',
    destination: 'https://nuvaris.com',
    color: '#00ff88',
    worldX: 4600,
    description: 'Visita Nuvaris - Plataforma de IA'
  },
  {
    id: 'multidesktopflow',
    label: 'MULTIDESKTOPFLOW',
    icon: 'desktop',
    type: 'internal',
    destination: '/multidesktopflow',
    color: '#aa00ff',  // Purple for internal route
    worldX: 5200,
    description: 'Sistema de flujo multi-escritorio'
  }
];

/**
 * Interaction radii for pillars
 */
export const PILLAR_INTERACTION = {
  HIGHLIGHT_RADIUS: SIDESCROLLER_CONFIG.PILLAR_HIGHLIGHT_RADIUS,
  HOLOGRAM_RADIUS: SIDESCROLLER_CONFIG.PILLAR_HOLOGRAM_RADIUS,
  INTERACT_RADIUS: SIDESCROLLER_CONFIG.PILLAR_INTERACT_RADIUS,
  PILLAR_WIDTH: 60,
  PILLAR_HEIGHT: 120
};

/**
 * Get world position for a pillar
 */
export function getPillarWorldPosition(pillar: PillarConfig): { x: number; y: number } {
  return {
    x: pillar.worldX,
    y: getPillarY()
  };
}
