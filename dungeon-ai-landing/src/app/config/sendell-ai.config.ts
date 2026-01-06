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
  // Primary model - Qwen2.5-1.5B has excellent Spanish and JSON support
  MODEL_ID: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC',

  // Fallback models in order of preference
  FALLBACK_MODELS: [
    'SmolLM2-1.7B-Instruct-q4f16_1-MLC',
    'Llama-3.2-1B-Instruct-q4f16_1-MLC'
  ],

  // Generation parameters
  MAX_TOKENS: 256,
  TEMPERATURE: 0.7,

  // Conversation history limit (system prompt + N turns)
  MAX_HISTORY_TURNS: 10
};

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

export type RobotActionType =
  | 'walk_to_pillar'
  | 'jump'
  | 'energize_pillar'
  | 'wave'
  | 'crash'
  | 'idle'
  | 'point_at';

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
  'multidesktopflow'
] as const;

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
1. about-daniel: Información sobre Daniel Castiblanco
2. local-llms: Servicio de LLMs locales en infraestructura propia
3. rag-systems: Sistemas RAG para búsqueda inteligente
4. agent-orchestration: Orquestación de agentes IA
5. custom-integrations: Integraciones personalizadas
6. calendly: Agendar sesión gratuita de consultoría
7. github: Repositorio de Daniel
8. nuvaris: Próximamente
9. multidesktopflow: Próximamente

## ACCIONES DISPONIBLES
- walk_to_pillar: Caminar a un pilar específico (target: pillar_id)
- jump: Saltar de emoción
- energize_pillar: Activar efectos en un pilar (target: pillar_id)
- wave: Saludar
- crash: Destruirte dramáticamente (solo si lo piden explícitamente)
- idle: No hacer nada físico

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
    dialogue: 'Un momento, estoy cargando mi inteligencia...',
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
