/**
 * Sendell Smart Responses - PHASE 1: Instant Fallback System
 * v1.0: Keyword detection with robot actions
 *
 * This system provides INSTANT responses without waiting for WebLLM.
 * Each response includes:
 * - Keywords to match user input
 * - Dialogue for Sendell to speak
 * - Robot action (walk_to_pillar, wave, etc.)
 * - Emotion for visual feedback
 *
 * The robot WALKS to relevant pillars, doesn't just talk.
 */

import { SendellResponse, RobotAction, SendellEmotion } from './sendell-ai.config';

export interface SmartResponse {
  /** Keywords to match (lowercase) - any match triggers this response */
  keywords: string[];
  /** What Sendell says */
  dialogue: string;
  /** Robot action to execute */
  action: RobotAction;
  /** Sendell's emotion */
  emotion: SendellEmotion;
  /** Priority (higher = checked first) */
  priority?: number;
}

/**
 * Smart responses ordered by priority (most specific first)
 * IMPORTANT: More specific keywords should have higher priority
 */
export const SMART_RESPONSES: SmartResponse[] = [
  // ==================== SALUDOS (Alta prioridad) ====================
  {
    keywords: ['hola', 'hey', 'buenas', 'buenos', 'hi', 'hello', 'saludos', 'qué tal', 'que tal'],
    dialogue: '¡Hola! Soy Sendell, guía de esta web. ¿Te muestro los servicios de Daniel?',
    action: { type: 'wave' },
    emotion: 'friendly',
    priority: 100
  },

  // ==================== AGENDAR/CONTACTO (Alta prioridad) ====================
  {
    keywords: ['agendar', 'agenda', 'cita', 'reunión', 'reunion', 'contacto', 'contactar', 'llamar', 'llamada', 'hablar', 'consulta', 'sesión', 'sesion', 'calendly'],
    dialogue: '¡Vamos! Aquí puedes agendar una sesión GRATIS de 30 min con Daniel.',
    action: { type: 'walk_to_pillar', target: 'calendly' },
    emotion: 'excited',
    priority: 95
  },

  // ==================== PRECIOS/COSTOS ====================
  {
    keywords: ['precio', 'precios', 'costo', 'costos', 'cuánto', 'cuanto', 'tarifa', 'cotización', 'cotizacion', 'presupuesto', 'cobra'],
    dialogue: 'Los precios varían por proyecto. ¡Agenda una sesión gratis para cotización!',
    action: { type: 'walk_to_pillar', target: 'calendly' },
    emotion: 'helpful',
    priority: 90
  },

  // ==================== SOBRE DANIEL ====================
  {
    keywords: ['daniel', 'quién es', 'quien es', 'creador', 'fundador', 'experiencia', 'trayectoria', 'background', 'sobre ti'],
    dialogue: '¡Te presento a mi creador! Daniel es consultor senior de IA.',
    action: { type: 'walk_to_pillar', target: 'about-daniel' },
    emotion: 'friendly',
    priority: 85
  },

  // ==================== SERVICIOS ESPECÍFICOS ====================

  // LLMs Locales
  {
    keywords: ['llm local', 'llm privado', 'privacidad', 'datos sensibles', 'sin internet', 'offline', 'ollama', 'infraestructura propia', 'compliance', 'gdpr'],
    dialogue: '¡Esto te interesa! LLMs que corren en TU infraestructura, sin enviar datos.',
    action: { type: 'walk_to_pillar', target: 'local-llms' },
    emotion: 'excited',
    priority: 80
  },
  {
    keywords: ['llm', 'modelo', 'modelos', 'gpt', 'inteligencia artificial'],
    dialogue: 'Te muestro los LLMs locales. Control total de tus datos.',
    action: { type: 'walk_to_pillar', target: 'local-llms' },
    emotion: 'helpful',
    priority: 70
  },

  // RAG Systems
  {
    keywords: ['rag', 'retrieval', 'búsqueda inteligente', 'busqueda inteligente', 'documentos', 'pdf', 'embeddings', 'vectores', 'chromadb', 'conocimiento'],
    dialogue: '¡RAG es poderoso! Búsqueda inteligente sobre TUS documentos.',
    action: { type: 'walk_to_pillar', target: 'rag-systems' },
    emotion: 'excited',
    priority: 80
  },
  {
    keywords: ['buscar', 'búsqueda', 'busqueda', 'encontrar', 'chatbot', 'asistente', 'preguntas', 'archivos'],
    dialogue: 'Mira el sistema RAG. Respuestas basadas en tu conocimiento.',
    action: { type: 'walk_to_pillar', target: 'rag-systems' },
    emotion: 'helpful',
    priority: 70
  },

  // Agentes
  {
    keywords: ['agente', 'agentes', 'multi-agente', 'orquestación', 'orquestacion', 'automatizar', 'automatización', 'automatizacion', 'workflow', 'langgraph', 'crewai'],
    dialogue: '¡Sígueme! Los agentes IA automatizan tareas complejas.',
    action: { type: 'walk_to_pillar', target: 'agent-orchestration' },
    emotion: 'excited',
    priority: 80
  },
  {
    keywords: ['automatizar', 'proceso', 'procesos', 'tareas', 'bots', 'robot', 'flujo', 'negocio', 'empresa'],
    dialogue: 'Aquí está la magia: agentes que trabajan por ti.',
    action: { type: 'walk_to_pillar', target: 'agent-orchestration' },
    emotion: 'helpful',
    priority: 70
  },

  // Integraciones
  {
    keywords: ['integración', 'integracion', 'integrar', 'conectar', 'api', 'erp', 'crm', 'legacy', 'webhook', 'sap', 'salesforce'],
    dialogue: '¡Te muestro las integraciones! Conectamos IA con tu stack.',
    action: { type: 'walk_to_pillar', target: 'custom-integrations' },
    emotion: 'helpful',
    priority: 80
  },
  {
    keywords: ['sistema', 'sistemas', 'software', 'aplicación', 'aplicacion', 'datos', 'migrar', 'sincronizar'],
    dialogue: 'Integraciones custom: IA que se conecta a tus sistemas.',
    action: { type: 'walk_to_pillar', target: 'custom-integrations' },
    emotion: 'helpful',
    priority: 65
  },

  // GitHub
  {
    keywords: ['github', 'código', 'codigo', 'repositorio', 'repo', 'proyectos', 'open source', 'portafolio', 'portfolio', 'ejemplos'],
    dialogue: '¡Mira el código! Aquí están los proyectos de Daniel.',
    action: { type: 'walk_to_pillar', target: 'github' },
    emotion: 'helpful',
    priority: 75
  },

  // DeskFlow
  {
    keywords: ['deskflow', 'escritorio', 'escritorios', 'notas', 'productividad', 'organizar', 'organización', 'organizacion'],
    dialogue: 'DeskFlow: escritorios virtuales para organizar tu trabajo.',
    action: { type: 'walk_to_pillar', target: 'deskflow' },
    emotion: 'helpful',
    priority: 75
  },

  // Núvariz
  {
    keywords: ['núvariz', 'nuvariz', 'nuvaris', 'universo', 'próximamente', 'proximamente', 'secreto', 'misterio'],
    dialogue: 'Universo Núvariz... algo grande viene. Stay tuned.',
    action: { type: 'walk_to_pillar', target: 'nuvaris' },
    emotion: 'curious',
    priority: 75
  },

  // ==================== SERVICIOS GENERALES ====================
  {
    keywords: ['servicio', 'servicios', 'qué ofreces', 'que ofreces', 'qué haces', 'que haces', 'ayuda', 'ayudar', 'ofrece'],
    dialogue: 'Daniel ofrece consultoría de IA. ¡Te muestro los pilares!',
    action: { type: 'walk_to_pillar', target: 'about-daniel' },
    emotion: 'helpful',
    priority: 60
  },

  // ==================== TOUR/GUÍA ====================
  {
    keywords: ['tour', 'guía', 'guia', 'guíame', 'guiame', 'muéstrame', 'muestrame', 'explorar', 'recorrido'],
    dialogue: '¡Perfecto! Te doy un tour. Empecemos por conocer a Daniel.',
    action: { type: 'walk_to_pillar', target: 'about-daniel' },
    emotion: 'excited',
    priority: 55
  },

  // ==================== IA EN GENERAL ====================
  {
    keywords: ['ia', 'inteligencia artificial', 'machine learning', 'ml', 'deep learning', 'ai'],
    dialogue: 'Daniel es experto en IA. ¡Te muestro sus especialidades!',
    action: { type: 'walk_to_pillar', target: 'local-llms' },
    emotion: 'helpful',
    priority: 50
  },

  // ==================== PREGUNTAS SOBRE SENDELL ====================
  {
    keywords: ['sendell', 'quién eres', 'quien eres', 'qué eres', 'que eres', 'robot', 'tú'],
    dialogue: '¡Soy Sendell! Robot binario creado por Daniel para guiarte aquí.',
    action: { type: 'wave' },
    emotion: 'friendly',
    priority: 85
  },

  // ==================== AGRADECIMIENTOS ====================
  {
    keywords: ['gracias', 'thanks', 'genial', 'perfecto', 'excelente', 'bien', 'ok', 'vale', 'entendido'],
    dialogue: '¡De nada! ¿Hay algo más que quieras explorar?',
    action: { type: 'idle' },
    emotion: 'friendly',
    priority: 45
  },

  // ==================== DESPEDIDAS ====================
  {
    keywords: ['adiós', 'adios', 'bye', 'chao', 'hasta luego', 'nos vemos'],
    dialogue: '¡Hasta pronto! Recuerda que puedes agendar una sesión gratis.',
    action: { type: 'wave' },
    emotion: 'friendly',
    priority: 45
  },

  // ==================== AYUDA ====================
  {
    keywords: ['ayuda', 'help', 'no entiendo', 'confundido', 'perdido', 'cómo', 'como funciona'],
    dialogue: 'Puedo mostrarte los servicios de Daniel o llevarte a agendar.',
    action: { type: 'idle' },
    emotion: 'helpful',
    priority: 40
  }
];

/**
 * Default fallback response when no keywords match
 * v8.0: Redirects to Calendly for business opportunity
 */
export const SMART_FALLBACK: SmartResponse = {
  keywords: [],
  dialogue: '¡Buena pregunta! Para respuestas más detalladas, te llevo a agendar una sesión con Daniel.',
  action: { type: 'walk_to_pillar', target: 'calendly' },
  emotion: 'helpful',
  priority: 0
};

/**
 * Get the best matching smart response for user input
 * Returns the highest priority match, or fallback if none
 * v8.1: Auto-energize is handled by landing-page when walk completes
 */
export function getSmartResponse(input: string): SendellResponse {
  const normalized = input.toLowerCase().trim();

  // Sort by priority (highest first)
  const sortedResponses = [...SMART_RESPONSES].sort(
    (a, b) => (b.priority || 0) - (a.priority || 0)
  );

  // Find first matching response
  for (const response of sortedResponses) {
    for (const keyword of response.keywords) {
      if (normalized.includes(keyword)) {
        console.log(`[SmartResponse] Matched keyword "${keyword}" → ${response.action.type}${response.action.target ? ':' + response.action.target : ''}`);
        return {
          actions: [response.action],
          dialogue: response.dialogue,
          emotion: response.emotion
        };
      }
    }
  }

  // No match - return fallback
  console.log('[SmartResponse] No keyword match, using fallback');
  return {
    actions: [SMART_FALLBACK.action],
    dialogue: SMART_FALLBACK.dialogue,
    emotion: SMART_FALLBACK.emotion
  };
}

/**
 * Check if a response would trigger a pillar walk
 * Useful for UI feedback
 */
export function wouldWalkToPillar(input: string): string | null {
  const response = getSmartResponse(input);
  const walkAction = response.actions.find(a => a.type === 'walk_to_pillar');
  return walkAction?.target || null;
}
