/**
 * Pillar Knowledge Configuration
 * v1.0: Content for RAG system - indexed for semantic search
 *
 * This file contains detailed information about each pillar/section
 * of the landing page. This content is used by the RAG service to
 * provide contextual information to the LLM.
 */

export interface PillarKnowledge {
  id: string;
  title: string;
  content: string;
  keywords: string[];
}

export const PILLAR_KNOWLEDGE: Record<string, PillarKnowledge> = {
  'about-daniel': {
    id: 'about-daniel',
    title: 'Sobre Daniel Castiblanco',
    content: `
Daniel Castiblanco es un consultor senior de inteligencia artificial con más de 5 años
de experiencia en desarrollo full-stack y 4+ años especializándose en IA.
Trabaja en BlueCore, desarrollando aplicaciones bancarias para Latinoamérica.
Su expertise incluye RAG systems, multi-agent orchestration, y LLMs locales.
Creó a Sendell como demostración de sus capacidades en IA.
Daniel combina conocimiento técnico profundo con visión de negocio para ayudar
a empresas a implementar soluciones de IA que generan valor real.
    `.trim(),
    keywords: ['daniel', 'castiblanco', 'consultor', 'experiencia', 'bluecore', 'creador']
  },

  'local-llms': {
    id: 'local-llms',
    title: 'LLMs Locales',
    content: `
Servicio de implementación de LLMs (Large Language Models) en infraestructura propia.
Beneficios principales:
- Privacidad total de datos: tus datos nunca salen de tu infraestructura
- Costos predecibles: sin sorpresas en facturación por tokens
- Sin dependencia de APIs externas: funciona offline
- Control total: personaliza el modelo para tu caso de uso

Daniel implementa soluciones con Ollama, vLLM, y modelos optimizados para edge devices.
Ideal para empresas con requisitos de compliance, datos sensibles, o que necesitan
latencias bajas y control sobre sus modelos de IA.

Tecnologías: Ollama, vLLM, llama.cpp, Mistral, Llama, Qwen, fine-tuning, quantization.
    `.trim(),
    keywords: ['llm', 'local', 'privacidad', 'ollama', 'infraestructura', 'edge', 'offline']
  },

  'rag-systems': {
    id: 'rag-systems',
    title: 'Sistemas RAG',
    content: `
Sistemas de Retrieval Augmented Generation (RAG) para búsqueda inteligente sobre documentos.
RAG combina la potencia de los LLMs con tu conocimiento empresarial específico.

Daniel diseña pipelines completos de:
- Embeddings: conversión de texto a vectores semánticos
- Vector databases: almacenamiento y búsqueda eficiente
- Retrieval optimizado: encontrar la información más relevante
- Generación contextualizada: respuestas basadas en TUS documentos

Casos de uso:
- Chatbots sobre documentación interna
- Búsqueda semántica empresarial
- Asistentes de soporte técnico
- Análisis de contratos y documentos legales

Stack típico: ChromaDB, Pinecone, sentence-transformers, LangChain, OpenAI Embeddings.
    `.trim(),
    keywords: ['rag', 'retrieval', 'embeddings', 'vectores', 'búsqueda', 'documentos', 'chromadb']
  },

  'agent-orchestration': {
    id: 'agent-orchestration',
    title: 'Orquestación de Agentes',
    content: `
Diseño de sistemas multi-agente donde múltiples IAs colaboran para resolver tareas complejas.
Los agentes son programas de IA que pueden tomar decisiones, ejecutar acciones,
y colaborar entre sí para completar objetivos.

Capacidades:
- Agentes especializados: cada uno experto en un dominio
- Memoria compartida: los agentes recuerdan y aprenden
- Workflows complejos: automatización de procesos de múltiples pasos
- Supervisión humana: control sobre decisiones críticas

Frameworks utilizados: LangGraph, CrewAI, AutoGen, Apache Airflow.

El proyecto Sendell mismo es un ejemplo de orquestación de agentes:
un robot que combina NLP, toma de decisiones, y ejecución de acciones.

Ideal para: automatización de workflows, análisis multi-paso, investigación automatizada.
    `.trim(),
    keywords: ['agentes', 'multi-agente', 'orquestación', 'workflows', 'automatización', 'langgraph', 'crewai']
  },

  'custom-integrations': {
    id: 'custom-integrations',
    title: 'Integraciones Personalizadas',
    content: `
Integración de IA con sistemas existentes: ERPs, CRMs, bases de datos legacy, APIs externas.
Daniel conecta sistemas que "no hablan entre sí" usando IA como capa de traducción inteligente.

Servicios:
- APIs REST/GraphQL con componentes de IA
- ETL pipelines inteligentes
- Webhooks y automatizaciones
- Conectores para sistemas legacy
- Middleware de IA para transformación de datos

La clave es hacer que la IA se integre naturalmente en tus procesos existentes,
no forzarte a cambiar todo tu stack tecnológico.

Tecnologías: FastAPI, Apache Kafka, Redis, RabbitMQ, n8n, Zapier, Make.
    `.trim(),
    keywords: ['integración', 'api', 'erp', 'crm', 'legacy', 'webhooks', 'automatización']
  },

  'calendly': {
    id: 'calendly',
    title: 'Agendar Sesión',
    content: `
Agenda una sesión gratuita de 30 minutos con Daniel.
Sin compromiso, para discutir tu proyecto de IA.

En la sesión, Daniel:
- Escucha tus necesidades y desafíos actuales
- Evalúa la viabilidad técnica de tu proyecto
- Propone un roadmap inicial con pasos concretos
- Responde todas tus preguntas sobre implementación de IA

Es una oportunidad para conocer a Daniel y ver si su enfoque
se alinea con lo que necesitas para tu empresa.

La sesión es completamente gratuita y sin presión de compra.
    `.trim(),
    keywords: ['agendar', 'sesión', 'gratuita', 'consulta', 'calendly', 'reunión', 'cita']
  },

  'github': {
    id: 'github',
    title: 'GitHub de Daniel',
    content: `
Repositorio de GitHub de Daniel Castiblanco.
Aquí puedes ver proyectos open source, ejemplos de código,
y demostraciones técnicas de sus capacidades.

Incluye:
- Ejemplos de implementación de RAG
- Configuraciones de LLMs locales
- Proyectos de automatización con IA
- Este mismo proyecto de landing page con Sendell

Es una forma de ver el trabajo técnico de Daniel antes de contactarlo.
    `.trim(),
    keywords: ['github', 'código', 'repositorio', 'proyectos', 'open source', 'ejemplos']
  },

  'nuvaris': {
    id: 'nuvaris',
    title: 'Universo Núvariz',
    content: `
Universo Núvariz - Próximamente.
Un nuevo mundo está por revelarse.
    `.trim(),
    keywords: ['núvariz', 'universo', 'próximamente']
  },

  'multidesktopflow': {
    id: 'multidesktopflow',
    title: 'MultiDesktopFlow (Próximamente)',
    content: `
MultiDesktopFlow es un sistema avanzado de flujo multi-escritorio que está en desarrollo.
Permitirá orquestar workflows complejos entre múltiples aplicaciones de escritorio.

Próximamente estará disponible con más información.
Si te interesa, agenda una sesión con Daniel para más detalles.
    `.trim(),
    keywords: ['multidesktopflow', 'desktop', 'workflow', 'próximamente', 'automatización']
  }
};

/**
 * Get all pillar content as a single string for simple context
 */
export function getAllPillarContent(): string {
  return Object.values(PILLAR_KNOWLEDGE)
    .map(p => `## ${p.title}\n${p.content}`)
    .join('\n\n');
}

/**
 * Get knowledge for a specific pillar
 */
export function getPillarKnowledge(pillarId: string): PillarKnowledge | null {
  return PILLAR_KNOWLEDGE[pillarId] || null;
}

/**
 * Search pillars by keyword (simple matching)
 */
export function searchPillarsByKeyword(query: string): PillarKnowledge[] {
  const normalized = query.toLowerCase();
  return Object.values(PILLAR_KNOWLEDGE).filter(p =>
    p.keywords.some(k => normalized.includes(k)) ||
    p.content.toLowerCase().includes(normalized) ||
    p.title.toLowerCase().includes(normalized)
  );
}
