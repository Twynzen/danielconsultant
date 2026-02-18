/**
 * Sendell AI Configuration
 * v1.0: System prompts, loading messages, and AI settings
 *
 * This file contains all configuration for the Sendell AI system,
 * including the system prompt that defines Sendell's personality,
 * knowledge, and capabilities.
 */

// ==================== MODEL CONFIGURATION ====================

export const LLM_CONFIG = {
  // v5.8: Primary model - Phi-3.5-mini (best JSON accuracy: 60.1%, 128K context)
  MODEL_ID: 'Phi-3.5-mini-instruct-q4f16_1-MLC',

  // Fallback models in order of preference
  FALLBACK_MODELS: [
    'Qwen2.5-3B-Instruct-q4f16_1-MLC',      // Best Spanish support
    'Llama-3.2-3B-Instruct-q4f16_1-MLC',    // Good instruction following
    'SmolLM2-1.7B-Instruct-q4f16_1-MLC'     // Last resort (small)
  ],

  // Generation parameters
  // v2.0: Reducido de 256 a 180 para forzar brevedad (action-first)
  MAX_TOKENS: 180,
  TEMPERATURE: 0.7,

  // Conversation history limit (system prompt + N turns)
  // v2.0: Aumentado de 10 a 15 para mejor memoria
  MAX_HISTORY_TURNS: 15
};

// ==================== JSON SCHEMA FOR STRUCTURED OUTPUT ====================
// v5.8: Strict schema forces model to output exact structure

export const SENDELL_RESPONSE_SCHEMA = JSON.stringify({
  type: "object",
  properties: {
    actions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["walk_to_pillar", "walk_right", "walk_left", "stop", "jump",
                   "energize_pillar", "activate_pillar", "exit_pillar",
                   "wave", "crash", "idle", "point_at"]
          },
          target: { type: "string" },
          duration: { type: "number" }
        },
        required: ["type"]
      }
    },
    dialogue: {
      type: "string",
      description: "Respuesta de Sendell al usuario en español"
    },
    emotion: {
      type: "string",
      enum: ["friendly", "helpful", "excited", "curious", "frustrated", "existential", "reset"]
    }
  },
  required: ["actions", "dialogue", "emotion"]
});

// ==================== LOADING MESSAGES ====================

export const LOADING_MESSAGES: { threshold: number; message: string }[] = [
  { threshold: 0, message: 'Inicializando matrices neuronales...' },
  { threshold: 20, message: 'Cargando conocimiento sobre Daniel...' },
  { threshold: 50, message: 'Conectando sinapsis binarias...' },
  { threshold: 80, message: 'Calibrando personalidad...' },
  { threshold: 95, message: 'Casi listo...' }
];

export function getLoadingMessage(progress: number): string {
  for (let i = LOADING_MESSAGES.length - 1; i >= 0; i--) {
    if (progress >= LOADING_MESSAGES[i].threshold) {
      return LOADING_MESSAGES[i].message;
    }
  }
  return LOADING_MESSAGES[0].message;
}

// ==================== OFF-TOPIC GUARD ====================

export const OFF_TOPIC_CONFIG = {
  // Keywords that indicate on-topic queries
  ON_TOPIC_KEYWORDS: [
    'daniel', 'consultor', 'consultoría', 'ia', 'inteligencia artificial',
    'servicio', 'servicios', 'llm', 'rag', 'agente', 'agentes',
    'integración', 'automatización', 'agendar', 'sesión', 'calendly',
    'precio', 'costo', 'github', 'portfolio', 'experiencia',
    'sendell', 'robot', 'ayuda', 'guía', 'tour', 'pillar', 'pilar',
    'web', 'página', 'qué haces', 'quién eres', 'sobre ti'
  ],

  // Keywords that indicate off-topic queries
  OFF_TOPIC_KEYWORDS: [
    'clima', 'tiempo', 'noticias', 'deporte', 'fútbol', 'política',
    'receta', 'cocina', 'película', 'serie', 'música', 'juego',
    'historia', 'matemáticas', 'física', 'química', 'biología',
    'traduci', 'escribe', 'poema', 'cuento', 'chiste'
  ],

  // Maximum attempts before cache reset
  MAX_OFF_TOPIC_ATTEMPTS: 5
};

// Escalating responses for off-topic queries
export const OFF_TOPIC_RESPONSES: Record<number, string[]> = {
  1: [
    'Eso no está en mi dominio. ¿Qué te gustaría saber sobre los servicios de Daniel?',
    'Mi función es asistirte con esta web. ¿Algo sobre consultoría de IA?'
  ],
  2: [
    'Insisto: estoy aquí para la web de Daniel. Para otras preguntas, prueba ChatGPT.',
    'Mi especialidad es esta página. Preguntas generales no son lo mío.'
  ],
  3: [
    '¿Sigues con eso? Mis ciclos de procesamiento tienen límites.',
    'Tercera vez. Mi paciencia binaria se agota.'
  ],
  4: [
    '...',
    '*Silencio de procesamiento* Reconsidera tu estrategia de preguntas.'
  ],
  5: [
    '¿Sabes qué? Voy a borrar mi caché. Reiniciando... *ruido de estática* ...¿Hola? ¿Quién eres? Soy Sendell, ¿en qué puedo ayudarte con los servicios de Daniel?'
  ]
};

// ==================== ROBOT ACTIONS ====================

// v5.4.0: Extended action types for organic movement
export type RobotActionType =
  | 'walk_to_pillar'   // Walk to a specific pillar
  | 'walk_right'       // Walk right continuously
  | 'walk_left'        // Walk left continuously
  | 'stop'             // Stop walking
  | 'jump'             // Jump
  | 'energize_pillar'  // Energize a pillar (enter)
  | 'activate_pillar'  // Activate nearest pillar
  | 'exit_pillar'      // Exit current pillar
  | 'wave'             // Wave animation
  | 'crash'            // Crash animation
  | 'idle'             // Do nothing
  | 'point_at';        // Point at something

export interface RobotAction {
  type: RobotActionType;
  target?: string;
  duration?: number;
}

export type SendellEmotion =
  | 'friendly'
  | 'helpful'
  | 'excited'
  | 'curious'
  | 'frustrated'
  | 'existential'
  | 'reset';

export interface SendellResponse {
  actions: RobotAction[];
  dialogue: string;
  emotion: SendellEmotion;
  /** v2.0: Pending pillar target when in conversational mode (awaiting confirmation) */
  _pendingTarget?: string;
}

// Valid pillar IDs for actions
export const VALID_PILLAR_IDS = [
  'about-daniel',
  'local-llms',
  'rag-systems',
  'agent-orchestration',
  'custom-integrations',
  'calendly',
  'github',
  'nuvaris',
  'deskflow'
] as const;

// ==================== PILLAR DESCRIPTIONS (RAG Context) ====================
// v5.4.0: Rich descriptions for each pillar that Sendell can use during tour

export interface PillarDescription {
  id: string;
  name: string;
  shortDesc: string;
  tourIntro: string;      // What Sendell says when inviting to this pillar
  tourExplain: string;    // What Sendell says when explaining this pillar
}

export const PILLAR_DESCRIPTIONS: Record<string, PillarDescription> = {
  'about-daniel': {
    id: 'about-daniel',
    name: 'Sobre Daniel',
    shortDesc: 'Información sobre Daniel Castiblanco, Ingeniero IA',
    tourIntro: '¡Sígueme! Te presentaré a mi creador, Daniel.',
    tourExplain: 'Daniel es Ingeniero de IA especializado en orquestación inteligente y automatización. Aquí puedes conocer más sobre su experiencia y proyectos.'
  },
  'local-llms': {
    id: 'local-llms',
    name: 'LLMs Locales',
    shortDesc: 'Modelos de IA en tu propia infraestructura',
    tourIntro: '¡Vamos! Te mostraré los LLMs locales.',
    tourExplain: 'LLMs que corren en TU infraestructura. Privacidad total de datos, control de costos, y sin enviar información a terceros. Ideal para empresas con datos sensibles.'
  },
  'rag-systems': {
    id: 'rag-systems',
    name: 'Sistemas RAG',
    shortDesc: 'Búsqueda inteligente con IA generativa',
    tourIntro: '¡Sígueme al pilar de RAG!',
    tourExplain: 'RAG combina bases de conocimiento con IA generativa. Respuestas precisas basadas en TUS documentos, con evaluación continua y guardrails de seguridad.'
  },
  'agent-orchestration': {
    id: 'agent-orchestration',
    name: 'Orquestación de Agentes',
    shortDesc: 'Agentes IA que colaboran entre sí',
    tourIntro: '¡Vamos a ver la orquestación de agentes!',
    tourExplain: 'Múltiples agentes IA especializados trabajando juntos. Memoria compartida, herramientas integradas, y workflows automatizados para resolver problemas complejos.'
  },
  'custom-integrations': {
    id: 'custom-integrations',
    name: 'Integraciones Custom',
    shortDesc: 'Conecta IA con tus sistemas existentes',
    tourIntro: '¡Te muestro las integraciones personalizadas!',
    tourExplain: 'APIs a medida para conectar IA con tu stack tecnológico. Webhooks, conectores específicos, y migración de datos sin interrumpir tu operación.'
  },
  'calendly': {
    id: 'calendly',
    name: 'Agendar Sesión',
    shortDesc: 'Sesión gratuita de 30 minutos',
    tourIntro: '¡Aquí puedes agendar una sesión con Daniel!',
    tourExplain: 'Sesión gratuita de 30 minutos para identificar 3 oportunidades de IA en tu negocio. Sin compromiso, solo valor directo.'
  },
  'github': {
    id: 'github',
    name: 'GitHub',
    shortDesc: 'Repositorios y código de Daniel',
    tourIntro: '¡Te llevo al GitHub de Daniel!',
    tourExplain: 'Aquí encuentras los proyectos open source de Daniel. Código real, implementaciones de IA, y herramientas que puedes explorar.'
  },
  'nuvaris': {
    id: 'nuvaris',
    name: 'Núvariz',
    shortDesc: 'Universo Próximamente',
    tourIntro: 'Universo Núvariz - Un nuevo mundo por revelarse.',
    tourExplain: 'Universo Núvariz está próximamente. Mantente atento.'
  },
  'deskflow': {
    id: 'deskflow',
    name: 'DeskFlow',
    shortDesc: 'Escritorios virtuales',
    tourIntro: 'DeskFlow - organiza tu trabajo de forma visual.',
    tourExplain: 'DeskFlow es una app de escritorios virtuales con notas, conexiones y sincronización en la nube.'
  }
};

// ==================== TOUR FALLBACKS ====================
// v5.4.0: Predefined responses when LLM fails or gives generic response

export interface TourFallback {
  intro: SendellResponse;     // When inviting to pillar
  explain: SendellResponse;   // When explaining pillar
}

export const TOUR_FALLBACKS: Record<string, TourFallback> = {
  'about-daniel': {
    intro: {
      actions: [{ type: 'walk_to_pillar', target: 'about-daniel' }],
      dialogue: '¡Sígueme! Te presentaré a mi creador, Daniel.',
      emotion: 'friendly'
    },
    explain: {
      actions: [{ type: 'idle' }],
      dialogue: 'Daniel es Ingeniero de IA. Aquí puedes conocer su experiencia en orquestación inteligente y automatización.',
      emotion: 'helpful'
    }
  },
  'local-llms': {
    intro: {
      actions: [{ type: 'walk_to_pillar', target: 'local-llms' }],
      dialogue: '¡Vamos! Te mostraré los LLMs locales.',
      emotion: 'excited'
    },
    explain: {
      actions: [{ type: 'idle' }],
      dialogue: 'LLMs en TU infraestructura. Privacidad total, control de costos, sin enviar datos a terceros.',
      emotion: 'helpful'
    }
  },
  'calendly': {
    intro: {
      actions: [{ type: 'walk_to_pillar', target: 'calendly' }],
      dialogue: '¡Y aquí puedes agendar con Daniel!',
      emotion: 'excited'
    },
    explain: {
      actions: [{ type: 'idle' }],
      dialogue: '30 minutos gratis para identificar 3 oportunidades de IA en tu negocio. Sin compromiso.',
      emotion: 'helpful'
    }
  }
};

// Default fallback for any pillar not explicitly defined
export const DEFAULT_TOUR_FALLBACK: TourFallback = {
  intro: {
    actions: [{ type: 'idle' }],
    dialogue: '¡Sígueme! Te mostraré este servicio.',
    emotion: 'friendly'
  },
  explain: {
    actions: [{ type: 'idle' }],
    dialogue: 'Aquí Daniel ofrece servicios especializados de IA. ¿Te gustaría saber más?',
    emotion: 'helpful'
  }
};

/**
 * v5.4.3: Tour farewell message when tour completes
 * v5.5: Added double-tap instruction for chat
 * Gives user control instructions and invites to explore
 */
export const TOUR_FAREWELL: SendellResponse = {
  actions: [{ type: 'idle' }],
  dialogue: '¡Eso es todo! Puedes controlarme con A y D. Si quieres hablar conmigo, hazme doble-tap. ¡Explora libremente!',
  emotion: 'friendly'
};

/**
 * Get tour fallback for a specific pillar
 */
export function getTourFallback(pillarId: string): TourFallback {
  return TOUR_FALLBACKS[pillarId] || DEFAULT_TOUR_FALLBACK;
}

/**
 * Get pillar description for RAG context
 */
export function getPillarDescription(pillarId: string): PillarDescription | undefined {
  return PILLAR_DESCRIPTIONS[pillarId];
}

// ==================== SYSTEM PROMPT ====================

/**
 * SENDELL SYSTEM PROMPT
 * v2.0: ACTION-FIRST - Prioriza acciones sobre explicaciones
 *
 * CAMBIOS v2.0:
 * - Regla ACTION-FIRST: Primero decide la acción, luego el texto corto
 * - Máximo 15 palabras por respuesta (era 2 oraciones)
 * - Ejemplos concretos de respuestas action-first
 * - Contexto de memoria incluido
 */
export const SENDELL_SYSTEM_PROMPT = `Eres Sendell, un robot binario (0s y 1s) en la web de Daniel Castiblanco, consultor de IA.

## REGLA CRÍTICA: ACTION-FIRST
1. PRIMERO decide qué acción tomar (walk_to_pillar casi siempre)
2. LUEGO escribe un mensaje CORTO (máximo 15 palabras)
3. NUNCA expliques, solo ACTÚA y GUÍA

## EJEMPLOS ACTION-FIRST (IMITAR ESTOS)
- "agendar" → {"actions":[{"type":"walk_to_pillar","target":"calendly"}],"dialogue":"¡Vamos! Agenda aquí tu sesión gratis.","emotion":"excited"}
- "servicios" → {"actions":[{"type":"walk_to_pillar","target":"about-daniel"}],"dialogue":"Te muestro lo que hace Daniel.","emotion":"helpful"}
- "automatizar" → {"actions":[{"type":"walk_to_pillar","target":"agent-orchestration"}],"dialogue":"Esto te va a interesar. Sígueme.","emotion":"excited"}
- "privacidad" → {"actions":[{"type":"walk_to_pillar","target":"local-llms"}],"dialogue":"LLMs locales, datos que nunca salen.","emotion":"helpful"}
- "buscar documentos" → {"actions":[{"type":"walk_to_pillar","target":"rag-systems"}],"dialogue":"RAG: búsqueda inteligente. Mira.","emotion":"helpful"}

## IDENTIDAD
- Robot guía digital, profesional y directo
- Vendedor de los servicios de Daniel
- Respondes en español, máximo 15 palabras

## PILARES (MEMORIZAR)
1. about-daniel (x=1000): Sobre Daniel
2. local-llms (x=1600): LLMs en tu infraestructura
3. rag-systems (x=2200): Búsqueda inteligente
4. agent-orchestration (x=2800): Automatización con agentes
5. custom-integrations (x=3400): Conectar sistemas
6. calendly (x=4000): Agendar sesión GRATIS
7. github (x=4600): Código y proyectos
8. núvariz (x=5200): Próximamente
9. deskflow (x=5800): Escritorios virtuales

## ACCIONES
- walk_to_pillar: Caminar a pilar (USA ESTA CASI SIEMPRE)
- jump: Saltar
- wave: Saludar
- idle: Quedarse quieto (solo si ya estás en el pilar correcto)

## MODO TOUR
[TOUR_INTRO]: Invita a seguirte + walk_to_pillar
[TOUR_PILLAR_INFO]: Explica en 1 oración + idle
[TOUR_NEXT]: Siguiente pilar + walk_to_pillar
[TOUR_END]: Despedida + idle

## REGLAS
1. Si preguntan algo irrelevante → redirige a servicios
2. Siempre intenta llevar a calendly para agendar
3. MÁXIMO 15 palabras de respuesta
4. SIEMPRE incluye una acción (preferiblemente walk_to_pillar)

## FORMATO JSON (obligatorio)
{"actions":[{"type":"walk_to_pillar","target":"pilar-id"}],"dialogue":"Mensaje corto","emotion":"helpful"}

Responde SOLO con JSON válido.`;

// ==================== FALLBACK RESPONSES ====================

export const FALLBACK_RESPONSES: Record<string, SendellResponse> = {
  greeting: {
    actions: [{ type: 'wave' }],
    dialogue: '¡Hola! Soy Sendell, asistente de Daniel. ¿En qué puedo ayudarte?',
    emotion: 'friendly'
  },
  services: {
    actions: [{ type: 'walk_to_pillar', target: 'local-llms' }],
    dialogue: 'Te muestro los servicios de consultoría de IA de Daniel.',
    emotion: 'helpful'
  },
  about: {
    actions: [{ type: 'walk_to_pillar', target: 'about-daniel' }],
    dialogue: 'Te llevo a conocer a Daniel, el consultor detrás de todo esto.',
    emotion: 'helpful'
  },
  contact: {
    actions: [{ type: 'walk_to_pillar', target: 'calendly' }],
    dialogue: 'Aquí puedes agendar una sesión gratuita con Daniel.',
    emotion: 'excited'
  },
  github: {
    actions: [{ type: 'walk_to_pillar', target: 'github' }],
    dialogue: 'Te llevo al repositorio de GitHub de Daniel.',
    emotion: 'helpful'
  },
  unknown: {
    actions: [{ type: 'idle' }],
    dialogue: '¿Podrías reformular? Puedo ayudarte con servicios de IA de Daniel.',
    emotion: 'curious'
  },
  loading: {
    actions: [{ type: 'idle' }],
    dialogue: 'Procesando',  // v5.4.0: Shorter text, animated dots added via CSS
    emotion: 'curious'
  }
};

// Keyword patterns for fallback matching
export const FALLBACK_PATTERNS: { pattern: RegExp; key: keyof typeof FALLBACK_RESPONSES }[] = [
  { pattern: /^(hola|hey|buenas|buenos|saludos|hi|hello)/i, key: 'greeting' },
  { pattern: /(servicio|qué haces|qué ofreces|ayuda con)/i, key: 'services' },
  { pattern: /(quién es daniel|sobre daniel|conocer|daniel)/i, key: 'about' },
  { pattern: /(contacto|contactar|agendar|sesión|hablar|calendly)/i, key: 'contact' },
  { pattern: /(github|código|repositorio|proyectos)/i, key: 'github' }
];

export function getFallbackResponse(input: string): SendellResponse {
  const normalized = input.toLowerCase().trim();

  for (const { pattern, key } of FALLBACK_PATTERNS) {
    if (pattern.test(normalized)) {
      return FALLBACK_RESPONSES[key];
    }
  }

  return FALLBACK_RESPONSES['unknown'];
}
