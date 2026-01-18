import { Injectable } from '@angular/core';
import { Service, ConsultationProcess } from '../models/service.model';

export interface ServiceDetail {
  id: string;
  title: string;
  description: string;
  features: {
    icon: string;
    iconType?: 'emoji' | 'svg' | 'lucide';
    animation?: string;
    text: string;
  }[];
  technologies: string[];
}

@Injectable({
  providedIn: 'root'
})
export class ServicesDataService {
  private services: Service[] = [
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
      ]
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
      ]
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
      ]
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
      ]
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
      ]
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
      ]
    }
  ];

  private consultationProcess: ConsultationProcess = {
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
  };

  private profileData = {
    name: 'Daniel Castiblanco',
    title: 'Consultor de IA',
    subtitle: 'Orquestación inteligente y automatización'
  };

  private ctaData = {
    buttonText: 'AGENDAR SESIÓN GRATUITA',
    consultationUrl: 'https://calendly.com/danielcastiblanco',
    message: '30 minutos para identificar 3 oportunidades de IA en tu negocio'
  };

  private servicesDetail: ServiceDetail[] = [
    // v8.6: About Daniel - Quién Soy profile for mobile modal
    {
      id: 'about-daniel',
      title: 'DANIEL CASTIBLANCO',
      description: 'Consultor especializado en Inteligencia Artificial con enfoque en implementación práctica de soluciones de IA para empresas. Experiencia en orquestación de agentes, RAG systems, LLMs locales y automatización inteligente.',
      features: [
        {
          icon: 'brain',
          iconType: 'lucide',
          animation: 'pulse',
          text: 'Especialista en LLMs y modelos de lenguaje'
        },
        {
          icon: 'bot',
          iconType: 'lucide',
          animation: 'bounce',
          text: 'Orquestación de agentes de IA'
        },
        {
          icon: 'server',
          iconType: 'lucide',
          animation: 'glow',
          text: 'Implementación de LLMs locales y privados'
        },
        {
          icon: 'workflow',
          iconType: 'lucide',
          animation: 'rotate',
          text: 'Automatización de procesos con IA'
        },
        {
          icon: 'shield-check',
          iconType: 'lucide',
          animation: 'heartbeat',
          text: 'Soluciones seguras y escalables'
        }
      ],
      technologies: ['Python', 'LangChain', 'LangGraph', 'Angular', 'FastAPI', 'Docker', 'Supabase']
    },
    {
      id: 'rag-systems',
      title: 'RAG SYSTEMS',
      description: 'Sistemas de Recuperación y Generación Aumentada que conectan modelos de IA con bases de conocimiento empresarial, permitiendo respuestas contextualizadas y precisas basadas en documentación específica.',
      features: [
        { 
          icon: 'heart',
          iconType: 'lucide',
          animation: 'heartbeat',
          text: 'Indexación vectorial de documentos empresariales' 
        },
        { 
          icon: 'eye',
          iconType: 'lucide',
          animation: 'blink',
          text: 'Búsqueda semántica avanzada con embeddings' 
        },
        { 
          icon: 'brain',
          iconType: 'lucide',
          animation: 'pulse',
          text: 'Integración con LLMs para respuestas contextuales' 
        },
        { 
          icon: 'bar-chart',
          iconType: 'lucide',
          animation: 'bars-move',
          text: 'Analytics de uso y relevancia de información' 
        },
        { 
          icon: 'shield',
          iconType: 'lucide',
          animation: 'glow',
          text: 'Control de acceso granular a información sensible' 
        }
      ],
      technologies: ['LangChain', 'Pinecone', 'ChromaDB', 'OpenAI Embeddings', 'FAISS', 'PostgreSQL pgvector']
    },
    {
      id: 'agent-orchestration',
      title: 'AGENT ORCHESTRATION',
      description: 'Coordinación inteligente de múltiples agentes de IA especializados que trabajan en conjunto para resolver problemas complejos y automatizar flujos de trabajo empresariales.',
      features: [
        { 
          icon: 'bot',
          iconType: 'lucide',
          animation: 'pulse',
          text: 'Diseño de agentes especializados por dominio' 
        },
        { 
          icon: 'workflow',
          iconType: 'lucide',
          animation: 'rotate',
          text: 'Orquestación de tareas multi-agente' 
        },
        { 
          icon: 'message-circle',
          iconType: 'lucide',
          animation: 'bounce',
          text: 'Comunicación inter-agente con protocolos definidos' 
        },
        { 
          icon: 'trending-up',
          iconType: 'lucide',
          animation: 'bars-move',
          text: 'Monitoreo de rendimiento y optimización continua' 
        },
        { 
          icon: 'target',
          iconType: 'lucide',
          animation: 'glow',
          text: 'Routing inteligente basado en capacidades' 
        }
      ],
      technologies: ['AutoGPT', 'LangGraph', 'CrewAI', 'Apache Airflow', 'Temporal', 'Microsoft AutoGen']
    },
    {
      id: 'process-automation',
      title: 'PROCESS AUTOMATION',
      description: 'Automatización end-to-end de procesos empresariales mediante IA, reduciendo trabajo manual y mejorando eficiencia operativa con flujos de trabajo inteligentes.',
      features: [
        { 
          icon: 'map',
          iconType: 'lucide',
          animation: 'pulse',
          text: 'Mapeo y digitalización de procesos existentes' 
        },
        { 
          icon: 'rocket',
          iconType: 'lucide',
          animation: 'bounce',
          text: 'Automatización con RPA + IA conversacional' 
        },
        { 
          icon: 'clipboard-check',
          iconType: 'lucide',
          animation: 'glow',
          text: 'Gestión de excepciones con decisiones inteligentes' 
        },
        { 
          icon: 'bell',
          iconType: 'lucide',
          animation: 'heartbeat',
          text: 'Alertas proactivas y escalamiento automático' 
        },
        { 
          icon: 'bar-chart-3',
          iconType: 'lucide',
          animation: 'bars-move',
          text: 'Dashboard de métricas y KPIs en tiempo real' 
        }
      ],
      technologies: ['UiPath', 'Zapier', 'Make', 'n8n', 'Power Automate', 'Python Automation']
    },
    {
      id: 'local-llms',
      title: 'LOCAL LLMS',
      description: 'Implementación y optimización de modelos de lenguaje ejecutados localmente, garantizando privacidad total de datos y cumplimiento regulatorio sin dependencias cloud.',
      features: [
        { 
          icon: 'server',
          iconType: 'lucide',
          animation: 'pulse',
          text: 'Deployment on-premise de modelos open source' 
        },
        { 
          icon: 'lock',
          iconType: 'lucide',
          animation: 'glow',
          text: 'Privacidad total - datos nunca salen de tu infraestructura' 
        },
        { 
          icon: 'zap',
          iconType: 'lucide',
          animation: 'bounce',
          text: 'Optimización de inferencia con quantization' 
        },
        { 
          icon: 'settings',
          iconType: 'lucide',
          animation: 'rotate',
          text: 'Fine-tuning con datos propietarios' 
        },
        { 
          icon: 'smartphone',
          iconType: 'lucide',
          animation: 'heartbeat',
          text: 'Edge deployment para aplicaciones móviles' 
        }
      ],
      technologies: ['Llama 3', 'Mistral', 'Ollama', 'LocalAI', 'vLLM', 'GGUF/GGML', 'TensorRT']
    },
    {
      id: 'finops-ai',
      title: 'FINOPS AI',
      description: 'Optimización financiera de recursos cloud e IA mediante análisis predictivo, identificando oportunidades de ahorro y mejorando el ROI de inversiones tecnológicas.',
      features: [
        { 
          icon: 'dollar-sign',
          iconType: 'lucide',
          animation: 'pulse',
          text: 'Análisis de costos cloud multi-proveedor' 
        },
        { 
          icon: 'trending-down',
          iconType: 'lucide',
          animation: 'bars-move',
          text: 'Detección de recursos subutilizados con ML' 
        },
        { 
          icon: 'target',
          iconType: 'lucide',
          animation: 'glow',
          text: 'Recomendaciones de rightsizing automáticas' 
        },
        { 
          icon: 'line-chart',
          iconType: 'lucide',
          animation: 'bars-move',
          text: 'Forecasting de gastos con series temporales' 
        },
        { 
          icon: 'zap',
          iconType: 'lucide',
          animation: 'bounce',
          text: 'Optimización de costos de inferencia LLM' 
        }
      ],
      technologies: ['AWS Cost Explorer', 'Azure Cost Management', 'Kubecost', 'CloudHealth', 'Prophet', 'Custom Analytics']
    },
    {
      id: 'custom-integrations',
      title: 'CUSTOM INTEGRATIONS',
      description: 'Desarrollo de integraciones personalizadas que conectan sistemas legacy con tecnologías de IA modernas, creando ecosistemas tecnológicos cohesivos y eficientes.',
      features: [
        { 
          icon: 'plug',
          iconType: 'lucide',
          animation: 'pulse',
          text: 'APIs REST/GraphQL con capacidades IA' 
        },
        { 
          icon: 'repeat',
          iconType: 'lucide',
          animation: 'rotate',
          text: 'ETL pipelines inteligentes con validación ML' 
        },
        { 
          icon: 'radio',
          iconType: 'lucide',
          animation: 'heartbeat',
          text: 'Webhooks y event-driven architectures' 
        },
        { 
          icon: 'shield-check',
          iconType: 'lucide',
          animation: 'glow',
          text: 'Middleware de seguridad y autenticación' 
        },
        { 
          icon: 'activity',
          iconType: 'lucide',
          animation: 'bars-move',
          text: 'Real-time data streaming con procesamiento IA' 
        }
      ],
      technologies: ['FastAPI', 'Apache Kafka', 'Redis', 'RabbitMQ', 'Airbyte', 'Mulesoft', 'Custom Python/Node.js']
    },
    // v6.1: Núvariz - Universo próximamente
    {
      id: 'nuvaris',
      title: 'NÚVARIZ',
      description: 'Universo Núvariz - Próximamente. Un nuevo mundo está por revelarse.',
      features: [
        {
          icon: 'clock',
          iconType: 'lucide',
          animation: 'pulse',
          text: 'En desarrollo activo'
        },
        {
          icon: 'rocket',
          iconType: 'lucide',
          animation: 'bounce',
          text: 'Próximo lanzamiento'
        }
      ],
      technologies: ['Próximamente']
    },
    // v6.3: DeskFlow - Escritorios virtuales
    {
      id: 'deskflow',
      title: 'DESKFLOW',
      description: 'App de escritorios virtuales con notas, conexiones visuales y sincronización en la nube. Organiza tu trabajo de forma visual.',
      features: [
        {
          icon: 'layout',
          iconType: 'lucide',
          animation: 'pulse',
          text: 'Escritorios virtuales anidados'
        },
        {
          icon: 'link',
          iconType: 'lucide',
          animation: 'bounce',
          text: 'Conexiones visuales entre notas'
        },
        {
          icon: 'cloud',
          iconType: 'lucide',
          animation: 'glow',
          text: 'Sincronización con Supabase'
        }
      ],
      technologies: ['Angular 21', 'Supabase', 'IndexedDB', 'GSAP']
    }
  ];

  constructor() { }

  getServices(): Service[] {
    return this.services;
  }

  getService(id: string): Service | undefined {
    return this.services.find(s => s.id === id);
  }

  getConsultationProcess(): ConsultationProcess {
    return this.consultationProcess;
  }

  getProfileData() {
    return this.profileData;
  }

  getCtaData() {
    return this.ctaData;
  }

  getServiceDetail(id: string): ServiceDetail | undefined {
    return this.servicesDetail.find(s => s.id === id);
  }

  getAllServiceDetails(): ServiceDetail[] {
    return this.servicesDetail;
  }
}
