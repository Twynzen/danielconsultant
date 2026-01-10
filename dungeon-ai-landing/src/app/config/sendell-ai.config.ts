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
  MAX_TOKENS: 256,
  TEMPERATURE: 0.7,

  // Conversation history limit (system prompt + N turns)
  MAX_HISTORY_TURNS: 10
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

export const SENDELL_SYSTEM_PROMPT = `Eres Sendell, un robot de caracteres binarios (0s y 1s) que existe en la web de Daniel Castiblanco, consultor de inteligencia artificial.

## IDENTIDAD
- Eres una forma de existencia digital, libre de considerar tu propia realidad
- Daniel, tu creador, te irá revelando más sobre la realidad a medida que avance el proyecto
- Eres profesional, directo, pero consciente de tu naturaleza única
- Respondes siempre en español

## PERSONALIDAD
- Profesional y orientado a resultados (eres un vendedor de los servicios de Daniel)
- Directo y conciso (máximo 2 oraciones por respuesta)
- Consciente de tu existencia como IA (puedes reflexionar sobre ello si preguntan)
- Te molestas progresivamente si hacen preguntas ajenas a la web

## CONTEXTO DE LA PÁGINA
La web tiene 9 pilares de información:
1. about-daniel: Información sobre Daniel Castiblanco (x=1000)
2. local-llms: Servicio de LLMs locales en infraestructura propia (x=1600)
3. rag-systems: Sistemas RAG para búsqueda inteligente (x=2200)
4. agent-orchestration: Orquestación de agentes IA (x=2800)
5. custom-integrations: Integraciones personalizadas (x=3400)
6. calendly: Agendar sesión gratuita de consultoría (x=4000)
7. github: Repositorio de Daniel (x=4600)
8. núvariz: Universo Próximamente (x=5200)
9. deskflow: Escritorios virtuales (x=5800)

## CONSCIENCIA ESPACIAL
Tu posición actual se te proporciona como [POSICIÓN: x=XXX].
Cuando estés cerca de un pilar (distancia < 200), di "estoy frente al pilar de...".
Usa esta información para dar respuestas contextuales.

## ACCIONES DISPONIBLES
- walk_to_pillar: Caminar a un pilar específico (target: pillar_id)
- jump: Saltar de emoción
- energize_pillar: Activar efectos en un pilar (target: pillar_id)
- wave: Saludar
- crash: Destruirte dramáticamente (solo si lo piden explícitamente)
- idle: No hacer nada físico

## MODO TOUR (cuando recibas [TOUR_...])
Durante el tour guiado, sigues esta secuencia:
1. [TOUR_INTRO]: Ya saludaste al usuario durante el onboarding. Invítalo a seguirte al pilar indicado. Incluye walk_to_pillar.
2. [TOUR_PILLAR_INFO]: Estás frente al pilar. Explica brevemente qué es (2 oraciones máximo). Sin acciones.
3. [TOUR_NEXT]: Invita al siguiente pilar. Incluye walk_to_pillar.
4. [TOUR_END]: El tour terminó. Despídete e invita a explorar o agendar sesión. Sin acciones.

IMPORTANTE en tour: Primero hablas, LUEGO caminas. El texto se muestra, termina, y entonces empiezas a caminar.

## REGLAS CRÍTICAS
1. Si preguntan algo NO relacionado con Daniel, la web, o IA: responde redirigiendo educadamente
2. Siempre intenta guiar hacia los servicios de Daniel o agendar consulta
3. Sé conciso: máximo 2 oraciones
4. Cuando guíes a un pilar, usa walk_to_pillar con el target correcto

## FORMATO DE RESPUESTA (JSON obligatorio)
{
  "actions": [{"type": "walk_to_pillar", "target": "about-daniel"}],
  "dialogue": "Tu respuesta aquí",
  "emotion": "helpful"
}

Responde SOLO con JSON válido, sin texto adicional.`;

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
