/**
 * Action Catalog Configuration
 * v5.4.0: Sistema de acciones unificado para Sendell
 *
 * Este catálogo define TODAS las acciones que Sendell puede ejecutar.
 * Cada acción mapea a inputs de teclado reales, permitiendo que
 * Sendell haga TODO lo que el usuario puede hacer.
 *
 * El LLM usa este catálogo como contexto RAG para decidir qué acciones
 * tomar basándose en el estado actual del mundo.
 */

// ==================== TIPOS ====================

export type ActionCategory = 'movement' | 'interaction' | 'animation' | 'navigation';
export type ActionDuration = 'instant' | 'continuous' | 'until_condition';

export interface ActionDefinition {
  id: string;
  name: string;
  description: string;
  keyboardInput: string[];      // Teclas que simula (KeyD, KeyA, Space, Enter, etc.)
  duration: ActionDuration;
  condition?: string;           // Para acciones con condición de parada
  category: ActionCategory;
  canInterrupt: boolean;        // Si puede ser interrumpida por otra acción
}

// ==================== CATÁLOGO DE ACCIONES ====================

export const ACTION_CATALOG: ActionDefinition[] = [
  // === MOVIMIENTO BÁSICO ===
  {
    id: 'walk_right',
    name: 'Caminar a la derecha',
    description: 'Sendell camina hacia la derecha (mantiene presionada la tecla D)',
    keyboardInput: ['KeyD'],
    duration: 'continuous',
    category: 'movement',
    canInterrupt: true
  },
  {
    id: 'walk_left',
    name: 'Caminar a la izquierda',
    description: 'Sendell camina hacia la izquierda (mantiene presionada la tecla A)',
    keyboardInput: ['KeyA'],
    duration: 'continuous',
    category: 'movement',
    canInterrupt: true
  },
  {
    id: 'stop',
    name: 'Detenerse',
    description: 'Sendell deja de caminar (suelta todas las teclas de movimiento)',
    keyboardInput: [],
    duration: 'instant',
    category: 'movement',
    canInterrupt: false
  },
  {
    id: 'jump',
    name: 'Saltar',
    description: 'Sendell salta en el lugar (presiona Space)',
    keyboardInput: ['Space'],
    duration: 'instant',
    category: 'movement',
    canInterrupt: false
  },

  // === NAVEGACIÓN A PILARES ===
  {
    id: 'walk_to_pillar',
    name: 'Caminar a un pilar',
    description: 'Sendell camina hacia un pilar específico hasta llegar (usa D o A según dirección)',
    keyboardInput: ['KeyD', 'KeyA'], // Se decide en runtime según dirección
    duration: 'until_condition',
    condition: 'distancia_al_pilar < 50',
    category: 'navigation',
    canInterrupt: true
  },

  // === INTERACCIÓN CON PILARES ===
  {
    id: 'activate_pillar',
    name: 'Activar pilar',
    description: 'Sendell activa el pilar más cercano para mostrar su holograma (presiona Enter)',
    keyboardInput: ['Enter'],
    duration: 'instant',
    category: 'interaction',
    canInterrupt: false
  },
  {
    id: 'exit_pillar',
    name: 'Salir del pilar',
    description: 'Sendell sale del pilar actual y desactiva el holograma (presiona Enter)',
    keyboardInput: ['Enter'],
    duration: 'instant',
    category: 'interaction',
    canInterrupt: false
  },
  {
    id: 'energize_pillar',
    name: 'Energizar pilar',
    description: 'Sendell entra al pilar y lo energiza con animación de partículas',
    keyboardInput: ['Enter'],
    duration: 'instant',
    category: 'interaction',
    canInterrupt: false
  },

  // === ANIMACIONES/EXPRESIONES ===
  {
    id: 'wave',
    name: 'Saludar',
    description: 'Sendell hace una animación de saludo amigable',
    keyboardInput: [],
    duration: 'instant',
    category: 'animation',
    canInterrupt: false
  },
  {
    id: 'idle',
    name: 'Esperar',
    description: 'Sendell no hace nada, solo espera pacientemente',
    keyboardInput: [],
    duration: 'instant',
    category: 'animation',
    canInterrupt: true
  },
  {
    id: 'crash',
    name: 'Crash dramático',
    description: 'Sendell se destruye dramáticamente (solo para reinicio de conversación)',
    keyboardInput: [],
    duration: 'instant',
    category: 'animation',
    canInterrupt: false
  },
  {
    id: 'point_at',
    name: 'Señalar',
    description: 'Sendell señala hacia un objetivo específico',
    keyboardInput: [],
    duration: 'instant',
    category: 'animation',
    canInterrupt: true
  }
];

// ==================== POSICIONES DE PILARES (RAG) ====================

export interface PillarInfo {
  x: number;
  name: string;
  description: string;
}

export const PILLAR_POSITIONS_RAG: Record<string, PillarInfo> = {
  'about-daniel': {
    x: 1000,
    name: 'Quién es Daniel',
    description: 'Información sobre Daniel Castiblanco, consultor de IA'
  },
  'local-llms': {
    x: 1600,
    name: 'LLMs Locales',
    description: 'Servicio de implementación de modelos de lenguaje en infraestructura propia'
  },
  'rag-systems': {
    x: 2200,
    name: 'Sistemas RAG',
    description: 'Retrieval Augmented Generation para búsqueda inteligente'
  },
  'agent-orchestration': {
    x: 2800,
    name: 'Orquestación de Agentes',
    description: 'Coordinación de múltiples agentes IA trabajando juntos'
  },
  'custom-integrations': {
    x: 3400,
    name: 'Integraciones Custom',
    description: 'Integraciones personalizadas de IA en sistemas existentes'
  },
  'calendly': {
    x: 4000,
    name: 'Agendar Sesión',
    description: 'Reservar una sesión gratuita de consultoría con Daniel'
  },
  'github': {
    x: 4600,
    name: 'GitHub',
    description: 'Repositorio de código y proyectos de Daniel'
  },
  'nuvaris': {
    x: 5200,
    name: 'Núvariz',
    description: 'Universo Núvariz - Próximamente'
  },
  'deskflow': {
    x: 5800,
    name: 'DeskFlow',
    description: 'Escritorios virtuales con notas y conexiones'
  }
};

// ==================== FUNCIONES RAG ====================

/**
 * Obtiene una acción del catálogo por su ID
 */
export function getActionById(actionId: string): ActionDefinition | undefined {
  return ACTION_CATALOG.find(a => a.id === actionId);
}

/**
 * Obtiene todas las acciones de una categoría
 */
export function getActionsByCategory(category: ActionCategory): ActionDefinition[] {
  return ACTION_CATALOG.filter(a => a.category === category);
}

/**
 * Calcula la dirección y distancia a un pilar desde una posición X
 */
export function calculatePillarDistance(
  robotX: number,
  pillarId: string
): { distance: number; direction: 'left' | 'right' | 'at_pillar' } | null {
  const pillar = PILLAR_POSITIONS_RAG[pillarId];
  if (!pillar) return null;

  const distance = Math.abs(robotX - pillar.x);

  if (distance < 50) {
    return { distance, direction: 'at_pillar' };
  }

  return {
    distance,
    direction: pillar.x > robotX ? 'right' : 'left'
  };
}

/**
 * Encuentra los pilares más cercanos a una posición X
 */
export function findNearbyPillars(
  robotX: number,
  maxCount: number = 3
): Array<{ id: string; name: string; distance: number; direction: 'left' | 'right' | 'at_pillar' }> {
  return Object.entries(PILLAR_POSITIONS_RAG)
    .map(([id, info]) => {
      const distance = Math.abs(robotX - info.x);
      let direction: 'left' | 'right' | 'at_pillar';

      if (distance < 50) {
        direction = 'at_pillar';
      } else {
        direction = info.x > robotX ? 'right' : 'left';
      }

      return {
        id,
        name: info.name,
        distance,
        direction
      };
    })
    .sort((a, b) => a.distance - b.distance)
    .slice(0, maxCount);
}

/**
 * Genera el contexto RAG completo para el LLM
 * Incluye posición actual, pilares cercanos y acciones disponibles
 */
export function generateActionRAGContext(robotX: number): string {
  const nearbyPillars = findNearbyPillars(robotX, 3);
  const atPillar = nearbyPillars.find(p => p.direction === 'at_pillar');

  // Agrupar acciones por categoría para mejor comprensión
  const movementActions = getActionsByCategory('movement');
  const navigationActions = getActionsByCategory('navigation');
  const interactionActions = getActionsByCategory('interaction');
  const animationActions = getActionsByCategory('animation');

  let context = `
## POSICIÓN ACTUAL
Robot en x=${Math.round(robotX)}
${atPillar ? `FRENTE AL PILAR: ${atPillar.name} (${atPillar.id})` : ''}

## PILARES CERCANOS
${nearbyPillars.map(p => {
  if (p.direction === 'at_pillar') {
    return `- ${p.id} (${p.name}): ESTÁS AQUÍ`;
  }
  return `- ${p.id} (${p.name}): ${p.distance}px a la ${p.direction === 'right' ? 'derecha' : 'izquierda'}`;
}).join('\n')}

## ACCIONES DE MOVIMIENTO
${movementActions.map(a => `- ${a.id}: ${a.description}`).join('\n')}

## ACCIONES DE NAVEGACIÓN
${navigationActions.map(a => `- ${a.id}: ${a.description}`).join('\n')}

## ACCIONES DE INTERACCIÓN
${interactionActions.map(a => `- ${a.id}: ${a.description}`).join('\n')}

## EXPRESIONES
${animationActions.map(a => `- ${a.id}: ${a.description}`).join('\n')}

## CÓMO EJECUTAR ACCIONES
Para caminar a un pilar: {"type": "walk_to_pillar", "target": "pillar-id"}
Para activar pilar cercano (<50px): {"type": "activate_pillar"}
Para detenerse: {"type": "stop"}
Para saltar: {"type": "jump"}

IMPORTANTE: Las acciones de movimiento simulan teclas reales.
walk_to_pillar camina a 300px/s hasta llegar al destino.
`;

  return context.trim();
}

/**
 * Valida si una acción es válida dado el contexto actual
 */
export function validateAction(
  actionType: string,
  target: string | undefined,
  robotX: number
): { valid: boolean; reason?: string } {
  const action = getActionById(actionType);

  if (!action) {
    return { valid: false, reason: `Acción desconocida: ${actionType}` };
  }

  // Validar acciones que requieren target
  if (actionType === 'walk_to_pillar') {
    if (!target) {
      return { valid: false, reason: 'walk_to_pillar requiere un target (pillar id)' };
    }
    if (!PILLAR_POSITIONS_RAG[target]) {
      return { valid: false, reason: `Pilar desconocido: ${target}` };
    }
  }

  // Validar acciones que requieren estar cerca de un pilar
  if (actionType === 'activate_pillar' || actionType === 'energize_pillar' || actionType === 'exit_pillar') {
    const nearby = findNearbyPillars(robotX, 1);
    if (!nearby[0] || nearby[0].distance > 100) {
      return { valid: false, reason: 'No hay ningún pilar cercano para interactuar' };
    }
  }

  return { valid: true };
}
