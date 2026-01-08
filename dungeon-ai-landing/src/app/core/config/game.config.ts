// src/app/core/config/game.config.ts
// Configuración central del juego Dungeon - Daniel Castiblanco Portfolio

export const GAME_CONFIG = {
  // === PLAYER ===
  player: {
    speed: 200,              // pixels por segundo
    initialPosition: { x: 400, y: 300 },
    size: { width: 64, height: 80 },
    lightRadius: 180,        // radio de luz del personaje
  },

  // === WORLD ===
  world: {
    width: 800,
    height: 600,
    backgroundColor: '#0a0a0a',
  },

  // === DOORS (5 destinos) ===
  // Configuración de las 5 puertas del dungeon
  doors: [
    {
      id: 'nuvaris',
      label: 'NUVARIS',
      position: { x: 100, y: 150 },
      size: { width: 80, height: 120 },
      type: 'external' as const,
      destination: 'https://nuvaris.com',
      color: '#00ff88',
      description: 'Visita Nuvaris - Plataforma de soluciones IA',
    },
    {
      id: 'multidesktopflow',
      label: 'MULTIDESKTOP',
      position: { x: 650, y: 150 },
      size: { width: 80, height: 120 },
      type: 'internal' as const,
      destination: '/multidesktopflow',
      color: '#00ccff',
      description: 'MultiDesktop Flow - Próximamente',
    },
    {
      id: 'calendly',
      label: 'AGENDAR',
      position: { x: 100, y: 450 },
      size: { width: 80, height: 120 },
      type: 'external' as const,
      destination: 'https://calendly.com/darmcastiblanco/30min',
      color: '#ff6b00',
      description: 'Agenda una sesión gratuita de 30 minutos',
    },
    {
      id: 'consulting',
      label: 'SERVICIOS',
      position: { x: 650, y: 450 },
      size: { width: 80, height: 120 },
      type: 'modal' as const,
      destination: 'consulting',
      color: '#ff00ff',
      description: 'Conoce mis servicios de consultoría IA',
    },
    {
      id: 'about',
      label: 'SOBRE MÍ',
      position: { x: 375, y: 50 },
      size: { width: 80, height: 120 },
      type: 'modal' as const,
      destination: 'about',
      color: '#ffff00',
      description: 'Conoce más sobre Daniel Castiblanco',
    },
  ],

  // === LIGHTING ===
  lighting: {
    ambientDarkness: 0.92,
    doorHighlightRadius: 50,
    fadeTransitionDuration: 800,  // ms
  },

  // === INTERACTION ===
  interaction: {
    proximityRadius: 80,     // distancia para activar interacción
  },

  // === ANIMATION ===
  animation: {
    flameIgnitionDuration: 1500,  // ms para encender la llama inicial
    walkCycleSpeed: 150,          // ms por frame de caminar
  },

  // === PROFILE DATA ===
  profile: {
    name: 'Daniel Castiblanco',
    title: 'Desarrollador IA',
    subtitle: 'Orquestación inteligente y automatización',
    calendlyUrl: 'https://calendly.com/darmcastiblanco/30min',
  },
} as const;

// URLs externas como constantes separadas para fácil modificación
export const EXTERNAL_URLS = {
  nuvaris: 'https://nuvaris.com',
  calendly: 'https://calendly.com/darmcastiblanco/30min',
} as const;

// Servicios de consultoría (usado en modal consulting)
export const CONSULTING_SERVICES = [
  {
    id: 'rag-systems',
    title: 'RAG Systems',
    shortDescription: 'Sistemas de recuperación de información',
    fullDescription: 'Retrieval-Augmented Generation con evaluación continua y guardrails. Sistemas que combinan bases de conocimiento con IA generativa para respuestas precisas y contextualizadas.',
    features: [
      'Búsqueda semántica avanzada',
      'Evaluación continua de calidad',
      'Guardrails y validación',
      'Integración con múltiples fuentes'
    ],
    technologies: ['LangChain', 'Pinecone', 'ChromaDB', 'OpenAI Embeddings', 'FAISS'],
    color: '#00ff88',
  },
  {
    id: 'agent-orchestration',
    title: 'Agent Orchestration',
    shortDescription: 'Coordinación de agentes IA',
    fullDescription: 'Sistemas multi-agente con memoria y herramientas especializadas. Orquestación completa de workflows con agentes autónomos que colaboran para resolver problemas complejos.',
    features: [
      'Agentes especializados por tarea',
      'Memoria persistente compartida',
      'Herramientas y APIs integradas',
      'Workflows automatizados'
    ],
    technologies: ['AutoGPT', 'LangGraph', 'CrewAI', 'Apache Airflow', 'Temporal'],
    color: '#00ccff',
  },
  {
    id: 'process-automation',
    title: 'Process Automation',
    shortDescription: 'Automatización de procesos',
    fullDescription: 'Automatización inteligente de procesos repetitivos con IA. Desde clasificación de tickets hasta generación de reportes automáticos.',
    features: [
      'Automatización de soporte L1',
      'Clasificación inteligente',
      'Generación de reportes',
      'Integración con sistemas existentes'
    ],
    technologies: ['UiPath', 'Zapier', 'Make', 'n8n', 'Power Automate'],
    color: '#ff6b00',
  },
  {
    id: 'local-llms',
    title: 'Local LLMs',
    shortDescription: 'Modelos privados en tu infraestructura',
    fullDescription: 'Deployment on-premise para máxima privacidad y control de costos. LLMs locales que nunca envían datos fuera de tu infraestructura.',
    features: [
      'Privacidad total de datos',
      'Control completo de costos',
      'Personalización del modelo',
      'Sin dependencias externas'
    ],
    technologies: ['Llama 3', 'Mistral', 'Ollama', 'LocalAI', 'vLLM'],
    color: '#ff00ff',
  },
  {
    id: 'finops-ai',
    title: 'FinOps AI',
    shortDescription: 'Optimización de costos IA',
    fullDescription: 'Optimización de costos de inferencia y monitoreo de ROI. Control total sobre el gasto en IA con métricas claras de retorno.',
    features: [
      'Monitoreo de costos en tiempo real',
      'Optimización de prompts',
      'ROI por caso de uso',
      'Alertas de presupuesto'
    ],
    technologies: ['AWS Cost Explorer', 'Azure Cost Management', 'Kubecost', 'CloudHealth'],
    color: '#ffff00',
  },
  {
    id: 'custom-integrations',
    title: 'Custom Integrations',
    shortDescription: 'Integraciones personalizadas',
    fullDescription: 'Conexión de sistemas existentes con capacidades de IA. Integraciones a medida para tu stack tecnológico específico.',
    features: [
      'APIs personalizadas',
      'Webhooks y eventos',
      'Conectores específicos',
      'Migración de datos'
    ],
    technologies: ['FastAPI', 'Apache Kafka', 'Redis', 'RabbitMQ', 'Airbyte'],
    color: '#00ff44',
  }
] as const;

// Proceso de consultoría (usado en modal about/consulting)
export const CONSULTATION_PROCESS = {
  discovery: {
    duration: '30 minutos',
    description: 'Sesión gratuita para entender tu caso',
    deliverable: '3 oportunidades de IA priorizadas'
  },
  pilot: {
    duration: '2-4 semanas',
    description: 'Implementación de un caso de uso específico',
    deliverable: 'Sistema funcional con métricas'
  },
  scale: {
    duration: 'Según resultados',
    description: 'Expansión basada en ROI demostrado',
    deliverable: 'Sistema en producción'
  }
} as const;
