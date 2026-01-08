/**
 * World Configuration for Expanded 3x3 Map
 * Defines world dimensions, areas, and their themes
 */

export interface AreaConfig {
  id: string;
  row: number;
  col: number;
  theme: string;
  name: string;
}

export interface AreaTheme {
  primaryColor: string;
  secondaryColor: string;
  circuitDensity: number;     // 0.5-1.5 multiplier
  glowIntensity: number;      // 0.3-1.0
  torchCount: number;         // Torches in the area
  torchPositions: { x: number; y: number }[]; // % positions within area
}

export const WORLD_CONFIG = {
  // Grid size: 3x3 viewports
  gridColumns: 3,
  gridRows: 3,

  // World dimensions calculated at runtime
  getWorldWidth: () => window.innerWidth * 3,
  getWorldHeight: () => window.innerHeight * 3,

  // Viewport dimensions
  getViewportWidth: () => window.innerWidth,
  getViewportHeight: () => window.innerHeight,

  // Get world center (for title positioning)
  getWorldCenterX: () => window.innerWidth * 1.5,
  getWorldCenterY: () => window.innerHeight * 1.5,

  // Area definitions (0-indexed from top-left)
  areas: [
    { id: 'area-0-0', row: 0, col: 0, theme: 'nuvaris', name: 'NUVARIS' },
    { id: 'area-0-1', row: 0, col: 1, theme: 'integrations', name: 'INTEGRATIONS' },
    { id: 'area-0-2', row: 0, col: 2, theme: 'rag', name: 'RAG SYSTEMS' },
    { id: 'area-1-0', row: 1, col: 0, theme: 'automation', name: 'AUTOMATION' },
    { id: 'area-1-1', row: 1, col: 1, theme: 'central', name: 'DESARROLLADOR IA' },
    { id: 'area-1-2', row: 1, col: 2, theme: 'agents', name: 'AGENTS' },
    { id: 'area-2-0', row: 2, col: 0, theme: 'finops', name: 'FINOPS AI' },
    { id: 'area-2-1', row: 2, col: 1, theme: 'llms', name: 'LOCAL LLMS' },
    { id: 'area-2-2', row: 2, col: 2, theme: 'calendly', name: 'CALENDLY' },
  ] as AreaConfig[]
};

/**
 * Theme configurations for each area
 * Each area has unique visual identity
 */
export const AREA_THEMES: Record<string, AreaTheme> = {
  'nuvaris': {
    primaryColor: '#00ff88',
    secondaryColor: '#004422',
    circuitDensity: 1.0,
    glowIntensity: 0.6,
    torchCount: 4,
    torchPositions: [
      { x: 15, y: 20 }, { x: 85, y: 20 },
      { x: 15, y: 80 }, { x: 85, y: 80 }
    ]
  },
  'integrations': {
    primaryColor: '#ff6600',
    secondaryColor: '#442200',
    circuitDensity: 1.2,
    glowIntensity: 0.7,
    torchCount: 4,
    torchPositions: [
      { x: 20, y: 25 }, { x: 80, y: 25 },
      { x: 20, y: 75 }, { x: 80, y: 75 }
    ]
  },
  'rag': {
    primaryColor: '#00ccff',
    secondaryColor: '#003344',
    circuitDensity: 1.3,
    glowIntensity: 0.65,
    torchCount: 4,
    torchPositions: [
      { x: 15, y: 20 }, { x: 85, y: 20 },
      { x: 15, y: 80 }, { x: 85, y: 80 }
    ]
  },
  'automation': {
    primaryColor: '#ff00ff',
    secondaryColor: '#440044',
    circuitDensity: 1.1,
    glowIntensity: 0.7,
    torchCount: 4,
    torchPositions: [
      { x: 20, y: 20 }, { x: 80, y: 20 },
      { x: 20, y: 80 }, { x: 80, y: 80 }
    ]
  },
  'central': {
    primaryColor: '#00ff44',
    secondaryColor: '#003311',
    circuitDensity: 0.8, // Less dense to highlight title
    glowIntensity: 0.9,  // Brightest area
    torchCount: 6,
    torchPositions: [
      { x: 10, y: 15 }, { x: 90, y: 15 },
      { x: 10, y: 50 }, { x: 90, y: 50 },
      { x: 10, y: 85 }, { x: 90, y: 85 }
    ]
  },
  'agents': {
    primaryColor: '#ff6600',
    secondaryColor: '#331100',
    circuitDensity: 1.2,
    glowIntensity: 0.65,
    torchCount: 4,
    torchPositions: [
      { x: 15, y: 25 }, { x: 85, y: 25 },
      { x: 15, y: 75 }, { x: 85, y: 75 }
    ]
  },
  'finops': {
    primaryColor: '#88ff00',
    secondaryColor: '#224400',
    circuitDensity: 1.0,
    glowIntensity: 0.6,
    torchCount: 4,
    torchPositions: [
      { x: 20, y: 20 }, { x: 80, y: 20 },
      { x: 20, y: 80 }, { x: 80, y: 80 }
    ]
  },
  'llms': {
    primaryColor: '#00ccff',
    secondaryColor: '#002244',
    circuitDensity: 1.4, // Dense for "brain" theme
    glowIntensity: 0.7,
    torchCount: 4,
    torchPositions: [
      { x: 15, y: 25 }, { x: 85, y: 25 },
      { x: 15, y: 75 }, { x: 85, y: 75 }
    ]
  },
  'calendly': {
    primaryColor: '#ff6b00',
    secondaryColor: '#331500',
    circuitDensity: 0.9,
    glowIntensity: 0.6,
    torchCount: 4,
    torchPositions: [
      { x: 20, y: 20 }, { x: 80, y: 20 },
      { x: 20, y: 80 }, { x: 80, y: 80 }
    ]
  }
};

/**
 * Helper to get area at world coordinates
 */
export function getAreaAtPosition(worldX: number, worldY: number): AreaConfig | null {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const col = Math.floor(worldX / vw);
  const row = Math.floor(worldY / vh);

  if (col < 0 || col >= 3 || row < 0 || row >= 3) return null;

  return WORLD_CONFIG.areas.find(a => a.row === row && a.col === col) || null;
}

/**
 * Get theme for area
 */
export function getAreaTheme(theme: string): AreaTheme {
  return AREA_THEMES[theme] || AREA_THEMES['central'];
}

/**
 * Convert area + local position to world coordinates
 */
export function areaToWorldPosition(
  area: { row: number; col: number },
  localX: number, // 0-100%
  localY: number  // 0-100%
): { x: number; y: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  return {
    x: (area.col * vw) + (localX / 100 * vw),
    y: (area.row * vh) + (localY / 100 * vh)
  };
}
