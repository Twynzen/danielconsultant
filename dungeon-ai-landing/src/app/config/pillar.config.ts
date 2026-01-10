/**
 * Pillar Configuration - Side-Scroller Mode
 * Pillars distributed horizontally across the level
 */

import { SIDESCROLLER_CONFIG, SIDESCROLLER_PILLAR_POSITIONS, getPillarY } from './sidescroller.config';

/**
 * v6.0: Configuration for hologram-type pillars with animated frames
 * v6.1: Added svgType for CSS-animated SVG holograms
 */
export interface HologramConfig {
  frameFolder?: string;   // Folder in assets/ (e.g., 'gifllmlocal') - optional if using svgType
  framePrefix?: string;   // File prefix (e.g., 'llmlocal' for llmlocal-001.png) - optional if using svgType
  frameCount?: number;    // Number of frames (default: 30)
  hasModal?: boolean;     // If true, clicking hologram opens modal with service info
  svgType?: 'calendar' | 'planet';  // v6.1: Use CSS-animated SVG instead of PNG frames
  externalUrl?: string;   // v6.1: If set, clicking opens this URL instead of modal
}

export interface PillarConfig {
  id: string;
  label: string;
  icon: string;
  type: 'external' | 'modal' | 'about' | 'internal' | 'hologram';  // v6.0: Added 'hologram' for animated holograms
  destination: string;
  color: string;
  worldX: number;           // Horizontal position in world
  description?: string;
  hologramConfig?: HologramConfig;  // v6.0: Config for hologram-type pillars
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
  </svg>`,

  // v5.2.3: GitHub icon
  'github': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
    <path d="M12 2C6.48 2 2 6.48 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0012 2z"/>
  </svg>`
};

/**
 * 9 Pillars distributed horizontally across the side-scroller level
 * v5.2.3: Added GitHub pillar, marked Núvariz & MultiDesktopFlow as "Próximamente"
 * Layout:
 * |--spawn--|--QUIÉN SOY--|--LOCAL LLMS--|--RAG--|--AGENTS--|--INTEGRATIONS--|--CALENDLY--|--GITHUB--|--NÚVARIZ--|--MDF--|
 *    400px      1000px        1600px      2200px    2800px       3400px          4000px      4600px     5200px     5800px
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
  // v6.0: LOCAL LLMS with animated hologram (city isometric animation)
  {
    id: 'local-llms',
    label: 'LOCAL LLMS',
    icon: 'brain',
    type: 'hologram',  // Changed from 'modal' to show animated hologram
    destination: 'local-llms',
    color: '#00ccff',
    worldX: 1600,
    description: 'Modelos de Lenguaje Locales',
    hologramConfig: {
      frameFolder: 'gifllmlocal',
      framePrefix: 'llmlocal',
      frameCount: 30,
      hasModal: true  // Clicking hologram opens modal with service info
    }
  },
  // v6.1: RAG with animated hologram (red neural network animation)
  {
    id: 'rag-systems',
    label: 'RAG SYSTEMS',
    icon: 'database',
    type: 'hologram',
    destination: 'rag-systems',
    color: '#ff3344',  // Matrix Red
    worldX: 2200,
    description: 'Sistemas de Retrieval Augmented Generation',
    hologramConfig: {
      frameFolder: 'gifrag',
      framePrefix: 'rag',
      frameCount: 30,
      hasModal: true
    }
  },
  // v6.1: AGENTS with animated hologram (white theme)
  {
    id: 'agent-orchestration',
    label: 'AGENTS',
    icon: 'robot',
    type: 'hologram',
    destination: 'agent-orchestration',
    color: '#ffffff',  // White
    worldX: 2800,
    description: 'Orquestación de Agentes de IA',
    hologramConfig: {
      frameFolder: 'gifagents',
      framePrefix: 'agents',
      frameCount: 30,
      hasModal: true
    }
  },
  // v6.1: INTEGRATIONS with animated hologram (orange theme)
  {
    id: 'custom-integrations',
    label: 'INTEGRATIONS',
    icon: 'plug',
    type: 'hologram',
    destination: 'custom-integrations',
    color: '#ff6600',  // Orange
    worldX: 3400,
    description: 'Integraciones personalizadas con IA',
    hologramConfig: {
      frameFolder: 'gifintegrations',
      framePrefix: 'integrations',
      frameCount: 30,
      hasModal: true
    }
  },
  // v6.1: Calendly with animated SVG calendar hologram (green theme)
  {
    id: 'calendly',
    label: 'AGENDAR',
    icon: 'calendar',
    type: 'hologram',
    destination: 'https://calendly.com/darmcastiblanco/30min',
    color: '#00ffaa',  // Turquoise (distinct from Quién Soy green)
    worldX: 4000,
    description: 'Agenda una sesión de consultoría',
    hologramConfig: {
      svgType: 'calendar',
      hasModal: false,
      externalUrl: 'https://calendly.com/darmcastiblanco/30min'
    }
  },
  // v6.1: GitHub pillar with animated hologram - opens external URL
  {
    id: 'github',
    label: 'GITHUB',
    icon: 'github',
    type: 'hologram',
    destination: 'https://github.com/Twynzen',
    color: '#ffffff',  // White for GitHub
    worldX: 4600,
    description: 'Mis proyectos en GitHub',
    hologramConfig: {
      frameFolder: 'gifgithub',
      framePrefix: 'github',
      frameCount: 30,
      hasModal: false,
      externalUrl: 'https://github.com/Twynzen'
    }
  },
  // v6.1: Núvariz - Universo próximamente with planet SVG hologram
  {
    id: 'nuvaris',
    label: 'NÚVARIZ',
    icon: 'globe',
    type: 'hologram',
    destination: 'nuvaris',
    color: '#00ff88',
    worldX: 5200,
    description: 'Universo Núvariz - Próximamente',
    hologramConfig: {
      svgType: 'planet',
      hasModal: true
    }
  },
  // v6.3: DeskFlow - App de escritorios virtuales
  {
    id: 'deskflow',
    label: 'DESKFLOW',
    icon: 'desktop',
    type: 'external',  // Opens external app at /deskflow
    destination: '/deskflow',
    color: '#aa00ff',
    worldX: 5800,
    description: 'DeskFlow - Escritorios virtuales inteligentes'
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
