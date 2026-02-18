/**
 * Sendell Smart Responses - PHASE 1: Instant Fallback System
 * v2.0: Keyword detection with CONVERSATIONAL GUARD
 *
 * This system provides INSTANT responses without waiting for WebLLM.
 * Each response includes:
 * - Keywords to match user input
 * - Dialogue for Sendell to speak (direct action version)
 * - dialogueConversational: softer version that ASKS before walking
 * - Robot action (walk_to_pillar, wave, etc.)
 * - Emotion for visual feedback
 *
 * v2.0: The robot ASKS before walking to pillars.
 * Actions only execute after user confirmation.
 */

import { SendellResponse, RobotAction, SendellEmotion } from './sendell-ai.config';

export interface SmartResponse {
  /** Keywords to match (lowercase) - any match triggers this response */
  keywords: string[];
  /** What Sendell says (direct action version) */
  dialogue: string;
  /** Conversational variant (no walk, asks first) */
  dialogueConversational?: string;
  /** Robot action to execute */
  action: RobotAction;
  /** Sendell's emotion */
  emotion: SendellEmotion;
  /** Priority (higher = checked first) */
  priority?: number;
}

/** Options for getSmartResponse */
export interface SmartResponseOptions {
  /** If true, use conversational dialogue and suppress walk_to_pillar actions */
  conversational?: boolean;
}

/**
 * Smart responses ordered by priority (most specific first)
 * IMPORTANT: More specific keywords should have higher priority
 */
export const SMART_RESPONSES: SmartResponse[] = [
  // ==================== SALUDOS (Alta prioridad) ====================
  {
    keywords: ['hola', 'hey', 'buenas', 'buenos', 'hi', 'hello', 'saludos', 'qué tal', 'que tal'],
    dialogue: '¡Hola! Soy Sendell, guía de esta web. ¿Con quién tengo el gusto?',
    action: { type: 'wave' },
    emotion: 'friendly',
    priority: 100
  },

  // ==================== AGENDAR/CONTACTO (Alta prioridad) ====================
  {
    keywords: ['agendar', 'agenda', 'cita', 'reunión', 'reunion', 'contacto', 'contactar', 'llamar', 'llamada', 'hablar', 'consulta', 'sesión', 'sesion', 'calendly'],
    dialogue: '¡Vamos! Aquí puedes agendar una sesión GRATIS de 30 min con Daniel.',
    dialogueConversational: '¡Daniel ofrece sesiones gratuitas de 30 min! ¿Te llevo a agendar una?',
    action: { type: 'walk_to_pillar', target: 'calendly' },
    emotion: 'excited',
    priority: 95
  },

  // ==================== PRECIOS/COSTOS ====================
  {
    keywords: ['precio', 'precios', 'costo', 'costos', 'cuánto', 'cuanto', 'tarifa', 'cotización', 'cotizacion', 'presupuesto', 'cobra'],
    dialogue: 'Los precios varían por proyecto. ¡Agenda una sesión gratis para cotización!',
    dialogueConversational: 'Los precios varían según el proyecto. ¿Quieres que te lleve a agendar una sesión gratis para cotización?',
    action: { type: 'walk_to_pillar', target: 'calendly' },
    emotion: 'helpful',
    priority: 90
  },

  // ==================== SOBRE DANIEL ====================
  {
    keywords: ['daniel', 'quién es', 'quien es', 'creador', 'fundador', 'experiencia', 'trayectoria', 'background', 'sobre ti'],
    dialogue: '¡Te presento a mi creador! Daniel es consultor senior de IA.',
    dialogueConversational: 'Daniel es consultor senior de IA con amplia experiencia. ¿Te llevo a conocer más sobre él?',
    action: { type: 'walk_to_pillar', target: 'about-daniel' },
    emotion: 'friendly',
    priority: 85
  },

  // ==================== SERVICIOS ESPECÍFICOS ====================

  // LLMs Locales
  {
    keywords: ['llm local', 'llm privado', 'privacidad', 'datos sensibles', 'sin internet', 'offline', 'ollama', 'infraestructura propia', 'compliance', 'gdpr'],
    dialogue: '¡Esto te interesa! LLMs que corren en TU infraestructura, sin enviar datos.',
    dialogueConversational: '¡Tenemos LLMs que corren en tu propia infraestructura, sin enviar datos afuera! ¿Te llevo a ver más?',
    action: { type: 'walk_to_pillar', target: 'local-llms' },
    emotion: 'excited',
    priority: 80
  },
  {
    keywords: ['llm', 'modelo', 'modelos', 'gpt', 'inteligencia artificial'],
    dialogue: 'Te muestro los LLMs locales. Control total de tus datos.',
    dialogueConversational: 'Daniel trabaja con LLMs locales, control total de tus datos. ¿Quieres que te muestre esa área?',
    action: { type: 'walk_to_pillar', target: 'local-llms' },
    emotion: 'helpful',
    priority: 70
  },

  // RAG Systems
  {
    keywords: ['rag', 'retrieval', 'búsqueda inteligente', 'busqueda inteligente', 'documentos', 'pdf', 'embeddings', 'vectores', 'chromadb', 'conocimiento'],
    dialogue: '¡RAG es poderoso! Búsqueda inteligente sobre TUS documentos.',
    dialogueConversational: 'RAG permite búsqueda inteligente sobre tus propios documentos. ¿Te interesa ver cómo funciona?',
    action: { type: 'walk_to_pillar', target: 'rag-systems' },
    emotion: 'excited',
    priority: 80
  },
  {
    keywords: ['buscar', 'búsqueda', 'busqueda', 'encontrar', 'chatbot', 'asistente', 'preguntas', 'archivos'],
    dialogue: 'Mira el sistema RAG. Respuestas basadas en tu conocimiento.',
    dialogueConversational: 'Tenemos un sistema RAG que da respuestas basadas en tu conocimiento. ¿Te llevo a explorarlo?',
    action: { type: 'walk_to_pillar', target: 'rag-systems' },
    emotion: 'helpful',
    priority: 70
  },

  // Agentes
  {
    keywords: ['agente', 'agentes', 'multi-agente', 'orquestación', 'orquestacion', 'automatizar', 'automatización', 'automatizacion', 'workflow', 'langgraph', 'crewai'],
    dialogue: '¡Sígueme! Los agentes IA automatizan tareas complejas.',
    dialogueConversational: 'Los agentes IA pueden automatizar tareas complejas de tu negocio. ¿Te llevo a ver cómo?',
    action: { type: 'walk_to_pillar', target: 'agent-orchestration' },
    emotion: 'excited',
    priority: 80
  },
  {
    keywords: ['automatizar', 'proceso', 'procesos', 'tareas', 'bots', 'robot', 'flujo', 'negocio', 'empresa'],
    dialogue: 'Aquí está la magia: agentes que trabajan por ti.',
    dialogueConversational: 'Podemos crear agentes que automatizan procesos de tu negocio. ¿Quieres ver esa sección?',
    action: { type: 'walk_to_pillar', target: 'agent-orchestration' },
    emotion: 'helpful',
    priority: 70
  },

  // Integraciones
  {
    keywords: ['integración', 'integracion', 'integrar', 'conectar', 'api', 'erp', 'crm', 'legacy', 'webhook', 'sap', 'salesforce'],
    dialogue: '¡Te muestro las integraciones! Conectamos IA con tu stack.',
    dialogueConversational: 'Daniel conecta IA con tu stack existente: APIs, ERPs, CRMs... ¿Te llevo a ver las integraciones?',
    action: { type: 'walk_to_pillar', target: 'custom-integrations' },
    emotion: 'helpful',
    priority: 80
  },
  {
    keywords: ['sistema', 'sistemas', 'software', 'aplicación', 'aplicacion', 'datos', 'migrar', 'sincronizar'],
    dialogue: 'Integraciones custom: IA que se conecta a tus sistemas.',
    dialogueConversational: 'Hacemos integraciones custom de IA con tus sistemas existentes. ¿Te interesa ver más?',
    action: { type: 'walk_to_pillar', target: 'custom-integrations' },
    emotion: 'helpful',
    priority: 65
  },

  // GitHub
  {
    keywords: ['github', 'código', 'codigo', 'repositorio', 'repo', 'proyectos', 'open source', 'portafolio', 'portfolio', 'ejemplos'],
    dialogue: '¡Mira el código! Aquí están los proyectos de Daniel.',
    dialogueConversational: 'Daniel tiene proyectos open source en GitHub. ¿Quieres que te muestre su portafolio?',
    action: { type: 'walk_to_pillar', target: 'github' },
    emotion: 'helpful',
    priority: 75
  },

  // DeskFlow
  {
    keywords: ['deskflow', 'escritorio', 'escritorios', 'notas', 'productividad', 'organizar', 'organización', 'organizacion'],
    dialogue: 'DeskFlow: escritorios virtuales para organizar tu trabajo.',
    dialogueConversational: 'DeskFlow es un proyecto de escritorios virtuales para productividad. ¿Te llevo a verlo?',
    action: { type: 'walk_to_pillar', target: 'deskflow' },
    emotion: 'helpful',
    priority: 75
  },

  // Núvariz
  {
    keywords: ['núvariz', 'nuvariz', 'nuvaris', 'universo', 'próximamente', 'proximamente', 'secreto', 'misterio'],
    dialogue: 'Universo Núvariz... algo grande viene. Stay tuned.',
    dialogueConversational: 'Universo Núvariz es algo misterioso que viene pronto... ¿Quieres echar un vistazo?',
    action: { type: 'walk_to_pillar', target: 'nuvaris' },
    emotion: 'curious',
    priority: 75
  },

  // ==================== SERVICIOS GENERALES ====================
  {
    keywords: ['servicio', 'servicios', 'qué ofreces', 'que ofreces', 'qué haces', 'que haces', 'ayuda', 'ayudar', 'ofrece'],
    dialogue: 'Daniel ofrece consultoría de IA. ¡Te muestro los pilares!',
    dialogueConversational: 'Daniel ofrece consultoría especializada en IA: LLMs, RAG, agentes, integraciones. ¿Te llevo a ver los servicios?',
    action: { type: 'walk_to_pillar', target: 'about-daniel' },
    emotion: 'helpful',
    priority: 60
  },

  // ==================== TOUR/GUÍA ====================
  {
    keywords: ['tour', 'guía', 'guia', 'guíame', 'guiame', 'muéstrame', 'muestrame', 'explorar', 'recorrido'],
    dialogue: '¡Perfecto! Te doy un tour. Empecemos por conocer a Daniel.',
    dialogueConversational: '¡Puedo darte un tour por toda la página! ¿Empezamos por conocer a Daniel?',
    action: { type: 'walk_to_pillar', target: 'about-daniel' },
    emotion: 'excited',
    priority: 55
  },

  // ==================== IA EN GENERAL ====================
  {
    keywords: ['ia', 'inteligencia artificial', 'machine learning', 'ml', 'deep learning', 'ai'],
    dialogue: 'Daniel es experto en IA. ¡Te muestro sus especialidades!',
    dialogueConversational: 'Daniel es experto en IA: LLMs locales, agentes autónomos y más. ¿Te llevo a explorar esa área?',
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
 * v2.0: Conversational fallback asks what the user needs
 */
export const SMART_FALLBACK: SmartResponse = {
  keywords: [],
  dialogue: '¡Buena pregunta! Para respuestas más detalladas, te llevo a agendar una sesión con Daniel.',
  dialogueConversational: 'Hmm, no estoy seguro de entender. ¿Buscas algo específico? Puedo mostrarte los servicios de Daniel o ayudarte a agendar una sesión.',
  action: { type: 'walk_to_pillar', target: 'calendly' },
  emotion: 'helpful',
  priority: 0
};

/**
 * Confirmation keywords - user says yes to a pending suggestion
 */
export const CONFIRMATION_KEYWORDS = [
  'sí', 'si', 'dale', 'ok', 'va', 'vale', 'claro', 'por supuesto',
  'llévame', 'llevame', 'vamos', 'muéstrame', 'muestrame', 'show me',
  'yes', 'yeah', 'sure', 'adelante', 'de una', 'hagámoslo', 'hagamoslo',
  'porfa', 'por favor', 'eso', 'quiero', 'me interesa'
];

/**
 * Rejection keywords - user says no to a pending suggestion
 */
export const REJECTION_KEYWORDS = [
  'no', 'nah', 'mejor no', 'no gracias', 'otra cosa', 'cambiemos',
  'en realidad', 'prefiero', 'después', 'despues', 'luego', 'nope'
];

/**
 * Get the best matching smart response for user input
 * v2.0: Supports conversational mode (suppresses walk_to_pillar, uses softer dialogue)
 */
export function getSmartResponse(input: string, options?: SmartResponseOptions): SendellResponse {
  const normalized = input.toLowerCase().trim();
  const conversational = options?.conversational ?? false;

  // Sort by priority (highest first)
  const sortedResponses = [...SMART_RESPONSES].sort(
    (a, b) => (b.priority || 0) - (a.priority || 0)
  );

  // Find first matching response
  for (const response of sortedResponses) {
    for (const keyword of response.keywords) {
      if (normalized.includes(keyword)) {
        const isWalk = response.action.type === 'walk_to_pillar';
        const useConversational = conversational && isWalk && response.dialogueConversational;

        console.log(`[SmartResponse] Matched keyword "${keyword}" → ${response.action.type}${response.action.target ? ':' + response.action.target : ''}${useConversational ? ' (conversational)' : ''}`);

        if (useConversational) {
          // Conversational mode: suppress walk action, use softer dialogue
          return {
            actions: [{ type: 'idle' }],
            dialogue: response.dialogueConversational!,
            emotion: response.emotion,
            // Store the intended target for later confirmation
            _pendingTarget: response.action.target
          } as SendellResponse;
        }

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
  if (conversational) {
    return {
      actions: [{ type: 'idle' }],
      dialogue: SMART_FALLBACK.dialogueConversational!,
      emotion: SMART_FALLBACK.emotion
    };
  }
  return {
    actions: [SMART_FALLBACK.action],
    dialogue: SMART_FALLBACK.dialogue,
    emotion: SMART_FALLBACK.emotion
  };
}

/**
 * Check if input is a confirmation to a pending suggestion
 */
export function isConfirmation(input: string): boolean {
  const normalized = input.toLowerCase().trim();
  return CONFIRMATION_KEYWORDS.some(k => normalized.includes(k));
}

/**
 * Check if input is a rejection to a pending suggestion
 */
export function isRejection(input: string): boolean {
  const normalized = input.toLowerCase().trim();
  return REJECTION_KEYWORDS.some(k => normalized.includes(k));
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
