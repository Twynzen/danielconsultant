import { Component, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BinaryCharacterComponent } from '../../components/binary-character/binary-character.component';

interface ChatMessage { role: 'user' | 'agent'; text: string; }
interface HubItem { label: string; value: string; }
interface PricePlan { name: string; price: string; period: string; features: string[]; cta: string; popular?: boolean; }
interface HistCard { num: string; badge: string; p1: string; p2: string; quote: string; }

interface ServiceMode {
  id: string;
  label: string;
  color: string;
  colorDim: string;
  colorHighlight: string;
  robotFilter: string;
  heroBadge: string;
  heroTitle: string;
  heroAccent: string;
  heroSub: string;
  heroCta1: string;
  chatName: string;
  chatMessages: ChatMessage[];
  hubTitle: string;
  hubItems: HubItem[];
  histCard1: HistCard;
  histCard2: HistCard;
  features: string[];
  preciosSub: string;
  plans: PricePlan[];
}

@Component({
  selector: 'app-servicios-landing',
  standalone: true,
  imports: [RouterLink, BinaryCharacterComponent],
  templateUrl: './servicios-landing.component.html',
  styleUrl: './servicios-landing.component.scss',
})
export class ServiciosLandingComponent {

  readonly modes: ServiceMode[] = [
    {
      id: 'personal',
      label: 'PERSONAL',
      color: '#d8d8d8',
      colorDim: 'rgba(216, 216, 216, 0.2)',
      colorHighlight: '#ffffff',
      robotFilter: 'saturate(0) brightness(2.5)',
      heroBadge: '✦ Tu Compañero IA',
      heroTitle: 'Tu Compañero',
      heroAccent: 'IA Personal',
      heroSub: 'Un asistente que te conoce, organiza tu vida y evoluciona contigo. Disponible 24/7, con memoria perfecta.',
      heroCta1: 'Conoce a tu Sendell →',
      chatName: 'Sendell Personal',
      chatMessages: [
        { role: 'user', text: 'Tengo reunión con el dentista mañana, ¿a qué hora era?' },
        { role: 'agent', text: 'Tu cita es mañana a las 3:30 PM en Clínica Dental Norte. ¿Quieres que te recuerde 1 hora antes?' },
        { role: 'user', text: 'Sí, y recuérdame llevar los resultados de laboratorio' },
        { role: 'agent', text: 'Listo. Recordatorio a las 2:30 PM con nota sobre los resultados. También vi que mañana llueve — lleva paraguas.' },
      ],
      hubTitle: 'Tu Día Organizado',
      hubItems: [
        { label: 'Próxima cita', value: '3:30 PM Dentista' },
        { label: 'Recordatorio', value: '2:30 PM activo' },
        { label: 'Clima', value: 'Lluvia — lleva paraguas' },
        { label: 'Tareas', value: '3 pendientes hoy' },
      ],
      histCard1: {
        num: '01', badge: 'Tu Segundo Cerebro',
        p1: 'Un asistente que no olvida. Cada conversación construye una memoria que te ayuda a ser más organizado.',
        p2: 'Agenda, recordatorios, notas — todo en un solo lugar inteligente.',
        quote: 'No más olvidos. No más caos.',
      },
      histCard2: {
        num: '02', badge: 'Privacidad Primero',
        p1: 'Tus datos son tuyos. Instalación local disponible. Sin servidores de terceros si lo prefieres.',
        p2: 'Control total de tu información personal.',
        quote: 'Tu privacidad, nuestra prioridad absoluta.',
      },
      features: [
        'Memoria a largo plazo — recuerda todo lo que le dices',
        'Organización de agenda y recordatorios inteligentes',
        'Aprendizaje continuo — se adapta a tu estilo de vida',
        'Multi-canal: WhatsApp, Web, Discord',
        'Privacidad total — tus datos son solo tuyos',
        'Conexión con calendario, correo, notas',
      ],
      preciosSub: 'Empieza gratis, actualiza cuando quieras',
      plans: [
        {
          name: 'Básico',
          price: '$0',
          period: 'Para siempre',
          features: ['1 agente', 'Memoria 7 días', 'WhatsApp'],
          cta: 'Empezar gratis',
        },
        {
          name: 'Plus',
          price: '$15',
          period: '/mes',
          features: ['Memoria ilimitada', 'Todos los canales', 'Calendario integrado', 'Recordatorios inteligentes'],
          cta: 'Probar Plus',
        },
        {
          name: 'Premium',
          price: '$35',
          period: '/mes',
          features: ['Todo Plus', 'Comandos de voz', 'Integraciones avanzadas', 'Instalación local', 'Soporte prioritario'],
          cta: 'Ir Premium',
          popular: true,
        },
      ],
    },
    {
      id: 'soporte',
      label: 'SOPORTE',
      color: '#ff3333',
      colorDim: 'rgba(255, 51, 51, 0.2)',
      colorHighlight: '#ff6b35',
      robotFilter: 'hue-rotate(244deg) saturate(2.5) brightness(1.2)',
      heroBadge: '✦ Soporte 24/7',
      heroTitle: 'Soporte al Cliente',
      heroAccent: 'con IA Real',
      heroSub: 'Atención 24/7 que entiende a tus clientes, resuelve problemas y escala cuando es necesario. Sin esperas, sin frustración.',
      heroCta1: 'Activa tu Soporte →',
      chatName: 'Ecolimpieza Soporte AI',
      chatMessages: [
        { role: 'user', text: 'Hola, necesito agendar una limpieza profunda para este sábado' },
        { role: 'agent', text: '¡Hola! Con gusto te ayudo. ¿Es para apartamento o casa? ¿Cuántos metros cuadrados aproximadamente?' },
        { role: 'user', text: 'Apartamento, como 80 metros' },
        { role: 'agent', text: 'Perfecto. Para 80m² la limpieza profunda tiene un valor de $180.000 COP. Tenemos disponibilidad el sábado de 8AM a 2PM. ¿Cuál horario prefieres?' },
      ],
      hubTitle: 'Panel de Soporte',
      hubItems: [
        { label: 'Tickets abiertos', value: '12' },
        { label: 'Tiempo promedio', value: '< 2 min' },
        { label: 'Satisfacción', value: '98% positivos' },
        { label: 'Resueltos hoy', value: '47 casos' },
      ],
      histCard1: {
        num: '01', badge: 'Nunca Más En Espera',
        p1: 'Tus clientes reciben respuesta en segundos, no en horas. Un agente que conoce tu negocio mejor que nadie.',
        p2: 'Escalación inteligente a humanos cuando la situación lo requiere.',
        quote: 'Clientes felices, negocio que crece.',
      },
      histCard2: {
        num: '02', badge: 'Seguridad Empresarial',
        p1: 'Protocolo SENTINEL integrado. El agente protege los datos de tus clientes.',
        p2: 'Cumplimiento normativo. Privacidad garantizada. Confianza total.',
        quote: 'Tu seguridad es nuestra misión.',
      },
      features: [
        'Atención 24/7 sin descanso',
        'Respuestas instantáneas en WhatsApp, Web, Email',
        'Escalación inteligente a humanos cuando se necesita',
        'Base de conocimiento que se actualiza sola',
        'Métricas de satisfacción en tiempo real',
        'Multiidioma automático',
      ],
      preciosSub: 'Empieza con una consulta gratuita, luego escala mientras creces',
      plans: [
        {
          name: 'Consulta',
          price: '$0',
          period: 'Gratuita',
          features: ['Diagnóstico de tu negocio', 'Identificamos oportunidades', 'Sin compromiso'],
          cta: 'Comenzar gratis',
        },
        {
          name: 'Starter',
          price: '$350',
          period: '/mes',
          features: ['1 agente IA', 'WhatsApp + WebChat', '500 conversaciones/mes', 'Setup $500'],
          cta: 'Solicitar',
        },
        {
          name: 'Pro',
          price: '$600',
          period: '/mes',
          features: ['Agentes ilimitados', 'Todos los canales', 'Métricas avanzadas', 'Seguridad SENTINEL', 'Setup $1,500'],
          cta: 'Solicitar Pro',
          popular: true,
        },
        {
          name: 'Enterprise',
          price: 'Custom',
          period: '',
          features: ['SLA dedicado', 'Integración CRM', 'Instalación on-premise', 'Gerente dedicado'],
          cta: 'Contactar',
        },
      ],
    },
    {
      id: 'negocios',
      label: 'NEGOCIOS',
      color: '#4f8ef7',
      colorDim: 'rgba(79, 142, 247, 0.2)',
      colorHighlight: '#8b5cf6',
      robotFilter: 'hue-rotate(74deg) saturate(1.5) brightness(1.1)',
      heroBadge: '✦ Automatización IA',
      heroTitle: 'Automatiza tu Negocio',
      heroAccent: 'con Agentes IA',
      heroSub: 'Ventas, contabilidad, gestión de leads — agentes especializados que trabajan por ti mientras te enfocas en crecer.',
      heroCta1: 'Escala tu Negocio →',
      chatName: 'Sendell Consultant',
      chatMessages: [
        { role: 'user', text: 'Me interesa implementar IA en mi empresa de logística' },
        { role: 'agent', text: '¡Hola! Excelente. ¿Cuántos empleados tienen y cuáles procesos les gustaría automatizar primero?' },
        { role: 'user', text: 'Somos 50 personas, el cuello de botella es la atención de pedidos por WhatsApp' },
        { role: 'agent', text: 'Ese es nuestro caso de uso más fuerte. Procesamos hasta 500 conversaciones diarias. Le preparo una propuesta personalizada. ¿Le funciona una llamada el jueves?' },
      ],
      hubTitle: 'Hub de Ventas',
      hubItems: [
        { label: 'Leads nuevos', value: '23 hoy' },
        { label: 'Propuestas enviadas', value: '8 esta semana' },
        { label: 'Pipeline value', value: '$48,500' },
        { label: 'Conversión del mes', value: '34%' },
      ],
      histCard1: {
        num: '01', badge: 'Tu Equipo IA',
        p1: 'No es un chatbot. Es un equipo completo: ventas, soporte, contabilidad, operaciones — trabajando juntos.',
        p2: 'Cada agente aprende de tu negocio y se hace más inteligente con el tiempo.',
        quote: 'Un equipo que nunca duerme.',
      },
      histCard2: {
        num: '02', badge: 'Crece Sin Límites',
        p1: 'Empieza con un agente, escala a un ecosistema completo.',
        p2: 'Integraciones con CRM, contabilidad, facturación DIAN, y más.',
        quote: 'Tu negocio, amplificado por inteligencia artificial.',
      },
      features: [
        'Agente de ventas que captura y califica leads 24/7',
        'Contabilidad automatizada (DIAN, facturación, retenciones)',
        'Gestión de pipeline y seguimiento automático',
        'Reportes y métricas de negocio en tiempo real',
        'Integración con CRM, contabilidad, facturación',
        'Instalación en tu servidor para control total',
      ],
      preciosSub: 'Empieza con una consulta gratuita, luego escala mientras creces',
      plans: [
        {
          name: 'Consulta',
          price: '$0',
          period: 'Gratuita',
          features: ['Diagnóstico de tu negocio', 'Identificamos oportunidades', 'Sin compromiso'],
          cta: 'Comenzar gratis',
        },
        {
          name: 'Starter',
          price: '$500',
          period: '/mes',
          features: ['1 agente especializado', 'WhatsApp + Web', 'Métricas básicas', 'Setup $1,000'],
          cta: 'Solicitar',
        },
        {
          name: 'Pro',
          price: '$900',
          period: '/mes',
          features: ['Multi-agente (ventas + soporte + contabilidad)', 'Todos los canales', 'Dashboard completo', 'Setup $2,000'],
          cta: 'Solicitar Pro',
          popular: true,
        },
        {
          name: 'Enterprise',
          price: 'Custom',
          period: '',
          features: ['Agentes a medida', 'Integración total', 'SLA dedicado', 'Gerente de éxito dedicado'],
          cta: 'Contactar',
        },
      ],
    },
  ];

  selectedIndex = signal(0);
  selected = computed(() => this.modes[this.selectedIndex()]);

  selectMode(index: number): void {
    this.selectedIndex.set(index);
  }

  onAgendarClick(): void {
    window.open('https://calendly.com/darmcastiblanco/30min', '_blank');
  }

  scrollTo(id: string, event?: Event): void {
    event?.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }

  onChatClick(): void {
    window.open('https://wa.me/573007980679', '_blank');
  }
}
